import path from "path";
import chalk from "chalk";
import { pathToFileURL } from "url";

import { Filesystem, consistentPathSort } from "./fs.js";
import { Context } from "./context.js";
import { logVerbose, logWarning } from "./log.js";
import { AnyFunctionReference } from "../server/api.js";
import { RegisteredAction, RegisteredMutation, RegisteredQuery } from "../server/registration.js";
export { nodeFs, RecordingFs } from "./fs.js";
export type { Filesystem } from "./fs.js";

export const actionsDir = "actions";

// Returns a generator of { isDir, path, depth } for all paths
// within dirPath in some topological order (not including
// dirPath itself).
export function* walkDir(
  fs: Filesystem,
  dirPath: string,
  depth?: number
): Generator<{ isDir: boolean; path: string; depth: number }, void, void> {
  depth = depth ?? 0;
  for (const dirEntry of fs.listDir(dirPath).sort(consistentPathSort)) {
    const childPath = path.join(dirPath, dirEntry.name);
    if (dirEntry.isDirectory()) {
      yield { isDir: true, path: childPath, depth };
      yield* walkDir(fs, childPath, depth + 1);
    } else if (dirEntry.isFile()) {
      yield { isDir: false, path: childPath, depth };
    }
  }
}

const ENTRY_POINT_EXTENSIONS = [
  // ESBuild js loader
  ".js",
  ".mjs",
  ".cjs",
  // ESBuild ts loader
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  // ESBuild jsx loader
  ".jsx",
  // ESBuild supports css, text, json, and more but these file types are not
  // allowed to define entry points.
];

export async function entryPoints(ctx: Context, dir: string): Promise<string[]> {
  const entryPoints = [];

  for (const { isDir, path: fpath, depth } of walkDir(ctx.fs, dir)) {
    if (isDir) {
      continue;
    }
    const relPath = path.relative(dir, fpath);
    const parsedPath = path.parse(fpath);
    const base = parsedPath.base;

    if (relPath.startsWith("_deps" + path.sep)) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `The path "${fpath}" is within the "_deps" directory, which is reserved for dependencies. Please move your code to another directory.`,
      });
    }

    if (depth === 0 && base.toLowerCase().startsWith("https.")) {
      //   const source = ctx.fs.readUtf8File(fpath);
      //   if (await doesImportConvexHttpRouter(source))
      //     logWarning(
      //       chalk.yellow(
      //         `Found ${fpath}. HTTP action routes will not be imported from this file. Did you mean to include http${extension}?`
      //       )
      //     );
      //   Sentry.captureMessage(
      //     `User code top level directory contains file ${base} which imports httpRouter.`,
      //     "warning"
      //   );
      logWarning(
        `User code top level directory contains file ${base} which imports httpRouter.`,
        "warning"
      );
    }

    // This should match isEntryPoint in the convex eslint plugin.
    if (!ENTRY_POINT_EXTENSIONS.some((ext) => relPath.endsWith(ext))) {
      logVerbose(chalk.yellow(`Skipping non-JS file ${fpath}`));
    } else if (relPath.startsWith("_generated" + path.sep)) {
      logVerbose(chalk.yellow(`Skipping ${fpath}`));
    } else if (base.startsWith(".")) {
      logVerbose(chalk.yellow(`Skipping dotfile ${fpath}`));
    } else if (base.startsWith("#")) {
      logVerbose(chalk.yellow(`Skipping likely emacs tempfile ${fpath}`));
    } else if (base === "schema.ts" || base === "schema.js") {
      logVerbose(chalk.yellow(`Skipping ${fpath}`));
    } else if ((base.match(/\./g) || []).length > 1) {
      // `auth.config.ts` and `convex.config.ts` are important not to bundle.
      // `*.test.ts` `*.spec.ts` are common in developer code.
      logVerbose(chalk.yellow(`Skipping ${fpath} that contains multiple dots`));
    } else if (relPath.includes(" ")) {
      logVerbose(chalk.yellow(`Skipping ${relPath} because it contains a space`));
    } else {
      logVerbose(chalk.green(`Preparing ${fpath}`));
      entryPoints.push(fpath);
    }
  }

  // If using TypeScript, require that at least one line starts with `export` or `import`,
  // a TypeScript requirement. This prevents confusing type errors from empty .ts files.
  const nonEmptyEntryPoints = entryPoints.filter((fpath) => {
    // This check only makes sense for TypeScript files
    if (!fpath.endsWith(".ts") && !fpath.endsWith(".tsx")) {
      return true;
    }
    const contents = ctx.fs.readUtf8File(fpath);
    if (/^\s{0,100}(import|export)/m.test(contents)) {
      return true;
    }
    logVerbose(
      chalk.yellow(
        `Skipping ${fpath} because it has no export or import to make it a valid TypeScript module`
      )
    );
    return false;
  });

  return nonEmptyEntryPoints;
}

