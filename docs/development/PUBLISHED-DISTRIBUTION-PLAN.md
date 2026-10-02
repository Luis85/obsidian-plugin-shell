# Published and versioned distribution layer — implementation plan

## Objective

Ship Workbench so a consumer can create a project without cloning the framework repository, while keeping every scaffold reproducible and source-bound.

The distribution contract is:

- **one CLI entry point:** `bin/app`;
- **one compiled CLI runtime:** `bin/app.js`;
- all runtime-owned support files stay below `bin/` (`bin/template`, `bin/plugins`, `bin/licenses`, `bin/kit.json`);
- project starters remain a separately versioned, data-only distribution;
- the CLI never resolves an independently moving “latest” starter pack.

The first published implementation does not preserve the unreleased `app.mjs`, `shell.mjs`, or `.framework/` layouts.

## Target user flows

### Published CLI

The intended package-manager UX is:

```sh
npx @obsidian-workbench/cli new my-plugin --starter plugin-nuxtui
```

A convenience package may expose:

```sh
npx @obsidian-workbench/create-app my-plugin --starter plugin-nuxtui
```

The final npm scope is release configuration; the commands above define the interface, not ownership of an npm namespace.

### Downloaded release

GitHub Releases retain a package-manager-independent path:

```text
workbench-cli-<version>.zip
workbench-starters-<version>.zip
workbench-distributions.json
workbench-SHA256SUMS
```

After extraction:

```text
workbench/
├── bin/
│   ├── app
│   ├── app.js
│   ├── kit.json
│   ├── licenses/
│   ├── plugins/
│   └── template/
├── configs/
│   └── starters/
├── package.json
├── README.md
└── LICENSE
```

The CLI ZIP is independently runnable. The starter ZIP adds only `configs/starters/*.json`.

## Version contract

A CLI release has exactly one distribution version, for example `0.5.0`. Its release manifest binds:

- CLI semantic version;
- exact source commit;
- CLI archive name, byte length and SHA-256;
- starter archive name, byte length and SHA-256;
- starter schema version;
- kit schema version;
- minimum Node/npm versions;
- publication channel.

The CLI resolves starters using **its own version**. A `0.5.0` CLI requests the `0.5.0` distribution manifest and the starter asset named by that manifest. It must not query “latest” and then combine `0.5.0` CLI code with `0.6.0` starter definitions.

Explicit overrides are allowed only through reviewed inputs such as a local starter-pack path or an exact requested version.

## Work package 1 — package contract

1. Add a release-package manifest builder that derives package metadata from the committed root `package.json`.
2. Include only the reviewed public surface in the npm tarball:
   - `bin/**`;
   - `package.json`;
   - `README.md`;
   - `LICENSE`.
3. Map the npm executable directly to `bin/app`.
4. Generate a publishable package manifest without changing the maintainer checkout's `private` policy.
5. Add `npm pack --dry-run` qualification asserting there is no `.framework/`, root `app.mjs`, root `shell.mjs`, source-only test fixture, credential, report or `node_modules` content.

**Acceptance:** an extracted npm tarball can run `bin/app help --json` and `bin/app new starters --json` with no repository checkout and no install-time build.

## Work package 2 — signed-off distribution manifest

Extend `workbench-distributions.json` into the canonical machine-readable release index for one version. The file is generated from produced bytes, never hand-authored.

Required fields:

```json
{
  "schemaVersion": 2,
  "version": "0.5.0",
  "sourceCommit": "<40-char sha>",
  "kitSchemaVersion": 2,
  "starterSchemaVersion": 1,
  "node": "24.21.0",
  "npm": "11.19.1",
  "assets": {
    "cli": { "name": "workbench-cli-0.5.0.zip", "sha256": "...", "bytes": 0 },
    "starters": { "name": "workbench-starters-0.5.0.zip", "sha256": "...", "bytes": 0 }
  }
}
```

The GitHub release and npm package must be produced from the same source commit and version.

