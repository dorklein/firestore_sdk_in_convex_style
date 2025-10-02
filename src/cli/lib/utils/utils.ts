import os from "os";
import path from "path";

import { spawn } from "child_process";
import { Context } from "../../../bundler/context.js";
import { logError, logMessage } from "../../../bundler/log.js";
import { ProjectConfig } from "../config.js";

export const productionProvisionHost = "https://api.firestore-convex-style.dev";
export const provisionHost = process.env.CONVEX_PROVISION_HOST || productionProvisionHost;
export const ENV_VAR_FILE_PATH = ".env.local";
export const CONVEX_DEPLOY_KEY_ENV_VAR_NAME = "CONVEX_DEPLOY_KEY";
export const CONVEX_DEPLOYMENT_ENV_VAR_NAME = "CONVEX_DEPLOYMENT";
export const CONVEX_SELF_HOSTED_URL_VAR_NAME = "CONVEX_SELF_HOSTED_URL";
export const CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME = "CONVEX_SELF_HOSTED_ADMIN_KEY";

export type ErrorData = {
  code: string;
  message: string;
};

/**
 * @param ctx
 * @returns a Record of dependency name to dependency version for dependencies
 * and devDependencies
 */
export async function loadPackageJson(
  ctx: Context,
  includePeerDeps = false
): Promise<Record<string, string>> {
  let packageJson;
  try {
    packageJson = ctx.fs.readUtf8File("package.json");
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Unable to read your package.json: ${
        err as any
      }. Make sure you're running this command from the root directory of a Convex app that contains the package.json`,
    });
  }
  let obj;
  try {
    obj = JSON.parse(packageJson);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      printedMessage: `Unable to parse package.json: ${err as any}`,
    });
  }
  if (typeof obj !== "object") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Expected to parse an object from package.json",
    });
  }
  const packages = {
    ...(includePeerDeps ? (obj.peerDependencies ?? {}) : {}),
    ...(obj.dependencies ?? {}),
    ...(obj.devDependencies ?? {}),
  };
  return packages;
}

export function functionsDir(configPath: string, projectConfig: ProjectConfig): string {
  return path.join(path.dirname(configPath), projectConfig.functions);
}

function firestoreConvexStyleName() {
  // Use a different directory for config files generated for tests
  if (process.env.CONVEX_PROVISION_HOST) {
    const port = process.env.CONVEX_PROVISION_HOST.split(":")[2];
    if (port === undefined || port === "8050") {
      return `firestore-convex-style-test`;
    } else {
      return `firestore-convex-style-test-${port}`;
    }
  }
  return "firestore-convex-style";
}

export function rootDirectory(): string {
  return path.join(os.homedir(), `.${firestoreConvexStyleName()}`);
}

// We don't allow running commands in project subdirectories yet,
// but we can provide better errors if we look around.
export async function findParentConfigs(ctx: Context): Promise<{
  parentPackageJson: string;
  parentConvexJson?: string | undefined;
}> {
  const parentPackageJson = findUp(ctx, "package.json");
  if (!parentPackageJson) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage:
        "No package.json found. To create a new project using Firestore-Convex-Style, see https://docs.firestore-convex-style.dev/home#quickstarts",
    });
  }
  const candidateConvexJson =
    parentPackageJson && path.join(path.dirname(parentPackageJson), "firestore-convex-style.json");
  const parentConvexJson =
    candidateConvexJson && ctx.fs.exists(candidateConvexJson) ? candidateConvexJson : undefined;
  return {
    parentPackageJson,
    parentConvexJson,
  };
}

/**
 * Finds a file in the current working directory or a parent.
 *
 * @returns The absolute path of the first file found or undefined.
 */
function findUp(ctx: Context, filename: string): string | undefined {
  let curDir = path.resolve(".");
  let parentDir = curDir;
  do {
    const candidate = path.join(curDir, filename);
    if (ctx.fs.exists(candidate)) {
      return candidate;
    }
    curDir = parentDir;
    parentDir = path.dirname(curDir);
  } while (parentDir !== curDir);
  return;
}

// `spawnAsync` is the async version of Node's `spawnSync` (and `spawn`).
//
// By default, this returns the produced `stdout` and `stderror` and
// an error if one was encountered (to mirror `spawnSync`).
//
// If `stdio` is set to `"inherit"`, pipes `stdout` and `stderror` (
// pausing the spinner if one is running) and rejects the promise
// on errors (to mirror `execFileSync`).
export function spawnAsync(
  ctx: Context,
  command: string,
  args: ReadonlyArray<string>
): Promise<{
  stdout: string;
  stderr: string;
  status: null | number;
  error?: Error | undefined;
}>;
export function spawnAsync(
  ctx: Context,
  command: string,
  args: ReadonlyArray<string>,
  options: { stdio: "inherit"; shell?: boolean }
): Promise<void>;
export function spawnAsync(
  _ctx: Context,
  command: string,
  args: ReadonlyArray<string>,
  options?: { stdio: "inherit"; shell?: boolean }
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: options?.shell });
    let stdout = "";
    let stderr = "";

    const pipeOutput = options?.stdio === "inherit";

    if (pipeOutput) {
      child.stdout.on("data", (text) => logMessage(text.toString("utf-8").trimEnd()));
      child.stderr.on("data", (text) => logError(text.toString("utf-8").trimEnd()));
    } else {
      child.stdout.on("data", (data) => {
        stdout += data.toString("utf-8");
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString("utf-8");
      });
    }

    const completionListener = (code: number | null) => {
      child.removeListener("error", errorListener);
      const result = pipeOutput ? { status: code } : { stdout, stderr, status: code };
      if (code !== 0) {
        const argumentString = args && args.length > 0 ? ` ${args.join(" ")}` : "";
        const error = new Error(
          `\`${command}${argumentString}\` exited with non-zero code: ${code}`
        );
        if (pipeOutput) {
          reject({ ...result, error });
        } else {
          resolve({ ...result, error });
        }
      } else {
        resolve(result);
      }
    };

    const errorListener = (error: Error) => {
      child.removeListener("exit", completionListener);
      child.removeListener("close", completionListener);
      if (pipeOutput) {
        reject({ error, status: null });
      } else {
        resolve({ error, status: null });
      }
    };

    if (pipeOutput) {
      child.once("exit", completionListener);
    } else {
      child.once("close", completionListener);
    }
    child.once("error", errorListener);
  });
}
