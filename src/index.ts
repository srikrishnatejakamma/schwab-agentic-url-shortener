import { createServer } from 'node:http';

import { createApp } from './app.js';
import { config } from './config.js';
import { UrlShortenerService } from './domain/urlShortenerService.js';
import { FileUrlRepository } from './storage/fileUrlRepository.js';

function deriveBaseUrl(port: number): string {
  const url = new URL(config.baseUrl);
  url.port = String(port);
  return url.toString().replace(/\/$/, '');
}

function listenOnAvailablePort(server: ReturnType<typeof createServer>, initialPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const attemptListen = (port: number) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off('error', onError);

        if (error.code === 'EADDRINUSE' && port < initialPort + 20) {
          attemptListen(port + 1);
          return;
        }

        reject(error);
      };

      server.once('error', onError);
      server.listen(port, () => {
        server.off('error', onError);
        const serverAddress = server.address();
        if (typeof serverAddress === 'object' && serverAddress && 'port' in serverAddress) {
          resolve(serverAddress.port);
          return;
        }

        resolve(port);
      });
    };

    attemptListen(initialPort);
  });
}

async function start(): Promise<void> {
  const repository = new FileUrlRepository(config.dataFilePath);
  const app = createApp(new UrlShortenerService(repository, deriveBaseUrl(config.port)));
  const server = createServer(app);

  const actualPort = await listenOnAvailablePort(server, config.port);

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`${signal} received, shutting down server...`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  console.log(`URL shortener listening on ${deriveBaseUrl(actualPort)}`);
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});