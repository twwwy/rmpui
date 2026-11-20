// node gen.mjs <layout.json> <outdir>: the cases (page + P1..P32 as float32), rmpui.js render() of each (expected.txt:
// "<drawn> <fb hex>" a line) and the layout as the C header (layout.h, symbol L) for harness.c.
import fs from "fs";
import { render, compile, toC, validate } from "../rmpui.js";
const [file, out] = process.argv.slice(2);
const layout = JSON.parse(fs.readFileSync(file, "utf8"));
const errs = validate(layout); if (errs.length) { console.error(file + ": " + errs.join("; ")); process.exit(1); }
fs.writeFileSync(out + "/layout.h", toC(layout, "L"));
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const sets = [Array(32).fill(0), Array(32).fill(127), Array(32).fill(127 + 127 / 128), Array(32).fill(64), Array(32).fill(63.99)];
for (let k = 0; k < 150; k++) sets.push(Array.from({ length: 32 }, () => (rnd() < 0.15 ? [0, 127, 64, 63][Math.floor(rnd() * 4)] : Math.floor(rnd() * 128) + Math.floor(rnd() * 128) / 128)));
const C = compile(layout), cases = [], exp = [];
for (const p of sets) for (let page = 0; page <= 5; page++) {
  const pf = p.map(Math.fround), { fb, drawn } = render(layout, page, pf, C);
  cases.push({ page, p: pf }); exp.push(`${drawn} ${drawn ? Buffer.from(fb).toString("hex") : ""}`);
}
const buf = Buffer.alloc(cases.length * 132);
cases.forEach((c, i) => { buf.writeInt32LE(c.page, i * 132); c.p.forEach((v, k) => buf.writeFloatLE(v, i * 132 + 4 + 4 * k)); });
fs.writeFileSync(out + "/cases.bin", buf);
fs.writeFileSync(out + "/expected.txt", exp.join("\n") + "\n");
console.log(`${cases.length} cases`);
