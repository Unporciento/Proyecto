import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portable = path => normalize(path).replaceAll('\\', '/');

function files(directory, extension) {
  return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path, extension) : path.endsWith(extension) ? [path] : [];
  });
}

function localImports(file) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const pattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  return [...source.matchAll(pattern)]
    .map(match => match[1])
    .filter(specifier => specifier.startsWith('.'))
    .map(specifier => {
      const target = portable(relative(ROOT, resolve(ROOT, dirname(file), specifier)));
      return target.endsWith('.js') ? target : `${target}.js`;
    });
}

function indexResources() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  return {
    scripts: [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)]
      .map(match => portable(match[1].replace(/^\.\//, ''))),
    styles: [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)]
      .map(match => portable(match[1].replace(/^\.\//, '')))
  };
}

function serviceWorkerShell() {
  const source = readFileSync(join(ROOT, 'service-worker.js'), 'utf8');
  return new Set([...source.matchAll(/['"]\.\/([^'"]+)['"]/g)].map(match => portable(match[1])));
}

export function auditConnections() {
  const modules = files('js', '.js').map(portable);
  const graph = new Map(modules.map(file => [file, localImports(file)]));
  const resources = indexResources();
  const reachable = new Set();
  const pending = [...resources.scripts];
  while (pending.length) {
    const file = pending.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    pending.push(...(graph.get(file) || []));
  }
  const shell = serviceWorkerShell();
  return {
    entries: resources.scripts,
    moduleCount: modules.length,
    reachableCount: reachable.size,
    unreachable: modules.filter(file => !reachable.has(file)).sort(),
    shellMissingScripts: [...reachable].filter(file => !shell.has(file)).sort(),
    shellMissingStyles: resources.styles.filter(file => !shell.has(file)).sort()
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(auditConnections(), null, 2));
}
