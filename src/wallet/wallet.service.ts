// src/wallet/wallet.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { RatesService } from '../rates/rates.service';
import { TransactionsService } from '../transactions/transactions.service';
import { User, WalletStatus } from '../auth/entities/user.entity';
import {
  BlockchainWallet,
  WalletStatus as BlockchainWalletStatus,
} from '../blockchain/entities/blockchain-wallet.entity';
import { TxStatus, TxType } from '../transactions/entities/transaction.entity';
import { v4 as uuidv4 } from 'uuid';

export interface WalletBalance {
  stellarUsdc: string;
  stellarUsdcDisplay: string;
  evmUsdc: string;
  evmUsdcDisplay: string;
  totalUsdc: string;
  totalUsdcDisplay: string;
  ngnEquivalent: string;
  ngnRate: number;
  lastUpdated: string;
}

export interface DepositAddress {
  stellarAddress: string;
  evmAddresses: Record<number, { address: string; chainName: string }>;
  asset: 'USDC';
  memo: null;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(BlockchainWallet)
    private readonly blockchainWalletRepo: Repository<BlockchainWallet>,
    private readonly blockchainService: BlockchainService,
    private readonly ratesService: RatesService,
    private readonly txService: TransactionsService,
  ) {}

  async getBalance(userId: string): Promise<WalletBalance> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [stellarRaw, evmRaw, rate] = await Promise.all([
      // Balance strategy:
      //   1. If Soroban is ready and user has a username, query balance(username)
      //      from the contract. The contract stores balances keyed by username
      //      (deposit_by_address resolves address → username before crediting).
      //   2. If Soroban shows 0, or user has no username, fall back to Horizon
      //      for users whose USDC is still at their own Stellar address.
      //   3. If Soroban is unavailable, use Horizon directly.
      //   Each source has its own catch so a single service being down never
      //   crashes the request — it just returns 0 for that source.
      user.stellarPublicKey
        ? (async () => {
            if (this.blockchainService.isSorobanReady && user.username) {
              // balance(username: String) — the contract keys balances by
              // username, not by Stellar address.
              const sorobanRaw = await this.blockchainService
                .getSorobanBalance(user.username)
                .catch(() => '0.0000000');
              if (parseFloat(sorobanRaw) > 0) return sorobanRaw;
              // Soroban shows 0 — fall through to Horizon for users whose
              // USDC is still at their Stellar address (pre-migration).
            }
            return this.blockchainService
              .getStellarUsdcBalance(user.stellarPublicKey!)
              .catch(() => '0.0000000');
          })()
        : Promise.resolve('0.0000000'),
      user.evmAddress && this.blockchainService.isEvmReady
        ? this.blockchainService
            .getEvmBalance(user.evmAddress)
            .catch(() => '0.00000000')
        : Promise.resolve('0.00000000'),
      this.ratesService.getCurrentRate().catch(() => null),
    ]);

    const stellarAmount = parseFloat(stellarRaw);
    const evmAmount    = parseFloat(evmRaw);
    const totalAmount  = stellarAmount + evmAmount;
    const ngnRate      = rate ? parseFloat(rate.effectiveRate) : 0;
    const ngnTotal     = totalAmount * ngnRate;

    return {
      stellarUsdc:        stellarRaw,
      stellarUsdcDisplay: `$${stellarAmount.toFixed(2)}`,
      evmUsdc:            evmRaw,
      evmUsdcDisplay:     `$${evmAmount.toFixed(2)}`,
      totalUsdc:          totalAmount.toFixed(6),
      totalUsdcDisplay:   `$${totalAmount.toFixed(2)}`,
      ngnEquivalent: `₦${ngnTotal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ngnRate,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getAddress(userId: string): Promise<DepositAddress> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.stellarPublicKey)
      throw new NotFoundException('Wallet not initialised');

    // Build per-chain EVM address map from active blockchain_wallets rows
    const evmWallets = await this.blockchainWalletRepo.find({
      where: { userId, status: BlockchainWalletStatus.ACTIVE },
    });

    const configuredChains = this.blockchainService.getConfiguredEvmChains();
    const chainNameMap = new Map(
      configuredChains.map(({ chainId, name }) => [chainId, name]),
    );

    const evmAddresses: Record<number, { address: string; chainName: string }> = {};
    for (const w of evmWallets) {
      if (w.walletAddress) {
        evmAddresses[w.chainId] = {
          address: w.walletAddress,
          chainName: chainNameMap.get(w.chainId) ?? `chain-${w.chainId}`,
        };
      }
    }

    return {
      stellarAddress: user.stellarPublicKey,
      evmAddresses,
      asset: 'USDC',
      memo: null,
    };
  }

  getDepositNetworks() {
    const evmChains = this.blockchainService.getConfiguredEvmChains();
    const evmEntries = evmChains.map(({ chainId, name }) => ({
      id: `evm-${chainId}`,
      name: `${name.charAt(0).toUpperCase() + name.slice(1)} (EVM)`,
      asset: 'USDC',
      fee: 'Network gas',
      minDeposit: '1.00',
      confirmations: 12,
      estimatedTime: '~15 seconds',
      note: `Send USDC to your wallet address on ${name}.`,
    }));

    return [
      {
        id: 'stellar',
        name: 'Stellar Network',
        asset: 'USDC',
        fee: '0.00',
        minDeposit: '1.00',
        confirmations: 1,
        estimatedTime: '~5 seconds',
        note: 'Send USDC to your Stellar address. No memo required.',
      },
      ...evmEntries,
    ];
  }

  async provisionWallet(
    userId: string,
  ): Promise<{ stellarPublicKey: string; alreadyExisted: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.stellarPublicKey) {
      return { stellarPublicKey: user.stellarPublicKey, alreadyExisted: true };
    }

    if (!this.blockchainService.isStellarReady) {
      throw new ServiceUnavailableException(
        'Stellar not ready — check server configuration',
      );
    }

    // Phase 1: Generate keypair — free, no network calls, no XLM spent.
    const generated = this.blockchainService.generateStellarKeypair();

    // Phase 2: Atomic DB write BEFORE spending any XLM.
    // WHERE stellar_public_key IS NULL ensures only one concurrent caller
    // can claim the slot — any racing call will see affected=0.
    const result = await this.userRepo.update(
      { id: userId, stellarPublicKey: IsNull() },
      {
        stellarPublicKey: generated.publicKey,
        stellarSecretEnc: generated.secretKeyEnc,
      },
    );

    if (result.affected === 0) {
      // Another concurrent call already provisioned this wallet — return it.
      const updated = await this.userRepo.findOne({ where: { id: userId } });
      return {
        stellarPublicKey: updated!.stellarPublicKey!,
        alreadyExisted: true,
      };
    }

    // Phase 3: Fund the account and set up USDC trustline.
    // activateStellarAccount is idempotent — if this throws, the scheduler's
    // Phase B recovery will retry it on the next 2-minute run.
    await this.blockchainService.activateStellarAccount(generated.secretKeyEnc);

    await this.userRepo.update(
      { id: userId },
      { stellarWalletStatus: WalletStatus.ACTIVE },
    );

    this.logger.log(
      `Wallet provisioned on-demand [userId=${userId}] [pk=${generated.publicKey}]`,
    );
    return { stellarPublicKey: generated.publicKey, alreadyExisted: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async registerOnChain(_user: User): Promise<void> {
    // No-op: the Stellar smart-contract registration layer has been removed.
    // EVM wallet creation is handled by BlockchainService.createEvmWallet() at
    // signup time; Stellar wallets are self-sovereign and require no on-chain
    // registration beyond the trustline set up by createStellarWallet().
  }

  async creditDepositByUsername(
    username: string,
    amountUsdc: string,
    txHash: string,
    userId: string,
  ): Promise<void> {
    // Deposit arrives on-chain automatically — no contract call needed.
    // We just record the transaction in the database.
    const rate = await this.ratesService.getCurrentRate();
    const ngnEq = (
      parseFloat(amountUsdc) * parseFloat(rate.effectiveRate)
    ).toFixed(2);

    await this.txService.create({
      userId,
      type: TxType.DEPOSIT,
      status: TxStatus.COMPLETED,
      amountUsdc,
      amountNgn: ngnEq,
      feeUsdc: '0.000000',
      rateApplied: rate.effectiveRate,
      txHash,
      network: 'stellar',
      reference: `CW-DEP-${txHash.slice(0, 16).toUpperCase()}`,
      description: 'USDC deposit via Stellar',
    });

    this.logger.log(
      `Deposit credited: @${username} +$${amountUsdc} — ${txHash}`,
    );
  }

  async creditDepositByAddress(
    stellarAddress: string,
    amountUsdc: string,
    txHash: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { stellarPublicKey: stellarAddress },
    });

    if (!user) {
      this.logger.warn(`Unrecognised deposit from: ${stellarAddress}`);
      return;
    }

    // Deposit arrives on-chain automatically — no contract call needed.
    const rate = await this.ratesService.getCurrentRate();
    const ngnEq = (
      parseFloat(amountUsdc) * parseFloat(rate.effectiveRate)
    ).toFixed(2);

    await this.txService.create({
      userId: user.id,
      type: TxType.DEPOSIT,
      status: TxStatus.COMPLETED,
      amountUsdc,
      amountNgn: ngnEq,
      feeUsdc: '0.000000',
      rateApplied: rate.effectiveRate,
      txHash,
      network: 'stellar',
      reference: `CW-DEP-${txHash.slice(0, 16).toUpperCase()}`,
      description: 'USDC deposit via Stellar',
    });

    this.logger.log(
      `Deposit credited by address: @${user.username} +$${amountUsdc} — ${txHash}`,
    );
  }

  async withdraw(
    userId: string,
    amountUsdc: string,
    toAddress: string,
    username: string,
  ): Promise<{ txHash: string; reference: string }> {
    const reference = `CW-WDR-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
    const rate = await this.ratesService.getCurrentRate();
    const ngnEq = (
      parseFloat(amountUsdc) * parseFloat(rate.effectiveRate)
    ).toFixed(2);

    const tx = await this.txService.create({
      userId,
      type: TxType.WITHDRAWAL,
      status: TxStatus.PENDING,
      amountUsdc,
      amountNgn: ngnEq,
      feeUsdc: '0.000000',
      rateApplied: rate.effectiveRate,
      recipientAddress: toAddress,
      reference,
      description: `Withdrawal to ${toAddress.slice(0, 6)}…${toAddress.slice(-4)}`,
    });

    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user?.stellarSecretEnc) throw new Error('Custodial key not found');

      // Execute the Stellar send — this is the actual on-chain withdrawal.
      // The user's spendable balance is EVM + Stellar combined; withdrawals
      // route through Stellar since that is the custodial chain for outbound sends.
      const txHash = await this.blockchainService.sendUsdc({
        fromSecretEnc: user.stellarSecretEnc,
        toAddress,
        amountUsdc,
        memo: reference,
      });

      await this.txService.update(tx.id, {
        status: TxStatus.COMPLETED,
        txHash,
      });
      this.logger.log(`Withdrawal: 
        @${username} -$${amountUsdc} → ${toAddress} | ${txHash}`);
      return { txHash, reference };
    } catch (err) {
      await this.txService.update(tx.id, {
        status: TxStatus.FAILED,
        failureReason: (err as Error).message,
      });
      throw err;
    }
  }
}
