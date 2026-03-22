import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Current ownership for ERC-721 tokens.
 * PK: (token_address, token_id) — enforces exactly one owner per token.
 * Burn strategy: row is deleted when to_address is zero.
 */
@Entity({ name: 'erc721_ownership' })
@Index(['ownerAddress'])
@Index(['tokenAddress', 'ownerAddress'])
export class Erc721OwnershipEntity {
  @PrimaryColumn({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress!: string;

  @PrimaryColumn({ name: 'token_id', type: 'numeric', precision: 78, scale: 0 })
  tokenId!: string;

  @Column({ name: 'owner_address', type: 'varchar', length: 42 })
  ownerAddress!: string;

  @Column({ name: 'last_transfer_block', type: 'bigint' })
  lastTransferBlock!: string;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
