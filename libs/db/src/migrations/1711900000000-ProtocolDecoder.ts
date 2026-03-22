import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProtocolDecoder1711900000000 implements MigrationInterface {
  name = 'ProtocolDecoder1711900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "protocol_contracts" (
        "address" varchar(42) NOT NULL,
        "protocol_name" varchar(50) NOT NULL,
        "contract_type" varchar(50) NOT NULL,
        "metadata_json" jsonb,
        "discovered_at_block" bigint,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_protocol_contracts" PRIMARY KEY ("address")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_protocol_contracts_proto_type" ON "protocol_contracts" ("protocol_name", "contract_type")`,
    );

    await queryRunner.query(`
      CREATE TABLE "dex_pairs" (
        "pair_address" varchar(42) NOT NULL,
        "protocol_name" varchar(50) NOT NULL,
        "factory_address" varchar(42),
        "token0_address" varchar(42) NOT NULL,
        "token1_address" varchar(42) NOT NULL,
        "discovered_at_block" bigint,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_dex_pairs" PRIMARY KEY ("pair_address")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_dex_pairs_protocol" ON "dex_pairs" ("protocol_name")`);
    await queryRunner.query(`CREATE INDEX "IDX_dex_pairs_token0" ON "dex_pairs" ("token0_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_dex_pairs_token1" ON "dex_pairs" ("token1_address")`);

    await queryRunner.query(`
      CREATE TABLE "dex_swaps" (
        "id" SERIAL NOT NULL,
        "protocol_name" varchar(50) NOT NULL,
        "pair_address" varchar(42) NOT NULL,
        "transaction_hash" varchar(66) NOT NULL,
        "block_number" bigint NOT NULL,
        "log_index" integer NOT NULL,
        "sender_address" varchar(42),
        "to_address" varchar(42),
        "token0_address" varchar(42) NOT NULL,
        "token1_address" varchar(42) NOT NULL,
        "amount0_in" numeric(78,0) NOT NULL,
        "amount1_in" numeric(78,0) NOT NULL,
        "amount0_out" numeric(78,0) NOT NULL,
        "amount1_out" numeric(78,0) NOT NULL,
        CONSTRAINT "PK_dex_swaps" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_dex_swaps_tx_log" ON "dex_swaps" ("transaction_hash", "log_index")`);
    await queryRunner.query(`CREATE INDEX "IDX_dex_swaps_pair_block" ON "dex_swaps" ("pair_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_dex_swaps_tx" ON "dex_swaps" ("transaction_hash")`);
    await queryRunner.query(`CREATE INDEX "IDX_dex_swaps_token0_block" ON "dex_swaps" ("token0_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_dex_swaps_token1_block" ON "dex_swaps" ("token1_address", "block_number" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_dex_swaps_block" ON "dex_swaps" ("block_number")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dex_swaps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dex_pairs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "protocol_contracts"`);
  }
}
