import { spawnSync } from 'node:child_process';
import { readJson, writeJson } from './utils.mjs';

run('npm run content:qa');
run('npm run build');
await updateStateAfterPublish();
run('npm run content:index:latest');

console.log('Content publish checks passed. Output is ready in dist/.');

function run(command) {
  const result = spawnSync(command, { stdio: 'inherit', shell: true });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function updateStateAfterPublish() {
  const state = await readJson('content-engine/state.json');
  state.generated = state.generated.map(item => ({
    ...item,
    qaStatus: 'passed',
    publishStatus: 'publish-ready',
  }));
  state.lastPublishCheck = new Date().toISOString();
  await writeJson('content-engine/state.json', state);
}
