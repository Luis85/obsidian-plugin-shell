# Shell maker TUI — research and implementation decision

Research date: 2026-09-28. Target: PR43 at d8b722ec2a63b0676ab99f21262785ad8fe69dc2.
This is a source-grounded design review, not a claim that end users were interviewed.
The task is to make repeated page/component/prototype authoring efficient without
changing the agent protocol, project format, safe writer, or compiler.

## Findings from the current experience

The numbered-question interface in `bin/presentation/` exposes useful operations,
but repeatedly prints the workspace and every menu. Selecting a component requires
remembering its number; bulk selection is comma-separated numeric input. Returning
to a page loses visual orientation in terminal scrollback. The prototype guide
prints help and asks one field at a time, but Back aborts the whole interview.
The file review displays only the first 15 changes. These are source observations,
not findings from a usability study. The existing shared operations and safe plans
are assets to preserve, not UI logic to replace with a second business implementation.

The highest-value change is therefore a stable work surface: visible context,
search rather than memorized indices, multi-selection with a count, recoverable
input, a full review before writes, and an obvious route back. Decorative ASCII
art, animation, mouse capture, tabs without purpose, or a dashboard of unrelated
metrics would increase cost without improving the making journey.

## Primary-source library review

### Ink + React

Ink supplies a React renderer, Yoga/Flexbox layout, input/focus hooks, and basic
screen-reader rendering with ARIA-like roles and labels. Its official README also
links `ink-testing-library`, whose frame/input facilities make component tests
straightforward [S2, S3]. It is the strongest off-the-shelf candidate for a growing
Node-based application with complex layouts. This is an assessment for this project,
not a universal ranking. The README explicitly describes an upcoming version;
features there must not be assumed present in an arbitrary installed stable version.

The costs here are a second UI runtime alongside the plugin's Vue runtime and a
new packaging contract. The shell currently ships transpiled, dependency-free
compiled modules that run before npm install. Merely adding an Ink import would
break that first-run journey; a separately bundled, licensed TUI distribution and
its platform tests would also be needed. JSX is avoidable but React/Yoga are not.
Do not add Ink to the Obsidian browser bundle. A future renderer can implement the
same structured presentation port without touching project operations.

### OpenTUI

OpenTUI supplies a native Zig core, TypeScript bindings, Flexbox, renderables,
select/input/scroll boxes, keyboard/mouse support and React/Solid integrations [S4].
It is an attractive option for richer terminal applications. Its current runtime
support page specifies Bun >=1.3 or Node >=26.4 with `--experimental-ffi` for native
Core, with additional platform conditions [S5]. That is incompatible with adopting
it as a transparent replacement in this project's qualified Node 24 release kit.
Bun-only claims found in older discussions are no longer accurate; conversely,
current Node support must not be mistaken for Node 24 support. No runtime-floor
increase or experimental-FFI requirement is justified by a page-making UI.

### Clack

Clack's TypeScript prompt collection includes selects, multiselects, autocomplete,
text, confirmation, spinners, cancellation and custom streams [S6]. It is a good
fit for a polished linear setup or question flow and its headless core is useful
for a custom prompt style. A sequence of prettier questions alone does not deliver
the requested persistent workspace, page context, document pager and full review.
It remains a sensible alternative if the product direction returns to short wizards.

### Inquirer

The current Inquirer packages provide modular input/select/checkbox/search/editor
prompts, injected streams and AbortSignal support [S7]. Its documentation specifically
warns about raw-mode ownership with custom input and handing control back to an
existing readline loop. It is appropriate for guided CLI tasks but, like Clack,
would require additional workspace composition. Its cancellation guidance supports
a clear recovery message rather than an unhandled stack trace. Launching an external
editor is not necessary for this iteration and must not happen implicitly.

### Blessed and Terminal Kit

Blessed supplies full-screen widgets, screen damage rendering, lists/forms and an
explicit destroy lifecycle [S8]. Terminal Kit provides screen/text buffers, input,
keyboard/mouse handling and a document model [S9]. Both can support real workspaces;
neither should be dismissed merely because it is not React. Their APIs and packaging
would still require adapters, type review, terminal acceptance and dependency
qualification in this TypeScript/Node kit. No claims about maintenance or security
are inferred from star counts, and no package is installed based on popularity.

