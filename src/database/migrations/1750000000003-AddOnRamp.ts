// src/database/migrations/1750000000003-AddOnRamp.ts
//
// Adds virtual account fields to the users table and creates the
// bank_deposits table for tracking inbound NGN deposits (on-ramp).
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnRamp1750000000003 implements MigrationInterface {
  name = 'AddOnRamp1750000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Virtual account columns on users ─────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "virtual_account_number" VARCHAR    DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "virtual_account_name"   VARCHAR    DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "virtual_account_ref"    VARCHAR    DEFAULT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_virtual_account_number"
        ON "users" ("virtual_account_number")
        WHERE "virtual_account_number" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_virtual_account_ref"
        ON "users" ("virtual_account_ref")
        WHERE "virtual_account_ref" IS NOT NULL
    `);

    // ── bank_deposits table ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_deposits" (
        "id"                      UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"                 UUID          NOT NULL,
        "reference"               VARCHAR       NOT NULL,
        "virtual_account_number"  VARCHAR       NOT NULL,
        "amount_ngn"              DECIMAL(20,2) NOT NULL,
        "amount_usdc"             DECIMAL(20,6) NOT NULL,
        "rate_applied"            DECIMAL(12,4) NOT NULL,
        "sender_name"             VARCHAR                DEFAULT NULL,
        "sender_account_number"   VARCHAR                DEFAULT NULL,
        "status"                  VARCHAR       NOT NULL DEFAULT 'pending',
        "tx_hash"                 VARCHAR                DEFAULT NULL,
        "failure_reason"          VARCHAR                DEFAULT NULL,
        "created_at"              TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"              TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bank_deposits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bank_deposits_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bank_deposits_reference"
        ON "bank_deposits" ("reference")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bank_deposits_user_id"
        ON "bank_deposits" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bank_deposits_virtual_account"
        ON "bank_deposits" ("virtual_account_number")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bank_deposits_virtual_account"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bank_deposits_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_bank_deposits_reference"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_deposits"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_virtual_account_ref"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_virtual_account_number"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "virtual_account_number",
        DROP COLUMN IF EXISTS "virtual_account_name",
        DROP COLUMN IF EXISTS "virtual_account_ref"
    `);
  }
}
