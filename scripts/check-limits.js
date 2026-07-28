import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const extensions = new Set([
  '.js', '.css', '.md', '.html', '.json', '.jsonc', '.sql', '.webmanifest'
]);
const ignored = new Set(['.git', 'node_modules']);

function extension(path) {
  const name = path.split(/[\\/]/).at(-1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot);
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return extensions.has(extension(path)) ? [path] : [];
  });
}

let failed = false;
for (const file of files('.')) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).length;
  if (lines > 400) {
    console.error(`${file} supera 400 líneas (${lines})`);
    failed = true;
  }
}
if (failed) process.exit(1);
