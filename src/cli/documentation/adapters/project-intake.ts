import { createFilePlan } from '../../../../scripts/shared/file-plan.ts';
import { configurationPlan } from '../../adapters/framework/changes.ts';
import type { AuthoringDocument } from '../../../../scripts/companion/authoring-contract.ts';
import { docsObject as object, insist } from '../domain/contracts.ts';
import { decode } from './filesystem.ts';
import type { Workspace } from './workspace.ts';
/** Legacy generation ownership stays on its existing writer; maker projects use their configured canonical file. */
export async function documentationProjectIntake(workspace: Workspace, proposed: AuthoringDocument) {
  const content = JSON.stringify(proposed, null, 2) + '\n';
  if (workspace.config) {
    insist(workspace.projectPath === 'design/project.json', 'DOCS_PROJECT_PATH', 'Legacy shell configuration owns design/project.json. Reconcile a conflicting maker path explicitly.');
    return configurationPlan({ command: 'project import', args: [], options: { input: '-', resolve: 'import' } },
      { root: workspace.root, frameworkRoot: workspace.root, inputText: content });
  }
  insist(workspace.makerSetupBytes, 'DOCS_SETUP_REQUIRED', 'Import into an initialized shell or maker project; run setup first.');
  const setup = object(JSON.parse(decode(workspace.makerSetupBytes)));
  insist(setup.schemaVersion === 1 && setup.phase === 'prepared' && object(setup.paths).project === workspace.projectPath,
    'DOCS_SETUP_REQUIRED', 'Setup metadata does not identify the configured canonical project.');
  const plan = await createFilePlan(workspace.root, [
    { path: workspace.projectPath, content },
    { path: 'configs/project-setup.json', content: decode(workspace.makerSetupBytes) },
  ]);
  return { plan };
}
