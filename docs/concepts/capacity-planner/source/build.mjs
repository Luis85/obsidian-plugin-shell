import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { gzipSync } from "node:zlib";

const modules=["core","metrics","persistence","render","dialogs-common","dialogs-plan","dialogs-team","dialogs-work","dialogs-governance","app"];
const built=new Set(),chunks=[];
for(const name of modules){
  const input=await readFile(new URL(`./${name}.ts`,import.meta.url),"utf8");let code=stripTypeScriptTypes(input,{mode:"strip"});
  const exports=[...code.matchAll(/\bexport\s+(?:async\s+)?(?:function|const|let|class)\s+([\w$]+)/g)].map(match=>match[1]);
  code=code.replace(/import\s*\{([^}]+)\}\s*from\s*["']\.\/([^"']+)\.ts["'];?/g,(_match,names,dependency)=>{if(!built.has(dependency))throw new Error(`Unresolved dependency ${dependency} in ${name}`);return `const {${names}} = modules[${JSON.stringify(dependency)}];`;});
  code=code.replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\s)/g,"");if(/^\s*(?:import\s+|export\s+)/m.test(code))throw new Error(`Unsupported module syntax in ${name}`);
  chunks.push(`modules[${JSON.stringify(name)}] = (() => {\n${code}\nreturn {${exports.join(",")}};\n})();`);built.add(name);
}
const script=`(() => {\n"use strict";\nconst modules=Object.create(null);\n${chunks.join("\n")}\n})();`.replace(/<\/script/gi,"<\\/script");
const css=await readFile(new URL("./styles.css",import.meta.url),"utf8"),frame=await readFile(new URL("./frame.html",import.meta.url),"utf8"),compressed=gzipSync(JSON.stringify({script,css}),{level:9}).toString("base64");
const loader=`(async()=>{try{if(typeof DecompressionStream!=="function")throw new Error("Current browser required: DecompressionStream is unavailable.");const bytes=Uint8Array.from(atob(document.getElementById("prototype-bundle").textContent.trim()),v=>v.charCodeAt(0));const bundle=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).json();const style=document.createElement("style");style.textContent=bundle.css;document.head.append(style);const application=document.createElement("script");application.textContent=bundle.script;document.body.append(application);}catch(error){document.getElementById("main").textContent="The prototype could not start. "+(error instanceof Error?error.message:"Rebuild it from source.");}})();`;
const hash=value=>`'sha256-${createHash("sha256").update(value).digest("base64")}'`,policy=[hash(loader),hash(script)].join(" ");
const html=frame.replace("__SCRIPT_POLICY__",policy).replace("/*__STYLES__*/","body{font-family:system-ui,sans-serif}").replace("<script>/*__BUNDLE__*/</script>",`<script id="prototype-bundle" type="application/octet-stream">${compressed}</script>\n<script>${loader}</script>`),output=new URL("../index.html",import.meta.url),check=process.argv.includes("--check");
if(check){const existing=await readFile(output,"utf8");if(existing!==html)throw new Error("index.html differs from supplied source. Run node source/build.mjs.");}else await writeFile(output,html,"utf8");
const digest=createHash("sha256").update(html).digest("hex");console.log(`${check?"Checked":"Built"} index.html: ${Buffer.byteLength(html)} bytes; SHA-256 ${digest}`);
