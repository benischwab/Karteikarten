/* ==========================================================================
   Prüfungsschemas: aufklappbare Gliederung mit Notizen und Bildern
   - Speichern im Browser (IndexedDB, Ersatz: localStorage)
   - Erstellen aus Vorlage, leer, geteilter Datei oder per Claude-Chat (gratis)
   - Nutzt aus index.html: $, copy, readPptx, readDocx, readPdf, readText,
     lib, JSZIP, PDFJS, showOnly
   ========================================================================== */
(function(){
"use strict";

/* ---------- Speicher ---------- */
const DB_NAME = "jus-lernhilfe", STORE = "schemas", LS_KEY = "schemas-v1";
let dbp = null;
function db(){
  if(!dbp) dbp = new Promise((ok, no) => {
    try{
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    }catch(e){ no(e); }
  }).catch(() => null);
  return dbp;
}
function lsAll(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }catch(e){ return {}; } }
async function dbAll(){
  const d = await db();
  if(!d) return Object.values(lsAll());
  return new Promise(ok => { const r = d.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => ok([]); });
}
async function dbPut(doc){
  const d = await db();
  if(!d){ const a = lsAll(); a[doc.id] = doc; localStorage.setItem(LS_KEY, JSON.stringify(a)); return; }
  return new Promise((ok, no) => { const t = d.transaction(STORE, "readwrite"); t.objectStore(STORE).put(doc); t.oncomplete = ok; t.onerror = () => no(t.error); });
}
async function dbDel(id){
  const d = await db();
  if(!d){ const a = lsAll(); delete a[id]; localStorage.setItem(LS_KEY, JSON.stringify(a)); return; }
  return new Promise(ok => { const t = d.transaction(STORE, "readwrite"); t.objectStore(STORE).delete(id); t.oncomplete = ok; t.onerror = ok; });
}

/* ---------- Datenmodell ----------
   doc  = { id, title, updated, nodes:[node], gallery:[dataURL] }
   node = { id, t, note, imgs:[dataURL], open, kids:[node] }            */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const mk = (t, kids, note) => ({ id: uid(), t: t || "", note: note || "", imgs: [], open: true, kids: kids || [] });
function walk(nodes, fn, parent){ nodes.forEach((n, i) => { fn(n, nodes, i, parent); walk(n.kids, fn, n); }); }
function find(id){ let r = null; walk(doc.nodes, (n, arr, i, parent) => { if(n.id === id) r = { n, arr, i, parent }; }); return r; }
const plain = n => ({ ...n, kids: n.kids.map(plain) });

/* ---------- Gliederung aus Text (Claude-Antwort) ----------
   # Titel
   - I. Tatbestand
     - 1. Objektiver Tatbestand
       > Notiz                                                          */
function parseOutline(text){
  let t = String(text || "").replace(/\r/g, "").replace(/\t/g, "  ");
  const blocks = [...t.matchAll(/```[^\n]*\n([\s\S]*?)(?:```|$)/g)].map(m => m[1]);
  if(blocks.length) t = blocks.join("\n");
  t = t.replace(/\*\*/g, "");
  let title = "";
  const roots = [], stack = [];   // [{indent, node}]
  let last = null;
  t.split("\n").forEach(line => {
    if(!line.trim()) return;
    const h = line.match(/^\s*#{1,3}\s+(.+)$/);
    if(h && !title && !roots.length){ title = h[1].trim(); return; }
    const b = line.match(/^(\s*)(?:[-*•–]|\d+\.(?=\s))\s+(.*)$/);
    const q = line.match(/^(\s*)>\s?(.*)$/);
    if(b && !q){
      const ind = b[1].length, node = mk(b[2].trim());
      while(stack.length && stack[stack.length-1].indent >= ind) stack.pop();
      (stack.length ? stack[stack.length-1].node.kids : roots).push(node);
      stack.push({ indent: ind, node });
      last = node;
    }else if(last){
      const s = (q ? q[2] : line.trim());
      last.note = last.note ? last.note + "\n" + s : s;
    }else if(h){ roots.push(last = mk(h[1].trim())); stack.length = 0; stack.push({ indent: -1, node: last }); }
  });
  return { title, nodes: roots };
}
function toOutline(d){
  const out = ["# " + d.title];
  const rec = (ns, lv) => ns.forEach(n => {
    out.push("  ".repeat(lv) + "- " + n.t);
    if(n.note) n.note.split("\n").forEach(l => out.push("  ".repeat(lv + 1) + "> " + l));
    rec(n.kids, lv + 1);
  });
  rec(d.nodes, 0);
  return out.join("\n");
}

/* ---------- Vorlagen ---------- */
const TEMPLATES = [
  { name: "Prüfungsschema: Das vollendete vorsätzliche Begehungsdelikt", text:
`# Prüfungsschema: Das vollendete vorsätzliche Begehungsdelikt
- Straftataufbau
- I. Tatbestand
  - 1. Objektiver Tatbestand
    - a) Tathandlung
      > Strafrechtlich relevante Handlung? Jedes menschliche Verhalten, das vom Willen beherrscht oder doch wenigstens beherrschbar ist.
    - b) Erfolg
    - c) Verursachungszusammenhang
      - aa) Kausalität
      - bb) Objektive Zurechnung des Erfolgs
        - Prüfung objektive Zurechnung
        - Grenzen
        - Fallbeispiele
  - 2. Subjektiver Tatbestand
    - a) Vorsatz
      > Wissen + Willen = Vorsatz (Art. 12 Abs. 2 StGB)
      - Vorsatzarten: Überblick
      - Abgrenzung Eventualvorsatz – bewusste Fahrlässigkeit
    - b) (weitere subjektive Tatbestandsmerkmale)
- II. Rechtswidrigkeit
- III. Schuld
- IV. ggf. sonstige Strafbarkeitsvoraussetzungen` },
  { name: "Grundgerüst: Tatbestand – Rechtswidrigkeit – Schuld", text:
`# Neues Prüfungsschema
- I. Tatbestand
  - 1. Objektiver Tatbestand
  - 2. Subjektiver Tatbestand
- II. Rechtswidrigkeit
- III. Schuld` },
  { name: "Leeres Schema", text: "# Neues Schema\n- " }
];

/* ---------- Bilder ---------- */
function shrink(src, max){
  return new Promise(ok => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, (max || 1400) / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(im, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.85));
    };
    im.onerror = () => ok(null);
    im.src = src;
  });
}
const fileURL = f => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(f); });

