import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBridgeColumns1760000000008
  implements MigrationInterface
{
  name = 'AddBridgeColumns1760000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "provider" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "country_code" varchar(2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "fiat_currency" varchar(3) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "amount_fiat" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "bridge_transfer_id" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "bridge_transfer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "amount_fiat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "fiat_currency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "country_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "provider"`,
    );
  }
}
