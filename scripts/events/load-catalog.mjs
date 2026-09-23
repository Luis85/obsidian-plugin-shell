import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

/** Reads only explicit source registrations; payload contracts come from TypeScript. */
export async function loadEventCatalog(root = process.cwd()) {
  const ts = await import('typescript');
  const sourcePath = resolve(root, 'src/bootstrap/event-catalog.ts');
  const program = ts.createProgram([sourcePath, resolve(root, 'src/bootstrap/events.ts')], {
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length)
    throw new Error(
      'EVENT_CATALOG_SOURCE: ' +
        diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('; '),
    );
  const checker = program.getTypeChecker();
  const contracts = program.getSourceFile(resolve(root, 'src/application/events.ts'));
  const shell = contracts?.statements.find(
    (node) => ts.isInterfaceDeclaration(node) && node.name.text === 'ShellEvents',
  );
  const shellType = shell && checker.getTypeAtLocation(shell);
  const payloads = new Map();
  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile) continue;
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const type = checker.getTypeAtLocation(node);
        const id = checker.getTypeOfPropertyOfType(type, 'id');
        const valid = checker.getTypeOfPropertyOfType(type, 'valid');
        const signatures = valid && checker.getSignaturesOfType(valid, ts.SignatureKind.Call);
        const predicate = signatures?.length === 1 && checker.getTypePredicateOfSignature(signatures[0]);
        if (id?.isStringLiteral() && predicate?.type) {
          if (predicate.type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
            throw new Error('EVENT_CATALOG_PAYLOAD_CONTRACT');
          if (payloads.has(id.value)) throw new Error('EVENT_CATALOG_AMBIGUOUS_CONTRACT');
          const declared = shellType && checker.getTypeOfPropertyOfType(shellType, id.value);
          if (
            declared &&
            (!checker.isTypeAssignableTo(predicate.type, declared) ||
              !checker.isTypeAssignableTo(declared, predicate.type))
          )
            throw new Error(`EVENT_CATALOG_CONTRACT_DRIFT: ${id.value}`);
          payloads.set(
            id.value,
            checker.typeToString(
              predicate.type,
              node,
              ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias,
            ),
          );
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const directory = await mkdtemp(join(tmpdir(), 'plugin-event-catalog-'));
  try {
    const entry = join(directory, 'entry.ts');
    const specifier = (path) => JSON.stringify(resolve(root, path).replaceAll('\\', '/'));
    await writeFile(
      entry,
      `export { runtimeEventDefinitions } from ${specifier('src/bootstrap/events.ts')};\nexport { eventCatalog } from ${specifier('src/bootstrap/event-catalog.ts')};\n`,
    );
    const { build } = await import('vite');
    const output = await build({
      root,
      configFile: false,
      envFile: false,
      logLevel: 'silent',
      build: {
        write: false,
        minify: false,
        target: 'es2022',
        lib: { entry, formats: ['es'], fileName: 'event-catalog' },
      },
    });
    const chunks = (Array.isArray(output) ? output : [output])
      .flatMap((bundle) => bundle.output)
      .filter((chunk) => chunk.type === 'chunk');
    if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length)
      throw new Error('EVENT_CATALOG_EXTERNAL_IMPORT');
    const loaded = await import(`data:text/javascript;base64,${Buffer.from(chunks[0].code).toString('base64')}`);
    const registered = new Map(loaded.runtimeEventDefinitions.map((definition) => [definition.id, definition]));
    const seen = new Set();
    const events = loaded.eventCatalog.map((item) => {
      const { definition, ...metadata } = item;
      if (!definition || registered.get(definition.id) !== definition)
        throw new Error('EVENT_CATALOG_INVALID_REFERENCE');
      if (seen.has(definition.id)) throw new Error('EVENT_CATALOG_DUPLICATE');
      seen.add(definition.id);
      if (!payloads.has(definition.id)) throw new Error('EVENT_CATALOG_PAYLOAD_CONTRACT');
      if (
        ['owner', 'meaning', 'publisher', 'delivery'].some(
          (key) => typeof metadata[key] !== 'string' || !metadata[key].trim(),
        ) ||
        !Number.isSafeInteger(metadata.version) ||
        metadata.version < 1 ||
        !Array.isArray(metadata.subscribers) ||
        !metadata.subscribers.length ||
        metadata.subscribers.some((value) => typeof value !== 'string' || !value.trim()) ||
        !['application', 'obsidian', 'harness'].includes(metadata.origin) ||
        !['none', 'identifiers', 'vault-paths'].includes(metadata.sensitivity)
      )
        throw new Error('EVENT_CATALOG_METADATA');
      return {
        name: definition.id,
        ...metadata,
        payload: payloads.get(definition.id),
      };
    });
    if (seen.size !== registered.size)
      throw new Error('EVENT_CATALOG_DRIFT: registered definitions lack documentation');
    return { version: 1, status: 'passed', events };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
