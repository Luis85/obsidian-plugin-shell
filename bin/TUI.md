# Full-screen terminal UI

The default interactive maker now uses a persistent keyboard-driven work surface
when stdin/stderr are terminals with raw-input support. Run `node bin/app`,
`node bin/app sketch`, `node bin/app brainstorm` or `node bin/app prototype`. The same TypeScript code
ships in the pre-install compiled kit; no additional package or runtime is needed.
The library comparison and design rationale are in
[CLI TUI research](../docs/research/CLI-TUI-RESEARCH.md).

```sh
node bin/app studio --ui tui
node bin/app studio --ui plain
node bin/app prototype --no-color
node bin/app brainstorm --ui tui
```

`--ui auto|tui|plain` selects the presentation. `SHELL_UI` supplies its default;
`SHELL_ACCESSIBLE=1` or `TERM=dumb` selects linear prompts. Nonempty `NO_COLOR`,
`NODE_DISABLE_COLORS`, `FORCE_COLOR=0` and `--no-color` disable accent styling.
No essential state depends on color. `CI` (other than `false`), `--json`,
`--input`, `--no-interaction` and nonterminal input never open an interactive UI.
Plain mode uses linear prompts without raw input or alternate-screen controls.
Screen-reader compatibility has not been manually qualified.

The header shows project, current location and unsaved state. Wide windows show a
read-only project/page outline; narrow windows retain the same main tasks without
the context column. Lists are searchable and windowed rather than an unbounded
scrollback dump. At least 60 columns and 18 rows are needed for full-screen mode;
smaller windows retain the draft and show a resize instruction. Use plain mode on
smaller devices. Maximum rendered viewport is 240 columns by 100 rows.

| Context | Keys |
| --- | --- |
| Menus and page/component lists | Up/Down, Home/End, Page Up/Down, Enter |
| Search | `/` or type a title/ID; Escape clears the filter |
| Multiple components | Space toggles; Tab switches search/selection; Enter adds all |
| Text | Left/Right, Home/End, Backspace/Delete; Ctrl+U clears |
| Bulk titles and guide lists | One item per line; Ctrl+J adds a line; Enter submits |
| File/prompt/JSON review | Up/Down, Page Up/Down, Home/End; Tab/Shift+Tab changes document |
| Help / navigation | F1 opens help; Escape returns; Ctrl+C cancels the session |

Text defaults are editable in-place. Invalid titles/lists remain in the field.
Bracketed paste inserts text without executing commands or accepting a menu. It
is bounded to 10,000 characters; oversized insertions are rejected. Terminals
without bracketed-paste support cannot distinguish typed keystrokes from paste;
use plain mode or the JSON input contract for those environments.

The prototype guide remains data-driven. Escape revisits the previous active
question; changing a branch removes inactive answers. The complete brief is
reviewed before explicit agreement, and agreement is renewed after backtracking.
The file review now includes every planned path, the complete execution prompt
when preparing a prototype, and the Companion JSON for project saves. Enter in
that viewer only continues to a **separate default-No approval**.

The terminal adapter restores its cursor, screen buffer and previous raw/input
state on normal exit, cancellation and errors. It owns only its listeners, has no
animation loop and never captures the mouse. Unicode editing respects grapheme
clusters; cell width uses conventional CJK/emoji widths. Ambiguous-width terminal
fonts, advanced input methods, SSH/tmux, and interactive Windows Terminal sessions
remain explicit manual acceptance scope, not inferred from stream-based tests.

## Terminal regression qualification

`npm run test:maker` retains the portable keyboard, frame, stream and parity tests.
`npm run test:maker:pty` is the additional opt-in Linux/macOS acceptance suite. It
needs Python 3's standard library only, not a new application dependency. It drives
the actual `app.mjs` launcher through an OS pseudo-terminal, creates a page with bulk
components, refuses a save first, approves a second reviewed plan, and compares
the written bytes against agent-mode creation. It also checks small-window paste
protection, F1 help, Ctrl+C, external SIGTERM, empty stdout and exact termios
restoration. CI runs that suite on Linux/macOS; it is not a Windows Terminal test.

The suite retains raw terminal transcripts, replayable `.cast` files and a JSON
report under `reports/maker-pty/`. Treat captures as evidence of the scripted
journey, not a substitute for assistive-technology or terminal-font review. No
user vault is involved; all created projects live in isolated temporary folders.

Combining accents and emoji are re-segmented after each insertion, including
keystrokes arriving separately. Paste cannot edit a draft while the window is too
small or help covers the field. Terminal output errors remain observed through
restoration, including errors emitted after a failed write callback. Contextual
shortcut rows keep Back, Help and Cancel visible at the minimum terminal size.
