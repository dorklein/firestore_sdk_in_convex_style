import {
  AnyRegisteredFunction,
  FunctionVisibility,
  isRegisteredAction,
  isRegisteredMutation,
  isRegisteredQuery,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
} from "./registration.js";
import { AnyFunctionReference, FunctionReference, getFunctionName } from "./api.js";
import { functionName } from "./functionName.js";

let _globalApiRegistry: Record<string, AnyRegisteredFunction> | undefined;

export function setGlobalApiRegistry(apiRegistry: Record<string, AnyRegisteredFunction>) {
  _globalApiRegistry = apiRegistry;
}

export function getGlobalApiRegistry() {
  if (!_globalApiRegistry) {
    throw new Error("Global API registry is not set");
  }
  return _globalApiRegistry;
}

// this new lines is an experiment!
// I want to have a local registary in memory to point functionReferences to the actual function
// this will allow us to have a local registry of functions that can be used to call functions directly
// without going through the syscall layer
/// SAVE by address: string -> registeredFunction
// type FuncName = string;
// type RegisteredFunc =
//   | RegisteredQuery<"public" | "internal", any, any>
//   | RegisteredMutation<"public" | "internal", any, any>
//   | RegisteredAction<"public" | "internal", any, any>;

// const mutationRegistry = new Map<string, RegisteredMutation<"public" | "internal", any, any>>();
// const queryRegistry = new Map<string, RegisteredQuery<"public" | "internal", any, any>>();
// const actionRegistry = new Map<string, RegisteredAction<"public" | "internal", any, any>>();

// export function registerFunction(funcName: FuncName, registeredFunc: RegisteredFunc) {
//   //   functionRegistry.set(funcName, registeredFunc);
// }

export function registerMutation<V extends FunctionVisibility>(
  registeredFunc: RegisteredMutation<V, any, any>,
  visibility: V
) {
  const funcRef = {
    [functionName]: "registeredFunc.name",
    _type: "mutation",
    _visibility: visibility,
    _args: registeredFunc.exportArgs(),
    _returnType: registeredFunc.exportReturns(),
    _componentPath: undefined,
  } satisfies FunctionReference<"mutation", V> & { [functionName]: string };

  const funcName = getFunctionName(funcRef);
  console.log("funcName", funcName);

  //   mutationRegistry.set(funcName, registeredFunc);
  console.log("Registered mutation", funcRef);
}

export function registerQuery<V extends FunctionVisibility>(
  registeredFunc: RegisteredQuery<V, any, any>,
  visibility: V
) {
  const funcRef = {
    _type: "query",
    _visibility: visibility,
    _args: registeredFunc.exportArgs(),
    _returnType: registeredFunc.exportReturns(),
    _componentPath: undefined,
  } satisfies FunctionReference<"query", V>;

  const funcName = getFunctionName(funcRef);
  console.log("funcName", funcName);

  //   queryRegistry.set(funcName, registeredFunc);
  console.log("Registered query", funcRef);
}

export function registerAction<V extends FunctionVisibility>(
  registeredFunc: RegisteredAction<V, any, any>,
  visibility: V
) {
  const funcRef = {
    _type: "action",
    _visibility: visibility,
    _args: registeredFunc.exportArgs(),
    _returnType: registeredFunc.exportReturns(),
    _componentPath: undefined,
  } satisfies FunctionReference<"action", V>;

  const funcName = getFunctionName(funcRef);
  console.log("funcName", funcName);

  //   actionRegistry.set(funcName, registeredFunc);
  console.log("Registered action", funcRef);
}

export async function invokeFunctionByType(
  func: AnyFunctionReference,
  argsStr: string
): Promise<any> {
  const funcName = getFunctionName(func);
  const registeredFunc = getGlobalApiRegistry()[funcName];
  if (!registeredFunc) {
    throw new Error(`Function ${funcName} is not registered`);
  }

  if (isRegisteredQuery(registeredFunc)) {
    return registeredFunc.invokeQuery(argsStr);
  } else if (isRegisteredMutation(registeredFunc)) {
    return registeredFunc.invokeMutation(argsStr);
  } else if (isRegisteredAction(registeredFunc)) {
    return registeredFunc.invokeAction(argsStr);
  }
  //   console.log("Invoking function by type", func);
  //   if (isQueryFunctionReference(func)) {
  //     const fn = getQuery(func);
  //     if (!fn) {
  //       throw new Error(`Query Function ${func} is not registered`);
  //     }
  //     return fn.invokeQuery(argsStr);
  //   } else if (isMutationFunctionReference(func)) {
  //     const fn = getMutation(func);
  //     if (!fn) {
  //       throw new Error(`Mutation Function ${func} is not registered`);
  //     }
  //     return fn.invokeMutation(argsStr);
  //   } else if (isActionFunctionReference(func)) {
  //     const fn = getAction(func);
  //     if (!fn) {
  //       throw new Error(`Action Function ${func} is not registered`);
  //     }
  //     return fn.invokeAction(argsStr);
  //   }
  //   throw new Error(`Function ${func} is not a valid function reference`);
}
