import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletStatusToUsers1600000000001 implements MigrationInterface {
  name = 'AddWalletStatusToUsers1600000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "wallet_status" VARCHAR NOT NULL DEFAULT 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "wallet_status"
    `);
  }
}