**Acceptance:** changing any asset bytes, source SHA or version invalidates the retained manifest/checksum qualification.

## Work package 3 — starter resolver and cache

Add a bounded starter-distribution resolver used only when local `configs/starters/` is absent.

Resolution order:

1. explicit local `--starter-pack <path>`;
2. existing local `configs/starters/`;
3. exact-version cache;
4. exact-version published distribution.

The cache is outside generated projects and keyed by version + SHA-256. Downloaded bytes are written only after the expected hash and archive inventory pass. Starters remain JSON/data; downloading a starter pack never executes code.

Add:

```sh
node bin/app distributions status --json
node bin/app distributions fetch --version <exact> --json
node bin/app distributions verify --version <exact> --json
```

Interactive `new` may offer to fetch the matching pack. Agent/noninteractive mode must never perform the network action without an explicit flag.

**Acceptance:** offline creation works with a verified cache; hash mismatch, schema mismatch, missing version or unexpected archive files fail closed.

## Work package 4 — create-app bootstrap

Implement the optional `create-app` package as a thin bootstrap only. It must not contain a second generator.

Responsibilities:

1. parse only bootstrap options needed to choose an exact CLI version;
2. load/execute the matching published CLI;
3. forward remaining arguments unchanged to `bin/app new`;
4. preserve exit code, stdout JSON and stderr;
5. never translate starter definitions or generate application files itself.

**Acceptance:** direct CLI and create-app produce byte-identical scaffold plans for the same CLI version, starter pack and request.

## Work package 5 — release workflow

Add a privileged publication workflow separate from pull-request qualification.

Stages:

1. checkout exact default-branch commit selected for release;
2. install the qualified Node/npm graph;
3. run full repository gates and distribution qualification;
4. build CLI and starter assets once;
5. create checksums and distribution manifest from captured bytes;
6. run npm-pack inspection and install/execution smoke tests from the tarball;
7. require protected environment approval;
8. create/verify the exact `v<version>` tag;
9. create a draft GitHub release and upload immutable assets without clobber;
10. publish the npm CLI/create-app packages with the same version;
11. download/read back registry and GitHub artifacts and compare identity/hashes;
12. promote the GitHub draft only after readback succeeds.

No pull-request workflow receives publication credentials.

## Work package 6 — update and compatibility policy

Before 1.0, compatibility is defined by published artifacts, not unreleased repository layouts.

- Never reuse a published semantic version for different bytes.
- A project receipt records CLI version, starter ID/version/hash and starter schema.
- Existing generated projects are not silently upgraded when the CLI updates.
- `kit upgrade` only migrates between supported published `bin/` kit schemas.
- Cross-schema migration requires an explicit migration implementation and tests.
- Downgrades fail closed when newer metadata cannot be proven compatible.

## Work package 7 — end-to-end qualification

Add disposable tests covering:

1. install CLI from packed npm tarball;
2. no repository checkout and no `node_modules` inside the CLI archive;
3. fetch matching starter pack into an empty cache;
4. create one Obsidian plugin, one webapp and one CLI project;
5. repeat creation offline from cache;
6. refuse a starter pack from a different version;
7. refuse modified manifest/archive bytes;
8. verify direct CLI vs create-app plan parity;
9. verify Windows, macOS and Linux launch paths;
10. verify a second published-version candidate upgrades without reading “latest”.

Publication readiness requires these tests plus the existing generator/build/native evidence required by the release process.

## Delivery sequence

1. Land the bin-only kit layout and schema v2.
2. Add distribution-manifest v2 and package-content tests.
3. Add exact-version starter resolver/cache.
4. Add npm CLI packaging.
5. Add the thin create-app bootstrap.
6. Add protected GitHub/npm publication workflow.
7. Run first-release rehearsal entirely from packed artifacts.
8. Publish only after the retained release evidence is bound to the same version/source/assets.

This keeps the current generator and starter architecture intact: publication adds transport, version resolution and integrity; it does not create another scaffold implementation.
