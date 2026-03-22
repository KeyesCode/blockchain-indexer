import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitNftOwnership1711700000000 implements MigrationInterface {
  name = 'SplitNftOwnership1711700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── erc721_ownership: PK (token_address, token_id) — one owner per token ──
    await queryRunner.query(`
      CREATE TABLE "erc721_ownership" (
        "token_address" varchar(42) NOT NULL,
        "token_id" numeric(78,0) NOT NULL,
        "owner_address" varchar(42) NOT NULL,
        "last_transfer_block" bigint NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_erc721_ownership" PRIMARY KEY ("token_address", "token_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_erc721_owner" ON "erc721_ownership" ("owner_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_erc721_token_owner" ON "erc721_ownership" ("token_address", "owner_address")`);

    // ── erc1155_balances: PK (token_address, token_id, owner_address) — multiple owners ──
    await queryRunner.query(`
      CREATE TABLE "erc1155_balances" (
        "token_address" varchar(42) NOT NULL,
        "token_id" numeric(78,0) NOT NULL,
        "owner_address" varchar(42) NOT NULL,
        "balance" numeric(78,0) NOT NULL DEFAULT 1,
        "last_transfer_block" bigint NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_erc1155_balances" PRIMARY KEY ("token_address", "token_id", "owner_address")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_erc1155_owner" ON "erc1155_balances" ("owner_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_erc1155_token_owner" ON "erc1155_balances" ("token_address", "owner_address")`);

    // Migrate existing data
    await queryRunner.query(`
      INSERT INTO "erc721_ownership" ("token_address", "token_id", "owner_address", "last_transfer_block", "updated_at")
      SELECT "token_address", "token_id", "owner_address", "last_transfer_block", "updated_at"
      FROM "nft_ownership_current"
      WHERE ("token_address", "token_id") IN (
        SELECT DISTINCT "token_address", "token_id" FROM "nft_transfers" WHERE "token_type" = 'ERC721'
      )
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "erc1155_balances" ("token_address", "token_id", "owner_address", "balance", "last_transfer_block", "updated_at")
      SELECT "token_address", "token_id", "owner_address", "quantity", "last_transfer_block", "updated_at"
      FROM "nft_ownership_current"
      WHERE ("token_address", "token_id") IN (
        SELECT DISTINCT "token_address", "token_id" FROM "nft_transfers" WHERE "token_type" = 'ERC1155'
      )
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`DROP TABLE "nft_ownership_current"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "nft_ownership_current" (
        "token_address" varchar(42) NOT NULL,
        "token_id" numeric(78,0) NOT NULL,
        "owner_address" varchar(42) NOT NULL,
        "quantity" numeric(78,0) NOT NULL DEFAULT 1,
        "last_transfer_block" bigint NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_nft_ownership" PRIMARY KEY ("token_address", "token_id", "owner_address")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "nft_ownership_current" SELECT token_address, token_id, owner_address, 1, last_transfer_block, updated_at FROM "erc721_ownership"
    `);
    await queryRunner.query(`
      INSERT INTO "nft_ownership_current" SELECT token_address, token_id, owner_address, balance, last_transfer_block, updated_at FROM "erc1155_balances"
    `);

    await queryRunner.query(`DROP TABLE "erc721_ownership"`);
    await queryRunner.query(`DROP TABLE "erc1155_balances"`);
  }
}
