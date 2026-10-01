import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const source = await readFile(new URL("./app.ts", import.meta.url), "utf8");
const css = await readFile(new URL("./styles.css", import.meta.url), "utf8");
const frame = await readFile(new URL("./frame.html", import.meta.url), "utf8");
const script = stripTypeScriptTypes(source, { mode: "strip" }).replace(/<\/script/gi, "<\\/script");
const policy = "'sha256-" + createHash("sha256").update(script).digest("base64") + "'";
const html = frame
  .replace("__SCRIPT_POLICY__", policy)
  .replace("/*__STYLES__*/", css)
  .replace("/*__BUNDLE__*/", script);

const output = new URL("../index.html", import.meta.url);
const check = process.argv.includes("--check");
if (check) {
  const existing = await readFile(output, "utf8");
  if (existing !== html) throw new Error("index.html differs from its supplied source. Run node source/build.mjs.");
} else {
  await writeFile(output, html, "utf8");
}
const digest = createHash("sha256").update(html).digest("hex");
console.log((check ? "Checked" : "Built") + " index.html: " + Buffer.byteLength(html) + " bytes; SHA-256 " + digest);
