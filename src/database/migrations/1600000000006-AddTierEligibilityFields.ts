// src/database/migrations/1600000000006-AddTierEligibilityFields.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTierEligibilityFields1600000000006 implements MigrationInterface {
  name = 'AddTierEligibilityFields1600000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "gold_eligible_at"  TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS "black_eligible_at" TIMESTAMP NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "gold_eligible_at",
        DROP COLUMN IF EXISTS "black_eligible_at"
    `);
  }
}
