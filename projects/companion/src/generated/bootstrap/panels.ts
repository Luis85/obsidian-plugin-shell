import GWorkbench from '../presentation/components/screens/workbench-screen.vue';
import GOverview from '../presentation/components/screens/overview-screen.vue';
import GStarters from '../presentation/components/screens/starters-screen.vue';
import GRequirements from '../presentation/components/screens/requirements-screen.vue';
import GStorymaps from '../presentation/components/screens/storymaps-screen.vue';
import GStorymapDetail from '../presentation/components/screens/storymap-detail.vue';
import GSitemap from '../presentation/components/screens/sitemap-screen.vue';
import GPages from '../presentation/components/screens/pages-screen.vue';
import GPageEditor from '../presentation/components/screens/page-editor.vue';
import GComponentEditor from '../presentation/components/screens/component-editor.vue';
import GEntities from '../presentation/components/screens/entities-screen.vue';
import GSources from '../presentation/components/screens/sources-screen.vue';
import GTestData from '../presentation/components/screens/test-data.vue';
import GDesignSystem from '../presentation/components/screens/design-system.vue';
import GComponents from '../presentation/components/screens/components-screen.vue';
import GBlueprints from '../presentation/components/screens/blueprints-screen.vue';
import GPatterns from '../presentation/components/screens/patterns-screen.vue';
import GPrepare from '../presentation/components/screens/prepare-screen.vue';
import GGenerate from '../presentation/components/screens/generate-screen.vue';
import GDevelop from '../presentation/components/screens/develop-screen.vue';
import GQuality from '../presentation/components/screens/quality-screen.vue';
import GCapabilities from '../presentation/components/screens/capabilities-screen.vue';
import GRelease from '../presentation/components/screens/release-screen.vue';
import GRuns from '../presentation/components/screens/runs-screen.vue';
import GPreferences from '../presentation/components/screens/preferences-screen.vue';
import GImportProject from '../presentation/components/screens/import-project.vue';
import GExportProject from '../presentation/components/screens/export-project.vue';
import GShellHandoff from '../presentation/components/screens/shell-handoff.vue';
import type { Component } from 'vue';
export const panels: Record<string,Component> = {"node-1": GWorkbench,
"node-3": GOverview,
"node-5": GStarters,
"node-7": GRequirements,
"node-9": GStorymaps,
"node-11": GStorymapDetail,
"node-13": GSitemap,
"node-15": GPages,
"node-17": GPageEditor,
"node-19": GComponentEditor,
"node-21": GEntities,
"node-23": GSources,
"node-25": GTestData,
"node-27": GDesignSystem,
"node-29": GComponents,
"node-31": GBlueprints,
"node-33": GPatterns,
"node-35": GPrepare,
"node-37": GGenerate,
"node-39": GDevelop,
"node-41": GQuality,
"node-43": GCapabilities,
"node-45": GRelease,
"node-47": GRuns,
"node-49": GPreferences,
"node-50": GImportProject,
"node-52": GExportProject,
"node-54": GShellHandoff};
