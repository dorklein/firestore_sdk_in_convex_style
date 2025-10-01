#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import { serverCodegen } from "./codegen_templates/server.ts";
import { dynamicDataModelDTS } from "./codegen_templates/dataModel.ts";
import prettier from "prettier";

interface CodegenOptions {
  schemaPath: string;
  outputDir: string;
}

async function generateTypes(options: CodegenOptions): Promise<void> {
  const { schemaPath, outputDir } = options;

  // Create _generated directory if it doesn't exist
  const generatedDir = path.join(outputDir, "_generated");
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  // Generate schema.ts (re-export the schema for code generation)
  // const schemaContent = generateSchemaFile(schemaPath, outputDir);
  // fs.writeFileSync(path.join(generatedDir, "schema.ts"), schemaContent);

  // Generate dataModel.ts
  // const dataModelContent = generateDataModelFile(outputDir);
  const dataModelContent = dynamicDataModelDTS();
  const prettierDataModelContent = await prettier.format(dataModelContent, {
    parser: "typescript",
  });
  fs.writeFileSync(path.join(generatedDir, "dataModel.ts"), prettierDataModelContent);

  // Generate server.ts (contains query/mutation builders)
  const { DTS: serverDTS, JS: serverJS } = serverCodegen();
  // const serverContent = generateServerFile(outputDir);
  const prettierServerDTS = await prettier.format(serverDTS, {
    parser: "typescript",
  });
  const prettierServerJS = await prettier.format(serverJS, {
    parser: "typescript",
  });
  fs.writeFileSync(path.join(generatedDir, "server.d.ts"), prettierServerDTS);
  fs.writeFileSync(path.join(generatedDir, "server.js"), prettierServerJS);

  console.log(`✅ Generated types in ${generatedDir}`);
}

const defaultRootDirectory = path.join(process.cwd(), "examples");
async function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes("--watch") || args.includes("-w");

  // Find schema file
  const possibleSchemaPaths = [
    path.join(defaultRootDirectory, "schema.ts"),
    // path.join(process.cwd(), "src", "schema.ts"),
    // path.join(process.cwd(), "schema.ts"),
    // path.join(process.cwd(), "convex", "schema.ts"),
  ];

  // Allow specifying custom schema path
  const schemaArgIndex = args.indexOf("--schema");
  if (schemaArgIndex !== -1 && args[schemaArgIndex + 1]) {
    possibleSchemaPaths.unshift(path.join(process.cwd(), args[schemaArgIndex + 1]));
  }

  const schemaPath = possibleSchemaPaths.find((p) => fs.existsSync(p));

  if (!schemaPath) {
    console.error("❌ Could not find schema.ts file.");
    console.error("   Looked in:");
    possibleSchemaPaths.forEach((p) => console.error(`   - ${p}`));
    console.error("\n   You can specify a custom path with --schema <path>");
    process.exit(1);
  }

  console.log(`📄 Found schema at ${schemaPath}`);

  const outputDir = path.dirname(schemaPath);

  try {
    if (watchMode) {
      console.log(`👀 Watching for changes to ${schemaPath}...`);

      // Initial generation
      await generateTypes({ schemaPath, outputDir });

      // Watch for file changes
      fs.watch(schemaPath, async (eventType) => {
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
