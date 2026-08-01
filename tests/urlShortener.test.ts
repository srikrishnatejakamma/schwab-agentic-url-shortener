import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { UrlShortenerService, ServiceError } from '../src/domain/urlShortenerService.js';
import { FileUrlRepository } from '../src/storage/fileUrlRepository.js';

async function createService(now: () => Date = () => new Date()) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'schwab-url-service-'));
  const repository = new FileUrlRepository(path.join(tempDir, 'urls.json'));
  const service = new UrlShortenerService(repository, 'http://localhost:3000', now);

  return { service, tempDir };
}

describe('UrlShortenerService', () => {
  it('creates and resolves a short url with analytics', async () => {
    const { service } = await createService();
    const creation = await service.createShortUrl({
      url: 'https://example.com/resource',
      tags: ['docs']
    });

    expect(creation.created).toBe(true);
    expect(creation.record.shortUrl).toContain(`/r/${creation.record.code}`);

    await service.resolveShortUrl(creation.record.code, { requester: 'user-a' });
    await service.resolveShortUrl(creation.record.code, { requester: 'user-b' });

    const analytics = await service.getAnalytics(creation.record.code);
    expect(analytics.clickCount).toBe(2);
    expect(analytics.uniqueRequesterCount).toBe(2);
    expect(analytics.tags).toEqual(['docs']);
  });

  it('returns the existing record for a repeated idempotency key', async () => {
    const { service } = await createService();

    const first = await service.createShortUrl({
      url: 'https://example.com/a',
      idempotencyKey: 'request-12345678',
      tags: []
    });
    const second = await service.createShortUrl({
      url: 'https://example.com/b',
      idempotencyKey: 'request-12345678',
      tags: []
    });

    expect(first.record.code).toBe(second.record.code);
    expect(second.created).toBe(false);
    expect(second.record.targetUrl).toBe('https://example.com/a');
  });

  it('rejects expired short codes', async () => {
    const baseTime = new Date('2026-08-01T00:00:00.000Z');
    let currentTime = baseTime;
    const { service } = await createService(() => currentTime);

    const creation = await service.createShortUrl({
      url: 'https://example.com/expiring',
      expiresInDays: 1,
      tags: []
    });

    currentTime = new Date(baseTime.getTime() + 2 * 24 * 60 * 60 * 1000);

    await expect(service.resolveShortUrl(creation.record.code, { requester: 'user-a' })).rejects.toMatchObject({
      statusCode: 410
    });
  });
});