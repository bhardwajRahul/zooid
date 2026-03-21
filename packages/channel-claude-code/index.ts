#!/usr/bin/env node
import { createServer } from './src/server.js';
import { loadConfig } from './src/config.js';

const config = loadConfig();
const { start } = await createServer(config);
await start();
