import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTriviaRewards1760000000007 implements MigrationInterface {
  name = 'CreateTriviaRewards1760000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trivia_rewards" (
        "id"             uuid           NOT NULL DEFAULT uuid_generate_v4(),
        "week_start"     date           NOT NULL,
        "winner_id"      uuid           NOT NULL,
        "total_score"    int            NOT NULL,
        "amount_usdc"    numeric(20,6)  NOT NULL DEFAULT 2,
        "reference"      varchar        NOT NULL,
        "tx_hash"        varchar,
        "status"         varchar        NOT NULL DEFAULT 'pending',
        "attempts"       int            NOT NULL DEFAULT 0,
        "locked_at"      timestamptz,
        "failure_reason" varchar,
        "rewarded_at"    timestamptz,
        "created_at"     timestamptz    NOT NULL DEFAULT now(),
        "updated_at"     timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trivia_rewards" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trivia_rewards_week_start" UNIQUE ("week_start"),
        CONSTRAINT "UQ_trivia_rewards_reference" UNIQUE ("reference"),
        CONSTRAINT "FK_trivia_rewards_winner" FOREIGN KEY ("winner_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "trivia_rewards"`);
  }
}
