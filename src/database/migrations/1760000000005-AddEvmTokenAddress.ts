import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvmTokenAddress1760000000005 implements MigrationInterface {
  name = 'AddEvmTokenAddress1760000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "evm_token_address" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "evm_token_address"`,
    );
  }
}
