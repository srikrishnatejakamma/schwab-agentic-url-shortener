import type { AnalyticsSnapshot, CreateUrlRequest, CreateUrlResult, UrlAccessEvent, UrlRecord, UrlRepository } from './models.js';
import { generateBase62Code } from '../utils/base62.js';

export type CodeGenerator = (length: number) => string;

export class ServiceError extends Error {
  public constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

type ResolveMetadata = {
  requester: string;
  userAgent?: string;
  referrer?: string;
};

export class UrlShortenerService {
  private readonly normalizedBaseUrl: string;

  public constructor(
    private readonly repository: UrlRepository,
    private readonly baseUrl: string,
    private readonly now: () => Date = () => new Date(),
    private readonly codeGenerator: CodeGenerator = generateBase62Code
  ) {
    this.normalizedBaseUrl = this.baseUrl.replace(/\/+$/, '');
  }

  public async createShortUrl(input: CreateUrlRequest): Promise<CreateUrlResult> {
    if (input.idempotencyKey) {
      const existing = await this.repository.getByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return { record: existing, created: false };
      }
    }

    const code = input.customCode ?? (await this.generateUniqueCode());
    const existingWithCode = await this.repository.getByCode(code);
    if (existingWithCode) {
      throw new ServiceError(`Short code '${code}' already exists.`, 409);
    }

    const createdAt = this.now().toISOString();
    const createdAtMs = Date.parse(createdAt);
    const expiresAt = input.expiresInDays
      ? new Date(createdAtMs + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const record: UrlRecord = {
      code,
      targetUrl: input.url,
      shortUrl: `${this.normalizedBaseUrl}/r/${code}`,
      createdAt,
      updatedAt: createdAt,
      expiresAt,
      tags: [...input.tags],
      clickCount: 0,
      uniqueRequesterCount: 0,
      requesters: [],
      accessLog: [],
      idempotencyKey: input.idempotencyKey
    };

    await this.repository.save(record);

    return { record, created: true };
  }

  public async resolveShortUrl(code: string, metadata: ResolveMetadata): Promise<UrlRecord> {
    const record = await this.getRequiredRecord(code);

    const resolvedAt = this.now().toISOString();
    const resolvedAtMs = Date.parse(resolvedAt);

    if (record.expiresAt && Date.parse(record.expiresAt) <= resolvedAtMs) {
      throw new ServiceError(`Short code '${code}' has expired.`, 410);
    }

    const accessEvent: UrlAccessEvent = {
      timestamp: resolvedAt,
      requester: metadata.requester,
      userAgent: metadata.userAgent,
      referrer: metadata.referrer
    };

    const requesterSet = new Set(record.requesters);
    requesterSet.add(metadata.requester);

    const updatedRecord: UrlRecord = {
      ...record,
      updatedAt: accessEvent.timestamp,
      clickCount: record.clickCount + 1,
      uniqueRequesterCount: requesterSet.size,
      requesters: Array.from(requesterSet),
      accessLog: [...record.accessLog, accessEvent].slice(-100)
    };

    await this.repository.save(updatedRecord);
    return updatedRecord;
  }

  public async getAnalytics(code: string): Promise<AnalyticsSnapshot> {
    const record = await this.getRequiredRecord(code);

    return {
      code: record.code,
      targetUrl: record.targetUrl,
      shortUrl: record.shortUrl,
      clickCount: record.clickCount,
      uniqueRequesterCount: record.uniqueRequesterCount,
      lastAccessedAt: record.accessLog.at(-1)?.timestamp,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      tags: [...record.tags],
      recentAccesses: [...record.accessLog].slice(-10).reverse()
    };
  }

  public async listUrls(): Promise<UrlRecord[]> {
    return this.repository.list();
  }

  public async getHealth(): Promise<{ totalUrls: number; activeUrls: number; expiredUrls: number }> {
    const records = await this.repository.list();
    const now = this.now().getTime();

    let activeUrls = 0;
    let expiredUrls = 0;

    for (const record of records) {
      const expired = record.expiresAt ? new Date(record.expiresAt).getTime() <= now : false;
      if (expired) {
        expiredUrls += 1;
      } else {
        activeUrls += 1;
      }
    }

    return {
      totalUrls: records.length,
      activeUrls,
      expiredUrls
    };
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = this.codeGenerator(7);
      const existing = await this.repository.getByCode(code);
      if (!existing) {
        return code;
      }
    }

    throw new ServiceError('Unable to allocate a unique short code after repeated attempts.', 503);
  }

  private async getRequiredRecord(code: string): Promise<UrlRecord> {
    const record = await this.repository.getByCode(code);
    if (!record) {
      throw new ServiceError(`Short code '${code}' was not found.`, 404);
    }

    return record;
  }
}