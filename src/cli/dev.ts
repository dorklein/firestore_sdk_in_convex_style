#!/usr/bin/env node

import { dirname, join } from "node:path";
import { existsSync, watch } from "node:fs";
import { doCodegen, doCodegenForNewProject } from "./lib/codegen.js";
import { oneoffContext } from "../bundler/context.js";
import { logFinishedStep, showSpinner, startLogProgress, stopSpinner } from "../bundler/log.js";

interface CodegenOptions {
  schemaPath: string;
  outputDir: string;
  dryRun?: boolean;
  debug?: boolean;
}

async function generateTypes(options: CodegenOptions): Promise<void> {
  const { schemaPath, outputDir } = options;
  startLogProgress("Generating types...", {
    total: 3,
  });

  // Create _generated directory if it doesn't exist
  const ctx = await oneoffContext({});
  const generatedDir = join(outputDir, "_generated");
  if (!existsSync(generatedDir)) {
    showSpinner("Creating new Firestore-Convex-Style project...");
    await doCodegenForNewProject(ctx);
    // mkdirSync(generatedDir, { recursive: true });
  }

  showSpinner("Generating types...");
  await doCodegen(ctx, outputDir, "try", options);

  stopSpinner();
  logFinishedStep("Generated types successfully");
  // // Generate dataModel.ts
  // const dataModelContent = dynamicDataModelDTS();
  // const prettierDataModelContent = await format(dataModelContent, {
  //   parser: "typescript",
  // });
  // writeFileSync(join(generatedDir, "dataModel.ts"), prettierDataModelContent);

  // // Generate server.d.ts and server.js
  // const { DTS: serverDTS, JS: serverJS } = serverCodegen();
  // const prettierServerDTS = await format(serverDTS, {
  //   parser: "typescript",
  // });
  // const prettierServerJS = await format(serverJS, {
  //   parser: "typescript",
  // });
  // writeFileSync(join(generatedDir, "server.d.ts"), prettierServerDTS);
  // writeFileSync(join(generatedDir, "server.js"), prettierServerJS);

  // // Scan for functions and actions
  // console.log("🔍 Scanning for functions and actions...");
  // const { functions, actions } = await scanFunctions(schemaPath);

  // console.log(`📋 Found ${functions.length} functions and ${actions.length} actions`);

  // // Generate api.d.ts and api.js
  // const { DTS: apiDTS, JS: apiJS } = apiCodegen(functions, actions);
  // const prettierApiDTS = await format(apiDTS, {
  //   parser: "typescript",
  // });
  // const prettierApiJS = await format(apiJS, {
  //   parser: "typescript",
  // });
  // writeFileSync(join(generatedDir, "api.d.ts"), prettierApiDTS);
  // writeFileSync(join(generatedDir, "api.js"), prettierApiJS);

  console.log(`✅ Generated types in ${generatedDir}`);
}

const defaultRootDirectory = join(process.cwd(), "firestore");
async function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes("--watch") || args.includes("-w");

  // Find schema file
  const possibleSchemaPaths = [join(defaultRootDirectory, "schema.ts")];

  // Allow specifying custom schema path
  const schemaArgIndex = args.indexOf("--schema");
  if (schemaArgIndex !== -1 && args[schemaArgIndex + 1]) {
    possibleSchemaPaths.unshift(join(process.cwd(), args[schemaArgIndex + 1]));
  }

  const schemaPath = possibleSchemaPaths.find((p) => existsSync(p));

  if (!schemaPath) {
    console.error("❌ Could not find schema.ts file.");
    console.error("   Looked in:");
    possibleSchemaPaths.forEach((p) => console.error(`   - ${p}`));
    console.error("\n   You can specify a custom path with --schema <path>");
    process.exit(1);
  }

  console.log(`📄 Found schema at ${schemaPath}`);

  const outputDir = dirname(schemaPath);

  try {
    if (watchMode) {
      console.log(`👀 Watching for changes to ${schemaPath}...`);

      // Initial generation
      await generateTypes({ schemaPath, outputDir });

      // Watch for file changes
      watch(schemaPath, async (eventType) => {
        if (eventType === "change") {
          console.log(`\n🔄 Schema changed, regenerating types...`);
          try {
            await generateTypes({ schemaPath, outputDir });
          } catch (error) {
            console.error("❌ Error regenerating types:", error);
          }
        }
      });

      // Keep the process running
      process.stdin.resume();
    } else {
      await generateTypes({ schemaPath, outputDir });
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
