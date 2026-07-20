import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowSharedEvmWalletAddress1760000000001
  implements MigrationInterface
{
  name = 'AllowSharedEvmWalletAddress1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_address"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blockchain_wallets_address_chain"
        ON "blockchain_wallets" ("wallet_address", "chainId")
        WHERE "wallet_address" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_address_chain"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blockchain_wallets_address"
        ON "blockchain_wallets" ("wallet_address")
        WHERE "wallet_address" IS NOT NULL
    `);
  }
}
