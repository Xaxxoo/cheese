// src/database/migrations/1600000000003-EnablePhases2To4.ts
//
// Additive-only migration — all statements use IF NOT EXISTS so it is
// safe to run against a production database that may already have some
// of these objects (e.g. if synchronize was briefly enabled).
//
import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePhases2To4_1600000000003 implements MigrationInterface {
  name = 'EnablePhases2To4_1600000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── stellar_deposit_cursor on users ────────────────────────────────────
    // Stores the Horizon paging_token of the last seen inbound payment.
    // Used by WalletDepositScheduler for cursor-based incremental polling.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "stellar_deposit_cursor" varchar NULL
    `);

    // ── bank_transfers table ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_transfers" (
        "id"                 uuid          NOT NULL DEFAULT gen_random_uuid(),
        "user_id"            uuid          NOT NULL,
        "account_number"     varchar       NOT NULL,
        "bank_code"          varchar       NOT NULL,
        "bank_name"          varchar       NOT NULL,
        "account_name"       varchar       NOT NULL,
        "amount_ngn"         numeric(20,2) NOT NULL,
        "amount_usdc"        numeric(20,6) NOT NULL,
        "fee_usdc"           numeric(20,6) NOT NULL DEFAULT 0,
        "rate_applied"       numeric(12,4) NOT NULL,
        "status"             varchar       NOT NULL DEFAULT 'pending',
        "reference"          varchar       NOT NULL,
        "provider_reference" varchar                NULL,
        "failure_reason"     varchar                NULL,
        "created_at"         timestamptz   NOT NULL DEFAULT now(),
        "updated_at"         timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "pk_bank_transfers"          PRIMARY KEY ("id"),
        CONSTRAINT "uq_bank_transfers_reference" UNIQUE ("reference"),
        CONSTRAINT "fk_bank_transfers_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bank_transfers_user_id"
        ON "bank_transfers" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_bank_transfers_status"
        ON "bank_transfers" ("status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_transfers"`);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "stellar_deposit_cursor"
    `);
  }
}
