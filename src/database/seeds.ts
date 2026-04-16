import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const SeedDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'cheese_pay',
  entities: [],
  synchronize: false,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

async function runSeeds() {
  if (!SeedDataSource.isInitialized) {
    await SeedDataSource.initialize();
  }

  try {
    console.log(
      `Connecting to database: ${process.env.DB_NAME || 'cheese_pay'}`,
    );

    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    // Check if kargi user exists in users table
    const kargiUsers = await SeedDataSource.query(
      `SELECT id, username, email, points FROM users WHERE email = $1`,
      ['imkargi@gmail.com'],
    );

    if (kargiUsers.length > 0) {
      // Update existing user points
      const targetEmail = kargiUsers[0].email;
      const result = await SeedDataSource.query(
        `UPDATE users SET points = $1 WHERE email = $2 RETURNING id, username, email, points`,
        [500, targetEmail],
      );

      if (result.length > 0) {
        const user = result[0];
        console.log(
          `✅ Updated user: ${user.username} (${user.email}) with points: ${user.points}`,
        );
      }
    } else {
      // Create new user if missing
      const userId = uuidv4();
      const createdAt = new Date();

      const result = await SeedDataSource.query(
        `INSERT INTO users (id, username, email, referral_code, points, kyc_status, tier, is_active, email_verified, phone_verified, is_flagged, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, username, email, referral_code, points`,
        [
          userId,
          'kargi',
          'imkargi@gmail.com',
          'fgL-aYIL',
          500,
          'pending',
          'silver',
          true,
          false,
          false,
          false,
          createdAt,
          createdAt,
        ],
      );

      if (result.length > 0) {
        const user = result[0];
        console.log(
          `✅ Created new user: ${user.username} (${user.email}) with 500 points and referral code: ${user.referral_code}`,
        );
      }
    }

    // Ensure kargi is on waitlist_entries for reserved count
    const waitlistEntries = await SeedDataSource.query(
      `SELECT id, username, email FROM waitlist_entries WHERE email = $1 OR username = $2`,
      ['imkargi@gmail.com', 'kargi'],
    );

    if (waitlistEntries.length > 0) {
      console.log('✅ Waitlist entry already exists for kargi');
    } else {
      const totalEntries = await SeedDataSource.query(
        `SELECT COUNT(*) FROM waitlist_entries`,
      );
      const position = parseInt(totalEntries[0].count, 10) + 1;
      const entryId = uuidv4();
      const createdAt = new Date();

      await SeedDataSource.query(
        `INSERT INTO waitlist_entries
         (id, email, username, status, position, referral_source, referrer_id, referral_code, ip_address, notified_at, converted_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          entryId,
          'imkargi@gmail.com',
          'kargi',
          'pending',
          position,
          null,
          null,
          'fgL-aYIL',
          null,
          null,
          null,
          createdAt,
        ],
      );
      console.log(
        '✅ Inserted kargi into waitlist_entries for reserved username count',
      );
    }
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  } catch (error) {
    console.error('❌ Database error:', error);
    throw error;
  } finally {
    await SeedDataSource.destroy();
  }
}

runSeeds().catch((error) => {
  console.error('❌ Seed error:', error);
  process.exit(1);
});
