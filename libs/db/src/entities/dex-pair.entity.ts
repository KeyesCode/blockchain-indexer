import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'dex_pairs' })
@Index(['protocolName'])
@Index(['token0Address'])
@Index(['token1Address'])
export class DexPairEntity {
  @PrimaryColumn({ name: 'pair_address', type: 'varchar', length: 42 })
  pairAddress!: string;

  @Column({ name: 'protocol_name', type: 'varchar', length: 50 })
  protocolName!: string;

  @Column({ name: 'factory_address', type: 'varchar', length: 42, nullable: true })
  factoryAddress!: string | null;

  @Column({ name: 'token0_address', type: 'varchar', length: 42 })
  token0Address!: string;

  @Column({ name: 'token1_address', type: 'varchar', length: 42 })
  token1Address!: string;

  @Column({ name: 'discovered_at_block', type: 'bigint', nullable: true })
  discoveredAtBlock!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
