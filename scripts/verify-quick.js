import { spawnSync } from 'node:child_process';

const MODULE_TESTS = Object.freeze({
  projects: 'tests/projects.test.js',
  sources: 'tests/sources.test.js',
  rubrics: 'tests/rubrics.test.js',
  evidence: 'tests/evidence.test.js',
  reports: 'tests/reports.test.js',
  presentations: 'tests/presentations.test.js',
  ux: 'tests/ux.test.js',
  closure1: 'tests/seams.test.js',
  closure3: 'tests/buenaventura-contracts.test.js',
  closure4: [
    'tests/buenaventura-cloudflare-config.test.js',
    'tests/buenaventura-gemini-provider.test.js',
    'tests/buenaventura-proxy.test.js'
  ],
  closure5: [
    'tests/buenaventura-relationship.test.js',
    'tests/buenaventura-relationship-store.test.js',
    'tests/buenaventura-ui.test.js',
    'tests/buenaventura-gemini-provider.test.js',
    'tests/buenaventura-proxy.test.js',
    'tests/db.test.js'
  ]
});

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

const requested = process.argv[2] || 'evidence';
const moduleTest = MODULE_TESTS[requested];
if (!moduleTest) {
  console.error(
    `Módulo desconocido: ${requested}. Usa: ${Object.keys(MODULE_TESTS).join(', ')}.`
  );
  process.exit(2);
}

const npmCli = process.env.npm_execpath;
if (!npmCli) process.exit(2);
console.log(`Verificación rápida focalizada: ${requested}`);
run(process.execPath, [npmCli, 'run', 'check']);
run(process.execPath, [
  '--test',
  'tests/academic-contracts.test.js',
  'tests/resources.test.js',
  ...(Array.isArray(moduleTest) ? moduleTest : [moduleTest])
]);
run(process.execPath, [npmCli, 'run', 'limits']);
