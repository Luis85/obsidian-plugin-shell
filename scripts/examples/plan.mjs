import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createFilePlan } from '../shared/file-plan.ts';
import { readRegistry, validateRegistrySource } from '../../bin/adapters/makers/registry.ts';

const digest = value => createHash('sha256').update(value).digest('hex');
function validateManifest(manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.files) || !Array.isArray(manifest.registrations)) throw new Error('EXAMPLES_INVALID_MANIFEST');
  for (const item of manifest.files) {
    if (!item || typeof item.path !== 'string' || (item.sha256 !== null && !/^[a-f0-9]{64}$/.test(item.sha256 ?? '')) ||
      (Object.hasOwn(item, 'template') && (typeof item.template !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.txt$/.test(item.template) || item.template.includes('..'))) ||
      (Object.hasOwn(item, 'generated') && item.generated !== 'retain')) throw new Error('EXAMPLES_INVALID_MANIFEST');
  }
  const locals = new Set(); const keys = new Set(); const imports = new Set();
  for (const item of manifest.registrations) {
    if (!item || !/^[a-zA-Z_$][\w$]*$/.test(item.key ?? '') || !/^[a-zA-Z_$][\w$]*$/.test(item.local ?? '') ||
      !/^\.\.\/features\/[a-z0-9-]+\/[a-zA-Z0-9.-]+$/.test(item.from ?? '') || typeof item.expression !== 'string' || !item.expression ||
      locals.has(item.local) || keys.has(item.key) || imports.has(item.from)) throw new Error('EXAMPLES_INVALID_REGISTRATION_MANIFEST');
    locals.add(item.local); keys.add(item.key); imports.add(item.from);
  }
}
/** Only the reviewed imports and registered property nodes are eligible for removal. */
async function withoutExamples(root, expected) {
  const probe = await createFilePlan(root, [{ path: 'src/bootstrap/features.ts', content: null }]);
  const registry = await readRegistry(root);
  if (digest(registry.source) !== probe.changes[0].beforeHash) throw new Error('EXAMPLES_STALE_INPUT: ' + registry.path);
  const ts = await import('typescript');
  const ast = ts.createSourceFile(registry.path, registry.source, ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
  const canonical = (node, source = ast) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  const edits = []; const removed = []; const owned = new Map(expected.map(item => [item.local, item]));
  const paths = new Map(expected.map(item => [item.from, item]));
  function edit(start, end, replacement) {
    // Outside trivia remains untouched. Inline comments inside removed syntax
    // need the author's review; never silently discard their text.
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, registry.source, undefined, start, end - start);
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) throw new Error('EXAMPLES_INLINE_COMMENT: move or reconcile comments inside the removed syntax');
    }
    edits.push([start, end, replacement]);
  }
  let callback; let object;
  function locate(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createNoteFeatures') {
      callback = node.arguments[1];
      const body = callback.body;
      object = ts.isParenthesizedExpression(body) ? body.expression : body;
    }
    ts.forEachChild(node, locate);
  }
  locate(ast);
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || !paths.has(node.moduleSpecifier.text)) continue;
    const item = paths.get(node.moduleSpecifier.text); const bindings = node.importClause?.namedBindings;
    if (node.importClause?.name || node.importClause?.isTypeOnly || !bindings || !ts.isNamedImports(bindings) || bindings.elements.length !== 1 ||
      bindings.elements[0].name.text !== item.local || bindings.elements[0].propertyName || bindings.elements[0].isTypeOnly) throw new Error('EXAMPLES_EDITED_IMPORT');
    edit(node.getStart(ast), node.end, ''); removed.push(node);
  }
  let removedEntries = 0;
  for (const node of object.properties) {
    const local = node.initializer.arguments[0].text; const item = owned.get(local);
    if (!item) continue;
    const expectedAst = ts.createSourceFile('expected.ts', item.expression + ';', ts.ScriptTarget.Latest, true);
    const statement = expectedAst.statements[0];
    if (expectedAst.parseDiagnostics.length || expectedAst.statements.length !== 1 || !ts.isExpressionStatement(statement) ||
      !ts.isCallExpression(statement.expression) || node.name.text !== item.key || canonical(node.initializer) !== canonical(statement.expression, expectedAst)) throw new Error('EXAMPLES_EDITED_REGISTRATION');
    const registered = registry.registrations.find(entry => entry.local === local);
    if (!registered || registered.exported !== local || registered.from !== item.from) throw new Error('EXAMPLES_EDITED_REGISTRATION');
    edit(node.getStart(ast), node.end, '');
    const children = object.getChildren(ast).find(child => child.kind === ts.SyntaxKind.SyntaxList)?.getChildren(ast);
    const index = children?.indexOf(node) ?? -1;
    if (index < 0) throw new Error('EXAMPLES_UNKNOWN_PROPERTY_RANGE');
    const separator = children[index + 1];
    if (separator?.kind === ts.SyntaxKind.CommaToken) edit(separator.getStart(ast), separator.end, '');
    removed.push(node); removedEntries++;
  }
  function checkReferences(node) {
    if (removed.some(parent => node.pos >= parent.pos && node.end <= parent.end)) return;
    if (ts.isIdentifier(node) && owned.has(node.text)) throw new Error('EXAMPLES_SURVIVING_REFERENCE: ' + node.text);
    ts.forEachChild(node, checkReferences);
  }
  checkReferences(ast);
  if (object.properties.length === removedEntries && callback.parameters.length) {
    if (callback.modifiers?.length) throw new Error('EXAMPLES_UNSUPPORTED_CALLBACK');
    edit(callback.getStart(ast), callback.equalsGreaterThanToken.getStart(ast), '() ');
  }
  // Retain the author-facing parameter spelling, including consumer uses. A single
  // explicit no-op keeps the empty foundation factory valid under no-unused-vars.
  for (const statement of ast.statements) {
    if (!ts.isFunctionDeclaration(statement) || statement.name?.text !== 'createFeatures' || !statement.body ||
      !statement.parameters.some(parameter => ts.isIdentifier(parameter.name) && parameter.name.text === 'preferences' && parameter.type?.getText(ast) === 'PreferenceService')) continue;
    const already = statement.body.statements.some(node => ts.isExpressionStatement(node) && ts.isVoidExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'preferences');
    if (!already) edits.push([statement.body.getStart(ast) + 1, statement.body.getStart(ast) + 1, '\n  void preferences;']);
  }
  let content = registry.source;
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) content = content.slice(0, start) + replacement + content.slice(end);
  await validateRegistrySource(content);
  return { path: registry.path, original: registry.source, content };
}

