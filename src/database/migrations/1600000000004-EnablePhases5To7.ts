// src/database/migrations/1600000000004-EnablePhases5To7.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePhases5To71600000000004 implements MigrationInterface {
  name = 'EnablePhases5To71600000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── virtual_cards ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "virtual_cards" (
        "id"                UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"           UUID          NOT NULL,
        "card_number_enc"   TEXT          NOT NULL,
        "cvv_enc"           VARCHAR       NOT NULL,
        "last4"             VARCHAR       NOT NULL,
        "expiry_month"      VARCHAR       NOT NULL,
        "expiry_year"       VARCHAR       NOT NULL,
        "holder_name"       VARCHAR       NOT NULL,
        "network"           VARCHAR       NOT NULL DEFAULT 'mastercard',
        "status"            VARCHAR       NOT NULL DEFAULT 'active',
        "available_balance" DECIMAL(20,6) NOT NULL DEFAULT 0,
        "spend_limit"       DECIMAL(20,6) NOT NULL DEFAULT 500,
        "monthly_spend"     DECIMAL(20,6) NOT NULL DEFAULT 0,
        "provider_card_id"  VARCHAR,
        "created_at"        TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_virtual_cards" PRIMARY KEY ("id"),
        CONSTRAINT "FK_virtual_cards_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_virtual_cards_user_id" ON "virtual_cards" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_virtual_cards_status" ON "virtual_cards" ("status")`,
    );

    // ── referrals ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referrals" (
        "id"          UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "referrer_id" UUID          NOT NULL,
        "referee_id"  UUID          NOT NULL,
        "status"      VARCHAR       NOT NULL DEFAULT 'pending',
        "reward_usdc" DECIMAL(20,6),
        "rewarded_at" BIGINT,
        "created_at"  TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referrals"       PRIMARY KEY ("id"),
        CONSTRAINT "UQ_referrals_referee" UNIQUE ("referee_id"),
        CONSTRAINT "FK_referrals_referrer"
          FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_referrals_referee"
          FOREIGN KEY ("referee_id")  REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_referrals_referrer_id" ON "referrals" ("referrer_id")`,
    );

    // ── payment_requests ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_requests" (
        "id"              UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "creator_id"      UUID          NOT NULL,
        "payer_id"        UUID,
        "token"           VARCHAR       NOT NULL,
        "amount_usdc"     DECIMAL(20,6) NOT NULL,
        "note"            VARCHAR(140),
        "status"          VARCHAR       NOT NULL DEFAULT 'pending',
        "expires_at"      BIGINT        NOT NULL,
        "settled_tx_id"   VARCHAR,
        "settled_tx_hash" VARCHAR,
        "paid_at"         INTEGER,
        "payer_ip"        VARCHAR,
        "created_at"      TIMESTAMP     NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_requests"        PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_requests_token"  UNIQUE ("token"),
        CONSTRAINT "FK_payment_requests_creator"
          FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payment_requests_payer"
          FOREIGN KEY ("payer_id")   REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_requests_creator_id" ON "payment_requests" ("creator_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_requests_status" ON "payment_requests" ("status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "referrals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "virtual_cards"`);
  }
}
