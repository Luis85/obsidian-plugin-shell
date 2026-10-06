import { parse } from 'vue/compiler-sfc';
import { relative, resolve, sep, isAbsolute } from 'node:path';
/** A serve-only Vue SFC transform. Runtime and vendor templates are never rewritten on disk. */
export function inspectorPlugin(root, sourceRoot) {
  const authored = resolve(root, sourceRoot);
  return { name: 'shell-authored-source-locations', enforce: 'pre', apply: 'serve',
    transform(source, id) {
      if (!id.endsWith('.vue') || id.includes('?')) return null;
      const path = relative(authored, id);
      if (!path || isAbsolute(path) || path === '..' || path.startsWith('..' + sep)) return null;
      const parsed = parse(source, { filename: id });
      if (parsed.errors.length) return null; // The Vue compiler owns user-facing syntax diagnostics.
      const ast = parsed.descriptor.template?.ast;
      if (!ast) return null;
      const edits = [];
      const file = relative(root, id).split(sep).join('/');
      const attr = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
      function visit(node) {
        if (node.type === 1 && !['template', 'slot'].includes(node.tag) &&
          !node.props.some(prop => prop.name === 'data-v-inspector')) {
          const start = node.loc.start;
          edits.push({ at: start.offset + 1 + node.tag.length,
            value: ` data-v-inspector="${attr(file)}:${start.line}:${start.column}"` });
        }
        for (const child of node.children ?? []) visit(child);
      }
      visit(ast);
      let code = source;
      for (const edit of edits.sort((a, b) => b.at - a.at)) code = code.slice(0, edit.at) + edit.value + code.slice(edit.at);
      return edits.length ? { code, map: null } : null;
    },
  };
}
