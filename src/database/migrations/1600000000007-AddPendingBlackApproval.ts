// src/database/migrations/1600000000007-AddPendingBlackApproval.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingBlackApproval1600000000007 implements MigrationInterface {
  name = 'AddPendingBlackApproval1600000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "pending_black_approval" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "pending_black_approval"
    `);
  }
}
