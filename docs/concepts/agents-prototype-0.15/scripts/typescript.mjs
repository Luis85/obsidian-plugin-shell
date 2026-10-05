import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
export function loadTypeScript() {
  const compiler = require('typescript')
  if (compiler.version !== '6.0.3') throw new Error(`Repository-local TypeScript 6.0.3 is required; found ${compiler.version}.`)
  return compiler
}
