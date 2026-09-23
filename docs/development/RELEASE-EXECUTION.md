# Execute a retained release candidate

`npm run release:operate -- --input operation.json` authenticates with the existing
GitHub CLI login and performs read-only discovery. It validates the retained
five-file packet, repository/default-branch ancestry, tags, release state and
asset hashes, then prints a plan, authorization binding and digest. It never builds
the plugin. Start with [candidate rehearsal](RELEASE-REHEARSAL.md); the offline
[operation planner](RELEASE-OPERATION-PLANS.md) remains available without GitHub.

```json
{
  "repository": "owner/repository",
  "candidateDirectory": "./retained/0.4.0-full-source-sha",
  "commit": "full-40-character-source-sha",
  "version": "0.4.0",
  "mode": "draft"
}
```

Paths are relative to the input file. Supply the actual full commit and packet
path. Unknown fields fail: input JSON cannot inject a remote snapshot, clock,
authorization or executable hook. GitHub.com is the supported service; Enterprise
hosting is not silently redirected to another host. The account needs repository
push access so authenticated discovery includes drafts; this command never
requests or changes token/repository permissions.

Review the repository, source, version, operation and all five hashes in the
result. After separately authorizing that exact operation, opt in explicitly:

```sh
npm run release:operate -- --input operation.json --execute --authorize <authorizationDigest>
```

For promotion, the digest also binds the declared platforms and supplied native
acceptance/review records; changing that scope requires renewed confirmation.
The digest is a confirmation binding, not a signature, access token, approval
service or proof of independent review. Possession of it does not establish
organizational authority. A changed candidate, repository or mode requires a new
review. The tool validates fresh remote state even when the digest still matches.

## Drafts and recovery

Draft execution captures and revalidates the complete packet before discovery.
Uploads use those captured bytes, even if the original directory changes later.
First use creates an unpublished draft at the exact commit, then uploads missing
files individually. A subsequent version is allowed above all public stable
versions. An existing matching partial draft resumes missing uploads only; a
complete draft is a no-op. Wrong tags, targets, hashes, duplicate/unexpected
assets, published versions, invalid responses and unavailable integrity digests
fail closed. No deletion, clobbering, tag movement or rebuild is available.

Every mutation has a fresh preflight and authenticated readback. A rejected write
or failed readback returns `uncertain` and exits 2; it may have committed. Keep the
JSON report, inspect GitHub and deliberately rerun the same command/packet. The
new run reconciles observed assets instead of retrying blindly. Prewrite failures
exit 1. Successful/default-plan commands exit 0. A published version is immutable
even if a prior publication response was lost: inspect it rather than rerunning
publication to repair it.

Default-branch reachability is a source-selection restriction, not proof of branch
protection or an independent code review. The operator must verify that governance.
The local repository/version lock prevents simultaneous operations on this
machine. An interrupted process can leave that lock; its path is reported by the
engine. Confirm the owning process has ended before removing only that lock.
Fresh API reads do not provide cross-client compare-and-swap. Coordinate one
release operator and prevent competing remote edits through repository governance;
the CLI cannot enforce settings an administrator can bypass.

## Promotion

Set `mode` to `promote` and supply `platforms`, `acceptance` and `review` as defined
in [the operation-plan contract](RELEASE-OPERATION-PLANS.md). Every declared
platform needs complete source/hash-bound native evidence including the minimum
host; native-not-run and browser-only evidence cannot satisfy it. The review must
be current and bound to the same source/assets. Evidence JSON is validated but is
not cryptographically authenticated: the operator owns its provenance.

Promotion requires an existing complete draft and an existing exact version tag
that resolves to the retained source, including annotated-tag resolution. Tag
creation remains a separate explicitly authorized maintainer action. The CLI
publishes that draft by ID, rechecks the resulting public assets/source and never
rebuilds. It does not submit to the Obsidian directory.

This milestone supplies the local opt-in interface. All committed Actions jobs
remain read-only; there is no privileged publication job or permission change.
The standard Actions publication interface, automatic tag creation, real first/
subsequent public-release qualification and directory submission remain open
requirements in the [readiness ledger](TEMPLATE-READINESS-LEDGER.md). Synthetic
remote tests qualify operation decisions and transport requests, not GitHub token
permissions, successful public publication or real host acceptance.
