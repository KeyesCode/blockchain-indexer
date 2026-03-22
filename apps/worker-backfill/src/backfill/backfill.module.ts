import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockEntity } from '@app/db/entities/block.entity';
import { TransactionEntity } from '@app/db/entities/transaction.entity';
import { TransactionReceiptEntity } from '@app/db/entities/transaction-receipt.entity';
import { LogEntity } from '@app/db/entities/log.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import { BackfillJobEntity } from '@app/db/entities/backfill-job.entity';
import { AddressSummaryEntity } from '@app/db/entities/address-summary.entity';
import { TokenStatsEntity } from '@app/db/entities/token-stats.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { Erc721OwnershipEntity } from '@app/db/entities/erc721-ownership.entity';
import { Erc1155BalanceEntity } from '@app/db/entities/erc1155-balance.entity';
import { DexSwapEntity } from '@app/db/entities/dex-swap.entity';
import { DexPairEntity } from '@app/db/entities/dex-pair.entity';
import { ProtocolContractEntity } from '@app/db/entities/protocol-contract.entity';
import { NftSaleEntity } from '@app/db/entities/nft-sale.entity';
import { TokenApprovalEntity } from '@app/db/entities/token-approval.entity';
import { TokenAllowanceEntity } from '@app/db/entities/token-allowance.entity';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { NftTokenMetadataEntity } from '@app/db/entities/nft-token-metadata.entity';
import { AddressNftHoldingEntity } from '@app/db/entities/address-nft-holding.entity';
import { NftContractStatsEntity } from '@app/db/entities/nft-contract-stats.entity';
import { ContractStandardEntity } from '@app/db/entities/contract-standard.entity';
import { SummaryService } from '@app/db/services/summary.service';
import { PartitionManagerService } from '@app/db/services/partition-manager.service';
import { NftReadModelService } from '@app/db/services/nft-read-model.service';
import { BackfillJobService } from './services/backfill-job.service';
import { BackfillRunnerService } from './services/backfill-runner.service';
import { RangePlannerService } from './services/range-planner.service';
// Protocol decoders — self-register via onModuleInit
import { ProtocolRegistryService } from '../../../worker-decode/src/decode/protocols/protocol-registry.service';
import { UniswapV2Decoder } from '../../../worker-decode/src/decode/protocols/uniswap-v2/uniswap-v2.decoder';
import { UniswapV3Decoder } from '../../../worker-decode/src/decode/protocols/uniswap-v3/uniswap-v3.decoder';
import { SeaportDecoder } from '../../../worker-decode/src/decode/protocols/seaport/seaport.decoder';
import { BlurDecoder } from '../../../worker-decode/src/decode/protocols/blur/blur.decoder';
import { AaveDecoder } from '../../../worker-decode/src/decode/protocols/aave/aave.decoder';
import { CompoundDecoder } from '../../../worker-decode/src/decode/protocols/compound/compound.decoder';
import { LendingEventEntity } from '@app/db/entities/lending-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BlockEntity,
      TransactionEntity,
      TransactionReceiptEntity,
      LogEntity,
      TokenTransferEntity,
      BackfillJobEntity,
      AddressSummaryEntity,
      TokenStatsEntity,
      NftTransferEntity,
      Erc721OwnershipEntity,
      Erc1155BalanceEntity,
      DexSwapEntity,
      DexPairEntity,
      ProtocolContractEntity,
      NftSaleEntity,
      TokenApprovalEntity,
      TokenAllowanceEntity,
      TokenContractEntity,
      NftTokenMetadataEntity,
      AddressNftHoldingEntity,
      NftContractStatsEntity,
      ContractStandardEntity,
      LendingEventEntity,
    ]),
  ],
  providers: [
    BackfillJobService,
    BackfillRunnerService,
    RangePlannerService,
    SummaryService,
    PartitionManagerService,
    NftReadModelService,
    ProtocolRegistryService,
    UniswapV2Decoder,
    UniswapV3Decoder,
    SeaportDecoder,
    BlurDecoder,
    AaveDecoder,
    CompoundDecoder,
  ],
  exports: [BackfillJobService, BackfillRunnerService, RangePlannerService],
})
export class BackfillModule {}
