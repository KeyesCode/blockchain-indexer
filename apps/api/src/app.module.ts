import { Module } from '@nestjs/common';
import { DbModule } from '@app/db';
import { HealthModule } from './health/health.module';
import { BlocksModule } from './blocks/blocks.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AddressesModule } from './addresses/addresses.module';
import { TokensModule } from './tokens/tokens.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';
import { NftsModule } from './nfts/nfts.module';
import { ProtocolsModule } from './protocols/protocols.module';

@Module({
  imports: [
    DbModule,
    HealthModule,
    BlocksModule,
    TransactionsModule,
    AddressesModule,
    TokensModule,
    SearchModule,
    AdminModule,
    NftsModule,
    ProtocolsModule,
  ],
})
export class AppModule {}
