import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Set the Celo (42220) deposit scanner cursor to just before the first
 * user deposits so the scheduler picks them up on its next cycle.
 */
export class SetCeloCursor1760000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Earliest Celo deposit landed at block 73351930.
    // Set cursor to 100 blocks before to ensure both deposits are scanned.
    await queryRunner.query(`
      INSERT INTO "evm_chain_cursors" ("chainId", "lastProcessedBlock")
      VALUES (42220, 73351800)
      ON CONFLICT ("chainId")
      DO UPDATE SET "lastProcessedBlock" = 73351800
      WHERE "evm_chain_cursors"."lastProcessedBlock" > 73351800
         OR "evm_chain_cursors"."lastProcessedBlock" = 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: cursor will naturally advance past this point
  }
}
