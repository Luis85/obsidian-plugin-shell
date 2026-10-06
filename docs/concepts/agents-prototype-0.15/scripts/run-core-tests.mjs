import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { compileCore, projectRoot, walk } from './compile-core.mjs'
const build = compileCore()
try {
  console.log(`Strict core typecheck passed: ${build.modules} TypeScript modules (TypeScript ${build.compiler}).`)
  const tests = walk(path.join(projectRoot, 'tests/core')).filter(file => file.endsWith('.test.mjs'))
  const result = spawnSync(process.execPath, ['--test', ...tests], {
    stdio: 'inherit', cwd: projectRoot, env: { ...process.env, AGENTS_CORE_BUILD: build.output }
  })
  process.exitCode = result.status ?? 1
} finally { build.cleanup() }