const receiptPath = '.companion/generation.json';
/** A generated project's ownership receipt: the hash the generator recorded for each file it wrote. */
async function generationReceipt(root) {
  const probe = await createFilePlan(root, [{ path: receiptPath, content: null }]);
  if (probe.changes[0].beforeHash === null) return null;
  const bytes = await readFile(resolve(root, receiptPath));
  if (digest(bytes) !== probe.changes[0].beforeHash) throw new Error('EXAMPLES_STALE_INPUT: ' + receiptPath);
  let receipt;
  try { receipt = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('EXAMPLES_INVALID_RECEIPT: ' + receiptPath); }
  if (receipt?.version !== 1 || !Array.isArray(receipt.files)) throw new Error('EXAMPLES_INVALID_RECEIPT: ' + receiptPath);
  const hashes = new Map();
  for (const file of receipt.files) {
    if (typeof file?.path !== 'string' || !/^[a-f0-9]{64}$/.test(file.hash ?? '') || hashes.has(file.path)) throw new Error('EXAMPLES_INVALID_RECEIPT: ' + receiptPath);
    hashes.set(file.path, file.hash);
  }
  return { hash: digest(bytes), hashes };
}
/**
 * Ownership manifest is reviewed source, never inferred from a directory name. A `generated: "retain"` file belongs
 * to a generated project (for example its README): there its reviewed preimage is the hash the generation receipt
 * recorded, it is kept unchanged, and any later edit conflicts exactly like an edited example file.
 */
export async function planExampleRemoval(root, { beforeFinalize } = {}) {
  const manifestPath = 'scripts/examples/ownership.json';
  const manifestProbe = await createFilePlan(root, [{ path: manifestPath, content: null }]);
  const manifestBytes = await readFile(resolve(root, manifestPath));
  if (digest(manifestBytes) !== manifestProbe.changes[0].beforeHash) throw new Error('EXAMPLES_STALE_MANIFEST');
  const manifest = JSON.parse(manifestBytes.toString('utf8')); validateManifest(manifest);
  const entries = []; const inspected = new Map(); const inputs = new Map([[manifestPath, digest(manifestBytes)]]); const conflicts = [];
  const receipt = await generationReceipt(root), retained = [];
  if (receipt) inputs.set(receiptPath, receipt.hash);
  for (const item of manifest.files) {
    const probe = await createFilePlan(root, [{ path: item.path, content: null }]);
    const currentHash = probe.changes[0].beforeHash;
    if (receipt && item.generated === 'retain') {
      if (!receipt.hashes.has(item.path)) throw new Error('EXAMPLES_UNRECORDED_GENERATED_FILE: ' + item.path);
      if (currentHash !== receipt.hashes.get(item.path)) conflicts.push(item.path); else retained.push(item.path);
      continue;
    }
    let content = null;
    if (item.template) {
      const path = 'templates/examples/' + item.template;
      const templateProbe = await createFilePlan(root, [{ path, content: null }]);
      content = await readFile(resolve(root, path), 'utf8');
      if (digest(content) !== templateProbe.changes[0].beforeHash) throw new Error('EXAMPLES_STALE_TEMPLATE: ' + path);
      inputs.set(path, digest(content));
    }
    const targetHash = content === null ? null : digest(content);
    if (currentHash !== item.sha256 && currentHash !== targetHash) conflicts.push(item.path);
    entries.push({ path: item.path, content }); inspected.set(item.path, currentHash);
  }
  if (conflicts.length) throw new Error('EXAMPLES_EDITED_FILES: ' + conflicts.join(', ') + '. Preserve these files and reconcile their example dependencies before removal.');
  const registry = await withoutExamples(root, manifest.registrations);
  entries.push({ path: registry.path, content: registry.content }); inspected.set(registry.path, digest(registry.original));
  await beforeFinalize?.();
  const sourceProbe = await createFilePlan(root, [...inputs.keys()].map(path => ({ path, content: null })));
  for (const entry of sourceProbe.changes) if (inputs.get(entry.path) !== entry.beforeHash) throw new Error('EXAMPLES_STALE_TEMPLATE_OR_MANIFEST: ' + entry.path);
  const plan = await createFilePlan(root, entries);
  for (const entry of plan.changes) if (inspected.get(entry.path) !== entry.beforeHash) throw new Error('EXAMPLES_STALE_INPUT: ' + entry.path);
  return { version: 1, status: 'planned', profile: 'foundation', plan,
    preserved: ['consumer features and registrations', 'edited files (conflict)', 'vaults, notes and plugin data', ...retained.map(path => `${path} (generated project file, receipt hash verified)`)],
    next: ['npm run verify', 'npm run test:e2e', 'npm run make -- feature bookmarks --entity bookmark'] };
}

