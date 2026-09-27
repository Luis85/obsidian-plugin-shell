# Optional Hindsight developer memory

Cloning this repository, running `npm install`, setup, tests or builds does **not** install or enable Hindsight. It is not part of the Obsidian plugin runtime.

Start with `npm run memory -- --help`, then preview `npm run memory -- install --agents claude-code,codex`. Installation and data processing require explicit approval. Python 3.11+ and a deliberately chosen LLM provider/model are needed only for the optional installation.

Read the [setup, privacy and recovery guide](docs/development/HINDSIGHT.md), the [Git/GitHub integration research](docs/development/HINDSIGHT-GIT-GITHUB.md), and the [verification scope](docs/development/HINDSIGHT-VERIFICATION.md).

Shared knowledge belongs in reviewed [Markdown decision records](docs/memory/README.md), not committed databases, raw transcripts, credentials or machine-specific configuration.
