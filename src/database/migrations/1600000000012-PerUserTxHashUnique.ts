import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Change tx_hash from a globally-unique column to a per-user unique index.
 *
 * Previously a global UNIQUE constraint on tx_hash prevented the wallet
 * scheduler from creating a DEPOSIT record for the recipient of an internal
 * P2P send — the sender's SEND_USERNAME row already held the same txHash,
 * causing the scheduler's INSERT … ON CONFLICT DO NOTHING to silently skip
 * the recipient's record.
 *
 * The new partial composite index enforces uniqueness only within a single
 * user's rows, so the same on-chain hash can appear once for the sender
 * (SEND_USERNAME) and once for the recipient (DEPOSIT) without conflict.
 */
export class PerUserTxHashUnique1600000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the original global unique constraint created in CreateInitialSchema
    // (PostgreSQL names inline UNIQUE columns as "tablename_colname_key")
    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP CONSTRAINT IF EXISTS "transactions_tx_hash_key";
    `);

    // Also drop any TypeORM-generated variant just in case
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_transactions_tx_hash";
    `);

    // Partial composite unique: same tx_hash allowed for different users,
    // but each (user_id, tx_hash) pair must be unique. NULLs are excluded
    // so multiple rows may have tx_hash = NULL without conflict.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transactions_user_id_tx_hash"
        ON "transactions" ("user_id", "tx_hash")
        WHERE "tx_hash" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_transactions_user_id_tx_hash";
    `);

    // Restore global uniqueness (best-effort; will fail if duplicates exist)
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "transactions_tx_hash_key" UNIQUE ("tx_hash");
    `);
  }
}
