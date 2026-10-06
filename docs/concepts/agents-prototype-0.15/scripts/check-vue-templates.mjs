import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const walk = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(directory,entry.name)) : [path.join(directory,entry.name)])
const files = walk(path.join(root,'src/presentation')).filter(file => file.endsWith('.vue'))
const failures = []
for (const [index, filename] of files.entries()) {
  const { descriptor, errors } = parse(fs.readFileSync(filename,'utf8'), { filename })
  for (const error of errors) failures.push(`${filename}: ${String(error)}`)
  if (!descriptor.template) continue
  try {
    const id = `agents-component-${index}`
    const script = compileScript(descriptor, { id })
    const compiled = compileTemplate({
      source: descriptor.template.content, filename, id,
      compilerOptions: { bindingMetadata: script.bindings }
    })
    for (const error of compiled.errors) failures.push(`${filename}: ${String(error)}`)
  } catch (error) { failures.push(`${filename}: ${String(error)}`) }
}
if (failures.length) throw new Error(failures.join('\n'))
console.log(`Vue SFC/template compilation passed: ${files.length} components with the installed Vue compiler. This is not a WebGL/browser integration test.`)
