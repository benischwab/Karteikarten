// Erzeugt themen/index.json aus den .txt-Dateien im Ordner themen/ (eine Ordner-Ebene).
// Aufruf: node scripts/make-index.js
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "themen");
const byName = (a, b) => a.localeCompare(b, "de", { numeric: true });
const txt = d => fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isFile() && /\.txt$/i.test(e.name)).map(e => e.name).sort(byName);
const map = {};
const top = txt(root);
if(top.length) map[""] = top;
fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort(byName).forEach(d => {
  const files = txt(path.join(root, d));
  if(files.length) map[d] = files;
});
fs.writeFileSync(path.join(root, "index.json"), JSON.stringify(map, null, 2) + "\n");
console.log("themen/index.json:", Object.keys(map).length, "Ordner,", Object.values(map).reduce((n, f) => n + f.length, 0), "Dateien");
