// src/transactions/transactions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';

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
