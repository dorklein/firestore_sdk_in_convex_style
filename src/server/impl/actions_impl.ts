import { convexToJson, jsonToConvex, Value } from "../../values/index.js";
import { version } from "../../version.js";
import { parseArgs } from "../../common/index.js";
import { getFunctionAddress } from "../components/paths.js";
import { invokeFunctionByType } from "../registry.js";
import { RegisteredAction, RegisteredMutation, RegisteredQuery } from "../registration.js";

function syscallArgs(requestId: string, functionReference: any, args?: Record<string, Value>) {
  const address = getFunctionAddress(functionReference);
  return {
    ...address,
    args: convexToJson(parseArgs(args)),
    version,
    requestId,
  };
}

// export function setupActionCalls1() {
//   const requestId = "";
//   return {
//     runQuery: async (
//       query: FunctionReference<"query", "public" | "internal">,
//       args?: Record<string, Value>
//     ): Promise<any> => {
//       //   const result = await performAsyncSyscall(
//       //     "1.0/actions/query",
//       //     syscallArgs(requestId, query, args)
//       //   );

//       const _syscallArgs = syscallArgs(requestId, query, args);

//       const result = await invokeFunctionByType(query, _syscallArgs.args);
//       return jsonToConvex(result);
//     },
//     runMutation: async (
//       mutation: FunctionReference<"mutation", "public" | "internal">,
//       args?: Record<string, Value>
//     ): Promise<any> => {
//       //   const result = await performAsyncSyscall(
//       //     "1.0/actions/mutation",
//       //     syscallArgs(requestId, mutation, args)
//       //   );
//       const _syscallArgs = syscallArgs(requestId, mutation, args);
//       const result = await invokeFunctionByType(mutation, _syscallArgs.args);
//       return jsonToConvex(result);
//     },
//     runAction: async (
//       action: FunctionReference<"action", "public" | "internal">,
//       args?: Record<string, Value>
//     ): Promise<any> => {
//       //   const result = await performAsyncSyscall(
//       //     "1.0/actions/action",
//       //     syscallArgs(requestId, action, args)
//       //   );

//       const _syscallArgs = syscallArgs(requestId, action, args);
//       const result = await invokeFunctionByType(action, _syscallArgs.args);
//       return jsonToConvex(result);
//     },
//   };
// }

export function setupActionCalls() {
  const requestId = "";
  return {
    runQuery: async (
      query: RegisteredQuery<"public" | "internal", any, any>,
      args?: Record<string, Value>
    ): Promise<any> => {
      //   const result = await performAsyncSyscall(
      //     "1.0/actions/query",
      //     syscallArgs(requestId, query, args)
      //   );

      const _syscallArgs = syscallArgs(requestId, query, args);

      const result = await invokeFunctionByType(query, _syscallArgs.args);
      return jsonToConvex(result);
    },
    runMutation: async (
      mutation: RegisteredMutation<"public" | "internal", any, any>,
      args?: Record<string, Value>
    ): Promise<any> => {
      //   const result = await performAsyncSyscall(
      //     "1.0/actions/mutation",
      //     syscallArgs(requestId, mutation, args)
      //   );
      const _syscallArgs = syscallArgs(requestId, mutation, args);
      const result = await invokeFunctionByType(mutation, _syscallArgs.args);
      return jsonToConvex(result);
    },
    runAction: async (
      action: RegisteredAction<"public" | "internal", any, any>,
      args?: Record<string, Value>
    ): Promise<any> => {
      //   const result = await performAsyncSyscall(
      //     "1.0/actions/action",
      //     syscallArgs(requestId, action, args)
      //   );

      const _syscallArgs = syscallArgs(requestId, action, args);
      const result = await invokeFunctionByType(action, _syscallArgs.args);
      return jsonToConvex(result);
    },
  };
}
