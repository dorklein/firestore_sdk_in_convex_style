import chalk from "chalk";
import os from "os";
import path from "path";

import { spawn } from "child_process";
import { Context, ErrorType } from "../../../bundler/context.js";
import { failExistingSpinner, logError, logMessage, logWarning } from "../../../bundler/log.js";
import { ProjectConfig } from "../config.js";

export const productionProvisionHost = "https://api.convex.dev";
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
 * Error thrown on non-2XX reponse codes to make most `fetch()` error handling
 * follow a single code path.
 */
export class ThrowingFetchError extends Error {
  response: Response;
  serverErrorData?: ErrorData;

  constructor(
    msg: string,
    {
      code,
      message,
      response,
    }: { cause?: Error; code?: string; message?: string; response: Response }
  ) {
    if (code !== undefined && message !== undefined) {
      super(`${msg}: ${code}: ${message}`);
      this.serverErrorData = { code, message };
    } else {
      super(msg);
    }

    Object.setPrototypeOf(this, ThrowingFetchError.prototype);

    this.response = response;
  }

  public static async fromResponse(response: Response, msg?: string): Promise<ThrowingFetchError> {
    msg = `${msg ? `${msg} ` : ""}${response.status} ${response.statusText}`;
    let code, message;
    try {
      ({ code, message } = await response.json());
    } catch {
      // Do nothing because the non-2XX response code is the primary error here.
    }
    return new ThrowingFetchError(msg, { code, message, response });
  }

  async handle(ctx: Context): Promise<never> {
    let error_type: ErrorType = "transient";
    await checkFetchErrorForDeprecation(ctx, this.response);

    let msg = this.message;

    if (this.response.status === 400) {
      error_type = "invalid filesystem or env vars";
    } else if (this.response.status === 401) {
      error_type = "fatal";
      msg = `${msg}\nAuthenticate with \`npx convex dev\``;
    } else if (this.response.status === 404) {
      error_type = "fatal";
      msg = `${msg}: ${this.response.url}`;
    }

    return await ctx.crash({
      exitCode: 1,
      errorType: error_type,
      errForSentry: this,
      printedMessage: chalk.red(msg.trim()),
    });
  }
}

// /**
//  * Thin wrapper around `fetch()` which throws a FetchDataError on non-2XX
//  * responses which includes error code and message from the response JSON.
//  * (Axios-style)
//  *
//  * It also accepts retry options from fetch-retry.
//  */
// export async function throwingFetch(
//   resource: RequestInfo | URL,
//   options: (RequestInit & RequestInitRetryParams<typeof fetch>) | undefined
// ): Promise<Response> {
//   const Headers = globalThis.Headers;
//   const headers = new Headers((options || {})["headers"]);
//   if (options?.body) {
//     if (!headers.has("Content-Type")) {
//       headers.set("Content-Type", "application/json");
//     }
//   }
//   const response = await retryingFetch(resource, options);
//   if (!response.ok) {
//     // This error must always be handled manually.
//     // eslint-disable-next-line no-restricted-syntax
//     throw await ThrowingFetchError.fromResponse(
//       response,
//       `Error fetching ${options?.method ? options.method + " " : ""} ${
//         typeof resource === "string"
//           ? resource
//           : "url" in resource
//             ? resource.url
//             : resource.toString()
//       }`
//     );
//   }
//   return response;
// }

/**
 * Handle an error a fetch error or non-2xx response.
 */
export async function logAndHandleFetchError(ctx: Context, err: unknown): Promise<never> {
  // Fail the spinner so the stderr lines appear
  failExistingSpinner();

  if (err instanceof ThrowingFetchError) {
    return await err.handle(ctx);
  } else {
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: err,
      printedMessage: chalk.red(err),
    });
  }
}

function logDeprecationWarning(ctx: Context, deprecationMessage: string) {
  if (ctx.deprecationMessagePrinted) {
    return;
  }
  ctx.deprecationMessagePrinted = true;
  logWarning(chalk.yellow(deprecationMessage));
}

async function checkFetchErrorForDeprecation(ctx: Context, resp: Response) {
  const headers = resp.headers;
  if (headers) {
    const deprecationState = headers.get("x-convex-deprecation-state");
    const deprecationMessage = headers.get("x-convex-deprecation-message");
    switch (deprecationState) {
      case null:
        break;
      case "Deprecated":
        // This version is deprecated. Print a warning and crash.

        // Gotcha:
        // 1. Don't use `logDeprecationWarning` because we should always print
        // why this we crashed (even if we printed a warning earlier).
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: chalk.red(deprecationMessage),
        });
      default:
        // The error included a deprecation warning. Print, but handle the
        // error normally (it was for another reason).
        logDeprecationWarning(ctx, deprecationMessage || "(no deprecation message included)");
        break;
    }
  }
}

/// Call this method after a successful API response to conditionally print the
/// "please upgrade" message.
export function deprecationCheckWarning(ctx: Context, resp: Response) {
  const headers = resp.headers;
  if (headers) {
    const deprecationState = headers.get("x-convex-deprecation-state");
    const deprecationMessage = headers.get("x-convex-deprecation-message");
    switch (deprecationState) {
      case null:
        break;
      case "Deprecated":
        // This should never happen because such states are errors, not warnings.
        // eslint-disable-next-line no-restricted-syntax
        throw new Error("Called deprecationCheckWarning on a fatal error. This is a bug.");
      default:
        logDeprecationWarning(ctx, deprecationMessage || "(no deprecation message included)");
        break;
    }
  }
}

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