// Bilder aus PowerPoint (eingebettete Grafiken) bzw. PDF-Seiten als Bildergalerie
async function galleryFrom(file){
  const ext = (file.name.match(/\.(\w+)$/) || [, ""])[1].toLowerCase(), out = [];
  try{
    if(ext === "pptx"){
      const JSZip = await lib(JSZIP, "JSZip");
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const media = Object.keys(zip.files).filter(n => /^ppt\/media\/.+\.(png|jpe?g|gif)$/i.test(n)).slice(0, 40);
      for(const n of media){
        const b64 = await zip.file(n).async("base64");
        if(b64.length < 1500) continue;   // winzige Symbole überspringen
        const type = /png$/i.test(n) ? "png" : /gif$/i.test(n) ? "gif" : "jpeg";
        const s = await shrink("data:image/" + type + ";base64," + b64, 1400);
        if(s) out.push(s);
      }
    }else if(ext === "pdf"){
      const pdfjs = await lib(PDFJS, "pdfjsLib");
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS.replace("pdf.min.js", "pdf.worker.min.js");
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      for(let n = 1; n <= Math.min(pdf.numPages, 40); n++){
        const pg = await pdf.getPage(n), vp = pg.getViewport({ scale: 1.4 });
        const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        out.push(c.toDataURL("image/jpeg", 0.8));
      }
    }else if(/^image\//.test(file.type)){
      const s = await shrink(await fileURL(file), 1400);
      if(s) out.push(s);
    }
  }catch(e){}
  return out;
}

