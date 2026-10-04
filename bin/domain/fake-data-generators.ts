import { object } from './data.ts';
import { requireSketch } from './errors.ts';
/** Obsidian property types a fake-data entity can declare. */
export type FakePropertyType = 'text' | 'number' | 'checkbox' | 'date' | 'datetime' | 'list' | 'tags' | 'link';
export const fakePropertyTypes: readonly FakePropertyType[] = ['text', 'number', 'checkbox', 'date', 'datetime', 'list', 'tags', 'link'];
export type FakeArgs = Readonly<Record<string, number | string>>;
type Output = 'text' | 'number' | 'boolean' | 'date';
type ArgKind = 'int' | 'float' | 'probability' | 'isoDate' | 'years' | 'days' | 'count' | 'digits' | 'length' | 'age';
interface MethodSpec { readonly output: Output; readonly args?: Readonly<Record<string, ArgKind>>; readonly required?: readonly string[]; readonly defaults?: FakeArgs; readonly label: string }
const range = { min: 'count', max: 'count' } as const;
/**
 * The complete allowlist of Faker methods a definition may name. Definitions are data: a method outside this table,
 * an unknown argument or an out-of-range value fails closed. Email addresses only use reserved example domains.
 */
export const fakerMethods: Readonly<Record<string, MethodSpec>> = Object.freeze({
  'person.fullName': { output: 'text', label: 'Full name' },
  'person.firstName': { output: 'text', label: 'First name' },
  'person.lastName': { output: 'text', label: 'Last name' },
  'person.jobTitle': { output: 'text', label: 'Job title' },
  'person.bio': { output: 'text', label: 'Short bio' },
  'internet.exampleEmail': { output: 'text', label: 'Email at a reserved example domain' },
  'internet.username': { output: 'text', label: 'Username' },
  'company.name': { output: 'text', label: 'Company name' },
  'company.catchPhrase': { output: 'text', label: 'Catch phrase' },
  'company.buzzPhrase': { output: 'text', label: 'Buzz phrase' },
  'location.city': { output: 'text', label: 'City' },
  'location.country': { output: 'text', label: 'Country' },
  'book.title': { output: 'text', label: 'Book title' },
  'book.author': { output: 'text', label: 'Book author' },
  'book.genre': { output: 'text', label: 'Book genre' },
  'book.publisher': { output: 'text', label: 'Book publisher' },
  'music.genre': { output: 'text', label: 'Music genre' },
  'music.songName': { output: 'text', label: 'Song name' },
  'commerce.productName': { output: 'text', label: 'Product name' },
  'commerce.department': { output: 'text', label: 'Department' },
  'color.human': { output: 'text', label: 'Colour name' },
  'word.noun': { output: 'text', label: 'Noun' },
  'word.adjective': { output: 'text', label: 'Adjective' },
  'lorem.word': { output: 'text', label: 'Lorem word' },
  'lorem.words': { output: 'text', args: range, defaults: { min: 2, max: 4 }, label: 'Lorem words' },
  'lorem.sentence': { output: 'text', args: range, defaults: { min: 4, max: 8 }, label: 'Lorem sentence' },
  'lorem.paragraph': { output: 'text', args: range, defaults: { min: 2, max: 4 }, label: 'Lorem paragraph' },
  'lorem.paragraphs': { output: 'text', args: range, defaults: { min: 1, max: 3 }, label: 'Lorem paragraphs (body text)' },
  'string.uuid': { output: 'text', label: 'UUID' },
  'string.alphanumeric': { output: 'text', args: { length: 'length' }, defaults: { length: 8 }, label: 'Alphanumeric code' },
  'number.int': { output: 'number', args: { min: 'int', max: 'int' }, defaults: { min: 0, max: 100 }, label: 'Whole number' },
  'number.float': { output: 'number', args: { min: 'float', max: 'float', fractionDigits: 'digits' }, defaults: { min: 0, max: 100, fractionDigits: 2 }, label: 'Decimal number' },
  'datatype.boolean': { output: 'boolean', args: { probability: 'probability' }, defaults: { probability: 0.5 }, label: 'Yes or no' },
  'date.past': { output: 'date', args: { years: 'years' }, defaults: { years: 1 }, label: 'Date in the past' },
  'date.future': { output: 'date', args: { years: 'years' }, defaults: { years: 1 }, label: 'Date in the future' },
  'date.recent': { output: 'date', args: { days: 'days' }, defaults: { days: 30 }, label: 'Recent date' },
  'date.soon': { output: 'date', args: { days: 'days' }, defaults: { days: 30 }, label: 'Upcoming date' },
  'date.between': { output: 'date', args: { from: 'isoDate', to: 'isoDate' }, required: ['from', 'to'], label: 'Date in a fixed range' },
  'date.birthdate': { output: 'date', args: { min: 'age', max: 'age' }, defaults: { min: 18, max: 80 }, label: 'Birthday (age range)' },
});
/** Which property types each generator output may fill; list types repeat a text-like generator. */
const compatible: Readonly<Record<Output, readonly FakePropertyType[]>> = {
  text: ['text', 'list', 'tags', 'link'], number: ['number', 'text', 'list'], boolean: ['checkbox', 'text'], date: ['date', 'datetime', 'text'],
};
const integerBounds: Readonly<Record<string, readonly [number, number]>> = {
  int: [-1e9, 1e9], years: [1, 100], days: [1, 3650], count: [1, 50], digits: [0, 6], length: [1, 64], age: [0, 120],
};
const isoDate = /^(?:19|20|21)\d\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
export function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && isoDate.test(value) && new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) === value;
}
function argument(kind: ArgKind, value: unknown, name: string): number | string {
  if (kind === 'isoDate') { requireSketch(validIsoDate(value), 'FAKE_DATA_ARGS', `${name} needs a YYYY-MM-DD date.`); return value; }
  requireSketch(typeof value === 'number' && Number.isFinite(value), 'FAKE_DATA_ARGS', `${name} needs a number.`);
  if (kind === 'float') { requireSketch(Math.abs(value) <= 1e9, 'FAKE_DATA_ARGS', `${name} must be between -1e9 and 1e9.`); return value; }
  if (kind === 'probability') { requireSketch(value >= 0 && value <= 1, 'FAKE_DATA_ARGS', `${name} must be between 0 and 1.`); return value; }
  const [min, max] = integerBounds[kind]!;
  requireSketch(Number.isSafeInteger(value) && value >= min && value <= max, 'FAKE_DATA_ARGS', `${name} must be a whole number from ${min} to ${max}.`);
  return value;
}
/** Validate a generator method, its JSON-only arguments and its fit with the property type. */
export function fakerCall(method: unknown, raw: unknown, type: FakePropertyType, name: string): { faker: string; args: FakeArgs } {
  requireSketch(typeof method === 'string' && Object.hasOwn(fakerMethods, method), 'FAKE_DATA_GENERATOR', `${name}.faker must be an allowlisted generator such as person.fullName; see fake-data generators.`);
  const spec = fakerMethods[method]!;
  requireSketch(compatible[spec.output].includes(type), 'FAKE_DATA_GENERATOR', `${name}.faker ${method} cannot fill a ${type} property.`);
  const given = raw === undefined ? {} : object(raw), allowed = spec.args ?? {};
  const unknown = Object.keys(given).filter(key => !Object.hasOwn(allowed, key));
  requireSketch(!unknown.length, 'FAKE_DATA_ARGS', `${name}.args has unsupported keys: ${unknown.join(', ')}.`);
  const args: Record<string, number | string> = { ...spec.defaults };
  for (const [key, value] of Object.entries(given)) args[key] = argument(allowed[key]!, value, `${name}.args.${key}`);
  for (const key of spec.required ?? []) requireSketch(Object.hasOwn(args, key), 'FAKE_DATA_ARGS', `${name}.args.${key} is required for ${method}.`);
  const low = args.min ?? args.from, high = args.max ?? args.to;
  requireSketch(low === undefined || high === undefined || low <= high, 'FAKE_DATA_ARGS', `${name}.args needs a lower bound that does not exceed the upper bound.`);
  return { faker: method, args: Object.freeze(args) };
}
/** Generator choices that can fill one property type, for interactive definition. */
export function generatorsFor(type: FakePropertyType): Array<{ id: string; label: string }> {
  return Object.entries(fakerMethods).filter(([, spec]) => compatible[spec.output].includes(type)).map(([id, spec]) => ({ id, label: `${spec.label} (${id})` }));
}
