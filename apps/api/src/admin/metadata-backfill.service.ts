import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, JsonRpcProvider } from 'ethers';
import { TokenContractEntity } from '@app/db/entities/token-contract.entity';
import { TokenTransferEntity } from '@app/db/entities/token-transfer.entity';
import {
  NftTokenMetadataEntity,
  NftMetadataStatus,
} from '@app/db/entities/nft-token-metadata.entity';
import { NftTransferEntity } from '@app/db/entities/nft-transfer.entity';
import { ERC20_ABI, ERC721_ABI, ERC1155_ABI } from '@app/abi';
import { withRetry } from '@app/common/utils/retry';

const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const FETCH_TIMEOUT_MS = 10_000;

@Injectable()
export class MetadataBackfillService {
  private readonly logger = new Logger(MetadataBackfillService.name);
  private readonly provider: JsonRpcProvider | null;
  private readonly ipfsGateway: string;

  constructor(
    @InjectRepository(TokenContractEntity)
    private readonly tokenRepo: Repository<TokenContractEntity>,

    @InjectRepository(TokenTransferEntity)
    private readonly transferRepo: Repository<TokenTransferEntity>,

    @InjectRepository(NftTokenMetadataEntity)
    private readonly nftMetadataRepo: Repository<NftTokenMetadataEntity>,

    @InjectRepository(NftTransferEntity)
    private readonly nftTransferRepo: Repository<NftTransferEntity>,
  ) {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    this.provider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
    this.ipfsGateway = process.env.NFT_IPFS_GATEWAY || DEFAULT_IPFS_GATEWAY;
  }

  /**
   * Find all token addresses in token_transfers that are missing
   * from token_contracts, and fetch their on-chain metadata.
   */
  async backfillTokenContracts(): Promise<{
    found: number;
    fetched: number;
    failed: number;
  }> {
    // Find unique token addresses missing from token_contracts
    const missing: { token_address: string }[] = await this.transferRepo.query(`
      SELECT DISTINCT tt.token_address
      FROM token_transfers tt
      LEFT JOIN token_contracts tc ON tc.address = tt.token_address
      WHERE tc.address IS NULL
    `);

    this.logger.log(`Found ${missing.length} token addresses missing metadata`);

    if (!this.provider || missing.length === 0) {
      return { found: missing.length, fetched: 0, failed: 0 };
    }

    let fetched = 0;
    let failed = 0;

    for (const row of missing) {
      const address = row.token_address;
      try {
        const contract = new Contract(address, ERC20_ABI, this.provider);

        const [name, symbol, decimals] = await Promise.allSettled([
          withRetry(() => contract.name() as Promise<string>, 2, 500),
          withRetry(() => contract.symbol() as Promise<string>, 2, 500),
          withRetry(() => contract.decimals() as Promise<bigint>, 2, 500),
        ]);

        if (
          name.status === 'rejected' &&
          symbol.status === 'rejected' &&
          decimals.status === 'rejected'
        ) {
          failed++;
          continue;
        }

        const entity = this.tokenRepo.create({
          address,
          name: name.status === 'fulfilled' ? String(name.value) : null,
          symbol: symbol.status === 'fulfilled' ? String(symbol.value) : null,
          decimals:
            decimals.status === 'fulfilled' ? Number(decimals.value) : null,
          totalSupply: null,
          standard: 'ERC20',
        });

        await this.tokenRepo.upsert(entity, ['address']);
        fetched++;

        if (fetched % 50 === 0) {
          this.logger.log(`Token metadata progress: ${fetched}/${missing.length}`);
        }
      } catch {
        failed++;
      }
    }

    this.logger.log(
      `Token metadata backfill complete: ${fetched} fetched, ${failed} failed out of ${missing.length}`,
    );

    return { found: missing.length, fetched, failed };
  }

  /**
   * Find all NFT tokens in nft_transfers that are missing
   * from nft_token_metadata, create rows, and fetch metadata.
   */
  async backfillNftMetadata(opts?: {
    limit?: number;
    fetchContent?: boolean;
  }): Promise<{
    found: number;
    created: number;
    fetched: number;
    failed: number;
  }> {
    const limit = opts?.limit ?? 1000;
    const fetchContent = opts?.fetchContent ?? true;

    // Find unique NFT tokens missing from nft_token_metadata
    const missing: { token_address: string; token_id: string; token_type: string }[] =
      await this.nftTransferRepo.query(`
        SELECT DISTINCT nt.token_address, nt.token_id, nt.token_type
        FROM nft_transfers nt
        LEFT JOIN nft_token_metadata nm
          ON nm.token_address = nt.token_address AND nm.token_id = nt.token_id
        WHERE nm.token_address IS NULL
        LIMIT $1
      `, [limit]);

    this.logger.log(`Found ${missing.length} NFT tokens missing metadata`);

    if (missing.length === 0) {
      return { found: 0, created: 0, fetched: 0, failed: 0 };
    }

    // Batch-create PENDING rows
    const pendingRows = missing.map((row) =>
      this.nftMetadataRepo.create({
        tokenAddress: row.token_address,
        tokenId: row.token_id,
        fetchStatus: NftMetadataStatus.PENDING,
        fetchAttempts: 0,
      }),
    );

    await this.nftMetadataRepo
      .createQueryBuilder()
      .insert()
      .into(NftTokenMetadataEntity)
      .values(pendingRows)
      .orIgnore()
      .execute();

    const created = pendingRows.length;

    if (!fetchContent || !this.provider) {
      return { found: missing.length, created, fetched: 0, failed: 0 };
    }

    // Fetch metadata for each token
    let fetched = 0;
    let failed = 0;

    for (const row of missing) {
      try {
        await this.fetchAndStoreNft(
          row.token_address,
          row.token_id,
          row.token_type,
        );
        fetched++;

        if (fetched % 50 === 0) {
          this.logger.log(`NFT metadata progress: ${fetched}/${missing.length}`);
        }
      } catch {
        failed++;
      }
    }

    this.logger.log(
      `NFT metadata backfill complete: ${created} created, ${fetched} fetched, ${failed} failed`,
    );

    return { found: missing.length, created, fetched, failed };
  }

