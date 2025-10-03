import {
  FunctionVisibility,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
} from "../index.js";
import {
  AnyFunctionReference,
  FunctionReference,
  getFunctionName,
  isActionFunctionReference,
  isMutationFunctionReference,
  isQueryFunctionReference,
} from "./api.js";

// this new lines is an experiment!
// I want to have a local registary in memory to point functionReferences to the actual function
// this will allow us to have a local registry of functions that can be used to call functions directly
// without going through the syscall layer
/// SAVE by address: string -> registeredFunction
const mutationRegistry = new Map<string, RegisteredMutation<"public" | "internal", any, any>>();
const queryRegistry = new Map<string, RegisteredQuery<"public" | "internal", any, any>>();
const actionRegistry = new Map<string, RegisteredAction<"public" | "internal", any, any>>();

export function registerMutation<V extends FunctionVisibility>(
  registeredFunc: RegisteredMutation<V, any, any>,
  visibility: V
) {
  const funcRef = {
    _type: "mutation",
    _visibility: visibility,
    _args: registeredFunc.exportArgs(),
    _returnType: registeredFunc.exportReturns(),
    _componentPath: undefined,
  } satisfies FunctionReference<"mutation", V>;

  const funcName = getFunctionName(funcRef);

  mutationRegistry.set(funcName, registeredFunc);
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

  queryRegistry.set(funcName, registeredFunc);
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

  actionRegistry.set(funcName, registeredFunc);
  console.log("Registered action", funcRef);
}

export function getMutation(func: FunctionReference<"mutation", "public" | "internal">) {
  console.log("Getting mutation", func);
  return mutationRegistry.get(getFunctionName(func));
}

export function getQuery(func: FunctionReference<"query", "public" | "internal">) {
  console.log("Getting query", func);
  return queryRegistry.get(getFunctionName(func));
}

export function getAction(func: FunctionReference<"action", "public" | "internal">) {
  console.log("Getting action", func);
  return actionRegistry.get(getFunctionName(func));
}

export async function invokeFunctionByType(
  func: AnyFunctionReference,
  argsStr: string
): Promise<any> {
  console.log("Invoking function by type", func);
  if (isQueryFunctionReference(func)) {
    const fn = getQuery(func);
    if (!fn) {
      throw new Error(`Query Function ${func} is not registered`);
    }
    return fn.invokeQuery(argsStr);
  } else if (isMutationFunctionReference(func)) {
    const fn = getMutation(func);
    if (!fn) {
      throw new Error(`Mutation Function ${func} is not registered`);
    }
    return fn.invokeMutation(argsStr);
  } else if (isActionFunctionReference(func)) {
    const fn = getAction(func);
    if (!fn) {
      throw new Error(`Action Function ${func} is not registered`);
    }
    return fn.invokeAction(argsStr);
  }
  throw new Error(`Function ${func} is not a valid function reference`);
}
