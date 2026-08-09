import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCountryToUsers1760000000010 implements MigrationInterface {
  name = 'AddCountryToUsers1760000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" varchar(2) NULL`,
    );

    // Backfill from E.164 phone prefixes for existing users.
    const prefixes: [string, string][] = [
      ['+234', 'NG'],
      ['+254', 'KE'],
      ['+233', 'GH'],
      ['+250', 'RW'],
      ['+251', 'ET'],
      ['+27', 'ZA'],
      ['+255', 'TZ'],
      ['+256', 'UG'],
      ['+237', 'CM'],
      ['+225', 'CI'],
      ['+221', 'SN'],
      ['+20', 'EG'],
      ['+212', 'MA'],
      ['+216', 'TN'],
      ['+213', 'DZ'],
      ['+1', 'US'],
      ['+44', 'GB'],
    ];

    for (const [prefix, code] of prefixes) {
      await queryRunner.query(
        `UPDATE "users" SET "country" = $1 WHERE "phone" LIKE $2 AND "country" IS NULL`,
        [code, `${prefix}%`],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "country"`,
    );
  }
}
