import { importPath, moduleIdentifier } from "./api.js";
import { header } from "./common.js";

export function apiRegistryCodegen(modulePaths: string[], functionNames: Map<string, string[]>) {
  const registryGroup = modulePaths.map((modulePath) => {
    const names = functionNames.get(modulePath);
    if (!names) {
      return [];
    }

    const registryForModule = names.map((name) => {
      return `"${name}": ${name.replaceAll("/", ".").replaceAll(":", ".")},`;
    });
    return registryForModule;
  });

  const flatRegistry = registryGroup.flat();

  return `${header("Generated `apiRegistry` utility.")}
    ${modulePaths
      .map(
        (modulePath) =>
          `import * as ${moduleIdentifier(modulePath)} from "../${importPath(modulePath)}.js";`
      )
      .join("\n")}
      
    export const apiRegistry = {
      ${flatRegistry.join("\n")}
    };
    `;
}
