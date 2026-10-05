import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTypeScript } from './typescript.mjs'
const ts = loadTypeScript()
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const walk = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(directory,entry.name)) : [path.join(directory,entry.name)])
const files = ['src', 'tests', 'scripts'].flatMap(folder => walk(path.join(root,folder)))
  .filter(file => /\.(ts|vue|mjs)$/.test(file))
files.push(path.join(root,'vite.config.ts'),path.join(root,'vitest.config.ts'))
const failures = []
let resolved = 0
for (const file of files) {
  const raw = fs.readFileSync(file,'utf8')
  const text = file.endsWith('.vue') ? (raw.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '') : raw
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.mjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS)
  for (const diagnostic of ast.parseDiagnostics) failures.push(`${path.relative(root,file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText,' ')}`)
  const visit = node => {
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier :
      ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined
    if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
      const base = path.resolve(path.dirname(file),specifier.text)
      if (!['','.ts','.vue','.css','.mjs','.json','/index.ts'].some(extension => fs.existsSync(base+extension))) failures.push(`${path.relative(root,file)}: unresolved local import ${specifier.text}`)
      else resolved++
    }
    ts.forEachChild(node,visit)
  }
  visit(ast)
}
if (failures.length) throw new Error(failures.join('\n'))
console.log(`Syntax/local-import checks passed: ${files.length} TypeScript, Vue-script and JavaScript files; ${resolved} local imports resolve. No external package types are checked here.`)
