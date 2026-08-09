import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBridgeKycToUsers1760000000009
  implements MigrationInterface
{
  name = 'AddBridgeKycToUsers1760000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bridge_customer_id" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bridge_kyc_link_id" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "bridge_kyc_link_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "bridge_customer_id"`,
    );
  }
}
