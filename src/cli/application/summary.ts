import type { SketchDocument } from '../domain/document.ts';
import { pageNodes } from '../domain/pages.ts';
import { interactions } from '../domain/interactions.ts';
export function outline(document: SketchDocument) {
  return { project: document.project, sitemap: document.design.sitemap, semantic: document.design.semantic, dataSources: document.design.dataSources, prds: document.design.prds, pages: document.design.nodes.filter(item => !['group', 'action'].includes(item.kind)).map(item => ({
    id: item.id, title: item.label, kind: item.kind,
    nodes: pageNodes(document, item.id).map(node => ({ id: node.id, title: node.name, kind: node.kind })),
    interactions: interactions(document, item.id).map(({ interaction }) => ({ id: interaction.id, title: interaction.label, actions: interaction.actions })),
  })), components: document.design.visualDesigns.components.map(item => ({ id: item.id,
    title: document.design.library.find(entry => entry.id === item.libraryId)?.name ?? item.exportName, exportName: item.exportName })) };
}
