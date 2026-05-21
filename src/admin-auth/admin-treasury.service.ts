// src/admin-auth/admin-treasury.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/services/blockchain.service';

@Injectable()
export class AdminTreasuryService {
  private readonly logger = new Logger(AdminTreasuryService.name);

  constructor(
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

  private get vaultAddress(): string {
    return this.config.get<string>('AMOY_VAULT_ADDRESS') ?? '';
  }

  private get vaultUsdcAddress(): string {
    return this.config.get<string>('AMOY_USDC_ADDRESS') ?? '';
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
  async evmWithdraw(toAddress: string): Promise<{ txHash: string; toAddress: string }> {
    if (!this.blockchain.isEvmReady || !this.vaultAddress || !this.vaultUsdcAddress) {
      throw new ServiceUnavailableException(
        'EVM vault not configured — check AMOY_RPC_URL, AMOY_VAULT_ADDRESS, AMOY_USDC_ADDRESS',
      );
    }
    this.logger.log(`evmWithdraw initiated [to=${toAddress}]`);
    const txHash = await this.blockchain.withdrawFromVault(
      this.vaultAddress, toAddress, this.vaultUsdcAddress, this.VAULT_CHAIN_ID,
    );
    this.logger.log(`evmWithdraw settled [txHash=${txHash}] [to=${toAddress}]`);
    return { txHash, toAddress };
  }
}
