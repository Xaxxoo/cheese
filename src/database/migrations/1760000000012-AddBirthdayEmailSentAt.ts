import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBirthdayEmailSentAt1760000000012 implements MigrationInterface {
  name = 'AddBirthdayEmailSentAt1760000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthday_email_sent_at" date NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "birthday_email_sent_at"`,
    );
  }
}
