import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const roots = ['js', 'scripts', 'sync-worker/src', 'buenaventura-proxy/src'];

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : entry.name.endsWith('.js') ? [path] : [];
  });
}

const files = [...roots.flatMap(javascriptFiles), 'service-worker.js'];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
