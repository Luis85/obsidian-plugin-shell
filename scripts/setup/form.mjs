// Dependency-free reader for the shared form format (configs/forms, bin/domain/form.ts), limited to
// the subset npm run setup asks before dependencies or TypeScript tooling exist. Anything else fails closed.
import { readFile } from 'node:fs/promises';
export const identityKeys = Object.freeze(['id', 'name', 'description', 'author', 'repo', 'version']);
/** The platform question; its conditional Azure DevOps details are asked by scripts/setup/hosting.mjs (this subset has no conditions). */
export const hostingFieldKeys = Object.freeze(['hosting']);
const textKeys = Object.freeze([...identityKeys, ...hostingFieldKeys]);
export const confirmKeys = Object.freeze(['mcp']);
const formKeys = new Set(['$schema', 'schemaVersion', 'id', 'version', 'title', 'description', 'fields']);
const fieldKeys = { text: new Set(['id', 'kind', 'label', 'help']), confirm: new Set(['id', 'kind', 'label', 'help']) };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
function fail(message) { throw new Error(`Setup form: ${message}`); }
function line(value, name, max, multiline = false) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || (multiline ? /[\x00-\x09\x0b-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(value)) fail(`${name} must be text up to ${max} characters without control characters`);
  return value;
}
function unknown(item, allowed, name) {
  const extra = Object.keys(item).filter(key => !allowed.has(key));
  if (extra.length) fail(`${name} uses keys npm run setup does not support: ${extra.join(', ')}`);
}
function readField(item, index, seen) {
  const name = `fields[${index}]`;
  if (!plain(item)) fail(`${name} must be an object`);
  if (!Object.hasOwn(fieldKeys, item.kind)) fail(`${name}.kind ${JSON.stringify(item.kind)} is not supported by npm run setup (text or confirm only)`);
  unknown(item, fieldKeys[item.kind], name);
  const id = line(item.id, `${name}.id`, 60);
  if (!/^[a-z][a-zA-Z0-9]*$/.test(id) || seen.has(id)) fail(`${name}.id must be a unique identifier`);
  seen.add(id);
  return Object.freeze({ id, kind: item.kind, label: line(item.label, `${name}.label`, 300),
    ...(item.help === undefined ? {} : { help: line(item.help, `${name}.help`, 2000, true) }) });
}
function sameKeys(actual, expected) { return actual.length === expected.length && expected.every(key => actual.includes(key)); }
/** Validates the supported subset and the --answers contract: text fields are exactly the identity keys plus hosting, confirm fields exactly mcp. */
export function readSetupForm(value) {
  if (!plain(value)) fail('definition must be a JSON object');
  unknown(value, formKeys, 'form');
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.version) || value.version < 1) fail('unsupported schemaVersion or version');
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(line(value.id, 'id', 80))) fail('id must be lowercase kebab-case');
  line(value.title, 'title', 200);
  if (value.description !== undefined) line(value.description, 'description', 2000, true);
  if (!Array.isArray(value.fields) || !value.fields.length) fail('fields must be a non-empty array');
  const seen = new Set(), fields = value.fields.map((item, index) => readField(item, index, seen));
  const ids = kind => fields.filter(field => field.kind === kind).map(field => field.id);
  if (!sameKeys(ids('text'), textKeys)) fail(`text field ids must be exactly the answers keys ${textKeys.join(', ')}`);
  if (!sameKeys(ids('confirm'), confirmKeys)) fail(`confirm field ids must be exactly ${confirmKeys.join(', ')}`);
  return Object.freeze({ id: value.id, version: value.version, title: value.title, fields: Object.freeze(fields) });
}
export async function loadSetupForm(url) {
  let text;
  try { text = await readFile(url, 'utf8'); } catch (error) { fail(`cannot read ${url instanceof URL ? url.pathname : url} (${error.code ?? error.message})`); }
  let parsed;
  try { parsed = JSON.parse(text); } catch { fail('definition is not valid JSON'); }
  return readSetupForm(parsed);
}
/**
 * Asks the fields in definition order through a readline-style `question`. Enter keeps the shown default
 * (validated later by planIdentity); confirm is explicit agreement, default No. Fields in `skip` are not asked.
 * Help text goes through `write` before its question. Returns only answered keys: the shape of an --answers object.
 */
export async function askSetupForm(form, prompt, { defaults = {}, skip = [], write = () => {} } = {}) {
  const answers = {};
  for (const field of form.fields) {
    if (skip.includes(field.id)) continue;
    if (field.help) write(`${field.help}\n`);
    if (field.kind === 'confirm') {
      answers[field.id] = /^y(es)?$/i.test((await prompt.question(`${field.label} [y/N] `)).trim());
      continue;
    }
    const answer = (await prompt.question(`${field.label} (${field.id}) [${defaults[field.id] ?? 'none'}]: `)).trim();
    if (answer) answers[field.id] = answer;
  }
  return answers;
}