/* ---------- Liste ---------- */
let doc = null, saveT = null;
async function list(){
  showOnly("sch-list");
  const box = $("schItems");
  box.innerHTML = '<p class="hint">Lade …</p>';
  const all = (await dbAll()).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  box.innerHTML = "";
  if(!all.length){ box.innerHTML = '<p class="msg">Noch keine Schemas. Tippe auf „+ Neues Schema“ – aus einer Vorlage oder direkt aus deinen Folien.</p>'; return; }
  all.forEach(d => {
    let n = 0; walk(d.nodes, () => n++);
    const b = document.createElement("button"); b.className = "deck";
    b.innerHTML = '<div class="t"></div><div class="m"></div>';
    b.querySelector(".t").textContent = d.title || "Ohne Titel";
    b.querySelector(".m").textContent = n + " Punkte · zuletzt bearbeitet " + new Date(d.updated || Date.now()).toLocaleDateString("de-CH");
    b.onclick = () => open(d);
    box.appendChild(b);
  });
}
async function create(parsed, gallery){
  const d = { id: uid(), title: parsed.title || "Neues Schema", updated: Date.now(), nodes: parsed.nodes.length ? parsed.nodes : [mk("")], gallery: gallery || [] };
  await dbPut(d);
  open(d);
}

/* ---------- Editor ---------- */
function open(d){
  doc = d;
  doc.gallery = doc.gallery || [];
  showOnly("sch-doc");
  $("schTitle").textContent = doc.title;
  $("schSaved").textContent = "";
  render();
}
function save(){
  clearTimeout(saveT);
  $("schSaved").textContent = "…";
  saveT = setTimeout(async () => {
    doc.updated = Date.now();
    try{ await dbPut(doc); $("schSaved").textContent = "gespeichert ✓"; }
    catch(e){ $("schSaved").textContent = "Speichern fehlgeschlagen (Speicher voll?)"; }
  }, 400);
}
function render(focusId, atEnd){
  const tree = $("schTree");
  tree.innerHTML = "";
  doc.nodes.forEach(n => tree.appendChild(nodeEl(n, 0)));
  if(focusId){
    const el = tree.querySelector('[data-id="' + focusId + '"] > .sr .tx');
    if(el){ el.focus(); if(atEnd !== false) caretEnd(el); }
  }
}
function caretEnd(el){
  try{ const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }catch(e){}
}
function nodeEl(n, depth){
  const w = document.createElement("div");
  const has = n.kids.length || n.note || n.imgs.length;
  w.className = "sn d" + Math.min(depth, 5) + (has ? " has" : "") + (n.open || !has ? "" : " closed");
  w.dataset.id = n.id;
  w.innerHTML = '<div class="sr"><span class="mk">•</span><div class="tx" contenteditable="plaintext-only" spellcheck="false"></div><button class="tg" aria-label="Auf-/Zuklappen"></button><button class="mn" aria-label="Optionen">⋯</button></div><div class="bd"></div>';
  const tx = w.querySelector(".tx"), tg = w.querySelector(".tg"), bd = w.querySelector(".bd");
  tx.textContent = n.t;
  tg.textContent = n.open ? "▾" : "▸";
  tx.oninput = () => { n.t = tx.textContent; save(); };
  tx.onkeydown = e => keys(e, n, tx);
  tg.onclick = () => { n.open = !n.open; save(); w.classList.toggle("closed", !n.open); tg.textContent = n.open ? "▾" : "▸"; };
  w.querySelector(".mn").onclick = () => menu(n);
  if(n.note || n._noteOpen){
    const nt = document.createElement("div"); nt.className = "nt";
    try{ nt.contentEditable = "plaintext-only"; }catch(e){ nt.contentEditable = "true"; }
    nt.textContent = n.note;
    nt.oninput = () => { n.note = nt.innerText.replace(/\n$/, ""); save(); };
    nt.onblur = () => { delete n._noteOpen; if(!n.note.trim()){ n.note = ""; render(); } };
    bd.appendChild(nt);
  }
  if(n.imgs.length){
    const im = document.createElement("div"); im.className = "im";
    n.imgs.forEach((src, k) => {
      const f = document.createElement("figure");
      f.innerHTML = '<img alt="Bild"><button class="rm noprint" aria-label="Bild entfernen">×</button>';
      f.querySelector("img").src = src;
      f.querySelector("img").onclick = () => { $("viewerImg").src = src; $("viewer").hidden = false; };
      f.querySelector(".rm").onclick = () => { if(confirm("Bild entfernen?")){ n.imgs.splice(k, 1); save(); render(); } };
      im.appendChild(f);
    });
    bd.appendChild(im);
  }
  n.kids.forEach(k => bd.appendChild(nodeEl(k, depth + 1)));
  return w;
}

