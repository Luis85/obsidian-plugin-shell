import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { loadTypeScript } from './typescript.mjs'

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const walk = directory => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)])

/** Shared strict compilation for the dependency-light tests and schema generator. */
export function compileCore() {
  const ts = loadTypeScript()
  const folders = ['src/domain', 'src/application', 'src/infrastructure/persistence', 'src/infrastructure/services', 'src/presentation/character-catalog', 'src/presentation/formatters']
  const files = folders.flatMap(folder => walk(path.join(projectRoot, folder))).filter(file => file.endsWith('.ts'))
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-core-'))
  const cleanup = () => fs.rmSync(output, { recursive: true, force: true })
  try {
    const program = ts.createProgram(files, {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true, skipLibCheck: true, rootDir: path.join(projectRoot, 'src'), outDir: output,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], noEmitOnError: true, types: []
    })
    const diagnostics = ts.getPreEmitDiagnostics(program)
    if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => projectRoot, getNewLine: () => '\n'
    }))
    // Check extensionless application imports with the same modern resolution as
    // Vite. Only the temporary Node test artifacts need CommonJS output.
    const emitted = program.emit(undefined, (filename, source) => {
      const compiled = ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
      })
      fs.mkdirSync(path.dirname(filename), { recursive: true })
      fs.writeFileSync(filename, compiled.outputText)
    })
    if (emitted.emitSkipped) throw new Error('Core compilation unexpectedly skipped output.')
    fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}\n')
    return { output, cleanup, modules: files.length, compiler: ts.version }
  } catch (error) { cleanup(); throw error }
}
