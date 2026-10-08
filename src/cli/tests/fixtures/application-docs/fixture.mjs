import { newDocument } from '../../../domain/document.ts';
import { addPage } from '../../../domain/pages.ts';
import { addComponent, attachComponents } from '../../../domain/components.ts';
import { addInteraction, setInteractionAction } from '../../../domain/interactions.ts';
import { validateAuthoringDocument } from '#shared/companion/authoring-contract.ts';
/** Real v6 authoring commands construct a linked fixture; no mock project validator. */
export function projectFixture() {
  const project = newDocument('Documentation Demo');
  const overview = addPage(project, 'Overview'), details = addPage(project, 'Details');
  const component = addComponent(project, 'Record list');
  const [instance] = attachComponents(project, overview, [{ kind: 'existing', id: component }]);
  const interaction = addInteraction(project, overview, 'Open details', instance);
  setInteractionAction(project, overview, interaction, { kind: 'navigate', surfaceId: details });
  project.design.links.push({ id: 'link-details', from: overview, to: details, kind: 'navigate', label: 'Open details' });
  project.design.sitemap.journeys.push({ id: 'journey-review', name: 'Review a record', steps: [
    { id: 'step-overview', surface: overview, via: null }, { id: 'step-details', surface: details, via: 'link-details' },
  ] });
  validateAuthoringDocument(project);
  return { project, overview, details, component, instance, interaction };
}
