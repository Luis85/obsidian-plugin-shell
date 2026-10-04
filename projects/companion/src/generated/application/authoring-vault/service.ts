import { type GListRequirementsInput, type GListRequirementsOutput, isGListRequirementsInput, isGListRequirementsOutput, type GListSitemapInput, type GListSitemapOutput, isGListSitemapInput, isGListSitemapOutput, type GListComponentsInput, type GListComponentsOutput, isGListComponentsInput, isGListComponentsOutput, type GAuthoringVaultPort } from './contracts.ts';
/** Canonical behavior belongs in this service/adapter, not the per-view Pinia store. */
export function createGAuthoringVaultService(port: GAuthoringVaultPort) {
  return {
    async "list-requirements"(input: GListRequirementsInput, signal?: AbortSignal): Promise<GListRequirementsOutput> {
      if (signal?.aborted) throw new Error('OPERATION_ABORTED');
      if (!isGListRequirementsInput(input)) throw new Error('INVALID_INPUT: authoring-vault/list-requirements');
      const value = await port["list-requirements"](input,signal);
      if (!isGListRequirementsOutput(value)) throw new Error('INVALID_OUTPUT: authoring-vault/list-requirements');
      return value;
    },
    async "list-sitemap"(input: GListSitemapInput, signal?: AbortSignal): Promise<GListSitemapOutput> {
      if (signal?.aborted) throw new Error('OPERATION_ABORTED');
      if (!isGListSitemapInput(input)) throw new Error('INVALID_INPUT: authoring-vault/list-sitemap');
      const value = await port["list-sitemap"](input,signal);
      if (!isGListSitemapOutput(value)) throw new Error('INVALID_OUTPUT: authoring-vault/list-sitemap');
      return value;
    },
    async "list-components"(input: GListComponentsInput, signal?: AbortSignal): Promise<GListComponentsOutput> {
      if (signal?.aborted) throw new Error('OPERATION_ABORTED');
      if (!isGListComponentsInput(input)) throw new Error('INVALID_INPUT: authoring-vault/list-components');
      const value = await port["list-components"](input,signal);
      if (!isGListComponentsOutput(value)) throw new Error('INVALID_OUTPUT: authoring-vault/list-components');
      return value;
    },
  };
}
export type GAuthoringVaultService = ReturnType<typeof createGAuthoringVaultService>;
