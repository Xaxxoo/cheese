import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiChainWallets1600000000010 implements MigrationInterface {
  name = 'MultiChainWallets1600000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old single-column unique index/constraint on user_id
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE blockchain_wallets DROP CONSTRAINT IF EXISTS "blockchain_wallets_user_id_key"`,
    );

    // Drop old single-column unique index on registered_username
    // (multi-chain: same username exists once per chain, not globally unique)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_username"`,
    );

    // Add composite unique (user_id, chain_id) — one wallet per user per chain
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blockchain_wallets_user_chain"
        ON blockchain_wallets (user_id, chain_id)
    `);

    // Add composite unique (registered_username, chain_id) — username unique per chain
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blockchain_wallets_username_chain"
        ON blockchain_wallets (registered_username, chain_id)
    `);

    // Create cursor table for EVM deposit polling
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS evm_chain_cursors (
        chain_id              INTEGER     NOT NULL,
        last_processed_block  INTEGER     NOT NULL DEFAULT 0,
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_evm_chain_cursors" PRIMARY KEY (chain_id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS evm_chain_cursors`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_username_chain"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_blockchain_wallets_user_chain"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_blockchain_wallets_username"
        ON blockchain_wallets (registered_username)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_blockchain_wallets_user_id"
        ON blockchain_wallets (user_id)
    `);
  }
}
