import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTriviaScores1750000000004 implements MigrationInterface {
  name = 'CreateTriviaScores1750000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trivia_scores" (
        "id"               uuid           NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"          uuid           NOT NULL,
        "score"            int            NOT NULL,
        "correct_answers"  int            NOT NULL,
        "total_questions"  int            NOT NULL DEFAULT 10,
        "round_number"     int            NOT NULL,
        "week_start"       date           NOT NULL,
        "played_at"        timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trivia_scores" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trivia_scores_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_trivia_week_user"
        ON "trivia_scores" ("week_start", "user_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "trivia_scores"`);
  }
}
