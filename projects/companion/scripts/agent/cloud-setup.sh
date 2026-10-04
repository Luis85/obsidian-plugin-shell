#!/bin/sh
# Claude Code on the web: environment "Setup script" (environment settings -> Setup script; runs when a new session starts).
# Provisions the exact Node/npm this checkout qualifies (.nvmrc, package.json packageManager) into a user-level cache and
# restores node_modules with `npm ci --ignore-scripts`, so the toolchain and dependencies are ready before the agent starts.
#   sh scripts/agent/cloud-setup.sh
# Same work as the SessionStart hook (scripts/agent/session-start.mjs --provision-only). It never touches system locations
# and always exits 0 (a failing setup script would stop the session); problems are printed. SHELL_SESSION_START_NODE=0 skips
# the Node download, SHELL_SESSION_START_INSTALL=0 skips npm ci. Docs: docs/development/CLOUD-AND-LOCAL-SESSIONS.md
set -u
log() { printf 'workbench-setup: %s\n' "$*"; }

root=${CLAUDE_PROJECT_DIR:-}
[ -n "$root" ] || root=$(git rev-parse --show-toplevel 2>/dev/null) || root=$PWD
cd "$root" 2>/dev/null || { log "cannot enter $root; nothing to do"; exit 0; }
hook=scripts/agent/session-start.mjs
if [ ! -f "$hook" ] || [ ! -f package.json ]; then
  log "no Workbench checkout in $root (missing $hook); nothing to do"
  exit 0
fi

node_major() { "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null; }
have_node() {
  command -v node >/dev/null 2>&1 || return 1
  major=$(node_major node) || return 1
  [ -n "$major" ] && [ "$major" -ge 18 ] 2>/dev/null
}
fetch() { # fetch URL DESTINATION: curl honours HTTPS_PROXY and the CA variables; wget is the fallback
  if command -v curl >/dev/null 2>&1; then curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 300 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"
  else return 127; fi
}
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d ' ' -f 1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d ' ' -f 1
  else return 127; fi
}

# Without a usable Node the hook cannot run: fetch the qualified Node by hand, into the same cache layout the hook uses.
bootstrap_node() {
  version=$(tr -d 'v \r\n' < .nvmrc 2>/dev/null)
  printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { log ".nvmrc does not hold a plain x.y.z version; install Node >= 18 first"; return 1; }
  case $(uname -s) in Linux) system=linux ;; Darwin) system=darwin ;; *) log "unsupported platform $(uname -s)"; return 1 ;; esac
  case $(uname -m) in x86_64|amd64) cpu=x64 ;; aarch64|arm64) cpu=arm64 ;; armv7l) cpu=armv7l ;; *) log "unsupported architecture $(uname -m)"; return 1 ;; esac
  name=node-v$version-$system-$cpu
  cache=${XDG_CACHE_HOME:-${HOME:-/root}/.cache}/workbench
  prefix=$cache/$name
  if [ "$("$prefix/bin/node" --version 2>/dev/null)" = "v$version" ]; then bin=$prefix/bin; return 0; fi
  scratch=$cache/.tmp-setup-$$
  rm -rf "$scratch"; mkdir -p "$scratch" || return 1
  base=${SHELL_NODE_DIST:-https://nodejs.org/dist}/v$version
  fetch "$base/SHASUMS256.txt" "$scratch/SHASUMS256.txt" || { log "could not download SHASUMS256.txt"; rm -rf "$scratch"; return 1; }
  fetch "$base/$name.tar.gz" "$scratch/$name.tar.gz" || { log "could not download $name.tar.gz"; rm -rf "$scratch"; return 1; }
  expected=$(grep "  $name.tar.gz\$" "$scratch/SHASUMS256.txt" | cut -d ' ' -f 1)
  actual=$(sha256_of "$scratch/$name.tar.gz") || actual=
  if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
    log "SHA-256 mismatch or unavailable for $name.tar.gz (expected '${expected:-none}', got '${actual:-none}'); refused"
    rm -rf "$scratch"; return 1
  fi
  tar -xzf "$scratch/$name.tar.gz" -C "$scratch" || { log "could not extract $name.tar.gz (needs tar and gzip)"; rm -rf "$scratch"; return 1; }
  rm -rf "$prefix"
  mv "$scratch/$name" "$prefix" || { log "could not move $name into $cache"; rm -rf "$scratch"; return 1; }
  rm -rf "$scratch"
  [ "$("$prefix/bin/node" --version 2>/dev/null)" = "v$version" ] || { log "the extracted node does not report v$version"; return 1; }
  bin=$prefix/bin
  log "downloaded $name.tar.gz (SHA-256 verified) to $prefix"
}

if have_node; then
  node scripts/agent/session-start.mjs --provision-only
elif bootstrap_node; then
  PATH="$bin:$PATH" node scripts/agent/session-start.mjs --provision-only
else
  log "no Node >= 18 and the qualified Node could not be fetched; the session continues without a prepared toolchain"
fi
exit 0
