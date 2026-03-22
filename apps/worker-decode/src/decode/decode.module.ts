import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { Erc20TransferDecoderService } from './services/erc20-transfer-decoder.service';
import { NftTransferDecoderService } from './services/nft-transfer-decoder.service';
import { ContractStandardDetectorService } from './services/contract-standard-detector.service';
import { TokenMetadataService } from './services/token-metadata.service';
import { NftMetadataService } from './services/nft-metadata.service';
import { DecodeProcessor } from './processors/decode-processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LogEntity,
      TokenTransferEntity,
      TokenContractEntity,
      NftTransferEntity,
      Erc721OwnershipEntity,
      Erc1155BalanceEntity,
      NftTokenMetadataEntity,
    ]),
  ],
  providers: [
    Erc20TransferDecoderService,
    NftTransferDecoderService,
    ContractStandardDetectorService,
    TokenMetadataService,
    NftMetadataService,
    DecodeProcessor,
  ],
  exports: [Erc20TransferDecoderService, NftTransferDecoderService, TokenMetadataService, NftMetadataService],
})
export class DecodeModule {}
