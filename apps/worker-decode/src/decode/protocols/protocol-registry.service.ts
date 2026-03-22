import { Injectable, Logger } from '@nestjs/common';
import { ProtocolDecoder } from './protocol-decoder.interface';

/**
 * Registry and orchestrator for protocol decoders.
 * Coordinates enabled protocol modules during decode, backfill, and rollback.
 */
@Injectable()
export class ProtocolRegistryService {
  private readonly logger = new Logger(ProtocolRegistryService.name);
  private readonly decoders: ProtocolDecoder[] = [];

  register(decoder: ProtocolDecoder): void {
    this.decoders.push(decoder);
    this.logger.log(`Registered protocol decoder: ${decoder.protocol}`);
  }

  getDecoders(): ProtocolDecoder[] {
    return [...this.decoders];
  }

  /**
   * Run all registered protocol decoders for a block.
   */
  async decodeBlock(blockNumber: number): Promise<number> {
    let total = 0;
    for (const decoder of this.decoders) {
      try {
        total += await decoder.decodeBlock(blockNumber);
      } catch (error) {
        this.logger.error(
          `Protocol ${decoder.protocol} failed on block ${blockNumber}: ${(error as Error).message}`,
        );
      }
    }
    return total;
  }

  /**
   * Rollback all protocol-derived data from block >= blockNumber.
   */
  async rollbackFrom(blockNumber: number): Promise<void> {
    for (const decoder of this.decoders) {
      try {
        await decoder.rollbackFrom(blockNumber);
      } catch (error) {
        this.logger.error(
          `Protocol ${decoder.protocol} rollback failed from block ${blockNumber}: ${(error as Error).message}`,
        );
      }
    }
  }
}
