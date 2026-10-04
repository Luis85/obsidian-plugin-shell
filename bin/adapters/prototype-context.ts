import { resolve } from 'node:path';
import { savedProjectSelection } from './project-selection.ts';
import { projectGuide } from './projects.ts';
import { loadGuide } from './prototype.ts';
/** Continuing a selected project retains its framework, including with a custom interview. */
export async function prototypeContext(root: string, explicitGuide?: string, config?: string) {
  const selection = await savedProjectSelection(root, config);
  const guide = explicitGuide ? await loadGuide(resolve(root, explicitGuide))
    : selection ? await projectGuide(selection) : await loadGuide();
  return { selection, guide };
}
