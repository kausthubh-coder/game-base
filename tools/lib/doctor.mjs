import { basename } from 'node:path';
import { createServer } from 'node:net';

export function portForFolder(folder, main = false) {
  if (main) return 5300;
  let hash = 2166136261;
  for (const char of basename(folder)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return 5400 + hash % 600;
}

export function formatResults(items, json = false) {
  return json ? JSON.stringify(items, null, 2) : items.map(({ status, item, reason }) => `${status} ${item}: ${reason}`).join('\n');
}

export async function portIsFree(port) {
  for (const host of ['127.0.0.1', '::1']) {
    const free = await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', (error) => {
        if (error.code === 'EADDRINUSE') resolve(false);
        else if (host === '::1' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) resolve(true);
        else reject(error);
      });
      server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
    });
    if (!free) return false;
  }
  return true;
}

export async function availablePort(start, main = false, isFree = portIsFree) {
  const count = main ? 1 : 600;
  for (let offset = 0; offset < count; offset++) {
    const port = main ? 5300 : 5400 + (start - 5400 + offset) % 600;
    if (await isFree(port)) return port;
  }
  throw new Error(main ? '5300 is occupied; stop only your own server by PID' : 'no free port in 5400..5999');
}
