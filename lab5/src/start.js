import { spawn } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectAll, DATA_FILE } from './collect.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const children = [];

function run(name, script, env = {}) {
  const child = spawn(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  child.on('exit', (code) => {
    console.error(`[${name}] exited with code ${code}`);
    shutdown(code || 1);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (!fs.existsSync(DATA_FILE)) {
  console.log('catalog.json missing — collecting…');
  await collectAll();
}

run('items', path.join('src', 'subgraphs', 'items.js'));
run('authors', path.join('src', 'subgraphs', 'authors.js'));
run('ops', path.join('src', 'subgraphs', 'ops.js'));

await new Promise((r) => setTimeout(r, 800));
run('gateway', path.join('src', 'gateway.js'));
