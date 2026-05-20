import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeUserIdentityCase1716200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicateEmails = (await queryRunner.query(`
      SELECT LOWER(TRIM("email")) AS value
      FROM "users"
      GROUP BY LOWER(TRIM("email"))
      HAVING COUNT(*) > 1
    `)) as Array<{ value: string }>;

    if (duplicateEmails.length > 0) {
      throw new Error(
        'Cannot normalize users.email because case-variant duplicates exist. Resolve them before rerunning this migration.',
      );
    }

    const duplicateUsernames = (await queryRunner.query(`
      SELECT LOWER(TRIM("username")) AS value
      FROM "users"
      GROUP BY LOWER(TRIM("username"))
      HAVING COUNT(*) > 1
    `)) as Array<{ value: string }>;

    if (duplicateUsernames.length > 0) {
      throw new Error(
        'Cannot normalize users.username because case-variant duplicates exist. Resolve them before rerunning this migration.',
      );
    }

    await queryRunner.query(`
      UPDATE "users"
      SET
        "email" = LOWER(TRIM("email")),
        "username" = LOWER(TRIM("username"))
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email_normalized"
      ON "users" (LOWER("email"))
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_username_normalized"
      ON "users" (LOWER("username"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_users_username_normalized"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_email_normalized"`);
  }
}
