import { build } from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.argv.includes('--watch');

const buildConfig = {
  entryPoints: [join(__dirname, 'src', 'cli', 'dev.ts')],
  bundle: true,
  outfile: join(__dirname, 'dist', 'cli', 'dev.js'),
  platform: 'node',
  target: 'node18',
  format: 'esm',
  external: [
    // Keep these as external dependencies
    'firebase-admin',
    'valibot',
    'prettier'
  ],
  sourcemap: isDev,
  minify: !isDev,
  logLevel: 'info'
};

async function buildCLI() {
  try {
    if (isDev) {
      console.log('🔨 Building CLI in watch mode...');
      const context = await build.context(buildConfig);
      await context.watch();
      console.log('👀 Watching for changes...');
    } else {
      console.log('🔨 Building CLI...');
      await build(buildConfig);
      
      // Ensure the built file has a proper shebang
      const outputPath = buildConfig.outfile;
      const content = readFileSync(outputPath, 'utf8');
      
      // Check if shebang already exists and fix it if needed
      let finalContent = content;
      if (content.startsWith('#!/usr/bin/env node')) {
        // Replace the existing shebang with a proper one
        finalContent = '#!/usr/bin/env node\n' + content.substring('#!/usr/bin/env node'.length);
      } else if (!content.startsWith('#!/usr/bin/env node')) {
        // Add shebang if it doesn't exist
        finalContent = '#!/usr/bin/env node\n' + content;
      }
      
      writeFileSync(outputPath, finalContent);
      
      console.log('✅ CLI built successfully!');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildCLI();
