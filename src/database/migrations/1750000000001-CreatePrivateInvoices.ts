// src/database/migrations/1750000000001-CreatePrivateInvoices.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrivateInvoices1750000000001 implements MigrationInterface {
  name = 'CreatePrivateInvoices1750000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "private_invoices" (
        "id"                       UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "reference"                VARCHAR(20)   NOT NULL,
        "merchantId"               VARCHAR       NOT NULL,
        "merchantName"             VARCHAR       NOT NULL,
        "amountUsdc"               DECIMAL(20,6) NOT NULL,
        "amountNgn"                DECIMAL(20,2)           DEFAULT NULL,
        "rateApplied"              DECIMAL(12,4)           DEFAULT NULL,
        "status"                   VARCHAR       NOT NULL  DEFAULT 'pending',
        "settlementBankCode"       VARCHAR       NOT NULL,
        "settlementAccountNumber"  VARCHAR       NOT NULL,
        "settlementAccountName"    VARCHAR       NOT NULL,
        "settlementBankName"       VARCHAR       NOT NULL,
        "callbackUrl"              VARCHAR                 DEFAULT NULL,
        "stellarTxHash"            VARCHAR                 DEFAULT NULL,
        "settlementReference"      VARCHAR                 DEFAULT NULL,
        "failureReason"            VARCHAR                 DEFAULT NULL,
        "expiresAt"                TIMESTAMPTZ   NOT NULL,
        "paidAt"                   TIMESTAMPTZ             DEFAULT NULL,
        "settledAt"                TIMESTAMPTZ             DEFAULT NULL,
        "createdAt"                TIMESTAMPTZ   NOT NULL  DEFAULT now(),
        "updatedAt"                TIMESTAMPTZ   NOT NULL  DEFAULT now(),
        CONSTRAINT "PK_private_invoices" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_private_invoices_reference"
        ON "private_invoices" ("reference")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_private_invoices_status_expires"
        ON "private_invoices" ("status", "expiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_private_invoices_status_expires"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_private_invoices_reference"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "private_invoices"`);
  }
}
