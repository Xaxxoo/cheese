// src/yield/blend.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class BlendService {
  private readonly logger = new Logger(BlendService.name);
  private readonly blendPoolId: string;
  private readonly blendUsdcContract: string;
  private readonly networkPassphrase: string;
  private readonly platformKeypair: StellarSdk.Keypair | null;
  private readonly sorobanRpc: StellarSdk.rpc.Server | null;
  private readonly blendContract: StellarSdk.Contract | null;

  /** Cumulative net USDC supplied (supply - withdraw), used to compute earned yield. */
  private totalNetSuppliedStroops = BigInt(0);

  constructor(private readonly config: ConfigService) {
    this.blendPoolId = config.get<string>('yield.blendPoolId', '');
    this.blendUsdcContract = config.get<string>('yield.blendUsdcContract', '');

    const network = config.get<string>('stellar.network', 'mainnet');
    this.networkPassphrase =
      network === 'testnet'
        ? StellarSdk.Networks.TESTNET
        : StellarSdk.Networks.PUBLIC;

    const secret = process.env.STELLAR_PLATFORM_SECRET_KEY;
    this.platformKeypair = secret ? StellarSdk.Keypair.fromSecret(secret) : null;

    // Init Soroban RPC + Blend pool contract
    const sorobanRpcUrl = config.get<string>(
      'yield.sorobanRpcUrl',
      'https://soroban-testnet.stellar.org',
    );

    if (this.blendPoolId && sorobanRpcUrl) {
      this.sorobanRpc = new StellarSdk.rpc.Server(sorobanRpcUrl);
      this.blendContract = new StellarSdk.Contract(this.blendPoolId);
      this.logger.log(
        `Blend Soroban ready [rpc=${sorobanRpcUrl}] [pool=${this.blendPoolId}]`,
      );
    } else {
      this.sorobanRpc = null;
      this.blendContract = null;
    }

    if (!this.platformKeypair) {
      this.logger.warn(
        'STELLAR_PLATFORM_SECRET_KEY not set — Blend pool operations disabled',
      );
    }
  }

  /**
   * Supply USDC collateral to the Blend Capital lending pool via Soroban.
   * Calls the pool's `submit` method with request_type=0 (Supply).
   */
  async supplyToPool(amountUsdc: string): Promise<string> {
    this.ensureConfigured();

    const amountStroops = BigInt(
      Math.round(parseFloat(amountUsdc) * 10_000_000),
    );

    this.logger.log(
      `Supplying ${amountUsdc} USDC (${amountStroops} stroops) to Blend pool`,
    );

    const platformAddress = this.platformKeypair!.publicKey();
    const request = this.buildBlendRequest(0, amountStroops);

    const sourceAcct = await this.getSorobanAccount(platformAddress);
    const rawTx = new StellarSdk.TransactionBuilder(sourceAcct, {
      fee: '500000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.blendContract!.call(
          'submit',
          new StellarSdk.Address(platformAddress).toScVal(), // from
          new StellarSdk.Address(platformAddress).toScVal(), // spender
          new StellarSdk.Address(platformAddress).toScVal(), // to
          StellarSdk.xdr.ScVal.scvVec([request]), // requests: Vec<Request>
        ),
      )
      .setTimeout(300)
      .build();

    const txHash = await this.submitAndPoll(rawTx);
    this.totalNetSuppliedStroops += amountStroops;
    this.logger.log(`Blend supply confirmed [hash=${txHash}]`);
    return txHash;
  }

  /**
   * Withdraw USDC from the Blend Capital lending pool via Soroban.
   * Calls the pool's `submit` method with request_type=1 (Withdraw).
   */
  async withdrawFromPool(amountUsdc: string): Promise<string> {
    this.ensureConfigured();

    const amountStroops = BigInt(
      Math.round(parseFloat(amountUsdc) * 10_000_000),
    );

    this.logger.log(
      `Withdrawing ${amountUsdc} USDC (${amountStroops} stroops) from Blend pool`,
    );

    const platformAddress = this.platformKeypair!.publicKey();
    const request = this.buildBlendRequest(1, amountStroops);

    const sourceAcct = await this.getSorobanAccount(platformAddress);
    const rawTx = new StellarSdk.TransactionBuilder(sourceAcct, {
      fee: '500000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.blendContract!.call(
          'submit',
          new StellarSdk.Address(platformAddress).toScVal(), // from
          new StellarSdk.Address(platformAddress).toScVal(), // spender
          new StellarSdk.Address(platformAddress).toScVal(), // to
          StellarSdk.xdr.ScVal.scvVec([request]), // requests: Vec<Request>
        ),
      )
      .setTimeout(300)
      .build();

    const txHash = await this.submitAndPoll(rawTx);
    this.totalNetSuppliedStroops -= amountStroops;
    this.logger.log(`Blend withdraw confirmed [hash=${txHash}]`);
    return txHash;
  }

  /**
   * Read the platform's current position in the Blend lending pool.
   * Calls the pool's `get_positions` read-only method and parses the result.
   */
  async getPoolPosition(): Promise<{
    suppliedUsdc: string;
    earnedUsdc: string;
  }> {
    if (!this.platformKeypair || !this.sorobanRpc || !this.blendContract) {
      return { suppliedUsdc: '0', earnedUsdc: '0' };
    }

    try {
      const platformAddress = this.platformKeypair.publicKey();
      const sourceAcct = await this.getSorobanAccount(platformAddress);

      const rawTx = new StellarSdk.TransactionBuilder(sourceAcct, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          this.blendContract.call(
            'get_positions',
            new StellarSdk.Address(platformAddress).toScVal(),
          ),
        )
        .setTimeout(30)
        .build();

      const sim = await this.sorobanRpc.simulateTransaction(rawTx);
      if (StellarSdk.rpc.Api.isSimulationError(sim)) {
        throw new Error(`Simulation error: ${sim.error}`);
      }

      const successSim =
        sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;

      // Parse the returned Positions struct to extract supply value.
      // The result contains a Map with supply share amounts per asset.
      const suppliedStroops = this.parseSupplyFromResult(successSim);
      const suppliedUsdc = (Number(suppliedStroops) / 10_000_000).toFixed(7);

      // Earned = current position value - cumulative net supplied
      const earnedStroops =
        suppliedStroops > this.totalNetSuppliedStroops
          ? suppliedStroops - this.totalNetSuppliedStroops
          : BigInt(0);
      const earnedUsdc = (Number(earnedStroops) / 10_000_000).toFixed(7);

      return { suppliedUsdc, earnedUsdc };
    } catch (err) {
      this.logger.error(
        `Failed to read Blend pool position: ${(err as Error).message}`,
      );
      return { suppliedUsdc: '0', earnedUsdc: '0' };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Build a Blend `Request` struct as an ScVal map.
   * Request { request_type: u32, address: Address, amount: i128 }
   *   request_type 0 = Supply, 1 = Withdraw
   *   address = the USDC token contract address
   */
  private buildBlendRequest(
    requestType: number,
    amountStroops: bigint,
  ): StellarSdk.xdr.ScVal {
    return StellarSdk.xdr.ScVal.scvMap([
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol('address'),
        val: new StellarSdk.Address(this.blendUsdcContract).toScVal(),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol('amount'),
        val: StellarSdk.nativeToScVal(amountStroops, { type: 'i128' }),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol('request_type'),
        val: StellarSdk.nativeToScVal(requestType, { type: 'u32' }),
      }),
    ]);
  }

  /**
   * Simulate, assemble, sign, send, and poll a Soroban transaction.
   * Returns the confirmed transaction hash.
   */
  private async submitAndPoll(
    rawTx: StellarSdk.Transaction,
  ): Promise<string> {
    // 1. Simulate
    const sim = await this.sorobanRpc!.simulateTransaction(rawTx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new Error(`Blend simulation error: ${sim.error}`);
    }

    // 2. Assemble (apply footprint + auth from simulation)
    const prepared = StellarSdk.rpc
      .assembleTransaction(
        rawTx,
        sim as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
      )
      .build();
    prepared.sign(this.platformKeypair!);

    // 3. Send
    const sendResult = await this.sorobanRpc!.sendTransaction(prepared);
    if (sendResult.status === 'ERROR') {
      throw new Error(
        `Blend submit error: ${(sendResult.errorResult as any)?.toXDR?.('base64') ?? 'unknown'}`,
      );
    }

    // 4. Poll for confirmation (up to 60 attempts, 2s apart = 2 min max)
    let getResult = await this.sorobanRpc!.getTransaction(sendResult.hash);
    let attempts = 0;
    while (
      getResult.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 60
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      getResult = await this.sorobanRpc!.getTransaction(sendResult.hash);
      attempts++;
    }

    if (getResult.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(
        `Blend transaction did not confirm: status=${getResult.status}`,
      );
    }

    return sendResult.hash;
  }

  /**
   * Fetch the Soroban-compatible account (sequence number) for tx building.
   * Falls back to Horizon if the Soroban RPC doesn't have the account.
   */
  private async getSorobanAccount(
    publicKey: string,
  ): Promise<StellarSdk.Account> {
    try {
      return await this.sorobanRpc!.getAccount(publicKey);
    } catch {
      // Fallback: load from Horizon and construct Account with sequence number
      const horizonUrl = this.config.get<string>(
        'stellar.horizonUrl',
        'https://horizon.stellar.org',
      );
      const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);
      const horizonAcct = await horizonServer.loadAccount(publicKey);
      return new StellarSdk.Account(publicKey, horizonAcct.sequenceNumber());
    }
  }

  /**
   * Parse the supply position (in stroops) from the `get_positions` simulation result.
   * The Positions struct contains `supply: Map<Address, i128>` — we look for the
   * USDC contract entry.
   */
  private parseSupplyFromResult(
    sim: StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
  ): bigint {
    try {
      const resultVal = sim.result?.retval;
      if (!resultVal) return BigInt(0);

      // The Positions struct is returned as an ScvMap. Walk the map to find
      // the 'supply' key, which itself is a Map<Address, i128>.
      const posMap = resultVal.value() as StellarSdk.xdr.ScMapEntry[];
      if (!Array.isArray(posMap)) return BigInt(0);

      for (const entry of posMap) {
        const key = entry.key();
        if (key.switch().name === 'scvSymbol' && key.sym().toString() === 'supply') {
          const supplyMap = entry.val().value() as StellarSdk.xdr.ScMapEntry[];
          if (!Array.isArray(supplyMap)) return BigInt(0);

          // Sum all supply positions (there should be one for USDC)
          let total = BigInt(0);
          for (const supplyEntry of supplyMap) {
            const amountVal = supplyEntry.val();
            total += StellarSdk.scValToBigInt(amountVal);
          }
          return total;
        }
      }

      return BigInt(0);
    } catch (err) {
      this.logger.warn(
        `Failed to parse Blend position result: ${(err as Error).message}`,
      );
      return BigInt(0);
    }
  }

  /** Guard: throws if Blend is not fully configured. */
  private ensureConfigured(): void {
    if (!this.platformKeypair || !this.sorobanRpc || !this.blendContract) {
      throw new Error('Blend pool not configured');
    }
    if (!this.blendUsdcContract) {
      throw new Error('Blend USDC contract address not configured');
    }
  }
}
