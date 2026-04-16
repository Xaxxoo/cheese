import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BlockchainTransaction,
  BlockchainTxStatus,
} from '../entities/blockchain-transaction.entity';
import { BlockchainTransactionNotFoundException } from '../exceptions/blockchain.exceptions';
import {
  BlockchainTransactionResponseDto,
  BlockchainTxFilterDto,
  PaginatedResponseDto,
} from '../dto/blockchain.dto';

@Injectable()
export class BlockchainTransactionService {
  constructor(
    @InjectRepository(BlockchainTransaction)
    private readonly txRepo: Repository<BlockchainTransaction>,
  ) {}

  /**
   * Return a single blockchain transaction by its internal UUID.
   */
  async getById(id: string): Promise<BlockchainTransactionResponseDto> {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) throw new BlockchainTransactionNotFoundException(id);
    return BlockchainTransactionResponseDto.from(tx);
  }

  /**
   * Return a single blockchain transaction by its on-chain tx hash.
   */
  async getByTxHash(txHash: string): Promise<BlockchainTransactionResponseDto> {
    const tx = await this.txRepo.findOne({ where: { txHash } });
    if (!tx) throw new BlockchainTransactionNotFoundException(txHash);
    return BlockchainTransactionResponseDto.from(tx);
  }

  /**
   * Return all blockchain transactions for a given app-level reference.
   * e.g. pass a CHZ-… reference to find both the original debit tx and
   * any associated reversal credit tx.
   */
  async getByAppReference(
    appReference: string,
  ): Promise<BlockchainTransactionResponseDto[]> {
    const txs = await this.txRepo.find({
      where: { appReference },
      order: { createdAt: 'ASC' },
    });
    return txs.map((tx) => BlockchainTransactionResponseDto.from(tx));
  }

  /**
   * Paginated query across all blockchain transactions with optional filters.
   * Used by the admin dashboard.
   */
  async query(
    filters: BlockchainTxFilterDto,
  ): Promise<PaginatedResponseDto<BlockchainTransactionResponseDto>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .orderBy('tx.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) {
      qb.andWhere('tx.status = :status', { status: filters.status });
    }
    if (filters.txType) {
      qb.andWhere('tx.txType = :txType', { txType: filters.txType });
    }
    if (filters.appReference) {
      qb.andWhere('tx.appReference = :ref', { ref: filters.appReference });
    }

    const [txs, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(
      txs.map((tx) => BlockchainTransactionResponseDto.from(tx)),
      total,
      page,
      limit,
    );
  }

  /**
   * Count of all FAILED transactions — used by the scheduler to decide
   * whether to raise an alert.
   */
  async countFailed(): Promise<number> {
    return this.txRepo.count({ where: { status: BlockchainTxStatus.FAILED } });
  }

  /**
   * Find all SUBMITTED transactions that are older than a given age in minutes.
   * Used by the scheduler to detect stuck submissions (submitted but never mined).
   */
  async findStuckSubmissions(
    olderThanMinutes: number,
  ): Promise<BlockchainTransaction[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    return this.txRepo
      .createQueryBuilder('tx')
      .where('tx.status = :status', { status: BlockchainTxStatus.SUBMITTED })
      .andWhere('tx.submittedAt < :cutoff', { cutoff })
      .getMany();
  }
}
