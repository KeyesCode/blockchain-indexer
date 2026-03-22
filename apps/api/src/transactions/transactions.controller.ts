import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { TxHashParamDto } from '../common/params';
import { TransactionDetailDto } from './dto/transaction-detail.dto';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(':hash')
  @ApiOperation({ summary: 'Get transaction with receipt, logs, and token transfers' })
  @ApiOkResponse({ type: TransactionDetailDto })
  async getTransaction(@Param() params: TxHashParamDto) {
    return this.transactionsService.getTransaction(params.hash);
  }
}
