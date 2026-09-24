// Export inert, readable Node sources. No eval, dynamic loading or API requests in this UI.
function tdToolSources(){return JSON.parse(document.getElementById('test-data-tool-sources').textContent);}
function tdBoilerplateFiles(d=design()){
 if(!tdSettings(d).recipes.some(r=>r.enabled))return [];
 const manifest=tdManifest(d),engine=createFixtureEngine();engine.generate(manifest);createFixtureAdapter(manifest).dispose();
 const files=Object.entries(tdToolSources()).map(([name,content])=>({path:'scripts/test-data/'+name,content,owner:'test-data-kit',role:'Executable development-only fixture tooling'}));
 files.push({path:'scripts/test-data/manifest.json',content:JSON.stringify(manifest,null,2)+'\n',owner:'test-data-kit',role:'Resolved test contracts and deterministic generator recipes'});
 files.push({path:'scripts/test-data/package.json',content:JSON.stringify({name:'plugin-test-data-kit',version:'1.0.0',private:true,type:'module',engines:{node:'>=22.13.0'},scripts:{plan:'node cli.mjs plan',apply:'node cli.mjs apply',serve:'node cli.mjs serve'}},null,2)+'\n',owner:'test-data-kit',role:'Isolated development tools; no added production dependencies'});
 const faker="import { readFile } from 'node:fs/promises';\nimport { resolve, dirname } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nimport { Faker, en, de } from '@faker-js/faker';\nimport { createFakerProvider } from './faker-provider.mjs';\nimport { planFixtures, applyFixtures } from './storage.mjs';\nimport { startFixtureServer } from './server.mjs';\nconst manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));\nconst faker = new Faker({ locale: manifest.locale === 'de' ? [de, en] : [en] });\nconst options = { provider: createFakerProvider(faker, '10.5.0'), providerName: '@faker-js/faker@10.5.0/' + manifest.locale };\nconst root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');\nconst [command = 'plan', flag, approval] = process.argv.slice(2);\nif (command === 'serve' && !flag) {\n  const session = await startFixtureServer(manifest, options);\n  console.log(JSON.stringify({ url: session.url, token: session.token }));\n  const stop = () => session.close();\n  process.once('SIGINT', stop); process.once('SIGTERM', stop);\n} else if (command === 'apply' && flag === '--approve' && /^[a-f0-9]{64}$/.test(approval || '')) console.log(await applyFixtures(root, manifest, approval, options));\nelse if (command === 'plan' && !flag) {\n  const { desired, retained, ...plan } = await planFixtures(root, manifest, options);\n  console.log(JSON.stringify(plan, null, 2));\n} else throw new Error('Use plan, apply --approve HASH, or serve.');\n";
 files.push({path:'scripts/test-data/faker-example.mjs',content:faker,owner:'test-data-kit',role:'Optional Faker seam; install and qualify pinned dev dependency separately'});
 files.push({path:'scripts/test-data/README.md',content:tdReadme(),owner:'test-data-kit',role:'Test-vault, simulator, reset and bootstrap instructions'});
 return files;
}
function tdReadme(){return `# Generated test-data kit

Development-only. No production endpoint or credential is retained in manifest.json. This is working fixture tooling, not the complete generated plugin.

## Workflow

1. Build and install the plugin with the existing template installer: \`npm run build:local -- --vault .test-vault\`.
2. Open \`.test-vault/\` as a separate Obsidian vault and enable the installed plugin manually. Do not disable Restricted Mode programmatically. Opening the authoring vault is not sufficient.
3. Run \`node scripts/test-data/cli.mjs plan\` from the project. This performs no writes. Review the exact files and approval hash.
4. Run \`node scripts/test-data/cli.mjs apply --approve HASH\`. The plan and on-disk files are checked again. A changed source/recipe/file/receipt requires a new plan.
5. API testing: \`node scripts/test-data/cli.mjs serve\`. An ephemeral 127.0.0.1 listener prints its URL and a random test-session token. Configure your development-only HTTP adapter to use \`URL/sources/SOURCE_SLUG\` and the token as a Bearer header. Use declared methods/resources and JSON payloads. The listener does not proxy anything.

The root template retains its historical .dev-vault default for compatibility; always pass the explicit .test-vault argument here. The companion uses .test-vault for new projects. Older projects require the explicit target-switch action; their old files are not moved.

## Application-port wiring

Import \`createFixtureAdapter\` from \`adapters.mjs\` only in development/test bootstrap. Construct it from this manifest, then inject \`adapter.port('source-slug')\` for the matching application data port. Method names are the operation slugs. Vault sources must still use the actual vault repository against the seeded notes. Dispose the adapter/server when the test ends. Do not automatically fall back to live services for an unknown operation or missing configuration.

This adapter models a database at the application-port boundary. It is NOT PostgreSQL/SQLite/etc. Engine-specific constraints, SQL, migrations and driver behavior need a separate disposable database adapter and integration tests. HTTP localhost mode is provided because process-level interception cannot be assumed to cover every native Obsidian transport. Adapt your requestUrl/fetch wrapper explicitly; redirects to external hosts are forbidden in test mode.

### HTTP client bootstrap

The exported \`client.mjs\` supplies a loopback-only HTTP application port. Import \`createTestHttpPort\`, pass the enabled manifest, source slug, URL and session token printed by the runner, and inject the returned \`port\` into your development bootstrap. The client validates payloads, serializes path/query/body fields, rejects redirects, times out and aborts on disposal. Browser CORS is allowed only for the exact native Obsidian app origin; harnesses can use the memory port or a reviewed transport wrapper. Do not persist the ephemeral session token in the design or production configuration.

## Behavior and fidelity

- Fixed-response fixtures validate input and capture the last 100 requests. Writes do not silently mutate later reads.
- List + upsert/delete recipes with the same source/dataset/key explicitly model read-after-write. Upserts replace complete objects, not partial patches. Record schemas must agree; mappings and query/filter behavior are not invented.
- List requires no input; custom filters require a custom adapter. Dataset capacity is 1,000 records. Unknown operations fail closed.
- Empty is a valid empty collection; use an error scenario for missing single records. Slow is at least 1,000 ms. Error uses the configured 400–599 status. Error/empty vault recipes do not seed notes and do not delete prior notes.
- Input examples and output fixtures are stored under .test-vault/.fixtures. These hidden files are not vault notes. Open the test vault to see its visible declared note folders.
- All semantic identities are allocated before relationships. Linked notes include their dependencies, including cycles/self-links. Every relationship uses a valid one-to-one pairing within the equal-sized entity pools; random distributions and uniqueness policies beyond this pairing are not claimed.
- Custom vault DTOs must be flat Obsidian-compatible objects. Nested API shapes require explicit mapping to notes. Required defaults and enums are validated before any write.

## Safe cleanup and reproducibility

\`node scripts/test-data/cli.mjs reset-plan\`, then \`node scripts/test-data/cli.mjs reset --approve HASH\` removes only unchanged receipt-owned fixture files. Existing notes, .obsidian, plugin data.json and unrelated data are never cleanup targets. Obsolete generated files are retained on ordinary regeneration; review reset to remove them. Manual fixture edits create conflicts, even if the new output would match an unowned file.

The writer uses a scoped lock, preconditions and rollback with retained recovery backups after uncertain failure. This is not OS-enforced atomicity against another process swapping directories between checks. Stop competing writers before seed/reset. A held recovery lock is not automatically deleted. Review its backups manually.

Seed, count, fixed UTC reference date and engine version determine the built-in output. Field-local streams avoid random-call-order drift. Keep this manifest and generator version with the project. No Math.random/Date.now drives fixture values. Preview listings are capped; the exported plan lists all generated files.

## Optional Faker

The default kit needs no npm installation. The browser uses the built-in provider, not Faker. To opt in, install \`@faker-js/faker@10.5.0\` as an exact DEV dependency inside scripts/test-data and retain its generated lockfile. Run \`node scripts/test-data/faker-example.mjs plan\`, then \`apply --approve HASH\` or \`serve\`. Do not mix built-in and Faker approval hashes. The supplied provider supports names and reserved-domain synthetic emails, seeds every field and fixes the reference date. Qualify the actual installed Faker version before use; it is not vendored or loaded by the concept. Production source never imports Faker. Other data values still use the declared schemas and deterministic built-in generators.

## Limits

100 records per entity/collection, 3,000 fixture files, 5 MB output, 64 KiB HTTP request bodies, 5-second configured delays. No live source seeding, arbitrary expressions, remote schema refs, database drivers, automatic credentials, automatic native plugin installation or claims that your plugin consumes these ports before explicit bootstrap wiring.
`;
}
function tdZip(files){
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 const header=(length,signature)=>{const b=new Uint8Array(length);new DataView(b.buffer).setUint32(0,signature,true);return b;};
 for(const f of files){
  const name=enc.encode(f.path),data=enc.encode(f.content),sum=crc(data),local=header(30,0x04034b50),v=new DataView(local.buffer);
  v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
  parts.push(local,name,data);
  const c=header(46,0x02014b50),d=new DataView(c.buffer);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,sum,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);central.push(c,name);offset+=local.length+name.length+data.length;
 }
 const end=header(22,0x06054b50),view=new DataView(end.buffer),size=central.reduce((n,b)=>n+b.length,0);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,size,true);view.setUint32(16,offset,true);
 return new Blob([...parts,...central,end],{type:'application/zip'});
}
function tdDownloadKit(){
 const files=tdBoilerplateFiles(),blob=tdZip(files),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='plugin-test-data-kit.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Test kit exported. Review its plan before applying; nothing was written into a vault.');
}
