import { header } from "./common.js";

export function apiCodegen(functions: FunctionInfo[], actions: FunctionInfo[]) {
  // Separate functions by visibility (public vs internal)
  const publicFunctions = functions.filter((f) => f.visibility === "public");
  const internalFunctions = functions.filter((f) => f.visibility === "internal");
  const publicActions = actions.filter((f) => f.visibility === "public");
  const internalActions = actions.filter((f) => f.visibility === "internal");

  // Group functions by file/module
  const functionsByModule = groupByModule([...publicFunctions, ...internalFunctions]);
  const actionsByModule = groupByModule([...publicActions, ...internalActions]);

  const apiDTS = `
    ${header("Generated API references for all functions and actions.")}
    import type { DataModel } from "./dataModel.js";

    // Type definitions for function references
    export type FunctionReference<Args, Return> = {
      _functionName: string;
      _args: Args;
      _return: Return;
    };

    // Public API - accessible from client
    export const api = {
      ${generateModuleExports(functionsByModule, "public")}
    } as const;

    // Internal API - only accessible from server-side functions
    export const internal = {
      ${generateModuleExports(functionsByModule, "internal")}
      ${generateModuleExports(actionsByModule, "internal")}
    } as const;

    // Type definitions for better TypeScript support
    export type Api = typeof api;
    export type Internal = typeof internal;`;

  const apiJS = `
    ${header("Generated API references for all functions and actions.")}
    
    // Public API - accessible from client
    export const api = {
      ${generateModuleExportsJS(functionsByModule, "public")}
    };

    // Internal API - only accessible from server-side functions
    export const internal = {
      ${generateModuleExportsJS(functionsByModule, "internal")}
      ${generateModuleExportsJS(actionsByModule, "internal")}
    };`;

  return {
    DTS: apiDTS,
    JS: apiJS,
  };
}

interface FunctionInfo {
  name: string;
  module: string;
  visibility: "public" | "internal";
  type: "query" | "mutation" | "action";
  args: string;
  return: string;
}

function groupByModule(functions: FunctionInfo[]): Record<string, FunctionInfo[]> {
  const grouped: Record<string, FunctionInfo[]> = {};

  for (const func of functions) {
    if (!grouped[func.module]) {
      grouped[func.module] = [];
    }
    grouped[func.module].push(func);
  }

  return grouped;
}

function generateModuleExports(
  modules: Record<string, FunctionInfo[]>,
  visibility: "public" | "internal"
): string {
  const filteredModules = Object.entries(modules).filter(([_, funcs]) =>
    funcs.some((f) => f.visibility === visibility)
  );

  if (filteredModules.length === 0) {
    return "";
  }

  return filteredModules
    .map(([moduleName, funcs]) => {
      const moduleFuncs = funcs.filter((f) => f.visibility === visibility);

      if (moduleFuncs.length === 0) {
        return "";
      }

      const moduleExports = moduleFuncs
        .map((func) => {
          return `    ${func.name}: FunctionReference<${func.args}, ${func.return}>,`;
        })
        .join("\n");

      return `  ${moduleName}: {
${moduleExports}
  },`;
    })
    .join("\n");
}

function generateModuleExportsJS(
  modules: Record<string, FunctionInfo[]>,
  visibility: "public" | "internal"
): string {
  const filteredModules = Object.entries(modules).filter(([_, funcs]) =>
    funcs.some((f) => f.visibility === visibility)
  );

  if (filteredModules.length === 0) {
    return "";
  }

  return filteredModules
    .map(([moduleName, funcs]) => {
      const moduleFuncs = funcs.filter((f) => f.visibility === visibility);

      if (moduleFuncs.length === 0) {
        return "";
      }

      const moduleExports = moduleFuncs
        .map((func) => {
          return `    ${func.name}: { _functionName: "${func.name}", _args: null, _return: null },`;
        })
        .join("\n");

      return `  ${moduleName}: {
${moduleExports}
  },`;
    })
    .join("\n");
}

// Function to scan and extract function information from TypeScript files
export async function scanFunctions(schemaPath: string): Promise<{
  functions: FunctionInfo[];
  actions: FunctionInfo[];
}> {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join, dirname, extname } = await import("node:path");

  const functions: FunctionInfo[] = [];
  const actions: FunctionInfo[] = [];

  const schemaDir = dirname(schemaPath);

  // Scan for functions.ts and actions.ts files
  const possibleFiles = [join(schemaDir, "functions.ts"), join(schemaDir, "actions.ts")];

  // Also scan subdirectories for functions
  try {
    const subdirs = readdirSync(schemaDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const subdir of subdirs) {
      const subdirPath = join(schemaDir, subdir);
      const subdirFiles = readdirSync(subdirPath)
        .filter((file) => extname(file) === ".ts")
        .map((file) => join(subdirPath, file));

      possibleFiles.push(...subdirFiles);
    }
  } catch (error) {
    // Ignore errors when scanning subdirectories
  }

  for (const filePath of possibleFiles) {
    if (!filePath.endsWith(".ts") || !fileExists(filePath, statSync)) {
      continue;
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const moduleName = getModuleName(filePath, schemaDir);

      // Extract functions
      const fileFunctions = extractFunctions(content, moduleName, "functions");
      functions.push(...fileFunctions);

      // Extract actions
      const fileActions = extractFunctions(content, moduleName, "actions");
      actions.push(...fileActions);
    } catch (error) {
      console.warn(`Warning: Could not scan ${filePath}:`, error);
    }
  }

  return { functions, actions };
}

function getModuleName(filePath: string, schemaDir: string): string {
  const relativePath = filePath.replace(schemaDir, "").replace(/^\//, "");
  const withoutExt = relativePath.replace(/\.ts$/, "");

  // Convert path to module name (e.g., "functions" or "actions" or "subdir/functions")
  if (withoutExt === "functions") return "functions";
  if (withoutExt === "actions") return "actions";

  // For subdirectories, use the directory name
  const parts = withoutExt.split("/");
  if (parts.length > 1) {
    return parts[0]; // Use directory name as module
  }

  return withoutExt;
}

function extractFunctions(
  content: string,
  moduleName: string,
  type: "functions" | "actions"
): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  // Regex patterns to match function exports
  const patterns = [
    // export const functionName = query({...}) - handle multiline
    new RegExp(
      `export\\s+const\\s+(\\w+)\\s*=\\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\\s*\\(`,
      "gm"
    ),
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const functionName = match[1];
      const functionType = match[2];

      // Determine visibility and type
      let visibility: "public" | "internal";
      let actualType: "query" | "mutation" | "action";

      if (functionType.startsWith("internal")) {
        visibility = "internal";
        actualType = functionType.replace("internal", "").toLowerCase() as
          | "query"
          | "mutation"
          | "action";
      } else {
        visibility = "public";
        actualType = functionType as "query" | "mutation" | "action";
      }

      // Only include if it matches the requested type
      if (
        (type === "functions" && (actualType === "query" || actualType === "mutation")) ||
        (type === "actions" && actualType === "action")
      ) {
        functions.push({
          name: functionName,
          module: moduleName,
          visibility,
          type: actualType,
          args: "any", // We'll improve this later with better type extraction
          return: "any", // We'll improve this later with better type extraction
        });
      }
    }
  }

  return functions;
}

// Helper function to check if file exists
function fileExists(path: string, statSync: any): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
