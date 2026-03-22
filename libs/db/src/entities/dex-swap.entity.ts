import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'dex_swaps' })
@Index(['transactionHash', 'logIndex'], { unique: true })
@Index(['pairAddress', 'blockNumber'])
@Index(['transactionHash'])
@Index(['token0Address', 'blockNumber'])
@Index(['token1Address', 'blockNumber'])
export class DexSwapEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'protocol_name', type: 'varchar', length: 50 })
  protocolName!: string;

  @Column({ name: 'pair_address', type: 'varchar', length: 42 })
  pairAddress!: string;

  @Column({ name: 'transaction_hash', type: 'varchar', length: 66 })
  transactionHash!: string;

  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber!: string;

  @Column({ name: 'log_index', type: 'integer' })
  logIndex!: number;

  @Column({ name: 'sender_address', type: 'varchar', length: 42, nullable: true })
  senderAddress!: string | null;

  @Column({ name: 'to_address', type: 'varchar', length: 42, nullable: true })
  toAddress!: string | null;

  @Column({ name: 'token0_address', type: 'varchar', length: 42 })
  token0Address!: string;

  @Column({ name: 'token1_address', type: 'varchar', length: 42 })
  token1Address!: string;

  @Column({ name: 'amount0_in', type: 'numeric', precision: 78, scale: 0 })
  amount0In!: string;

  @Column({ name: 'amount1_in', type: 'numeric', precision: 78, scale: 0 })
  amount1In!: string;

  @Column({ name: 'amount0_out', type: 'numeric', precision: 78, scale: 0 })
  amount0Out!: string;

  @Column({ name: 'amount1_out', type: 'numeric', precision: 78, scale: 0 })
  amount1Out!: string;
}
