import path from "path";
import prettier from "prettier";
import { withTmpDir, TempDir } from "../../bundler/fs.js";
import { entryPoints, getExportedConvexFunctions } from "../../bundler/index.js";
import { apiCodegen, apiRegistryCodegen } from "../codegen_templates/api.js";
import { dynamicDataModelDTS, noSchemaDataModelDTS } from "../codegen_templates/dataModel.js";
import { readmeCodegen } from "../codegen_templates/readme.js";
import { serverCodegen } from "../codegen_templates/server.js";
import { tsconfigCodegen } from "../codegen_templates/tsconfig.js";
import { Context } from "../../bundler/context.js";
import { logOutput, logVerbose } from "../../bundler/log.js";
import { typeCheckFunctionsInMode, TypeCheckMode } from "./typecheck.js";
import { configFilepath, readProjectConfig } from "./config.js";
import { recursivelyDelete } from "./fsUtils.js";
import { functionsDir } from "./utils/utils.js";

export type CodegenOptions = {
  url?: string | undefined;
  adminKey?: string | undefined;
  dryRun: boolean;
  debug: boolean;
  typecheck: TypeCheckMode;
  init: boolean;
  commonjs: boolean;
  liveComponentSources: boolean;
  debugNodeApis: boolean;
};

export async function doCodegenForNewProject(ctx: Context) {
  const { projectConfig: existingProjectConfig } = await readProjectConfig(ctx);
  const configPath = await configFilepath(ctx);
  const functionsPath = functionsDir(configPath, existingProjectConfig);
  await doInitCodegen(ctx, functionsPath, true);
  // Disable typechecking since there isn't any code yet.
  await doCodegen(ctx, functionsPath, "disable");
}

export async function doInitCodegen(
  ctx: Context,
  functionsDir: string,
  skipIfExists: boolean,
  opts?: { dryRun?: boolean; debug?: boolean }
): Promise<void> {
  await prepareForCodegen(ctx, functionsDir);
  await withTmpDir(async (tmpDir) => {
    await doReadmeCodegen(ctx, tmpDir, functionsDir, skipIfExists, opts);
    await doTsconfigCodegen(ctx, tmpDir, functionsDir, skipIfExists, opts);
  });
}

async function prepareForCodegen(ctx: Context, functionsDir: string) {
  // Create the codegen dir if it doesn't already exist.
  const codegenDir = path.join(functionsDir, "_generated");
  ctx.fs.mkdir(codegenDir, { allowExisting: true, recursive: true });
  return codegenDir;
}

export async function doCodegen(
  ctx: Context,
  functionsDir: string,
  typeCheckMode: TypeCheckMode,
  opts?: { dryRun?: boolean; debug?: boolean }
) {
  const codegenDir = await prepareForCodegen(ctx, functionsDir);

  await withTmpDir(async (tmpDir) => {
    // Write files in dependency order so a watching dev server doesn't
    // see inconsistent results where a file we write imports from a
    // file that doesn't exist yet. We'll collect all the paths we write
    // and then delete any remaining paths at the end.
    const writtenFiles = [];

    // First, `dataModel.d.ts` imports from the developer's `schema.js` file.
    const schemaFiles = await doDataModelCodegen(ctx, tmpDir, functionsDir, codegenDir, opts);
    writtenFiles.push(...schemaFiles);

    // Next, the `server.d.ts` file imports from `dataModel.d.ts`.
    const serverFiles = await doServerCodegen(ctx, tmpDir, codegenDir, opts);
    writtenFiles.push(...serverFiles);

    // The `api.d.ts` file imports from the developer's modules, which then
    // import from `server.d.ts`. Note that there's a cycle here, since the
    // developer's modules could also import from the `api.{js,d.ts}` files.
    const apiFiles = await doApiCodegen(ctx, tmpDir, functionsDir, codegenDir, opts);
    writtenFiles.push(...apiFiles);

    // Cleanup any files that weren't written in this run.
    for (const file of ctx.fs.listDir(codegenDir)) {
      if (!writtenFiles.includes(file.name)) {
        recursivelyDelete(ctx, path.join(codegenDir, file.name), opts);
      }
    }

    // Generated code is updated, typecheck the query and mutation functions.
    await typeCheckFunctionsInMode(ctx, typeCheckMode, functionsDir);
  });
}

async function doReadmeCodegen(
  ctx: Context,
  tmpDir: TempDir,
  functionsDir: string,
  skipIfExists: boolean,
  opts?: { dryRun?: boolean; debug?: boolean }
) {
  const readmePath = path.join(functionsDir, "README.md");
  if (skipIfExists && ctx.fs.exists(readmePath)) {
    logVerbose(`Not overwriting README.md.`);
    return;
  }
  await writeFormattedFile(ctx, tmpDir, readmeCodegen(), "markdown", readmePath, opts);
}

