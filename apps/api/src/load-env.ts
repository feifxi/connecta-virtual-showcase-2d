// Dev: read the repo-root .env before anything reads process.env (prod gets env from docker compose)
import { existsSync } from 'node:fs';

const file = new URL('../../../.env', import.meta.url);
if (existsSync(file)) process.loadEnvFile(file);
