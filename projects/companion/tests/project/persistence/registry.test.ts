import { it, expect } from 'vitest';
import { createFeatures } from "../../../src/bootstrap/features.ts";
import { PluginDataStore } from "../../../src/application/plugin-data-store.ts";
import { PreferenceService } from "../../../src/application/preference-service.ts";
import { markdownCodec } from "../../../src/infrastructure/markdown.ts";
import { success, failure } from "../../../src/domain/outcome.ts";
it('composes every generated repository with the actual retained framework registry', async () => {
  const errors={report:()=>{}}; const events={publish:()=>{}};
  const data=new PluginDataStore({load:async()=>null,save:async()=>{}},errors);
  const preferences=new PreferenceService(data,events,errors); await preferences.load();
  const storage={list:async()=>success([] as string[]),read:async()=>failure('storage','error.read'),create:async()=>success(undefined),replace:async()=>success(undefined),trash:async()=>success(undefined)};
  const registry=createFeatures({storage,codec:markdownCodec,events,errors,pluginData:data,newId:()=> 'fixture-id',now:()=> '2026-01-01T00:00:00Z'},preferences);
  try { expect((await registry.repositories.GRequirement.list()).ok).toBe(true);
expect((await registry.repositories.GScreen.list()).ok).toBe(true);
expect((await registry.repositories.GComponent.list()).ok).toBe(true);
expect((await registry.repositories.GTestRecipe.list()).ok).toBe(true);
expect((await registry.repositories.GPluginProject.list()).ok).toBe(true);
expect((await registry.repositories.GDataSource.list()).ok).toBe(true);
expect((await registry.repositories.GSourceOperation.list()).ok).toBe(true);
expect((await registry.repositories.GDesignToken.list()).ok).toBe(true); }
  finally { registry.dispose(); preferences.dispose(); data.dispose(); }
});
