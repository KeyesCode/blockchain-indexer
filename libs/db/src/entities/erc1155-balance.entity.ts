import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Current balances for ERC-1155 tokens.
 * PK: (token_address, token_id, owner_address) — multiple owners per token.
 * Burn strategy: row is deleted when balance reaches 0.
 */
@Entity({ name: 'erc1155_balances' })
@Index(['ownerAddress'])
@Index(['tokenAddress', 'ownerAddress'])
export class Erc1155BalanceEntity {
  @PrimaryColumn({ name: 'token_address', type: 'varchar', length: 42 })
  tokenAddress!: string;

  @PrimaryColumn({ name: 'token_id', type: 'numeric', precision: 78, scale: 0 })
  tokenId!: string;

  @PrimaryColumn({ name: 'owner_address', type: 'varchar', length: 42 })
  ownerAddress!: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '1' })
  balance!: string;

  @Column({ name: 'last_transfer_block', type: 'bigint' })
  lastTransferBlock!: string;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
