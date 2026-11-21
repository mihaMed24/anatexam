/* ===================== МЫШЦЫ В ДЕЙСТВИИ ===================== */
/* Упражнение для мышечных тем: кто делает движение · что выпадет при повреждении нерва · мышца по описанию.
   Вопросы собираются из таблицы фактов MYO_FACTS (data/myo_facts.js); после ответа — разбор с источником. */
/* факты и сценарии мышц туловища и шеи (генерируются из tools/specs) */
if (typeof MYO_TRUNK !== 'undefined') { Object.assign(MYO_FACTS, MYO_TRUNK.facts); Object.assign(SCENARIOS, MYO_TRUNK.scn); }
const MA_KEY = 'anatoQuestMyoAct_v1';
let MA = null, MA_TOPIC = null, MA_MODE = 'mix', MA_DIFF = 'medium';
const MA_MODES = {
  mix: ['🎲 Все вперемешку', 'рекомендуется'],
  move: ['🏃 Кто делает движение', 'группы мышц и нервы'],
  nerve: ['⚡ Что выпадет', 'поражение нерва'],
  desc: ['🔍 Мышца по описанию', 'как на экзамене']
};
const MA_TYPE_LABEL = { move: '🏃 Кто делает движение', nerve: '⚡ Что выпадет', loss: '⚡ Что выпадет', desc: '🔍 Мышца по описанию', nerve2: '🧠 Чем иннервируется' };

function maStore() { try { return JSON.parse(localStorage.getItem(MA_KEY) || '{}'); } catch (e) { return {}; } }
function maProf() { return (getActiveProfile() || '') + '::'; }
function maRecord(id, ok) {
  try { const a = maStore(), k = maProf() + id, r = a[k] || { s: 0, bad: 0 };
    if (ok) r.s++; else { r.s = 0; r.bad++; } a[k] = r; localStorage.setItem(MA_KEY, JSON.stringify(a)); } catch (e) {}
}
/* слабое место: ошибался и ещё не ответил верно два раза подряд */
function maWeak(topicId) {
  const a = maStore(), p = maProf();
  return Object.keys(MYO_FACTS[topicId].muscles).filter(id => { const r = a[p + id]; return r && r.bad && r.s < 2; });
}
function maHasTopic(topicId) { return typeof MYO_FACTS !== 'undefined' && !!MYO_FACTS[topicId]; }

/* ---------- сборка вопросов ---------- */
function maTerm(id) { return findTopic(MA_TOPIC).terms.find(t => t.id === id); }
function maCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function maF() { return MYO_FACTS[MA_TOPIC]; }
function maNerve(id) { return maF().nerves[id]; }
function maPickN(arr, n) { return shuffleArr(arr.slice()).slice(0, n); }
function maMOpt(id) { const t = maTerm(id); return { id, label: maCap(t.ru), sub: t.lat }; }
function maNOpt(id) { const n = maNerve(id); return { id, label: n.lat, sub: n.ru }; }
function maLinks(list) { return list.map(id => maCap(maTerm(id).ru)).join(', '); }

