import path from 'node:path';

export const config = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
  dataFilePath: process.env.DATA_FILE_PATH ?? path.resolve(process.cwd(), 'data', 'urls.json'),
  artifactsDir: process.env.ARTIFACTS_DIR ?? path.resolve(process.cwd(), 'artifacts', 'runs')
};