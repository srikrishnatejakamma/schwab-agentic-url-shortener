import path from 'node:path';

function parsePort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT value '${value}'.`);
  }

  return parsed;
}

function parseBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid BASE_URL value '${value}'.`);
  }

  return url.toString().replace(/\/$/, '');
}

export const config = {
  port: parsePort(process.env.PORT ?? '3000'),
  baseUrl: parseBaseUrl(process.env.BASE_URL ?? 'http://localhost:3000'),
  dataFilePath: process.env.DATA_FILE_PATH ?? path.resolve(process.cwd(), 'data', 'urls.json'),
  artifactsDir: process.env.ARTIFACTS_DIR ?? path.resolve(process.cwd(), 'artifacts', 'runs')
};