import fs from 'node:fs/promises';
import path from 'node:path';

import type { UrlRecord, UrlRepository } from '../domain/models.js';

type RepositoryFileShape = {
  records: UrlRecord[];
};

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

export class FileUrlRepository implements UrlRepository {
  private readonly records = new Map<string, UrlRecord>();
  private readonly idempotencyIndex = new Map<string, string>();
  private loaded = false;
  private readonly tempFilePath: string;
  private flushPromise: Promise<void> = Promise.resolve();
  private isFlushing = false;

  public constructor(private readonly filePath: string) {
    this.tempFilePath = `${filePath}.${process.pid}.tmp`;
  }

  public async getByCode(code: string): Promise<UrlRecord | undefined> {
    await this.load();
    return this.records.get(code);
  }

  public async getByIdempotencyKey(idempotencyKey: string): Promise<UrlRecord | undefined> {
    await this.load();

    const code = this.idempotencyIndex.get(idempotencyKey);
    return code ? this.records.get(code) : undefined;
  }

  public async save(record: UrlRecord): Promise<void> {
    await this.load();
    this.upsertRecord(record);

    if (!this.isFlushing) {
      this.isFlushing = true;
      this.flushPromise = this.flush().finally(() => {
        this.isFlushing = false;
      });
    }

    await this.flushPromise;
  }

  public async list(): Promise<UrlRecord[]> {
    await this.load();
    return Array.from(this.records.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content) as RepositoryFileShape;
      for (const record of parsed.records) {
        this.upsertRecord(record);
      }
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    this.loaded = true;
  }

  private upsertRecord(record: UrlRecord): void {
    const previous = this.records.get(record.code);
    if (previous?.idempotencyKey) {
      this.idempotencyIndex.delete(previous.idempotencyKey);
    }

    this.records.set(record.code, record);
    if (record.idempotencyKey) {
      this.idempotencyIndex.set(record.idempotencyKey, record.code);
    }
  }

  private async flush(): Promise<void> {
    const payload: RepositoryFileShape = {
      records: Array.from(this.records.values())
    };

    await fs.writeFile(this.tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.rm(this.filePath, { force: true });
    await fs.rename(this.tempFilePath, this.filePath);
  }
}