/**
 * Pending acceptance test stubs of an Increment, planned with its documents through the Definition of Ready's own
 * generator (`scripts/delivery/acceptance-stubs.mjs` `planStubs`): one file per criterion at `acceptance.pattern`,
 * rendered from `acceptance.template`, never overwritten, and an empty `Evidence:` set to the stub. Without a
 * project delivery.json the framework's defaults and template apply.
 */
import { join } from 'node:path';
import { readBounded } from '../framework/files.ts';
import { planStubs as generatorPlan } from '../../../../scripts/delivery/acceptance-stubs.mjs';
import { parseHandoff } from '../../../../scripts/delivery/handoff.mjs';
import type { Session } from './session.ts';

export interface StubReport { created: string[]; existing: string[]; orphans: string[]; evidence: string[] }
interface AcceptanceSettings { pattern: string; template: string; maxSlugLength: number; evidencePattern: string }
/** The defaults of scripts/delivery/config.mjs for a delivery.json without (or without some) acceptance keys. */
const defaults = { template: 'configs/delivery/acceptance-stub.template.md', maxSlugLength: 48, evidencePattern: '^tests/.+\\.(?:checks|test|spec)\\.[cm]?[jt]s$' };

async function settings(session: Session): Promise<AcceptanceSettings> {
  const raw = await session.ws.read('configs/delivery/delivery.json');
  const parsed: unknown = raw ? JSON.parse(raw) : null;
  const given: unknown = parsed && typeof parsed === 'object' && 'acceptance' in parsed ? parsed.acceptance : null;
  const configured = typeof given === 'string' ? { pattern: given } : given && typeof given === 'object' ? given : {};
  return { ...defaults, pattern: session.ws.schema.acceptance.pattern, ...configured };
}
/** The project's stub template, else the framework's. */
async function template(session: Session, path: string): Promise<string> {
  const own = await session.ws.read(path);
  return own ?? new TextDecoder().decode(await readBounded(join(session.ws.context.frameworkRoot, defaults.template)));
}
const paths = (list: readonly unknown[]): string[] => list.filter((item): item is string => typeof item === 'string');
/** Plans the stubs and default evidence of every criterion of the Increment as it will be after the plan. */
export async function planAcceptanceStubs(session: Session, incrementId: string): Promise<StubReport> {
  const path = session.ws.path('increment', incrementId), text = (await session.text(path))!, acceptance = await settings(session);
  const plan = generatorPlan(acceptance, { incrementId, incrementPath: path, incrementText: text, model: parseHandoff(text), files: await session.ws.files(), template: await template(session, acceptance.template) });
  for (const stub of plan.create) session.write(stub.path, stub.text);
  session.write(path, plan.incrementText);
  const orphans = paths(plan.orphans);
  for (const orphan of orphans) session.warn('ACCEPTANCE_STUB_ORPHAN', `${orphan} matches no acceptance criterion; rename or delete it.`);
  return { created: plan.create.map(stub => stub.path), existing: paths(plan.existing), orphans, evidence: paths(plan.evidence) };
}
