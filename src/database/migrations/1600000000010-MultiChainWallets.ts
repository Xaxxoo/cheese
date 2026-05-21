import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiChainWallets1600000000010 implements MigrationInterface {
  name = 'MultiChainWallets1600000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old single-column unique index on "userId"
    // (the initial migration created it as UQ_blockchain_wallets_user_id on the "userId" column)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blockchain_wallets" DROP CONSTRAINT IF EXISTS "blockchain_wallets_userId_key"`,
    );

    // Drop old single-column unique index on "registeredUsername"
    // (multi-chain: same username exists once per chain, not globally unique)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_username"`,
    );

    // Add composite unique ("userId", "chainId") — one wallet per user per chain
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blockchain_wallets_user_chain"
        ON "blockchain_wallets" ("userId", "chainId")
    `);

    // Add composite unique ("registeredUsername", "chainId") — username unique per chain
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blockchain_wallets_username_chain"
        ON "blockchain_wallets" ("registeredUsername", "chainId")
    `);

    // Create cursor table for EVM deposit polling
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "evm_chain_cursors" (
        "chainId"              INTEGER     NOT NULL,
        "lastProcessedBlock"   INTEGER     NOT NULL DEFAULT 0,
        "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_evm_chain_cursors" PRIMARY KEY ("chainId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "evm_chain_cursors"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_username_chain"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_user_chain"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_blockchain_wallets_username"
        ON "blockchain_wallets" ("registeredUsername")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_blockchain_wallets_user_id"
        ON "blockchain_wallets" ("userId")
    `);
  }
}
