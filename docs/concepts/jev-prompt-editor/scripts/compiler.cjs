const fs = require('node:fs');
const path = require('node:path');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Resolve only the repository-owned compiler; never PATH, TSC or an ancestor package. */
function loadCompiler(repositoryRoot, env = process.env) {
  if (env.TSC) throw new Error('JEV_TYPESCRIPT_OVERRIDE_UNSUPPORTED: remove TSC; use the locked workspace compiler.');
  const pkg = json(path.join(repositoryRoot, 'package.json'));
  const expected = pkg.devDependencies?.typescript;
  if (!/^6\.\d+\.\d+$/.test(expected ?? '')) throw new Error('JEV_TYPESCRIPT_PIN_INVALID: an exact stable TypeScript 6 pin is required.');
  const lock = json(path.join(repositoryRoot, 'package-lock.json'));
  const policy = json(path.join(repositoryRoot, 'tooling/security/dependency-policy.json'));
  if (lock.packages?.['']?.devDependencies?.typescript !== expected ||
      lock.packages?.['node_modules/typescript']?.version !== expected || policy.packages?.typescript !== expected) {
    throw new Error('JEV_TYPESCRIPT_PIN_MISMATCH: manifest, lockfile and reviewed policy must agree.');
  }
  const compilerRoot = path.join(repositoryRoot, 'node_modules/typescript');
  let installed;
  try { installed = json(path.join(compilerRoot, 'package.json')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error('JEV_TYPESCRIPT_MISSING: run the qualified npm ci from the repository root; no global fallback is supported.');
  }
  if (installed.name !== 'typescript' || installed.version !== expected) {
    throw new Error(`JEV_TYPESCRIPT_VERSION_MISMATCH: expected ${expected}, found ${installed.version}.`);
  }
  const compiler = require(path.join(compilerRoot, 'lib/typescript.js'));
  if (compiler.version !== expected) throw new Error('JEV_TYPESCRIPT_API_MISMATCH: installed compiler code and package metadata disagree.');
  return compiler;
}

/** Type-check one ordered namespace program, then assemble its checked script outputs in memory. */
function compileApplication(compiler, root) {
  const diagnostics = [];
  const config = compiler.getParsedCommandLineOfConfigFile(path.join(root, 'tsconfig.json'), {}, {
    ...compiler.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => diagnostics.push(diagnostic),
  });
  if (!config) throw new Error('JEV_TYPESCRIPT_CONFIG_INVALID: ' + render(diagnostics));
  diagnostics.push(...config.errors);
  const program = compiler.createProgram(config.fileNames, config.options);
  diagnostics.push(...compiler.getPreEmitDiagnostics(program));
  if (diagnostics.length) throw new Error('JEV_TYPESCRIPT_CHECK_FAILED: ' + render(diagnostics));
  for (const file of config.fileNames) {
    if (compiler.isExternalModule(program.getSourceFile(file))) {
      throw new Error('JEV_EXTERNAL_MODULE_UNSUPPORTED: this ordered namespace assembler does not bundle ESM imports.');
    }
  }
  const output = new Map();
  const result = program.emit(undefined, (file, text) => output.set(path.resolve(file), text));
  if (result.emitSkipped || result.diagnostics.length) throw new Error('JEV_TYPESCRIPT_EMIT_FAILED: ' + render(result.diagnostics));
  const chunks = config.fileNames.map(file => {
    const relative = path.relative(config.options.rootDir, file).replace(/\.ts$/, '.js');
    const emitted = output.get(path.resolve(config.options.outDir, relative));
    if (emitted === undefined) throw new Error('JEV_TYPESCRIPT_OUTPUT_MISSING: ' + relative);
    return emitted;
  });
  return { code: chunks.join('\n'), version: compiler.version };

  function render(items) {
    return compiler.formatDiagnostics(items, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
    });
  }
}
module.exports = { loadCompiler, compileApplication };
