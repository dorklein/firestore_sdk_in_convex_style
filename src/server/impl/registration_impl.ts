import { asObjectValidator, Validator } from "../../values/index.ts";
import { GenericDataModel } from "../data_model.ts";
import {
  QueryBuilder,
  ArgsArrayForOptionalValidator,
  ArgsArrayToObject,
  GenericQueryCtx,
  PropertyValidators,
  RegisteredQuery,
  ReturnValueForOptionalValidator,
  DefaultArgsForOptionalValidator,
  MutationBuilder,
  GenericMutationCtx,
  RegisteredMutation,
} from "../registration.ts";

/**
 * Define a query in this Convex app's public API.
 */
export const queryGeneric = <DataModel extends GenericDataModel>(): QueryBuilder<
  DataModel,
  "public"
> => {
  return (<
    ArgsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnValue extends
      ReturnValueForOptionalValidator<ReturnsValidator> = ReturnValueForOptionalValidator<ReturnsValidator>,
    OneOrZeroArgs extends
      ArgsArrayForOptionalValidator<ArgsValidator> = DefaultArgsForOptionalValidator<ArgsValidator>,
  >(
    func:
      | {
          args?: ArgsValidator;
          returns?: ReturnsValidator;
          handler: (ctx: GenericQueryCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue;
        }
      | ((ctx: GenericQueryCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue)
  ): RegisteredQuery<"public", ArgsArrayToObject<OneOrZeroArgs>, ReturnValue> => {
    const handler = typeof func === "function" ? func : func.handler;
    const argsValidator = typeof func === "object" ? func.args : undefined;
    const returnsValidator = typeof func === "object" ? func.returns : undefined;

    return {
      isConvexFunction: true,
      isQuery: true,
      isPublic: true,
      _argsValidator: argsValidator,
      _returnsValidator: returnsValidator,
      _handler: ((ctx: GenericQueryCtx<any>, args: ArgsArrayToObject<OneOrZeroArgs>) => {
        return (handler as any)(ctx, args);
      }) as any,
      async invokeQuery(_argsStr: string): Promise<string> {
        throw new Error("Not implemented - use runner");
      },
      exportArgs(): string {
        return argsValidator ? JSON.stringify(asObjectValidator(argsValidator).json) : "{}";
      },
      exportReturns(): string {
        return returnsValidator ? JSON.stringify(asObjectValidator(returnsValidator).json) : "any";
      },
    } as any;
  }) as QueryBuilder<DataModel, "public">;
};

/**
 * Define a query that is only accessible from other Convex functions.
 */
export const internalQueryGeneric = <DataModel extends GenericDataModel>(): QueryBuilder<
  DataModel,
  "internal"
> => {
  return (<
    ArgsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnValue extends
      ReturnValueForOptionalValidator<ReturnsValidator> = ReturnValueForOptionalValidator<ReturnsValidator>,
    OneOrZeroArgs extends
      ArgsArrayForOptionalValidator<ArgsValidator> = DefaultArgsForOptionalValidator<ArgsValidator>,
  >(
    func:
      | {
          args?: ArgsValidator;
          returns?: ReturnsValidator;
          handler: (ctx: GenericQueryCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue;
        }
      | ((ctx: GenericQueryCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue)
  ): RegisteredQuery<"internal", ArgsArrayToObject<OneOrZeroArgs>, ReturnValue> => {
    const handler = typeof func === "function" ? func : func.handler;
    const argsValidator = typeof func === "object" ? func.args : undefined;
    const returnsValidator = typeof func === "object" ? func.returns : undefined;

    return {
      isConvexFunction: true,
      isQuery: true,
      isInternal: true,
      _argsValidator: argsValidator,
      _returnsValidator: returnsValidator,
      _handler: ((ctx: GenericQueryCtx<any>, args: ArgsArrayToObject<OneOrZeroArgs>) => {
        return (handler as any)(ctx, args);
      }) as any,
      async invokeQuery(_argsStr: string): Promise<string> {
        throw new Error("Not implemented - use runner");
      },
      exportArgs(): string {
        return argsValidator ? JSON.stringify(asObjectValidator(argsValidator).json) : "{}";
      },
      exportReturns(): string {
        return returnsValidator ? JSON.stringify(asObjectValidator(returnsValidator).json) : "any";
      },
    } as any;
  }) as QueryBuilder<DataModel, "internal">;
};

/**
 * Define a mutation in this Convex app's public API.
 */
export const mutationGeneric = <DataModel extends GenericDataModel>(): MutationBuilder<
  DataModel,
  "public"
> => {
  return (<
    ArgsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnValue extends
      ReturnValueForOptionalValidator<ReturnsValidator> = ReturnValueForOptionalValidator<ReturnsValidator>,
    OneOrZeroArgs extends
      ArgsArrayForOptionalValidator<ArgsValidator> = DefaultArgsForOptionalValidator<ArgsValidator>,
  >(
    func:
      | {
          args?: ArgsValidator;
          returns?: ReturnsValidator;
          handler: (ctx: GenericMutationCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue;
        }
      | ((ctx: GenericMutationCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue)
  ): RegisteredMutation<"public", ArgsArrayToObject<OneOrZeroArgs>, ReturnValue> => {
    const handler = typeof func === "function" ? func : func.handler;
    const argsValidator = typeof func === "object" ? func.args : undefined;
    const returnsValidator = typeof func === "object" ? func.returns : undefined;

    return {
      isConvexFunction: true,
      isMutation: true,
      isPublic: true,
      _argsValidator: argsValidator,
      _returnsValidator: returnsValidator,
      _handler: ((ctx: GenericMutationCtx<any>, args: ArgsArrayToObject<OneOrZeroArgs>) => {
        return (handler as any)(ctx, args);
      }) as any,
      async invokeMutation(_argsStr: string): Promise<string> {
        throw new Error("Not implemented - use runner");
      },
      exportArgs(): string {
        return argsValidator ? JSON.stringify(asObjectValidator(argsValidator).json) : "{}";
      },
      exportReturns(): string {
        return returnsValidator ? JSON.stringify(asObjectValidator(returnsValidator).json) : "any";
      },
    } as any;
  }) as MutationBuilder<DataModel, "public">;
};

/**
 * Define a mutation that is only accessible from other Convex functions.
 */
export const internalMutationGeneric = <DataModel extends GenericDataModel>(): MutationBuilder<
  DataModel,
  "internal"
> => {
  return (<
    ArgsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnValue extends
      ReturnValueForOptionalValidator<ReturnsValidator> = ReturnValueForOptionalValidator<ReturnsValidator>,
    OneOrZeroArgs extends
      ArgsArrayForOptionalValidator<ArgsValidator> = DefaultArgsForOptionalValidator<ArgsValidator>,
  >(
    func:
      | {
          args?: ArgsValidator;
          returns?: ReturnsValidator;
          handler: (ctx: GenericMutationCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue;
        }
      | ((ctx: GenericMutationCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue)
  ): RegisteredMutation<"internal", ArgsArrayToObject<OneOrZeroArgs>, ReturnValue> => {
    const handler = typeof func === "function" ? func : func.handler;
    const argsValidator = typeof func === "object" ? func.args : undefined;
    const returnsValidator = typeof func === "object" ? func.returns : undefined;

    return {
      isConvexFunction: true,
      isMutation: true,
      isInternal: true,
      _argsValidator: argsValidator,
      _returnsValidator: returnsValidator,
      _handler: ((ctx: GenericMutationCtx<any>, args: ArgsArrayToObject<OneOrZeroArgs>) => {
        return (handler as any)(ctx, args);
      }) as any,
      async invokeMutation(_argsStr: string): Promise<string> {
        throw new Error("Not implemented - use runner");
      },
      exportArgs(): string {
        return argsValidator ? JSON.stringify(asObjectValidator(argsValidator).json) : "{}";
      },
      exportReturns(): string {
        return returnsValidator ? JSON.stringify(asObjectValidator(returnsValidator).json) : "any";
      },
    } as any;
  }) as MutationBuilder<DataModel, "internal">;
};
