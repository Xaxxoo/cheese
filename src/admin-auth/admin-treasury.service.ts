// src/admin-auth/admin-treasury.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/services/blockchain.service';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class AdminTreasuryService {
  private readonly logger = new Logger(AdminTreasuryService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

  private get vaultAddress(): string {
    return this.config.get<string>('AMOY_VAULT_ADDRESS') ?? '';
  }

  private get vaultUsdcAddress(): string {
    return this.config.get<string>('AMOY_USDC_ADDRESS') ?? '';
  }

  private get withdrawalDestination(): string {
    const addr = this.config.get<string>('AMOY_WITHDRAWAL_ADDRESS') ?? '';
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      throw new ServiceUnavailableException(
        'AMOY_WITHDRAWAL_ADDRESS not configured or invalid — set it to a cold wallet or multisig address',
      );
    }
    return addr;
  }

  private readonly VAULT_CHAIN_ID = 80002;

  // ── GET /admin/treasury ──────────────────────────────────────────────────
  async getBalance(): Promise<{
    address:     string;
    balanceUsdc: string;
    evmVault?: {
      vaultAddress: string;
      payments:     string;
      fees:         string;
      total:        string;
      chainId:      number;
    };
  }> {
    const address = this.blockchain.platformPublicKey;
    if (!address) {
      throw new ServiceUnavailableException(
        'Platform wallet not initialised — check STELLAR_PLATFORM_SECRET_KEY',
      );
    }
    const balanceUsdc = await this.blockchain.getStellarUsdcBalance(address);

    let evmVault: { vaultAddress: string; payments: string; fees: string; total: string; chainId: number } | undefined;
    if (this.blockchain.isEvmReady && this.vaultAddress && this.vaultUsdcAddress) {
      try {
        const vb = await this.blockchain.getVaultBalance(
          this.vaultAddress,
          this.vaultUsdcAddress,
          this.VAULT_CHAIN_ID,
        );
        evmVault = { vaultAddress: this.vaultAddress, chainId: this.VAULT_CHAIN_ID, ...vb };
      } catch (err) {
        this.logger.warn(`EVM vault balance fetch failed: ${(err as Error).message}`);
        // Graceful degradation — Stellar section still works
      }
    }

    return { address, balanceUsdc, ...(evmVault ? { evmVault } : {}) };
  }

  // ── POST /admin/treasury/transfer ────────────────────────────────────────
  async transfer(
    toAddress: string,
    amountUsdc: string,
  ): Promise<{ txHash: string; toAddress: string; amountUsdc: string }> {
    const platformAddress = this.blockchain.platformPublicKey;
    if (!platformAddress) {
      throw new ServiceUnavailableException(
        'Platform wallet not initialised — check STELLAR_PLATFORM_SECRET_KEY',
      );
    }

    const amount = parseFloat(amountUsdc);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    // Safety — do not allow sending to the platform wallet itself
    if (toAddress === platformAddress) {
      throw new BadRequestException(
        'Destination address cannot be the platform wallet itself',
      );
    }

    const balance = parseFloat(
      await this.blockchain.getStellarUsdcBalance(platformAddress),
    );
    if (amount > balance) {
      throw new BadRequestException(
        `Insufficient platform balance. Available: ${balance.toFixed(6)} USDC`,
      );
    }

    this.logger.log(
      `Treasury transfer initiated: ${amountUsdc} USDC → ${toAddress}`,
    );

    const txHash = await this.blockchain.platformDepositUsdc(toAddress, amountUsdc);

    this.logger.log(
      `Treasury transfer settled [hash=${txHash}] [to=${toAddress}] [amount=${amountUsdc}]`,
    );

    return { txHash, toAddress, amountUsdc };
  }

  // ── POST /admin/treasury/evm-withdraw ────────────────────────────────────
  async evmWithdraw(): Promise<{ txHash: string; toAddress: string }> {
    if (!this.blockchain.isEvmReady || !this.vaultAddress || !this.vaultUsdcAddress) {
      throw new ServiceUnavailableException(
        'EVM vault not configured — check AMOY_RPC_URL, AMOY_VAULT_ADDRESS, AMOY_USDC_ADDRESS',
      );
    }
    const toAddress = this.withdrawalDestination;
    this.logger.log(`evmWithdraw initiated [to=${toAddress}]`);
    const txHash = await this.blockchain.withdrawFromVault(
      this.vaultAddress, toAddress, this.vaultUsdcAddress, this.VAULT_CHAIN_ID,
    );
    this.logger.log(`evmWithdraw settled [txHash=${txHash}] [to=${toAddress}]`);
    return { txHash, toAddress };
  }

  // ── POST /admin/treasury/recover-contract-balance ─────────────────────────
  // Calls withdraw(username, amount, stellarAddress) on the Soroban contract,
  // which debits the user's internal balance and sends USDC back to their
  // Stellar address. Use when a user's USDC is stuck in the contract
  // (e.g. after migration) but is not showing on their balance.
  async recoverContractBalance(opts: {
    userId: string;
    amountUsdc: string;
  }): Promise<{ txHash: string; amountUsdc: string; toAddress: string; contractBalanceBefore: string }> {
    const user = await this.userRepo.findOne({ where: { id: opts.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.username) throw new BadRequestException('User has no username — cannot query contract');
    if (!user.stellarPublicKey) throw new BadRequestException('User has no Stellar wallet');

    const amount = parseFloat(opts.amountUsdc);
    if (isNaN(amount) || amount <= 0) throw new BadRequestException('Invalid amount');

    if (!this.blockchain.isSorobanReady) {
      throw new ServiceUnavailableException(
        'Soroban not configured — check STELLAR_CONTRACT_ID, STELLAR_SOROBAN_RPC_URL',
      );
    }

    const contractBalanceBefore = await this.blockchain.getSorobanBalance(user.username);
    if (parseFloat(contractBalanceBefore) < amount) {
      throw new BadRequestException(
        `Insufficient contract balance for @${user.username}. ` +
        `Available: ${contractBalanceBefore} USDC, requested: ${opts.amountUsdc} USDC`,
      );
    }

    this.logger.log(
      `recoverContractBalance initiated [user=@${user.username}] [amount=${opts.amountUsdc}] [to=${user.stellarPublicKey}]`,
    );

    // contract withdraw(username, amount, to_address) — debits internal balance
    // and executes usdc.transfer(contract → user's Stellar address) atomically.
    const result = await this.blockchain.sendViaContract({
      fromUsername: user.username,
      fromPublicKey: user.stellarPublicKey,
      amountUsdc: opts.amountUsdc,
      toPublicKey: user.stellarPublicKey,
    });

    this.logger.log(
      `recoverContractBalance settled [user=@${user.username}] [hash=${result.txHash}] [to=${user.stellarPublicKey}]`,
    );

    return {
      txHash: result.txHash,
      amountUsdc: opts.amountUsdc,
      toAddress: user.stellarPublicKey,
      contractBalanceBefore,
    };
  }
}