/* ---------- Strukturänderungen ---------- */
function addAfter(n){ const f = find(n.id), x = mk(""); f.arr.splice(f.i + 1, 0, x); save(); render(x.id); }
function addChild(n){ const x = mk(""); n.kids.push(x); n.open = true; save(); render(x.id); }
function indent(n){
  const f = find(n.id); if(f.i === 0) return;
  const prev = f.arr[f.i - 1]; f.arr.splice(f.i, 1); prev.kids.push(n); prev.open = true; save(); render(n.id);
}
function outdent(n){
  const f = find(n.id); if(!f.parent) return;
  const p = find(f.parent.id); f.arr.splice(f.i, 1); p.arr.splice(p.i + 1, 0, n); save(); render(n.id);
}
function move(n, d){
  const f = find(n.id), j = f.i + d; if(j < 0 || j >= f.arr.length) return;
  [f.arr[f.i], f.arr[j]] = [f.arr[j], f.arr[f.i]]; save(); render(n.id);
}
function remove(n, ask){
  if(ask !== false && (n.kids.length || n.note || n.imgs.length) && !confirm("„" + (n.t || "Punkt") + "“ mit allen Unterpunkten löschen?")) return;
  const f = find(n.id); f.arr.splice(f.i, 1);
  if(!doc.nodes.length) doc.nodes.push(mk(""));
  save();
  // vorherigen Punkt fokussieren
  const prev = f.i > 0 ? f.arr[f.i - 1] : f.parent;
  render(prev ? prev.id : doc.nodes[0].id);
}
function keys(e, n, tx){
  if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); n.t = tx.textContent; addAfter(n); }
  else if(e.key === "Tab"){ e.preventDefault(); n.t = tx.textContent; e.shiftKey ? outdent(n) : indent(n); }
  else if(e.key === "Backspace" && !tx.textContent && !n.kids.length && !n.note && !n.imgs.length){ e.preventDefault(); remove(n, false); }
}

/* ---------- Auswahlblatt (Menü) ---------- */
function sheet(title, items){
  $("sheetTitle").textContent = title;
  const box = $("sheetBtns"); box.innerHTML = "";
  items.forEach(it => {
    if(it.el){ box.appendChild(it.el); return; }
    const b = document.createElement("button"); b.textContent = it.label;
    if(it.cls) b.className = it.cls;
    b.onclick = () => { closeSheet(); it.fn(); };
    box.appendChild(b);
  });
  $("sheet").hidden = false;
}
function closeSheet(){ $("sheet").hidden = true; }
$("sheetClose").onclick = closeSheet;
$("sheet").onclick = e => { if(e.target === $("sheet")) closeSheet(); };
$("viewer").onclick = () => { $("viewer").hidden = true; };

