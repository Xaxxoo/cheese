import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpoPushTokens1600000000013 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expo_push_tokens" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL,
        "token"      text        NOT NULL UNIQUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fk_expo_push_tokens_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_expo_push_tokens_user_id"
        ON "expo_push_tokens" ("user_id");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "expo_push_tokens";`);
  }
}