// A fallback regex in case we fail to parse the AST.
export const useNodeDirectiveRegex = /^\s*("|')use node("|');?\s*$/;

// function hasUseNodeDirective(ctx: Context, fpath: string): boolean {
//   // Do a quick check for the exact string. If it doesn't exist, don't
//   // bother parsing.
//   const source = ctx.fs.readUtf8File(fpath);
//   if (source.indexOf("use node") === -1) {
//     return false;
//   }

//   // We parse the AST here to extract the "use node" declaration. This is more
//   // robust than doing a regex. We only use regex as a fallback.
//   try {
//     const ast = parseAST(source, {
//       // parse in strict mode and allow module declarations
//       sourceType: "module",

//       // esbuild supports jsx and typescript by default. Allow the same plugins
//       // here too.
//       plugins: ["jsx", "typescript"],
//     });
//     return ast.program.directives.map((d) => d.value.value).includes("use node");
//   } catch (error: any) {
//     // Given that we have failed to parse, we are most likely going to fail in
//     // the esbuild step, which seem to return better formatted error messages.
//     // We don't throw here and fallback to regex.
//     let lineMatches = false;
//     for (const line of source.split("\n")) {
//       if (line.match(useNodeDirectiveRegex)) {
//         lineMatches = true;
//         break;
//       }
//     }

//     // Log that we failed to parse in verbose node if we need this for debugging.
//     logVerbose(
//       `Failed to parse ${fpath}. Use node is set to ${lineMatches} based on regex. Parse error: ${error.toString()}.`
//     );

//     return lineMatches;
//   }
// }

export function mustBeIsolate(relPath: string): boolean {
  // Check if the path without extension matches any of the static paths.
  return ["http", "crons", "schema", "auth.config"].includes(relPath.replace(/\.[^/.]+$/, ""));
}

// async function determineEnvironment(
//   ctx: Context,
//   dir: string,
//   fpath: string
// ): Promise<ModuleEnvironment> {
//   const relPath = path.relative(dir, fpath);

//   const useNodeDirectiveFound = hasUseNodeDirective(ctx, fpath);
//   if (useNodeDirectiveFound) {
//     if (mustBeIsolate(relPath)) {
//       return await ctx.crash({
//         exitCode: 1,
//         errorType: "invalid filesystem data",
//         printedMessage: `"use node" directive is not allowed for ${relPath}.`,
//       });
//     }
//     return "node";
//   }

//   const actionsPrefix = actionsDir + path.sep;
//   if (relPath.startsWith(actionsPrefix)) {
//     return await ctx.crash({
//       exitCode: 1,
//       errorType: "invalid filesystem data",
//       printedMessage: `${relPath} is in /actions subfolder but has no "use node"; directive. You can now define actions in any folder and indicate they should run in node by adding "use node" directive. /actions is a deprecated way to choose Node.js environment, and we require "use node" for all files within that folder to avoid unexpected errors during the migration. See https://docs.convex.dev/functions/actions for more details`,
//     });
//   }

//   return "isolate";
// }

// export async function entryPointsByEnvironment(ctx: Context, dir: string) {
//   const isolate = [];
//   const node = [];
//   for (const entryPoint of await entryPoints(ctx, dir)) {
//     const environment = await determineEnvironment(ctx, dir, entryPoint);
//     if (environment === "node") {
//       node.push(entryPoint);
//     } else {
//       isolate.push(entryPoint);
//     }
//   }

//   return { isolate, node };
// }
type RegisteredConvexFunction =
  | RegisteredQuery<"public" | "internal", any, any>
  | RegisteredMutation<"public" | "internal", any, any>
  | RegisteredAction<"public" | "internal", any, any>;

export async function getExportedConvexFunctions(
  ctx: Context,
  dir: string
): Promise<Map<string, string[]>> {
  const absModulePaths = await entryPoints(ctx, dir);
  const functionNames: Map<string, string[]> = new Map();
  console.log("absModulePaths", absModulePaths);

  for (const modulePath of absModulePaths) {
    try {
      const module = await loadModule(modulePath);
      console.log("modulePath", modulePath);
      console.log("module", module);
      throw new Error("test");
      const moduleExports = extractConvexFunctionNames(module, modulePath, dir);
      functionNames.set(modulePath, moduleExports);
    } catch (error) {
      logVerbose(chalk.yellow(`Failed to load module ${modulePath}: ${error}`));
    }
  }

  return functionNames;
}

export async function getExportedFunctionRefs(
  ctx: Context,
  dir: string
): Promise<AnyFunctionReference[]> {
  const absModulePaths = await entryPoints(ctx, dir);
  const functionRefs: AnyFunctionReference[] = [];

  for (const modulePath of absModulePaths) {
    try {
      const module = await loadModule(modulePath);
      const moduleFunctionRefs = extractFunctionReferences(module, modulePath, dir);
      functionRefs.push(...moduleFunctionRefs);
    } catch (error) {
      logVerbose(chalk.yellow(`Failed to load module ${modulePath}: ${error}`));
    }
  }

  return functionRefs;
}

export async function getExportedRegisteredConvexFunctions(
  ctx: Context,
  dir: string
): Promise<RegisteredConvexFunction[]> {
  const absModulePaths = await entryPoints(ctx, dir);
  const registeredFunctions: RegisteredConvexFunction[] = [];

  for (const modulePath of absModulePaths) {
    try {
      const module = await loadModule(modulePath);
      const moduleRegisteredFunctions = extractRegisteredConvexFunctions(module);
      registeredFunctions.push(...moduleRegisteredFunctions);
    } catch (error) {
      logVerbose(chalk.yellow(`Failed to load module ${modulePath}: ${error}`));
    }
  }

  return registeredFunctions;
}

/**
 * Dynamically loads a module using dynamic import
 */
async function loadModule(modulePath: string): Promise<any> {
  const fileUrl = pathToFileURL(modulePath).href;
  const module = await import(fileUrl);
  return module;
}

/**
 * Extracts Convex function names from a loaded module
 */
function extractConvexFunctionNames(module: any, modulePath: string, baseDir: string): string[] {
  const functionNames: string[] = [];
  const relativePath = path.relative(baseDir, modulePath);
  const moduleName = relativePath.replace(/\.[^/.]+$/, ""); // Remove extension

  // Check all exports in the module
  for (const [exportName, exportValue] of Object.entries(module)) {
    if (isConvexFunction(exportValue)) {
      const functionName = exportName === "default" ? moduleName : `${moduleName}:${exportName}`;
      functionNames.push(functionName);
    }
  }

  return functionNames;
}

/**
 * Extracts function references from a loaded module
 */
function extractFunctionReferences(
  module: any,
  modulePath: string,
  baseDir: string
): AnyFunctionReference[] {
  const functionRefs: AnyFunctionReference[] = [];
  const relativePath = path.relative(baseDir, modulePath);
  const moduleName = relativePath.replace(/\.[^/.]+$/, ""); // Remove extension

  // Check all exports in the module
  for (const [exportName, exportValue] of Object.entries(module)) {
    if (isConvexFunction(exportValue)) {
      // Create a function reference for this exported function
      const functionName = exportName === "default" ? moduleName : `${moduleName}:${exportName}`;
      const functionRef = createFunctionReference(functionName, exportValue);
      if (functionRef) {
        functionRefs.push(functionRef);
      }
    }
  }

  return functionRefs;
}

/**
 * Extracts registered Convex functions from a loaded module
 */
function extractRegisteredConvexFunctions(module: any): RegisteredConvexFunction[] {
  const registeredFunctions: RegisteredConvexFunction[] = [];

  // Check all exports in the module
  for (const [, exportValue] of Object.entries(module)) {
    if (isConvexFunction(exportValue)) {
      registeredFunctions.push(exportValue as RegisteredConvexFunction);
    }
  }

  return registeredFunctions;
}

/**
 * Checks if a value is a Convex function by checking for the isConvexFunction property
 */
function isConvexFunction(value: any): boolean {
  return value && typeof value === "object" && value.isConvexFunction === true;
}

/**
 * Creates a function reference from a function name and registered function
 */
function createFunctionReference(
  functionName: string,
  registeredFunc: any
): AnyFunctionReference | null {
  try {
    // Create a function reference object that matches the expected interface
    const functionRef = {
      _type: getFunctionType(registeredFunc),
      _visibility: getFunctionVisibility(registeredFunc),
      _args: {},
      _returnType: {},
      _componentPath: undefined,
      [functionName]: functionName, // This is used by getFunctionName
    };

    return functionRef as AnyFunctionReference;
  } catch (error) {
    logVerbose(chalk.yellow(`Failed to create function reference for ${functionName}: ${error}`));
    return null;
  }
}

/**
 * Determines the function type from a registered function
 */
function getFunctionType(registeredFunc: any): "query" | "mutation" | "action" {
  if (registeredFunc.isQuery) return "query";
  if (registeredFunc.isMutation) return "mutation";
  if (registeredFunc.isAction) return "action";
  throw new Error("Unknown function type");
}

/**
 * Determines the function visibility from a registered function
 */
function getFunctionVisibility(registeredFunc: any): "public" | "internal" {
  if (registeredFunc.isPublic) return "public";
  if (registeredFunc.isInternal) return "internal";
  throw new Error("Unknown function visibility");
}
