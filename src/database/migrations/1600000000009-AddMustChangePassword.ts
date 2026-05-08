import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMustChangePassword1600000000009 implements MigrationInterface {
  name = 'AddMustChangePassword1600000000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "must_change_password"
    `);
  }
}
