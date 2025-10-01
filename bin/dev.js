#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the path to the dev.ts file
const devScriptPath = join(__dirname, '..', 'src', 'cli', 'dev.ts');

// Check if tsx is available locally first, then fall back to npx
const localTsxPath = join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const tsxCommand = existsSync(localTsxPath) ? localTsxPath : 'npx';
const tsxArgs = existsSync(localTsxPath) ? [devScriptPath, ...process.argv.slice(2)] : ['tsx', devScriptPath, ...process.argv.slice(2)];

// For JSR packages, we need to handle the case where tsx might not be available
// Try to run the script directly with node if tsx is not available
if (!existsSync(localTsxPath)) {
  console.log('Note: tsx not found locally. Installing tsx globally or using npx...');
  console.log('You can install it with: npm install -g tsx');
}

// Spawn the TypeScript file using tsx
const child = spawn(tsxCommand, tsxArgs, {
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: true // Use shell to handle npx properly
});

child.on('error', (error) => {
  console.error('Error running dev command:', error);
  console.error('Make sure tsx is installed. You can install it with: npm install -g tsx');
  console.error('Or try running: npx tsx', devScriptPath, ...process.argv.slice(2));
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