### Node standard library — selected for this increment

Use `node:readline` for key decoding, existing Node TTY streams for raw mode and
resize, `node:util` for VT sanitization, and `Intl.Segmenter` for grapheme editing
[S10, S11]. Build a bounded renderer for the finite presentation primitives needed
here: selection, multi-selection, text/list editing, read-only documents and status.
This is an explicit tradeoff, not a claim that Node ships full-screen widgets.
It keeps the pre-install compiled release path working and adds no runtime, native
module, bundler, package, lockfile or host-floor requirement. The cost is ownership
of the small rendering/input layer and its tests. That cost is acceptable only
while it stays a presentation adapter, not a general terminal framework.

Revisit Ink if the UI requires rich nested editing, many independent focusable
panes or third-party components. Revisit OpenTUI only alongside a separately
approved runtime/distribution change. Do not grow a private curses implementation.

## Research translated into interaction rules

### 1. Keep human and machine contracts separate

CLI Guidelines recommend predictable stdout/stderr, machine-readable output,
noninteractive operation, actionable errors and deliberate destructive actions
[S1]. They explicitly do *not* cover full-screen applications; use them for the
CLI boundary, not as evidence that a specific full-screen layout is correct.
The TUI is a terminal-only presentation adapter. `--json`, `--input`, redirected
streams and `--no-interaction` do not open it. Full-screen rendering goes to stderr;
agent stdout remains one JSON envelope. `--ui plain` is an explicit fallback.

### 2. Favor visible actions and context over remembered commands

Textual's keyboard/input and Footer documentation demonstrate focus, declarative
bindings and visible shortcuts [S12, S13]. Translate that into arrows to move,
Enter to select, Space to toggle, `/` to search, Escape to back/clear, F1 for help,
and an always-visible footer. A contextual outline shows the project/page and
unsaved status. Wide terminals get a context column; narrower terminals keep the
same tasks in one column. The sidebar is read-only context, not an extra focus trap.
No essential task requires a mouse. Preserve terminal selection/copy behavior by
not enabling mouse tracking. Do not install undocumented single-letter shortcuts
that collide with typing.

### 3. Make selection and input safe at realistic scale

Lists are windowed and searchable by title/identifier, with visible selection and
result counts. Multi-selection must preserve checked items when filtering and
return deterministic catalog order. Empty results explain how to clear the filter.
Use Home/End and Page Up/Down. Text editing moves and deletes by grapheme rather
than splitting a surrogate pair or combining sequence. Long text scrolls; it must
not push buttons or the footer out of view. Multi-line list input accepts one item
per line, so existing semicolons inside a default item remain data. Cancellation
never submits the current field. Invalid answers remain editable beside the error.

### 4. Preserve the user's terminal

Node documents raw mode, resize, stream dimensions and that Ctrl-C does not raise
SIGINT in raw mode [S10, S11]. Handle it as a key as well as an external signal.
Own a separate key-decoder stream so cleanup does not remove another reader's
listeners. Restore the previous raw/paused state and alternate screen on normal
exit, abort, EOF and errors. Never leave the cursor hidden. Microsoft documents
alternate buffers and cursor positioning as explicit VT sequences [S14]. Avoid
periodic animation and repaint only changed rows. Clip output to terminal cells
and reserve the last column to avoid unintended wrapping.

### 5. Treat paste and imported text as data

Xterm's documentation explains bracketed paste and its limitations [S15]. Enable
paste delimiters, collect bounded paste as a single edit, and never interpret pasted
newlines or menu letters as confirmations. A pasted command is not executable.
Malformed/oversized paste must fail without submitting or writing. Sanitize VT/OSC
sequences and disallowed controls in every displayed imported title, path and error.
This is defense against screen/clipboard spoofing, not merely visual polish.
Do not send OSC clipboard or hyperlink sequences derived from imported content.

