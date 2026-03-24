import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLeaderboardIndexes1774367061142 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add indexes for users table
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_user_points" ON "users" ("points")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_user_points_created" ON "users" ("points", "created_at")
        `);

        // Add indexes for waitlist_entries table
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_waitlist_points" ON "waitlist_entries" ("points")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_waitlist_points_created" ON "waitlist_entries" ("points", "created_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes for users table
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_points"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_points_created"`);

        // Drop indexes for waitlist_entries table
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_waitlist_points"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_waitlist_points_created"`);
    }

}
