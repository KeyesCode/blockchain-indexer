import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { NftsController } from './nfts.controller';
import { NftsService } from './nfts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NftTransferEntity,
      Erc721OwnershipEntity,
      Erc1155BalanceEntity,
      NftTokenMetadataEntity,
    ]),
  ],
  controllers: [NftsController],
  providers: [NftsService],
  exports: [NftsService],
})
export class NftsModule {}
