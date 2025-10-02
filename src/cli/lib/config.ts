import chalk from "chalk";
import path from "path";
import { Context } from "../../bundler/context.js";
import { logError, logFailure, logMessage } from "../../bundler/log.js";
import { functionsDir, loadPackageJson } from "./utils/utils.js";
export { productionProvisionHost, provisionHost } from "./utils/utils.js";

/** Type representing Convex project configuration. */
export interface ProjectConfig {
  functions: string;
}

const DEFAULT_FUNCTIONS_PATH = "firestore/";

/** Error parsing ProjectConfig representation. */
class ParseError extends Error {}

/** Parse object to ProjectConfig. */
export async function parseProjectConfig(ctx: Context, obj: any): Promise<ProjectConfig> {
  if (typeof obj !== "object") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Expected `firestore-convex-style.json` to contain an object",
    });
  }

  if (typeof obj.functions === "undefined") {
    obj.functions = DEFAULT_FUNCTIONS_PATH;
  } else if (typeof obj.functions !== "string") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: "Expected `functions` in `firestore-convex-style.json` to be a string",
    });
  }

  return obj;
}

export function configName(): string {
  return "firestore-convex-style.json";
}

export async function configFilepath(ctx: Context): Promise<string> {
  const configFn = configName();
  // We used to allow src/convex.json, but no longer (as of 10/7/2022).
  // Leave an error message around to help people out. We can remove this
  // error message after a couple months.
  const preferredLocation = configFn;
  const wrongLocation = path.join("src", configFn);

  // Allow either location, but not both.
  const preferredLocationExists = ctx.fs.exists(preferredLocation);
  const wrongLocationExists = ctx.fs.exists(wrongLocation);
  if (preferredLocationExists && wrongLocationExists) {
    const message = `${chalk.red(`Error: both ${preferredLocation} and ${wrongLocation} files exist!`)}\nConsolidate these and remove ${wrongLocation}.`;
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: message,
    });
  }
  if (!preferredLocationExists && wrongLocationExists) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Error: Please move ${wrongLocation} to the root of your project`,
    });
  }

  return preferredLocation;
}

export async function getFunctionsDirectoryPath(ctx: Context): Promise<string> {
  const { projectConfig, configPath } = await readProjectConfig(ctx);
  return functionsDir(configPath, projectConfig);
}

/** Read configuration from a local `firestore-convex-style.json` file. */
export async function readProjectConfig(ctx: Context): Promise<{
  projectConfig: ProjectConfig;
  configPath: string;
}> {
  if (!ctx.fs.exists("firestore-convex-style.json")) {
    // create-react-app bans imports from outside of src, so we can just
    // put the functions directory inside of src/ to work around this issue.
    const packages = await loadPackageJson(ctx);
    const isCreateReactApp = "react-scripts" in packages;
    return {
      projectConfig: {
        functions: isCreateReactApp ? `src/${DEFAULT_FUNCTIONS_PATH}` : DEFAULT_FUNCTIONS_PATH,
      },
      configPath: configName(),
    };
  }
  let projectConfig;
  const configPath = await configFilepath(ctx);
  try {
    projectConfig = await parseProjectConfig(ctx, JSON.parse(ctx.fs.readUtf8File(configPath)));
  } catch (err) {
    if (err instanceof ParseError || err instanceof SyntaxError) {
      logError(chalk.red(`Error: Parsing "${configPath}" failed`));
      logMessage(chalk.gray(err.toString()));
    } else {
      logFailure(
        `Error: Unable to read project config file "${configPath}"\n` +
          "  Are you running this command from the root directory of a Firestore-Convex-Style project? If so, run `npx firestore-convex-style dev` first."
      );
      if (err instanceof Error) {
        logError(chalk.red(err.message));
      }
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      // TODO -- move the logging above in here
      printedMessage: null,
    });
  }
  return {
    projectConfig,
    configPath,
  };
}
