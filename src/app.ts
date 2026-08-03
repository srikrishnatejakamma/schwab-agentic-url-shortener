import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { createUrlRequestSchema, workflowTriggerSchema } from './domain/models.js';
import { ServiceError, UrlShortenerService } from './domain/urlShortenerService.js';
import { WorkflowEngine } from './orchestration/workflowEngine.js';
import { policyRegistry } from './orchestration/policies.js';
import { createScenarioCatalog } from './scenarios/catalog.js';

function getClientAddress(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return request.ip || 'anonymous';
}

function getRequester(request: Request): string {
  return getClientAddress(request);
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
        --error: #a61b1b;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Georgia, 'Times New Roman', serif;
        background: radial-gradient(circle at top, #fff8eb 0%, var(--bg) 52%, #eadcc7 100%);
        color: var(--ink);
      }

      main {
        max-width: 1100px;
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
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 20px;
      }

      .panel {
        padding: 24px;
      }

      h2 {
        margin-top: 0;
        font-size: 1.2rem;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .field span {
        font-weight: 600;
      }

      .field input,
      .field select,
      .field textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 10px;
        font: inherit;
        background: white;
      }

      .field textarea {
        min-height: 100px;
        resize: vertical;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 4px;
      }

      button {
        border: none;
        border-radius: 999px;
        background: var(--accent);
        color: white;
        padding: 10px 14px;
        cursor: pointer;
        font: inherit;
      }

      button.secondary {
        background: #7c5b2d;
      }

      .helper {
        color: var(--muted);
        font-size: 0.92rem;
      }

      .status {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        background: #f4ead9;
        color: var(--ink);
        white-space: pre-wrap;
      }

      .status.error {
        color: var(--error);
        background: #fdeceb;
      }

      .result {
        margin-top: 10px;
        background: #0f172a;
        color: #f8fafc;
        padding: 12px;
        border-radius: 10px;
        overflow: auto;
        font-size: 0.92rem;
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
          <h2>Create a short link</h2>
          <p class="helper">The form below adds stronger client-side checks and more creation options for the assignment flow.</p>
          <form id="create-link-form" novalidate>
            <label class="field">
              <span>Target URL</span>
              <input id="target-url" name="url" type="url" placeholder="https://example.com/docs" required />
            </label>
            <label class="field">
              <span>Custom short code</span>
              <input id="custom-code" name="customCode" placeholder="team-docs" maxlength="24" />
            </label>
            <label class="field">
              <span>Expiration</span>
              <select id="expires-days" name="expiresInDays">
                <option value="">No expiration</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </label>
            <label class="field">
              <span>Tags</span>
              <input id="tags" name="tags" placeholder="internal, docs" />
            </label>
            <label class="field">
              <span>Idempotency key</span>
              <input id="idempotency-key" name="idempotencyKey" placeholder="request-001" />
            </label>
            <div class="actions">
              <button type="submit">Create link</button>
              <button type="button" class="secondary" id="fill-sample">Use sample values</button>
              <button type="button" id="health-check-button">Check health</button>
              <button type="button" class="secondary" id="refresh-links-button">Refresh links</button>
            </div>
          </form>
          <div id="create-errors" class="status error" hidden></div>
          <pre id="create-result" class="result">No request yet.</pre>
          <pre id="links-list" class="result">Loading links…</pre>
        </article>

        <article class="panel">
          <h2>Workflow checks</h2>
          <p class="helper">Choose a scenario and submit approval or input payloads to inspect policy gates and orchestration checks.</p>
          <label class="field">
            <span>Scenario</span>
            <select id="workflow-select" name="workflow-select">
              <option value="greenfield">Greenfield</option>
              <option value="brownfield">Brownfield</option>
              <option value="ambiguous">Ambiguous</option>
            </select>
          </label>
          <label class="field">
            <span>Workflow payload (JSON)</span>
            <textarea id="workflow-payload" name="workflowPayload">{
  "approvals": {
    "requirements": { "approved": true, "approver": "product" }
  }
}</textarea>
          </label>
          <div class="actions">
            <button
              type="button"
              id="run-workflow-button"
            >
              Run workflow
            </button>
          </div>
          <pre id="workflow-result" class="result">Run a scenario to inspect its policy checks.</pre>
        </article>
      </section>

      <section class="grid" style="margin-top: 20px;">
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

    <script>
      function initializeUi() {
        const createForm = document.getElementById('create-link-form');
        const createErrors = document.getElementById('create-errors');
        const createResult = document.getElementById('create-result');
        const linksList = document.getElementById('links-list');
        const fillSampleButton = document.getElementById('fill-sample');
        const healthButton = document.getElementById('health-check-button');
        const refreshLinksButton = document.getElementById('refresh-links-button');
        const workflowButton = document.getElementById('run-workflow-button');
        const workflowResult = document.getElementById('workflow-result');

        if (!createForm || !createErrors || !createResult || !linksList || !fillSampleButton || !healthButton || !refreshLinksButton || !workflowButton || !workflowResult) {
          return;
        }

        async function readResponseBody(response) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return response.json();
          }
          return response.text();
        }

        function setErrorBlock(element, message) {
          element.hidden = false;
          element.textContent = message;
        }

        async function refreshHealth() {
          try {
            const response = await fetch('/health');
            const body = await readResponseBody(response);
            createResult.textContent = JSON.stringify({ endpoint: '/health', status: response.status, body }, null, 2);
          } catch (error) {
            createResult.textContent = 'Health check failed: ' + error.message;
          }
        }

        async function refreshLinks() {
          try {
            const response = await fetch('/api/urls');
            const body = await readResponseBody(response);
            const records = Array.isArray(body?.data) ? body.data : [];
            linksList.textContent = JSON.stringify({ endpoint: '/api/urls', count: records.length, records }, null, 2);
          } catch (error) {
            linksList.textContent = 'Could not refresh links: ' + error.message;
          }
        }

        async function runWorkflow() {
          const scenario = document.getElementById('workflow-select').value;
          const payloadInput = document.getElementById('workflow-payload').value.trim();

          workflowResult.textContent = 'Sending workflow request…';

          let body = {};
          if (payloadInput) {
            try {
              body = JSON.parse(payloadInput);
            } catch (error) {
              workflowResult.textContent = 'Workflow payload must be valid JSON.\\n' + error.message;
              return;
            }
          }

          try {
            const response = await fetch('/api/workflows/' + scenario, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            const data = await readResponseBody(response);
            workflowResult.textContent = JSON.stringify({ status: response.status, data }, null, 2);
          } catch (error) {
            workflowResult.textContent = 'Workflow request failed: ' + error.message;
          }
        }

        fillSampleButton.addEventListener('click', () => {
          document.getElementById('target-url').value = 'https://example.com/docs';
          document.getElementById('custom-code').value = 'team-docs';
          document.getElementById('expires-days').value = '30';
          document.getElementById('tags').value = 'internal, docs';
          document.getElementById('idempotency-key').value = 'request-001';
        });

        createForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          createErrors.hidden = true;
          createErrors.textContent = '';

          const targetUrl = document.getElementById('target-url').value.trim();
          const customCode = document.getElementById('custom-code').value.trim();
          const expiresValue = document.getElementById('expires-days').value;
          const tagsValue = document.getElementById('tags').value.trim();
          const idempotencyKey = document.getElementById('idempotency-key').value.trim();

          const issues = [];

          if (!targetUrl) {
            issues.push('Target URL is required.');
          } else if (!/^https?:\\/\\//i.test(targetUrl)) {
            issues.push('Only http(s) URLs are supported.');
          }

          if (customCode && !/^[a-zA-Z0-9_-]{4,24}$/.test(customCode)) {
            issues.push('Custom code must be 4-24 letters, numbers, underscores, or dashes.');
          }

          if (issues.length > 0) {
            createErrors.hidden = false;
            createErrors.textContent = issues.join('\\n');
            return;
          }

          const payload = {
            url: targetUrl,
            customCode: customCode || undefined,
            expiresInDays: expiresValue ? Number(expiresValue) : undefined,
            tags: tagsValue ? tagsValue.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
            idempotencyKey: idempotencyKey || undefined
          };

          try {
            const response = await fetch('/api/urls', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await readResponseBody(response);
            if (!response.ok) {
              setErrorBlock(createErrors, JSON.stringify(data, null, 2));
              createResult.textContent = JSON.stringify({ status: response.status, payload, data }, null, 2);
              return;
            }
            createErrors.hidden = true;
            createErrors.textContent = '';
            createResult.textContent = JSON.stringify({ status: response.status, payload, data }, null, 2);
            await refreshHealth();
            await refreshLinks();
          } catch (error) {
            createResult.textContent = 'Request failed: ' + error.message;
          }
        });

        healthButton.addEventListener('click', () => {
          refreshHealth();
        });

        refreshLinksButton.addEventListener('click', () => {
          refreshLinks();
        });

        workflowButton.addEventListener('click', () => {
          runWorkflow();
        });

        refreshHealth();
        refreshLinks();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUi);
      } else {
        initializeUi();
      }
    </script>
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
  return getClientAddress(request);
}

function pruneRateLimitBuckets(now: number): void {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (now - bucket.windowStartedAt >= rateLimitWindowMs) {
      rateLimitBuckets.delete(key);
    }
  }
}

function applySecurityHeaders(response: Response): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

function enforceRateLimit(request: Request, response: Response, bucketName: string): boolean {
  const now = Date.now();
  pruneRateLimitBuckets(now);

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

  app.get('/favicon.ico', (_request, response) => {
    response.status(204).end();
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