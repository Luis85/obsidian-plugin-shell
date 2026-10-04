import selectorParser from 'postcss-selector-parser';
import { ownsSelector } from './css-identity.mjs';
/** Runs in Vite's CSS pipeline after Tailwind generation, in dev and production. */
export function cssOwnership(id = 'plugin-shell') {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error('INVALID_CSS_IDENTITY');
  // A dedicated exact owner class avoids repeating the long data-attribute syntax
  // on every utility selector. The readable data-plugin-ui marker remains on roots.
  const scope = `.ps--${id}`;
  const prefix = id === 'plugin-shell' ? 'ps' : id;
  const owned = value => value.replace(/plugin-shell(?=-|$)/g, id);
  return {
    postcssPlugin: 'plugin-shell-css-ownership',
    OnceExit(root) {
      if (root.source?.input.file?.replaceAll('\\', '/').includes('/harness/')) return;
      // Layered framework rules otherwise lose to Obsidian's unlayered native rules.
      root.walkAtRules('layer', rule => { if (rule.nodes) rule.replaceWith(...rule.nodes); else rule.remove(); });
      const names = new Map();
      root.walkAtRules(/keyframes$/, rule => { const name = rule.params; const target = name.startsWith(`${prefix}-`) ? name : `${prefix}-${name}`; names.set(name, target); rule.params = target; });
      root.walkAtRules('property', rule => { rule.params = owned(rule.params).replace(/--tw-/g, `--${prefix}-tw-`); });
      root.walkAtRules('container', rule => { rule.params = rule.params.replace(/\bplugin-shell-leaf\b/g, `${id}-leaf`); });
      root.walkDecls(decl => {
        decl.prop = decl.prop.replace(/--plugin-shell-/g, `--${id}-`).replace(/--tw-/g, `--${prefix}-tw-`);
        decl.value = decl.value.replace(/--plugin-shell-/g, `--${id}-`).replace(/--tw-/g, `--${prefix}-tw-`);
        if (decl.prop === 'container' || decl.prop === 'container-name') decl.value = decl.value.replace(/\bplugin-shell-leaf\b/g, `${id}-leaf`);
        if (/^(animation|animation-name)$/.test(decl.prop)) {
          for (const [name, target] of names) decl.value = decl.value.replace(new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g'), target);
        }
      });
      root.walkRules(rule => {
        if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
        rule.selector = selectorParser(selectors => {
          selectors.each(selector => {
            selector.walkClasses(node => {
              if (node.value === 'ph--plugin-shell') node.value = `ph--${id}`;
              else if (node.value === 'plugin-shell' || node.value.startsWith('plugin-shell-')) node.value = owned(node.value);
            });
            selector.walkAttributes(node => {
              if ((['data-plugin-ui', 'data-plugin-view-owner'].includes(node.attribute) && node.value === 'plugin-shell') || (node.attribute === 'data-type' && node.value === 'plugin-shell-showcase')) node.setValue(owned(node.value), { quoteMark: '"' });
            });
            selector.walkPseudos(node => {
              if (node.value === ':root' || node.value === ':host') {
                node.replaceWith(selectorParser.attribute({ attribute: 'data-plugin-ui', operator: '=', value: id, quoteMark: '"' }));
              }
            });
            if (ownsSelector(selector, id)) return;
            const prefix = selectorParser().astSync(`${scope} `).first;
            selector.prepend(selectorParser.combinator({ value: ' ' }));
            selector.prepend(prefix.nodes[0].clone());
          });
        }).processSync(rule.selector);
      });
    },
  };
}
