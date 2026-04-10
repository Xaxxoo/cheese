import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddMissingColumnsAndTables
 *
 * All changes are purely additive (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 * Safe to run against a production database that already has the initial schema.
 *
 * Adds:
 *  1. share_events.is_fraud   — needed by the fraud-detection query in WaitlistService
 *  2. notifications table     — required by NotificationsModule (used by WaitlistModule + AgentsModule)
 *  3. blockchain_wallets table  — required by BlockchainModule (loaded via AuthModule)
 *  4. blockchain_transactions table — required by BlockchainModule
 */
export class AddMissingColumnsAndTables1600000000002 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {

    // ── 1. share_events: add is_fraud column ────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "share_events"
      ADD COLUMN IF NOT EXISTS "is_fraud" boolean NOT NULL DEFAULT false
    `);

    // ── 2. notifications table ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id"        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"   uuid        NOT NULL,
        "type"      varchar     NOT NULL DEFAULT 'system',
        "title"     varchar     NOT NULL,
        "body"      text        NOT NULL,
        "read"      boolean     NOT NULL DEFAULT false,
        "deep_link" varchar,
        "created_at" TIMESTAMP  NOT NULL DEFAULT now(),
        CONSTRAINT "fk_notifications_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_notifications_user_id"
      ON "notifications" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_notifications_read"
      ON "notifications" ("user_id", "read")
    `);

    // ── 3. blockchain_wallets table ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blockchain_wallets" (
        "id"                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"                uuid        NOT NULL UNIQUE,
        "wallet_address"        varchar(100),
        "registeredUsername"    varchar(30) NOT NULL,
        "chainId"               integer     NOT NULL,
        "contractAddress"       varchar(100) NOT NULL,
        "tokenSymbol"           varchar     NOT NULL DEFAULT 'USDC',
        "tokenDecimals"         smallint    NOT NULL DEFAULT 6,
        "status"                varchar     NOT NULL DEFAULT 'pending',
        "creationTxHash"        varchar(100),
        "retryCount"            smallint    NOT NULL DEFAULT 0,
        "lastRetryAt"           TIMESTAMPTZ,
        "activatedAt"           TIMESTAMPTZ,
        "suspensionReason"      text,
        "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blockchain_wallets_user_id"
      ON "blockchain_wallets" ("userId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blockchain_wallets_address"
      ON "blockchain_wallets" ("wallet_address")
      WHERE "wallet_address" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blockchain_wallets_username"
      ON "blockchain_wallets" ("registeredUsername")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_blockchain_wallets_status"
      ON "blockchain_wallets" ("status")
    `);

    // ── 4. blockchain_transactions table ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blockchain_transactions" (
        "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "walletId"     uuid,
        "appReference" varchar(100) NOT NULL,
        "txType"       varchar     NOT NULL,
        "status"       varchar     NOT NULL DEFAULT 'submitted',
        "txHash"       varchar(100),
        "blockNumber"  bigint,
        "amount"       decimal(18, 8),
        "amountRaw"    varchar(50),
        "toAddress"    varchar(100),
        "gasUsed"      varchar(50),
        "gasPrice"     varchar(50),
        "revertReason" text,
        "metadata"     jsonb       NOT NULL DEFAULT '{}',
        "submittedAt"  TIMESTAMPTZ,
        "confirmedAt"  TIMESTAMPTZ,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_blockchain_tx_wallet"
          FOREIGN KEY ("walletId") REFERENCES "blockchain_wallets"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_blockchain_tx_wallet_id"
      ON "blockchain_transactions" ("walletId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_blockchain_tx_status"
      ON "blockchain_transactions" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_blockchain_tx_type"
      ON "blockchain_transactions" ("txType")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_blockchain_tx_app_reference"
      ON "blockchain_transactions" ("appReference")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_blockchain_tx_hash"
      ON "blockchain_transactions" ("txHash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "blockchain_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "blockchain_wallets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`
      ALTER TABLE "share_events"
      DROP COLUMN IF EXISTS "is_fraud"
    `);
  }
}
