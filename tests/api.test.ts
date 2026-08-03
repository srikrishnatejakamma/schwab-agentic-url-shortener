import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { UrlShortenerService } from '../src/domain/urlShortenerService.js';
import { FileUrlRepository } from '../src/storage/fileUrlRepository.js';

async function createTestApp() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'schwab-api-'));
  const repository = new FileUrlRepository(path.join(tempDir, 'urls.json'));
  const service = new UrlShortenerService(repository, 'http://localhost:3000');

  return createApp(service);
}

describe('HTTP API', () => {
  it('serves a root landing page', async () => {
    const app = await createTestApp();

    const response = await request(app)
      .get('/')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Agentic URL Shortener');
    expect(response.text).toContain('Create URL');
    expect(response.text).toContain('Review URLs');
    expect(response.text).toContain('Run Workflows');
    expect(response.text).toContain('href="/create"');
    expect(response.text).toContain('href="/links"');
    expect(response.text).toContain('href="/workflows"');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('rate limits create-url requests per client', async () => {
    const app = await createTestApp();

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await request(app)
        .post('/api/urls')
        .set('x-forwarded-for', '203.0.113.10')
        .send({ url: `https://example.com/${attempt}`, tags: [] })
        .expect(201);
    }

    const limited = await request(app)
      .post('/api/urls')
      .set('x-forwarded-for', '203.0.113.10')
      .send({ url: 'https://example.com/blocked', tags: [] })
      .expect(429);

    expect(limited.body.message).toContain('Too many requests');
  });

  it('creates a short url and exposes analytics after a redirect', async () => {
    const app = await createTestApp();

    const creation = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com/path', tags: ['campaign'] })
      .expect(201);

    const code = creation.body.record.code as string;

    await request(app)
      .get(`/r/${code}`)
      .set('x-forwarded-for', '10.0.0.1')
      .expect(302)
      .expect('Location', 'https://example.com/path');

    const analytics = await request(app)
      .get(`/api/urls/${code}/analytics`)
      .expect(200);

    expect(analytics.body.clickCount).toBe(1);
    expect(analytics.body.uniqueRequesterCount).toBe(1);
    expect(analytics.body.tags).toEqual(['campaign']);
  });

  it('runs the greenfield orchestration scenario through the API', async () => {
    const app = await createTestApp();

    const result = await request(app)
      .post('/api/workflows/greenfield')
      .send({
        approvals: {
          'release-readiness': {
            approved: true,
            approver: 'reviewer'
          }
        }
      })
      .expect(200);

    expect(result.body.status).toBe('completed');
    expect(result.body.completedNodes).toContain('release-readiness');
  });
});