import { join, resolve } from 'node:path';
import { planFixtures, applyFixtures } from '../../../docs/concepts/companion/test-kit/storage.mjs';
import { readConfiguration, readJson } from './files.ts';
import { object } from './configuration.ts';
import { requireThat, result, stringOption, type Context, type Request } from './contracts.ts';

interface FixturePlan {
  mode: unknown;
  approval: string;
  target: unknown;
  changes: unknown;
  blockers: unknown[];
  bytes: unknown;
}

interface FixtureApplied {
  unchanged: boolean;
  [key: string]: unknown;
}

interface FixtureDependencies {
  readConfiguration: typeof readConfiguration;
  readJson: typeof readJson;
  planFixtures: (root: string, manifest: Record<string, unknown>, options: { reset: boolean }) => Promise<FixturePlan>;
  applyFixtures: (
    root: string,
    manifest: Record<string, unknown>,
    approval: string,
    options: { reset: boolean },
  ) => Promise<FixtureApplied>;
}

const defaults: FixtureDependencies = {
  readConfiguration,
  readJson,
  planFixtures,
  applyFixtures,
};

/** Real fixture materialization uses the existing shared engine and its own ownership receipts. */
export async function fixtureOperation(
  request: Request,
  context: Context,
  dependencies: FixtureDependencies = defaults,
) {
  const input = stringOption(request.options, 'input');
  requireThat(input, 'INPUT_REQUIRED', 'Supply the exported test-data manifest with --input.');

  const config = await dependencies.readConfiguration(context.root);
  requireThat(config, 'CONFIG_REQUIRED', 'Configure the project first.');
  requireThat(
    config.paths.testVaultFolder === '.test-vault',
    'FIXTURE_TARGET_UNSUPPORTED',
    'The v1 fixture engine supports only the explicit .test-vault target. No production fallback is allowed.',
  );

  const manifest = object(await dependencies.readJson(resolve(context.root, input)));
  requireThat(
    manifest.target === config.paths.testVaultFolder,
    'FIXTURE_TARGET',
    'Fixture manifest target differs from project configuration.',
  );

  const reset = request.command.startsWith('data reset');
  const plan = await dependencies.planFixtures(context.root, manifest, { reset });
  const preview = {
    mode: plan.mode,
    approval: plan.approval,
    target: plan.target,
    changes: plan.changes,
    blockers: plan.blockers,
    bytes: plan.bytes,
  };

  if (request.command.endsWith('plan') || request.options['dry-run']) {
    return result(request.command, preview, plan.blockers.length ? 'blocked' : 'planned');
  }

  const approval = stringOption(request.options, 'apply');
  requireThat(
    approval,
    'FIXTURE_APPROVAL',
    'Pass --apply with the exact fixture-plan hash. --yes cannot replace this approval.',
  );

  const marker = object(await dependencies.readJson(
    join(context.root, config.paths.testVaultFolder, '.framework-vault.json'),
  ));
  requireThat(
    marker.projectId === config.project.id,
    'VAULT_REQUIRED',
    'Prepare the configured isolated test vault first.',
  );
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Fixture operation cancelled before writes.');

  const applied = await dependencies.applyFixtures(context.root, manifest, approval, { reset });
  return result(
    request.command,
    { ...preview, applied, cancellation: 'writes already begun keep their actual outcome' },
    applied.unchanged ? 'unchanged' : 'applied',
  );
}
