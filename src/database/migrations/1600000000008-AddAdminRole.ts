import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminRole1600000000008 implements MigrationInterface {
  name = 'AddAdminRole1600000000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "is_admin"    BOOLEAN      NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "admin_role"  VARCHAR(32)  NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "is_admin",
        DROP COLUMN IF EXISTS "admin_role"
    `);
  }
}
