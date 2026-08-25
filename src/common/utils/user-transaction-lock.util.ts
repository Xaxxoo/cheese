import { DataSource } from 'typeorm';

/**
 * Serialize money-moving work for one user across API instances and devices.
 * The lock is transaction-scoped and released automatically on commit/rollback.
 */
export async function withUserTransactionLock<T>(
  dataSource: DataSource,
  userId: string,
  work: () => Promise<T>,
): Promise<T> {
  if (dataSource.options.type !== 'postgres') return work();

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [userId],
    );
    const result = await work();
    await queryRunner.commitTransaction();
    return result;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