function menu(n){
  const f = find(n.id);
  sheet(n.t || "Punkt", [
    { label: "+ Unterpunkt", fn: () => addChild(n) },
    { label: "+ Punkt darunter (gleiche Ebene)", fn: () => addAfter(n) },
    { label: n.note ? "Notiz bearbeiten" : "+ Notiz", fn: () => {
      n._noteOpen = true; n.open = true; render();
      const nt = $("schTree").querySelector('[data-id="' + n.id + '"] > .bd > .nt');
      if(nt){ nt.focus(); caretEnd(nt); }
    } },
    { label: "+ Bild", fn: () => pickImage(n) },
    ...(f.i > 0 ? [{ label: "↑ nach oben", fn: () => move(n, -1) }] : []),
    ...(f.i < f.arr.length - 1 ? [{ label: "↓ nach unten", fn: () => move(n, 1) }] : []),
    ...(f.i > 0 ? [{ label: "→ einrücken (Unterpunkt vom Punkt darüber)", fn: () => indent(n) }] : []),
    ...(f.parent ? [{ label: "← ausrücken (eine Ebene höher)", fn: () => outdent(n) }] : []),
    { label: "Löschen", cls: "no", fn: () => remove(n) }
  ]);
}
function pickImage(n){
  const add = async src => { const s = await shrink(src, 1400); if(s){ n.imgs.push(s); n.open = true; save(); render(); } };
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
  inp.onchange = async () => { for(const f of inp.files) await add(await fileURL(f)); };
  const items = [{ label: "Foto / Bild auswählen (auch Screenshot)", fn: () => inp.click() }];
  if(doc.gallery.length){
    const g = document.createElement("div"); g.className = "gal";
    doc.gallery.forEach(src => {
      const im = document.createElement("img"); im.src = src; im.alt = "Bild aus der Datei";
      im.onclick = () => { closeSheet(); add(src); };
      g.appendChild(im);
    });
    const wrap = document.createElement("div");
    const p = document.createElement("p"); p.textContent = "Oder ein Bild aus deiner Datei antippen:"; p.style.marginTop = "6px";
    wrap.append(p, g);
    items.push({ el: wrap });
  }
  sheet("Bild hinzufügen", items);
}

/* ---------- Kopfleiste ---------- */
$("schTitle").oninput = () => { doc.title = $("schTitle").textContent.trim(); save(); };
$("schTitle").onkeydown = e => { if(e.key === "Enter"){ e.preventDefault(); $("schTitle").blur(); } };
$("schOpenAll").onclick = () => { walk(doc.nodes, n => { n.open = true; }); save(); render(); };
$("schCloseAll").onclick = () => { walk(doc.nodes, n => { n.open = false; }); save(); render(); };
$("schAddRoot").onclick = () => { const x = mk(""); doc.nodes.push(x); save(); render(x.id); };
$("schDocBack").onclick = () => { clearTimeout(saveT); doc.updated = Date.now(); dbPut(doc).finally(list); };
$("schMore").onclick = () => sheet(doc.title, [
  { label: "Teilen (Datei)", fn: share },
  { label: "Als Text kopieren (z. B. für Notizen oder Chat)", fn: () => { copy(toOutline(doc)); alert("Kopiert."); } },
  { label: "Drucken / als PDF speichern", fn: () => window.print() },
  { label: "Mit Claude verbessern / ergänzen", fn: improve },
  { label: "Schema löschen", cls: "no", fn: async () => { if(confirm("Schema „" + doc.title + "“ löschen?")){ await dbDel(doc.id); list(); } } }
]);
function share(){
  const name = fname(doc.title || "Schema") + ".schema.json";
  const file = new File([JSON.stringify({ type: "jus-schema", version: 1, title: doc.title, nodes: doc.nodes.map(plain), gallery: [] })], name, { type: "application/json" });
  if(navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: doc.title }).catch(() => {});
  else{ const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
}
function improve(){
  const p = "Hier ist mein Prüfungsschema. Verbessere und ergänze es: logische Prüfungsreihenfolge, fehlende Prüfungspunkte, Artikel (Schweizer Recht) und kurze Definitionen als Notiz (Zeile beginnt mit „> “). Behalte meine Struktur und meine Notizen bei, soweit sie richtig sind. Schweizer Rechtschreibung (ss)." + FORMAT + "\n\nMein Schema:\n```\n" + toOutline(doc) + "\n```";
  copy(p); window.open("https://claude.ai/new", "_blank");
  const ta = document.createElement("textarea"); ta.placeholder = "② Verbesserte Antwort von Claude hier einfügen"; ta.style.minHeight = "120px";
  const b = document.createElement("button"); b.textContent = "Ersetzen durch Claudes Version"; b.className = "ok";
  b.onclick = () => {
    const r = parseOutline(ta.value);
    if(!r.nodes.length){ alert("Keine Gliederung erkannt – bitte die ganze Antwort (Codeblock) kopieren."); return; }
    closeSheet(); doc.nodes = r.nodes; if(r.title) { doc.title = r.title; $("schTitle").textContent = r.title; } save(); render();
  };
  const wrap = document.createElement("div"); wrap.append(ta, b);
  sheet("Auftrag kopiert – in Claude einfügen, senden, Antwort hier einfügen:", [{ el: wrap }]);
}

