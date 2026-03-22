import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionDto, ReceiptDto, LogDto, TokenTransferDto } from '../../common/dto';

export class TransactionDetailDto {
  @ApiProperty({ type: TransactionDto })
  transaction!: TransactionDto;

  @ApiPropertyOptional({ type: ReceiptDto, nullable: true })
  receipt!: ReceiptDto | null;

  @ApiProperty({ type: [LogDto] })
  logs!: LogDto[];

  @ApiProperty({ type: [TokenTransferDto] })
  tokenTransfers!: TokenTransferDto[];
}
