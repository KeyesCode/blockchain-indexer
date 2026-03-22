import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DexSwapEntity } from '@app/db/entities/dex-swap.entity';
import { DexPairEntity } from '@app/db/entities/dex-pair.entity';
import { ProtocolsController } from './protocols.controller';
import { ProtocolsService } from './protocols.service';

@Module({
  imports: [TypeOrmModule.forFeature([DexSwapEntity, DexPairEntity])],
  controllers: [ProtocolsController],
  providers: [ProtocolsService],
  exports: [ProtocolsService],
})
export class ProtocolsModule {}
