import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { AddressNftHoldingEntity } from '@app/db/entities/address-nft-holding.entity';
import { NftContractStatsEntity } from '@app/db/entities/nft-contract-stats.entity';
import { ContractStandardEntity } from '@app/db/entities/contract-standard.entity';
import { DexSwapEntity } from '@app/db/entities/dex-swap.entity';
import { DexPairEntity } from '@app/db/entities/dex-pair.entity';
import { ProtocolContractEntity } from '@app/db/entities/protocol-contract.entity';
import { TokenApprovalEntity } from '@app/db/entities/token-approval.entity';
import { TokenAllowanceEntity } from '@app/db/entities/token-allowance.entity';
import { NftReadModelService } from '@app/db/services/nft-read-model.service';
import { Erc20TransferDecoderService } from './services/erc20-transfer-decoder.service';
import { Erc20ApprovalDecoderService } from './services/erc20-approval-decoder.service';
import { NftTransferDecoderService } from './services/nft-transfer-decoder.service';
import { ContractStandardDetectorService } from './services/contract-standard-detector.service';
import { TokenMetadataService } from './services/token-metadata.service';
import { NftMetadataService } from './services/nft-metadata.service';
import { DecodeProcessor } from './processors/decode-processor';
import { NftMetadataProcessor } from './processors/nft-metadata-processor';
import { ProtocolRegistryService } from './protocols/protocol-registry.service';
import { UniswapV2Decoder } from './protocols/uniswap-v2/uniswap-v2.decoder';
import { UniswapV3Decoder } from './protocols/uniswap-v3/uniswap-v3.decoder';
import { SeaportDecoder } from './protocols/seaport/seaport.decoder';
import { BlurDecoder } from './protocols/blur/blur.decoder';
import { AaveDecoder } from './protocols/aave/aave.decoder';
import { CompoundDecoder } from './protocols/compound/compound.decoder';
import { NftSaleEntity } from '@app/db/entities/nft-sale.entity';
import { LendingEventEntity } from '@app/db/entities/lending-event.entity';

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
      AddressNftHoldingEntity,
      NftContractStatsEntity,
      ContractStandardEntity,
      DexSwapEntity,
      DexPairEntity,
      ProtocolContractEntity,
      NftSaleEntity,
      LendingEventEntity,
      TokenApprovalEntity,
      TokenAllowanceEntity,
    ]),
  ],
  providers: [
    Erc20TransferDecoderService,
    Erc20ApprovalDecoderService,
    NftTransferDecoderService,
    ContractStandardDetectorService,
    TokenMetadataService,
    NftMetadataService,
    NftReadModelService,
    DecodeProcessor,
    NftMetadataProcessor,
    ProtocolRegistryService,
    UniswapV2Decoder,
    UniswapV3Decoder,
    SeaportDecoder,
    BlurDecoder,
    AaveDecoder,
    CompoundDecoder,
  ],
  exports: [Erc20TransferDecoderService, NftTransferDecoderService, TokenMetadataService, NftMetadataService, ProtocolRegistryService],
})
export class DecodeModule {}
