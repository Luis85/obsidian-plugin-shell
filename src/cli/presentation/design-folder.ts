/** Offers a Claude Design folder right after a prototype or project is created; nothing is written without review. */
import { designFolderPlan, type DesignFolderOptions } from '../adapters/design-folder.ts';
import { loadSettings } from '../adapters/user-settings.ts';
import { designRoot } from '../domain/user-settings.ts';
import { designFolderSlug } from '../domain/design-folder.ts';
import { review } from './review.ts';
import { confirm, reportError, type Prompts } from '#tui/prompts.ts';
/** briefFrom names a prepared design-brief.md outside the root; its text is kept inside the design folder. */
export type DesignOffer = Omit<DesignFolderOptions, 'mode' | 'name' | 'briefFile'> & { title: string; briefFrom?: string };
export async function offerDesignFolder(ui: Prompts, offer: DesignOffer): Promise<string | undefined> {
  try {
    const name = designFolderSlug(offer.title), folder = `${designRoot((await loadSettings(offer.root)).settings.paths)}/${name}`;
    if (!await confirm(ui, `Create a Claude Design folder at ${folder}? It holds the brief, screens, tokens and agent instructions for a design-to-code handoff.`)) return;
    ui.rich?.busy('Preparing the design folder. No files written yet.');
    const { briefFrom, ...options } = offer;
    const plan = await designFolderPlan({ ...options, name, mode: 'prepare', ...(briefFrom ? { briefFile: briefFrom } : {}) });
    if (!await review(ui, plan, offer.signal)) { ui.write('No design folder written.\n'); return; }
    const completion = `Design folder ready: ${folder}. Import it into Claude Design; keep it current with node bin/app design sync --name ${name}.\n`;
    ui.write(completion); return completion;
  } catch (error) { reportError(ui, error); }
}