/* ---------- Neues Schema ---------- */
const FORMAT = "\n\nAusgabeformat – genau so, in EINEM Codeblock, ohne Einleitung, ohne Fettschrift. Erste Zeile „# Titel“, dann eine verschachtelte Liste mit „- “ und 2 Leerzeichen Einrückung pro Ebene. Notizen (Definitionen, Artikel, Merksätze, Beispiele) stehen direkt unter dem Punkt in Zeilen, die mit „> “ beginnen:\n```\n# Prüfungsschema: Titel\n- I. Tatbestand\n  - 1. Objektiver Tatbestand\n    - a) Tathandlung\n      > Definition …\n    - b) Erfolg\n  - 2. Subjektiver Tatbestand\n- II. Rechtswidrigkeit\n- III. Schuld\n```";
const RULES_S = "Regeln:\n• Gliederung wie ein juristisches Prüfungsschema: I., II., III. → 1., 2., 3. → a), b) → aa), bb). Die Nummerierung gehört zum Text des Punkts.\n• Die Punkte selbst sind kurz (Prüfungspunkt/Stichwort). Definitionen, Voraussetzungen, Artikel (z. B. Art. 12 Abs. 2 StGB), Streitstände, Abgrenzungen und kurze Beispiele aus dem Material gehören als Notiz unter den passenden Punkt.\n• Reihenfolge = Prüfungsreihenfolge beim Lösen eines Falls.\n• Nur Inhalte aus dem Material verwenden, nichts erfinden. Organisatorisches, Literatur und Deckblätter weglassen.\n• Enthält das Material mehrere eigenständige Delikte oder Themen, darf es mehrere oberste Punkte geben.\n• Deutsch, Schweizer Rechtschreibung (ss statt ß).";
let pending = null;   // { name, units, gallery, attach }
function newView(){
  showOnly("sch-new");
  $("schStatus").textContent = ""; $("schChat").hidden = true; $("schFile").value = "";
  const t = $("schTpls"); t.innerHTML = "";
  TEMPLATES.forEach(tp => {
    const b = document.createElement("button"); b.className = "deck"; b.innerHTML = '<div class="t"></div>';
    b.querySelector(".t").textContent = tp.name;
    b.onclick = () => create(parseOutline(tp.text));
    t.appendChild(b);
  });
}
async function readFiles(){
  const files = [...$("schFile").files], st = $("schStatus");
  st.className = "status";
  if(!files.length){ st.textContent = "Bitte zuerst eine Datei oder Bilder wählen."; return; }
  $("schRead").disabled = true; st.textContent = "Lese …";
  try{
    let units = [], gallery = [], images = 0;
    for(const f of files){
      const ext = (f.name.match(/\.(\w+)$/) || [, ""])[1].toLowerCase();
      if(/^image\//.test(f.type)) images++;
      else if(ext === "pptx") units.push(...await readPptx(await f.arrayBuffer()));
      else if(ext === "docx") units.push(...await readDocx(await f.arrayBuffer()));
      else if(ext === "pdf") units.push(...await readPdf(await f.arrayBuffer()));
      else if(ext === "txt" || ext === "md") units.push(...readText(await f.text()));
      else if(ext === "ppt") throw new Error("Altes .ppt-Format: bitte in PowerPoint als .pptx oder PDF speichern.");
      st.textContent = "Sammle Bilder aus " + f.name + " …";
      gallery.push(...await galleryFrom(f));
    }
    const withText = units.filter(u => (u.title + u.body).trim());
    const attach = images > 0 || withText.length < units.length * 0.7 || !withText.length;
    pending = { name: files.map(f => f.name).join(", "), units: withText, gallery: gallery.slice(0, 40), attach };
    st.className = "status okc";
    st.textContent = (units.length ? units.length + " Folien/Seiten gelesen" + (withText.length < units.length ? ", davon " + withText.length + " mit Text" : "") : images + " Bild(er)") + (gallery.length ? " · " + Math.min(gallery.length, 40) + " Bilder für das Schema gesammelt" : "") + ".";
    showSteps();
  }catch(e){ st.className = "status err"; st.textContent = e.message; }
  finally{ $("schRead").disabled = false; }
}
function schemaPrompt(){
  const head = "Erstelle aus dem folgenden Material ein übersichtliches, aufklappbares Prüfungsschema für das Schweizer Rechtsstudium – so, dass man damit einen Fall Schritt für Schritt prüfen und den Stoff wiederholen kann.\n\n" + RULES_S + FORMAT;
  if(pending.attach) return head + "\n\nDas Material ist angehängt (" + pending.name + "). Lies auch Text in Bildern, Tabellen und Grafiken." +
    (pending.units.length ? "\n\nZusätzlich der lesbare Text daraus:\n\n" + pending.units.map(u => "### " + u.label + (u.title ? ": " + u.title : "") + "\n" + u.body).join("\n\n") : "");
  return head + "\n\nMaterial (" + pending.name + "):\n\n" + pending.units.map(u => "### " + u.label + (u.title ? ": " + u.title : "") + "\n" + u.body).join("\n\n");
}
function showSteps(){
  const box = $("schChat"); box.hidden = false; box.innerHTML = "";
  const d = document.createElement("div"); d.className = "part";
  d.innerHTML = '<p class="status how"></p><div class="row" style="margin-top:8px"><button class="go ok">① Auftrag kopieren &amp; Claude öffnen</button></div><div class="row" style="margin-top:8px"><button class="paste">② Antwort von Claude einfügen</button></div><textarea placeholder="… oder Antwort hier hinein einfügen (lange tippen → Einsetzen)"></textarea><p class="status pmsg"></p>';
  d.querySelector(".how").textContent = pending.attach
    ? "① antippen → in Claude mit „+“ bzw. 📎 deine Datei/Bilder anhängen, Auftrag einfügen, senden. ② Antwort kopieren (Kopieren-Symbol am Codeblock) und hier einfügen."
    : "① antippen → in Claude einfügen und senden. ② Antwort kopieren (Kopieren-Symbol am Codeblock) und hier einfügen.";
  const msg = d.querySelector(".pmsg"), ta = d.querySelector("textarea");
  d.querySelector(".go").onclick = () => {
    const ok = copy(schemaPrompt()); window.open("https://claude.ai/new", "_blank");
    msg.className = "status pmsg"; msg.textContent = ok ? "Kopiert! In Claude einfügen und senden." : "Kopieren nicht möglich – bitte anderen Browser verwenden.";
  };
  const take = text => {
    const r = parseOutline(text);
    if(!r.nodes.length){ msg.className = "status pmsg err"; msg.textContent = (text || "").trim() ? "Keine Gliederung erkannt – bitte in Claude das Kopieren-Symbol am Codeblock verwenden." : "Die Zwischenablage ist leer – zuerst in Claude die Antwort kopieren."; return; }
    create(r, pending.gallery);
  };
  d.querySelector(".paste").onclick = async () => {
    try{ take(await navigator.clipboard.readText()); }
    catch(e){ msg.className = "status pmsg err"; msg.textContent = "Kein Zugriff auf die Zwischenablage – bitte lange ins Feld darunter tippen → Einsetzen."; ta.focus(); }
  };
  ta.addEventListener("paste", () => setTimeout(() => take(ta.value), 0));
  box.appendChild(d);
}
$("schNew").onclick = newView;
$("schNewBack").onclick = list;
$("schRead").onclick = readFiles;
$("schImport").onchange = async () => {
  const f = $("schImport").files[0]; if(!f) return;
  try{
    const j = JSON.parse(await f.text());
    if(!Array.isArray(j.nodes)) throw 0;
    const fix = n => ({ id: uid(), t: String(n.t || ""), note: String(n.note || ""), imgs: Array.isArray(n.imgs) ? n.imgs.filter(s => /^data:image\//.test(s)) : [], open: n.open !== false, kids: (n.kids || []).map(fix) });
    create({ title: String(j.title || "Geteiltes Schema"), nodes: j.nodes.map(fix) });
  }catch(e){ alert("Diese Datei ist kein gültiges Schema."); }
  $("schImport").value = "";
};

window.Schema = { list, parseOutline, toOutline };
})();
