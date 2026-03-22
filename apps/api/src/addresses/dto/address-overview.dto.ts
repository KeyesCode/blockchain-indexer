import { ApiProperty } from '@nestjs/swagger';
import { TransactionDto, TokenTransferDto } from '../../common/dto';

export class AddressOverviewDto {
  @ApiProperty({ example: '0x186842c91a99358b7c8ac24e7ce2f9b50380ff5a' })
  address!: string;

  @ApiProperty({ example: 42 })
  transactionCount!: number;

  @ApiProperty({ type: [TransactionDto] })
  recentTransactions!: TransactionDto[];

  @ApiProperty({ type: [TokenTransferDto] })
  recentTokenTransfers!: TokenTransferDto[];
}
