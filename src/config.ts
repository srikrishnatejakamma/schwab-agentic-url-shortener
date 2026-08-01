import path from 'node:path';

const DEFAULT_PORT = '3000';
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_DATA_FILE_PATH = path.resolve(process.cwd(), 'data', 'urls.json');
const DEFAULT_ARTIFACTS_DIR = path.resolve(process.cwd(), 'artifacts', 'runs');

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
  port: parsePort(process.env.PORT ?? DEFAULT_PORT),
  baseUrl: parseBaseUrl(process.env.BASE_URL ?? DEFAULT_BASE_URL),
  dataFilePath: process.env.DATA_FILE_PATH ?? DEFAULT_DATA_FILE_PATH,
  artifactsDir: process.env.ARTIFACTS_DIR ?? DEFAULT_ARTIFACTS_DIR
};