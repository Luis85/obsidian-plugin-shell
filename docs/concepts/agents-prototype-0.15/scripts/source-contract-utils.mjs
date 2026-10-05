import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { loadTypeScript } from './typescript.mjs'
const ts = loadTypeScript()

export function selectedCode(file, selector) {
  const text = fs.readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  if (selector === 'module-without-imports') {
    return ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast)).join('\n')
  }
  let result
  const [kind, name, member] = selector.split(':')
  const visit = node => {
    if (kind === 'method' && ts.isClassDeclaration(node) && node.name?.text === name) {
      const method = node.members.find(item => item.name?.getText(ast) === member)
      if (method?.body) result = method.body.getText(ast)
    }
    if (kind === 'function' && ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) result = node.body.getText(ast)
    if (kind === 'variable' && ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer) {
      result = node.initializer.body?.getText(ast) ?? node.initializer.getText(ast)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  if (!result) throw new Error(`Missing source contract ${selector} in ${file}`)
  return result
}
export function fingerprint(code, replacements = []) {
  for (const [before, after] of replacements) code = code.replaceAll(before, after)
  const ast = ts.createSourceFile('contract.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const normalized = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(ast)
  return createHash('sha256').update(normalized).digest('hex')
}
