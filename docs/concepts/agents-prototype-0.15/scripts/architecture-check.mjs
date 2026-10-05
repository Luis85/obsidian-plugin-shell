import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTypeScript } from './typescript.mjs'
const ts = loadTypeScript()
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'src')
const walk = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(directory,entry.name)) : [path.join(directory,entry.name)])
const files = walk(sourceRoot).filter(file => /\.(ts|vue)$/.test(file))
const failures = []
const fail = (file,message) => failures.push(`${path.relative(root,file)}: ${message}`)
let imports = 0
for (const file of files) {
  const text = fs.readFileSync(file,'utf8')
  const rel = path.relative(sourceRoot,file).replaceAll('\\','/')
  const layer = rel.split('/')[0]
  if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(text)) fail(file,'Empty catch block hides a failure.')
  if (layer === 'domain' && /\b(?:Math\.random|Date\.now|new Date|localStorage|window\.|document\.|fetch\()/.test(text)) fail(file,'Domain has a hidden runtime service dependency.')
  if (layer === 'application' && /\b(?:Math\.random|Date\.now|new Date|localStorage|window\.|document\.|crypto\.)/.test(text)) fail(file,'Application bypasses an injected service.')
  const script = file.endsWith('.vue') ? (text.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '') : text
  const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true)
  const specifiers = []
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text)
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifiers.push(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  for (const specifier of specifiers) {
    imports++
    if (!specifier.startsWith('.')) {
      if ((layer === 'domain' || layer === 'application')) fail(file,`Inner layer imports package ${specifier}.`)
      continue
    }
    const absolute = path.resolve(path.dirname(file),specifier)
    const target = path.relative(sourceRoot,absolute).replaceAll('\\','/')
    const targetLayer = target.split('/')[0]
    if (!['','.ts','.vue','.d.ts','.css','/index.ts'].some(extension => fs.existsSync(absolute+extension))) fail(file,`Unresolved import ${specifier}.`)
    if (/domain\/(index|model|character|agent|editor|migrations|validation)$/.test(target)) fail(file,'Broad or legacy domain entry point.')
    if (layer === 'domain' && targetLayer !== 'domain') fail(file,`Domain depends on ${targetLayer}.`)
    if (layer === 'application' && !['domain','application'].includes(targetLayer)) fail(file,`Application depends on ${targetLayer}.`)
    if (layer === 'infrastructure' && ['presentation','composition'].includes(targetLayer)) fail(file,`Infrastructure depends on ${targetLayer}.`)
    if (rel.startsWith('presentation/stores/') && targetLayer === 'infrastructure') fail(file,'Store imports infrastructure directly.')
  }
}
const factory = fs.readFileSync(path.join(sourceRoot,'infrastructure/three/models/CharacterModelFactory.ts'),'utf8')
if (factory.split('\n').length > 110) failures.push('CharacterModelFactory exceeds the 110-line orchestration budget.')
if (/new THREE\.(?:Box|Torus|Cylinder|Sphere|Cone)Geometry/.test(factory)) failures.push('Factory constructs geometry instead of delegating to builders.')
for (const name of ['Human','Quadruped','Bird','Head','Object']) {
  const file=path.join(sourceRoot,`infrastructure/three/models/${name}ModelBuilder.ts`)
  if (!fs.existsSync(file)) failures.push(`Missing ${name}ModelBuilder.`)
}
if (fs.existsSync(path.join(sourceRoot,'domain/index.ts'))) failures.push('The broad domain barrel must not be reintroduced.')
if (!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('src="/src/main.ts"')) failures.push('Vite entry does not load the current Vue source.')
if (failures.length) { console.error(failures.join('\n')); process.exitCode=1 }
else console.log(`Architecture checks passed: ${files.length} source files, ${imports} imports, explicit layer boundaries and model-factory size budget.`)