export async function ensureHasConvexDependency(ctx: Context, cmd: string) {
  const packages = await loadPackageJson(ctx, true);
  const hasConvexDependency = "convex" in packages;
  if (!hasConvexDependency) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `In order to ${cmd}, add \`convex\` to your package.json dependencies.`,
    });
  }
}

/** Return a new array with elements of the passed in array sorted by a key lambda */
export const sorted = <T>(arr: T[], key: (el: T) => any): T[] => {
  const newArr = [...arr];
  const cmp = (a: T, b: T) => {
    if (key(a) < key(b)) return -1;
    if (key(a) > key(b)) return 1;
    return 0;
  };
  return newArr.sort(cmp);
};

export function functionsDir(configPath: string, projectConfig: ProjectConfig): string {
  return path.join(path.dirname(configPath), projectConfig.functions);
}

function convexName() {
  // Use a different directory for config files generated for tests
  if (process.env.CONVEX_PROVISION_HOST) {
    const port = process.env.CONVEX_PROVISION_HOST.split(":")[2];
    if (port === undefined || port === "8050") {
      return `convex-test`;
    } else {
      return `convex-test-${port}`;
    }
  }
  return "convex";
}

export function rootDirectory(): string {
  return path.join(os.homedir(), `.${convexName()}`);
}

export function cacheDir() {
  const name = convexName();
  const platform = process.platform;
  if (platform === "win32") {
    // On Windows, `LOCALAPPDATA` is usually set, but fall back to
    // `USERPROFILE` if not, and fall back to homedir if all else fails.
    if (process.env.LOCALAPPDATA) {
      return path.join(process.env.LOCALAPPDATA, name);
    }
    if (process.env.USERPROFILE) {
      return path.join(process.env.USERPROFILE, "AppData", "Local", name);
    }
    return path.join(os.homedir(), "AppData", "Local", name);
  }
  return path.join(os.homedir(), ".cache", name);
}

/**
 * Polls an arbitrary function until a condition is met.
 *
 * @param fetch Function performing a fetch, returning resulting data.
 * @param condition This function will terminate polling when it returns `true`.
 * @param waitMs How long to wait in between fetches.
 * @returns The resulting data from `fetch`.
 */
export const poll = async function <Result>(
  fetch: () => Promise<Result>,
  condition: (data: Result) => boolean,
  waitMs = 1000
) {
  let result = await fetch();
  while (!condition(result)) {
    await wait(waitMs);
    result = await fetch();
  }
  return result;
};

const wait = function (waitMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, waitMs);
  });
};

export function waitForever() {
  // This never resolves
  return new Promise((_) => {
    // ignore
  });
}

// Returns a promise and a function that resolves the promise.
export function waitUntilCalled(): [Promise<unknown>, () => void] {
  let onCalled: (v: unknown) => void;
  const waitPromise = new Promise((resolve) => (onCalled = resolve));
  return [waitPromise, () => onCalled(null)];
}

// We can eventually switch to something like `filesize` for i18n and
// more robust formatting, but let's keep our CLI bundle small for now.
export function formatSize(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  if (n < 1024 * 1024 * 1024) {
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(ms: number): string {
  const twoDigits = (n: number, unit: string) =>
    `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}${unit}`;

  if (ms < 1e-3) {
    return twoDigits(ms * 1e9, "ns");
  }
  if (ms < 1) {
    return twoDigits(ms * 1e3, "µs");
  }
  if (ms < 1e3) {
    return twoDigits(ms, "ms");
  }
  const s = ms / 1e3;
  if (s < 60) {
    return twoDigits(ms / 1e3, "s");
  }
  return twoDigits(s / 60, "m");
}

export function getCurrentTimeString() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
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
        "No package.json found. To create a new project using Convex, see https://docs.convex.dev/home#quickstarts",
    });
  }
  const candidateConvexJson =
    parentPackageJson && path.join(path.dirname(parentPackageJson), "convex.json");
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

/**
 * Returns whether there's an existing project config. Throws
 * if this is not a valid directory for a project config.
 */
export async function isInExistingProject(ctx: Context) {
  const { parentPackageJson, parentConvexJson } = await findParentConfigs(ctx);
  if (parentPackageJson !== path.resolve("package.json")) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Run this command from the root directory of a project.",
    });
  }
  return !!parentConvexJson;
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

/**
 * Whether this is likely to be a WebContainer,
 * WebContainers can't complete the WorkOS  login but where that login flow
 * fails has changed with the environment.
 */
export function isWebContainer(): boolean {
  // Dynamic require as used here doesn't work with tsx
  if (process.env.CONVEX_RUNNING_LIVE_IN_MONOREPO) {
    return false;
  }
  const dynamicRequire = require;
  if (process.versions.webcontainer === undefined) {
    return false;
  }
  let blitzInternalEnv: unknown;
  try {
    blitzInternalEnv = dynamicRequire("@blitz/internal/env");
    // totally fine for this require to fail
    // eslint-disable-next-line no-empty
  } catch {}
  return blitzInternalEnv !== null && blitzInternalEnv !== undefined;
}

// For (rare) special behaviors based on package.json details.
export async function currentPackageHomepage(ctx: Context): Promise<string | null> {
  const { parentPackageJson: packageJsonPath } = await findParentConfigs(ctx);
  let packageJson: any;
  try {
    const packageJsonString = ctx.fs.readUtf8File(packageJsonPath);
    packageJson = JSON.parse(packageJsonString);
  } catch (error: any) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Couldn't parse "${packageJsonPath}". Make sure it's a valid JSON. Error: ${error}`,
    });
  }
  const name = packageJson["homepage"];
  if (typeof name !== "string") {
    // wrong type or missing
    return null;
  }
  return name;
}
