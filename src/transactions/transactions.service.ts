// src/transactions/transactions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TxStatus, TxType } from './entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  async getList(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.txRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map(this.format),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getById(userId: string, id: string) {
    const tx = await this.txRepo.findOne({ where: { id, userId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    return this.format(tx);
  }

  // Used internally by other services
  async create(data: Partial<Transaction>): Promise<Transaction> {
    return this.txRepo.save(this.txRepo.create(data));
  }

  async update(id: string, data: Partial<Transaction>): Promise<void> {
    await this.txRepo.update({ id }, data);
  }

  async updateByReference(reference: string, data: Partial<Transaction>): Promise<void> {
    await this.txRepo.update({ reference }, data);
  }

  async existsByTxHash(txHash: string): Promise<boolean> {
    return this.txRepo.existsBy({ txHash });
  }

  // ── Limit & milestone queries ─────────────────────────────

  /** Total USDC sent outbound today (crypto sends only). */
  async getDailyOutboundUsdc(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(CAST(tx.amount_usdc AS DECIMAL)), 0)', 'total')
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.type IN (:...types)', {
        types: [TxType.SEND_USERNAME, TxType.SEND_ADDRESS],
      })
      .andWhere('tx.status = :status', { status: TxStatus.COMPLETED })
      .andWhere('tx.created_at >= :startOfDay', { startOfDay })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
  }

  /** Total NGN transferred to Nigerian banks today. */
  async getDailyOutboundNgn(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(CAST(tx.amount_ngn AS DECIMAL)), 0)', 'total')
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.type = :type', { type: TxType.BANK_TRANSFER })
      .andWhere('tx.status = :status', { status: TxStatus.COMPLETED })
      .andWhere('tx.created_at >= :startOfDay', { startOfDay })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
  }

  /** Lifetime outbound volume (USDC) and transaction count — used for tier milestone checks. */
  async getLifetimeOutboundStats(userId: string): Promise<{ totalUsdc: number; txCount: number }> {
    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(CAST(tx.amount_usdc AS DECIMAL)), 0)', 'totalUsdc')
      .addSelect('COUNT(*)', 'txCount')
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.type IN (:...types)', {
        types: [TxType.SEND_USERNAME, TxType.SEND_ADDRESS, TxType.BANK_TRANSFER],
      })
      .andWhere('tx.status = :status', { status: TxStatus.COMPLETED })
      .getRawOne<{ totalUsdc: string; txCount: string }>();

    return {
      totalUsdc: parseFloat(result?.totalUsdc ?? '0'),
      txCount:   parseInt(result?.txCount   ?? '0', 10),
    };
  }

  private format(tx: Transaction) {
    return {
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amountUsdc: tx.amountUsdc,
      amountNgn: tx.amountNgn,
      fee: tx.feeUsdc,
      rateApplied: tx.rateApplied,
      recipientUsername: tx.recipientUsername,
      recipientAddress: tx.recipientAddress,
      recipientName: tx.recipientName,
      bank: tx.bankName,
      accountNumber: tx.accountNumber,
      txHash: tx.txHash,
      network: tx.network,
      reference: tx.reference,
      description: tx.description,
      createdAt: tx.createdAt,
    };
  }
}
