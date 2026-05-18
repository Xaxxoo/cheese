// src/admin-auth/admin-treasury.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BlockchainService } from '../blockchain/services/blockchain.service';

@Injectable()
export class AdminTreasuryService {
  private readonly logger = new Logger(AdminTreasuryService.name);

  constructor(private readonly blockchain: BlockchainService) {}

  // ── GET /admin/treasury ──────────────────────────────────────────────────
  async getBalance(): Promise<{ address: string; balanceUsdc: string }> {
    const address = this.blockchain.platformPublicKey;
    if (!address) {
      throw new ServiceUnavailableException(
        'Platform wallet not initialised — check STELLAR_PLATFORM_SECRET_KEY',
      );
    }
    const balanceUsdc = await this.blockchain.getStellarUsdcBalance(address);
    return { address, balanceUsdc };
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
}
