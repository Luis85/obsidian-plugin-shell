// Dependency-free entry: identity plans and help never require installation first.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, stderr } from 'node:process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setupOptions, resumeOptions, setupHelp, identityChangeKeys } from './setup/options.mjs';
import { askAzureDetails, hostingKeys, hostingPromptDefault, planHostingFiles, requestedHosting, azureRepositoryUrl } from './setup/hosting.mjs';
import { planIdentity } from './setup/identity.mjs';
import { planLocalMcp } from './setup/mcp.mjs';
import { askSetupForm, confirmKeys, hostingFieldKeys, loadSetupForm } from './setup/form.mjs';
import { readJournal } from './setup/journal.mjs';
import { executeSetup, setupStages } from './setup/execute.mjs';
import { projectInstallEnvironment } from '../src/shared/platform/npm-install.mjs';

// The interview is data: configs/forms/setup-identity.json, located from this module so kits and copies agree.
const setupFormUrl = new URL('../configs/forms/setup-identity.json', import.meta.url);
let jsonOutput = process.argv.includes('--json');
async function setup() {
  let options = await setupOptions(process.argv.slice(2)); jsonOutput = Boolean(options.json);
  if (options.help) { console.log(options.json ? JSON.stringify({ help: setupHelp }) : setupHelp); return; }
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) throw new Error('Node 22.13+ is required; Node 24.21.0 is the qualified development version');
  const root = process.cwd();
  const existing = await readJournal(root);
  const previous = options.resume ? existing : null;
  if (options.resume && !previous) throw new Error('No setup journal exists; start setup without --resume');
  if (previous) options = await resumeOptions(options, previous.options);
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  if (!pkg.allowScripts || typeof pkg.allowScripts !== 'object' || Array.isArray(pkg.allowScripts)) throw new Error('Missing reviewed package allowScripts policy');
  if (!options.yes && !options['dry-run'] && (!stdin.isTTY || options['no-interaction'])) throw new Error('Noninteractive setup requires --yes after reviewing --dry-run');
  let planned = await planIdentity(root, options, previous);
  if (!options.yes && !options['dry-run'] && !options.resume && stdin.isTTY) {
    const form = await loadSetupForm(setupFormUrl);
    const output = options.json ? stderr : stdout;
    const prompt = createInterface({ input: stdin, output });
    try {
      const explicit = keys => options.explicitKeys.some(key => keys.includes(key));
      const skip = [...(explicit(['mcp', 'no-mcp']) ? confirmKeys : []), ...(explicit(hostingKeys) ? hostingFieldKeys : [])];
      const answers = await askSetupForm(form, prompt, { defaults: { ...planned.identity, hosting: await hostingPromptDefault(root) }, skip, write: text => output.write(text) });
      if (answers.hosting !== undefined) answers.hosting = answers.hosting.toLowerCase();
      Object.assign(options, answers);
      if (answers.hosting === 'azure-devops') await askAzureDetails(root, options, question => prompt.question(question));
      requestedHosting(options);
      options.identityRequested = identityChangeKeys.some(key => options[key] !== undefined);
      planned = await planIdentity(root, options, previous);
    } finally { prompt.close(); }
  }
  const explicitMcpFalse = options.explicitKeys.includes('mcp') && options.mcp === false;
  const mcpAction = options.mcp === true ? 'enable' : options['no-mcp'] || explicitMcpFalse ? 'disable' : 'preserve';
  const agentMcp = await planLocalMcp(root, mcpAction, existing?.agentMcp);
  options.mcp = agentMcp.enabled;
  const hostingFiles = await planHostingFiles(root, requestedHosting(options));
  planned = { ...planned, agentMcp, hostingFiles };
  const plan = { status: 'planned', identity: planned.identity, profile: options.profile,
    lifecycleHooks: { reviewedAllowlist: Object.entries(pkg.allowScripts).filter(([, allowed]) => allowed === true).map(([name]) => name),
      persistentPolicyPreserved: true, installation: 'npm ci may replace node_modules; registry/network access and reviewed dependency hooks are part of the selected install stage' },
    files: planned.plan.changes.map(({ path, status, beforeHash, afterHash }) => ({ path, status, beforeHash, afterHash })),
    hosting: { platform: planned.hosting?.platform ?? null, action: hostingFiles.action, files: hostingFiles.files, preserved: hostingFiles.preserved,
      repositoryUrl: azureRepositoryUrl(planned.hosting), remote: 'not-contacted', github: '.github is never deleted' },
    agentMcp: { action: agentMcp.action, enabled: agentMcp.enabled, server: agentMcp.server, transport: agentMcp.transport, clients: agentMcp.clients, files: agentMcp.files },
    migration: planned.migration ? { from: planned.migration.from, to: planned.migration.to, oldInstallationPreserved: true,
      files: planned.migration.plan.changes.map(({ path, status, beforeHash, afterHash }) => ({ path: `.dev-vault/.obsidian/plugins/${path}`, status, beforeHash, afterHash })) } : null,
    stages: setupStages(options), exclusions: ['No personal vault, host install, global packages, PATH edits, Restricted Mode changes, enabling plugins, publishing, or dependency upgrades',
      'MCP is preserved unless explicitly enabled or disabled; --no-mcp removes only unchanged setup-owned client configuration',
      'Only root package-lock identity metadata changes; resolved dependency entries are retained', 'Multi-file edits, dependency installation and caches are separate stages, not one globally atomic transaction'],
  };
  const progress = options.json ? stderr : stdout;
  if (options['dry-run']) { console.log(options.json ? JSON.stringify({ ...plan, dryRun: true }) : `Dry run: no writes, installation, network, child processes or reports.\n${JSON.stringify(plan, null, 2)}`); return; }
  progress.write(`Reviewed setup plan\n${JSON.stringify(plan, null, 2)}\n`);
  if (projectInstallEnvironment().removedKeys.length) progress.write('Nested install: discard the forwarded allow-scripts environment value; reload persistent policy. Other npm configuration is preserved.\n');
  if (!options.yes) {
    const prompt = createInterface({ input: stdin, output: progress });
    try { if (!/^y(es)?$/i.test((await prompt.question('Apply this plan and run its selected stages? [y/N] ')).trim())) {
      console.log(options.json ? JSON.stringify({ status: 'cancelled', written: false }) : 'Cancelled; no changes.'); return;
    } } finally { prompt.close(); }
  }
  const result = await executeSetup(root, options, planned, existing);
  const handoff = { status: result.status, identity: result.identity, toolchain: result.toolchain, profile: options.profile,
    inputFingerprint: result.fingerprint, lockHash: result.lockHash,
    scope: { staticServiceArtifactChecks: options['defer-verify'] ? 'deferred: run npm run verify' : 'verified', servedBrowser: 'not-run', nativeHost: 'not-run', release: 'not-run' },
    stages: result.stages, migration: result.migration, agentMcp: result.agentMcp, hosting: plan.hosting, journal: '.template-state/setup.json',
    vault: options.profile === 'native' ? resolve('.dev-vault') : null,
    agentNext: result.agentMcp.enabled ? 'Restart or reopen Claude Code/Codex, trust the project configuration, then inspect the workbench MCP tools. Client authentication remains separate.' : null,
    next: options.profile === 'native' ? `Open the contained vault and deliberately enable ${planned.identity.name}. Old migrated installation remains preserved and disabled.` : 'Run npm run dev:ui. Browser/native/device/release qualification remains separately scoped.' };
  console.log(options.json ? JSON.stringify(handoff) : `Setup completed.\n${JSON.stringify(handoff, null, 2)}`);
}
setup().catch(error => {
  if (jsonOutput) console.log(JSON.stringify({ status: 'failed', code: 'setup.failed', message: error.message,
    recovery: 'Completed stages and original vault data are preserved; inspect .template-state/setup.json and retry with --resume', ...(error.report ? { filePlan: error.report } : {}) }));
  else console.error(`Setup stopped: ${error.message}\nCompleted stages are preserved. Correct the failed step, then use --resume. No user data is reset.`);
  process.exitCode = 1;
});
