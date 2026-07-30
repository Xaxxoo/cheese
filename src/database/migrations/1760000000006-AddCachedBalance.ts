import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCachedBalance1760000000006 implements MigrationInterface {
  name = 'AddCachedBalance1760000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cached_balance_usdc" decimal(20,6) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cached_balance_at" timestamp NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "cached_balance_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "cached_balance_usdc"`,
    );
  }
}