function maGenMove(excl) {
  const F = maF();
  const pool = F.moves.filter(m => !excl.has('move:' + m.id)); const m = (pool.length ? pool : F.moves)[Math.floor(Math.random() * (pool.length || F.moves.length))];
  excl.add('move:' + m.id);
  const ok = maPickN(m.m, 3);
  const bad = maPickN(Object.keys(F.muscles).filter(id => !m.m.includes(id) && !m.x.includes(id)), Math.max(3, 6 - ok.length));
  return { type: 'move', kind: 'multi', head: m.t, sub: 'Отметь все мышцы из списка, которые это делают', opts: shuffleArr(ok.concat(bad).map(maMOpt)), ok,
    focus: m.m, tags: true, src: m.src, mus: [],
    fb: `<b>${m.t}</b> выполняют: ${maLinks(m.m)}.` + (ok.length < m.m.length ? ' (В списке была только часть из них.)' : '') };
}
function maGenNerve(excl) {
  const F = maF();
  const ids = Object.keys(F.nerves).filter(n => Object.values(F.muscles).some(x => x.n === n) && !excl.has('nerve:' + n));
  const nid = (ids.length ? ids : Object.keys(F.nerves))[Math.floor(Math.random() * (ids.length || Object.keys(F.nerves).length))];
  excl.add('nerve:' + nid);
  const n = F.nerves[nid], all = Object.keys(F.muscles).filter(id => F.muscles[id].n === nid), ok = all.length > 3 ? maPickN(all, 3) : all;
  const bad = maPickN(Object.keys(F.muscles).filter(id => F.muscles[id].n !== nid), ok.length > 1 ? Math.max(3, 6 - ok.length) : 3);
  return { type: 'nerve', kind: ok.length > 1 ? 'multi' : 'single', head: `Повреждён ${n.lat}`, subHead: n.ru,
    sub: ok.length > 1 ? 'Какие мышцы перестанут работать?' : 'Какая мышца перестанет работать?',
    opts: shuffleArr(ok.concat(bad).map(maMOpt)), ok, focus: ok, tags: true, mus: ok.slice(0, 3),
    src: F.muscles[ok[0]].src, fb: `<b>${n.lat}</b> (${n.ru}) иннервирует: ${maLinks(all)}.` };
}
function maLossMoves() {
  const F = maF(), out = [];
  Object.keys(F.nerves).forEach(nid => { const mv = F.moves.filter(m => m.m.every(id => F.muscles[id].n === nid)); if (mv.length) out.push({ nid, mv }); });
  return out;
}
function maGenLoss() {
  const F = maF(), list = maLossMoves(); if (!list.length) return null;
  const { nid, mv } = list[Math.floor(Math.random() * list.length)], n = F.nerves[nid], m = mv[Math.floor(Math.random() * mv.length)];
  const bad = maPickN(F.moves.filter(x => !x.m.every(id => F.muscles[id].n === nid)), 3);
  return { type: 'loss', kind: 'single', head: `Повреждён ${n.lat}`, subHead: n.ru, sub: 'Какое движение пропадёт полностью?',
    opts: shuffleArr([m].concat(bad).map(x => ({ id: x.id, label: x.t }))), ok: [m.id], focus: m.m, mus: m.m, src: m.src,
    fb: `Все мышцы, которые выполняют это движение (${maLinks(m.m)}), получают ветви ${n.lat}. В остальных движениях участвует хотя бы одна мышца с другим нервом.` };
}
function maNeighbors(id, keys) {
  const F = maF(), nv = F.muscles[id].n, t = F.muscles[id];
  /* мышцы, у которых показанные подсказки совпадают с целевой, в варианты не берём (иначе ответов было бы два) */
  const twin = x => keys.every(k => F.muscles[x][k] === t[k]);
  const pool = Object.keys(F.muscles).filter(x => x !== id && !twin(x));
  const near = pool.filter(x => F.muscles[x].n === nv || F.moves.some(m => m.m.includes(id) && m.m.includes(x)));
  const rest = pool.filter(x => !near.includes(x));
  return shuffleArr(near).concat(shuffleArr(rest)).slice(0, 3);
}
function maGenDesc(id) {
  const f = maF().muscles[id];
  let parts = [['Начало', f.o, 'o'], ['Прикрепление', f.i, 'i'], ['Функция', f.f, 'f']];
  if (MA_DIFF === 'hard') parts = Math.random() < .5 ? [parts[0], parts[1]] : [parts[0], parts[2]];
  const keys = parts.map(p => p[2]);
  if (MA_DIFF === 'easy') parts.push(['Иннервация', maNerve(f.n).lat, 'n']);
  return { type: 'desc', kind: 'single', head: '', sub: 'Какая это мышца?',
    desc: parts.map(p => `<b>${p[0]}:</b> ${p[1]}.`).join('<br>'),
    opts: shuffleArr([id].concat(maNeighbors(id, keys)).map(maMOpt)), ok: [id], focus: [id], tags: true, mus: [id], src: f.src,
    fb: `Это <b>${maTerm(id).ru}</b> (${maTerm(id).lat}).` };
}
function maGenNerve2(id) {
  const F = maF(), f = F.muscles[id], others = Object.keys(F.nerves).filter(n => n !== f.n);
  return { type: 'nerve2', kind: 'single', head: maCap(maTerm(id).ru), subHead: maTerm(id).lat, sub: 'Каким нервом иннервируется мышца?',
    opts: shuffleArr([f.n].concat(maPickN(others, 3)).map(maNOpt)), ok: [f.n], focus: [id], mus: [id], src: f.src,
    fb: `<b>${maCap(maTerm(id).ru)}</b> — ${maNerve(f.n).lat} (${maNerve(f.n).ru})` + (f.seg ? `, сегменты спинного мозга ${f.seg}` : '') + '.' };
}
function maBuild(kind) {
  const F = maF(), muscles = Object.keys(F.muscles), excl = new Set(), used = new Set();
  const m = id => { used.add(id); return id; };
  const nextM = () => { const free = muscles.filter(x => !used.has(x)); return m((free.length ? free : muscles)[Math.floor(Math.random() * (free.length || muscles.length))]); };
  const mk = t => t === 'move' ? maGenMove(excl) : t === 'nerve' ? maGenNerve(excl) : t === 'loss' ? (maGenLoss() || maGenNerve(excl)) : t === 'desc' ? maGenDesc(nextM()) : maGenNerve2(nextM());
  let seq;
  if (kind === 'weak') {
    const w = shuffleArr(maWeak(MA_TOPIC));
    return w.map((id, i) => i % 2 ? maGenNerve2(id) : maGenDesc(id));
  }
  if (MA_MODE === 'mix') seq = ['move', 'nerve', 'desc', 'nerve2', 'loss', 'desc', 'move', 'nerve', 'desc', 'nerve2'];
  else if (MA_MODE === 'move') seq = Array(F.moves.length).fill('move');
  else if (MA_MODE === 'nerve') seq = ['nerve', 'loss', 'nerve', 'nerve2', 'nerve', 'loss', 'nerve2', 'nerve'];
  else seq = Array(8).fill('desc');
  return seq.map(mk);
}
function maStart(kind) {
  const qs = maBuild(kind);
  if (!qs.length) return;
  qs.forEach(q => { q.sel = []; q.done = false; q.good = false; });
  MA = { qs, idx: 0, topicId: MA_TOPIC, log: {} };
  goTo({ screen: 'ma' });
}

