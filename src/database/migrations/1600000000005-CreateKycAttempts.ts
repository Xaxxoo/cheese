// src/database/migrations/1600000000005-CreateKycAttempts.ts
//
// Additive-only migration — uses IF NOT EXISTS so it is safe to run
// against a database that may already have the table (e.g. synchronize
// was briefly enabled in a staging environment).
//
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKycAttempts1600000000005 implements MigrationInterface {
  name = 'CreateKycAttempts1600000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kyc_attempts" (
        "id"               UUID      NOT NULL DEFAULT gen_random_uuid(),
        "user_id"          UUID      NOT NULL,
        "type"             VARCHAR   NOT NULL,
        "status"           VARCHAR   NOT NULL,
        "provider"         VARCHAR   NOT NULL DEFAULT 'dojah',
        "document_suffix"  VARCHAR,
        "error_message"    TEXT,
        "raw_response"     JSONB,
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kyc_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_kyc_attempts_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_kyc_attempts_user_id"
        ON "kyc_attempts" ("user_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "kyc_attempts"`);
  }
}
