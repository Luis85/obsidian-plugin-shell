import { object, keys, list, text } from './data.ts';
import { requireSketch } from './errors.ts';
import { collectionField, collectionStatus, type CollectionDefinition, type CollectionField } from './collection-definition.ts';
import type { CollectionHook, CollectionRecord, CollectionValues } from './collection-record.ts';
import { collectionTableText } from './collection-register.ts';
/** The `model` section of configs/collections/risk.json: score = product of the factors; level = highest threshold reached. */
export interface RiskScoringModel { factors: CollectionField[]; score: string; level: string; levels: Array<{ level: string; min: number }> }
const fail = (message: string) => `model: ${message}`;
function factorOf(definition: CollectionDefinition, key: unknown): CollectionField {
  const field = collectionField(definition, String(key));
  requireSketch(field && field.kind === 'integer' && field.vocabulary && field.source === 'input', 'RISK_MODEL', fail(`factor ${String(key)} must be an input integer field with a scale vocabulary.`));
  return field;
}
const scale = (definition: CollectionDefinition, field: CollectionField) => definition.vocabularies[field.vocabulary!]!.map(item => Number(item.id));
function bounds(definition: CollectionDefinition, factors: readonly CollectionField[]): [number, number] {
  return factors.reduce<[number, number]>(([low, high], field) => [low * Math.min(...scale(definition, field)), high * Math.max(...scale(definition, field))], [1, 1]);
}
/** Fail-closed reading of the scoring model against the definition's fields and vocabularies. */
export function riskScoringModel(definition: CollectionDefinition): RiskScoringModel {
  const raw = object(definition.model); keys(raw, ['factors', 'score', 'level', 'levels']);
  const factors = list(raw.factors, 'model.factors', 4).map(key => factorOf(definition, key));
  requireSketch(factors.length >= 2 && new Set(factors.map(field => field.key)).size === factors.length, 'RISK_MODEL', fail('use at least two different factors, for example probability and impact.'));
  requireSketch(factors.every(field => scale(definition, field).every(value => value >= 1)), 'RISK_MODEL', fail('factor scales start at 1.'));
  const score = collectionField(definition, text(raw.score, 'model.score', 40)), level = collectionField(definition, text(raw.level, 'model.level', 40));
  requireSketch(score?.kind === 'integer' && score.source === 'derived' && !score.vocabulary, 'RISK_MODEL', fail('score must name a derived integer field.'));
  requireSketch(level?.kind === 'choice' && level.source === 'derived', 'RISK_MODEL', fail('level must name a derived choice field.'));
  const levels = list(raw.levels, 'model.levels', 10).map((item, index) => {
    const entry = object(item); keys(entry, ['level', 'min']);
    requireSketch(Number.isSafeInteger(entry.min), 'RISK_MODEL', fail(`levels[${index}].min must be a whole number.`));
    return { level: text(entry.level, `model.levels[${index}].level`, 40), min: Number(entry.min) };
  });
  const [low, high] = bounds(definition, factors);
  requireSketch(JSON.stringify(levels.map(item => item.level)) === JSON.stringify(definition.vocabularies[level.vocabulary!]!.map(item => item.id)), 'RISK_MODEL', fail('levels must list every level of its vocabulary, lowest first.'));
  requireSketch(levels.every((item, index) => index === 0 || item.min > levels[index - 1]!.min), 'RISK_MODEL', fail('level thresholds must rise strictly.'));
  requireSketch(levels[0]!.min <= low && levels.at(-1)!.min <= high, 'RISK_MODEL', fail(`thresholds must cover scores ${low}–${high}: the first starts at or below ${low}, the last at or below ${high}.`));
  return { factors, score: score.key, level: level.key, levels };
}
/** The score and level of one set of values; nothing when a factor is missing. */
export function riskScore(model: RiskScoringModel, values: Readonly<CollectionValues>): CollectionValues {
  const factors = model.factors.map(field => values[field.key]);
  if (!factors.every(value => typeof value === 'number')) return {};
  const score = factors.reduce<number>((product, value) => product * Number(value), 1);
  return { [model.score]: score, [model.level]: model.levels.filter(item => item.min <= score).at(-1)!.level };
}
/** Open risks placed by their first two factors, highest first factor on top, with the score and level of each cell. */
export function riskMatrix(definition: CollectionDefinition, model: RiskScoringModel, records: readonly CollectionRecord[]): string {
  if (model.factors.length !== 2) return '';
  const [rows, columns] = model.factors as [CollectionField, CollectionField];
  const rowScale = [...definition.vocabularies[rows.vocabulary!]!].reverse(), columnScale = definition.vocabularies[columns.vocabulary!]!;
  const levels = definition.vocabularies[collectionField(definition, model.level)!.vocabulary!]!;
  const open = records.filter(record => collectionStatus(definition, record.status)?.open);
  const lines = [`### ${rows.label} × ${columns.label}`, '', `_Open notes only; each cell shows its score and level._`, '',
    `| ${rows.label} ↓ / ${columns.label} → | ${columnScale.map(item => collectionTableText(`${item.id} ${item.label}`)).join(' | ')} |`,
    `| --- | ${columnScale.map(() => '---').join(' | ')} |`];
  for (const row of rowScale) {
    const cells = columnScale.map(column => {
      const derived = riskScore({ ...model, factors: [rows, columns] }, { [rows.key]: Number(row.id), [columns.key]: Number(column.id) });
      const ids = open.filter(record => String(record.values[rows.key]) === row.id && String(record.values[columns.key]) === column.id).map(record => record.id);
      const label = levels.find(item => item.id === derived[model.level])?.label ?? '';
      return `${String(derived[model.score])} ${label}${ids.length ? ': ' + ids.join(', ') : ''}`;
    });
    lines.push(`| ${collectionTableText(`${row.id} ${row.label}`)} | ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}
/** The `risk.scoring` collection hook named by configs/collections/risk.json. */
export const riskScoringHook: CollectionHook = {
  readModel: definition => { riskScoringModel(definition); },
  derive: (values, definition) => riskScore(riskScoringModel(definition), values),
  report: (records, definition) => riskMatrix(definition, riskScoringModel(definition), records),
};