/* ---------- ответы ---------- */
function maCur() { return MA && MA.qs[MA.idx]; }
function maPick(i) {
  const q = maCur(); if (!q || q.done) return;
  const id = q.opts[i].id;
  if (q.kind === 'single') q.sel = [id]; else q.sel = q.sel.includes(id) ? q.sel.filter(x => x !== id) : q.sel.concat(id);
  render();
}
function maCheck() {
  const q = maCur(); if (!q || q.done || !q.sel.length) return;
  q.done = true; q.good = q.sel.length === q.ok.length && q.ok.every(x => q.sel.includes(x));
  q.focus.forEach(id => { MA.log[id] = MA.log[id] === false ? false : q.good; maRecord(id, q.good); });
  render();
  setTimeout(() => { const el = document.getElementById('maRes'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
}
function maNext() { MA.idx++; render(); window.scrollTo(0, 0); }
function maShow(termId) {
  const topic = findTopic(MA.topicId), img = topic.images.find(im => im.hotspots.some(h => h.term === termId));
  if (!img) return;
  const h = img.hotspots.find(x => x.term === termId);
  goTo({ screen: 'cardmap', topicId: MA.topicId, src: img.src, sel: h.n, back: { screen: 'ma' }, backLabel: 'К заданию' });
}

/* ---------- экраны ---------- */
function maCard(id) {
  const f = maF().muscles[id], t = maTerm(id);
  return `<div class="ma-mcard"><div class="ma-mh"><b>${maCap(t.ru)}</b><i>${t.lat}</i></div><dl>
    <dt>Начало</dt><dd>${f.o}</dd><dt>Прикрепление</dt><dd>${f.i}</dd><dt>Функция</dt><dd>${f.f}</dd>
    <dt>Иннервация</dt><dd><span class="ma-nv">${maNerve(f.n).lat}</span>${f.seg ? ` · ${f.seg}` : ''}</dd></dl>
    <div class="scn-src" style="padding:0 12px">Источник: ${f.src}${f.seg ? '; сегменты — Р. Д. Синельников, т. 1, с. 250–263' : ''}</div>
    <button class="ma-go" onclick="maShow('${id}')">🗺️ Найти на картинке</button></div>`;
}
function renderMa() {
  if (!MA) { return renderMaSetup(); }
  MA_TOPIC = MA.topicId;
  if (MA.idx >= MA.qs.length) return renderMaResult();
  const q = maCur(), n = MA.qs.length;
  let html = renderTopbar() + backRow('Выбор упражнения', { screen: 'maSetup', topicId: MA.topicId });
  html += `<div class="game-body"><div class="ma-prog"><div style="width:${Math.round(MA.idx / n * 100)}%"></div></div>
    <div class="ma-type"><span>${MA_TYPE_LABEL[q.type]}</span> <small>${MA.idx + 1} / ${n}</small></div>
    <div class="ma-q">${q.head ? `<h2>${q.head}</h2>` : ''}${q.subHead ? `<div class="hub-latin">${q.subHead}</div>` : ''}<p>${q.sub}${q.kind === 'multi' && MA_DIFF === 'easy' ? ` <b>(верных: ${q.ok.length})</b>` : ''}</p></div>`;
  if (q.desc) html += `<div class="ma-desc">${q.desc}</div>`;
  html += `<div class="ma-opts">` + q.opts.map((o, i) => {
    const on = q.sel.includes(o.id), isOk = q.ok.includes(o.id); let c = 'ma-opt';
    if (q.done) { c += ' lock' + (isOk && on ? ' ok' : !isOk && on ? ' bad' : isOk ? ' miss' : ''); } else if (on) c += ' sel';
    const tag = q.done && q.tags ? `<span class="ma-tag">${maNerve(maF().muscles[o.id].n).lat.replace('n. ', '')}</span>` : '';
    return `<button class="${c}" onclick="maPick(${i})">${q.kind === 'multi' ? `<span class="ma-box">${on ? '✓' : ''}</span>` : ''}<span class="ma-lab">${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}</span>${tag}</button>`;
  }).join('') + `</div>`;
  if (!q.done) html += `<button class="btn btn-primary btn-block" ${q.sel.length ? '' : 'disabled'} onclick="maCheck()">Проверить</button>`;
  else {
    html += `<div id="maRes" class="ma-fb ${q.good ? 'ok' : 'bad'}"><h3>${q.good ? 'Верно! 👏' : 'Не совсем'}</h3>${q.fb}<div class="scn-src">Источник: ${q.src}</div></div>`;
    if (q.type === 'move') {
      const g = {}; q.opts.forEach(o => { const nv = maNerve(maF().muscles[o.id].n).lat; (g[nv] = g[nv] || []).push(o.label); });
      html += `<div class="ma-nerve"><div class="ma-nh">КТО ЧЕМ УПРАВЛЯЕТ</div>` + Object.keys(g).map(k => `<div class="ma-nr"><span class="ma-nv">${k}</span><span>${g[k].join(', ')}</span></div>`).join('') + `</div>`;
    }
    (q.mus || []).forEach(id => { html += maCard(id); });
    html += `<button class="btn btn-primary btn-block" onclick="maNext()">${MA.idx === n - 1 ? 'Итоги →' : 'Дальше →'}</button>`;
  }
  document.getElementById('app').innerHTML = html + `</div>`;
}
function renderMaResult() {
  const ids = Object.keys(MA.log), okN = ids.filter(id => MA.log[id]).length, nq = MA.qs.length, goodQ = MA.qs.filter(q => q.good).length;
  if (!MA.xp) { MA.xp = 1; addXp(goodQ * 3); }
  const bad = ids.filter(id => !MA.log[id]);
  let html = renderTopbar() + `<div class="result-wrap" style="padding-bottom:12px"><div class="result-pct">${goodQ} / ${nq}</div>
    <h2 class="result-title">${goodQ === nq ? 'Все ответы верные!' : 'Верных ответов'}</h2><div class="result-sub">+${goodQ * 3} XP · мышцы с ошибками сохранены в «Повторить ошибки»</div></div><div class="game-body">`;
  if (bad.length) html += `<div class="ax-card"><h3>Стоит повторить</h3>${bad.map(id => `<div class="ma-nr"><b>${maCap(maTerm(id).ru)}</b><span>${maTerm(id).lat} · ${maNerve(maF().muscles[id].n).lat}</span></div>`).join('')}</div>`;
  html += `<div style="display:flex;gap:10px"><button class="btn btn-primary" style="flex:1" onclick="maStart('set')">Ещё раз</button>
    <button class="btn btn-ghost" style="flex:1" onclick='MA=null; APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'maSetup', topicId: MA_TOPIC }))})'>К выбору</button></div></div>`;
  document.getElementById('app').innerHTML = html;
}
function renderMaSetup() {
  const topic = findTopic(MA_TOPIC), weak = maWeak(MA_TOPIC);
  let html = renderTopbar() + backRow(topic.title, { screen: 'hub', topicId: MA_TOPIC });
  html += `<div class="hub-header"><h1>💪 Мышцы в действии</h1><div class="hub-latin">Понять, что делает мышца и чем ей управляет нерв</div></div><div class="game-body">
    <div class="ax-setlab">Что тренируем</div><div class="base-groups">${Object.keys(MA_MODES).map(k => `<button class="base-chip ${MA_MODE === k ? 'on' : ''}" onclick="MA_MODE='${k}'; render();">${MA_MODES[k][0]} <span class="base-chip-n">${MA_MODES[k][1]}</span></button>`).join('')}</div>
    <div class="ax-setlab">Сложность</div><div class="base-groups">${[['easy', '🙂 Лёгкая', 'с подсказками'], ['medium', '😐 Средняя', 'без подсказок'], ['hard', '🩺 Врач', 'неполное описание']].map(d => `<button class="base-chip ${MA_DIFF === d[0] ? 'on' : ''}" onclick="MA_DIFF='${d[0]}'; render();">${d[1]} <span class="base-chip-n">${d[2]}</span></button>`).join('')}</div>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="maStart('set')">▶ Начать</button>
    ${weak.length ? `<button class="btn btn-ghost btn-block" style="margin-top:10px" onclick="maStart('weak')">🎯 Повторить ошибки (${weak.length})</button>` : ''}
    <div class="ax-card" style="margin-top:16px"><h3>Как устроено упражнение</h3><ol class="ax-how">
      <li><b>Кто делает движение</b> — отметь все мышцы, которые его выполняют.</li>
      <li><b>Что выпадет</b> — нерв повреждён: какие мышцы или движения пропадут.</li>
      <li><b>Мышца по описанию</b> — по началу, прикреплению и функции назови мышцу.</li>
      <li>После ответа — разбор: общий нерв, карточка мышцы, источник и кнопка «Найти на картинке».</li>
      <li>Ошибка — мышца попадает в «Повторить ошибки», пока не ответишь верно 2 раза подряд.</li></ol></div>
    <div class="rc-note" style="margin-top:12px">Тексты — по М. Г. Привесу, «Анатомия человека»; сегменты спинного мозга — по Р. Д. Синельникову, т. 1. Где сегменты не проверены, указан только нерв.</div></div>`;
  document.getElementById('app').innerHTML = html;
}
