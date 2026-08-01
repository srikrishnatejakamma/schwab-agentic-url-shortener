import fs from 'node:fs/promises';
import path from 'node:path';

import type { UrlRecord, UrlRepository } from '../domain/models.js';

type RepositoryFileShape = {
  records: UrlRecord[];
};

export class FileUrlRepository implements UrlRepository {
  private readonly records = new Map<string, UrlRecord>();
  private loaded = false;
  private readonly tempFilePath: string;

  public constructor(private readonly filePath: string) {
    this.tempFilePath = `${filePath}.${process.pid}.tmp`;
  }

  public async getByCode(code: string): Promise<UrlRecord | undefined> {
    await this.load();
    return this.records.get(code);
  }

  public async getByIdempotencyKey(idempotencyKey: string): Promise<UrlRecord | undefined> {
    await this.load();

    for (const record of this.records.values()) {
      if (record.idempotencyKey === idempotencyKey) {
        return record;
      }
    }

    return undefined;
  }

  public async save(record: UrlRecord): Promise<void> {
    await this.load();
    this.records.set(record.code, record);
    await this.flush();
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
      parsed.records.forEach((record) => this.records.set(record.code, record));
    } catch (error) {
      const isMissingFile = typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
      if (!isMissingFile) {
        throw error;
      }
    }

    this.loaded = true;
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