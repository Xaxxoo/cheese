import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankTransferSplitDebit1760000000004
  implements MigrationInterface
{
  name = 'AddBankTransferSplitDebit1760000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "evm_wallet_address" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "evm_chain_id" int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "evm_amount" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "stellar_amount" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "evm_tx_hash" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "evm_tx_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "stellar_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "evm_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "evm_chain_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "evm_wallet_address"`,
    );
  }
}