  private async fetchAndStoreNft(
    tokenAddress: string,
    tokenId: string,
    tokenType: string,
  ): Promise<void> {
    if (!this.provider) return;

    await this.nftMetadataRepo.update(
      { tokenAddress, tokenId },
      {
        fetchStatus: NftMetadataStatus.FETCHING,
        fetchAttempts: () => '"fetch_attempts" + 1',
        lastFetchAt: new Date(),
      } as any,
    );

    // Get tokenURI from contract
    let tokenUri: string | null = null;
    try {
      const abi = tokenType === 'ERC1155' ? ERC1155_ABI : ERC721_ABI;
      const method = tokenType === 'ERC1155' ? 'uri' : 'tokenURI';
      const contract = new Contract(tokenAddress, abi, this.provider);
      tokenUri = (await withRetry(
        () => contract[method](BigInt(tokenId)) as Promise<string>,
        2,
        500,
      ));
    } catch {
      await this.nftMetadataRepo.update(
        { tokenAddress, tokenId },
        { fetchStatus: NftMetadataStatus.RETRYABLE },
      );
      return;
    }

    if (!tokenUri) {
      await this.nftMetadataRepo.update(
        { tokenAddress, tokenId },
        { fetchStatus: NftMetadataStatus.FAILED, tokenUri: null },
      );
      return;
    }

    // ERC-1155 URI substitution
    if (tokenUri.includes('{id}')) {
      tokenUri = tokenUri.replace(
        '{id}',
        BigInt(tokenId).toString(16).padStart(64, '0'),
      );
    }

    const resolvedUrl = this.resolveUri(tokenUri);

    // Fetch metadata JSON
    let metadataJson: any = null;
    let name: string | null = null;
    let description: string | null = null;
    let imageUrl: string | null = null;

    try {
      if (resolvedUrl.startsWith('data:application/json')) {
        const base64Match = resolvedUrl.match(/base64,(.+)/);
        if (base64Match) {
          metadataJson = JSON.parse(
            Buffer.from(base64Match[1], 'base64').toString(),
          );
        } else {
          const jsonMatch = resolvedUrl.match(/,(.+)/);
          if (jsonMatch) {
            metadataJson = JSON.parse(decodeURIComponent(jsonMatch[1]));
          }
        }
      } else if (resolvedUrl.startsWith('http')) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const response = await fetch(resolvedUrl, {
            signal: controller.signal,
          });
          if (response.ok) {
            metadataJson = await response.json();
          }
        } finally {
          clearTimeout(timeout);
        }
      }
    } catch {
      // Bad JSON or network failure — still save the URI
    }

    if (metadataJson && typeof metadataJson === 'object') {
      name =
        typeof metadataJson.name === 'string'
          ? metadataJson.name.slice(0, 255)
          : null;
      description =
        typeof metadataJson.description === 'string'
          ? metadataJson.description
          : null;
      const rawImage =
        metadataJson.image || metadataJson.image_url || metadataJson.image_data;
      imageUrl = typeof rawImage === 'string' ? this.resolveUri(rawImage) : null;
    }

    await this.nftMetadataRepo.update(
      { tokenAddress, tokenId },
      {
        tokenUri,
        metadataJson,
        name,
        description,
        imageUrl,
        fetchStatus: metadataJson
          ? NftMetadataStatus.SUCCESS
          : NftMetadataStatus.RETRYABLE,
      },
    );
  }

  private resolveUri(uri: string): string {
    if (!uri) return uri;
    const trimmed = uri.trim();

    if (trimmed.startsWith('ipfs://'))
      return `${this.ipfsGateway}${trimmed.slice(7)}`;
    if (trimmed.startsWith('ar://'))
      return `https://arweave.net/${trimmed.slice(5)}`;
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:')
    )
      return trimmed;
    if (trimmed.startsWith('Qm') || trimmed.startsWith('ba'))
      return `${this.ipfsGateway}${trimmed}`;

    return trimmed;
  }
}