async function doTsconfigCodegen(
  ctx: Context,
  tmpDir: TempDir,
  functionsDir: string,
  skipIfExists: boolean,
  opts?: { dryRun?: boolean; debug?: boolean }
) {
  const tsconfigPath = path.join(functionsDir, "tsconfig.json");
  if (skipIfExists && ctx.fs.exists(tsconfigPath)) {
    logVerbose(`Not overwriting tsconfig.json.`);
    return;
  }
  await writeFormattedFile(ctx, tmpDir, tsconfigCodegen(), "json", tsconfigPath, opts);
}

function schemaFileExists(ctx: Context, functionsDir: string) {
  let schemaPath = path.join(functionsDir, "schema.ts");
  let hasSchemaFile = ctx.fs.exists(schemaPath);
  if (!hasSchemaFile) {
    schemaPath = path.join(functionsDir, "schema.js");
    hasSchemaFile = ctx.fs.exists(schemaPath);
  }
  return hasSchemaFile;
}

async function doDataModelCodegen(
  ctx: Context,
  tmpDir: TempDir,
  functionsDir: string,
  codegenDir: string,
  opts?: { dryRun?: boolean; debug?: boolean }
) {
  const hasSchemaFile = schemaFileExists(ctx, functionsDir);
  const schemaContent = hasSchemaFile ? dynamicDataModelDTS() : noSchemaDataModelDTS();

  await writeFormattedFile(
    ctx,
    tmpDir,
    schemaContent,
    "typescript",
    path.join(codegenDir, "dataModel.d.ts"),
    opts
  );
  return ["dataModel.d.ts"];
}

async function doServerCodegen(
  ctx: Context,
  tmpDir: TempDir,
  codegenDir: string,
  opts?: { dryRun?: boolean; debug?: boolean }
) {
  const serverContent = serverCodegen();
  await writeFormattedFile(
    ctx,
    tmpDir,
    serverContent.JS,
    "typescript",
    path.join(codegenDir, "server.js"),
    opts
  );

  await writeFormattedFile(
    ctx,
    tmpDir,
    serverContent.DTS,
    "typescript",
    path.join(codegenDir, "server.d.ts"),
    opts
  );

  return ["server.js", "server.d.ts"];
}

async function doApiCodegen(
  ctx: Context,
  tmpDir: TempDir,
  functionsDir: string,
  codegenDir: string,
  opts?: { dryRun?: boolean; debug?: boolean }
) {
  const absModulePaths = await entryPoints(ctx, functionsDir);
  const modulePaths = absModulePaths.map((p) => path.relative(functionsDir, p));

  const apiContent = apiCodegen(modulePaths);
  await writeFormattedFile(
    ctx,
    tmpDir,
    apiContent.JS,
    "typescript",
    path.join(codegenDir, "api.js"),
    opts
  );
  await writeFormattedFile(
    ctx,
    tmpDir,
    apiContent.DTS,
    "typescript",
    path.join(codegenDir, "api.d.ts"),
    opts
  );

  const functionNames = await getExportedConvexFunctions(ctx, functionsDir);
  const apiRegistryContent = apiRegistryCodegen(modulePaths, functionNames);
  await writeFormattedFile(
    ctx,
    tmpDir,
    apiRegistryContent,
    "typescript",
    path.join(codegenDir, "apiRegistry.ts"),
    opts
  );
  const writtenFiles = ["api.js", "api.d.ts", "apiRegistry.ts"];

  return writtenFiles;
}

async function writeFormattedFile(
  ctx: Context,
  tmpDir: TempDir,
  contents: string,
  filetype: string,
  destination: string,
  options?: {
    dryRun?: boolean;
    debug?: boolean;
  }
) {
  // Run prettier so we don't have to think about formatting!
  //
  // This is a little sketchy because we are using the default prettier config
  // (not our user's one) but it's better than nothing.
  const formattedContents = await prettier.format(contents, {
    parser: filetype,
    pluginSearchDirs: false,
  });
  if (options?.debug) {
    // NB: The `test_codegen_projects_are_up_to_date` smoke test depends
    // on this output format.
    logOutput(`# ${path.resolve(destination)}`);
    logOutput(formattedContents);
    return;
  }
  try {
    const existing = ctx.fs.readUtf8File(destination);
    if (existing === formattedContents) {
      return;
    }
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      // eslint-disable-next-line no-restricted-syntax
      throw err;
    }
  }
  if (options?.dryRun) {
    logOutput(`Command would write file: ${destination}`);
    return;
  }
  const tmpPath = tmpDir.writeUtf8File(formattedContents);
  ctx.fs.swapTmpFile(tmpPath, destination);
}
