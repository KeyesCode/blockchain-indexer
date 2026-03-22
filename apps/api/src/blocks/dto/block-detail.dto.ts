import { ApiProperty } from '@nestjs/swagger';
import { BlockDto, TransactionDto } from '../../common/dto';

export class BlockDetailDto extends BlockDto {
  @ApiProperty({ type: [TransactionDto] })
  transactions!: TransactionDto[];
}
