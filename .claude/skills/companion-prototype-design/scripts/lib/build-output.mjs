/** Inspect bundler outputs, not source text claims about which framework was used. */
export function singleBundle(result) {
  const bundles = Array.isArray(result) ? result : [result];
  if (bundles.length !== 1 || !Array.isArray(bundles[0]?.output)) throw new Error('PROTOTYPE_BUNDLE: expected one output');
  const outputs = bundles[0].output;
  const chunks = outputs.filter(file => file.type === 'chunk');
  const assets = outputs.filter(file => file.type === 'asset');
  if (chunks.length !== 1 || !chunks[0].isEntry || chunks[0].imports.length || chunks[0].dynamicImports.length) {
    throw new Error('PROTOTYPE_BUNDLE: all JavaScript must be in the single entry');
  }
  if (assets.length !== 1 || !assets[0].fileName.endsWith('.css')) throw new Error('PROTOTYPE_BUNDLE: exactly one CSS asset; inline all other assets');
  const used = Object.entries(chunks[0].modules).filter(([, value]) => value.renderedLength > 0).map(([id]) => id.replaceAll('\\', '/'));
  const packages = { vue: /\/node_modules\/(?:@vue\/runtime-(?:core|dom)|vue)\//,
    pinia: /\/node_modules\/pinia\//, '@nuxt/ui': /\/node_modules\/@nuxt\/ui\// };
  for (const [name, pattern] of Object.entries(packages)) {
    if (!used.some(id => pattern.test(id))) throw new Error(`PROTOTYPE_STACK: compiled output must actually use ${name}`);
  }
  return { javascript: chunks[0].code, css: typeof assets[0].source === 'string' ? assets[0].source : new TextDecoder('utf-8', { fatal: true }).decode(assets[0].source),
    modules: used.map(id => id.includes('/node_modules/') ? id.split('/node_modules/').at(-1) : null).filter(Boolean).sort() };
}
