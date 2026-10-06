/**
 * The single exception the self-review guard (scripts/quality/self-review.mjs) makes for a pending test: an
 * added line that matches `acceptance.pendingPattern` (and no focus or skip call), in a generated stub
 * (`ac-<n>…`) directly inside the configured acceptance folder of an Increment whose status is still one of
 * `acceptance.pendingStatuses`. A pending marker anywhere else, or once the Increment is Done, stays a finding;
 * a missing or invalid delivery configuration allows nothing.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { configFiles, validateDeliveryConfig } from './config.mjs';
import { parseFrontmatter } from './handoff.mjs';
import { stubLayout } from './acceptance-stubs.mjs';

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const focusOrSkip = /\.(?:only|skip|fixme|skipIf|runIf)\s*\(|\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(/;

/** The Increment id of a stub path, or null when the path is not a stub directly in an acceptance folder. */
export function stubIncrement(settings, path) {
  const [before, after] = stubLayout(settings).folder.split('{increment}').map(escape);
  return new RegExp(`^${before}([a-z0-9][a-z0-9-]*)${after}/ac-\\d+[-.][^/]*$`, 'u').exec(path)?.[1] ?? null;
}

/** Pure decision: may this added line of `path` keep a pending marker? `statusOf(id)` reads the Increment status. */
export function pendingAllowed(delivery, path, line, statusOf) {
  const settings = delivery.acceptance;
  const id = stubIncrement(settings, path);
  if (!id || !new RegExp(settings.pendingPattern, 'u').test(line ?? '') || focusOrSkip.test(line)) return false;
  return settings.pendingStatuses.includes(statusOf(id));
}

/** The allowance for a checkout: (path, line) => boolean, reading the configuration and Increment statuses once. */
export async function pendingStubAllowance(root) {
  let delivery;
  try { delivery = validateDeliveryConfig(JSON.parse(await readFile(join(root, configFiles.delivery), 'utf8'))); } catch { return () => false; }
  const statuses = new Map();
  const status = async id => {
    const text = await readFile(join(root, delivery.handoff.glob.replace('*', id)), 'utf8').catch(() => '');
    return parseFrontmatter(text.replace(/\r\n?/g, '\n').split('\n')).data.status ?? null;
  };
  return async (path, line) => {
    const id = stubIncrement(delivery.acceptance, path);
    if (id && !statuses.has(id)) statuses.set(id, await status(id));
    return pendingAllowed(delivery, path, line, key => statuses.get(key));
  };
}
