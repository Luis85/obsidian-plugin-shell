import { Faker, base, en } from '@faker-js/faker';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { FakeArgs } from '../domain/fake-data-generators.ts';
import type { FakeSource } from '../domain/fake-data.ts';
type Call = (faker: Faker, args: FakeArgs) => unknown;
const number = (args: FakeArgs, key: string) => Number(args[key]);
const range = (args: FakeArgs) => ({ min: number(args, 'min'), max: number(args, 'max') });
/**
 * Explicit dispatch for every allowlisted method in src/cli/domain/fake-data-generators.ts; nothing is looked up by path,
 * so a definition can never reach another Faker function. Tests assert both tables name the same methods.
 */
export const fakerCalls: Readonly<Record<string, Call>> = Object.freeze({
  'person.fullName': f => f.person.fullName(), 'person.firstName': f => f.person.firstName(), 'person.lastName': f => f.person.lastName(),
  'person.jobTitle': f => f.person.jobTitle(), 'person.bio': f => f.person.bio(),
  'internet.exampleEmail': f => f.internet.exampleEmail(), 'internet.username': f => f.internet.username(),
  'company.name': f => f.company.name(), 'company.catchPhrase': f => f.company.catchPhrase(), 'company.buzzPhrase': f => f.company.buzzPhrase(),
  'location.city': f => f.location.city(), 'location.country': f => f.location.country(),
  'book.title': f => f.book.title(), 'book.author': f => f.book.author(), 'book.genre': f => f.book.genre(), 'book.publisher': f => f.book.publisher(),
  'music.genre': f => f.music.genre(), 'music.songName': f => f.music.songName(),
  'commerce.productName': f => f.commerce.productName(), 'commerce.department': f => f.commerce.department(),
  'color.human': f => f.color.human(), 'word.noun': f => f.word.noun(), 'word.adjective': f => f.word.adjective(), 'lorem.word': f => f.lorem.word(),
  'lorem.words': (f, a) => f.lorem.words(range(a)), 'lorem.sentence': (f, a) => f.lorem.sentence(range(a)),
  'lorem.paragraph': (f, a) => f.lorem.paragraph(range(a)), 'lorem.paragraphs': (f, a) => f.lorem.paragraphs(range(a), '\n\n'),
  'string.uuid': f => f.string.uuid(), 'string.alphanumeric': (f, a) => f.string.alphanumeric({ length: number(a, 'length') }),
  'number.int': (f, a) => f.number.int(range(a)),
  'number.float': (f, a) => f.number.float({ ...range(a), fractionDigits: number(a, 'fractionDigits') }),
  'datatype.boolean': (f, a) => f.datatype.boolean({ probability: number(a, 'probability') }),
  'date.past': (f, a) => f.date.past({ years: number(a, 'years') }), 'date.future': (f, a) => f.date.future({ years: number(a, 'years') }),
  'date.recent': (f, a) => f.date.recent({ days: number(a, 'days') }), 'date.soon': (f, a) => f.date.soon({ days: number(a, 'days') }),
  'date.between': (f, a) => f.date.between({ from: `${String(a.from)}T00:00:00.000Z`, to: `${String(a.to)}T23:59:59.000Z` }),
  'date.birthdate': (f, a) => f.date.birthdate({ ...range(a), mode: 'age' }),
});
/** One seeded English Faker per run. The fixed reference date keeps relative dates (past, soon, birthdate) reproducible. */
export function fakerSource(seed: number, referenceDate: string): FakeSource {
  const faker = new Faker({ locale: [en, base] });
  faker.seed(seed);
  faker.setDefaultRefDate(`${referenceDate}T00:00:00.000Z`);
  return {
    call(method, args) {
      requireSketch(Object.hasOwn(fakerCalls, method), 'FAKE_DATA_GENERATOR', `Generator ${method} is not allowlisted.`);
      return fakerCalls[method]!(faker, args);
    },
    int: (min, max) => faker.number.int({ min, max }),
  };
}
