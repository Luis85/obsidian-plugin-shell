import { literal } from '../../emitters/model.ts';
import { VISUAL_DOM_EVENTS, type UiNode, type ValueExpression, type Interaction, type Contract } from '../../../../../scripts/companion/visual/visual-ir.mjs';
import { compositionStyle } from '../../../../../scripts/companion/composition-contract.mjs';
export interface AngularDefinition { key: string; name: string; selector: string; nodes: UiNode[]; contract?: Contract; adapterRequired?: string; designSystem?: unknown }
export interface AngularGap { definition: string; node: string; reason: string }
const attr = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
/** Native tags/attribute names have already passed canonical visual validation; values remain data bindings. */
export function angularDefinitionSource(definition: AngularDefinition, definitions: AngularDefinition[], gaps: AngularGap[], designSystem?: unknown): string {
  const styles: string[] = [':host{display:block}:host[hidden],[hidden]{display:none!important}.wb-slot{display:contents}'];
  const bindings: ValueExpression[] = [], interactions: Interaction[] = [], imports = new Map<string, AngularDefinition>();
  function value(expression: ValueExpression): string {
    if (expression.kind === 'source') gaps.push({ definition: definition.key, node: expression.sourceId, reason: 'External source expression requires an adapter.' });
    return `read(${bindings.push(expression) - 1})`;
  }
  function events(list: Interaction[], emitted: readonly string[] = []): string {
    const indices = list.map(item => {
      if (!item.actions.length) gaps.push({ definition: definition.key, node: item.id, reason: 'Interaction has no implemented action: ' + item.label });
      for (const action of item.actions) if (action.kind === 'source') gaps.push({ definition: definition.key, node: item.id, reason: 'Data-source action requires an explicit provider adapter.' });
      return interactions.push(item) - 1;
    });
    const grouped = new Map<string, number[]>(), custom: number[] = [];
    for (const index of indices) {
      const event = interactions[index]!.event;
      if (emitted.includes(event)) { custom.push(index); continue; }
      if (VISUAL_DOM_EVENTS.includes(event)) grouped.set(event, [...grouped.get(event) ?? [], index]);
      else gaps.push({ definition: definition.key, node: interactions[index]!.id, reason: 'Unsupported native event: ' + event });
    }
    const native = [...grouped].map(([name, ids]) => `(${name})="${ids.map(id => `on(${id}, $event)`).join('; ')}"`).join(' ');
    return native + (custom.length ? ` (emitted)="onEmitted(${attr(literal(custom))}, $event)"` : '');
  }
  function common(node: UiNode): string {
    const attributes = [`[attr.data-wb-node]="key('${node.id}')"`, `[hidden]="!visible('${node.id}', ${attr(literal(node.visibleIn ?? []))})"`];
    if (node.a11y) attributes.push(`[attr.aria-description]="${value({ kind: 'literal', value: node.a11y })}"`);
    if (node.layout) {
      const region = { kind: 'region', ui: node.layout.ui, layout: node.layout.mode };
      const css = (narrow: boolean) => Object.entries(compositionStyle(region, designSystem, narrow)).map(([name, val]) =>
        name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()) + ':' + val).join(';');
      styles.push(`.wb-${node.id}{${css(false)}}`);
      styles.push(`@container wb-view (max-width:40rem){.wb-${node.id}{${css(true)}${node.layout.ui.narrow.hidden ? ';display:none' : ''}}}`);
      attributes.push(`class="wb-${node.id}"`);
      attributes.push(`data-wb-layout="${node.layout.mode}"`);
    }
    return attributes.join(' ');
  }
  function children(nodes: UiNode[]): string { return nodes.map(render).join('\n'); }
  function component(node: Extract<UiNode, { kind: 'component' }>): string {
    const ref = node.ref;
    if (ref.kind !== 'project') return unsupported(node, 'Nuxt UI component ' + ref.entryId + ' requires an Angular adapter.');
    const target = definitions.find(item => item.key === (ref.revisionId ?? ref.componentId));
    if (!target) return unsupported(node, 'Missing project component definition.');
    imports.set(target.key, target);
    const declared = Object.fromEntries((target.contract?.props ?? []).filter(prop => prop.default !== undefined).map(prop => [prop.name, { kind: 'literal', value: prop.default } as ValueExpression]));
    const variant = target.contract?.variants.find(item => item.id === node.variantId);
    const defaults = { ...declared, ...(variant ? Object.fromEntries(Object.entries(variant.values).map(([key, item]) => [key, { kind: 'literal', value: item } as ValueExpression])) : {}) };
    const props = '{' + Object.entries({ ...defaults, ...node.props }).map(([key, expression]) => literal(key) + ':' + value(expression)).join(',') + '}';
    const slots = Object.entries(node.slots).map(([name, nodes]) => `<div slot="${attr(name)}" class="wb-slot">${children(nodes)}</div>`).join('\n');
    return `<${target.selector} ${common(node)} [ui]="ui()" [scope]="key('${node.id}')" [values]="${attr(props)}" ${events(node.events, target.contract?.emits.map(item => item.name))}>${slots}</${target.selector}>`;
  }
  function unsupported(node: UiNode, reason: string): string {
    gaps.push({ definition: definition.key, node: node.id, reason });
    return `<p role="status" data-adapter-required="${node.id}" ${common(node)} [textContent]="${value({ kind: 'literal', value: reason })}"></p>`;
  }
  function render(node: UiNode): string {
    if (node.kind === 'component') return component(node);
    if (node.kind === 'external') return unsupported(node, 'External component ' + node.package + '/' + node.adapter + ' requires an adapter.');
    if (node.kind === 'slot') return `<div ${common(node)}${node.layout ? '' : ' class="wb-slot"'}><ng-content select="[slot=${attr(node.name)}]">${children(node.fallback)}</ng-content></div>`;
    if (node.kind === 'text') return `<${node.role} ${common(node)} [textContent]="${value(node.value)}"></${node.role}>`;
    const attributes = Object.entries(node.attrs).map(([name, expression]) => {
      const binding = value(expression);
      return name === 'src' ? `[src]="source(${binding})"` : `[attr.${name}]="${binding}"`;
    }).join(' ');
    const open = `<${node.tag} ${common(node)} ${attributes} ${events(node.events)}>`;
    return ['input', 'img'].includes(node.tag) ? open : open + children(node.children) + `</${node.tag}>`;
  }
  const template = definition.adapterRequired
    ? unsupported({ kind: 'text', id: definition.key, role: 'p', value: { kind: 'literal', value: '' } }, definition.adapterRequired)
    : children(definition.nodes);
  return `import { Component } from '@angular/core';\nimport { BrickContext } from './brick-runtime.ts';\n${[...imports.values()].map(item => `import { ${item.name} } from './${item.name}.ts';`).join('\n')}\n@Component({ selector: ${literal(definition.selector)}, standalone: true, imports: [${[...imports.values()].map(item => item.name).join(', ')}],\n  template: ${literal(template)}, styles: [${literal(styles.join("\n"))}] })\nexport class ${definition.name} extends BrickContext {\n  override bindings = ${literal(bindings)};\n  override interactions = ${literal(interactions)};\n  override emitTypes = ${literal(Object.fromEntries((definition.contract?.emits ?? []).map(item => [item.name, item.payloadType])))};\n}\n`;
}
