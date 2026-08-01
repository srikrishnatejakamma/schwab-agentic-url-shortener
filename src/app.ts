import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { createUrlRequestSchema, workflowTriggerSchema } from './domain/models.js';
import { ServiceError, UrlShortenerService } from './domain/urlShortenerService.js';
import { WorkflowEngine } from './orchestration/workflowEngine.js';
import { policyRegistry } from './orchestration/policies.js';
import { createScenarioCatalog } from './scenarios/catalog.js';

function getRequester(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return request.ip || 'anonymous';
}

function renderHomePage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Agentic URL Shortener Prototype</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe6;
        --panel: #fffaf2;
        --ink: #1b1f23;
        --muted: #5f6b76;
        --accent: #0f766e;
        --border: #d7c7ad;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Georgia, 'Times New Roman', serif;
        background: radial-gradient(circle at top, #fff8eb 0%, var(--bg) 52%, #eadcc7 100%);
        color: var(--ink);
      }

      main {
        max-width: 960px;
        margin: 0 auto;
        padding: 48px 20px 72px;
      }

      .hero,
      .panel {
        background: color-mix(in srgb, var(--panel) 92%, white 8%);
        border: 1px solid var(--border);
        border-radius: 18px;
        box-shadow: 0 18px 45px rgba(70, 52, 24, 0.08);
      }

      .hero {
        padding: 32px;
        margin-bottom: 20px;
      }

      .eyebrow {
        margin: 0 0 12px;
        color: var(--accent);
        font-size: 0.9rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(2.1rem, 5vw, 3.8rem);
        line-height: 1;
      }

      p {
        margin: 0;
        line-height: 1.6;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
      }

      .panel {
        padding: 24px;
      }

      h2 {
        margin-top: 0;
        font-size: 1.2rem;
      }

      ul {
        padding-left: 20px;
        margin: 0;
      }

      li + li {
        margin-top: 10px;
      }

      code {
        font-family: Consolas, 'Courier New', monospace;
        background: #f4ead9;
        border-radius: 6px;
        padding: 2px 6px;
      }

      a {
        color: var(--accent);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">Schwab Assignment Prototype</p>
        <h1>Agentic URL Shortener</h1>
        <p>A runnable URL shortener service paired with a governed workflow engine for greenfield, brownfield, and ambiguous SDLC execution scenarios.</p>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>Core API</h2>
          <ul>
            <li><a href="/health">GET /health</a> for service health and repository stats</li>
            <li><a href="/api/urls">GET /api/urls</a> to list shortened URLs</li>
            <li><code>POST /api/urls</code> to create a new short link</li>
            <li><code>GET /api/urls/:code/analytics</code> for usage analytics</li>
            <li><code>GET /r/:code</code> to redirect to the target URL</li>
          </ul>
        </article>

        <article class="panel">
          <h2>Workflow Scenarios</h2>
          <ul>
            <li><a href="/api/workflows">GET /api/workflows</a> to inspect available orchestration scenarios</li>
            <li><code>POST /api/workflows/greenfield</code> for governed new-system delivery</li>
            <li><code>POST /api/workflows/brownfield</code> for enhancement and impact analysis</li>
            <li><code>POST /api/workflows/ambiguous</code> for clarification-driven re-planning</li>
          </ul>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

type RateLimitBucket = {
  windowStartedAt: number;
  requestCount: number;
};

const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 30;
const rateLimitBuckets = new Map<string, RateLimitBucket>();

function getClientKey(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return request.ip || 'anonymous';
}

function applySecurityHeaders(response: Response): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

function enforceRateLimit(request: Request, response: Response, bucketName: string): boolean {
  const now = Date.now();
  const clientKey = `${bucketName}:${getClientKey(request)}`;
  const bucket = rateLimitBuckets.get(clientKey);

  if (!bucket || now - bucket.windowStartedAt >= rateLimitWindowMs) {
    rateLimitBuckets.set(clientKey, { windowStartedAt: now, requestCount: 1 });
    return true;
  }

  if (bucket.requestCount >= rateLimitMaxRequests) {
    response.status(429).json({
      message: 'Too many requests. Please retry later.'
    });
    return false;
  }

  bucket.requestCount += 1;
  return true;
}

export function createApp(urlShortenerService: UrlShortenerService) {
  const app = express();
  const workflowEngine = new WorkflowEngine(policyRegistry);
  const scenarioCatalog = createScenarioCatalog();

  app.use(express.json());
  app.use((request, response, next) => {
    applySecurityHeaders(response);

    const startedAt = Date.now();

    response.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      console.log(`${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`);
    });

    next();
  });

  app.get('/', (_request, response) => {
    response.type('html').send(renderHomePage());
  });

  app.get('/health', async (_request, response) => {
    response.json({
      status: 'ok',
      service: await urlShortenerService.getHealth()
    });
  });

  app.get('/api/urls', async (_request, response) => {
    response.json({
      data: await urlShortenerService.listUrls()
    });
  });

  app.post('/api/urls', async (request, response) => {
    if (!enforceRateLimit(request, response, 'create-url')) {
      return;
    }

    const input = createUrlRequestSchema.parse(request.body);
    const result = await urlShortenerService.createShortUrl(input);
    response.status(result.created ? 201 : 200).json(result);
  });

  app.get('/api/urls/:code', async (request, response) => {
    const record = await urlShortenerService.resolveShortUrl(request.params.code, {
      requester: getRequester(request),
      userAgent: request.get('user-agent') ?? undefined,
      referrer: request.get('referer') ?? undefined
    });

    response.json({
      code: record.code,
      targetUrl: record.targetUrl,
      shortUrl: record.shortUrl,
      clickCount: record.clickCount,
      uniqueRequesterCount: record.uniqueRequesterCount
    });
  });

  app.get('/r/:code', async (request, response) => {
    const record = await urlShortenerService.resolveShortUrl(request.params.code, {
      requester: getRequester(request),
      userAgent: request.get('user-agent') ?? undefined,
      referrer: request.get('referer') ?? undefined
    });

    response.redirect(302, record.targetUrl);
  });

  app.get('/api/urls/:code/analytics', async (request, response) => {
    response.json(await urlShortenerService.getAnalytics(request.params.code));
  });

  app.get('/api/workflows', (_request, response) => {
    response.json({
      data: Object.values(scenarioCatalog).map((scenario) => ({
        id: scenario.id,
        name: Object.entries(scenarioCatalog).find(([, value]) => value.id === scenario.id)?.[0],
        title: scenario.title,
        description: scenario.description
      }))
    });
  });

  app.post('/api/workflows/:scenario', async (request, response) => {
    if (!enforceRateLimit(request, response, 'workflow-run')) {
      return;
    }

    const scenario = scenarioCatalog[request.params.scenario];
    if (!scenario) {
      response.status(404).json({ message: 'Scenario not found.' });
      return;
    }

    const body = workflowTriggerSchema.parse(request.body ?? {});
    const result = await workflowEngine.execute(scenario, {
      approvals: body.approvals,
      input: {
        requirementClarity: request.params.scenario === 'ambiguous' ? 'ambiguous' : 'clear',
        ...(body.input ?? {})
      }
    });

    response.json(result);
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({ message: 'Invalid request payload.', issues: error.issues });
      return;
    }

    if (error instanceof ServiceError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }

    if (error instanceof Error) {
      response.status(500).json({ message: error.message });
      return;
    }

    response.status(500).json({ message: 'Unknown server error.' });
  });

  return app;
}