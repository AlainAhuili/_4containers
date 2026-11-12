// Syntax-check the JavaScript inside <script> blocks of the given HTML files,
// plus any standalone .js files. Exits 1 on the first syntax error.
// Usage: node ci/check-html-scripts.mjs dashboard/index.html whiteboard/index.html paint/*.js
import { readFileSync } from "node:fs";
import vm from "node:vm";

let failed = 0;
for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf8");
  const blocks = file.endsWith(".js")
    ? [{ code: text, line: 1 }]
    : [...text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => ({
        code: m[1],
        line: text.slice(0, m.index).split("\n").length,
      }));
  for (const { code, line } of blocks) {
    try {
      new vm.Script(code, { filename: `${file}:${line}` }); // parse only, never run
    } catch (err) {
      failed++;
      console.error(`✗ ${file} (script starting at line ${line}): ${err.message}`);
    }
  }
  if (!failed) console.log(`✓ ${file}: ${blocks.length} script block(s) parse`);
}
process.exit(failed ? 1 : 0);
