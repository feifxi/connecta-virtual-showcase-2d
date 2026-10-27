// Runs the Next CLI with the repo-root .env loaded (existing env vars win, so containers/CI override it)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const file = new URL('../../../.env', import.meta.url);
if (existsSync(file)) process.loadEnvFile(file);

const bin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
child.on('exit', (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
