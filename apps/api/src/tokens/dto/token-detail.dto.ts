import { ApiProperty } from '@nestjs/swagger';
import { TokenContractDto, TokenTransferDto } from '../../common/dto';

export class TokenDetailDto {
  @ApiProperty({ type: TokenContractDto })
  token!: TokenContractDto;

  @ApiProperty({ type: [TokenTransferDto] })
  recentTransfers!: TokenTransferDto[];
}
