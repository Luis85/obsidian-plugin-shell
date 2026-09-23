/** Exact positive ownership markers; never infer a boundary from a substring. */
export function ownsSelector(selector, id) {
  const nodes = selector.nodes.filter(node => node.type !== 'comment');
  const first = nodes[0];
  const classIs = (node, name) => node?.type === 'class' && node.value === name;
  const attributeIs = (node, name, value) => node?.type === 'attribute' && node.attribute === name && node.operator === '=' && node.value === value;
  // These two native adaptations target only explicitly marked owned containers.
  if (nodes.length === 1 && classIs(first, `${id}-host`)) return true;
  if (nodes.length === 4 && classIs(first, `${id}-native-header-hidden`)
    && attributeIs(nodes[1], 'data-type', `${id}-showcase`)
    && nodes[2].type === 'combinator' && nodes[2].value.trim() === '>'
    && classIs(nodes[3], 'view-header')) return true;
  const boundary = nodes.find(node => node.type === 'combinator');
  if (boundary && ['+', '~', '||'].includes(boundary.value.trim())) return false;
  if (classIs(first, id) || attributeIs(first, 'data-plugin-ui', id)) return true;
  return first?.type === 'pseudo' && [':where', ':is'].includes(first.value)
    && first.nodes.length > 0 && first.nodes.every(child => ownsSelector(child, id));
}

/** Shared ownership policy; each build/check entry supplies its parser dependency. */
export function assertCssOwnership(root, id, selectorParser) {
  root.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    selectorParser(selectors => { selectors.each(selector => { if (!ownsSelector(selector, id)) throw new Error(`UNSCOPED_RULE:${selector}`); }); }).processSync(rule.selector);
  });
}
