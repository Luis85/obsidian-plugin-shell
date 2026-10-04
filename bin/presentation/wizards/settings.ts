import { documentationSettings } from '../../adapters/settings-documentation.ts';
import { settingsMigrationPlan } from '../../adapters/settings-migration.ts';
import { loadSettings, settingsPlan, guardedText } from '../../adapters/user-settings.ts';
import { readSettings, setupStatePath, type UserSettings } from '../../domain/user-settings.ts';
import type { Values } from '../../domain/form-model.ts';
import { review } from '../review.ts';
import type { WizardModule } from './module.ts';
/** Hooks and actions behind configs/forms/user-settings*.json, documentation-settings.json and configs/wizards/settings.json. */
export const settingsModule: WizardModule = {
  hooks: {
    commit: {
      'settings.read': value => readSettings(value),
      /** Authored content is always preserved and conflicts reviewed; the documentation owner validates the result. */
      'documentation.commit': (value, parent) => {
        const documentation = { ...(parent.documentation as Values | undefined), ...value, preserveAuthoredContent: true, conflictPolicy: 'review', deleteMissing: false };
        documentationSettings({ ...readSettings(parent), documentation });
        return documentation;
      },
    },
    prepare: { 'documentation.prepare': parent => ({ ...structuredClone(documentationSettings(readSettings(parent))) }) },
    effects: {
      'documentation.reset-folders': (value, answer) => {
        if (answer === true) value.paths = Object.fromEntries(Object.keys(value.paths as Values).map(key => [key, `${String(value.root)}/${key}`]));
      },
    },
  },
  actions: {
    'settings.load': async ({ state, options }) => {
      const loaded = await loadSettings(options.root);
      state.current = loaded.settings; state.settings = structuredClone(loaded.settings);
    },
    /** Moving paths of an initialized project is a migration plan; otherwise a settings plan. Both are reviewed. */
    'settings.review': async ({ ui, state, options }) => {
      const settings = state.settings as UserSettings, current = state.current as UserSettings;
      const initialized = (await guardedText(options.root, setupStatePath)).content !== null;
      const moved = JSON.stringify(settings.paths) !== JSON.stringify(current.paths);
      const plan = initialized && moved ? await settingsMigrationPlan(options.root, settings) : await settingsPlan(options.root, settings);
      await review(ui, plan, options.signal);
    },
  },
};