### 6. Accessibility is a mode, not a color palette

Honor nonempty `NO_COLOR`, `NODE_DISABLE_COLORS` and explicit `--no-color` [S16].
Use terminal-default foreground/background with sparse standard accent colors, so
light and dark terminal themes remain user-controlled. State is always conveyed
by text and markers as well as styling. Full-screen redraw can be difficult for
screen readers; provide `SHELL_ACCESSIBLE=1` / `--ui plain` with linear output and
no alternate buffer. Do not claim tested screen-reader compatibility without an
actual assistive-technology session. Very small windows pause editing with a resize
message rather than displaying unusable clipped controls; Ctrl-C still works.

### 7. Review the actual data before changing files

The safe plan hash already expresses intent; UX must make it inspectable. Show the
complete change manifest and plan hash in a scrollable review. Prototype preparation
also exposes the generated execution prompt. Review is not apply: the final choice
defaults to No and requires explicit selection. File conflicts remain errors, not
a reason to offer a force switch. Busy states say what is happening, and failures
say what remains unchanged and how to recover. Do not invent percentages, completion
estimates, build results, or successful writes.

### 8. Preserve the declarative prototype guide

The guide definition remains the only source of steps, field types, defaults,
conditional questions and constraints. A renderer consumes structured requests,
not English prompt parsing. Step position, help, editable accepted defaults and
full brief review become visible. Back revisits prior active questions without
creating artifacts; answers made inactive by changed decisions are not submitted.
Approval must be requested again after material edits. No TUI-specific generator
or private file format is introduced. The JSON agent path is the reference for
artifact equivalence.

## Acceptance and test strategy

Test the input reducer separately from terminal IO: navigation, search, multi-select,
text edit, graphemes, multiline paste, invalid values, help/back, list/window bounds,
small screens and deterministic ordering. Test frame dimensions and semantic content
at narrow/wide sizes; snapshots alone cannot prove input or writing behavior.
Use fake TTY streams for raw-state restoration, decoder ownership, signals, EOF,
output errors, resize, no-color and no redraw on unchanged frames. Add a real
pseudo-terminal smoke on Linux/macOS, while keeping portable stream tests on all
three CI platforms. Test the compiled kit before installation and the actual
sketch-save/agent-parity journey, not a mock success callback.

Keep all `bin/**/*.ts` in the existing independent maker coverage inventory,
source-line, ESLint, oxlint, boundary and maintainability gates. Do not loosen floors
to make new UI code pass. Preserve legacy plain-mode tests and both compiler
output kinds. Record exact source revision, commands and limitations. Manual
Windows Terminal, SSH/tmux, screen-reader and terminal-font checks remain explicit
acceptance work where not actually run; unit tests cannot impersonate those sessions.

## Sources (official documentation / maintainers)

- S1: Command Line Interface Guidelines — https://clig.dev/
- S2: Ink maintainer README — https://github.com/vadimdemedes/ink
- S3: Ink Testing Library — https://github.com/vadimdemedes/ink-testing-library
- S4: OpenTUI core — https://github.com/anomalyco/opentui/blob/main/packages/core/README.md
- S5: OpenTUI runtime support — https://opentui.com/docs/getting-started/runtime-support/
- S6: Clack prompts — https://bomb.sh/docs/clack/packages/prompts/
- S7: Inquirer maintainer README — https://github.com/SBoudrias/Inquirer.js
- S8: Blessed maintainer README — https://github.com/chjj/blessed
- S9: Terminal Kit maintainer README — https://github.com/cronvel/terminal-kit
- S10: Node 24 TTY — https://nodejs.org/docs/latest-v24.x/api/tty.html
- S11: Node 24 Readline — https://nodejs.org/docs/latest-v24.x/api/readline.html
- S12: Textual input — https://textual.textualize.io/guide/input/
- S13: Textual Footer — https://textual.textualize.io/widgets/footer/
- S14: Microsoft console VT — https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences
- S15: Xterm bracketed paste — https://invisible-island.net/xterm/xterm-paste64.html
- S16: NO_COLOR specification — https://no-color.org/
