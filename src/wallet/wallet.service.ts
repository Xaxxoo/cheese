// src/wallet/wallet.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { RatesService } from '../rates/rates.service';
import { TransactionsService } from '../transactions/transactions.service';
import { User } from '../auth/entities/user.entity';
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
  evmAddress: string | null;
  network: string;
  asset: 'USDC';
  memo: null;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly blockchainService: BlockchainService,
    private readonly ratesService: RatesService,
    private readonly txService: TransactionsService,
  ) {}

  async getBalance(userId: string): Promise<WalletBalance> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [stellarRaw, evmRaw, rate] = await Promise.all([
      user.stellarPublicKey
        ? this.blockchainService.getContractBalance(user.username)
        : Promise.resolve('0.0000000'),
      user.evmAddress
        ? this.blockchainService.getEvmBalance(user.evmAddress)
        : Promise.resolve('0.00000000'),
      this.ratesService.getCurrentRate(),
    ]);

    const stellarAmount = parseFloat(stellarRaw);
    const evmAmount = parseFloat(evmRaw);
    const totalAmount = stellarAmount + evmAmount;
    const ngnRate = parseFloat(rate.effectiveRate);
    const ngnTotal = totalAmount * ngnRate;

    return {
      stellarUsdc: stellarRaw,
      stellarUsdcDisplay: `$${stellarAmount.toFixed(2)}`,
      evmUsdc: evmRaw,
      evmUsdcDisplay: `$${evmAmount.toFixed(2)}`,
      totalUsdc: totalAmount.toFixed(6),
      totalUsdcDisplay: `$${totalAmount.toFixed(2)}`,
      ngnEquivalent: `₦${ngnTotal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ngnRate,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getAddress(userId: string): Promise<DepositAddress> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.stellarPublicKey)
      throw new NotFoundException('Wallet not initialised');

    return {
      stellarAddress: user.stellarPublicKey,
      evmAddress: user.evmAddress ?? null,
      network: 'Stellar',
      asset: 'USDC',
      memo: null,
    };
  }

  getDepositNetworks() {
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
      {
        id: 'evm',
        name: 'EVM (Base / Arbitrum / Polygon)',
        asset: 'USDC',
        fee: 'Network gas',
        minDeposit: '1.00',
        confirmations: 12,
        estimatedTime: '~15 seconds',
        note: 'Send USDC to your EVM address via the Cheese EVM contract.',
      },
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

    const wallet = await this.blockchainService.createStellarWallet();
    await this.userRepo.update(
      { id: userId },
      {
        stellarPublicKey: wallet.publicKey,
        stellarSecretEnc: wallet.secretKeyEnc,
      },
    );

    this.logger.log(
      `Wallet provisioned on-demand [userId=${userId}] [pk=${wallet.publicKey}]`,
    );
    return { stellarPublicKey: wallet.publicKey, alreadyExisted: false };
  }

  async registerOnChain(user: User): Promise<void> {
    if (!user.stellarPublicKey) return;
    try {
      const txHash = await this.blockchainService.registerUser(
        user.username,
        user.stellarPublicKey,
      );
      this.logger.log(`On-chain registration: @${user.username} — ${txHash}`);
    } catch (err) {
      this.logger.error(
        `On-chain registration failed for @${user.username}: ${(err as Error).message}`,
      );
    }
  }

  async creditDepositByUsername(
    username: string,
    amountUsdc: string,
    txHash: string,
    userId: string,
  ): Promise<void> {
    await this.blockchainService.contractDeposit(username, amountUsdc);

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

    await this.blockchainService.contractDepositByAddress(
      stellarAddress,
      amountUsdc,
    );

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
      await this.blockchainService.contractWithdraw(
        username,
        amountUsdc,
        toAddress,
      );

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user?.stellarSecretEnc) throw new Error('Custodial key not found');

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
