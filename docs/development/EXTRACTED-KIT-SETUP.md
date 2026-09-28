# Setup inside an extracted developer kit

Use the qualified Node/npm versions declared by the repository and exact kit. This guide describes a locally packed/extracted kit; it is not a claim that a public release already exists.

Run `node shell.mjs setup` in the extracted folder. A TTY offers the verified starter catalog or JSON import, identity review and a file-plan confirmation. The kit is already in this folder, so setup reuses its existing configuration/import transaction rather than calling `new` into an occupied directory. Source generation, dependency installation, project verification and clickdummy build have separate prompts and outcomes. A decline stops the sequence while keeping completed steps. GitHub is optional and existing remotes are preserved; connecting a repository is currently a separate deliberate Git operation, not a hidden setup side effect.

Headless examples:

```sh
node shell.mjs setup --starter quick-capture --id capture --name Capture --author "Example" --json
node shell.mjs setup --input project.json --json
# Review; repeat the same request with --apply <planHash>.
node shell.mjs generate --json
# Review; repeat with --apply <planHash>.
node shell.mjs setup status --json
node shell.mjs setup resume --stage install --dry-run --json
# After reviewing the current resumeHash, explicitly run just one stage:
node shell.mjs setup resume --stage install --resume-hash <resumeHash> --yes
```

`--starter`, `--input` and `--blank` are mutually exclusive. Native starter options (`--extension` / `--extensions`) are available only with a starter. Imported identity is preserved by default; invalid/incomplete identity is rejected, not replaced with a convenient generated ID. Sources and test paths keep their existing conflict, ownership and migration protections.

## Recovery

`setup status` reads current source/configuration/kit fingerprints and local progress without launching processes or writing. `setup resume` accepts only one of `generate`, `install`, `verify` or `preview`. A dry run is inert. Actual execution requires `--yes` and the exact current `--resume-hash`; generation can additionally carry `--apply <generation-plan-hash>`. The TTY path carries that exact reviewed generation hash, so intervening changes cannot turn an earlier approval into approval of a new plan.

The progress file is `.framework/setup-progress.json`. Intent is written before execution; bounded history retains failure codes and original outcomes. A source change during verification blocks a current verification claim. A failed dependency install is not a failed design, and the next stage is never run automatically. This local record is not authenticated release evidence or completed product acceptance.

A crash can leave a running intent. A live previous process blocks another run. A dead process on the same host can be acknowledged explicitly with `--recover` and a fresh resume hash after inspecting effects; another host's interrupted intent remains blocked for manual reconciliation. Corrupt or foreign progress bytes are preserved. A failed final progress write reports that the stage may already have run; do not retry it blindly.

No setup stage publishes, tags, enables a native plugin, changes Restricted Mode or deploys to a personal vault. `preview` uses the existing clickdummy builder and does not replace an existing HTML without the builder's own explicit replacement workflow. At the bounded history limit, retain/export the record before a separately reviewed new session; automatic history deletion is not implemented.


### Custom product folders and freshness

Generated product folders supplement the inherited framework; they do not replace
`src/` and `tests/`. Setup status and resume fingerprint both the configured
product folders and the fixed `src/`, `tests/`, `scripts/` and `harness/` trees.
Adding, editing or deleting a file in any of those trees invalidates an earlier
resume approval. A change during verification records a blocked attempt rather
than a current success. Symlinked source roots remain refused even when custom
folders are selected.

Build output, reports and installed dependencies are deliberately outside this
source fingerprint: installing dependencies or writing evidence must not make
its own input stale. This is bounded local input tracking, not whole-repository
attestation, installed-package integrity or authenticated acceptance evidence.
Read the [custom-folder recovery record](../testing/SETUP-CUSTOM-ROOTS.md) for the
reproduced defect and exact verification scope.
