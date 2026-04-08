import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletStatusToUsers1600000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "stellar_wallet_status" VARCHAR NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "evm_wallet_status" VARCHAR NOT NULL DEFAULT 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "stellar_wallet_status",
      DROP COLUMN IF EXISTS "evm_wallet_status"
    `);
  }
}