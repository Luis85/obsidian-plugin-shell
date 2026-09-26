// Companion → terminal → coding-agent handoff. The exported project JSON is the only
// artifact that crosses. This page copies text and downloads that file; it never runs
// a command, spawns a process or reaches the network.
const HANDOFF_REQUIREMENT_LIMIT = 24;
function handoffRequirementIds(p = project()) { return allRequirements(p.design).map(r => r.id); }
function handoffFile(p = project()) { return p.id + '.companion.json'; }
// IDs are validated lowercase slugs, so these commands need no shell quoting.
function handoffCommands(p = project()) {
  return [
    ['Create the project from the export', 'node shell.mjs new ../' + p.id + ' --from ' + handoffFile(p)],
    ['Enter the new project', 'cd ../' + p.id],
    ['Install the pinned dependencies', 'npm ci'],
    ['Run every project check (generated project script)', 'npm run check'],
    ['Start the Obsidian dev loop (generated project script)', 'npm run dev:obsidian'],
  ];
}
function handoffRequirementList(p = project()) {
  const ids = handoffRequirementIds(p), shown = ids.slice(0, HANDOFF_REQUIREMENT_LIMIT);
  if (!ids.length) return 'none yet (add PRD requirements in the companion, or start from the generated scaffold tests)';
  return shown.join(', ') + (ids.length > shown.length ? ' (+' + (ids.length - shown.length) + ' more in design/traceability.json)' : '');
}
// Short, curated context: what to run, what to read, the loop, and when to stop.
function handoffAgentPrompt(p = project()) {
  return [
    'Implement the Obsidian plugin "' + p.name + '" (plugin id: ' + p.id + ').',
    '',
    '1. In the plugin-shell framework checkout, with ' + handoffFile(p) + ' saved there, run:',
    '   node shell.mjs new ../' + p.id + ' --from ' + handoffFile(p),
    '   Review the printed plan, then re-run it with --yes. Never invent a plan hash.',
    '2. cd ../' + p.id + ' && npm ci',
    '3. Read AGENTS.md before changing anything and follow it.',
    '4. Pick the first requirement in design/traceability.json. Requirement IDs: ' + handoffRequirementList(p) + '.',
    '5. Run npm run test:tdd, replace that requirement\'s TODO with a failing behavioral test, then implement until it passes.',
    '6. Finish only when npm run check passes. Report the commands you ran and their real results; a TODO is never passing acceptance.',
  ].join('\n');
}
function handoffCommand([label, text]) {
  return `<li><span class="handoff-command-label">${esc(label)}</span><div class="command"><code>${esc(text)}</code><button type="button" class="icon-button" data-action="copy" data-value="${esc(text)}" aria-label="Copy: ${esc(text)}" title="Copy command">${icon('copy')}</button></div></li>`;
}
function starterGenerationDialog() {
  const p = project(); if (!p) return dialogBody('Generate a starter', '<p>Choose and confirm a starter first.</p>', button('Close','close','','ghost'));
  const commands = handoffCommands(p), prompt = handoffAgentPrompt(p), count = handoffRequirementIds(p).length;
  return dialogBody('Hand off to the terminal or a coding agent', `<p>The exported project JSON is the only thing that leaves this page. Everything here is copy or download only; the browser never runs a command or installs a plugin.</p>
    <ol class="starter-steps handoff-steps">
      <li><h3>Download the project JSON</h3><p>Choose <strong>Download project JSON</strong> and save <code>${esc(handoffFile(p))}</code> in your plugin-shell framework checkout. It is data, never execution authority.</p></li>
      <li><h3>Create and run it from the terminal</h3><p>Run these in order, starting in the framework checkout. <code>new</code> validates the JSON and prints a plan with its hash; nothing is written until you re-run it with <code>--yes</code> or <code>--apply &lt;planHash&gt;</code>.</p>
        <ol class="handoff-commands">${commands.map(handoffCommand).join('')}</ol>
        <p class="small muted"><code>npm run check</code> and <code>npm run dev:obsidian</code> are scripts of the generated project; <code>dev:obsidian</code> uses only its own isolated sandbox vault.</p>
        ${button('Copy all commands', 'copy', commands.map(([, text]) => text).join('\n'), 'small', 'copy')}</li>
      <li><h3>Or hand it to a coding agent</h3><p>Paste this prompt into Claude Code, Codex or another coding agent. It names ${count === 1 ? '1 requirement' : count + ' requirements'} from this project and stops only when the checks pass.</p>
        <div class="field"><label for="handoff-agent-prompt">Agent prompt</label><textarea id="handoff-agent-prompt" class="handoff-prompt" rows="11" readonly spellcheck="false">${esc(prompt)}</textarea></div>
        ${button('Copy agent prompt', 'copy', prompt, 'small', 'copy')}</li>
    </ol>
    <p class="small">Output: <code>dist/main.js</code>, <code>dist/styles.css</code> and <code>dist/manifest.json</code>. Source: <code>${esc(companionFolders().codebaseFolder)}/generated</code> · Tests: <code>${esc(companionFolders().testsFolder)}/project</code>. A runnable scaffold is not a completed feature or native acceptance; DataSource adapters and PRD business tests remain explicit implementation hooks.</p>`,
    button('Close','close','','ghost') + button('Download project JSON','project-backup','','primary','download'));
}
