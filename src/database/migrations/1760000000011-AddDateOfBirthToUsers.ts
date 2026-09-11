import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDateOfBirthToUsers1760000000011 implements MigrationInterface {
  name = 'AddDateOfBirthToUsers1760000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" date NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "date_of_birth"`,
    );
  }
}
