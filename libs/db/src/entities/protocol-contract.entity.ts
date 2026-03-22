import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'protocol_contracts' })
@Index(['protocolName', 'contractType'])
export class ProtocolContractEntity {
  @PrimaryColumn({ type: 'varchar', length: 42 })
  address!: string;

  @Column({ name: 'protocol_name', type: 'varchar', length: 50 })
  protocolName!: string;

  @Column({ name: 'contract_type', type: 'varchar', length: 50 })
  contractType!: string;

  @Column({ name: 'metadata_json', type: 'jsonb', nullable: true })
  metadataJson!: any;

  @Column({ name: 'discovered_at_block', type: 'bigint', nullable: true })
  discoveredAtBlock!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
