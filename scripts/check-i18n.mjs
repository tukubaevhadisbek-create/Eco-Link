import fs from "node:fs";
import path from "node:path";

const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => typeof v === "object" ? flat(v, p + k + ".") : [p + k]);
const load = (l) => JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8"));
const ru = new Set(flat(load("ru")));
const kg = new Set(flat(load("kg")));
let bad = 0;
for (const k of ru) if (!kg.has(k)) { console.log("KG missing:", k); bad++; }
for (const k of kg) if (!ru.has(k)) { console.log("KG extra:", k); bad++; }

// ключи, использованные в коде (простые строковые литералы t("a.b"))
const used = new Set();
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, f.name);
  if (f.isDirectory()) walk(p); else if (/\.(tsx?|ts)$/.test(f.name)) {
    const s = fs.readFileSync(p, "utf8");
    for (const m of s.matchAll(/\bt\(\s*["']([a-z_]+(?:\.[A-Za-z_0-9]+)+)["']/g)) used.add(m[1]);
  } } };
walk("src");
for (const k of used) if (!ru.has(k)) { console.log("USED but missing in ru:", k); bad++; }
console.log(`ru keys: ${ru.size}, kg keys: ${kg.size}, used literal keys: ${used.size}, problems: ${bad}`);
process.exit(bad ? 1 : 0);
