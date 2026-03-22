import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogDto {
  @ApiProperty({ example: '22711829' })
  blockNumber!: string;

  @ApiProperty({ example: '0xdbaa547d4403b891af7e51f6eb84e067441ac6a5dcc2bf3fea25aab83b913b66' })
  transactionHash!: string;

  @ApiProperty({ example: 3 })
  transactionIndex!: number;

  @ApiProperty({ example: 0 })
  logIndex!: number;

  @ApiProperty({ example: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' })
  address!: string;

  @ApiPropertyOptional({ nullable: true })
  topic0!: string | null;

  @ApiPropertyOptional({ nullable: true })
  topic1!: string | null;

  @ApiPropertyOptional({ nullable: true })
  topic2!: string | null;

  @ApiPropertyOptional({ nullable: true })
  topic3!: string | null;

  @ApiProperty()
  data!: string;

  @ApiProperty({ example: false })
  removed!: boolean;
}
