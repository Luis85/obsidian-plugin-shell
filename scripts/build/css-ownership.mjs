import selectorParser from 'postcss-selector-parser';
const scope = '[data-plugin-ui="plugin-shell"]';
/** Runs in Vite's CSS pipeline after Tailwind generation, in dev and production. */
export function cssOwnership() {
  return {
    postcssPlugin: 'plugin-shell-css-ownership',
    OnceExit(root) {
      if (root.source?.input.file?.replaceAll("\\\\", "/").includes("/harness/")) return;
      // Layered framework rules otherwise lose to Obsidian's unlayered native rules.
      root.walkAtRules('layer', rule => { if (rule.nodes) rule.replaceWith(...rule.nodes); else rule.remove(); });
      root.walkAtRules(/keyframes$/, rule => { if (!rule.params.startsWith('ps-')) rule.params = `ps-${rule.params}`; });
      root.walkAtRules('property', rule => { rule.params = rule.params.replace(/--tw-/g, '--ps-tw-'); });
      root.walkDecls(decl => {
        decl.prop = decl.prop.replace(/--tw-/g, '--ps-tw-');
        decl.value = decl.value.replace(/--tw-/g, '--ps-tw-');
        if (/^(animation|animation-name)$/.test(decl.prop)) {
          const names = []; root.walkAtRules(/keyframes$/, r => names.push(r.params.slice(3)));
          for (const name of names) decl.value = decl.value.replace(new RegExp(`(?<![\\w-])${name}(?![\\w-])`, 'g'), `ps-${name}`);
        }
      });
      root.walkRules(rule => {
        if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
        rule.selector = selectorParser(selectors => {
          selectors.each(selector => {
            let rootFound = false;
            selector.walkPseudos(node => {
              if (node.value === ':root' || node.value === ':host') {
                node.replaceWith(selectorParser.attribute({ attribute: 'data-plugin-ui', operator: '=', value: 'plugin-shell', quoteMark: '"' })); rootFound = true;
              }
            });
            const current = selector.toString();
            if (current.includes('[data-plugin-ui=') || current.includes('.plugin-shell')) return;
            if (!rootFound) {
              const prefix = selectorParser().astSync(`${scope} `).first;
              selector.prepend(selectorParser.combinator({ value: ' ' }));
              selector.prepend(prefix.nodes[0].clone());
            }
          });
        }).processSync(rule.selector);
      });
    },
  };
}
