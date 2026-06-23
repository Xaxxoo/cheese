// src/database/migrations/1750000000002-CreateVeilTables.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVeilTables1750000000002 implements MigrationInterface {
  name = 'CreateVeilTables1750000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── veil_shielded_notes ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "veil_shielded_notes" (
        "id"              uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "userId"          uuid                       DEFAULT NULL,
        "commitment"      varchar(66)       NOT NULL,
        "amountMicro"     bigint            NOT NULL,
        "amountUsdc"      decimal(20,6)     NOT NULL,
        "encryptedNote"   text              NOT NULL,
        "status"          varchar           NOT NULL DEFAULT 'pending',
        "depositTxHash"   varchar                    DEFAULT NULL,
        "poolContractId"  varchar                    DEFAULT NULL,
        "spentOnInvoice"  varchar                    DEFAULT NULL,
        "createdAt"       timestamptz       NOT NULL DEFAULT now(),
        "updatedAt"       timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_veil_shielded_notes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_veil_notes_commitment"
        ON "veil_shielded_notes" ("commitment")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_veil_notes_status"
        ON "veil_shielded_notes" ("status")
    `);

    // ── veil_spent_nullifiers ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "veil_spent_nullifiers" (
        "id"              uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "nullifierHash"   varchar(66)       NOT NULL,
        "invoiceRef"      varchar           NOT NULL,
        "sorobanTxHash"   varchar                    DEFAULT NULL,
        "usedAt"          timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_veil_spent_nullifiers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_veil_nullifiers_hash"
        ON "veil_spent_nullifiers" ("nullifierHash")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "veil_spent_nullifiers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "veil_shielded_notes"`);
  }
}
