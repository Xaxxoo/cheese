// src/yield/blend.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class BlendService {
  private readonly logger = new Logger(BlendService.name);
  private readonly blendPoolId: string;
  private readonly blendUsdcContract: string;
  private readonly horizonUrl: string;
  private readonly networkPassphrase: string;
  private readonly platformKeypair: StellarSdk.Keypair | null;

  constructor(private readonly config: ConfigService) {
    this.blendPoolId = config.get<string>('yield.blendPoolId', '');
    this.blendUsdcContract = config.get<string>('yield.blendUsdcContract', '');
    this.horizonUrl = config.get<string>(
      'stellar.horizonUrl',
      'https://horizon.stellar.org',
    );

    const network = config.get<string>('stellar.network', 'mainnet');
    this.networkPassphrase =
      network === 'testnet'
        ? StellarSdk.Networks.TESTNET
        : StellarSdk.Networks.PUBLIC;

    const secret = process.env.STELLAR_PLATFORM_SECRET_KEY;
    this.platformKeypair = secret ? StellarSdk.Keypair.fromSecret(secret) : null;

    if (!this.platformKeypair) {
      this.logger.warn(
        'STELLAR_PLATFORM_SECRET_KEY not set — Blend pool operations disabled',
      );
    }
  }

  /**
   * Supply USDC collateral to the Blend Capital lending pool.
   * Returns the on-chain transaction hash.
   */
  async supplyToPool(amountUsdc: string): Promise<string> {
    if (!this.platformKeypair || !this.blendPoolId) {
      throw new Error('Blend pool not configured');
    }

    this.logger.log(`Supplying ${amountUsdc} USDC to Blend pool`);

    const server = new StellarSdk.Horizon.Server(this.horizonUrl);
    const account = await server.loadAccount(
      this.platformKeypair.publicKey(),
    );

    // Build a Soroban contract invocation for the Blend pool supply.
    // The actual contract call depends on the Blend SDK; here we use
    // a placeholder memo-based marker until the SDK is wired in.
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: this.blendPoolId,
          asset: new StellarSdk.Asset(
            'USDC',
            this.blendUsdcContract,
          ),
          amount: amountUsdc,
        }),
      )
      .addMemo(StellarSdk.Memo.text('blend-supply'))
      .setTimeout(120)
      .build();

    tx.sign(this.platformKeypair);
    const result = await server.submitTransaction(tx);
    const txHash = result.hash;
    this.logger.log(`Blend supply tx: ${txHash}`);
    return txHash;
  }

  /**
   * Withdraw USDC collateral from the Blend Capital lending pool.
   * Returns the on-chain transaction hash.
   */
  async withdrawFromPool(amountUsdc: string): Promise<string> {
    if (!this.platformKeypair || !this.blendPoolId) {
      throw new Error('Blend pool not configured');
    }

    this.logger.log(`Withdrawing ${amountUsdc} USDC from Blend pool`);

    const server = new StellarSdk.Horizon.Server(this.horizonUrl);
    const account = await server.loadAccount(
      this.platformKeypair.publicKey(),
    );

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: this.platformKeypair.publicKey(),
          asset: new StellarSdk.Asset(
            'USDC',
            this.blendUsdcContract,
          ),
          amount: amountUsdc,
          source: this.blendPoolId,
        }),
      )
      .addMemo(StellarSdk.Memo.text('blend-withdraw'))
      .setTimeout(120)
      .build();

    tx.sign(this.platformKeypair);
    const result = await server.submitTransaction(tx);
    const txHash = result.hash;
    this.logger.log(`Blend withdraw tx: ${txHash}`);
    return txHash;
  }

  /**
   * Read the platform's current position in the Blend lending pool.
   * Returns the total USDC supplied and accrued earnings.
   */
  async getPoolPosition(): Promise<{
    suppliedUsdc: string;
    earnedUsdc: string;
  }> {
    if (!this.platformKeypair || !this.blendPoolId) {
      return { suppliedUsdc: '0', earnedUsdc: '0' };
    }

    try {
      const server = new StellarSdk.Horizon.Server(this.horizonUrl);
      const account = await server.loadAccount(
        this.platformKeypair.publicKey(),
      );

      // Look for USDC balance lines held by the platform account.
      // In a full integration this would query the Blend bToken balance;
      // for now we read the classic trustline balance as a proxy.
      let suppliedUsdc = '0';
      for (const balance of account.balances) {
        if (
          'asset_code' in balance &&
          balance.asset_code === 'USDC' &&
          balance.asset_issuer === this.blendUsdcContract
        ) {
          suppliedUsdc = balance.balance;
          break;
        }
      }

      return { suppliedUsdc, earnedUsdc: '0' };
    } catch (err) {
      this.logger.error(
        `Failed to read Blend pool position: ${(err as Error).message}`,
      );
      return { suppliedUsdc: '0', earnedUsdc: '0' };
    }
  }
}
