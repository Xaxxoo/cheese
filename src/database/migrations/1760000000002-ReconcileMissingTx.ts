import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Insert the missing outbound transaction for user with Stellar key
 * GD6VWX56ATO53PGKHCJMHQKTIVMCKMEBK56ACTHNBXNX2HPKWG3W3RLL.
 *
 * On-chain payment of 17.0130130 USDC to treasury (GBOG…) on 2026-07-18
 * was never recorded in the transactions table, causing Total Received
 * vs Total Sent to show an incorrect surplus.
 */
export class ReconcileMissingTx1760000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "transactions" (
        "id",
        "user_id",
        "type",
        "status",
        "amount_usdc",
        "amount_ngn",
        "fee_usdc",
        "rate_applied",
        "recipient_username",
        "recipient_address",
        "recipient_name",
        "bank_name",
        "account_number",
        "tx_hash",
        "network",
        "reference",
        "description",
        "failure_reason",
        "created_at",
        "updated_at"
      )
      SELECT
        gen_random_uuid(),
        u.id,
        'withdrawal',
        'completed',
        17.013013,
        NULL,
        0.000000,
        NULL,
        NULL,
        'GBOGVS7QHKU2HJUWIEKFOXJD5ZHXHI5OZJWX2Y4YKOK7PZ6NLBL3RO2G',
        NULL,
        NULL,
        NULL,
        'cf3cba1627e34b0204c5c5b274d0b40c06f4f3fc825bc6150d115cc1431db7ce',
        'stellar',
        'CW-RECONCILE-CF3CBA1627E34B02',
        'Reconciled from on-chain data — outbound to treasury',
        NULL,
        '2026-07-18T13:36:57Z',
        NOW()
      FROM "users" u
      WHERE u.stellar_public_key = 'GD6VWX56ATO53PGKHCJMHQKTIVMCKMEBK56ACTHNBXNX2HPKWG3W3RLL'
        AND NOT EXISTS (
          SELECT 1 FROM "transactions" t
          WHERE t.user_id = u.id
            AND t.tx_hash = 'cf3cba1627e34b0204c5c5b274d0b40c06f4f3fc825bc6150d115cc1431db7ce'
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "transactions"
      WHERE "reference" = 'CW-RECONCILE-CF3CBA1627E34B02';
    `);
  }
}
