import { type GListInput, type GListOutput, isGListInput, isGListOutput, type GCreateInput, type GCreateOutput, isGCreateInput, isGCreateOutput, type GUpdateInput, type GUpdateOutput, isGUpdateInput, isGUpdateOutput, type GDeleteInput, type GDeleteOutput, isGDeleteInput, isGDeleteOutput, type GTestRecipesPort } from './contracts.ts';
/** Canonical behavior belongs in this service/adapter, not the per-view Pinia store. */
export function createGTestRecipesService(port: GTestRecipesPort) {
  return {
    async "list"(input: GListInput, signal?: AbortSignal): Promise<GListOutput> {
      if (signal?.aborted) throw new Error('OPERATION_ABORTED');
      if (!isGListInput(input)) throw new Error('INVALID_INPUT: test-recipes/list');
      const value = await port["list"](input,signal);
      if (!isGListOutput(value)) throw new Error('INVALID_OUTPUT: test-recipes/list');
      return value;
    },
    async "create"(input: GCreateInput, signal?: AbortSignal): Promise<GCreateOutput> {
      if (signal?.aborted) throw new Error('OPERATION_ABORTED');
      if (!isGCreateInput(input)) throw new Error('INVALID_INPUT: test-recipes/create');
      const value = await port["create"](input,signal);
      if (!isGCreateOutput(value)) throw new Error('INVALID_OUTPUT: test-recipes/create');
      return value;
    },
    async "update"(input: GUpdateInput, signal?: AbortSignal): Promise<GUpdateOutput> {
      if (signal?.aborted) throw new Error('OPERATION_ABORTED');
      if (!isGUpdateInput(input)) throw new Error('INVALID_INPUT: test-recipes/update');
      const value = await port["update"](input,signal);
      if (!isGUpdateOutput(value)) throw new Error('INVALID_OUTPUT: test-recipes/update');
      return value;
    },
    async "delete"(input: GDeleteInput, signal?: AbortSignal): Promise<GDeleteOutput> {
      if (signal?.aborted) throw new Error('OPERATION_ABORTED');
      if (!isGDeleteInput(input)) throw new Error('INVALID_INPUT: test-recipes/delete');
      const value = await port["delete"](input,signal);
      if (!isGDeleteOutput(value)) throw new Error('INVALID_OUTPUT: test-recipes/delete');
      return value;
    },
  };
}
export type GTestRecipesService = ReturnType<typeof createGTestRecipesService>;
