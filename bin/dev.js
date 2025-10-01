#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the path to the built CLI
const builtCLIPath = join(__dirname, '..', 'dist', 'cli', 'dev.js');

// Check if the built CLI exists, if not, try to build it
if (!existsSync(builtCLIPath)) {
  console.log('🔨 Built CLI not found. Building CLI...');
  
  const { execSync } = await import('child_process');
  try {
    execSync('pnpm run build:cli', { stdio: 'inherit', cwd: join(__dirname, '..') });
    console.log('✅ CLI built successfully!');
  } catch (error) {
    console.error('❌ Failed to build CLI:', error.message);
    console.error('Please run: pnpm run build:cli');
    process.exit(1);
  }
}

// Spawn the built CLI
const child = spawn('node', [builtCLIPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('error', (error) => {
  console.error('Error running CLI:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
