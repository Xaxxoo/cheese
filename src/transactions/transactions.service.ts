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
      items: items.map((tx) => this.format(tx)),
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

  async updateByReference(
    reference: string,
    data: Partial<Transaction>,
  ): Promise<void> {
    await this.txRepo.update({ reference }, data);
  }

  async existsByTxHash(txHash: string): Promise<boolean> {
    return this.txRepo.existsBy({ txHash });
  }

  /**
   * Attempt an atomic INSERT ... ON CONFLICT (tx_hash) DO NOTHING.
   * Returns true if the row was inserted, false if it already existed.
   * Requires txHash to be non-null — callers must guard before calling.
   */
  async createDeposit(data: Partial<Transaction>): Promise<boolean> {
    const result = await this.txRepo
      .createQueryBuilder()
      .insert()
      .into(Transaction)
      .values(data)
      .orIgnore()
      .execute();
    return result.identifiers.length > 0;
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

  /**
   * Net USDC balance computed from the transaction ledger.
   *
   * Inbound  (+): DEPOSIT, YIELD_CREDIT, REFERRAL_BONUS
   * Outbound (-): SEND_USERNAME, SEND_ADDRESS, WITHDRAWAL,
   *               BANK_TRANSFER, CARD_PAYMENT, PAY_REQUEST, FEE
   *
   * Only COMPLETED transactions are counted. This is the single
   * source of truth for a user's spendable balance regardless of
   * whether sends went through the Soroban contract or classic Stellar.
   */
  async computeNetUsdcBalance(userId: string): Promise<number> {
    const INBOUND = [TxType.DEPOSIT, TxType.YIELD_CREDIT, TxType.REFERRAL_BONUS, TxType.TRIVIA_REWARD];
    const OUTBOUND = [
      TxType.SEND_USERNAME,
      TxType.SEND_ADDRESS,
      TxType.WITHDRAWAL,
      TxType.BANK_TRANSFER,
      TxType.CARD_PAYMENT,
      TxType.PAY_REQUEST,
      TxType.BILL_PAYMENT,
    ];

    // Note: TypeORM only expands :...spread parameters in .where()/.andWhere(),
    // not inside raw .select() strings. Inline the inbound enum values as SQL
    // string literals — they are code constants, not user input.
    const inboundLiterals = INBOUND.map((t) => `'${t}'`).join(', ');

    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select(
        `COALESCE(SUM(
          CASE WHEN tx.type IN (${inboundLiterals})
               THEN CAST(tx.amount_usdc AS DECIMAL)
               ELSE -(CAST(tx.amount_usdc AS DECIMAL)
                 + CASE WHEN tx.type != 'bank_transfer'
                        THEN COALESCE(CAST(tx.fee_usdc AS DECIMAL), 0)
                        ELSE 0 END)
          END
        ), 0)`,
        'net',
      )
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.status = :status', { status: TxStatus.COMPLETED })
      .andWhere('tx.type IN (:...allTypes)', { allTypes: [...INBOUND, ...OUTBOUND] })
      .getRawOne<{ net: string }>();

    return Math.max(0, parseFloat(result?.net ?? '0'));
  }

  /** Inbound / outbound totals + count — exposed to the mobile dashboard. */
  async getStats(
    userId: string,
  ): Promise<{ totalInUsdc: string; totalOutUsdc: string; txCount: number }> {
    const INBOUND = [TxType.DEPOSIT, TxType.YIELD_CREDIT, TxType.REFERRAL_BONUS, TxType.TRIVIA_REWARD];
    const OUTBOUND = [
      TxType.SEND_USERNAME,
      TxType.SEND_ADDRESS,
      TxType.WITHDRAWAL,
      TxType.BANK_TRANSFER,
      TxType.CARD_PAYMENT,
      TxType.PAY_REQUEST,
      TxType.BILL_PAYMENT,
    ];

    const [inResult, outResult, txCount] = await Promise.all([
      this.txRepo
        .createQueryBuilder('tx')
        .select('COALESCE(SUM(CAST(tx.amount_usdc AS DECIMAL)), 0)', 'total')
        .where('tx.user_id = :userId', { userId })
        .andWhere('tx.type IN (:...types)', { types: INBOUND })
        .andWhere('tx.status = :status', { status: TxStatus.COMPLETED })
        .getRawOne<{ total: string }>(),
      this.txRepo
        .createQueryBuilder('tx')
        .select(
          `COALESCE(SUM(CAST(tx.amount_usdc AS DECIMAL)
            + CASE WHEN tx.type != 'bank_transfer'
                   THEN COALESCE(CAST(tx.fee_usdc AS DECIMAL), 0)
                   ELSE 0 END), 0)`,
          'total',
        )
        .where('tx.user_id = :userId', { userId })
        .andWhere('tx.type IN (:...types)', { types: OUTBOUND })
        .andWhere('tx.status = :status', { status: TxStatus.COMPLETED })
        .getRawOne<{ total: string }>(),
      this.txRepo.count({ where: { userId } }),
    ]);

    return {
      totalInUsdc:  parseFloat(inResult?.total  ?? '0').toFixed(6),
      totalOutUsdc: parseFloat(outResult?.total ?? '0').toFixed(6),
      txCount,
    };
  }

  /** Lifetime outbound volume (USDC) and transaction count — used for tier milestone checks. */
  async getLifetimeOutboundStats(
    userId: string,
  ): Promise<{ totalUsdc: number; txCount: number }> {
    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(CAST(tx.amount_usdc AS DECIMAL)), 0)', 'totalUsdc')
      .addSelect('COUNT(*)', 'txCount')
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.type IN (:...types)', {
        types: [
          TxType.SEND_USERNAME,
          TxType.SEND_ADDRESS,
          TxType.BANK_TRANSFER,
        ],
      })
      .andWhere('tx.status = :status', { status: TxStatus.COMPLETED })
      .getRawOne<{ totalUsdc: string; txCount: string }>();

    return {
      totalUsdc: parseFloat(result?.totalUsdc ?? '0'),
      txCount: parseInt(result?.txCount ?? '0', 10),
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
