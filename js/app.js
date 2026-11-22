/* ===================== ДАННЫЕ ===================== */
/* CONTENT — data/*.js, IMAGES — data/images.js (подключаются в index.html раньше этого файла) */

const MODES = [
  { id: 'picture', title: 'Найди на картинке', desc: 'Найди структуру по цифре или составь легенду карточки', emoji: '🖱️' },
  { id: 'truefalse', title: 'Верно / Неверно', desc: 'Термин + перевод — совпадает или подставлен неверный', emoji: '✅' },
  { id: 'builder', title: 'Собери термин', desc: 'Выбери нужные кусочки из общего поля и составь слово', emoji: '🧩' },
  { id: 'speed', title: 'Скоростной квиз', desc: '3 жизни, таймер, серия правильных ответов', emoji: '⚡' },
];

const DIFFICULTIES = [
  { id: 'easy', title: 'Лёгкая', emoji: '🙂' },
  { id: 'medium', title: 'Средняя', emoji: '😐' },
  { id: 'hard', title: 'Врач', emoji: '🩺' },
];

const DIFFICULTY_BLURBS = {
  truefalse: {
    easy: 'Больше времени на ответ — 9 секунд на вопрос',
    medium: 'Стандартный темп — 6 секунд на вопрос',
    hard: 'Жёсткий цейтнот — всего 4 секунды на вопрос',
  },
  builder: {
    easy: 'Меньше лишних фишек в поле, под каждой виден перевод',
    medium: 'Больше лишних фишек, переводы под фишками скрыты',
    hard: 'Максимум лишних фишек вперемешку, переводов нет совсем',
  },
  picture: {
    easy: 'Название по-русски и по-латыни, без таймера',
    medium: 'Только латинское название — перевод откроется после ответа, без таймера',
    hard: 'Только латынь, 10 секунд на вопрос и 3 жизни',
  },
  speed: {
    easy: '4 варианта, неверные — случайные термины кости; все вопросы с одним ответом',
    medium: '4 варианта, неверные — похожие термины (с тем же первым словом); примерно каждый третий вопрос — «выбери все подходящие»',
    hard: '5 вариантов, максимально похожие; каждый второй вопрос — «выбери все подходящие», верных бывает 1, 2 или 3',
  },
};

/* ===================== ПРОФИЛИ (уровень "кто играет") ===================== */
const PROFILES_KEY = 'anatoQuestProfiles_v1';
const ACTIVE_PROFILE_KEY = 'anatoQuestActiveProfile_v1';

function getProfileList() {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]'); } catch (e) { return []; }
}
function saveProfileList(list) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); } catch (e) {}
}
function getActiveProfile() {
  try { return localStorage.getItem(ACTIVE_PROFILE_KEY) || null; } catch (e) { return null; }
}
function setActiveProfileName(name) {
  try { localStorage.setItem(ACTIVE_PROFILE_KEY, name); } catch (e) {}
}
function clearActiveProfile() {
  try { localStorage.removeItem(ACTIVE_PROFILE_KEY); } catch (e) {}
}
function progressKeyFor(name) { return 'anatoQuestProgress_v1::' + name; }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeForJsAttr(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function selectProfile(name) {
  const wasEditor = typeof isEditor === 'function' && isEditor();
  setActiveProfileName(name);
  if (typeof isEditor === 'function' && wasEditor !== isEditor()) {
    const list0 = getProfileList(); if (!list0.includes(name)) { list0.push(name); saveProfileList(list0); }
    location.reload(); return;
  }
  const list = getProfileList();
  if (!list.includes(name)) { list.push(name); saveProfileList(list); }
  PROGRESS = loadProgress();
  goTo({ screen: 'map' });
}

function createProfileFromInput() {
  const input = document.getElementById('newProfileName');
  if (!input) return;
  const name = (input.value || '').trim().slice(0, 20);
  if (!name) return;
  selectProfile(name);
}

function quickStart() {
  selectProfile('Игрок');
}

/* системные confirm()/alert() в опубликованном артефакте заблокированы (песочница) —
   поэтому подтверждения показываем прямо на странице */
let PENDING_DELETE = null;
function askDeleteProfile(name, ev) {
  if (ev) ev.stopPropagation();
  PENDING_DELETE = name; render();
}
function cancelDeleteProfile() { PENDING_DELETE = null; render(); }
function deleteProfile(name, ev) {
  if (ev) ev.stopPropagation();
  PENDING_DELETE = null;
  const list = getProfileList().filter(n => n !== name);
  saveProfileList(list);
  try { localStorage.removeItem(progressKeyFor(name)); } catch (e) {}
  if (getActiveProfile() === name) {
    clearActiveProfile();
    PROGRESS = defaultProgress();
  }
  render();
}

/* ===================== ПРОГРЕСС / LOCALSTORAGE ===================== */
function defaultProgress() {
  return { xp: 0, streak: 0, lastPlayDate: null, topics: {} };
}

function loadProgress() {
  const name = getActiveProfile();
  if (!name) return defaultProgress();
  try {
    const raw = localStorage.getItem(progressKeyFor(name));
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    return migrateLevelStars(Object.assign(defaultProgress(), parsed));
  } catch (e) {
    return defaultProgress();
  }
}

function saveProgress() {
  const name = getActiveProfile();
  if (!name) return;
  try { localStorage.setItem(progressKeyFor(name), JSON.stringify(PROGRESS)); } catch (e) {}
}

/* ===================== СТАТИСТИКА ПО ТЕРМИНАМ (для слабых мест и "Моей статистики") ===================== */
const TERM_HISTORY_CAP = 20;

function termKey(topicId, termId) { return topicId + '::' + termId; }

/* дубли терминов, объединённые в один (старая статистика переносится в основной id) */
const TERM_ALIASES = {
  'temporal::foramen_mastoideum2': 'temporal::foramen_mastoideum',
  'temporal::margo_sphenoidalis_t2': 'temporal::margo_sphenoidalis',
  'temporal::pars_petrosa2': 'temporal::pars_petrosa',
  'temporal::fissura_petrotympanica2': 'temporal::fissura_petrotympanica',
  'temporal::apex_partis_petrosae2': 'temporal::apix_partis_petrosae',
};
function migrateTermAliases() {
  const st = PROGRESS && PROGRESS.termStats;
  if (!st) return;
  let changed = false;
  Object.entries(TERM_ALIASES).forEach(([oldK, newK]) => {
    if (!st[oldK]) return;
    const a = st[newK] || { history: [], lastSeen: 0 };
    a.history = a.history.concat(st[oldK].history).sort((x, y) => x.t - y.t).slice(-TERM_HISTORY_CAP);
    a.lastSeen = Math.max(a.lastSeen || 0, st[oldK].lastSeen || 0);
    st[newK] = a; delete st[oldK]; changed = true;
  });
  if (changed) saveProgress();
}

/* mode — в каком режиме был ответ; по нему «Слабые места» повторяют ошибку тем же типом задания.
   Если не передан — берём текущий игровой режим. */
function recordTermResult(topicId, termId, isCorrect, mode) {
  if (!topicId || !termId) return;
  if (!mode && typeof VIEW !== 'undefined' && VIEW && VIEW.screen === 'game') mode = VIEW.mode;
  if (!PROGRESS.termStats) PROGRESS.termStats = {};
  migrateTermAliases();
  const key = termKey(topicId, termId);
  if (!PROGRESS.termStats[key]) PROGRESS.termStats[key] = { history: [], lastSeen: 0 };
  const rec = PROGRESS.termStats[key];
  rec.history.push(mode ? { c: isCorrect ? 1 : 0, t: Date.now(), m: mode } : { c: isCorrect ? 1 : 0, t: Date.now() });
  if (rec.history.length > TERM_HISTORY_CAP) rec.history.shift();
  rec.lastSeen = Date.now();
  saveProgress();
}

function getAllTermStatsResolved() {
  migrateTermAliases();
  const stats = PROGRESS.termStats || {};
  const result = [];
  Object.keys(stats).forEach(key => {
    const sep = key.indexOf('::');
    const topicId = key.slice(0, sep);
    const termId = key.slice(sep + 2);
    const topic = findTopic(topicId);
    if (!topic) return;
    const term = topic.terms.find(t => t.id === termId);
    if (!term) return;
    const rec = stats[key];
    const total = rec.history.length;
    const correctCount = rec.history.reduce((s, h) => s + h.c, 0);
    const errorRate = total ? 1 - (correctCount / total) : 0;
    result.push({ topicId, termId, term, topic, total, correctCount, errorRate, lastSeen: rec.lastSeen });
  });
  return result;
}

/* тип задания для повтора: режим последней ошибки */
const WEAK_MODE_MAP = { picture: 'picture', exam: 'picture', legend: 'legend', truefalse: 'truefalse',
  builder: 'builder', speed: 'speed', weakspots: 'truefalse', base_lr: 'base_lr', base_rl: 'base_rl', base: 'base_lr' };
function getWeakItems(limit) {
  const stats = PROGRESS.termStats || {};
  const now = Date.now();
  const out = [];
  getAllTermStatsResolved().forEach(s => {
    const h = (stats[termKey(s.topicId, s.termId)] || {}).history || [];
    const recent = h.slice(-4);
    const errs = recent.filter(x => !x.c);
    if (!errs.length) return;
    const lastErr = [...h].reverse().find(x => !x.c);
    const mode = WEAK_MODE_MAP[lastErr && lastErr.m] || 'speed';
    const daysSince = (now - s.lastSeen) / 86400000;
    out.push(Object.assign({}, s, { mode, recentErrors: errs.length,
      priority: errs.length / recent.length * 3 + Math.min(daysSince, 10) * 0.15 + Math.random() * 0.3 }));
  });
  out.sort((a, b) => b.priority - a.priority);
  return out.slice(0, limit);
}


function timeAgo(ts) {
  if (!ts) return '—';
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return mins + ' мин назад';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' ч назад';
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 30) return days + ' дн назад';
  const months = Math.floor(days / 30);
  return months + ' мес назад';
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

function touchStreak() {
  const today = todayStr();
  if (PROGRESS.lastPlayDate === today) return;
  if (PROGRESS.lastPlayDate) {
    const prevDate = new Date(PROGRESS.lastPlayDate.replace(/-/g,'/'));
    const diffDays = Math.round((new Date(today.replace(/-/g,'/')) - prevDate) / 86400000);
    PROGRESS.streak = (diffDays === 1) ? PROGRESS.streak + 1 : 1;
  } else {
    PROGRESS.streak = 1;
  }
  PROGRESS.lastPlayDate = today;
}

function levelFromXp(xp) { return Math.floor(xp / 150) + 1; }
function xpIntoLevel(xp) { return xp % 150; }

function addXp(n) {
  const beforeLevel = levelFromXp(PROGRESS.xp);
  PROGRESS.xp += n;
  const afterLevel = levelFromXp(PROGRESS.xp);
  saveProgress();
  return afterLevel > beforeLevel;
}

function getTopicProgress(topicId) {
  if (!PROGRESS.topics[topicId]) PROGRESS.topics[topicId] = {};
  return PROGRESS.topics[topicId];
}

/* Звёзды у режимов со сложностью: по одной за каждый уровень, пройденный на 80%+.
   ★ — «Лёгкая», ★ — «Средняя», ★ — «Врач». Уровни независимы. */
const LEVEL_MODES = ['truefalse', 'builder', 'speed', 'picture'];
const NO_STAR_MODES = ['exam', 'weakspots'];   /* здесь звёзд нет — только процент и разбор ошибок */
const PASS_PCT = 80;
function levelStars(rec) {
  const lv = (rec && rec.levels) || {};
  return DIFFICULTIES.filter(d => (lv[d.id] || 0) >= PASS_PCT).length;
}
function setLevelResult(topicId, modeId, difficulty, scorePct) {
  const tp = getTopicProgress(topicId);
  const rec = tp[modeId] || { stars: 0, best: 0 };
  rec.levels = rec.levels || {};
  const wasPassed = (rec.levels[difficulty] || 0) >= PASS_PCT;
  rec.levels[difficulty] = Math.max(rec.levels[difficulty] || 0, scorePct);
  rec.best = Math.max(rec.best || 0, scorePct);
  rec.stars = levelStars(rec);
  tp[modeId] = rec;
  saveProgress();
  return { wasPassed, passed: scorePct >= PASS_PCT, levels: Object.assign({}, rec.levels) };
}
/* звёзды режима «по позициям»: у режимов со сложностью звезда стоит на месте своего уровня */
function modeStarsHtml(modeId, rec) {
  if (!LEVEL_MODES.includes(modeId)) return starsString((rec && rec.stars) || 0);
  const lv = (rec && rec.levels) || {};
  return DIFFICULTIES.map(d => (lv[d.id] || 0) >= PASS_PCT
    ? `<span class="star-on" title="${d.title}: пройдено">★</span>`
    : `<span class="star-off" title="${d.title}: нужно ${PASS_PCT}%">☆</span>`).join('');
}
/* переход на новые правила: старые звёзды этих режимов не были привязаны к уровням */
function migrateLevelStars(p) {
  Object.values((p && p.topics) || {}).forEach(tp => LEVEL_MODES.forEach(m => {
    if (tp[m] && !tp[m].levels) { tp[m].levels = {}; tp[m].stars = 0; }
  }));
  return p;
}

function setModeResult(topicId, modeId, stars, scorePct) {
  const tp = getTopicProgress(topicId);
  const prev = tp[modeId] || { stars: 0, best: 0 };
  tp[modeId] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, scorePct) };
  saveProgress();
}

function starsString(n) {
  let s = '';
  for (let i = 0; i < 3; i++) s += (i < n ? '★' : '☆');
  return s;
}

/* ===================== STATE / ROUTER ===================== */
let PROGRESS = loadProgress();
let VIEW = getActiveProfile() ? { screen: 'map' } : { screen: 'profile' };
let ACTIVE_TIMER = null;
let LAST_GAME_VIEW = null;

function clearActiveTimer() {
  if (ACTIVE_TIMER) { clearInterval(ACTIVE_TIMER); ACTIVE_TIMER = null; }
}

const GAME_MODULES = {}; // заполняется ниже, после определения модулей

function goTo(view) {
  if (view && view.screen === 'cardmap') CARDMAP_ZOOM = 1;   /* карточка всегда открывается целиком */
  clearActiveTimer();
  VIEW = view;
  if (view.screen === 'game') {
    const mod = GAME_MODULES[view.mode];
    if (mod && mod.reset) mod.reset(view.topicId, view.difficulty || 'medium', view);
    LAST_GAME_VIEW = Object.assign({}, view);
  }
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function findTopic(topicId) {
  if (topicId === 'base' && typeof BASE_TOPIC !== 'undefined') return BASE_TOPIC;
  for (const sec of CONTENT.sections) {
    for (const t of sec.topics) if (t.id === topicId) return t;
  }
  return null;
}

/* ===================== ОБЩИЕ UI-КУСКИ ===================== */
function renderTopbar() {
  const xp = PROGRESS.xp;
  const level = levelFromXp(xp);
  const pct = Math.round((xpIntoLevel(xp) / 150) * 100);
  const active = getActiveProfile() || 'Гость';
  return `
    <div class="topbar">
      <div class="brand">🦴<span class="brand-text"> АнатЭкзам</span></div>
      <div class="stats">
        <div class="stat-chip profile-chip" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'profile'}))})'>👤 ${escapeHtml(active)}</div>
        <div class="stat-chip streak-chip">🔥 ${PROGRESS.streak}</div>
        <div class="stat-chip">
          <span class="lvl-badge">ур. ${level}</span>
          <div class="xp-bar-wrap"><div class="xp-bar-fill" style="width:${pct}%"></div></div>
        </div>
      </div>
    </div>`;
}

function backRow(label, view) {
  return `<div class="back-row"><button class="back-btn" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(view))})'>← ${label}</button></div>`;
}

/* Небольшой помощник, чтобы можно было безопасно передавать view через onclick-атрибуты */
const APP = {
  goToJSON(jsonStr) { goTo(JSON.parse(jsonStr)); }
};

/* ===================== ЭКРАН: КАРТА РАЗДЕЛОВ ===================== */
function renderMap() {
  let html = renderTopbar();
  html += `
    <div class="map-hero">
      <h1>Карта тем</h1>
      <p>Выбирай раздел и кость — внутри ждут 4 режима тренировки и справочник.</p>
    </div>`;
  html = html.replace('<div class="map-hero">', '<div class="map-top"><div class="map-hero">');
  html += eventBlocksHtml() + `</div>`;

  const weakCount = getWeakItems(999).length;
  const favN = favCount();
  const baseKnown = baseKnownCount(BASE_WORDS);
  html += `<div class="map-grid"><div class="mc-base">
    <div class="section-block">
      <div class="section-title"><span class="icon">🔤</span><span>Основа</span></div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(modeEntryTarget('base')))})'>
        <div class="node-emoji">🔤</div>
        <div class="node-body">
          <div class="node-title">База латыни</div>
          <div class="node-latin">sulcus — борозда, os frontale — лобная кость… · знаешь ${baseKnown} из ${BASE_WORDS.length}</div>
        </div>
        ${guideBtn('base')}
      </div>
    </div></div><div class="mc-train">
    <div class="section-block">
      <div class="section-title"><span class="icon">🎓</span><span>Сквозная тренировка</span></div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(modeEntryTarget('exam')))})'>
        <div class="node-emoji">🎓</div>
        <div class="node-body">
          <div class="node-title">Экзамен по темам</div>
          <div class="node-latin">Выбери кости — показывай структуры на карточках, как на экзамене</div>
        </div>
        ${guideBtn('exam')}
      </div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'stestSetup'}))})'>
        <div class="node-emoji">🧪</div>
        <div class="node-body">
          <div class="node-title">Тест по черепу <span class="new-badge">новое</span></div>
          <div class="node-latin">Вопросы теста кафедры: «Укажите» — выбор вариантов, «Перечислите/Назовите» — письменно</div>
        </div>
      </div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'otestSetup'}))})'>
        <div class="node-emoji">🦴</div>
        <div class="node-body">
          <div class="node-title">Тест обзора: артрология <span class="new-badge">новое</span></div>
          <div class="node-latin">50 вопросов теста кафедры, только выбор вариантов; 10 вопросов «как на опросе»</div>
        </div>
      </div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'axesSetup'}))})'>
        <div class="node-emoji">🧭</div>
        <div class="node-body">
          <div class="node-title">Оси и движения <span class="new-badge">новое</span></div>
          <div class="node-latin">Артрология: форма сустава → оси → движения, с анимацией каждого движения</div>
        </div>
      </div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'recallSetup'}))})'>
        <div class="node-emoji">📝</div>
        <div class="node-body">
          <div class="node-title">Перечисли все <span class="new-badge">новое</span></div>
          <div class="node-latin">Письменный тест: назови все кости черепа или все отверстия — сам, без вариантов</div>
        </div>
      </div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'ageSetup'}))})'>
        <div class="node-emoji">👶</div>
        <div class="node-body">
          <div class="node-title">Возрастные особенности <span class="new-badge">новое</span></div>
          <div class="node-latin">Расскажи всё о кости по пунктам или ответь на вопросы — по Привесу и Синельникову</div>
        </div>
      </div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'ageSetup', set:'walls'}))})'>
        <div class="node-emoji">🧭</div>
        <div class="node-body">
          <div class="node-title">Стенки, ямки и ходы <span class="new-badge">новое</span></div>
          <div class="node-latin">Череп в целом: стенки глазницы, ямок и полости носа, носовые ходы</div>
        </div>
      </div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(modeEntryTarget('weakspots')))})'>
        <div class="node-emoji">🎯</div>
        <div class="node-body">
          <div class="node-title">Слабые места</div>
          <div class="node-latin">${weakCount ? weakCount + ' термин(ов) с недавними ошибками' : 'Ошибок пока нет — сюда попадут термины, где ошибёшься'}</div>
        </div>
        ${guideBtn('weakspots')}
      </div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'favorites'}))})'>
        <div class="node-emoji">⭐</div>
        <div class="node-body">
          <div class="node-title">Избранное</div>
          <div class="node-latin">${favN ? favN + ' — термины и вопросы, отмеченные звёздочкой' : 'Отмечай ☆ термины и вопросы — они соберутся здесь'}</div>
        </div>
      </div>
      <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'stats'}))})'>
        <div class="node-emoji">📊</div>
        <div class="node-body">
          <div class="node-title">Моя статистика</div>
          <div class="node-latin">Разбор по каждому термину: % и когда видел последний раз</div>
        </div>
      </div>
    </div>`;

  /* кости сгруппированы: Скелет → Череп / Осевой скелет / …; внутри группы — её кости */
  html += `</div><div class="mc-skel"><div class="section-block"><div class="section-title"><span class="icon">🦴</span><span>Скелет</span></div>`;
  const grpNode = g => {
    const topics = groupTopics(g);
    if (!topics.length) return;
    const st = topics.reduce((a, t) => a + topicStarTotal(t.id), 0), max = topics.length * MODES.length * 3;
    html += `
      <div class="topic-node group-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'group', groupId: g.id}))})'>
        <div class="node-emoji">${g.icon}</div>
        <div class="node-body">
          <div class="node-title">${g.title}</div>
          <div class="node-latin">${g.desc} · ${topics.length} ${topics.length === 1 ? 'тема' : topics.length < 5 ? 'темы' : 'тем'}</div>
          <div class="st-bar group-bar"><div style="width:${max ? Math.round(st / max * 100) : 0}%"></div></div>
        </div>
        <div class="node-progress">${st}/${max} ⭐</div>
      </div>`;
  };
  SKELETON_GROUPS.forEach(grpNode);
  html += `</div><div class="section-block"><div class="section-title"><span class="icon">🔗</span><span>Суставы и связки <span class="new-badge">новое</span></span></div>`;
  ARTHRO_GROUPS.filter(g => !g.hidden).forEach(grpNode);
  html += `</div><div class="section-block"><div class="section-title"><span class="icon">💪</span><span>Мышцы <span class="new-badge">новое</span></span></div>`;
  MYO_GROUPS.filter(g => !g.hidden).forEach(grpNode);
  html += `</div></div><div class="mc-prog">`;
  html += programBlockHtml();
  html += `</div></div>`;

  html += `
    <div class="coming-soon">
      Новые кости и разделы добавляются по мере прохождения курса — карта будет расти 🗺️
    </div>
    ${supportBlockHtml()}`;
  html += eventArchiveLinkHtml();

  document.getElementById('app').innerHTML = html;
}

/* ===================== СОБЫТИЯ: ОПРОСЫ С ОБРАТНЫМ ОТСЧЁТОМ ===================== */
/* новое событие = одна запись. date — день опроса (местное время); в этот день — «СЕГОДНЯ ОПРОС»,
   со следующего дня событие уходит в архив. topics — темы для «Подготовки». */
const EVENTS = [
  { id: 'face_2026_10_14', title: 'Опрос: череп (обзорное занятие)', date: '2026-10-14', icon: '📝',
    topics: ['occipital', 'frontal', 'parietal', 'sphenoid', 'temporal', 'ethmoid', 'maxilla', 'palatine', 'facial_small', 'mandible', 'skull_base', 'skull_fossae', 'nasal_cavity'],
    extra: [
      { icon: '💀', title: 'Перечисли все кости черепа', desc: 'письменно, как на тесте', view: { screen: 'recall', task: 'skull_bones', level: 'all' } },
      { icon: '🕳️', title: 'Перечисли все отверстия черепа', desc: 'основные — с foramen magnum до подбородочного', view: { screen: 'recall', task: 'skull_foramina', level: 'base' } },
      { icon: '🧵', title: 'Перечисли швы черепа', desc: 'свод, лицо, основание', view: { screen: 'recall', task: 'sutures', level: 'all' } },
      { icon: '👶', title: 'Возрастные особенности', desc: 'по пунктам, включая роднички', view: { screen: 'ageSetup' } },
      { icon: '🧭', title: 'Стенки, ямки и ходы', desc: 'глазница, ямки, полость носа', view: { screen: 'ageSetup', set: 'walls' } },
    ] },
];
const EVENT_RED_DAYS = 2;   /* за сколько дней свечение становится красным */
function eventStart(ev) { const [y, m, d] = ev.date.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0); }
function eventState(ev, now) {
  now = now || new Date();
  const start = eventStart(ev), end = new Date(start.getTime() + 864e5);
  if (now >= end) return { phase: 'past' };
  if (now >= start) return { phase: 'today', red: true, text: 'СЕГОДНЯ ОПРОС' };
  const ms = start - now, min = Math.floor(ms / 6e4), d = Math.floor(min / 1440), h = Math.floor(min % 1440 / 60), mm = min % 60;
  const text = d >= 1 ? `${d} д ${h} ч` : `${h} ч ${String(mm).padStart(2, '0')} мин`;
  return { phase: 'soon', red: ms <= EVENT_RED_DAYS * 864e5, text };
}
function eventDateLabel(ev) {
  return eventStart(ev).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
}
function activeEvents() { return EVENTS.filter(ev => eventState(ev).phase !== 'past'); }
function pastEvents() { return EVENTS.filter(ev => eventState(ev).phase === 'past'); }
function eventTimerHtml(ev) {
  const st = eventState(ev);
  return `<div class="ev-tw ${st.red ? 'ev-red' : ''}" data-ev="${ev.id}"><span class="ev-glow"></span>
    <div class="ev-timer"><span class="ev-tlabel">${st.phase === 'today' ? '' : 'осталось'}</span><span class="ev-tval">${st.text}</span></div></div>`;
}
function eventBlocksHtml() {
  return activeEvents().map(ev => `
    <div class="ev-block">
      <div class="ev-info">
        <div class="ev-title">${ev.icon} ${ev.title}</div>
        <div class="ev-date">${eventDateLabel(ev)}</div>
        <button class="btn btn-primary ev-prep" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'eventPrep', eventId: ev.id}))})'>📚 Подготовка</button>
      </div>
      ${eventTimerHtml(ev)}
    </div>`).join('');
}
function eventArchiveLinkHtml() {
  const n = pastEvents().length;
  return n ? `<div class="ev-archive-link"><button class="back-btn" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'eventArchive'}))})'>🗂 Архив событий (${n})</button></div>` : '';
}
function eventStartExam(eventId) {
  const ev = EVENTS.find(e => e.id === eventId); if (!ev) return;
  const topics = ev.topics.filter(id => findTopic(id));
  if (typeof EXAM_SEL !== 'undefined') EXAM_SEL = new Set(topics);
  const n = Math.min(20, cardQuestionPool(topics).length);
  goTo({ screen: 'game', mode: 'exam', topics, count: n });
}
function renderEventPrep(eventId) {
  const ev = EVENTS.find(e => e.id === eventId) || EVENTS[0];
  const st = eventState(ev);
  let html = renderTopbar();
  html += backRow(st.phase === 'past' ? 'Архив событий' : 'Карта тем', { screen: st.phase === 'past' ? 'eventArchive' : 'map' });
  html += `<div class="hub-header"><h1>📚 Подготовка</h1><div class="hub-latin">${ev.title} · ${eventDateLabel(ev)}</div></div>`;
  if (st.phase !== 'past') html += `<div class="ev-block ev-block-solo">${eventTimerHtml(ev)}</div>`;
  if (ev.id === 'face_2026_10_14') html += `<div class="section-block"><div class="st-hero" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'stestSetup' }))})'>
      <div class="node-emoji">🧪</div><div class="node-body"><div class="node-title">Тест по черепу <span class="new-badge">новое</span></div>
      <div class="node-latin">${STEST.length} вопросов теста кафедры · короткий тест на ${STEST_SHORT_N} и все ответы карточками</div></div>
      <div class="st-hero-go">Начать →</div></div></div>`;
  html += `<div class="section-block"><div class="section-title"><span class="icon">🎯</span><span>Пробный прогон</span></div>
    <div class="topic-node" onclick="eventStartExam('${ev.id}')">
      <div class="node-emoji">🎓</div>
      <div class="node-body"><div class="node-title">Пробный прогон · 20 вопросов</div>
      <div class="node-latin">как «Экзамен по темам», только по костям этого опроса</div></div>
    </div></div>`;
  if (ev.extra) {
    html += `<div class="section-block"><div class="section-title"><span class="icon">📝</span><span>Как на тесте</span></div>`;
    ev.extra.forEach(x => { html += `<div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(x.view))})'>
      <div class="node-emoji">${x.icon}</div><div class="node-body"><div class="node-title">${x.title}</div><div class="node-latin">${x.desc}</div></div></div>`; });
    html += `</div>`;
  }
  html += `<div class="section-block"><div class="section-title"><span class="icon">🦴</span><span>Темы опроса</span></div>`;
  ev.topics.map(findTopic).filter(Boolean).forEach(t => { html += topicNodeHtml(t); });
  html += `</div><div class="coming-soon">Когда появятся вопросы или сам тест — они будут здесь 📝</div>`;
  document.getElementById('app').innerHTML = html;
}
function renderEventArchive() {
  let html = renderTopbar();
  html += backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>🗂 Архив событий</h1><div class="hub-latin">прошедшие опросы — подготовка остаётся доступной</div></div><div class="section-block">`;
  pastEvents().forEach(ev => {
    html += `<div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'eventPrep', eventId: ev.id}))})'>
      <div class="node-emoji">${ev.icon}</div><div class="node-body"><div class="node-title">${ev.title}</div><div class="node-latin">${eventDateLabel(ev)}</div></div></div>`;
  });
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}
/* таймеры на экране обновляются раз в 20 секунд без перерисовки страницы */
setInterval(() => {
  document.querySelectorAll('.ev-tw[data-ev]').forEach(el => {
    const ev = EVENTS.find(e => e.id === el.dataset.ev); if (!ev) return;
    const st = eventState(ev);
    if (st.phase === 'past') { if (VIEW && VIEW.screen === 'map') render(); return; }
    el.classList.toggle('ev-red', !!st.red);
    el.querySelector('.ev-tval').textContent = st.text;
    el.querySelector('.ev-tlabel').textContent = st.phase === 'today' ? '' : 'осталось';
  });
}, 20000);

/* ---------- поддержка проекта ---------- */
const SUPPORT_URL = 'https://boosty.to/3den1';
function supportBlockHtml() {
  return `<div class="support-block">
      <div class="support-text">Тренажёр бесплатный и таким останется. Если он помог — можно сказать спасибо.</div>
      <div class="support-btns">
        <a class="btn btn-ghost support-btn" href="${SUPPORT_URL}" target="_blank" rel="noopener">☕ Поддержать автора</a>
        <button class="btn btn-ghost support-btn" onclick="shareAppLink(this)">🔗 Скопировать ссылку на тренажёр</button>
      </div>
    </div>`;
}
const APP_LINK = 'https://claude.ai/artifact/DazunysXmZP4y1CuHCMGVc';
function shareAppLink(btn) {
  /* копируем всегда ссылку на сам тренажёр (location.href внутри артефакта — служебный адрес) */
  let ok = false;
  try { ok = copyTextFallback(APP_LINK); } catch (e) {}
  const show = success => showToast(success ? '✅ Ссылка на тренажёр скопирована' : 'Скопируй ссылку: ' + APP_LINK, success ? 1600 : 6000);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(APP_LINK).then(() => show(true), () => show(ok));
  } else show(ok);
}
function showToast(text, ms) {
  let t = document.getElementById('appToast');
  if (!t) { t = document.createElement('div'); t.id = 'appToast'; t.className = 'app-toast'; document.body.appendChild(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => t.classList.remove('show'), ms || 1600);
}

/* ===================== ЭКРАН: ХАБ ТЕМЫ ===================== */
/* ---------- группы костей на карте ---------- */
const SKELETON_GROUPS = [
  { id: 'skull', title: 'Череп', icon: '💀', desc: 'мозговой и лицевой отделы, череп в целом', sections: ['skull', 'face', 'skullwhole'] },
  { id: 'spine', title: 'Осевой скелет', icon: '🧍', desc: 'позвонки, рёбра и грудина', sections: ['spine', 'thorax'] },
  { id: 'limbs', title: 'Конечности', icon: '🦾', desc: 'верхняя и нижняя конечности', sections: ['upperlimb', 'lowerlimb'] },
];
const ARTHRO_GROUPS = [
  { id: 'a_axial', title: 'Общая артрология и осевой скелет', icon: '🔗', desc: 'виды соединений, ВНЧС, позвоночник, рёбра', sections: ['jgeneral', 'jaxial'] },
  { id: 'a_upper', title: 'Суставы верхней конечности', icon: '💪', desc: 'грудино-ключичный, плечевой, локтевой, кисть', sections: ['jupper'] },
  { id: 'a_lower', title: 'Суставы нижней конечности', icon: '🦵', desc: 'таз, тазобедренный, коленный, голеностоп, стопа', sections: ['jlower'] },
  { id: 'a_all', title: 'Артрология целиком', icon: '🔗', desc: 'все соединения — для обзорного занятия', sections: ['jgeneral', 'jaxial', 'jupper', 'jlower'], hidden: true },
];
const MYO_GROUPS = [
  { id: 'm_upper', title: 'Мышцы верхней конечности', icon: '💪', desc: 'плечевой пояс и плечо', sections: ['myupper'] },
  { id: 'm_trunk', title: 'Мышцы туловища и шеи', icon: '🏋️', desc: 'спина, живот, паховый канал, шея', sections: ['mytrunk'] },
];
const ALL_GROUPS = SKELETON_GROUPS.concat(ARTHRO_GROUPS, MYO_GROUPS);
function isMuscleTopic(topicId) { return /^m_/.test(topicId || ''); }
function isJointTopic(topicId) { return /^j_/.test(topicId || ''); }
function groupTopics(g) {
  return g.sections.flatMap(id => (CONTENT.sections.find(s => s.id === id) || { topics: [] }).topics);
}
function groupOfTopic(topicId) {
  return ALL_GROUPS.find(g => !g.hidden && groupTopics(g).some(t => t.id === topicId));
}
function topicStarTotal(topicId) {
  const tp = getTopicProgress(topicId);
  return MODES.reduce((s, m) => s + (m.id === 'picture'
    ? Math.max((tp.picture && tp.picture.stars) || 0, (tp.legend && tp.legend.stars) || 0)
    : ((tp[m.id] && tp[m.id].stars) || 0)), 0);
}
function topicNodeHtml(topic) {
  return `
    <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'hub', topicId: topic.id}))})'>
      <div class="node-emoji">${isJointTopic(topic.id) ? '🔗' : isMuscleTopic(topic.id) ? '💪' : '🦴'}</div>
      <div class="node-body">
        <div class="node-title">${topic.title}</div>
        <div class="node-latin">${topic.latin}</div>
      </div>
      <div class="node-progress">${topicStarTotal(topic.id)}/${MODES.length * 3} ⭐</div>
    </div>`;
}
function renderGroup(groupId) {
  const g = ALL_GROUPS.find(x => x.id === groupId) || SKELETON_GROUPS[0];
  let html = renderTopbar();
  html += backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>${g.icon} ${g.title}</h1><div class="hub-latin">${g.desc}</div></div>`;
  const secs = g.sections.map(id => CONTENT.sections.find(s => s.id === id)).filter(Boolean);
  secs.forEach(sec => {
    html += `<div class="section-block">`;
    if (secs.length > 1) html += `<div class="section-title"><span class="icon">${sec.icon}</span><span>${sec.title}</span></div>`;
    sec.topics.forEach(t => { html += topicNodeHtml(t); });
    html += `</div>`;
  });
  if (/^a_/.test(g.id)) { const gs = { a_axial: 'head', a_upper: 'upper', a_lower: 'lower', a_all: 'all' }[g.id];
    html += `<div class="section-block"><div class="section-title"><span class="icon">🧭</span><span>Проверь себя</span></div>
    <div class="topic-node" onclick="APP.goToJSON(JSON.stringify({ screen: 'otestSetup' }))"><div class="node-emoji">🦴</div>
    <div class="node-body"><div class="node-title">Тест обзора: артрология <span class="new-badge">новое</span></div><div class="node-latin">50 вопросов теста кафедры, выбор вариантов</div></div></div>
    <div class="topic-node" onclick="AX_SET='${gs}'; APP.goToJSON(JSON.stringify({ screen: 'axesSetup' }))"><div class="node-emoji">🧭</div>
    <div class="node-body"><div class="node-title">Оси и движения <span class="new-badge">новое</span></div><div class="node-latin">Форма → оси → движения: ${AXGRP[gs].toLowerCase()} · ${gs === 'all' ? AXJ.length : AXJ.filter(j => j.grp === gs).length} суставов</div></div></div></div>`; }
  if (g.id === 'skull') html += `<div class="section-block"><div class="section-title"><span class="icon">🧪</span><span>Проверь себя</span></div>
    <div class="topic-node" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'stestSetup' }))})'><div class="node-emoji">🧪</div>
    <div class="node-body"><div class="node-title">Тест по черепу</div><div class="node-latin">Вопросы теста кафедры: «Укажите» — выбор вариантов, «Перечислите/Назовите» — письменно</div></div></div></div>`;
  document.getElementById('app').innerHTML = html;
}

function renderHub(topicId) {
  const topic = findTopic(topicId);
  const tp = getTopicProgress(topicId);
  let html = renderTopbar();
  const grp = groupOfTopic(topicId);
  html += grp ? backRow(grp.title, { screen: 'group', groupId: grp.id }) : backRow('Карта тем', { screen: 'map' });
  html += `
    <div class="hub-header">
      <h1>${topic.title}</h1>
      <div class="hub-latin">${topic.latin}</div>
    </div>
    <div class="hub-layout">${(topic.images || []).length ? `<div class="hub-pic"><img src="${IMAGES[topic.images[0].src]}" onclick="openImageZoom('${topic.images[0].src}')" alt=""><div class="lg-pic-hint">нажми, чтобы увеличить</div></div>` : ''}
    <div class="mode-grid">`;

  MODES.forEach(m => {
    if (m.id === 'picture' && !(topic.images || []).length) return;
    let st = (tp[m.id] && tp[m.id].stars) || 0;
    const target = modeEntryTarget(m.id, topicId);
    html += `
      <div class="mode-card" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(target))})'>
        <div class="mode-emoji">${m.emoji}</div>
        <div class="mode-body">
          <div class="mode-title">${m.title}</div>
          <div class="mode-desc">${m.desc}</div>
        </div>
        <div class="mode-stars">${modeStarsHtml(m.id, tp[m.id])}</div>
        ${guideBtn(m.id, topicId)}
      </div>`;
  });

  html += `
      <div class="mode-card glossary-card" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'glossary', topicId}))})'>
        <div class="mode-emoji">📖</div>
        <div class="mode-body">
          <div class="mode-title">Справочник</div>
          <div class="mode-desc">${isJointTopic(topicId) ? 'Всё о соединении: строение, форма, оси, связки, клиника' : isMuscleTopic(topicId) ? 'Начало, прикрепление, функция и иннервация каждой мышцы — таблицей' : 'Всё о кости кратко, как энциклопедическая статья'}</div>
        </div>
      </div>
      ${AXJ.some(j => j.tp === topicId) ? `<div class="mode-card glossary-card" onclick="axStart('topic', ${JSON.stringify(AXJ.filter(j => j.tp === topicId).map(j => j.id)).replace(/"/g, "'")})">
        <div class="mode-emoji">🧭</div>
        <div class="mode-body">
          <div class="mode-title">Оси и движения <span class="new-badge">новое</span></div>
          <div class="mode-desc">Форма → оси → движения с анимацией: ${AXJ.filter(j => j.tp === topicId).map(j => j.ru.split(' (')[0].toLowerCase()).join(', ')}</div>
        </div>
      </div>` : ''}
      ${isMuscleTopic(topicId) && maHasTopic(topicId) ? `<div class="mode-card glossary-card" onclick='MA=null; APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'maSetup', topicId}))})'>
        <div class="mode-emoji">💪</div>
        <div class="mode-body">
          <div class="mode-title">Мышцы в действии <span class="new-badge">новое</span></div>
          <div class="mode-desc">Кто делает движение · что выпадет при повреждении нерва · мышца по описанию</div>
        </div>
      </div>` : ''}
      ${scenarioOf(topicId) ? `<div class="mode-card glossary-card" onclick='SCN=null; APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'scenario', topicId}))})'>
        <div class="mode-emoji">🗣️</div>
        <div class="mode-body">
          <div class="mode-title">Сценарий ответа <span class="new-badge">новое</span></div>
          <div class="mode-desc">${isJointTopic(topicId) ? 'Как рассказать соединение по шагам: кости, форма, капсула, связки, движения' : isMuscleTopic(topicId) ? 'Как рассказать мышцы по шагам: начало, прикрепление, функция, иннервация' : 'Как рассказать кость по шагам — по Привесу'}</div>
        </div>
      </div>` : ''}
    </div></div>`;

  document.getElementById('app').innerHTML = html;
}

/* ===================== ЭКРАН: ГЛОССАРИЙ ===================== */
/* ---------- карточки темы: одна запись на уникальную картинку ----------
   (у теменной и решётчатой два рисунка на одной карточке — объединяем их цифры) */
function topicCards(topic) {
  const map = new Map();
  (topic.images || []).forEach(im => {
    if (!map.has(im.src)) map.set(im.src, { src: im.src, labels: [], hotspots: [], w: im.w, h: im.h });
    const c = map.get(im.src);
    c.labels.push(im.label);
    c.hotspots = c.hotspots.concat(im.hotspots);
  });
  return [...map.values()].map(c => Object.assign(c, { label: c.labels.join(' · ') }));
}
function cardShortLabel(label, src) { const m = /\((\d+)\)\s*$/.exec(label); if (src && /^jt_/.test(src) && m) return 'карт. №' + m[1]; return label.replace(/^Вид\s+/i, '').toLowerCase(); }
const numVal = n => parseFloat(n);

/* номера термина на карточках: одинаковый везде → одна плашка, разный → плашка с подписью вида */
function termNumberBadges(topic, cards, termId) {
  const found = [];
  cards.forEach(c => {
    const ns = [...new Set(c.hotspots.filter(h => h.term === termId).map(h => h.n))].sort((a, b) => numVal(a) - numVal(b));
    ns.forEach(n => found.push({ n, card: c }));
  });
  if (!found.length) return '';
  const distinct = [...new Set(found.map(f => f.n))];
  const one = distinct.length === 1;
  const seen = new Set();
  return found.filter(f => {
    const key = one ? f.n : f.n + '|' + f.card.src;
    if (seen.has(key)) return false; seen.add(key); return true;
  }).map(f => {
    const v = { screen: 'cardmap', topicId: topic.id, src: f.card.src, sel: f.n };
    return `<button class="tl-num" title="Показать на карточке: ${f.card.label}" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(v))})'>${f.n}${one || cards.length < 2 ? '' : `<span class="tl-num-card">${cardShortLabel(f.card.labels[0], f.card.src)}</span>`}</button>`;
  }).join('');
}

function renderGlossary(topicId) {
  const topic = findTopic(topicId);
  const cards = topicCards(topic);
  let html = renderTopbar();
  html += backRow(topic.title, { screen: 'hub', topicId });
  html += `<div class="glossary-wrap"><div class="glossary-article">`;
  html += `<h1>${topic.title}</h1><div class="glossary-latin">${topic.latin}</div>`;

  if (cards.length) {
    html += `<div class="gl-cards gl-cards-${Math.min(cards.length, 4)}">`;
    cards.forEach(c => {
      const v = { screen: 'cardmap', topicId, src: c.src };
      html += `<div class="gl-card">
          <img src="${IMAGES[c.src]}" alt="${c.label}" title="Нажми, чтобы увеличить" onclick="openImageZoom('${c.src}')">
          <div class="gl-card-label">${c.label}</div>
          <button class="btn btn-primary btn-block gl-map-btn" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(v))})'>🗺️ Интерактивная карта</button>
        </div>`;
    });
    html += `</div>`;
  }

  html += topic.glossary;

  html += `<div class="term-list">`;
  topic.terms.forEach(t => {
    const badges = termNumberBadges(topic, cards, t.id);
    html += `<div class="term-row">
        <div class="tl-nums">${badges}</div>
        <div class="term-left">
          <div class="tl-lat">${t.lat}</div>
          <div class="tl-translit">${t.translit || ''}</div>
        </div>
        <div class="tl-ru">${t.ru}</div>
        ${edTermBtn(topicId, t.id)}${favTermStar(topicId, t.id, 'row-star')}
      </div>`;
  });
  html += `</div>`;
  if (cards.length) html += `<div class="tl-hint">Номер — цифра на карточке Сапина. Нажми на номер, чтобы увидеть его на карте.</div>`;

  html += `</div></div>`;
  document.getElementById('app').innerHTML = html;
}

/* ---------- интерактивная карта карточки: нажал на цифру — видишь, что это ---------- */
let CARDMAP_SEL = null;
/* масштаб интерактивной карты: карточку можно увеличить и прокручивать, цифры нажимаются при любом масштабе */
const CARDMAP_ZOOMS = [1, 1.5, 2, 3];
let CARDMAP_ZOOM = 1;
let CARDMAP_CENTER = false;   /* после выбора строки легенды — прокрутить увеличенную карточку к цифре */
function cardCropBox(hotspots, src) {
  /* готовая рамка по самому рисунку (рисунок + все цифры) — чтобы кость не обрезалась */
  const pre = src && CONTENT.crops && CONTENT.crops[src];
  if (pre) return pre;
  const xs = hotspots.map(h => h.x), ys = hotspots.map(h => h.y);
  let x0 = Math.max(0, Math.min(...xs) - 7), x1 = Math.min(100, Math.max(...xs) + 7);
  let y0 = Math.max(0, Math.min(...ys) - 5), y1 = Math.min(100, Math.max(...ys) + 5);
  if (x1 - x0 < 60) { const c = (x0 + x1) / 2; x0 = Math.max(0, c - 30); x1 = Math.min(100, c + 30); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function cardLegend(topic, card) {
  const seen = new Set(), out = [];
  card.hotspots.slice().sort((a, b) => numVal(a.n) - numVal(b.n)).forEach(h => {
    if (seen.has(h.n)) return; seen.add(h.n);
    out.push({ n: h.n, term: topic.terms.find(t => t.id === h.term) });
  });
  return out;
}

function renderCardMap(topicId, src, sel) {
  const topic = findTopic(topicId);
  const card = topicCards(topic).find(c => c.src === src) || topicCards(topic)[0];
  if (sel !== undefined) CARDMAP_SEL = sel;
  const legend = cardLegend(topic, card);
  if (CARDMAP_SEL && !legend.some(l => l.n === CARDMAP_SEL)) CARDMAP_SEL = null;
  const box = (typeof isEditor === 'function' && isEditor()) ? { x: 0, y: 0, w: 100, h: 100 } : cardCropBox(card.hotspots, card.src);
  const ar = (box.w * (card.w || 900)) / (box.h * (card.h || 1286));

  let html = renderTopbar();
  html += VIEW.back ? backRow(VIEW.backLabel || 'Назад', VIEW.back) : backRow('Справочник', { screen: 'glossary', topicId });
  html += `<div class="game-body lg-layout cm-layout">
    <div class="lg-stick">
      ${cardMapViewNav(topic, card)}
      <div class="cm-zoombar">
        <button class="cm-zbtn" onclick="cardMapZoom(-1)" ${CARDMAP_ZOOM <= CARDMAP_ZOOMS[0] ? 'disabled' : ''} title="Уменьшить">−</button>
        <span class="cm-zval">${Math.round(CARDMAP_ZOOM * 100)}%</span>
        <button class="cm-zbtn" onclick="cardMapZoom(1)" ${CARDMAP_ZOOM >= CARDMAP_ZOOMS[CARDMAP_ZOOMS.length - 1] ? 'disabled' : ''} title="Увеличить">+</button>
        ${CARDMAP_ZOOM > 1 ? '<button class="cm-zfit" onclick="cardMapFit()">⤢ Целиком</button><span class="cm-zhint">карточку можно прокручивать</span>' : ''}
      </div>
      <div class="cm-zoombox ${CARDMAP_ZOOM > 1 ? 'zoomed' : ''}" id="cmBox" style="--ar:${ar.toFixed(4)}">
      <div class="lg-pic cm-pic" id="cmPic" style="--ar:${ar.toFixed(4)};--z:${CARDMAP_ZOOM}" onclick="cardMapClick(event)">
        <img src="${IMAGES[card.src]}" draggable="false" alt="${card.label}"
             style="width:${(10000 / box.w).toFixed(2)}%;left:${(-box.x / box.w * 100).toFixed(2)}%;top:${(-box.y / box.h * 100).toFixed(2)}%">`;
  if (CARDMAP_SEL) {
    card.hotspots.filter(h => h.n === CARDMAP_SEL).forEach(h => {
      html += `<span class="lg-ring-base cm-ring" style="left:${((h.x - box.x) / box.w * 100).toFixed(2)}%;top:${((h.y - box.y) / box.h * 100).toFixed(2)}%"></span>`;
    });
  }
  html += edHandlesHtml(topic, card, box);
  html += `</div></div>`;
  const cur = CARDMAP_SEL && legend.find(l => l.n === CARDMAP_SEL);
  html += cur
    ? `<div class="cm-info"><span class="lg-num">${cur.n}</span><div><b>${cur.term.lat}</b> <span class="base-tr">[${cur.term.translit}]</span><div class="cm-info-ru">${cur.term.ru}</div></div>${edTermBtn(topicId, cur.term.id)}${favTermStar(topicId, cur.term.id, 'cm-info-star')}</div>`
    : `<div class="cm-info cm-info-empty">👆 Нажми на любую цифру на карточке</div>`;
  html += `</div>
    <div class="lg-side">
      <div class="lg-prompt">${topic.title}</div>
      <div class="lg-sub">${card.label} · все номера карточки (${legend.length}) — нажми на строку, чтобы найти цифру</div>
      <div class="lg-slots">`;
  legend.forEach(l => {
    html += `<div class="lg-slot cm-row ${l.n === CARDMAP_SEL ? 'lg-active' : ''}" onclick="cardMapSelect('${l.n}', true)">
        <span class="lg-num">${l.n}</span>
        <span class="lg-val"><b>${l.term.lat}</b><span class="lg-ru">${l.term.ru}</span></span>${edTermBtn(topicId, l.term.id)}${favTermStar(topicId, l.term.id)}
      </div>`;
  });
  html += `</div></div></div>`;
  document.getElementById('app').innerHTML = html;
  edBindHandles(topic, card, box);
}

function cardMapClick(e) {
  if (typeof ED_DRAGGED !== 'undefined' && ED_DRAGGED) return;
  const topic = findTopic(VIEW.topicId);
  const card = topicCards(topic).find(c => c.src === VIEW.src) || topicCards(topic)[0];
  const box = (typeof isEditor === 'function' && isEditor()) ? { x: 0, y: 0, w: 100, h: 100 } : cardCropBox(card.hotspots, card.src);
  const r = document.getElementById('cmPic').getBoundingClientRect();
  const x = box.x + ((e.clientX - r.left) / r.width) * box.w;
  const y = box.y + ((e.clientY - r.top) / r.height) * box.h;
  /* ближайшая цифра в разумном радиусе */
  let best = null;
  card.hotspots.forEach(h => { const d = Math.hypot(x - h.x, y - h.y); if (!best || d < best.d) best = { h, d }; });
  if (best && best.d <= Math.max(best.h.r || 5, 5) * 1.2) cardMapSelect(best.h.n, false);
}
function cardMapSelect(n, scrollUp) {
  CARDMAP_SEL = (CARDMAP_SEL === n && !scrollUp) ? null : n;
  const y = window.scrollY;
  if (scrollUp) CARDMAP_CENTER = true;
  cardMapRerender();
  if (scrollUp) window.scrollTo({ top: 0, behavior: 'smooth' });   /* карточка над легендой — показываем её */
  else window.scrollTo(0, y);
}
/* перерисовка с сохранением прокрутки увеличенной карточки */
function cardMapRerender(keepCenter) {
  const bx = document.getElementById('cmBox');
  const prev = bx ? { l: bx.scrollLeft, t: bx.scrollTop, w: bx.scrollWidth, h: bx.scrollHeight, cw: bx.clientWidth, ch: bx.clientHeight } : null;
  renderCardMap(VIEW.topicId, VIEW.src);
  const nb = document.getElementById('cmBox');
  if (!nb) return;
  if (CARDMAP_CENTER) {
    CARDMAP_CENTER = false;
    const ring = nb.querySelector('.cm-ring');
    if (ring && CARDMAP_ZOOM > 1) {
      nb.scrollLeft = ring.offsetLeft - nb.clientWidth / 2;
      nb.scrollTop = ring.offsetTop - nb.clientHeight / 2;
      return;
    }
  }
  if (prev) {
    if (keepCenter) {   /* при смене масштаба держим в центре ту же точку карточки */
      const fx = (prev.l + prev.cw / 2) / prev.w, fy = (prev.t + prev.ch / 2) / prev.h;
      nb.scrollLeft = fx * nb.scrollWidth - nb.clientWidth / 2;
      nb.scrollTop = fy * nb.scrollHeight - nb.clientHeight / 2;
    } else { nb.scrollLeft = prev.l; nb.scrollTop = prev.t; }
  }
}
function cardMapFit() {
  if (CARDMAP_ZOOM === 1) return;
  CARDMAP_ZOOM = 1;
  const y = window.scrollY;
  cardMapRerender();
  window.scrollTo(0, y);
}
/* переключение видов кости прямо на карте: стрелки ← → по краям и вкладки всех видов */
function cardMapViewNav(topic, card) {
  const cards = topicCards(topic);
  if (cards.length < 2) return '';
  const i = cards.findIndex(c => c.src === card.src);
  const go = c => `APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'cardmap', topicId: topic.id, src: c.src }))})`;
  const short = c => cardShortLabel(c.labels[0], c.src);
  const prev = cards[i - 1], next = cards[i + 1];
  let html = `<div class="cm-viewnav">
      <button class="cm-vbtn" ${prev ? `onclick='${go(prev)}'` : 'disabled'} title="${prev ? 'Предыдущий вид: ' + prev.label : ''}">←<span class="cm-vlabel">${prev ? short(prev) : ''}</span></button>
      <div class="cm-vcount">вид ${i + 1} из ${cards.length}</div>
      <button class="cm-vbtn cm-vnext" ${next ? `onclick='${go(next)}'` : 'disabled'} title="${next ? 'Следующий вид: ' + next.label : ''}"><span class="cm-vlabel">${next ? short(next) : ''}</span>→</button>
    </div><div class="cm-vtabs">`;
  cards.forEach((c, j) => {
    html += `<button class="base-chip ${j === i ? 'on' : ''}" ${j === i ? '' : `onclick='${go(c)}'`}>${c.label}</button>`;
  });
  return html + `</div>`;
}
function cardMapStep(dir) {
  const topic = findTopic(VIEW.topicId), cards = topicCards(topic);
  const i = cards.findIndex(c => c.src === VIEW.src), n = cards[i + dir];
  if (n) { goTo({ screen: 'cardmap', topicId: topic.id, src: n.src }); window.scrollTo(0, 0); }
}
/* стрелки клавиатуры на интерактивной карте */
document.addEventListener('keydown', e => {
  if (!VIEW || VIEW.screen !== 'cardmap') return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (document.getElementById('reportModal')) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); cardMapStep(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); cardMapStep(1); }
});

function cardMapZoom(dir) {
  const i = CARDMAP_ZOOMS.indexOf(CARDMAP_ZOOM);
  const ni = Math.max(0, Math.min(CARDMAP_ZOOMS.length - 1, (i < 0 ? 0 : i) + dir));
  if (CARDMAP_ZOOMS[ni] === CARDMAP_ZOOM) return;
  CARDMAP_ZOOM = CARDMAP_ZOOMS[ni];
  const y = window.scrollY;
  cardMapRerender(true);
  window.scrollTo(0, y);
}

/* ===================== ЛАЙТБОКС ДЛЯ КАРТИНОК ГЛОССАРИЯ ===================== */
function openImageZoom(key) {
  let overlay = document.getElementById('imgZoomOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'imgZoomOverlay';
    overlay.className = 'img-zoom-overlay';
    overlay.onclick = closeImageZoom;
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<img src="${IMAGES[key]}" class="img-zoom-full">`;
  overlay.style.display = 'flex';
}
function closeImageZoom() {
  const overlay = document.getElementById('imgZoomOverlay');
  if (overlay) overlay.style.display = 'none';
}

/* ===================== КОНФЕТТИ (за новую звезду) ===================== */
function launchConfetti() {
  try {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const old = document.getElementById('confettiCanvas'); if (old) old.remove();
    const cv = document.createElement('canvas');
    cv.id = 'confettiCanvas';
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
    document.body.appendChild(cv);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d'); if (!ctx) { cv.remove(); return; }
    ctx.scale(dpr, dpr);
    const colors = ['#b8901f', '#e8c25a', '#3f6e58', '#6fae8c', '#a3402c', '#e07a5f', '#4a78a8', '#f2f0e6'];
    const N = reduce ? 40 : 150;
    const parts = [];
    for (let i = 0; i < N; i++) {
      /* два залпа — из левого и правого нижних углов, вверх и к центру */
      const left = i % 2 === 0;
      const ang = (left ? -60 : -120) * Math.PI / 180 + (Math.random() - .5) * .9;
      const sp = (reduce ? 6 : 9) + Math.random() * 8;
      parts.push({
        x: left ? W * 0.05 : W * 0.95, y: H * 0.95,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 1.25,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
        rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .35,
        c: colors[(Math.random() * colors.length) | 0], round: Math.random() < .3,
      });
    }
    const start = performance.now(), DUR = reduce ? 1400 : 2800;
    function frame(t) {
      const el = t - start;
      ctx.clearRect(0, 0, W, H);
      const fade = el > DUR - 600 ? Math.max(0, (DUR - el) / 600) : 1;
      parts.forEach(p => {
        p.vy += 0.28; p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h * .6, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
        ctx.restore();
      });
      if (el < DUR) requestAnimationFrame(frame); else cv.remove();
    }
    requestAnimationFrame(frame);
  } catch (e) { /* украшение — если что-то не так, просто пропускаем */ }
}

/* ===================== ГАЙДЫ ПО РЕЖИМАМ ===================== */
const GUIDE_TITLES = {
  picture: { title: 'Найди на картинке', emoji: '🖱️' },
  legend: { title: 'Составь легенду', emoji: '📋' },
  base: { title: 'База латыни', emoji: '🔤' },
  truefalse: { title: 'Верно / Неверно', emoji: '✅' },
  builder: { title: 'Собери термин', emoji: '🧩' },
  speed: { title: 'Скоростной квиз', emoji: '⚡' },
  exam: { title: 'Экзамен по темам', emoji: '🎓' },
  weakspots: { title: 'Слабые места', emoji: '🎯' },
};
const GUIDES = {
  picture: {
    steps: [
      'Работа с карточками Сапина. Сначала выбираешь один из двух вариантов (ниже).',
      '<b>По цифрам:</b> сверху название структуры — нажми на её <b>цифру</b> на карточке. Засчитывается сама цифра, а не конец стрелки; если цифры рядом — та, к которой клик ближе.',
      '<b>Составь легенду:</b> даны номера на карточке — расставь к ним названия из списка внизу. Там есть 1–2 лишних термина.',
      'Ошибся — покажут правильный ответ, в конце раунда будет разбор ошибок.',
    ],
    facts: 'По цифрам — 10 заданий (на «Враче» 10 секунд на вопрос и 3 жизни); легенда — 5 заданий или вся карточка на экзамене.',
    scoring: 'По цифрам — по звезде за каждый уровень, пройденный на 80%+. Составь легенду — ★★★ от 90%, ★★ от 70%, ★ от 40%.',
    diffTitle: 'Два варианта',
    diffRows: [
      { name: '🖱️ По цифрам', text: 'Дано название → найди его цифру на карточке. Три уровня: 🙂 русский + латынь; 😐 только латынь; 🩺 только латынь, 10 секунд и 3 жизни. По звезде за каждый уровень на 80%+' },
      { name: '📋 Составь легенду', text: 'Даны номера → подпиши их. Внутри две сложности: тренировка (4–5 номеров подряд) и экзамен (все цифры карточки)' },
    ],
    nextLabel: 'Понятно — к выбору варианта →',
  },
  base: {
    steps: [
      'Здесь учатся <b>отдельные слова</b>, из которых складываются термины: sulcus — борозда, fossa — ямка, superior — верхний, os frontale — лобная кость.',
      'Выбери группы слов (можно все) и направление. Показано слово — выбери правильный вариант из четырёх.',
      'После ответа видно словарную форму — как слово записывают на латыни (sulcus, i m). Читай сколько нужно — дальше переходишь сам кнопкой «Далее».',
      'Слова, в которых ты ошибался, и новые слова попадают в раунд чаще. Ошибки из базы появляются и в «Слабых местах».',
      '«Словарик» — все слова списком, чтобы сначала прочитать, а потом проверить себя.',
    ],
    facts: 'До 15 слов за раунд, времени не ограничено.',
    scoring: '★★★ — от 90% верных, ★★ — от 70%, ★ — от 50%.',
    diffTitle: 'Два направления',
    diffRows: [
      { name: '🏛️ Латынь → русский', text: 'Видишь sulcus — выбираешь «борозда». Легче: помогает узнавать слова в терминах' },
      { name: '🇷🇺 Русский → латынь', text: 'Видишь «борозда» — выбираешь sulcus. Сложнее: нужно для того, чтобы самому писать термины' },
    ],
    nextLabel: 'Понятно — к словам →',
  },
  legend: {
    steps: [
      'Показана карточка Сапина и номера, которые нужно подписать: в тренировке 4–5 подряд (обведены на карточке), на экзамене — все цифры карточки.',
      'Нажимай термины внизу — термин встаёт в выделенную строку, выделение переходит на следующую пустую.',
      'Нажми на заполненную строку, чтобы убрать термин и вписать другой. «Очистить» — начать задание заново.',
      'В списке 1–2 лишних термина той же кости — их никуда ставить не нужно.',
      'Когда всё заполнено — «Проверить»: неверные строки подсветятся красным с правильным ответом. Карточку можно увеличить нажатием.',
    ],
    facts: 'Тренировка — 5 заданий, экзамен — одна карточка целиком. Времени не ограничено.',
    scoring: '★★★ — от 90% верно подписанных номеров, ★★ — от 70%, ★ — от 40%.',
    diffRows: [
      { name: '📝 Тренировка', text: '5 заданий по 4–5 номеров подряд с разных карточек кости' },
      { name: '🎓 Экзамен', text: 'Все цифры выбранной карточки сразу — как на зачёте' },
    ],
    nextLabel: 'Понятно — к выбору сложности →',
  },
  truefalse: {
    steps: [
      'Показан латинский термин и под ним — перевод.',
      'Реши, правильный ли это перевод: <b>✓ Верно</b> или <b>✕ Неверно</b>.',
      'Ровно половина вопросов — верные, в остальных подставлен перевод другого термина этой же кости.',
      'Не успел до конца таймера — ответ считается ошибкой.',
    ],
    facts: '16 вопросов.',
    scoring: 'По звезде за каждый уровень: пройди «Лёгкую», «Среднюю» и «Врача» на 80% верных и выше. Серия из 8 верных подряд даёт бонус XP.',
  },
  builder: {
    steps: [
      'Показан русский перевод. Собери латинский термин из фишек, нажимая их <b>по порядку</b>.',
      'Нажатие на уже собранную фишку возвращает её в поле.',
      'В поле есть лишние фишки — это части других терминов той же кости.',
      'Жми «Проверить». Ошибся — фишки вернутся в поле, собери заново (ошибка засчитается).',
    ],
    facts: '6 терминов, времени не ограничено.',
    scoring: 'По звезде за каждый уровень: нужно собрать с первой попытки 80% терминов и больше (из 6 — хотя бы 5).',
  },
  speed: {
    steps: [
      'Показан термин по-латыни или по-русски — выбери правильный перевод.',
      'Иногда вопрос другой: «Какие термины по-латыни содержат ‹частицу›?». Варианты даны по-русски — отметь <b>все</b> подходящие и нажми «Ответить». Верных может быть несколько.',
      'После ответа на такой вопрос у каждого варианта появится латынь — видно, где была частица.',
      'На каждый вопрос 14 секунд. Ошибка или конец времени — минус жизнь ❤️.',
    ],
    facts: 'До 20 вопросов, 3 жизни. 3 верных подряд — серия 🔥.',
    scoring: 'По звезде за каждый уровень: нужно 80% верных ответов и выше от числа заданных вопросов.',
  },
  exam: {
    steps: [
      'Сначала выбери кости для экзамена — одну, несколько или все сразу — и число вопросов.',
      'Показано <b>латинское название</b> структуры и карточка Сапина. Нажми на её <b>цифру</b> — как на экзамене, когда просят показать структуру.',
      'Засчитывается сама цифра (не конец стрелки); если одна структура подписана на карточке дважды — подойдёт любая. Перевод на русский откроется после ответа.',
      'Ошибся — правильная цифра подсветится ★. Жми «Далее».',
    ],
    facts: '10, 20 или 40 вопросов на выбор, без таймера и без жизней. Вопросы — вперемешку по всем выбранным костям.',
    scoring: 'Звёзд здесь нет — это проверка: в конце процент верных и разбор всех ошибок.',
    noDiff: 'Сложность одна — ты сам выбираешь темы и число вопросов.',
  },
  weakspots: {
    steps: [
      'Сюда попадают термины, в которых ты <b>ошибся</b> хотя бы раз за последние 4 попытки — в любом режиме.',
      'Каждый термин повторяется <b>тем же типом задания</b>, где была ошибка: найти на картинке, подписать номер, верно/неверно, собрать термин, выбрать перевод, слово из базы. Получается «солянка» режимов.',
      '<b>Таймера нет</b> — даже если ошибка была в режиме на время. Спокойно разберись.',
      'Ответь по термину верно 4 раза подряд (здесь или в любом другом режиме) — и он уйдёт из слабых мест сам.',
    ],
    facts: 'До 12 заданий за раунд — самые «проблемные» и давно не повторявшиеся термины идут первыми.',
    scoring: 'Звёзд здесь нет — только процент верных и разбор ошибок.',
    noDiff: 'Сложности нет — подборка и так собрана из твоих ошибок.',
  },
};

const GUIDE_SKIP_KEY = 'anatoQuestGuideSkip_v1';
function getGuideSkip() {
  try { return JSON.parse(localStorage.getItem(GUIDE_SKIP_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function setGuideSkip(mode, skip) {
  const m = getGuideSkip(); if (skip) m[mode] = true; else delete m[mode];
  try { localStorage.setItem(GUIDE_SKIP_KEY, JSON.stringify(m)); } catch (e) {}
}
function modeHasDifficulty(mode) { return !!DIFFICULTY_BLURBS[mode]; }
/* куда идти после гайда */
function afterGuideTarget(mode, topicId) {
  if (mode === 'base') return { screen: 'base' };
  if (mode === 'exam') return { screen: 'examSetup' };
  if (mode === 'weakspots') return { screen: 'game', mode };
  if (mode === 'picture' || mode === 'legend') return { screen: 'difficulty', mode, topicId };
  return modeHasDifficulty(mode) ? { screen: 'difficulty', mode, topicId } : { screen: 'game', mode, topicId };
}
/* вход в режим: гайд, если пользователь его не отключил */
function modeEntryTarget(mode, topicId) {
  if (getGuideSkip()[mode]) return afterGuideTarget(mode, topicId);
  return { screen: 'guide', mode, topicId };
}

function renderGuide(mode, topicId) {
  const g = GUIDES[mode], t = GUIDE_TITLES[mode];
  const next = afterGuideTarget(mode, topicId);
  const back = mode === 'legend' ? { screen: 'difficulty', mode: 'picture', topicId }
    : topicId ? { screen: 'hub', topicId } : { screen: 'map' };
  const backLabel = mode === 'legend' ? 'Найди на картинке' : topicId ? findTopic(topicId).title : 'Карта тем';
  let html = renderTopbar();
  html += backRow(backLabel, back);
  html += `<div class="guide-wrap">
    <div class="guide-head"><div class="guide-emoji">${t.emoji}</div><div>
      <div class="guide-kicker">Как играть</div><h1 class="guide-title">${t.title}</h1></div></div>
    <ol class="guide-steps">${g.steps.map(x => `<li>${x}</li>`).join('')}</ol>
    <div class="guide-facts">⏱ ${g.facts}</div>`;
  html += `<div class="guide-section-title">${g.diffTitle || 'Сложность'}</div>`;
  if (g.diffRows) {
    html += `<div class="guide-diff">` + g.diffRows.map(r =>
      `<div class="guide-diff-row"><div class="gd-name">${r.name}</div><div class="gd-text">${r.text}</div></div>`).join('') + `</div>`;
  } else if (modeHasDifficulty(mode)) {
    html += `<div class="guide-diff">` + DIFFICULTIES.map(d =>
      `<div class="guide-diff-row"><div class="gd-name">${d.emoji} ${d.title}</div><div class="gd-text">${DIFFICULTY_BLURBS[mode][d.id]}</div></div>`
    ).join('') + `</div>`;
  } else {
    html += `<div class="guide-note">${g.noDiff}</div>`;
  }
  html += `<div class="guide-section-title">${NO_STAR_MODES.includes(mode) ? 'Результат' : 'Звёзды'}</div><div class="guide-note">${g.scoring}${LEVEL_MODES.includes(mode) ? ' Первая звезда — за «Лёгкую», вторая — за «Среднюю», третья — за «Врача».' : ''} В конце раунда — разбор всех ошибок.</div>`;
  const skipped = !!getGuideSkip()[mode];
  html += `<label class="guide-skip"><input type="checkbox" id="guideSkip" ${skipped ? 'checked' : ''}
      onchange="setGuideSkip('${mode}', this.checked)"> Больше не показывать перед этим режимом
      <span class="guide-skip-hint">(гайд всегда можно открыть кнопкой ? на карточке режима)</span></label>`;
  const btnLabel = g.nextLabel || (next.screen === 'difficulty' ? 'Понятно — к выбору сложности →' : 'Понятно — начать →');
  html += `<button class="btn btn-primary btn-block" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(next))})'>${btnLabel}</button>
    </div>`;
  document.getElementById('app').innerHTML = html;
}
/* кнопка «?» на карточке режима (не запускает сам режим) */
function guideBtn(mode, topicId) {
  const v = { screen: 'guide', mode, topicId };
  return `<button class="guide-q" title="Как играть" onclick='event.stopPropagation(); APP.goToJSON(${JSON.stringify(JSON.stringify(v))})'>?</button>`;
}

/* ===================== ЭКРАН: ВЫБОР СЛОЖНОСТИ ===================== */
function choiceCard(emoji, title, desc, target) {
  return `<div class="mode-card" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(target))})'>
      <div class="mode-emoji">${emoji}</div>
      <div class="mode-body"><div class="mode-title">${title}</div><div class="mode-desc">${desc}</div></div>
    </div>`;
}
function renderPictureVariants(topicId) {
  const topic = findTopic(topicId);
  let html = renderTopbar();
  html += backRow(topic.title, { screen: 'hub', topicId });
  html += `<div class="hub-header"><h1>Выбери вариант</h1><div class="hub-latin">Найди на картинке</div>
      <button class="guide-link" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'guide', mode:'picture', topicId}))})'>📘 Как играть</button></div>`;
  html += `<div class="mode-grid">`;
  html += choiceCard('🖱️', 'По цифрам', 'Дано название — нажми на его цифру на карточке · 3 уровня сложности', { screen: 'difficulty', mode: 'picture_levels', topicId });
  html += choiceCard('📋', 'Составь легенду', 'Даны номера на карточке — расставь к ним названия по порядку', modeEntryTarget('legend', topicId));
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}
function renderLegendDifficulty(topicId) {
  const topic = findTopic(topicId);
  let html = renderTopbar();
  html += backRow('Найди на картинке', { screen: 'difficulty', mode: 'picture', topicId });
  html += `<div class="hub-header"><h1>Выбери сложность</h1><div class="hub-latin">Составь легенду</div>
      <button class="guide-link" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'guide', mode:'legend', topicId}))})'>📘 Как играть</button></div>`;
  html += `<div class="mode-grid">`;
  html += choiceCard('📝', 'Тренировка', '5 заданий: подпиши 4–5 номеров подряд, среди терминов 1–2 лишних', { screen: 'game', mode: 'legend', topicId, difficulty: 'train' });
  topic.images.forEach(im => {
    const n = LegendGame.labelsOf(im).length;
    const word = (n % 10 === 1 && n % 100 !== 11) ? 'цифру' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'цифры' : 'цифр';
    html += choiceCard('🎓', `Экзамен · ${im.label}`, `Подпиши все ${n} ${word} этой карточки сразу`, { screen: 'game', mode: 'legend', topicId, difficulty: 'exam', imageId: im.id });
  });
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}

function renderDifficulty(mode, topicId) {
  /* «По цифрам» — уровни сложности режима picture; «назад» ведёт к выбору варианта */
  let backTo = null;
  if (mode === 'picture_levels') { mode = 'picture'; backTo = { screen: 'difficulty', mode: 'picture', topicId }; }
  else if (mode === 'picture') return renderPictureVariants(topicId);
  if (mode === 'legend') return renderLegendDifficulty(topicId);
  const topic = findTopic(topicId);
  const modeInfo = MODES.find(m => m.id === mode);
  let html = renderTopbar();
  html += backTo ? backRow('Найди на картинке', backTo) : backRow(topic.title + ' · ' + modeInfo.title, { screen: 'hub', topicId });
  html += `<div class="hub-header"><h1>Выбери сложность</h1><div class="hub-latin">${backTo ? 'Найди на картинке · по цифрам' : modeInfo.title}</div>
      <button class="guide-link" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'guide', mode, topicId}))})'>📘 Как играть</button></div>`;
  html += `<div class="mode-grid">`;
  DIFFICULTIES.forEach(d => {
    const blurb = (DIFFICULTY_BLURBS[mode] && DIFFICULTY_BLURBS[mode][d.id]) || '';
    const target = { screen: 'game', mode, topicId, difficulty: d.id };
    const rec = getTopicProgress(topicId)[mode];
    const best = (rec && rec.levels && rec.levels[d.id]) || 0;
    const passed = best >= PASS_PCT;
    const status = passed ? `<span class="lvl-ok">★ получена · лучший ${best}%</span>`
      : best ? `<span class="lvl-todo">☆ нужно ${PASS_PCT}% · лучший ${best}%</span>`
      : `<span class="lvl-todo">☆ нужно ${PASS_PCT}% для звезды</span>`;
    html += `
      <div class="mode-card" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(target))})'>
        <div class="mode-emoji">${d.emoji}</div>
        <div class="mode-body">
          <div class="mode-title">${d.title}</div>
          <div class="mode-desc">${blurb}</div>
          <div class="lvl-status">${status}</div>
        </div>
      </div>`;
  });
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}

/* ===================== ЭКРАН: РЕЗУЛЬТАТ ===================== */
function renderResult(opts) {
  /* opts: {topicId?, modeId, stars, scorePct, xpEarned, statLine, mistakes?:[{lat,ru,shown}]} */
  const leveledUp = opts.leveledUp;
  let html = renderTopbar();
  html += `<div class="result-wrap">`;
  if (leveledUp) {
    html += `<div class="levelup-banner">🎉 Новый уровень: ${levelFromXp(PROGRESS.xp)}!</div>`;
  }
  if (opts.levelInfo) {
    const li = opts.levelInfo, cur = DIFFICULTIES.find(d => d.id === li.difficulty);
    html += `<div class="result-levels">` + DIFFICULTIES.map(d => {
      const on = (li.levels[d.id] || 0) >= PASS_PCT, isCur = d.id === li.difficulty;
      const fresh = isCur && li.passed && !li.wasPassed;
      return `<div class="rl-item ${isCur ? 'rl-cur' : ''}"><div class="rl-star ${on ? 'on' : ''} ${fresh ? 'fresh' : ''}">${on ? '★' : '☆'}</div><div class="rl-name">${d.title}</div></div>`;
    }).join('') + `</div>`;
    html += `<div class="rl-note ${li.passed ? 'ok' : ''}">${
      li.passed
        ? (li.wasPassed ? `Уровень «${cur.title}» уже пройден — результат ${opts.scorePct}%` : `⭐ Новая звезда: уровень «${cur.title}» пройден на ${opts.scorePct}%!`)
        : `Для звезды уровня «${cur.title}» нужно ${PASS_PCT}% — у тебя ${opts.scorePct}%`
    }</div>`;
  } else if (opts.noStars) {
    html += `<div class="result-pct">${opts.scorePct}%</div>`;
  } else {
    html += `<div class="result-stars">${starsString(opts.stars)}</div>`;
    if (opts.newStar) html += `<div class="rl-note ok">⭐ Новая звезда!</div>`;
  }
  html += `<h2 class="result-title serif">${opts.title || 'Раунд завершён'}</h2>`;
  html += `<div class="result-sub">${opts.statLine}</div>`;
  html += `<div class="result-xp">✨ +${opts.xpEarned} XP</div>`;

  if (opts.mistakes && opts.mistakes.length) {
    html += `<div class="mistakes-block">
        <div class="mistakes-title">Стоит повторить (${opts.mistakes.length}):</div>`;
    opts.mistakes.forEach(m => {
      html += `<div class="mistake-row">${m.tid && m.id ? favTermStar(m.tid, m.id, 'mistake-star') : ''}
          <div class="mistake-lat">${m.lat}</div>
          <div class="mistake-ru">✓ ${m.ru}${m.chose ? ` <span class="mistake-shown">(ты выбрал: «${m.chose}»)</span>` : (m.shown && m.shown !== m.ru ? ` <span class="mistake-shown">(тебе показали: «${m.shown}»)</span>` : '')}</div>
        </div>`;
    });
    html += `</div>`;
  } else if (opts.mistakes) {
    html += `<div class="mistakes-block mistakes-clean">Ни одной ошибки — идеальный раунд 👏</div>`;
  }

  const retryTarget = ['picture', 'legend', 'base', 'exam', 'weakspots'].includes(opts.modeId) && LAST_GAME_VIEW && LAST_GAME_VIEW.mode === opts.modeId
    ? LAST_GAME_VIEW
    : opts.topicId
    ? afterGuideTarget(opts.modeId, opts.topicId)
    : { screen: 'game', mode: opts.modeId };
  const fromFav = opts.modeId === 'weakspots' && LAST_GAME_VIEW && LAST_GAME_VIEW.source === 'favorites';
  const backTarget = fromFav ? { screen: 'favorites' } : opts.modeId === 'base' ? { screen: 'base' } : opts.modeId === 'exam' ? { screen: 'examSetup' }
    : opts.topicId ? { screen: 'hub', topicId: opts.topicId } : { screen: 'map' };
  const backLabel = fromFav ? 'К избранному' : opts.modeId === 'base' ? 'К базе' : opts.modeId === 'exam' ? 'К выбору тем' : opts.topicId ? 'К темам кости' : 'На карту';

  html += `<div class="result-actions">`;
  html += `<button class="btn btn-primary btn-block" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(retryTarget))})'>Ещё раз</button>`;
  html += `<button class="btn btn-ghost btn-block" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(backTarget))})'>${backLabel}</button>`;
  html += `</div></div>`;
  document.getElementById('app').innerHTML = html;
}

function finishRound(topicId, modeId, stars, scorePct, xpEarned, title, statLine, mistakes) {
  touchStreak();
  const leveledUp = addXp(xpEarned);
  let levelInfo = null, newStar = false;
  const noStars = NO_STAR_MODES.includes(modeId);
  if (noStars) stars = 0;
  const diff = LAST_GAME_VIEW && LAST_GAME_VIEW.mode === modeId && LAST_GAME_VIEW.difficulty;
  /* сколько звёзд у режима было до этого раунда — чтобы понять, получена ли новая */
  const prevStars = topicId
    ? ((getTopicProgress(topicId)[modeId] || {}).stars || 0)
    : (((PROGRESS.globalModes || {})[modeId] || {}).stars || 0);
  if (topicId && LEVEL_MODES.includes(modeId) && diff) {
    levelInfo = setLevelResult(topicId, modeId, diff, scorePct);
    levelInfo.difficulty = diff;
    stars = levelStars({ levels: levelInfo.levels });
    newStar = levelInfo.passed && !levelInfo.wasPassed;
  } else if (topicId) {
    newStar = stars > prevStars;
    setModeResult(topicId, modeId, stars, scorePct);
  } else {
    if (!PROGRESS.globalModes) PROGRESS.globalModes = {};
    const prev = PROGRESS.globalModes[modeId] || { stars: 0, best: 0 };
    PROGRESS.globalModes[modeId] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, scorePct) };
    saveProgress();
    newStar = !noStars && stars > prevStars;
  }
  renderResult({ topicId, modeId, stars, scorePct, xpEarned, leveledUp, title, statLine, mistakes, levelInfo, newStar, noStars });
  if (newStar) setTimeout(launchConfetti, 250);
}

/* ===================== ЭКРАН: КТО ИГРАЕТ ===================== */
function renderProfileScreen() {
  const profiles = getProfileList();
  const active = getActiveProfile();
  let html = '';
  if (active) {
    html += renderTopbar();
    html += backRow('Продолжить как ' + active, { screen: 'map' });
  }
  html += `<div class="profile-screen">`;
  html += `<h1 class="serif profile-heading">Кто играет?</h1>`;
  html += `<p class="profile-sub">Прогресс, XP и звёзды хранятся отдельно для каждого имени в этом браузере</p>`;

  if (profiles.length) {
    html += `<div class="profile-list">`;
    profiles.forEach(name => {
      const cur = name === active;
      const safe = escapeForJsAttr(name);
      if (PENDING_DELETE === name) {
        html += `<div class="profile-row profile-row-confirm">
            <div class="confirm-text">Удалить «${escapeHtml(name)}» и весь прогресс?</div>
            <button class="btn btn-danger" onclick="deleteProfile('${safe}', event)">Удалить</button>
            <button class="btn btn-ghost" onclick="cancelDeleteProfile()">Отмена</button>
          </div>`;
        return;
      }
      html += `<div class="profile-row ${cur ? 'profile-row-active' : ''}">
          <button class="profile-btn" onclick="selectProfile('${safe}')">${cur ? '✓ ' : ''}${escapeHtml(name)}</button>
          <button class="profile-del" onclick="askDeleteProfile('${safe}', event)" title="Удалить профиль">✕</button>
        </div>`;
    });
    html += `</div>`;
  }

  html += `<div class="profile-new">
      <input type="text" id="newProfileName" placeholder="Впиши своё имя" maxlength="20" onkeydown="if(event.key==='Enter')createProfileFromInput()">
      <button class="btn btn-primary btn-block" onclick="createProfileFromInput()">Начать</button>
    </div>`;
  if (!profiles.length) {
    html += `<button class="btn-quickstart" onclick="quickStart()">Просто играть, без имени →</button>`;
  }
  if (active) {
    html += `<div class="data-link" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'data'}))})'>⇄ Экспорт / импорт прогресса</div>`;
  }
  html += supportBlockHtml();
  html += `</div>`;

  document.getElementById('app').innerHTML = html;
  const input = document.getElementById('newProfileName');
  if (input) input.focus();
}

/* ===================== ЭКРАН: МОЯ СТАТИСТИКА ===================== */
/* ---------- статистика: сгруппировано по разделам и костям ---------- */
const MODE_NAMES = {
  picture: '🖱️ Найди на картинке', exam: '🎓 Экзамен', legend: '📋 Легенда', truefalse: '✅ Верно/неверно',
  builder: '🧩 Собери термин', speed: '⚡ Скоростной квиз', weakspots: '🎯 Слабые места',
  base_lr: '🔤 База (лат → рус)', base_rl: '🔤 База (рус → лат)', base: '🔤 База',
};
const STATS_WINDOW = 10;        /* статистика смотрит только на последние 10 попыток по термину */
let STATS_TAB = 'errors';        /* 'errors' | 'learned' */
const STATS_OPEN = new Set();

/* разбор термина по последним попыткам:
   weak    — ошибка среди последних 4 (как в «Слабых местах»);
   fixing  — последние 4 верные, но в окне из 10 ещё есть ошибка;
   learned — в окне ни одной ошибки (100%) */
function termStatInfo(s) {
  const h = ((PROGRESS.termStats || {})[termKey(s.topicId, s.termId)] || {}).history || [];
  const win = h.slice(-STATS_WINDOW);
  const winRight = win.filter(x => x.c).length;
  const lastErrIdx = win.map(x => x.c).lastIndexOf(0);
  const lastErr = lastErrIdx >= 0 ? win[lastErrIdx] : null;
  const streak = lastErrIdx >= 0 ? win.length - 1 - lastErrIdx : win.length;
  const status = !lastErr ? 'learned' : h.slice(-4).some(x => !x.c) ? 'weak' : 'fixing';
  return Object.assign({}, s, {
    status, win: win.length, winRight, streak,
    toLearn: lastErr ? STATS_WINDOW - streak : 0,
    lastErrMode: lastErr && lastErr.m, lastErrAt: lastErr && lastErr.t,
    pct: win.length ? Math.round(winRight / win.length * 100) : 0,
  });
}

function renderStatsScreen() {
  const all = getAllTermStatsResolved().map(termStatInfo);
  let html = renderTopbar();
  html += backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>Моя статистика</h1><div class="hub-latin">по последним ${STATS_WINDOW} попыткам каждого термина</div></div>`;
  if (!all.length) {
    html += `<div class="coming-soon" style="margin:0 20px">Пройди пару упражнений в любом режиме — здесь появится разбор по каждой кости: в каких структурах ошибки, в каком режиме и что уже изучено.</div>`;
    document.getElementById('app').innerHTML = html; return;
  }
  const wAns = all.reduce((a, s) => a + s.win, 0), wRight = all.reduce((a, s) => a + s.winRight, 0);
  const nErr = all.filter(s => s.status !== 'learned').length, nLearned = all.length - nErr;
  html += `<div class="stats-wrap">
    <div class="st-summary">
      <div class="st-sum-card"><b>${all.length}</b><span>терминов встречалось</span></div>
      <div class="st-sum-card"><b>${wAns ? Math.round(wRight / wAns * 100) : 0}%</b><span>верных в последних попытках</span></div>
      <div class="st-sum-card st-sum-weak"><b>${nErr}</b><span>с ошибками</span></div>
      <div class="st-sum-card st-sum-fixed"><b>${nLearned}</b><span>изучено</span></div>
    </div>
    <div class="base-groups st-filter">
      <button class="base-chip ${STATS_TAB === 'errors' ? 'on' : ''}" onclick="STATS_TAB='errors'; renderStatsScreen()">⚠️ С ошибками · ${nErr}</button>
      <button class="base-chip ${STATS_TAB === 'learned' ? 'on' : ''}" onclick="STATS_TAB='learned'; renderStatsScreen()">📗 Изученные · ${nLearned}</button>
    </div>`;

  const groups = [{ id: 'base', title: 'Основа', icon: '🔤', topics: [BASE_TOPIC] }].concat(CONTENT.sections);
  let shown = 0;
  groups.forEach(sec => {
    const blocks = sec.topics.map(topic => {
      const ts = all.filter(s => s.topicId === topic.id);
      const w = ts.filter(s => s.status === 'weak'), f = ts.filter(s => s.status === 'fixing'), l = ts.filter(s => s.status === 'learned');
      if (STATS_TAB === 'errors' ? !(w.length + f.length) : !l.length) return '';
      shown++;
      const cards = topic.id === 'base' ? [] : topicCards(topic);
      const row = s => {
        const badges = cards.length ? termNumberBadges(topic, cards, s.termId) : '';
        const note = s.status === 'learned' ? ''
          : s.status === 'fixing'
            ? `<div class="st-err st-err-fix">верно ${s.streak} подряд — ещё ${s.toLearn} и термин изучен · ошибка была в: ${MODE_NAMES[s.lastErrMode] || 'режим не записан'}</div>`
            : `<div class="st-err">ошибка в: ${MODE_NAMES[s.lastErrMode] || 'режим не записан'} · ${timeAgo(s.lastErrAt)}</div>`;
        return `<div class="st-row st-${s.status}">
            <div class="tl-nums">${badges}</div>
            <div class="st-main"><div class="stats-lat">${s.term.lat} ${favTermStar(s.topicId, s.termId)}</div><div class="stats-ru">${s.term.ru}</div>${note}</div>
            <div class="stats-side"><div class="stats-pct ${s.pct >= 80 ? 'stat-good' : s.pct >= 50 ? 'stat-mid' : 'stat-bad'}">${s.pct}%</div>
              <div class="stats-seen">${s.winRight} из ${s.win}</div></div>
          </div>`;
      };
      let body = '', pills = '';
      if (STATS_TAB === 'errors') {
        const worst = arr => arr.sort((a, b) => a.pct - b.pct || a.streak - b.streak);
        if (w.length) body += `<div class="st-sub st-sub-weak">⚠️ Проблемные — ошибка за последние 4 попытки (${w.length})</div>` + worst(w).map(row).join('');
        if (f.length) body += `<div class="st-sub st-sub-fixing">🔄 Исправляются — последние ответы верные, ошибка ещё в окне (${f.length})</div>` + f.sort((a, b) => b.streak - a.streak).map(row).join('');
        if (w.length) body += `<button class="btn btn-primary btn-block st-train" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'game', mode: 'weakspots', topics: [topic.id] }))})'>🎯 Потренировать ошибки: ${topic.title}</button>`;
        pills = (w.length ? `<span class="st-pill st-pill-weak">⚠️ ${w.length}</span>` : '') + (f.length ? `<span class="st-pill st-pill-fixing">🔄 ${f.length}</span>` : '');
      } else {
        body += l.sort((a, b) => b.win - a.win || a.term.lat.localeCompare(b.term.lat)).map(row).join('');
        const unseen = topic.terms.length - ts.length;
        if (unseen > 0) body += `<div class="st-unseen">Ещё не встречались: ${unseen} из ${topic.terms.length}</div>`;
        pills = `<span class="st-pill st-pill-fixed">📗 ${l.length} из ${topic.terms.length}</span>`;
      }
      const tWin = ts.reduce((a, s) => a + s.win, 0), tRight = ts.reduce((a, s) => a + s.winRight, 0);
      const bar = STATS_TAB === 'errors' ? (tWin ? Math.round(tRight / tWin * 100) : 0) : Math.round(l.length / topic.terms.length * 100);
      const key = STATS_TAB + ':' + topic.id;
      return `<details class="st-topic" ${STATS_OPEN.has(key) ? 'open' : ''} ontoggle="this.open ? STATS_OPEN.add('${key}') : STATS_OPEN.delete('${key}')">
          <summary><div class="st-t-title">${topic.title}</div>
            <div class="st-t-meta">${pills}<span class="st-pill">${STATS_TAB === 'errors' ? bar + '% верных' : 'изучено ' + bar + '%'}</span></div>
            <div class="st-bar"><div style="width:${bar}%"></div></div></summary>
          <div class="st-body">${body}</div>
        </details>`;
    }).join('');
    if (blocks) html += `<div class="st-sec-title">${sec.icon || ''} ${sec.title}</div>` + blocks;
  });
  if (!shown) html += STATS_TAB === 'errors'
    ? `<div class="coming-soon">Ошибок в последних попытках нет ни в одной теме 🎉</div>`
    : `<div class="coming-soon">Пока нет изученных терминов — термин считается изученным, когда все его последние ответы (до ${STATS_WINDOW}) верные.</div>`;
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}

/* ===================== ЭКРАН: ЭКСПОРТ / ИМПОРТ ПРОГРЕССА ===================== */
function renderDataScreen() {
  const name = getActiveProfile() || '';
  let html = renderTopbar();
  html += backRow('Профиль', { screen: 'profile' });
  html += `<div class="profile-screen">`;
  html += `<h1 class="serif profile-heading">Экспорт / импорт</h1>`;
  html += `<p class="profile-sub">Скопируй код ниже, чтобы сохранить прогресс профиля «${escapeHtml(name)}» — например, перед сменой браузера или устройства.</p>`;

  let code = '';
  try { code = btoa(unescape(encodeURIComponent(JSON.stringify(PROGRESS)))); } catch (e) { code = ''; }
  html += `<textarea id="exportCode" class="data-textarea" readonly onclick="this.select()">${code}</textarea>`;
  html += `<button class="btn btn-primary btn-block" onclick="copyExportCode()">Скопировать код</button>`;
  html += `<div class="data-feedback" id="dataFeedback"></div>`;

  html += `<div class="data-divider"></div>`;
  html += `<p class="profile-sub">Вставь код сюда, чтобы восстановить прогресс (заменит текущий прогресс профиля «${escapeHtml(name)}»):</p>`;
  if (IMPORT_DONE) {
    html += `<div class="data-ok">${IMPORT_DONE}</div>
      <button class="btn btn-primary btn-block" onclick="IMPORT_DONE=null; goTo({screen:'map'})">На карту →</button>`;
  } else if (PENDING_IMPORT) {
    html += `<div class="data-confirm">
        <div><b>В коде:</b> ${PENDING_IMPORT.summary}.</div>
        <div style="margin-top:6px"><b>Сейчас у «${escapeHtml(name)}»:</b> ${progressSummary(PROGRESS)}.</div>
        <div style="margin-top:8px">Заменить текущий прогресс данными из кода? Отменить будет нельзя.</div>
        <div class="data-confirm-btns">
          <button class="btn btn-primary" onclick="confirmImport()">Да, заменить</button>
          <button class="btn btn-ghost" onclick="cancelImport()">Отмена</button>
        </div>
      </div>`;
  } else {
    html += `<textarea id="importCode" class="data-textarea" placeholder="Вставь код здесь"></textarea>`;
    html += `<button class="btn btn-ghost btn-block" onclick="importProgressCode()">Импортировать</button>`;
    html += `<div class="data-feedback" id="importFeedback"></div>`;
  }
  html += `</div>`;

  document.getElementById('app').innerHTML = html;
}

function copyExportCode() {
  const ta = document.getElementById('exportCode');
  const fb = document.getElementById('dataFeedback');
  ta.focus();
  ta.select();
  let legacyOk = false;
  try { legacyOk = document.execCommand('copy'); } catch (e) {}
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(() => {
      fb.textContent = 'Скопировано!';
    }).catch(() => {
      fb.textContent = legacyOk ? 'Скопировано!' : 'Не получилось скопировать автоматически — выдели текст и нажми Ctrl+C (Cmd+C)';
    });
  } else {
    fb.textContent = legacyOk ? 'Скопировано!' : 'Выдели текст вручную и скопируй (Ctrl+C)';
  }
}

let PENDING_IMPORT = null;   /* {data, summary} — ждёт подтверждения */
let IMPORT_DONE = null;      /* текст об успешном импорте */

function progressSummary(p) {
  const bones = Object.values(p.topics || {}).filter(tp =>
    tp && Object.values(tp).some(m => m && m.stars > 0)).length;
  const terms = Object.keys(p.termStats || {}).length;
  return `уровень ${levelFromXp(p.xp || 0)}, ${p.xp || 0} XP, костей со звёздами: ${bones}, терминов в статистике: ${terms}`;
}

function importProgressCode() {
  const ta = document.getElementById('importCode');
  const fb = document.getElementById('importFeedback');
  /* из мессенджеров код часто приходит с переносами строк и пробелами — убираем их */
  const raw = (ta.value || '').replace(/\s+/g, '');
  if (!raw) { if (fb) fb.textContent = 'Сначала вставь код в поле'; return; }
  let parsed;
  try {
    parsed = JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch (e) {
    if (fb) fb.textContent = 'Код повреждён или скопирован не полностью — проверь и попробуй снова';
    return;
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.xp !== 'number') {
    if (fb) fb.textContent = 'Это не похоже на код прогресса АнатЭкзама';
    return;
  }
  PENDING_IMPORT = { data: parsed, summary: progressSummary(parsed) };
  IMPORT_DONE = null;
  renderDataScreen();
}

function confirmImport() {
  if (!PENDING_IMPORT) return;
  PROGRESS = Object.assign(defaultProgress(), PENDING_IMPORT.data);
  migrateTermAliases();
  saveProgress();
  IMPORT_DONE = 'Готово! Прогресс восстановлен: ' + progressSummary(PROGRESS) + '.';
  PENDING_IMPORT = null;
  renderDataScreen();
}
function cancelImport() { PENDING_IMPORT = null; renderDataScreen(); }

/* ===================== ГЛАВНЫЙ РЕНДЕР ===================== */
function render() {
  document.body.dataset.screen = VIEW.screen || 'map';
  if (VIEW.screen === 'profile') return renderProfileScreen();
  if (VIEW.screen === 'data') return renderDataScreen();
  if (VIEW.screen === 'stats') return renderStatsScreen();
  if (VIEW.screen === 'map') return renderMap();
  if (VIEW.screen === 'eventPrep') return renderEventPrep(VIEW.eventId);
  if (VIEW.screen === 'eventArchive') return renderEventArchive();
  if (VIEW.screen === 'hub') return renderHub(VIEW.topicId);
  if (VIEW.screen === 'glossary') return renderGlossary(VIEW.topicId);
  if (VIEW.screen === 'cardmap') return renderCardMap(VIEW.topicId, VIEW.src, VIEW.sel === undefined ? null : VIEW.sel);
  if (VIEW.screen === 'guide') return renderGuide(VIEW.mode, VIEW.topicId);
  if (VIEW.screen === 'base') return renderBaseMenu();
  if (VIEW.screen === 'group') return renderGroup(VIEW.groupId);
  if (VIEW.screen === 'recallSetup') return renderRecallSetup();
  if (VIEW.screen === 'recall') return renderRecall();
  if (VIEW.screen === 'ageSetup') return renderAgeSetup();
  if (VIEW.screen === 'stestSetup') return renderSTestSetup();
  if (VIEW.screen === 'otestSetup') return renderOTestSetup();
  if (VIEW.screen === 'tstat') return renderTStat();
  if (VIEW.screen === 'otest') return renderOTest();
  if (VIEW.screen === 'axesSetup') return renderAxesSetup();
  if (VIEW.screen === 'axes') return renderAxes();
  if (VIEW.screen === 'stest') return renderSTest();
  if (VIEW.screen === 'stestCards') return renderSTestCards();
  if (VIEW.screen === 'scenario') return renderScenario(VIEW.topicId);
  if (VIEW.screen === 'age') return renderAge();
  if (VIEW.screen === 'favorites') return renderFavorites();
  if (VIEW.screen === 'examSetup') return renderExamSetup();
  if (VIEW.screen === 'baseList') return renderBaseList();
  if (VIEW.screen === 'difficulty') return renderDifficulty(VIEW.mode, VIEW.topicId);
  if (VIEW.screen === 'maSetup') { MA_TOPIC = VIEW.topicId || MA_TOPIC; return renderMaSetup(); }
  if (VIEW.screen === 'ma') return renderMa();
  if (VIEW.screen === 'game') return renderGame(VIEW.mode, VIEW.topicId);
}

function renderGame(mode, topicId) {
  if (mode === 'picture') return PictureGame.render(topicId);
  if (mode === 'legend') return LegendGame.render(topicId);
  if (mode === 'base') return BaseGame.render();
  if (mode === 'truefalse') return TrueFalseGame.render(topicId);
  if (mode === 'builder') return BuilderGame.render(topicId);
  if (mode === 'speed') return SpeedGame.render(topicId);
  if (mode === 'exam') return ExamGame.render(topicId);
  if (mode === 'weakspots') return WeakSpotsGame.render(topicId);
}

function gameTopbar(title, progressPct, livesHtml) {
  return `
    <div class="game-topbar">
      <button class="exit-x" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'hub', topicId: VIEW.topicId}))})'>✕</button>
      <div class="game-progress-bar"><div class="game-progress-fill" style="width:${progressPct}%"></div></div>
      ${livesHtml || ''}
    </div>`;
}


function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN(arr, n) { return shuffleArr(arr).slice(0, Math.min(n, arr.length)); }

/* первичная отрисовка — в app_init.js, после подключения всех модулей */

/* ===================== ОБЩИЙ ГЕНЕРАТОР МУЛЬТИВЫБОРНЫХ ВОПРОСОВ ===================== */
/* Варианты показываются только по-русски (латынь выдала бы ответ).
   Перевод частицы тоже скрыт до ответа — иначе он совпадает с русским словом в вариантах.
   Термины с другой грамматической формой той же частицы (superior / superioris, petrosi / petrosa)
   в вопрос не попадают вообще — ни как верные, ни как неверные, чтобы не было спорных ответов. */
function _latTokens(lat) { return lat.toLowerCase().replace(/[.,()]/g, ' ').split(/\s+/).filter(Boolean); }
function _commonPrefix(a, b) { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; }
function _termHasWord(term, word) {
  return _latTokens(term.lat).includes(word) || (term.parts || []).some(p => p[0].toLowerCase() === word);
}
function _termHasRelatedForm(term, word) {
  const need = Math.min(5, word.length - 1);
  const words = _latTokens(term.lat).concat((term.parts || []).map(p => p[0].toLowerCase()));
  const root = word.slice(0, Math.max(4, word.length - 3));   /* mastoideum → mastoid: ловит tympanomastoidea */
  return words.some(w => w !== word && (_commonPrefix(w, word) >= need || w.includes(root)));
}
function buildMultiCandidates(topic, totalOptions) {
  const map = {};
  topic.terms.forEach(t => (t.parts || []).forEach(p => {
    const key = p[0].toLowerCase();
    if (key.length < 4 || /[\s.]/.test(key)) return;       /* только однословные частицы */
    if (!map[key]) map[key] = p[1];
  }));
  const out = [];
  Object.entries(map).forEach(([word, ru]) => {
    const containing = topic.terms.filter(t => _termHasWord(t, word));
    const notContaining = topic.terms.filter(t => !_termHasWord(t, word) && !_termHasRelatedForm(t, word));
    /* нужно минимум 2 верных и достаточно неверных, чтобы добить до totalOptions */
    if (containing.length >= 2 && notContaining.length >= totalOptions - 2) out.push({ word, ru, containing, notContaining });
  });
  return out;
}
/* weights: вероятности для 1, 2, 3 верных ответов */
function buildMultiQuestion(topic, totalOptions, weights) {
  const cands = buildMultiCandidates(topic, totalOptions);
  if (!cands.length) return null;
  /* сначала выбираем, сколько будет верных, потом — частицу, у которой столько терминов есть */
  const w = weights.slice(0, totalOptions - 2), sum = w.reduce((a, b) => a + b, 0);
  let r = Math.random(), k = w.length, acc = 0;
  for (let i = 0; i < w.length; i++) { acc += w[i] / sum; if (r < acc) { k = i + 1; break; } }
  let fit = [];
  while (k >= 1 && !(fit = cands.filter(c => c.containing.length >= k && c.notContaining.length >= totalOptions - k)).length) k--;
  const c = fit[Math.floor(Math.random() * fit.length)];
  const correctPicked = pickN(c.containing, k);
  const usedRu = new Set(correctPicked.map(t => t.ru.toLowerCase()));
  const wrongPicked = shuffleArr(c.notContaining).filter(t => {
    const key = t.ru.toLowerCase(); if (usedRu.has(key)) return false; usedRu.add(key); return true;
  }).slice(0, totalOptions - k);
  const mk = (t, correct) => ({ text: t.ru, correct, termId: t.id, lat: t.lat, ru: t.ru });
  const options = shuffleArr(correctPicked.map(t => mk(t, true)).concat(wrongPicked.map(t => mk(t, false))));
  return { type: 'multi', partLat: c.word, partRu: c.ru, options };
}
/* HTML мультивыборного вопроса (общий для квиза и экзамена) */
function multiPromptHtml(q) {
  return `<div class="speed-prompt">
      <div class="sp-main">Какие термины по-латыни содержат «${q.partLat}»?</div>
      <div class="sp-sub" id="multiSub">отметь все подходящие — верных может быть несколько</div>
    </div>`;
}
/* после ответа: показать латынь у каждого варианта и перевод частицы */
function revealMultiDetails(q) {
  const sub = document.getElementById('multiSub');
  if (sub) sub.textContent = `${q.partLat} — ${q.partRu}`;
  document.querySelectorAll('.speed-opt').forEach((btn, i) => {
    const o = q.options[i];
    if (o && o.lat && !btn.querySelector('.opt-lat')) btn.insertAdjacentHTML('beforeend', ` <span class="opt-lat">· ${o.lat}</span>`);
  });
}

/* ===================== РЕЖИМ: НАЙДИ НА КАРТИНКЕ ===================== */
const PictureGame = (function () {
  const ROUNDS_TOTAL = 10;
  const HARD_TIME = 10;      /* «Врач»: секунд на вопрос */
  const HARD_LIVES = 3;
  let state = null;

  function termById(topic, id) { return topic.terms.find(t => t.id === id); }

  function buildRounds(topic) {
    const seen = new Set();
    const pool = [];
    topic.images.forEach(img => {
      img.hotspots.forEach(h => {
        if (!seen.has(h.term)) {
          seen.add(h.term);
          pool.push({ imageId: img.id, hotspot: h });
        }
      });
    });
    return pickN(pool, ROUNDS_TOTAL);
  }

  /* easy — русский + латынь; medium — только латынь, перевод после ответа;
     hard — только латынь + таймер 10 с + 3 жизни */
  function start(topicId, difficulty) {
    const topic = findTopic(topicId);
    const diff = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'easy';
    state = {
      topicId, difficulty: diff,
      rounds: buildRounds(topic),
      idx: 0, asked: 0,
      correct: 0,
      lives: HARD_LIVES,
      locked: false,
      mistakes: [],
    };
  }

  function reset(topicId, difficulty) { start(topicId, difficulty); }

  function currentImage(topic) {
    const round = state.rounds[state.idx];
    return topic.images.find(im => im.id === round.imageId);
  }

  function render(topicId) {
    if (!state) start(topicId);
    const topic = findTopic(topicId);

    const outOfLives = state.difficulty === 'hard' && state.lives <= 0;
    if (state.idx >= state.rounds.length || outOfLives) {
      clearActiveTimer();
      /* процент — от заданных вопросов (на «Враче» раунд может закончиться раньше) */
      const asked = Math.max(1, state.asked);
      const pct = Math.round((state.correct / asked) * 100);
      const xp = state.correct * ({ easy: 6, medium: 8, hard: 10 }[state.difficulty]);
      const mistakes = state.mistakes, correct = state.correct;
      state = null;
      finishRound(topicId, 'picture', 0, pct,
        Math.max(xp, 4), 'Найди на картинке',
        `${outOfLives ? 'Жизни закончились. ' : ''}Правильно: ${correct} из ${asked} (${pct}%)`, mistakes);
      return;
    }

    const round = state.rounds[state.idx];
    const img = currentImage(topic);
    const term = termById(topic, round.hotspot.term);
    const progressPct = Math.round((state.idx / state.rounds.length) * 100);

    const hard = state.difficulty === 'hard';
    const livesHtml = hard ? `<div class="lives-row">${'❤️'.repeat(state.lives)}${'🖤'.repeat(HARD_LIVES - state.lives)}</div>` : '';
    let html = gameTopbar('Найди на картинке', progressPct, livesHtml);
    html += `<div class="game-body">`;
    if (hard) html += `<div class="speed-timerbar"><div class="speed-timerfill" id="picTimerFill" style="width:100%"></div></div>`;
    if (state.difficulty === 'easy') {
      html += `<div class="pic-prompt">
          <div class="prompt-ru">Найди: ${term.ru}</div>
          <div class="prompt-lat">${term.lat}</div>
        </div>`;
    } else {
      /* на средней и «Враче» — только латынь; перевод откроется после ответа */
      html += `<div class="pic-prompt">
          <div class="prompt-ru">Найди: ${term.lat}</div>
          <div class="prompt-lat" id="picReveal">[${term.translit}]</div>
        </div>`;
    }
    html += favBar(topicId, term.id, 'picture', 'Найди: ' + term.ru, true);

    html += `<div class="pic-wrap" id="picWrap">
        <img src="${IMAGES[img.src]}" id="picImg" draggable="false">
      </div>`;
    html += `<div class="pic-feedback" id="picFeedback"></div>`;
    html += `<div style="text-align:center; margin-top:14px;">
        <button class="btn btn-primary" id="picNextBtn" style="display:none" onclick="PictureGame.next()">Далее →</button>
      </div>`;
    html += `</div>`;

    document.getElementById('app').innerHTML = html;

    document.getElementById('picWrap').addEventListener('click', onImageClick);
    if (hard) startTimer();
  }

  function startTimer() {
    clearActiveTimer();
    const deadline = performance.now() + HARD_TIME * 1000;   /* по часам, как в других режимах */
    ACTIVE_TIMER = setInterval(() => {
      if (!state || state.locked) { clearActiveTimer(); return; }
      const left = (deadline - performance.now()) / 1000;
      const fill = document.getElementById('picTimerFill');
      if (fill) { fill.style.width = Math.max(0, left / HARD_TIME * 100) + '%'; fill.classList.toggle('danger', left < 3); }
      if (left <= 0) { clearActiveTimer(); resolve(false, null, null); }
    }, 100);
  }

  function onImageClick(e) {
    if (!state) return;
    if (state.locked) { next(); return; }   /* после ответа нажатие на карточку — к следующему вопросу */
    const topic = findTopic(state.topicId);
    const round = state.rounds[state.idx];
    const wrap = document.getElementById('picWrap');
    const rect = wrap.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const h = round.hotspot;
    /* у термина может быть несколько цифр на одной картинке — засчитываем любую */
    const img = currentImage(topic);
    /* на некоторых карточках два рисунка (теменная: снаружи и изнутри, решётчатая: спереди и справа),
       и один номер стоит на обоих — это одна структура по легенде. Берём цифры со всей карточки. */
    const cardHotspots = topic.images.filter(x => x.src === img.src).flatMap(x => x.hotspots);
    const same = cardHotspots.filter(x => x.term === h.term);
    /* верно, если клик внутри кружка нужной цифры И ближе всего именно к ней —
       так соседняя цифра (например, 8 рядом с 9) не засчитывается */
    const nearest = cardHotspots.reduce((best, x) => {
      const dd = Math.hypot(clickX - x.x, clickY - x.y);
      return (!best || dd < best.d) ? { x, d: dd } : best;
    }, null);
    const isCorrect = !!nearest && nearest.x.term === h.term && nearest.d <= nearest.x.r;
    resolve(isCorrect, clickX, clickY);
  }

  /* общий итог вопроса: клик или истёкшее время (x = null) */
  function resolve(isCorrect, clickX, clickY) {
    if (!state || state.locked) return;
    clearActiveTimer();
    const topic = findTopic(state.topicId);
    const round = state.rounds[state.idx];
    const h = round.hotspot;
    const img = currentImage(topic);
    const same = topic.images.filter(x => x.src === img.src).flatMap(x => x.hotspots).filter(x => x.term === h.term);
    const term = termById(topic, h.term);
    const wrap = document.getElementById('picWrap');

    state.locked = true;
    state.asked++;
    if (isCorrect) state.correct++;
    else {
      state.mistakes.push(clickX === null ? { lat: term.lat, ru: term.ru, shown: 'время вышло', tid: state.topicId, id: term.id } : { lat: term.lat, ru: term.ru, tid: state.topicId, id: term.id });
      if (state.difficulty === 'hard') state.lives--;
    }
    recordTermResult(state.topicId, h.term, isCorrect);

    if (clickX !== null) addMarker(wrap, clickX, clickY, isCorrect ? 'marker-correct' : 'marker-wrong', isCorrect ? '✓' : '✕');
    if (!isCorrect) same.forEach(x => addMarker(wrap, x.x, x.y, 'marker-reveal', '★'));

    const reveal = document.getElementById('picReveal');
    if (reveal) reveal.textContent = `${term.ru} · [${term.translit}]`;
    const lives = document.querySelector('.lives-row');
    if (lives && state.difficulty === 'hard') lives.innerHTML = '❤️'.repeat(Math.max(0, state.lives)) + '🖤'.repeat(HARD_LIVES - Math.max(0, state.lives));

    const fb = document.getElementById('picFeedback');
    fb.textContent = isCorrect ? 'Верно!' : clickX === null ? '⏱ Время вышло — вот где это' : 'Не совсем — вот где это на самом деле';
    fb.className = 'pic-feedback ' + (isCorrect ? 'ok' : 'no');
    fb.insertAdjacentHTML('beforeend', '<div class="tap-next-hint">👆 нажми на карточку, чтобы продолжить</div>');
    if (wrap) wrap.classList.add('tap-next');

    const nb = document.getElementById('picNextBtn');
    const last = state.idx + 1 >= state.rounds.length || (state.difficulty === 'hard' && state.lives <= 0);
    nb.textContent = last ? 'Итоги →' : 'Далее →';
    nb.style.display = 'inline-flex';
  }

  function addMarker(wrap, xPct, yPct, cls, label) {
    const m = document.createElement('div');
    m.className = 'pic-marker ' + cls;
    m.style.left = xPct + '%';
    m.style.top = yPct + '%';
    m.textContent = label;
    wrap.appendChild(m);
  }

  function next() {
    if (!state) return;
    state.idx++;
    state.locked = false;
    render(state.topicId);
    window.scrollTo(0, 0);   /* следующий вопрос сразу виден */
  }

  return { render, next, reset };
})();

/* ===================== РЕЖИМ: СОСТАВЬ ЛЕГЕНДУ ===================== */
/* Дана карточка Сапина и номера — нужно расставить названия по порядку.
   difficulty: 'train' — 5 заданий по 4–5 номеров подряд;
               'exam'  — все цифры одной карточки (view.imageId). */
const LegendGame = (function () {
  const TRAIN_TASKS = 5;
  let state = null;

  const numVal = n => parseFloat(n);
  function termById(topic, id) { return topic.terms.find(t => t.id === id); }

  /* уникальные номера картинки (у одной структуры бывает две стрелки с одним номером) */
  function labelsOf(img) {
    const seen = new Set(), out = [];
    img.hotspots.slice().sort((a, b) => numVal(a.n) - numVal(b.n)).forEach(h => {
      if (seen.has(h.n)) return; seen.add(h.n); out.push({ n: h.n, term: h.term });
    });
    return out;
  }

  function pickExtras(topic, img, items, count) {
    const used = new Set(items.map(i => i.term));
    const usedRu = new Set(items.map(i => termById(topic, i.term).ru.toLowerCase()));
    const ok = t => !used.has(t.id) && !usedRu.has(t.ru.toLowerCase());
    const onImage = new Set(img.hotspots.map(h => h.term));
    /* сначала — термины с этой же карточки (сложнее отличить), потом остальные термины кости */
    const same = shuffleArr(topic.terms.filter(t => ok(t) && onImage.has(t.id)));
    const other = shuffleArr(topic.terms.filter(t => ok(t) && !onImage.has(t.id)));
    const pool = same.concat(other), res = [];
    for (const t of pool) {
      if (res.length >= count) break;
      if (res.some(r => r.ru.toLowerCase() === t.ru.toLowerCase())) continue;
      res.push(t);
    }
    return res.map(t => t.id);
  }

  function makeTrainTask(topic) {
    const imgs = topic.images.filter(im => labelsOf(im).length >= 4);
    const img = imgs[Math.floor(Math.random() * imgs.length)];
    const labels = labelsOf(img);
    const k = Math.min(labels.length, 4 + Math.floor(Math.random() * 2));
    const start = Math.floor(Math.random() * (labels.length - k + 1));
    const items = labels.slice(start, start + k);
    return { img, items, extras: pickExtras(topic, img, items, 1 + Math.floor(Math.random() * 2)) };
  }

  function makeExamTask(topic, imageId) {
    const img = topic.images.find(im => im.id === imageId) || topic.images[0];
    const items = labelsOf(img);
    return { img, items, extras: pickExtras(topic, img, items, 2) };
  }

  function start(topicId, difficulty, view) {
    const topic = findTopic(topicId);
    const diff = difficulty === 'exam' ? 'exam' : 'train';
    const tasks = diff === 'exam'
      ? [makeExamTask(topic, view && view.imageId)]
      : Array.from({ length: TRAIN_TASKS }, () => makeTrainTask(topic));
    state = { topicId, difficulty: diff, tasks, idx: 0, correctTotal: 0, slotsTotal: 0, mistakes: [] };
    setupTask();
  }
  function reset(topicId, difficulty, view) { start(topicId, difficulty, view); }

  function setupTask() {
    const task = state.tasks[state.idx];
    const chips = task.items.map((it, i) => ({ uid: 'c' + i, term: it.term }))
      .concat(task.extras.map((id, i) => ({ uid: 'x' + i, term: id })));
    state.pool = shuffleArr(chips);
    state.slots = task.items.map(() => null);   /* uid фишки в каждой строке */
    state.active = 0;
    state.checked = false;
  }

  function nextEmpty(from) {
    const n = state.slots.length;
    for (let k = 0; k < n; k++) { const i = (from + k) % n; if (!state.slots[i]) return i; }
    return -1;
  }

  function promptText(task) {
    const ns = task.items.map(i => i.n);
    if (state.difficulty === 'exam') return `Подпиши все цифры карточки (${ns.length})`;
    const ints = ns.every(n => /^\d+$/.test(n));
    const consecutive = ints && ns.every((n, i) => i === 0 || +n === +ns[i - 1] + 1);
    return consecutive ? `Подпиши структуры с ${ns[0]} по ${ns[ns.length - 1]}` : `Подпиши структуры № ${ns.join(', ')}`;
  }

  function render(topicId) {
    if (!state) start(topicId, 'train');
    const topic = findTopic(state.topicId);

    if (state.idx >= state.tasks.length) {
      const pct = Math.round((state.correctTotal / Math.max(1, state.slotsTotal)) * 100);
      const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
      const exam = state.difficulty === 'exam';
      const xp = state.correctTotal * (exam ? 4 : 3) + (pct === 100 ? (exam ? 20 : 10) : 0);
      const title = exam ? 'Легенда — экзамен' : 'Составь легенду';
      const s = state; state = null;
      finishRound(topicId, 'legend', stars, pct, xp, title,
        `Верно подписано: ${s.correctTotal} из ${s.slotsTotal} (${pct}%)`, s.mistakes);
      return;
    }

    const task = state.tasks[state.idx];
    const progressPct = Math.round((state.idx / state.tasks.length) * 100);
    let html = gameTopbar('Составь легенду', progressPct);
    html += `<div class="game-body lg-layout">`;

    /* карточка: показываем только область с цифрами (без заголовка и полей карточки), чтобы цифры были крупнее */
    const box = cropBox(task.img);
    const ar = (box.w * (task.img.w || 900)) / (box.h * (task.img.h || 1286));
    html += `<div class="lg-stick"><div class="lg-pic" style="--ar:${ar.toFixed(4)}" onclick="${state.checked ? 'LegendGame.next()' : `openImageZoom('${task.img.src}')`}" title="${state.checked ? 'Нажми, чтобы продолжить' : 'Нажми, чтобы увеличить'}">
        <img src="${IMAGES[task.img.src]}" draggable="false" alt="${task.img.label}"
             style="width:${(10000 / box.w).toFixed(2)}%;left:${(-box.x / box.w * 100).toFixed(2)}%;top:${(-box.y / box.h * 100).toFixed(2)}%">`;
    task.items.forEach((it, i) => {
      let cls = '';
      if (state.checked) cls = slotCorrect(i) ? 'lg-ring-ok' : 'lg-ring-bad';
      else if (state.difficulty === 'train') cls = 'lg-ring';
      if (!cls) return;
      task.img.hotspots.filter(h => h.n === it.n).forEach(h => {
        html += `<span class="lg-ring-base ${cls}" style="left:${((h.x - box.x) / box.w * 100).toFixed(2)}%;top:${((h.y - box.y) / box.h * 100).toFixed(2)}%"></span>`;
      });
    });
    html += `</div><div class="lg-pic-hint">${task.img.label} · ${state.checked ? '<b>👆 нажми на карточку — следующее задание</b>' : 'нажми на карточку, чтобы увеличить'}</div></div>`;

    html += `<div class="lg-side">
      <div class="lg-prompt">${promptText(task)}</div>
      <div class="lg-sub">${state.difficulty === 'exam' ? 'Нажимай термины — каждый встаёт в выделенную строку' : 'Нажимай термины по порядку номеров'}. Среди терминов есть лишние.</div>
      <div class="lg-slots">`;
    task.items.forEach((it, i) => {
      const chip = state.slots[i] && state.pool.find(c => c.uid === state.slots[i]);
      const t = chip && termById(topic, chip.term);
      let cls = 'lg-slot';
      if (!state.checked && i === state.active) cls += ' lg-active';
      if (state.checked) cls += slotCorrect(i) ? ' lg-ok' : ' lg-bad';
      html += `<div class="${cls}" onclick="LegendGame.slotClick(${i})">
          <span class="lg-num">${it.n}</span>
          <span class="lg-val">${t ? `<b>${t.lat}</b><span class="lg-ru">${t.ru}</span>` : '<span class="lg-empty">—</span>'}`;
      if (state.checked && !slotCorrect(i)) {
        const right = termById(topic, it.term);
        html += `<span class="lg-right">✓ ${right.lat} — ${right.ru}</span>`;
      }
      html += `</span>${state.checked ? favTermStar(state.topicId, it.term) : ''}</div>`;
    });
    html += `</div>`;

    if (!state.checked) {
      const usedUids = new Set(state.slots.filter(Boolean));
      html += `<div class="pool-row lg-pool">`;
      state.pool.forEach(c => {
        if (usedUids.has(c.uid)) return;
        const t = termById(topic, c.term);
        html += `<button class="chip chip-pool lg-chip" onclick="LegendGame.pick('${c.uid}')">${t.lat}<span class="chip-part-meaning">${t.ru}</span></button>`;
      });
      html += `</div>`;
      const full = state.slots.every(Boolean);
      html += `<div class="builder-actions">
          <button class="btn btn-ghost" onclick="LegendGame.clearAll()">Очистить</button>
          <button class="btn btn-primary" style="flex:1" onclick="LegendGame.check()" ${full ? '' : 'disabled'}>Проверить</button>
        </div>`;
    } else {
      const ok = task.items.filter((_, i) => slotCorrect(i)).length;
      const last = state.idx + 1 >= state.tasks.length;
      html += `<div class="pic-feedback ${ok === task.items.length ? 'ok' : ''}">${ok === task.items.length ? 'Всё верно! 👏' : `Верно ${ok} из ${task.items.length}`}</div>
        <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="LegendGame.next()">${last ? 'Итоги →' : 'Далее →'}</button>`;
    }
    html += `</div></div>`;
    document.getElementById('app').innerHTML = html;
  }

  /* рамка вокруг всех цифр карточки с запасом (в % от картинки) */
  function cropBox(img) {
    const pre = CONTENT.crops && CONTENT.crops[img.src];
    if (pre) return pre;
    const xs = img.hotspots.map(h => h.x), ys = img.hotspots.map(h => h.y);
    const padX = 7, padY = 5;
    let x0 = Math.max(0, Math.min(...xs) - padX), x1 = Math.min(100, Math.max(...xs) + padX);
    let y0 = Math.max(0, Math.min(...ys) - padY), y1 = Math.min(100, Math.max(...ys) + padY);
    /* сам рисунок бывает шире облака цифр — не режем слишком узко */
    if (x1 - x0 < 60) { const c = (x0 + x1) / 2; x0 = Math.max(0, c - 30); x1 = Math.min(100, c + 30); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function slotCorrect(i) {
    const task = state.tasks[state.idx];
    const chip = state.pool.find(c => c.uid === state.slots[i]);
    return !!chip && chip.term === task.items[i].term;
  }

  function pick(uid) {
    if (!state || state.checked) return;
    let i = state.active;
    if (i < 0 || state.slots[i]) i = nextEmpty(Math.max(0, i));
    if (i < 0) return;
    state.slots[i] = uid;
    state.active = nextEmpty(i + 1);
    render(state.topicId);
  }

  function slotClick(i) {
    if (!state || state.checked) return;
    state.slots[i] = null;       /* заполненная строка очищается и становится активной */
    state.active = i;
    render(state.topicId);
  }

  function clearAll() {
    if (!state || state.checked) return;
    state.slots = state.slots.map(() => null); state.active = 0;
    render(state.topicId);
  }

  function check() {
    if (!state || state.checked || !state.slots.every(Boolean)) return;
    const topic = findTopic(state.topicId);
    const task = state.tasks[state.idx];
    state.checked = true;
    const perTerm = {};
    task.items.forEach((it, i) => {
      const ok = slotCorrect(i);
      state.slotsTotal++; if (ok) state.correctTotal++;
      perTerm[it.term] = (perTerm[it.term] !== false) && ok;
      if (!ok) {
        const right = termById(topic, it.term);
        const chosen = termById(topic, state.pool.find(c => c.uid === state.slots[i]).term);
        state.mistakes.push({ lat: `№ ${it.n} — ${right.lat}`, ru: right.ru, chose: chosen.lat, tid: state.topicId, id: it.term });
      }
    });
    Object.entries(perTerm).forEach(([id, ok]) => recordTermResult(state.topicId, id, ok));
    render(state.topicId);
  }

  function next() {
    if (!state) return;
    state.idx++;
    if (state.idx < state.tasks.length) setupTask();
    render(state.topicId);
    window.scrollTo(0, 0);
  }

  return { render, reset, pick, slotClick, clearAll, check, next, labelsOf };
})();

/* ===================== БАЗА ЛАТЫНИ: базовые слова (sulcus — борозда) ===================== */
/* Общий раздел для всего черепа: группы слов, два направления (лат→рус, рус→лат), словарик.
   Статистика пишется как 'base::<id>' — поэтому слова попадают в «Мою статистику» и «Слабые места». */
const BASE_GROUPS = (CONTENT.base && CONTENT.base.groups) || [];
const BASE_WORDS = [];
BASE_GROUPS.forEach(g => g.words.forEach(w => { w.group = g.id; BASE_WORDS.push(w); }));
const BASE_TOPIC = { id: 'base', title: 'База латыни', latin: '', terms: BASE_WORDS, images: [] };

let BASE_SELECTED = new Set(BASE_GROUPS.map(g => g.id));   /* выбранные группы на экране базы */

/* «конфликт значений»: fossa и fovea оба «ямка», foramen/porus/apertura — «отверстие».
   Такие слова не ставим вариантами друг к другу, иначе правильных ответов было бы два. */
function baseMeaningKeys(w) {
  return w.ru.toLowerCase().split(/[;(),]/).map(s => s.trim()).filter(Boolean);
}
function baseConflict(a, b) {
  if (a.lat === b.lat) return true;
  const ka = baseMeaningKeys(a), kb = baseMeaningKeys(b);
  return ka.some(k => kb.includes(k));
}

/* «знаю»: последний ответ по слову был верным */
function baseKnownCount(words) {
  const st = PROGRESS.termStats || {};
  return words.filter(w => {
    const rec = st['base::' + w.id];
    return rec && rec.history.length && rec.history[rec.history.length - 1].c;
  }).length;
}

/* ---------- экран «База латыни» ---------- */
function renderBaseMenu() {
  let html = renderTopbar();
  html += backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>База латыни</h1>
      <div class="hub-latin">${BASE_WORDS.length} базовых слов — из них собираются термины всего атласа</div>
      <button class="guide-link" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'guide', mode:'base'}))})'>📘 Как играть</button></div>`;

  html += `<div class="base-wrap"><div class="guide-section-title">Какие слова учим</div><div class="base-groups">`;
  const allOn = BASE_SELECTED.size === BASE_GROUPS.length;
  html += `<button class="base-chip ${allOn ? 'on' : ''}" onclick="baseToggleAll()">Все группы</button>`;
  BASE_GROUPS.forEach(g => {
    const on = BASE_SELECTED.has(g.id);
    html += `<button class="base-chip ${on ? 'on' : ''}" onclick="baseToggleGroup('${g.id}')">
        ${g.emoji} ${g.title} <span class="base-chip-n">${baseKnownCount(g.words)}/${g.words.length}</span></button>`;
  });
  html += `</div><div class="base-legend">Цифры — сколько слов группы ты сейчас знаешь (последний ответ верный)</div></div>`;

  const groups = [...BASE_SELECTED];
  const count = BASE_WORDS.filter(w => BASE_SELECTED.has(w.group)).length;
  html += `<div class="mode-grid">`;
  if (!groups.length) {
    html += `<div class="coming-soon">Выбери хотя бы одну группу слов</div>`;
  } else {
    const gp = st => ({ screen: 'game', mode: 'base', dir: st, groups });
    html += choiceCard('🏛️', 'Латынь → русский', `Показано латинское слово — выбери перевод · ${count} слов`, gp('lr'));
    html += choiceCard('🇷🇺', 'Русский → латынь', `Показан перевод — выбери латинское слово · ${count} слов`, gp('rl'));
  }
  html += choiceCard('📖', 'Словарик', 'Все базовые слова по группам: словарная форма, перевод, произношение', { screen: 'baseList' });
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}
function baseToggleGroup(id) {
  if (BASE_SELECTED.has(id)) BASE_SELECTED.delete(id); else BASE_SELECTED.add(id);
  renderBaseMenu();
}
function baseToggleAll() {
  BASE_SELECTED = BASE_SELECTED.size === BASE_GROUPS.length ? new Set() : new Set(BASE_GROUPS.map(g => g.id));
  renderBaseMenu();
}

/* ---------- словарик (с поиском) ---------- */
let BASE_LIST_Q = '';
/* поиск без учёта регистра, ударений и ё/е: «борозд», «sulc», «сулькус» — всё находит */
function baseNorm(s) { return String(s).toLowerCase().replace(/\u0301/g, '').replace(/ё/g, 'е'); }

/* совпадение по началу любого слова: «os» найдёт os frontale, но не processus;
   запрос из нескольких слов ищется целиком как фрагмент */
function baseMatches(w, nq) {
  const fields = [w.lat, w.ru, w.translit, w.dict].map(baseNorm);
  if (/\s/.test(nq)) return fields.some(f => f.includes(nq));
  return fields.some(f => f.split(/[\s,;()\[\]]+/).some(part => part.startsWith(nq)));
}

function renderBaseList() {
  let html = renderTopbar();
  html += backRow('База латыни', { screen: 'base' });
  html += `<div class="hub-header"><h1>Словарик</h1><div class="hub-latin">${BASE_WORDS.length} слов · словарная форма = как записывают на латыни (родительный падеж и род)</div></div>`;
  html += `<div class="base-wrap">
      <div class="base-search">
        <input type="search" id="baseSearch" placeholder="Поиск: латынь или перевод…" value="${escapeHtml(BASE_LIST_Q)}"
               oninput="baseListFilter(this.value)" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="base-search-clear" id="baseSearchClear" onclick="baseListClear()" title="Очистить" ${BASE_LIST_Q ? '' : 'hidden'}>✕</button>
      </div>
      <div class="base-search-count" id="baseSearchCount"></div>
      <div id="baseListBody"></div>
    </div>`;
  document.getElementById('app').innerHTML = html;
  baseListFilter(BASE_LIST_Q);
}

function baseListFilter(q) {
  BASE_LIST_Q = q || '';
  const nq = baseNorm(BASE_LIST_Q.trim());
  const body = document.getElementById('baseListBody');
  if (!body) return;
  const clearBtn = document.getElementById('baseSearchClear');
  if (clearBtn) clearBtn.hidden = !BASE_LIST_Q;
  let html = '', found = 0;
  BASE_GROUPS.forEach(g => {
    const words = nq ? g.words.filter(w => baseMatches(w, nq)) : g.words;
    if (!words.length) return;
    found += words.length;
    html += `<div class="guide-section-title">${g.emoji} ${g.title}</div><div class="base-list">`;
    words.forEach(w => {
      html += `<div class="base-row">
          <div class="base-row-lat"><b>${w.lat}</b> <span class="base-tr">[${w.translit}]</span> ${edTermBtn('base', w.id)}${favTermStar('base', w.id)}</div>
          <div class="base-row-dict">${w.dict}</div>
          <div class="base-row-ru">${w.ru}</div>
        </div>`;
    });
    html += `</div>`;
  });
  if (!found) html = `<div class="coming-soon">Ничего не нашлось по запросу «${escapeHtml(BASE_LIST_Q.trim())}». Попробуй начало слова — например, «sulc» или «борозд».</div>`;
  body.innerHTML = html;
  const cnt = document.getElementById('baseSearchCount');
  if (cnt) cnt.textContent = nq ? (found ? `Найдено: ${found}` : '') : '';
}

function baseListClear() {
  const inp = document.getElementById('baseSearch');
  if (inp) { inp.value = ''; inp.focus(); }
  baseListFilter('');
}

/* ---------- игра ---------- */
const BaseGame = (function () {
  const MAX_Q = 15;
  const OPTIONS = 4;
  let state = null;

  function pickWords(pool) {
    /* слова с ошибками и ещё не встречавшиеся попадают в раунд чаще */
    const st = PROGRESS.termStats || {};
    const scored = pool.map(w => {
      const rec = st['base::' + w.id];
      let bonus = 0.3;
      if (rec && rec.history.length) {
        const h = rec.history.slice(-5);
        bonus = (1 - h.reduce((s, x) => s + x.c, 0) / h.length) * 1.2;
      }
      return { w, s: Math.random() + bonus };
    });
    scored.sort((a, b) => b.s - a.s);
    return shuffleArr(scored.slice(0, Math.min(MAX_Q, pool.length)).map(x => x.w));
  }

  function makeOptions(word, pool) {
    const fits = w => !baseConflict(w, word);
    const sameGroup = shuffleArr(pool.filter(w => w.group === word.group && fits(w)));
    const selected = shuffleArr(pool.filter(w => w.group !== word.group && fits(w)));
    const any = shuffleArr(BASE_WORDS.filter(w => !pool.includes(w) && fits(w)));
    const out = [];
    for (const w of sameGroup.concat(selected, any)) {
      if (out.length >= OPTIONS - 1) break;
      if (out.some(o => baseConflict(o, w))) continue;
      out.push(w);
    }
    return shuffleArr(out.concat([word]));
  }

  function start(_topicId, _diff, view) {
    const groups = (view && view.groups && view.groups.length) ? view.groups : BASE_GROUPS.map(g => g.id);
    const pool = BASE_WORDS.filter(w => groups.includes(w.group));
    const words = pickWords(pool);
    state = {
      dir: (view && view.dir) === 'rl' ? 'rl' : 'lr', pool, words,
      qs: words.map(w => ({ word: w, options: makeOptions(w, pool) })),
      idx: 0, correct: 0, mistakes: [], answered: null,
    };
  }
  function reset(topicId, diff, view) { start(topicId, diff, view); }

  function render() {
    if (!state) start();
    if (state.idx >= state.qs.length) {
      const total = state.qs.length;
      const pct = Math.round((state.correct / total) * 100);
      const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0;
      const xp = state.correct * 3 + (pct === 100 ? 10 : 0);
      const s = state; state = null;
      finishRound(null, 'base', stars, pct, xp,
        s.dir === 'lr' ? 'База: латынь → русский' : 'База: русский → латынь',
        `Правильно: ${s.correct} из ${total}`, s.mistakes);
      return;
    }
    const q = state.qs[state.idx], w = q.word, lr = state.dir === 'lr';
    const progressPct = Math.round((state.idx / state.qs.length) * 100);
    let html = `<div class="game-topbar">
        <button class="exit-x" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'base'}))})'>✕</button>
        <div class="game-progress-bar"><div class="game-progress-fill" style="width:${progressPct}%"></div></div>
        <div class="base-counter">${state.idx + 1}/${state.qs.length}</div>
      </div><div class="game-body">`;
    html += `<div class="speed-prompt">
        <div class="sp-main">${lr ? w.lat : w.ru}</div>
        <div class="sp-sub">${lr ? `[${w.translit}] · выбери перевод` : 'выбери латинское слово'}</div>
      </div>${favBar('base', w.id, 'base_' + state.dir, lr ? w.lat : w.ru, false)}<div class="speed-options">`;
    q.options.forEach((o, i) => {
      let cls = 'speed-opt';
      if (state.answered) {
        if (o === w) cls += ' opt-correct';
        else if (state.answered.pick === i) cls += ' opt-wrong';
      }
      const label = lr ? o.ru : `${o.lat}<span class="base-opt-tr">[${o.translit}]</span>`;
      html += `<div class="opt-wrap"><button class="${cls}" onclick="BaseGame.answer(${i})" ${state.answered ? 'disabled' : ''}>${label}</button>${favTermStar('base', o.id, 'opt-star')}</div>`;
    });
    html += `</div>`;
    if (state.answered) {
      html += `<div class="base-answer tap-next ${state.answered.ok ? 'ok' : 'bad'}" onclick="BaseGame.next()" title="Нажми, чтобы продолжить">
          <div class="base-answer-head">${state.answered.ok ? 'Верно!' : 'Не совсем'}<span class="tap-next-mini">дальше →</span></div>
          <div><b>${w.lat}</b> [${w.translit}] — ${w.ru}</div>
          <div class="base-answer-dict">словарная форма: ${w.dict}</div>
        </div>`;
      /* переход — только по кнопке: в базе слово нужно успеть прочитать и запомнить */
      html += `<button class="btn btn-primary btn-block" style="margin-top:12px" onclick="BaseGame.next()">${state.idx + 1 >= state.qs.length ? 'Итоги →' : 'Далее →'}</button>`;
    }
    html += `</div>`;
    document.getElementById('app').innerHTML = html;
  }

  function answer(i) {
    if (!state || state.answered) return;
    const q = state.qs[state.idx];
    const pick = q.options[i];
    const ok = pick === q.word;
    state.answered = { pick: i, ok };
    if (ok) state.correct++;
    else state.mistakes.push({ lat: `${q.word.lat} (${q.word.dict})`, ru: q.word.ru, chose: state.dir === 'lr' ? pick.ru : pick.lat, tid: 'base', id: q.word.id });
    recordTermResult('base', q.word.id, ok, 'base_' + state.dir);
    render();
  }

  function next() {
    if (!state) return;
    state.idx++; state.answered = null;
    render();
    window.scrollTo(0, 0);
  }

  return { render, reset, answer, next };
})();

/* ===================== РЕЖИМ: ВЕРНО / НЕВЕРНО ===================== */
const TrueFalseGame = (function () {
  const TOTAL_QUESTIONS = 16;
  const TIME_BY_DIFFICULTY = { easy: 9, medium: 6, hard: 4 };
  let state = null;

  function makeQuestion(topic, forcedIsTrue) {
    const term = topic.terms[Math.floor(Math.random() * topic.terms.length)];
    let shownRu = term.ru;

    if (!forcedIsTrue) {
      const others = topic.terms.filter(t => t.id !== term.id && t.ru !== term.ru);
      const decoy = others[Math.floor(Math.random() * others.length)];
      shownRu = decoy ? decoy.ru : term.ru;
    }

    return { term, shownRu, isTrue: shownRu === term.ru };
  }

  function buildTruthQueue() {
    const half = Math.floor(TOTAL_QUESTIONS / 2);
    const arr = new Array(half).fill(true).concat(new Array(TOTAL_QUESTIONS - half).fill(false));
    return shuffleArr(arr);
  }

  function start(topicId, difficulty) {
    const topic = findTopic(topicId);
    const truthQueue = buildTruthQueue();
    state = {
      topicId, difficulty: difficulty || 'medium', truthQueue,
      correct: 0, asked: 0, streak: 0, bestStreak: 0,
      mistakes: [],
      q: makeQuestion(topic, truthQueue[0]), answered: false, timeLeft: TIME_BY_DIFFICULTY[difficulty || 'medium'],
    };
    startTimer();
  }

  function reset(topicId, difficulty) { start(topicId, difficulty); }

  function timeLimit() { return TIME_BY_DIFFICULTY[state.difficulty] || 6; }

  function startTimer() {
    clearActiveTimer();
    state.timeLeft = timeLimit();
    const deadline = performance.now() + timeLimit() * 1000;   /* считаем по часам, а не по числу тиков */
    ACTIVE_TIMER = setInterval(() => {
      if (!state) { clearActiveTimer(); return; }
      state.timeLeft = (deadline - performance.now()) / 1000;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        onTimeout();
      } else {
        const fill = document.getElementById('tfTimerFill');
        if (fill) fill.style.width = Math.max(0, (state.timeLeft / timeLimit()) * 100) + '%';
      }
    }, 100);
  }

  function render(topicId) {
    if (!state) start(topicId, 'medium');

    if (state.asked >= TOTAL_QUESTIONS) {
      clearActiveTimer();
      const pct = Math.round((state.correct / state.asked) * 100);
      const stars = 0;   /* звёзды считаются по уровням сложности в finishRound */
      const xp = state.correct * 5 + (state.bestStreak >= 8 ? 15 : 0);
      const correct = state.correct, asked = state.asked, bestStreak = state.bestStreak;
      const mistakes = state.mistakes;
      state = null;
      finishRound(topicId, 'truefalse', stars, pct, xp,
        'Верно / Неверно', `Правильно: ${correct} из ${asked} · лучшая серия: ${bestStreak}`, mistakes);
      return;
    }

    const progressPct = Math.round((state.asked / TOTAL_QUESTIONS) * 100);
    let html = gameTopbar('Верно / Неверно', progressPct);
    html += `<div class="game-body">`;
    html += `<div class="speed-timerbar"><div class="speed-timerfill" id="tfTimerFill" style="width:${(state.timeLeft/timeLimit())*100}%"></div></div>`;
    html += `<div class="speed-combo">${state.streak >= 3 ? '🔥 серия ' + state.streak : '&nbsp;'}</div>`;

    html += `<div class="tf-card">
        <div class="tf-lat">${state.q.term.lat}</div>
        <div class="tf-arrow">↓</div>
        <div class="tf-ru">${state.q.shownRu}</div>
      </div>`;

    html += favBar(state.topicId, state.q.term.id, 'truefalse', state.q.term.lat + ' → ' + state.q.shownRu, true);
    html += `<div class="tf-buttons">
        <button class="tf-btn tf-false" onclick="TrueFalseGame.answer(false)" ${state.answered ? 'disabled' : ''}>✕ Неверно</button>
        <button class="tf-btn tf-true" onclick="TrueFalseGame.answer(true)" ${state.answered ? 'disabled' : ''}>✓ Верно</button>
      </div>`;
    html += `<div class="tf-feedback" id="tfFeedback"></div>`;
    html += `</div>`;

    document.getElementById('app').innerHTML = html;
  }

  function onTimeout() {
    if (state.answered) return;
    state.answered = true;
    clearActiveTimer();
    state.streak = 0;
    state.mistakes.push({ lat: state.q.term.lat, ru: state.q.term.ru, shown: state.q.shownRu, tid: state.topicId, id: state.q.term.id });
    recordTermResult(state.topicId, state.q.term.id, false);
    reveal(null);
  }

  function answer(userSaysTrue) {
    if (state.answered) return;
    state.answered = true;
    clearActiveTimer();
    const isRight = userSaysTrue === state.q.isTrue;
    if (isRight) {
      state.correct++;
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.streak = 0;
      state.mistakes.push({ lat: state.q.term.lat, ru: state.q.term.ru, shown: state.q.shownRu, tid: state.topicId, id: state.q.term.id });
    }
    recordTermResult(state.topicId, state.q.term.id, isRight);
    reveal(isRight);
  }

  function reveal(isRight) {
    state.asked++;
    const fb = document.getElementById('tfFeedback');
    if (isRight === null) {
      fb.textContent = 'Время вышло! Правильный перевод: ' + state.q.term.ru;
      fb.className = 'tf-feedback no';
    } else if (isRight) {
      fb.textContent = 'Верно!';
      fb.className = 'tf-feedback ok';
    } else {
      fb.textContent = 'Неверно. Правильный перевод: ' + state.q.term.ru;
      fb.className = 'tf-feedback no';
    }
    document.querySelectorAll('.tf-btn').forEach(b => b.disabled = true);

    setTimeout(() => {
      if (!state) return;
      const topic = findTopic(state.topicId);
      state.q = makeQuestion(topic, state.truthQueue[state.asked]);
      state.answered = false;
      if (state.asked < TOTAL_QUESTIONS) startTimer();
      render(state.topicId);
    }, 1100);
  }

  return { render, answer, reset };
})();

/* ===================== РЕЖИМ: СОБЕРИ ТЕРМИН ===================== */
const BuilderGame = (function () {
  const TERMS_TOTAL = 6;
  const DIFF_SETTINGS = {
    easy: { extraDistractors: 3, showTranslation: true },
    medium: { extraDistractors: 6, showTranslation: false },
    hard: { extraDistractors: 9, showTranslation: false },
  };
  let state = null;

  function start(topicId, difficulty) {
    const topic = findTopic(topicId);
    const eligible = topic.terms.filter(t => t.parts && t.parts.length >= 2);
    const terms = pickN(eligible, TERMS_TOTAL);
    state = {
      topicId, difficulty: difficulty || 'medium', terms, allTerms: topic.terms, idx: 0,
      mistakesTotal: 0, solvedCount: 0, firstTry: 0, mistakes: [],
      pool: [], assembled: [], mistakesThisTerm: 0, locked: false, feedback: null,
    };
    setupTerm();
  }

  function reset(topicId, difficulty) { start(topicId, difficulty); }

  function diffSettings() { return DIFF_SETTINGS[state.difficulty] || DIFF_SETTINGS.medium; }

  function setupTerm() {
    const term = state.terms[state.idx];
    const correctParts = term.parts.map((p, i) => ({ uid: 'c' + i, lat: p[0], ru: p[1] }));

    const correctTextsLower = new Set(term.parts.map(p => p[0].toLowerCase()));
    const otherPartsPool = [];
    const seenLat = new Set();
    state.allTerms.forEach(t => {
      if (t.id === term.id) return;
      (t.parts || []).forEach(p => {
        const key = p[0].toLowerCase();
        if (correctTextsLower.has(key) || seenLat.has(key)) return;
        seenLat.add(key);
        otherPartsPool.push({ lat: p[0], ru: p[1] });
      });
    });

    const targetExtra = diffSettings().extraDistractors;
    const distractors = pickN(otherPartsPool, targetExtra).map((p, i) => ({ uid: 'd' + i, lat: p.lat, ru: p.ru }));

    state.pool = shuffleArr(correctParts.concat(distractors));
    state.assembled = [];
    state.mistakesThisTerm = 0;
    state.feedback = null;
  }

  function render(topicId) {
    if (!state) start(topicId, 'medium');

    if (state.idx >= state.terms.length) {
      const perfect = state.mistakesTotal === 0;   /* бонус XP за раунд без ошибок; звёзды — по уровням в finishRound */
      /* процент для звезды — сколько терминов собрано с первой попытки */
      const pct = Math.round((state.firstTry / state.terms.length) * 100);
      const xp = state.solvedCount * 10 + (perfect ? 15 : 0);
      const total = state.terms.length, mistakes = state.mistakesTotal;
      const mistakesList = state.mistakes, s_first = state.firstTry;
      state = null;
      finishRound(topicId, 'builder', 0, pct, xp,
        'Собери термин', `С первой попытки: ${s_first}/${total} (${pct}%), ошибок: ${mistakes}`, mistakesList);
      return;
    }

    const term = state.terms[state.idx];
    const progressPct = Math.round((state.idx / state.terms.length) * 100);

    let html = gameTopbar('Собери термин', progressPct);
    html += `<div class="game-body">`;
    html += `<div class="builder-target">
        <div class="bt-ru">${term.ru}</div>
        <div class="bt-hint">${diffSettings().showTranslation ? 'В поле ниже есть и лишние кусочки — выбери только нужные и в правильном порядке' : 'Переводов не будет — ориентируйся только на латынь. В поле есть лишние кусочки'}</div>
      </div>`;
    html += favBar(topicId, term.id, 'builder', term.ru, true);

    html += `<div class="assembly-line" id="assemblyLine">`;
    if (state.assembled.length === 0) {
      html += `<span class="assembly-placeholder">Нажимай на кусочки снизу по порядку</span>`;
    } else {
      state.assembled.forEach(p => {
        html += `<button class="chip chip-assembled" onclick="BuilderGame.unpick('${p.uid}')">${p.lat}</button>`;
      });
    }
    html += `</div>`;

    html += `<div class="pool-row" id="poolRow">`;
    const showTr = diffSettings().showTranslation;
    state.pool.forEach(p => {
      const hash = String(p.uid).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const rot = (hash % 9) - 4;
      html += `<button class="chip chip-pool" style="transform:rotate(${rot}deg)" onclick="BuilderGame.pick('${p.uid}')">
          ${p.lat}${showTr ? `<span class="chip-part-meaning">${p.ru}</span>` : ''}
        </button>`;
    });
    html += `</div>`;

    html += `<div class="builder-feedback" id="builderFeedback" style="color:${state.feedback ? state.feedback.color : 'inherit'}">${state.feedback ? state.feedback.text : ''}</div>`;
    html += `<div class="builder-actions">`;
    html += `<button class="btn btn-primary btn-block" id="checkBtn" onclick="BuilderGame.check()" ${(state.assembled.length === 0 || state.locked) ? 'disabled' : ''}>Проверить</button>`;
    if (state.mistakesThisTerm >= 2 && !state.locked) html += `<button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="BuilderGame.giveUp()">Показать ответ</button>`;
    html += `</div>`;
    html += `</div>`;

    document.getElementById('app').innerHTML = html;
  }

  function pick(uid) {
    if (state.locked) return;
    const i = state.pool.findIndex(p => p.uid === uid);
    if (i === -1) return;
    state.assembled.push(state.pool[i]);
    state.pool.splice(i, 1);
    render(state.topicId);
  }

  function unpick(uid) {
    if (state.locked) return;
    const i = state.assembled.findIndex(p => p.uid === uid);
    if (i === -1) return;
    state.pool.push(state.assembled[i]);
    state.assembled.splice(i, 1);
    render(state.topicId);
  }

  function check() {
    const term = state.terms[state.idx];
    const built = state.assembled.map(p => p.lat).join(' ').toLowerCase();
    const correct = term.parts.map(p => p[0]).join(' ').toLowerCase();

    if (built === correct) {
      state.solvedCount++;
      if (state.mistakesThisTerm === 0) state.firstTry++;
      state.feedback = { text: 'Верно! ' + term.lat, color: 'var(--accent-dark)' };
      state.locked = true;
      if (state.mistakesThisTerm > 0) {
        state.mistakes.push({ lat: term.lat, ru: term.ru, tid: state.topicId, id: term.id });
      }
      recordTermResult(state.topicId, term.id, state.mistakesThisTerm === 0);
      render(state.topicId);
      setTimeout(() => {
        state.idx++;
        state.locked = false;
        if (state.idx < state.terms.length) setupTerm();
        render(state.topicId);
      }, 900);
    } else {
      state.mistakesThisTerm++;
      state.mistakesTotal++;
      state.feedback = { text: 'Не тот порядок — попробуй ещё раз', color: 'var(--red)' };
      state.pool = shuffleArr(state.pool.concat(state.assembled));
      state.assembled = [];
      render(state.topicId);
    }
  }

  /* после 2 неудачных попыток можно посмотреть ответ: термин засчитывается как ошибка */
  function giveUp() {
    if (state.locked) return;
    const term = state.terms[state.idx];
    state.locked = true;
    state.mistakes.push({ lat: term.lat, ru: term.ru, tid: state.topicId, id: term.id });
    recordTermResult(state.topicId, term.id, false);
    state.feedback = { text: 'Ответ: ' + term.parts.map(p => p[0]).join(' '), color: 'var(--red)' };
    render(state.topicId);
    setTimeout(() => {
      state.idx++;
      state.locked = false;
      if (state.idx < state.terms.length) setupTerm();
      render(state.topicId);
    }, 2200);
  }

  return { render, pick, unpick, check, reset, giveUp };
})();

/* ===================== РЕЖИМ: СКОРОСТНОЙ КВИЗ ===================== */
const SpeedGame = (function () {
  const MAX_QUESTIONS = 20;
  const TIME_LIMIT = 14; /* сек — одинаково для всех сложностей */
  const MULTI_PROB = { easy: 0, medium: 0.3, hard: 0.5 };
  const OPTION_COUNT = { easy: 4, medium: 4, hard: 5 };
  /* вероятности 1 / 2 / 3 верных в мультивыборе */
  const MULTI_WEIGHTS = { medium: [0.3, 0.5, 0.2], hard: [0.2, 0.45, 0.35] };
  let state = null;

  function firstWord(lat) { return lat.split(' ')[0].toLowerCase(); }

  function pickDistractorTerms(term, topic, count, confusable) {
    const pool = topic.terms.filter(t => t.id !== term.id);
    if (!confusable) return pickN(pool, count);
    const sameRoot = pool.filter(t => firstWord(t.lat) === firstWord(term.lat));
    if (sameRoot.length >= count) return pickN(sameRoot, count);
    const rest = shuffleArr(pool.filter(t => firstWord(t.lat) !== firstWord(term.lat)));
    return sameRoot.concat(rest.slice(0, count - sameRoot.length));
  }

  function makeSingleQuestion(topic, confusable, optCount) {
    const term = topic.terms[Math.floor(Math.random() * topic.terms.length)];
    const latToRu = Math.random() < 0.5;
    const promptText = latToRu ? term.lat : term.ru;
    const promptSub = latToRu ? term.translit : 'выбери латинское название';
    const correctText = latToRu ? term.ru : term.lat;

    const distractorTerms = pickDistractorTerms(term, topic, (optCount || 4) - 1, confusable);
    /* варианты вместе с терминами — чтобы звёздочка у варианта знала, какой это термин */
    const pairs = shuffleArr([{ text: correctText, id: term.id }].concat(distractorTerms.map(t => ({ text: latToRu ? t.ru : t.lat, id: t.id }))));
    const options = pairs.map(p => p.text), optTermIds = pairs.map(p => p.id);
    return { type: 'single', term, promptText, promptSub, correctText, options, optTermIds };
  }

  function makeQuestion(topic, difficulty) {
    const multiProb = MULTI_PROB[difficulty] || 0;
    const optCount = OPTION_COUNT[difficulty] || 4;
    if (Math.random() < multiProb) {
      const mq = buildMultiQuestion(topic, optCount, MULTI_WEIGHTS[difficulty] || MULTI_WEIGHTS.medium);
      if (mq) return mq;
    }
    return makeSingleQuestion(topic, difficulty !== 'easy', optCount);
  }

  function start(topicId, difficulty) {
    const topic = findTopic(topicId);
    state = {
      topicId, difficulty: difficulty || 'medium', lives: 3, correct: 0, asked: 0, combo: 0,
      q: makeQuestion(topic, difficulty || 'medium'), answered: false, timeLeft: TIME_LIMIT,
      selected: new Set(), mistakes: [],
    };
    startTimer();
  }

  function reset(topicId, difficulty) { start(topicId, difficulty); }

  function startTimer() {
    clearActiveTimer();
    state.timeLeft = TIME_LIMIT;
    const deadline = performance.now() + TIME_LIMIT * 1000;   /* считаем по часам, а не по числу тиков */
    ACTIVE_TIMER = setInterval(() => {
      if (!state) { clearActiveTimer(); return; }
      state.timeLeft = (deadline - performance.now()) / 1000;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        onTimeout();
      } else {
        updateTimerBarOnly();
      }
    }, 100);
  }

  function updateTimerBarOnly() {
    const fill = document.getElementById('speedTimerFill');
    if (fill) fill.style.width = Math.max(0, (state.timeLeft / TIME_LIMIT) * 100) + '%';
  }

  function render(topicId) {
    if (!state) start(topicId, 'medium');

    if (state.lives <= 0 || state.asked >= MAX_QUESTIONS) {
      clearActiveTimer();
      const pct = state.asked ? Math.round((state.correct / state.asked) * 100) : 0;
      const stars = 0;   /* звёзды считаются по уровням сложности в finishRound */
      const xp = state.correct * 6;
      const correct = state.correct, asked = state.asked;
      const mistakesList = state.mistakes;
      state = null;
      finishRound(topicId, 'speed', stars, pct, xp,
        'Скоростной квиз', `Правильных ответов: ${correct} из ${asked}`, mistakesList);
      return;
    }

    const livesHtml = `<div class="lives-row">${'❤️'.repeat(state.lives)}${'🖤'.repeat(3 - state.lives)}</div>`;
    const progressPct = Math.round((state.asked / MAX_QUESTIONS) * 100);

    let html = gameTopbar('Скоростной квиз', progressPct, livesHtml);
    html += `<div class="game-body">`;
    html += `<div class="speed-timerbar"><div class="speed-timerfill" id="speedTimerFill" style="width:${(state.timeLeft/TIME_LIMIT)*100}%"></div></div>`;
    html += `<div class="speed-combo">${state.combo >= 3 ? '🔥 серия ×' + state.combo : '&nbsp;'}</div>`;

    if (state.q.type === 'multi') {
      html += multiPromptHtml(state.q);
      html += `<div class="speed-options">`;
      state.q.options.forEach((opt, i) => {
        const checked = state.selected.has(i);
        html += `<div class="opt-wrap"><button class="speed-opt ${checked ? 'opt-selected' : ''}" onclick="SpeedGame.toggleMulti(${i})" ${state.answered ? 'disabled' : ''}>
            <span class="opt-checkbox">${checked ? '☑' : '☐'}</span> ${opt.text}
          </button>${favTermStar(state.topicId, opt.termId, 'opt-star')}</div>`;
      });
      html += `</div>`;
      html += `<div style="margin-top:14px;"><button class="btn btn-primary btn-block" onclick="SpeedGame.submitMulti()" ${state.answered ? 'disabled' : ''}>Ответить</button></div>`;
    } else {
      html += `<div class="speed-prompt">
          <div class="sp-main">${state.q.promptText}</div>
          <div class="sp-sub">${state.q.promptSub}</div>
        </div>`;
      html += favBar(state.topicId, state.q.term.id, 'speed', state.q.promptText, false);
      html += `<div class="speed-options">`;
      state.q.options.forEach((opt, i) => {
        html += `<div class="opt-wrap"><button class="speed-opt" data-opt="${i}" onclick="SpeedGame.answer(${i})" ${state.answered ? 'disabled' : ''}>${opt}</button>${favTermStar(state.topicId, state.q.optTermIds && state.q.optTermIds[i], 'opt-star')}</div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;

    document.getElementById('app').innerHTML = html;
  }

  function onTimeout() {
    if (state.answered) return;
    state.answered = true;
    clearActiveTimer();
    state.lives--;
    state.combo = 0;
    if (state.q.type === 'multi') {
      /* засчитываем ошибку только по верным вариантам — лишние термины к вопросу не относились */
      state.q.options.filter(opt => opt.correct).forEach(opt => recordTermResult(state.topicId, opt.termId, false));
      state.mistakes.push({ lat: state.q.partLat, ru: state.q.partRu, shown: 'время вышло' });
      revealMulti(false);
    } else {
      recordTermResult(state.topicId, state.q.term.id, false);
      state.mistakes.push({ lat: state.q.term.lat, ru: state.q.term.ru, shown: 'время вышло', tid: state.topicId, id: state.q.term.id });
      revealAnswer(-1);
    }
  }

  function answer(i) {
    if (state.answered) return;
    state.answered = true;
    clearActiveTimer();
    const isCorrect = state.q.options[i] === state.q.correctText;
    if (isCorrect) { state.correct++; state.combo++; }
    else {
      state.lives--; state.combo = 0;
      state.mistakes.push({ lat: state.q.term.lat, ru: state.q.term.ru, shown: state.q.options[i], tid: state.topicId, id: state.q.term.id });
    }
    recordTermResult(state.topicId, state.q.term.id, isCorrect);
    revealAnswer(i);
  }

  function toggleMulti(i) {
    if (state.answered) return;
    if (state.selected.has(i)) state.selected.delete(i);
    else state.selected.add(i);
    render(state.topicId);
  }

  function submitMulti() {
    if (state.answered) return;
    state.answered = true;
    clearActiveTimer();
    const correctIdx = new Set(state.q.options.map((o, i) => o.correct ? i : null).filter(i => i !== null));
    const isCorrect = correctIdx.size === state.selected.size && [...correctIdx].every(i => state.selected.has(i));
    if (isCorrect) { state.correct++; state.combo++; }
    else {
      state.lives--; state.combo = 0;
      state.mistakes.push({ lat: state.q.partLat, ru: state.q.partRu, shown: 'ошибка в выборе терминов' });
    }
    state.q.options.forEach((opt, i) => {
      const wasRightForThisOption = opt.correct === state.selected.has(i);
      recordTermResult(state.topicId, opt.termId, wasRightForThisOption);
    });
    revealMulti(isCorrect);
  }

  function revealMulti(isCorrect) {
    state.asked++;
    const buttons = document.querySelectorAll('.speed-opt');
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      if (state.q.options[i].correct) btn.classList.add('opt-correct');
      else if (state.selected.has(i)) btn.classList.add('opt-wrong');
    });
    revealMultiDetails(state.q);
    advanceAfterDelay(2200);
  }

  function revealAnswer(chosenIdx) {
    state.asked++;
    const buttons = document.querySelectorAll('.speed-opt');
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      if (state.q.options[i] === state.q.correctText) btn.classList.add('opt-correct');
      else if (i === chosenIdx) btn.classList.add('opt-wrong');
    });
    advanceAfterDelay();
  }

  function advanceAfterDelay(ms) {
    setTimeout(() => {
      if (!state) return;
      const topic = findTopic(state.topicId);
      state.q = makeQuestion(topic, state.difficulty);
      state.answered = false;
      state.selected = new Set();
      if (state.lives > 0 && state.asked < MAX_QUESTIONS) startTimer();
      render(state.topicId);
    }, ms || 950);
  }

  return { render, answer, toggleMulti, submitMulti, reset };
})();

/* ===================== ОБЩЕЕ: ВОПРОС «ПОКАЖИ ЦИФРУ НА КАРТОЧКЕ» ===================== */
/* Используется «Экзаменом по темам» и «Слабыми местами». Логика засчитывания — как в «Найди на картинке»:
   клик внутри кружка нужной цифры И эта цифра ближайшая; цифры считаются со всей карточки (два рисунка). */
function cardHotspotsOf(topic, img) {
  return topic.images.filter(x => x.src === img.src).flatMap(x => x.hotspots);
}
function cardClickCheck(topic, img, termId, xPct, yPct) {
  const all = cardHotspotsOf(topic, img);
  let best = null;
  all.forEach(h => { const d = Math.hypot(xPct - h.x, yPct - h.y); if (!best || d < best.d) best = { h, d }; });
  const ok = !!best && best.h.term === termId && best.d <= best.h.r;
  return { ok, targets: all.filter(h => h.term === termId) };
}
function cardMarker(wrap, xPct, yPct, cls, label) {
  const m = document.createElement('div');
  m.className = 'pic-marker ' + cls;
  m.style.left = xPct + '%'; m.style.top = yPct + '%';
  m.textContent = label;
  wrap.appendChild(m);
}
/* пул вопросов «покажи на карточке» по списку тем: одна запись на термин в теме */
function cardQuestionPool(topicIds) {
  const pool = [];
  topicIds.forEach(tid => {
    const topic = findTopic(tid); if (!topic) return;
    const seen = new Set();
    shuffleArr(topic.images).forEach(img => img.hotspots.forEach(h => {
      if (seen.has(h.term)) return; seen.add(h.term);
      pool.push({ topicId: tid, imgId: img.id, termId: h.term });
    }));
  });
  return pool;
}

/* ===================== ЭКЗАМЕН ПО ТЕМАМ: выбор костей ===================== */
let EXAM_SEL = null;      /* выбранные темы (Set) — по умолчанию все */
let EXAM_COUNT = 20;
function examAllTopicIds() { return CONTENT.sections.flatMap(s => s.topics.map(t => t.id)); }

function renderExamSetup() {
  if (!EXAM_SEL) EXAM_SEL = new Set(examAllTopicIds());
  let html = renderTopbar();
  html += backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>Экзамен по темам</h1>
      <div class="hub-latin">Выбери кости — будешь показывать структуры на карточках</div>
      <button class="guide-link" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'guide', mode:'exam'}))})'>📘 Как проходит экзамен</button></div>`;
  html += `<div class="base-wrap">`;
  const all = examAllTopicIds();
  const allOn = all.every(id => EXAM_SEL.has(id));
  html += `<div class="base-groups" style="margin-bottom:10px"><button class="base-chip ${allOn ? 'on' : ''}" onclick="examToggleAll()">Все темы</button></div>`;
  CONTENT.sections.forEach(sec => {
    const ids = sec.topics.map(t => t.id);
    const secOn = ids.every(id => EXAM_SEL.has(id));
    html += `<div class="exam-sec-head"><span>${sec.icon || ''} ${sec.title}</span>
        <button class="exam-sec-toggle" onclick="examToggleSection('${sec.id}')">${secOn ? 'снять все' : 'выбрать все'}</button></div>
      <div class="base-groups">`;
    sec.topics.forEach(t => {
      const n = cardQuestionPool([t.id]).length;
      html += `<button class="base-chip ${EXAM_SEL.has(t.id) ? 'on' : ''}" onclick="examToggleTopic('${t.id}')">${t.title} <span class="base-chip-n">${n}</span></button>`;
    });
    html += `</div>`;
  });
  const avail = cardQuestionPool([...EXAM_SEL]).length;
  html += `<div class="base-legend">Цифра у кости — сколько её структур есть на карточках</div>`;
  html += `<div class="guide-section-title">Сколько вопросов</div><div class="base-groups">`;
  [10, 20, 40].forEach(n => {
    html += `<button class="base-chip ${EXAM_COUNT === n ? 'on' : ''}" onclick="EXAM_COUNT=${n}; renderExamSetup()">${n}</button>`;
  });
  html += `</div>`;
  const q = Math.min(EXAM_COUNT, avail);
  html += avail
    ? `<button class="btn btn-primary btn-block" style="margin-top:18px" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'game', mode:'exam', topics:[...EXAM_SEL], count:EXAM_COUNT}))})'>Начать экзамен · ${q} вопросов →</button>`
    : `<div class="coming-soon" style="margin-top:16px">Выбери хотя бы одну кость</div>`;
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}
function examToggleTopic(id) { EXAM_SEL.has(id) ? EXAM_SEL.delete(id) : EXAM_SEL.add(id); renderExamSetup(); }
function examToggleSection(secId) {
  const ids = CONTENT.sections.find(s => s.id === secId).topics.map(t => t.id);
  const on = ids.every(id => EXAM_SEL.has(id));
  ids.forEach(id => on ? EXAM_SEL.delete(id) : EXAM_SEL.add(id));
  renderExamSetup();
}
function examToggleAll() {
  const all = examAllTopicIds();
  EXAM_SEL = all.every(id => EXAM_SEL.has(id)) ? new Set() : new Set(all);
  renderExamSetup();
}

/* ===================== ЭКЗАМЕН ПО ТЕМАМ: игра ===================== */
const ExamGame = (function () {
  let state = null;

  function reset(_t, _d, view) {
    const topics = (view && view.topics && view.topics.length) ? view.topics : examAllTopicIds();
    const count = (view && view.count) || 20;
    const qs = shuffleArr(cardQuestionPool(topics)).slice(0, count);
    state = { qs, idx: 0, correct: 0, mistakes: [], answered: null };
  }

  function render() {
    if (!state) reset();
    if (!state.qs.length) { goTo({ screen: 'examSetup' }); return; }
    if (state.idx >= state.qs.length) {
      const total = state.qs.length, pct = Math.round(state.correct / total * 100);
      const s = state; state = null;
      finishRound(null, 'exam', 0, pct, s.correct * 4 + (pct === 100 ? 20 : 0), 'Экзамен по темам',
        `Показано верно: ${s.correct} из ${total}`, s.mistakes);
      return;
    }
    const q = state.qs[state.idx];
    const topic = findTopic(q.topicId), img = topic.images.find(i => i.id === q.imgId);
    const term = topic.terms.find(t => t.id === q.termId);
    const pct = Math.round(state.idx / state.qs.length * 100);
    let html = `<div class="game-topbar">
        <button class="exit-x" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen:'examSetup'}))})'>✕</button>
        <div class="game-progress-bar"><div class="game-progress-fill" style="width:${pct}%"></div></div>
        <div class="base-counter">${state.idx + 1}/${state.qs.length}</div>
      </div><div class="game-body">
      <div class="pic-prompt">
        <div class="exam-topic-tag">${topic.title} · ${img.label}</div>
        <div class="prompt-ru">Покажи: ${term.lat}</div>
        <div class="prompt-lat">${state.answered ? `${term.ru} · [${term.translit}]` : `[${term.translit}]`}</div>
      </div>
      ${favBar(q.topicId, q.termId, 'picture', 'Покажи: ' + term.lat, true)}
      <div class="pic-wrap" id="examWrap"><img src="${IMAGES[img.src]}" draggable="false"></div>
      <div class="pic-feedback ${state.answered && state.answered.ok ? 'ok' : ''}" id="examFb">${state.answered ? (state.answered.ok ? 'Верно!' : 'Не совсем — правильная цифра отмечена ★') + '<div class="tap-next-hint">👆 нажми на карточку, чтобы продолжить</div>' : ''}</div>
      <div style="text-align:center;margin-top:12px">${state.answered ? `<button class="btn btn-primary" onclick="ExamGame.next()">${state.idx + 1 >= state.qs.length ? 'Итоги →' : 'Далее →'}</button>` : ''}</div>
    </div>`;
    document.getElementById('app').innerHTML = html;
    const wrap = document.getElementById('examWrap');
    if (state.answered) {
      const a = state.answered;
      cardMarker(wrap, a.x, a.y, a.ok ? 'marker-correct' : 'marker-wrong', a.ok ? '✓' : '✕');
      if (!a.ok) a.targets.forEach(h => cardMarker(wrap, h.x, h.y, 'marker-reveal', '★'));
      wrap.classList.add('tap-next');
      wrap.addEventListener('click', next);   /* нажатие на карточку — к следующему вопросу */
    } else {
      wrap.addEventListener('click', onClick);
    }
  }

  function onClick(e) {
    if (!state || state.answered) return;
    const q = state.qs[state.idx];
    const topic = findTopic(q.topicId), img = topic.images.find(i => i.id === q.imgId);
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
    const res = cardClickCheck(topic, img, q.termId, x, y);
    state.answered = { ok: res.ok, x, y, targets: res.targets };
    const term = topic.terms.find(t => t.id === q.termId);
    if (res.ok) state.correct++;
    else state.mistakes.push({ lat: `${term.lat} (${topic.title})`, ru: term.ru, tid: q.topicId, id: q.termId });
    recordTermResult(q.topicId, q.termId, res.ok, 'exam');
    render();
  }

  function next() { if (!state) return; state.idx++; state.answered = null; render(); window.scrollTo(0, 0); }

  return { render, reset, next };
})();

/* ===================== СЛАБЫЕ МЕСТА ===================== */
/* «Солянка»: термины с недавними ошибками, каждый — тем типом задания, где была последняя ошибка.
   Таймера нет ни в одном задании. Звёзд нет. */
const WeakSpotsGame = (function () {
  const MAX_Q = 12;
  const TYPE_LABEL = {
    picture: '🖱️ Найди на картинке', legend: '📋 Что под номером', truefalse: '✅ Верно / неверно',
    builder: '🧩 Собери термин', speed: '⚡ Выбери перевод', base_lr: '🔤 База: латынь → русский', base_rl: '🔤 База: русский → латынь',
  };
  let state = null;

  const topicOf = id => findTopic(id);
  const imagesWith = (topic, termId) => (topic.images || []).filter(im => im.hotspots.some(h => h.term === termId));
  const ruKey = t => t.ru.toLowerCase();

  /* варианты из той же темы (при нехватке — из других), без повторов перевода */
  function optionTerms(topic, term, n, pool) {
    const seen = new Set([ruKey(term)]), out = [];
    const cands = shuffleArr(pool || topic.terms).concat(shuffleArr(CONTENT.sections.flatMap(s => s.topics.filter(t => isMuscleTopic(t.id) === isMuscleTopic(topic.id)).flatMap(t => t.terms))));
    for (const t of cands) {
      if (out.length >= n) break;
      if (t.id === term.id || seen.has(ruKey(t)) || t.lat === term.lat) continue;
      seen.add(ruKey(t)); out.push(t);
    }
    return out;
  }

  function makeQuestion(item) {
    let type = item.mode;
    const topic = topicOf(item.topicId), term = item.term;
    const q = { type, topicId: item.topicId, term, topic };
    if (item.topicId === 'base') {
      if (type !== 'base_lr' && type !== 'base_rl') type = q.type = 'base_lr';
      const fits = w => !baseConflict(w, term);
      const same = shuffleArr(BASE_WORDS.filter(w => w.group === term.group && fits(w)));
      const rest = shuffleArr(BASE_WORDS.filter(w => w.group !== term.group && fits(w)));
      const opts = [];
      for (const w of same.concat(rest)) { if (opts.length >= 3) break; if (!opts.some(o => baseConflict(o, w))) opts.push(w); }
      q.options = shuffleArr(opts.concat([term]));
      return q;
    }
    if ((type === 'picture' || type === 'legend') && !imagesWith(topic, term.id).length) type = q.type = 'speed';
    if (type === 'builder' && !(term.parts && term.parts.length >= 2)) type = q.type = 'speed';
    if (type === 'base_lr' || type === 'base_rl') type = q.type = 'speed';

    if (type === 'picture' || type === 'legend') {
      const img = shuffleArr(imagesWith(topic, term.id))[0];
      q.img = img;
      q.hotspot = img.hotspots.find(h => h.term === term.id);
      if (type === 'legend') {
        const cardTerms = [...new Set(cardHotspotsOf(topic, img).map(h => h.term))].map(id => topic.terms.find(t => t.id === id));
        q.options = shuffleArr(optionTerms(topic, term, 3, cardTerms).concat([term]));
      }
    } else if (type === 'truefalse') {
      q.showCorrect = Math.random() < 0.5;
      q.shownRu = q.showCorrect ? term.ru : (optionTerms(topic, term, 1)[0] || term).ru;
      if (q.shownRu === term.ru) q.showCorrect = true;
    } else if (type === 'builder') {
      const own = term.parts.map((p, i) => ({ uid: 'o' + i, lat: p[0], ru: p[1] }));
      const ownLat = new Set(own.map(p => p.lat));
      const extra = shuffleArr(topic.terms.flatMap(t => t.parts || []).filter(p => !ownLat.has(p[0])))
        .filter((p, i, a) => a.findIndex(x => x[0] === p[0]) === i).slice(0, 3)
        .map((p, i) => ({ uid: 'x' + i, lat: p[0], ru: p[1] }));
      q.pool = shuffleArr(own.concat(extra));
      q.picked = [];
    } else {
      q.options = shuffleArr(optionTerms(topic, term, 3).concat([term]));
    }
    return q;
  }

  function reset(_t, _d, view) {
    const fav = !!(view && view.source === 'favorites');
    const only = view && view.topics && view.topics.length ? new Set(view.topics) : null;
    const items = fav ? favPracticeItems()
      : only ? getWeakItems(9999).filter(i => only.has(i.topicId)).slice(0, MAX_Q) : getWeakItems(MAX_Q);
    state = { fav, qs: shuffleArr(items).map(makeQuestion), idx: 0, correct: 0, mistakes: [], answered: null };
  }

  function render() {
    if (!state) reset();
    if (!state.qs.length && state.fav) {
      document.getElementById('app').innerHTML = renderTopbar() + backRow('Избранное', { screen: 'favorites' }) +
        `<div class="coming-soon" style="margin:20px">В избранном пока ничего нет — отметь ☆ термины или вопросы.</div>`;
      return;
    }
    if (!state.qs.length) {
      document.getElementById('app').innerHTML = renderTopbar() + backRow('Карта тем', { screen: 'map' }) +
        `<div class="coming-soon" style="margin:20px">Ошибок за последнее время нет — слабых мест не найдено 🎉<br>Сюда попадут термины, в которых ошибёшься в любом режиме.</div>`;
      return;
    }
    if (state.idx >= state.qs.length) {
      const total = state.qs.length, pct = Math.round(state.correct / total * 100);
      const s = state; state = null;
      finishRound(null, 'weakspots', 0, pct, s.correct * 4, s.fav ? 'Избранное' : 'Слабые места',
        s.fav ? `Верно: ${s.correct} из ${total}` : `Исправлено: ${s.correct} из ${total}`, s.mistakes);
      return;
    }
    const q = state.qs[state.idx], a = state.answered, term = q.term;
    const pct = Math.round(state.idx / state.qs.length * 100);
    let html = `<div class="game-topbar">
        <button class="exit-x" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({screen: state.fav ? 'favorites' : 'map'}))})'>✕</button>
        <div class="game-progress-bar"><div class="game-progress-fill" style="width:${pct}%"></div></div>
        <div class="base-counter">${state.idx + 1}/${state.qs.length}</div>
      </div><div class="game-body">
      <div class="ws-tag">${state.fav ? '⭐ ' : ''}${TYPE_LABEL[q.type]} · ${q.topic.title}</div>
      ${favBar(q.topicId, term.id, q.type, q.type === 'picture' ? 'Найди: ' + term.ru : q.type === 'legend' ? 'Что под номером ' + q.hotspot.n : q.type === 'base_rl' || q.type === 'builder' ? term.ru : term.lat, !q.options)}`;

    if (q.type === 'picture') {
      html += `<div class="pic-prompt"><div class="prompt-ru">Найди: ${term.ru}</div><div class="prompt-lat">${term.lat}</div></div>
        <div class="pic-wrap" id="wsWrap"><img src="${IMAGES[q.img.src]}" draggable="false"></div>`;
    } else if (q.type === 'legend') {
      html += `<div class="pic-prompt"><div class="prompt-ru">Что под номером ${q.hotspot.n}?</div><div class="prompt-lat">${q.img.label}</div></div>
        <div class="pic-wrap" id="wsWrap"><img src="${IMAGES[q.img.src]}" draggable="false">
          ${cardHotspotsOf(q.topic, q.img).filter(h => h.n === q.hotspot.n && h.term === term.id).map(h => `<span class="lg-ring-base cm-ring" style="left:${h.x}%;top:${h.y}%"></span>`).join('')}
        </div>` + optionsHtml(q, o => `${o.lat}<span class="base-opt-tr">${o.ru}</span>`);
    } else if (q.type === 'truefalse') {
      html += `<div class="speed-prompt"><div class="sp-main">${term.lat}</div><div class="sp-sub">[${term.translit}]</div></div>
        <div class="ws-tf-shown">${q.shownRu}</div>
        <div class="ws-tf-btns">
          <button class="speed-opt ${a ? (q.showCorrect ? 'opt-correct' : (a.pick === true ? 'opt-wrong' : '')) : ''}" onclick="WeakSpotsGame.answerTF(true)" ${a ? 'disabled' : ''}>✓ Верно</button>
          <button class="speed-opt ${a ? (!q.showCorrect ? 'opt-correct' : (a.pick === false ? 'opt-wrong' : '')) : ''}" onclick="WeakSpotsGame.answerTF(false)" ${a ? 'disabled' : ''}>✕ Неверно</button>
        </div>`;
    } else if (q.type === 'builder') {
      html += `<div class="speed-prompt"><div class="sp-main">${term.ru}</div><div class="sp-sub">собери латинский термин по порядку</div></div>
        <div class="assembly-row ws-assembly">${q.picked.map(uid => { const p = q.pool.find(x => x.uid === uid);
          return `<button class="chip chip-assembled" onclick="WeakSpotsGame.unpick('${uid}')" ${a ? 'disabled' : ''}>${p.lat}</button>`; }).join('') || '<span class="lg-empty">нажимай фишки ниже</span>'}</div>`;
      if (!a) {
        html += `<div class="pool-row">${q.pool.filter(p => !q.picked.includes(p.uid)).map(p =>
          `<button class="chip chip-pool" onclick="WeakSpotsGame.pick('${p.uid}')">${p.lat}</button>`).join('')}</div>
          <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="WeakSpotsGame.checkBuilder()" ${q.picked.length ? '' : 'disabled'}>Проверить</button>`;
      }
    } else {
      const lr = q.type !== 'base_rl';
      html += `<div class="speed-prompt"><div class="sp-main">${lr ? term.lat : term.ru}</div>
        <div class="sp-sub">${lr ? `[${term.translit}] · выбери перевод` : 'выбери латинское слово'}</div></div>`;
      html += optionsHtml(q, o => lr ? o.ru : `${o.lat}<span class="base-opt-tr">[${o.translit}]</span>`);
    }

    if (a) {
      html += `<div class="base-answer tap-next ${a.ok ? 'ok' : 'bad'}" onclick="WeakSpotsGame.next()" title="Нажми, чтобы продолжить"><div class="base-answer-head">${a.ok ? 'Верно!' : 'Не совсем'}<span class="tap-next-mini">дальше →</span></div>
          <div><b>${term.lat}</b> [${term.translit}] — ${term.ru}</div>
          ${q.hotspot ? `<div class="base-answer-dict">на карточке: № ${q.hotspot.n} (${q.img.label})</div>` : ''}${term.dict ? `<div class="base-answer-dict">словарная форма: ${term.dict}</div>` : ''}</div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="WeakSpotsGame.next()">${state.idx + 1 >= state.qs.length ? 'Итоги →' : 'Далее →'}</button>`;
    }
    html += `</div>`;
    document.getElementById('app').innerHTML = html;

    const wrap = document.getElementById('wsWrap');
    if (q.type === 'picture' && wrap) {
      if (a) {
        cardMarker(wrap, a.x, a.y, a.ok ? 'marker-correct' : 'marker-wrong', a.ok ? '✓' : '✕');
        if (!a.ok) a.targets.forEach(h => cardMarker(wrap, h.x, h.y, 'marker-reveal', '★'));
      } else wrap.addEventListener('click', onPicClick);
    }
    /* после ответа нажатие на карточку (картинка или «что под номером») — к следующему заданию */
    if (a && wrap) {
      wrap.classList.add('tap-next');
      wrap.addEventListener('click', next);
    }
  }

  function optionsHtml(q, label) {
    const a = state.answered;
    return `<div class="speed-options">` + q.options.map((o, i) => {
      let cls = 'speed-opt';
      if (a) { if (o === q.term) cls += ' opt-correct'; else if (a.pick === i) cls += ' opt-wrong'; }
      return `<div class="opt-wrap"><button class="${cls}" onclick="WeakSpotsGame.answerOpt(${i})" ${a ? 'disabled' : ''}>${label(o)}</button>${favTermStar(topicIdOfTerm(o), o.id, 'opt-star')}</div>`;
    }).join('') + `</div>`;
  }

  function finish(ok, extra, chose) {
    const q = state.qs[state.idx];
    state.answered = Object.assign({ ok }, extra || {});
    if (ok) state.correct++;
    else state.mistakes.push({ lat: `${q.term.lat} (${q.topic.title})`, ru: q.term.ru, chose, tid: q.topicId, id: q.term.id });
    recordTermResult(q.topicId, q.term.id, ok, q.type);
    render();
  }

  function onPicClick(e) {
    if (!state || state.answered) return;
    const q = state.qs[state.idx];
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
    const res = cardClickCheck(q.topic, q.img, q.term.id, x, y);
    finish(res.ok, { x, y, targets: res.targets });
  }
  function answerOpt(i) {
    if (!state || state.answered) return;
    const q = state.qs[state.idx], o = q.options[i];
    finish(o === q.term, { pick: i }, q.type === 'base_rl' || q.type === 'legend' ? o.lat : o.ru);
  }
  function answerTF(said) {
    if (!state || state.answered) return;
    const q = state.qs[state.idx];
    finish(said === q.showCorrect, { pick: said }, said ? 'верно' : 'неверно');
  }
  function pick(uid) { const q = state.qs[state.idx]; if (!state.answered && !q.picked.includes(uid)) { q.picked.push(uid); render(); } }
  function unpick(uid) { const q = state.qs[state.idx]; if (!state.answered) { q.picked = q.picked.filter(x => x !== uid); render(); } }
  function checkBuilder() {
    const q = state.qs[state.idx];
    const got = q.picked.map(uid => q.pool.find(p => p.uid === uid).lat);
    finish(got.join(' ') === q.term.parts.map(p => p[0]).join(' '), {}, got.join(' '));
  }
  function next() { if (!state) return; state.idx++; state.answered = null; render(); window.scrollTo(0, 0); }

  return { render, reset, next, answerOpt, answerTF, pick, unpick, checkBuilder };
})();

/* ===================== ИЗБРАННОЕ ===================== */
/* Два вида: термин (topic::term) и вопрос (topic::term::тип задания).
   Звёзды обновляются на месте, без перерисовки экрана — поэтому не сбивают таймер в играх. */
const FAV_TYPE_LABEL = {
  picture: '🖱️ Найди на картинке', legend: '📋 Что под номером', truefalse: '✅ Верно / неверно',
  builder: '🧩 Собери термин', speed: '⚡ Выбери перевод', base_lr: '🔤 База: латынь → русский', base_rl: '🔤 База: русский → латынь',
};
let FAV_TAB = 'terms';
const FAV_Q_LABELS = {};   /* подпись вопроса на момент показа: «Найди: височная линия» */

function favData() {
  if (!PROGRESS.favorites) PROGRESS.favorites = { terms: {}, questions: {} };
  return PROGRESS.favorites;
}
const favTermKey = (topicId, termId) => topicId + '::' + termId;
const favQKey = (topicId, termId, type) => topicId + '::' + termId + '::' + type;
const isFavTerm = (topicId, termId) => !!favData().terms[favTermKey(topicId, termId)];
const isFavQ = (topicId, termId, type) => !!favData().questions[favQKey(topicId, termId, type)];

/* в каком разделе лежит термин (для вариантов ответа из других тем) */
let TERM_TOPIC = null;
function topicIdOfTerm(term) {
  if (!TERM_TOPIC) {
    TERM_TOPIC = new Map();
    CONTENT.sections.forEach(s => s.topics.forEach(t => t.terms.forEach(x => TERM_TOPIC.set(x, t.id))));
    BASE_WORDS.forEach(w => TERM_TOPIC.set(w, 'base'));
  }
  return TERM_TOPIC.get(term);
}

/* звёздочка термина (иконка) */
function favTermStar(topicId, termId, extraCls) {
  if (!topicId || !termId) return '';
  const on = isFavTerm(topicId, termId), key = 't|' + favTermKey(topicId, termId);
  return `<span role="button" tabindex="0" class="fav-star ${on ? 'on' : ''} ${extraCls || ''}" data-fav="${key}"
    title="${on ? 'Убрать термин из избранного' : 'Добавить термин в избранное'}"
    onclick="favToggle(event,'t','${topicId}','${termId}')"><span class="fav-ico">${on ? '★' : '☆'}</span></span>`;
}
/* плашки над вопросом: «☆ Вопрос» и (если в задании один термин) «☆ Термин» */
function favBar(topicId, termId, type, label, withTerm) {
  if (!topicId || !termId) return '';
  FAV_Q_LABELS[favQKey(topicId, termId, type)] = label;
  const q = isFavQ(topicId, termId, type), t = isFavTerm(topicId, termId);
  let html = `<div class="fav-bar">
      <span role="button" tabindex="0" class="fav-chip ${q ? 'on' : ''}" data-fav="q|${favQKey(topicId, termId, type)}"
        onclick="favToggle(event,'q','${topicId}','${termId}','${type}')"><span class="fav-ico">${q ? '★' : '☆'}</span> Вопрос</span>`;
  if (withTerm) html += `<span role="button" tabindex="0" class="fav-chip ${t ? 'on' : ''}" data-fav="t|${favTermKey(topicId, termId)}"
        onclick="favToggle(event,'t','${topicId}','${termId}')"><span class="fav-ico">${t ? '★' : '☆'}</span> Термин</span>`;
  return html + `</div>`;
}

function favToggle(ev, kind, topicId, termId, type) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const f = favData();
  let key, on;
  if (kind === 't') {
    key = favTermKey(topicId, termId); on = !f.terms[key];
    if (on) f.terms[key] = { t: Date.now() }; else delete f.terms[key];
  } else {
    key = favQKey(topicId, termId, type); on = !f.questions[key];
    if (on) f.questions[key] = { t: Date.now(), topicId, termId, type, label: FAV_Q_LABELS[key] || '' };
    else delete f.questions[key];
  }
  saveProgress();
  document.querySelectorAll(`[data-fav="${kind}|${key}"]`).forEach(el => {
    el.classList.toggle('on', on);
    const ico = el.querySelector('.fav-ico'); if (ico) ico.textContent = on ? '★' : '☆';
  });
  if (VIEW && VIEW.screen === 'favorites') renderFavorites();
}
/* клавиатура: Enter/пробел на звезде */
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('.fav-star,.fav-chip')) { e.preventDefault(); e.target.click(); }
});

function favLists() {
  const f = favData(), terms = [], questions = [];
  Object.keys(f.terms).forEach(k => {
    const [topicId, termId] = k.split('::'); const topic = findTopic(topicId);
    const term = topic && topic.terms.find(t => t.id === termId);
    if (term) terms.push({ topicId, termId, term, topic, t: f.terms[k].t });
  });
  Object.entries(f.questions).forEach(([k, q]) => {
    const topic = findTopic(q.topicId); const term = topic && topic.terms.find(t => t.id === q.termId);
    if (term) questions.push(Object.assign({ key: k, term, topic }, q));
  });
  return { terms, questions };
}
function favCount() { const l = favLists(); return l.terms.length + l.questions.length; }

/* подборка для «Повторить избранное»: вопросы — своим типом, термины — случайным подходящим типом */
function favPracticeItems() {
  const { terms, questions } = favLists(), items = [], seen = new Set();
  const add = (topicId, termId, term, mode) => {
    const k = topicId + '::' + termId + '::' + mode; if (seen.has(k)) return; seen.add(k);
    items.push({ topicId, termId, term, mode });
  };
  questions.forEach(q => add(q.topicId, q.termId, q.term, q.type));
  terms.forEach(x => {
    let modes;
    if (x.topicId === 'base') modes = ['base_lr', 'base_rl'];
    else {
      modes = ['speed', 'truefalse'];
      if (x.topic.images.some(im => im.hotspots.some(h => h.term === x.termId))) modes.push('picture', 'picture');
      if (x.term.parts && x.term.parts.length >= 2) modes.push('builder');
    }
    add(x.topicId, x.termId, x.term, modes[Math.floor(Math.random() * modes.length)]);
  });
  return shuffleArr(items).slice(0, 20);
}

/* ---------- экран «Избранное» ---------- */
function renderFavorites() {
  const { terms, questions } = favLists();
  let html = renderTopbar();
  html += backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>⭐ Избранное</h1><div class="hub-latin">Отмечай звёздочкой термины и вопросы — в справочнике, на интерактивной карте и прямо в упражнениях</div></div>`;
  html += `<div class="stats-wrap">
    <div class="base-groups st-filter">
      <button class="base-chip ${FAV_TAB === 'terms' ? 'on' : ''}" onclick="FAV_TAB='terms'; renderFavorites()">Термины · ${terms.length}</button>
      <button class="base-chip ${FAV_TAB === 'questions' ? 'on' : ''}" onclick="FAV_TAB='questions'; renderFavorites()">Вопросы · ${questions.length}</button>
    </div>`;
  if (terms.length + questions.length) {
    html += `<button class="btn btn-primary btn-block" style="margin:6px 0 4px" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'game', mode: 'weakspots', source: 'favorites' }))})'>▶ Повторить избранное</button>
      <div class="base-legend">Без таймера: вопросы — тем же типом задания, термины — вперемешку разными типами</div>`;
  }
  const list = FAV_TAB === 'terms' ? terms : questions;
  if (!list.length) {
    html += `<div class="coming-soon" style="margin-top:12px">${FAV_TAB === 'terms'
      ? 'Пока пусто. Нажми ☆ рядом с термином в справочнике, на интерактивной карте, в словарике базы или у варианта ответа в упражнении.'
      : 'Пока пусто. Нажми «☆ Вопрос» над заданием в любом упражнении — вопрос сохранится вместе с типом задания.'}</div>`;
  }
  const groups = [{ id: 'base', title: 'Основа', icon: '🔤', topics: [BASE_TOPIC] }].concat(CONTENT.sections);
  groups.forEach(sec => {
    let secHtml = '';
    sec.topics.forEach(topic => {
      const items = list.filter(x => x.topicId === topic.id);
      if (!items.length) return;
      const cards = topic.id === 'base' ? [] : topicCards(topic);
      secHtml += `<div class="fav-topic"><div class="fav-topic-title">${topic.title} <span class="st-pill">${items.length}</span></div>`;
      items.sort((a, b) => b.t - a.t).forEach(x => {
        const badges = cards.length ? termNumberBadges(topic, cards, x.termId) : '';
        const star = FAV_TAB === 'terms' ? favTermStar(x.topicId, x.termId)
          : `<span role="button" tabindex="0" class="fav-star on" data-fav="q|${x.key}" title="Убрать вопрос из избранного"
               onclick="favToggle(event,'q','${x.topicId}','${x.termId}','${x.type}')"><span class="fav-ico">★</span></span>`;
        secHtml += `<div class="st-row fav-row">
            <div class="tl-nums">${badges}</div>
            <div class="st-main">
              ${FAV_TAB === 'questions' ? `<div class="fav-q-type">${FAV_TYPE_LABEL[x.type] || x.type}${x.label ? ' · ' + escapeHtml(x.label) : ''}</div>` : ''}
              <div class="stats-lat">${x.term.lat}</div><div class="stats-ru">${x.term.ru}</div>
              <div class="st-err" style="color:var(--muted)">[${x.term.translit}]</div>
            </div>
            <div class="fav-row-star">${star}</div>
          </div>`;
      });
      secHtml += `</div>`;
    });
    if (secHtml) html += `<div class="st-sec-title">${sec.icon || ''} ${sec.title}</div>` + secHtml;
  });
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}

/* ===================== СООБЩИТЬ О ПРОБЛЕМЕ ===================== */
/* Отправить напрямую в Telegram страница не может (запросы на сторонние сайты заблокированы),
   поэтому: собираем текст с контекстом → копируем в буфер → открываем чат автора по ссылке.
   Скриншот пользователь прикрепляет уже в Telegram. */
const REPORT_TG = 'lo1ihanter';
const REPORT_TYPES = ['Неверный перевод', 'Точка не на той цифре', 'Опечатка / транскрипция', 'Ошибка в работе приложения', 'Другое'];
const REPORT_SCREENS = ['game', 'glossary', 'cardmap', 'baseList', 'examSetup'];
let REPORT_STATE = null;

/* что было на экране в момент нажатия — чтобы по сообщению сразу найти ошибку */
function reportContext() {
  const v = VIEW || {}, lines = [];
  const MODE_TITLES = { picture: 'Найди на картинке', legend: 'Составь легенду', truefalse: 'Верно / Неверно', builder: 'Собери термин',
    speed: 'Скоростной квиз', exam: 'Экзамен по темам', weakspots: 'Слабые места', base: 'База латыни' };
  const SCREEN_TITLES = { glossary: 'Справочник', cardmap: 'Интерактивная карта', baseList: 'Словарик базы', examSetup: 'Выбор тем экзамена' };
  const topic = v.topicId && findTopic(v.topicId);
  lines.push('Экран: ' + (v.screen === 'game' ? (MODE_TITLES[v.mode] || v.mode) : (SCREEN_TITLES[v.screen] || v.screen)));
  if (topic) lines.push('Кость: ' + topic.title);
  if (v.difficulty) lines.push('Уровень: ' + ({ easy: 'Лёгкая', medium: 'Средняя', hard: 'Врач', train: 'Тренировка', exam: 'Экзамен' }[v.difficulty] || v.difficulty));
  if (v.mode === 'base' && v.dir) lines.push('Направление: ' + (v.dir === 'lr' ? 'латынь → русский' : 'русский → латынь'));
  const txt = sel => { const el = document.querySelector('#app ' + sel); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const onScreen = [txt('.ws-tag'), txt('.exam-topic-tag'), txt('.prompt-ru'), txt('.prompt-lat'), txt('.sp-main'), txt('.sp-sub'),
    txt('.lg-prompt'), txt('.cm-info'), txt('.ws-tf-shown')].filter(Boolean);
  if (onScreen.length) lines.push('На экране: ' + [...new Set(onScreen)].join(' | ').slice(0, 300));
  if (v.screen === 'cardmap' && typeof CARDMAP_SEL !== 'undefined' && CARDMAP_SEL) lines.push('Выбран номер: ' + CARDMAP_SEL);
  lines.push('Устройство: ' + (/Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iOS' : 'компьютер') + ', ' + window.innerWidth + '×' + window.innerHeight);
  return lines.join('\n');
}

function openReport() {
  REPORT_STATE = { type: null, context: reportContext() };
  renderReportModal();
}
function closeReport() {
  REPORT_STATE = null;
  const m = document.getElementById('reportModal'); if (m) m.remove();
}
function reportText() {
  const d = document.getElementById('reportDesc');
  const desc = d ? d.value.trim() : '';
  return `🦴 АнатЭкзам — сообщение о проблеме\nТип: ${REPORT_STATE.type || 'не выбран'}\nЧто не так: ${desc || '—'}\n\n${REPORT_STATE.context}`;
}

function renderReportModal() {
  const old = document.getElementById('reportModal'), prevDesc = document.getElementById('reportDesc');
  const keepDesc = prevDesc ? prevDesc.value : '';
  if (old) old.remove();
  const st = REPORT_STATE;
  const wrap = document.createElement('div');
  wrap.id = 'reportModal';
  wrap.className = 'rp-overlay';
  wrap.innerHTML = `<div class="rp-box" role="dialog" aria-label="Сообщить о проблеме">
      <div class="rp-head"><b>⚑ Сообщить о проблеме</b><button class="rp-x" onclick="closeReport()" aria-label="Закрыть">✕</button></div>
      <div class="rp-label">Что случилось?</div>
      <div class="base-groups">${REPORT_TYPES.map(t =>
        `<button class="base-chip ${st.type === t ? 'on' : ''}" onclick="REPORT_STATE.type='${t}'; renderReportModal()">${t}</button>`).join('')}</div>
      <div class="rp-label">Опиши коротко</div>
      <textarea id="reportDesc" class="data-textarea rp-desc" placeholder="Например: у «fossa canina» точка стоит на цифре 9, а должна на 10"></textarea>
      <details class="rp-ctx"><summary>Что добавится автоматически</summary><pre>${escapeHtml(st.context)}</pre></details>
      <div class="rp-tip">📸 <b>Скриншот:</b> сделай его заранее и прикрепи в Telegram скрепкой 📎 после того, как откроется чат.</div>
      <a class="btn btn-primary btn-block rp-send" href="#" target="_blank" rel="noopener" onclick="return sendReport(this)">Отправить в Telegram @${REPORT_TG}</a>
      <div class="rp-fb" id="reportFb"></div>
    </div>`;
  wrap.addEventListener('click', e => { if (e.target === wrap) closeReport(); });
  document.body.appendChild(wrap);
  const ta = document.getElementById('reportDesc'); ta.value = keepDesc;
  if (!keepDesc) setTimeout(() => ta.focus(), 50);
}

function copyTextFallback(text) {
  const t = document.createElement('textarea');
  t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
  t.remove(); return ok;
}

/* копируем текст (для запасного варианта) и открываем чат; текст также передаётся в ссылке */
function sendReport(a) {
  const text = reportText();
  let copied = copyTextFallback(text);
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => {}, () => {}); } catch (e) {}
  a.href = `https://t.me/${REPORT_TG}?text=${encodeURIComponent(text.slice(0, 1500))}`;
  const fb = document.getElementById('reportFb');
  if (fb) fb.innerHTML = `Открываю чат с @${REPORT_TG}… ${copied ? 'Текст скопирован — если он не вставился сам, вставь его в сообщение.' : 'Если текст не вставился сам — скопируй его ниже.'}
    <br>Не открылся Telegram? Найди в нём <b>@${REPORT_TG}</b> и отправь текст:
    <textarea class="data-textarea rp-copy" readonly onclick="this.select()">${escapeHtml(text)}</textarea>`;
  return true;   /* ссылку открывает сам браузер */
}

/* кнопка ⚑: встраиваем в верхнюю панель нужных экранов, в том числе после перерисовок внутри игр */
function ensureReportButton() {
  if (!VIEW || !REPORT_SCREENS.includes(VIEW.screen)) return;
  const app = document.getElementById('app');
  if (!app || app.querySelector('.rp-btn')) return;
  const bar = app.querySelector('.game-topbar') || app.querySelector('.back-row');
  if (!bar) return;
  const b = document.createElement('button');
  b.className = 'rp-btn'; b.type = 'button'; b.title = 'Сообщить о проблеме'; b.textContent = '⚑';
  b.setAttribute('aria-label', 'Сообщить о проблеме');
  b.addEventListener('click', e => { e.stopPropagation(); openReport(); });
  bar.appendChild(b);
}
/* все экраны рисуются через #app.innerHTML — встраиваемся прямо в эту запись (синхронно, без наблюдателя,
   чтобы не накапливать старые экраны в памяти) */
(function hookAppRender() {
  const app = document.getElementById('app');
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!app || !desc || !desc.set) return;
  Object.defineProperty(app, 'innerHTML', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); try { ensureReportButton(); } catch (e) {} },
  });
})();

/* ===================== РЕЖИМ РЕДАКТОРА ===================== */
/* Включается профилем «#редактор». Правки (точки и тексты терминов) применяются только в этом браузере
   и копятся как «патч» — список отличий от оригинала. Кнопка «Выгрузить» даёт код для автора приложения. */
const EDITOR_NAME = '#редактор';
const EDITOR_PATCH_KEY = 'anatoQuestEditorPatch_v1';
const isEditor = () => ((getActiveProfile() || '').trim().toLowerCase() === EDITOR_NAME);

function edLoadPatch() {
  try { const p = JSON.parse(localStorage.getItem(EDITOR_PATCH_KEY) || 'null'); if (p && p.v === 1) return p; } catch (e) {}
  return { v: 1, points: {}, terms: {} };
}
let ED_PATCH = edLoadPatch();
function edSave() { try { localStorage.setItem(EDITOR_PATCH_KEY, JSON.stringify(ED_PATCH)); } catch (e) {} edUpdatePill(); }
const edCount = () => Object.keys(ED_PATCH.points).length + Object.keys(ED_PATCH.terms).length;

/* применяем сохранённые правки к данным при запуске (только для профиля редактора) */
(function applyEditorPatch() {
  if (!isEditor()) return;
  Object.entries(ED_PATCH.points).forEach(([k, p]) => {
    const [tid, imgId, idx] = k.split('|'); const t = findTopic(tid);
    const img = t && t.images.find(i => i.id === imgId); const h = img && img.hotspots[+idx];
    if (h && h.n === p.n && h.term === p.term) { h.x = p.x; h.y = p.y; }
  });
  Object.entries(ED_PATCH.terms).forEach(([k, p]) => {
    const [tid, termId] = k.split('::'); const t = findTopic(tid);
    const term = t && t.terms.find(x => x.id === termId);
    if (term) ['lat', 'ru', 'translit'].forEach(f => { if (p[f] !== undefined) term[f] = p[f]; });
  });
})();

/* ---------- точки: перетаскивание на интерактивной карте ---------- */
function edHotspotRef(topic, h) {
  for (const img of topic.images) { const i = img.hotspots.indexOf(h); if (i >= 0) return { img, idx: i }; }
  return null;
}
function edHandlesHtml(topic, card, box) {
  if (!isEditor()) return '';
  return card.hotspots.map((h, k) => {
    const moved = (() => { const r = edHotspotRef(topic, h); return r && ED_PATCH.points[`${topic.id}|${r.img.id}|${r.idx}`]; })();
    return `<span class="ed-handle ${moved ? 'moved' : ''}" data-k="${k}" data-n="${h.n}" title="№${h.n} — перетащи на место" style="left:${((h.x - box.x) / box.w * 100).toFixed(2)}%;top:${((h.y - box.y) / box.h * 100).toFixed(2)}%"></span>`;
  }).join('');
}
let ED_DRAGGED = false;
function edBindHandles(topic, card, box) {
  if (!isEditor()) return;
  const pic = document.getElementById('cmPic'); if (!pic) return;
  pic.querySelectorAll('.ed-handle').forEach(el => {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const h = card.hotspots[+el.dataset.k];
      const r0 = pic.getBoundingClientRect(); let moved = false;
      el.setPointerCapture(e.pointerId); el.classList.add('drag');
      const pos = ev => {
        const r = pic.getBoundingClientRect();
        return { fx: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), fy: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) };
      };
      const onMove = ev => {
        const p = pos(ev);
        if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
        moved = true; el.style.left = p.fx * 100 + '%'; el.style.top = p.fy * 100 + '%';
      };
      const onUp = ev => {
        el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.classList.remove('drag');
        if (!moved) { cardMapSelect(h.n, false); return; }      /* простое нажатие — выбрать цифру */
        ED_DRAGGED = true; setTimeout(() => { ED_DRAGGED = false; }, 50);
        const p = pos(ev);
        const nx = Math.round((box.x + p.fx * box.w) * 10) / 10, ny = Math.round((box.y + p.fy * box.h) * 10) / 10;
        const ref = edHotspotRef(topic, h); if (!ref) return;
        const key = `${topic.id}|${ref.img.id}|${ref.idx}`;
        const prev = ED_PATCH.points[key];
        ED_PATCH.points[key] = { n: h.n, term: h.term, x: nx, y: ny, ox: prev ? prev.ox : h.x, oy: prev ? prev.oy : h.y };
        h.x = nx; h.y = ny;
        edSave();
        CARDMAP_SEL = h.n;
        cardMapRerender();
      };
      el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp);
    });
  });
}

/* ---------- термины: латынь, перевод, транскрипция ---------- */
function edTermBtn(topicId, termId) {
  if (!isEditor()) return '';
  const on = !!ED_PATCH.terms[topicId + '::' + termId];
  return `<span role="button" class="ed-term-btn ${on ? 'on' : ''}" title="Изменить термин" onclick="event.stopPropagation(); edOpenTerm('${topicId}','${termId}')">✏️</span>`;
}
function edOpenTerm(topicId, termId) {
  const t = findTopic(topicId), term = t && t.terms.find(x => x.id === termId); if (!term) return;
  const old = document.getElementById('edModal'); if (old) old.remove();
  const w = document.createElement('div'); w.id = 'edModal'; w.className = 'rp-overlay';
  w.innerHTML = `<div class="rp-box"><div class="rp-head"><b>✏️ Термин · ${escapeHtml(t.title)}</b><button class="rp-x" onclick="edClose()">✕</button></div>
      <div class="rp-label">Латынь</div><input class="ed-input" id="edLat" value="${escapeHtml(term.lat)}">
      <div class="rp-label">Перевод</div><input class="ed-input" id="edRu" value="${escapeHtml(term.ru)}">
      <div class="rp-label">Транскрипция <button class="ed-accent" onclick="edInsertAccent()" title="Поставить ударение после курсора">+ ударение ́</button></div>
      <input class="ed-input" id="edTr" value="${escapeHtml(term.translit || '')}">
      <div class="base-legend" style="margin-top:8px">Ударение: поставь курсор сразу после ударной гласной и нажми «+ ударение».</div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="edSaveTerm('${topicId}','${termId}')">Сохранить</button>
    </div>`;
  w.addEventListener('click', e => { if (e.target === w) edClose(); });
  document.body.appendChild(w);
}
function edInsertAccent() {
  const inp = document.getElementById('edTr'); if (!inp) return;
  const p = inp.selectionStart ?? inp.value.length;
  inp.value = inp.value.slice(0, p) + '\u0301' + inp.value.slice(p);
  inp.focus(); inp.setSelectionRange(p + 1, p + 1);
}
function edClose() { const m = document.getElementById('edModal'); if (m) m.remove(); }
function edSaveTerm(topicId, termId) {
  const t = findTopic(topicId), term = t.terms.find(x => x.id === termId);
  const val = id => document.getElementById(id).value.trim();
  const nv = { lat: val('edLat'), ru: val('edRu'), translit: val('edTr') };
  if (!nv.lat || !nv.ru) { alertInModal('Латынь и перевод не могут быть пустыми'); return; }
  const key = topicId + '::' + termId, prev = ED_PATCH.terms[key];
  const orig = prev ? prev.o : { lat: term.lat, ru: term.ru, translit: term.translit || '' };
  if (nv.lat === orig.lat && nv.ru === orig.ru && nv.translit === orig.translit) delete ED_PATCH.terms[key];
  else ED_PATCH.terms[key] = Object.assign({}, nv, { o: orig });
  Object.assign(term, nv);
  edSave(); edClose();
  const y = window.scrollY; render(); window.scrollTo(0, y);
}
function alertInModal(msg) {
  const box = document.querySelector('#edModal .rp-box'); if (!box) return;
  let n = box.querySelector('.ed-warn'); if (!n) { n = document.createElement('div'); n.className = 'ed-warn'; box.appendChild(n); }
  n.textContent = msg;
}

/* ---------- плашка редактора и выгрузка правок ---------- */
function edUpdatePill() {
  let pill = document.getElementById('edPill');
  if (!isEditor()) { if (pill) pill.remove(); return; }
  if (!pill) {
    pill = document.createElement('button'); pill.id = 'edPill'; pill.className = 'ed-pill';
    pill.addEventListener('click', edOpenPanel); document.body.appendChild(pill);
  }
  const n = edCount();
  pill.textContent = `✏️ Редактор · правок: ${n}`;
}
function edPatchCode() {
  return 'AE1:' + btoa(unescape(encodeURIComponent(JSON.stringify(ED_PATCH))));
}
function edOpenPanel() {
  const old = document.getElementById('edModal'); if (old) old.remove();
  const pts = Object.entries(ED_PATCH.points), trs = Object.entries(ED_PATCH.terms);
  const code = edPatchCode();
  const list = pts.map(([k, p]) => { const [tid, img] = k.split('|'); const t = findTopic(tid);
      return `<li>📍 ${t ? t.title : tid} · ${img} · №${p.n}: (${p.ox}, ${p.oy}) → (${p.x}, ${p.y})</li>`; }).join('')
    + trs.map(([k, p]) => { const [tid] = k.split('::'); const t = findTopic(tid);
      const diff = ['lat', 'ru', 'translit'].filter(f => p[f] !== p.o[f]).map(f => `${escapeHtml(p.o[f] || '—')} → <b>${escapeHtml(p[f] || '—')}</b>`).join('; ');
      return `<li>✏️ ${t ? t.title : tid}: ${diff}</li>`; }).join('');
  const w = document.createElement('div'); w.id = 'edModal'; w.className = 'rp-overlay';
  w.innerHTML = `<div class="rp-box"><div class="rp-head"><b>✏️ Режим редактора</b><button class="rp-x" onclick="edClose()">✕</button></div>
      <div class="ed-help">Точки: открой справочник → «Интерактивная карта» и перетащи синее кольцо так, чтобы напечатанная цифра была в его центре (для точности увеличь карточку кнопкой «+»). Термины: кнопка ✏️ у термина в справочнике или на карте.
      Правки видны только в этом браузере. Когда закончишь — выгрузи код и отправь автору.</div>
      <div class="rp-label">Правки (${edCount()})</div>
      ${edCount() ? `<ul class="ed-list">${list}</ul>` : '<div class="base-legend">Пока правок нет.</div>'}
      ${edCount() ? `<div class="rp-label">Код правок</div>
        <textarea class="data-textarea rp-copy" id="edCode" readonly onclick="this.select()">${code}</textarea>
        <button class="btn btn-primary btn-block" style="margin-top:8px" onclick="edCopyCode()">📋 Скопировать код</button>
        <a class="btn btn-ghost btn-block rp-send" style="margin-top:8px" href="https://t.me/${REPORT_TG}?text=${encodeURIComponent(code.length < 1400 ? 'Правки редактора АнатЭкзам:\n' + code : 'Правки редактора АнатЭкзам (код длинный — вставлю следующим сообщением)')}" target="_blank" rel="noopener" onclick="edCopyCode()">Отправить в Telegram @${REPORT_TG}</a>
        <div class="rp-fb" id="edFb"></div>
        <div id="edResetBox"><button class="btn btn-ghost btn-block" style="margin-top:14px;color:var(--red)" onclick="edAskReset()">Сбросить все правки</button></div>` : ''}
    </div>`;
  w.addEventListener('click', e => { if (e.target === w) edClose(); });
  document.body.appendChild(w);
}
function edCopyCode() {
  const code = edPatchCode(), ok = copyTextFallback(code);
  try { navigator.clipboard && navigator.clipboard.writeText(code).then(() => {}, () => {}); } catch (e) {}
  const fb = document.getElementById('edFb'); if (fb) fb.textContent = ok ? 'Код скопирован — вставь его в сообщение автору.' : 'Выдели код выше и скопируй вручную.';
}
function edAskReset() {
  const b = document.getElementById('edResetBox'); if (!b) return;
  b.innerHTML = `<div class="data-confirm" style="margin-top:12px">Сбросить все правки и вернуть оригинал? Код правок пропадёт.
    <div class="data-confirm-btns"><button class="btn btn-danger" onclick="edReset()">Сбросить</button><button class="btn btn-ghost" onclick="edOpenPanel()">Отмена</button></div></div>`;
}
function edReset() {
  ED_PATCH = { v: 1, points: {}, terms: {} };
  try { localStorage.removeItem(EDITOR_PATCH_KEY); } catch (e) {}
  location.reload();
}
edUpdatePill();

/* ===================== РЕЖИМ: ПЕРЕЧИСЛИ ВСЕ ===================== */
/* Задание «перечисли все …». Ответ засчитывается по-русски, по-латыни и латынью кириллицей
   (os sphenoidale = ос сфеноидале = клиновидная кость), прощаются опечатки и порядок слов.
   Новый список = одна запись в RECALL_TASKS. lvl: 'ext' — только в расширенном уровне. */
const RECALL_TASKS = [
  { id: 'skull_bones', title: 'Кости черепа', emoji: '💀',
    desc: 'Мозговой и лицевой отделы — назови каждую кость',
    note: 'Парные кости достаточно назвать один раз.',
    items: [
      { ru: ['лобная кость'], lat: ['os frontale'], g: 'Мозговой отдел' },
      { ru: ['теменная кость'], lat: ['os parietale'], g: 'Мозговой отдел', pair: 1 },
      { ru: ['затылочная кость'], lat: ['os occipitale'], g: 'Мозговой отдел' },
      { ru: ['клиновидная кость', 'основная кость'], lat: ['os sphenoidale'], g: 'Мозговой отдел' },
      { ru: ['височная кость'], lat: ['os temporale'], g: 'Мозговой отдел', pair: 1 },
      { ru: ['решётчатая кость'], lat: ['os ethmoidale'], g: 'Мозговой отдел' },
      { ru: ['верхняя челюсть'], lat: ['maxilla'], g: 'Лицевой отдел', pair: 1 },
      { ru: ['нижняя челюсть'], lat: ['mandibula'], g: 'Лицевой отдел' },
      { ru: ['нёбная кость'], lat: ['os palatinum'], g: 'Лицевой отдел', pair: 1 },
      { ru: ['скуловая кость'], lat: ['os zygomaticum'], g: 'Лицевой отдел', pair: 1 },
      { ru: ['носовая кость'], lat: ['os nasale'], g: 'Лицевой отдел', pair: 1 },
      { ru: ['слёзная кость'], lat: ['os lacrimale'], g: 'Лицевой отдел', pair: 1 },
      { ru: ['нижняя носовая раковина'], lat: ['concha nasalis inferior'], g: 'Лицевой отдел', pair: 1 },
      { ru: ['сошник'], lat: ['vomer'], g: 'Лицевой отдел' },
      { ru: ['подъязычная кость'], lat: ['os hyoideum'], g: 'Лицевой отдел' },
    ] },
  { id: 'skull_foramina', title: 'Отверстия черепа', emoji: '🕳️',
    desc: 'Отверстия, каналы и щели — от большого затылочного до подбородочного',
    note: 'Слово «отверстие» / foramen можно не писать.',
    levels: [
      { id: 'base', title: 'Основные', desc: 'Главные отверстия, как на тесте' },
      { id: 'ext', title: 'Расширенный', desc: 'Плюс каналы, щели и мелкие отверстия' },
    ],
    items: [
      { ru: ['большое затылочное отверстие', 'большое отверстие'], lat: ['foramen magnum'], g: 'Основание черепа' },
      { ru: ['овальное отверстие'], lat: ['foramen ovale'], g: 'Основание черепа' },
      { ru: ['круглое отверстие'], lat: ['foramen rotundum'], g: 'Основание черепа' },
      { ru: ['остистое отверстие'], lat: ['foramen spinosum'], g: 'Основание черепа' },
      { ru: ['рваное отверстие'], lat: ['foramen lacerum'], g: 'Основание черепа' },
      { ru: ['яремное отверстие'], lat: ['foramen jugulare'], g: 'Основание черепа' },
      { ru: ['канал подъязычного нерва', 'подъязычный канал'], lat: ['canalis nervi hypoglossi', 'canalis hypoglossi'], g: 'Основание черепа' },
      { ru: ['сонный канал'], lat: ['canalis caroticus'], g: 'Основание черепа' },
      { ru: ['внутреннее слуховое отверстие'], lat: ['porus acusticus internus'], g: 'Основание черепа' },
      { ru: ['шилососцевидное отверстие'], lat: ['foramen stylomastoideum'], g: 'Основание черепа' },
      { ru: ['слепое отверстие'], lat: ['foramen caecum'], g: 'Основание черепа' },
      { ru: ['отверстия решётчатой пластинки', 'решётчатая пластинка', 'решётчатые отверстия'], lat: ['foramina cribrosa', 'lamina cribrosa'], g: 'Основание черепа' },
      { ru: ['зрительный канал'], lat: ['canalis opticus'], g: 'Глазница и лицо' },
      { ru: ['верхняя глазничная щель'], lat: ['fissura orbitalis superior'], g: 'Глазница и лицо' },
      { ru: ['нижняя глазничная щель'], lat: ['fissura orbitalis inferior'], g: 'Глазница и лицо' },
      { ru: ['вход в глазницу', 'глазничное отверстие'], lat: ['aditus orbitae'], g: 'Глазница и лицо' },
      { ru: ['надглазничное отверстие', 'надглазничная вырезка'], lat: ['foramen supraorbitale', 'incisura supraorbitalis'], g: 'Глазница и лицо' },
      { ru: ['подглазничное отверстие'], lat: ['foramen infraorbitale'], g: 'Глазница и лицо' },
      { ru: ['грушевидная апертура', 'грушевидное отверстие'], lat: ['apertura piriformis'], g: 'Глазница и лицо' },
      { ru: ['подбородочное отверстие'], lat: ['foramen mentale'], g: 'Глазница и лицо' },
      { ru: ['наружное слуховое отверстие'], lat: ['porus acusticus externus'], g: 'Глазница и лицо' },
      { ru: ['отверстие нижней челюсти', 'нижнечелюстное отверстие'], lat: ['foramen mandibulae'], g: 'Глазница и лицо' },
      { ru: ['сосцевидное отверстие'], lat: ['foramen mastoideum'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['теменное отверстие'], lat: ['foramen parietale'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['мыщелковый канал'], lat: ['canalis condylaris'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['крыловидный канал'], lat: ['canalis pterygoideus'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['переднее решётчатое отверстие'], lat: ['foramen ethmoidale anterius'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['заднее решётчатое отверстие'], lat: ['foramen ethmoidale posterius'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['резцовый канал', 'резцовое отверстие'], lat: ['canalis incisivus', 'foramen incisivum'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['большое нёбное отверстие'], lat: ['foramen palatinum majus'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['малые нёбные отверстия', 'малое нёбное отверстие'], lat: ['foramina palatina minora'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['клиновидно-нёбное отверстие'], lat: ['foramen sphenopalatinum'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['носослёзный канал'], lat: ['canalis nasolacrimalis'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['хоаны'], lat: ['choanae'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['мышечно-трубный канал'], lat: ['canalis musculotubarius'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['канал лицевого нерва', 'лицевой канал'], lat: ['canalis facialis', 'canalis nervi facialis'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['скулоглазничное отверстие'], lat: ['foramen zygomaticoorbitale'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['скулолицевое отверстие'], lat: ['foramen zygomaticofaciale'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
      { ru: ['скуловисочное отверстие'], lat: ['foramen zygomaticotemporale'], g: 'Мелкие отверстия и каналы', lvl: 'ext' },
    ] },
  { id: 'carpus', title: 'Кости запястья', emoji: '✋',
    desc: '8 костей в два ряда — мнемоника есть в справочнике кисти',
    items: [
      { ru: ['ладьевидная кость'], lat: ['os scaphoideum'], g: 'Проксимальный ряд' },
      { ru: ['полулунная кость'], lat: ['os lunatum'], g: 'Проксимальный ряд' },
      { ru: ['трёхгранная кость'], lat: ['os triquetrum'], g: 'Проксимальный ряд' },
      { ru: ['гороховидная кость'], lat: ['os pisiforme'], g: 'Проксимальный ряд' },
      { ru: ['кость-трапеция', 'трапеция'], lat: ['os trapezium'], g: 'Дистальный ряд' },
      { ru: ['трапециевидная кость'], lat: ['os trapezoideum'], g: 'Дистальный ряд' },
      { ru: ['головчатая кость'], lat: ['os capitatum'], g: 'Дистальный ряд' },
      { ru: ['крючковидная кость'], lat: ['os hamatum'], g: 'Дистальный ряд' },
    ] },
  { id: 'upperlimb', title: 'Кости верхней конечности', emoji: '💪',
    desc: 'Пояс и свободная часть: от лопатки до фаланг',
    items: [
      { ru: ['лопатка'], lat: ['scapula'], g: 'Пояс верхней конечности' },
      { ru: ['ключица'], lat: ['clavicula'], g: 'Пояс верхней конечности' },
      { ru: ['плечевая кость'], lat: ['humerus', 'os humeri'], g: 'Свободная часть' },
      { ru: ['локтевая кость'], lat: ['ulna'], g: 'Свободная часть' },
      { ru: ['лучевая кость'], lat: ['radius'], g: 'Свободная часть' },
      { ru: ['кости запястья', 'запястье'], lat: ['ossa carpi', 'carpus'], g: 'Свободная часть' },
      { ru: ['пястные кости', 'пясть'], lat: ['ossa metacarpi', 'metacarpus'], g: 'Свободная часть' },
      { ru: ['фаланги пальцев', 'фаланги'], lat: ['phalanges'], g: 'Свободная часть' },
      { ru: ['сесамовидные кости'], lat: ['ossa sesamoidea'], g: 'Свободная часть' },
    ] },
  { id: 'tarsus', title: 'Кости предплюсны', emoji: '🦶',
    desc: '7 костей в два ряда',
    items: [
      { ru: ['таранная кость'], lat: ['talus'], g: 'Проксимальный ряд' },
      { ru: ['пяточная кость'], lat: ['calcaneus'], g: 'Проксимальный ряд' },
      { ru: ['ладьевидная кость'], lat: ['os naviculare'], g: 'Дистальный ряд' },
      { ru: ['медиальная клиновидная кость'], lat: ['os cuneiforme mediale'], g: 'Дистальный ряд' },
      { ru: ['промежуточная клиновидная кость'], lat: ['os cuneiforme intermedium'], g: 'Дистальный ряд' },
      { ru: ['латеральная клиновидная кость'], lat: ['os cuneiforme laterale'], g: 'Дистальный ряд' },
      { ru: ['кубовидная кость'], lat: ['os cuboideum'], g: 'Дистальный ряд' },
    ] },
  { id: 'lowerlimb', title: 'Кости нижней конечности', emoji: '🦵',
    desc: 'Пояс и свободная часть: от тазовой кости до фаланг',
    items: [
      { ru: ['тазовая кость'], lat: ['os coxae'], g: 'Пояс нижней конечности' },
      { ru: ['подвздошная кость'], lat: ['os ilium'], g: 'Пояс нижней конечности' },
      { ru: ['лобковая кость'], lat: ['os pubis'], g: 'Пояс нижней конечности' },
      { ru: ['седалищная кость'], lat: ['os ischii'], g: 'Пояс нижней конечности' },
      { ru: ['бедренная кость'], lat: ['femur', 'os femoris'], g: 'Свободная часть' },
      { ru: ['надколенник'], lat: ['patella'], g: 'Свободная часть' },
      { ru: ['большеберцовая кость'], lat: ['tibia'], g: 'Свободная часть' },
      { ru: ['малоберцовая кость'], lat: ['fibula'], g: 'Свободная часть' },
      { ru: ['кости предплюсны', 'предплюсна'], lat: ['ossa tarsi', 'tarsus'], g: 'Свободная часть' },
      { ru: ['плюсневые кости', 'плюсна'], lat: ['ossa metatarsi', 'metatarsus'], g: 'Свободная часть' },
      { ru: ['фаланги пальцев', 'фаланги'], lat: ['phalanges'], g: 'Свободная часть' },
    ] },
  { id: 'sutures', title: 'Швы черепа', emoji: '🧵',
    desc: 'Швы свода и с карточек черепа в целом',
    note: 'Слово «шов» / sutura можно не писать.',
    items: [
      { ru: ['венечный шов'], lat: ['sutura coronalis'], g: 'Свод' },
      { ru: ['сагиттальный шов', 'стреловидный шов'], lat: ['sutura sagittalis'], g: 'Свод' },
      { ru: ['ламбдовидный шов'], lat: ['sutura lambdoidea'], g: 'Свод' },
      { ru: ['чешуйчатый шов'], lat: ['sutura squamosa'], g: 'Свод' },
      { ru: ['лобно-носовой шов', 'носолобный шов'], lat: ['sutura frontonasalis'], g: 'Лицо и глазница' },
      { ru: ['лобно-верхнечелюстной шов'], lat: ['sutura frontomaxillaris'], g: 'Лицо и глазница' },
      { ru: ['скуло-верхнечелюстной шов'], lat: ['sutura zygomaticomaxillaris'], g: 'Лицо и глазница' },
      { ru: ['решётчато-слёзный шов'], lat: ['sutura ethmoidolacrimalis'], g: 'Лицо и глазница' },
      { ru: ['клиновидно-скуловой шов'], lat: ['sutura sphenozygomatica'], g: 'Лицо и глазница' },
      { ru: ['клиновидно-чешуйчатый шов'], lat: ['sutura sphenosquamosa'], g: 'Основание' },
      { ru: ['клиновидно-лобный шов'], lat: ['sutura sphenofrontalis'], g: 'Основание' },
      { ru: ['срединный нёбный шов'], lat: ['sutura palatina mediana'], g: 'Основание' },
      { ru: ['поперечный нёбный шов'], lat: ['sutura palatina transversa'], g: 'Основание' },
    ] },
  { id: 'pterygopalatine', title: 'Отверстия крыловидно-нёбной ямки', emoji: '🔎',
    desc: 'Пять отверстий в стенках ямки (карточка 42)',
    items: [
      { ru: ['клиновидно-нёбное отверстие'], lat: ['foramen sphenopalatinum'] },
      { ru: ['круглое отверстие'], lat: ['foramen rotundum'] },
      { ru: ['крыловидный канал'], lat: ['canalis pterygoideus'] },
      { ru: ['нижняя глазничная щель'], lat: ['fissura orbitalis inferior'] },
      { ru: ['большой нёбный канал'], lat: ['canalis palatinus major'] },
    ] },
];

/* латынь → кириллица (как читают на занятиях): sphenoidale → сфеноидале */
function recallLatToCyr(s) {
  s = s.toLowerCase();
  const V = 'aeiouy';
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1] || '', n2 = s[i + 2] || '', p = s[i - 1] || '';
    const two = c + n;
    if (two === 'ph') { out += 'ф'; i++; continue; }
    if (two === 'th') { out += 'т'; i++; continue; }
    if (two === 'ch') { out += 'х'; i++; continue; }
    if (two === 'rh') { out += 'р'; i++; continue; }
    if (two === 'qu') { out += 'кв'; i++; continue; }
    if (two === 'ae' || two === 'oe') { out += 'е'; i++; continue; }
    if (c === 't' && n === 'i' && V.includes(n2) && n2) { out += 'ц'; continue; }
    if (c === 'c') { out += ((n && 'eiy'.includes(n)) || ((n === 'a' || n === 'o') && n2 === 'e')) ? 'ц' : 'к'; continue; }
    if (c === 's' && V.includes(p) && V.includes(n) && p && n) { out += 'з'; continue; }
    if (c === 'j') { out += 'й'; continue; }
    const m = { a:'а', b:'б', d:'д', e:'е', f:'ф', g:'г', h:'г', i:'и', k:'к', l:'л', m:'м', n:'н', o:'о', p:'п', q:'к', r:'р', s:'с', t:'т', u:'у', v:'в', w:'в', x:'кс', y:'и', z:'з' };
    out += m[c] !== undefined ? m[c] : c;
  }
  return out;
}

const RECALL_SKIP = new Set(['кость', 'кости', 'os', 'ос', 'отверстие', 'отверстия', 'foramen', 'foramina', 'форамен', 'форамина', 'шов', 'sutura', 'сутура']);
function recallNorm(s) {
  s = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  s = s.replace(/[0-9]/g, '').replace(/ё/g, 'е');
  s = s.replace(/[-–—,.;:()«»"'!?\/]/g, ' ');
  /* кириллицу упрощаем: «югуляре» и «югуларе», «нёбная» и «небная» — одно и то же */
  const words = s.split(/\s+/).filter(w => w && !RECALL_SKIP.has(w))
    .map(w => w.replace(/я/g, 'а').replace(/ю/g, 'у').replace(/э/g, 'е').replace(/й/g, 'и').replace(/[ьъ]/g, '').replace(/ы/g, 'и'));
  return words.sort().join(' ');
}
function recallVariants(item) {
  if (item._v) return item._v;
  const raw = [].concat(item.ru, item.lat, item.lat.map(recallLatToCyr));
  item._v = Array.from(new Set(raw.map(recallNorm).filter(Boolean)));
  return item._v;
}
function recallDist(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const d = []; for (let i = 0; i <= a.length; i++) d.push([i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[a.length][b.length];
}
function recallTol(len) { return len <= 4 ? 0 : len <= 7 ? 1 : len <= 15 ? 2 : 3; }
/* лучший кандидат: сначала точное совпадение, затем ближайшее в пределах допуска */
function recallMatch(items, text) {
  const q = recallNorm(text);
  if (!q) return null;
  let best = null, bestD = 99;
  items.forEach((it, idx) => {
    recallVariants(it).forEach(v => {
      const d = v === q ? 0 : recallDist(v, q);
      if (d <= recallTol(v.length) && d < bestD) { best = idx; bestD = d; }
    });
  });
  return best;
}

const RECALL_KEY = 'anatoQuestRecall_v1';
function recallBest(key) {
  try { return (JSON.parse(localStorage.getItem(RECALL_KEY) || '{}')[(getActiveProfile() || '') + '::' + key]) || 0; } catch (e) { return 0; }
}
function recallSaveBest(key, pct) {
  try {
    const all = JSON.parse(localStorage.getItem(RECALL_KEY) || '{}');
    const k = (getActiveProfile() || '') + '::' + key;
    if (!all[k] || pct > all[k]) { all[k] = pct; localStorage.setItem(RECALL_KEY, JSON.stringify(all)); }
  } catch (e) {}
}

let RECALL = null;

function renderRecallSetup() {
  let html = renderTopbar();
  html += backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>📝 Перечисли все</h1>
    <div class="hub-latin">Как письменный тест: вспомни весь список сам, без вариантов ответа. Можно по-русски, по-латыни или латынью русскими буквами.</div></div>
    <div class="mode-grid">`;
  RECALL_TASKS.forEach(t => {
    const lv = t.levels || [{ id: 'all', title: '', desc: '' }];
    lv.forEach(l => {
      const key = t.id + ':' + l.id;
      const n = t.items.filter(i => l.id === 'ext' || l.id === 'all' || i.lvl !== 'ext').length;
      const best = recallBest(key);
      html += `
      <div class="mode-card" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'recall', task: t.id, level: l.id }))})'>
        <div class="mode-emoji">${t.emoji}</div>
        <div class="mode-body">
          <div class="mode-title">${t.title}${l.title ? ' — ' + l.title.toLowerCase() : ''}</div>
          <div class="mode-desc">${l.desc || t.desc} · ${n} шт.</div>
        </div>
        <div class="mode-stars">${best ? 'лучший: ' + best + '%' : ''}</div>
      </div>`;
    });
  });
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}

function recallStart(taskId, level) {
  const t = RECALL_TASKS.find(x => x.id === taskId) || RECALL_TASKS[0];
  const items = t.items.filter(i => level === 'ext' || level === 'all' || !level || i.lvl !== 'ext');
  RECALL = { task: t, level: level || 'all', items, found: [], log: [], done: false, key: t.id + ':' + (level || 'all') };
}

function renderRecall() {
  if (!RECALL || RECALL.task.id !== VIEW.task || RECALL.level !== (VIEW.level || 'all')) recallStart(VIEW.task, VIEW.level);
  const R = RECALL;
  let html = renderTopbar();
  html += `<div class="game-topbar">
      <button class="exit-x" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'recallSetup' }))})'>✕</button>
      <div class="game-progress-bar"><div class="game-progress-fill" id="rcBar" style="width:${Math.round(R.found.length / R.items.length * 100)}%"></div></div>
      <div class="rc-count" id="rcCount">${R.found.length} / ${R.items.length}</div>
    </div>
    <div class="game-body">
      <div class="pic-prompt"><div class="prompt-ru">Перечисли: ${R.task.title.toLowerCase()}</div>
      <div class="prompt-lat">${R.task.note || ''}</div></div>`;
  if (!R.done) {
    html += `
      <form class="rc-form" onsubmit="event.preventDefault(); recallSubmit();">
        <input id="rcInput" class="ed-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Например: клиновидная / os sphenoidale / ос сфеноидале">
        <button class="btn btn-primary" type="submit">↵</button>
      </form>
      <div class="rc-msg" id="rcMsg">&nbsp;</div>
      <div class="rc-list" id="rcList">${recallFoundHtml()}</div>
      <button class="btn btn-ghost btn-block rc-finish" onclick="recallFinish()">Закончить и посмотреть, что пропустил</button>`;
  } else {
    html += recallResultHtml();
  }
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
  const inp = document.getElementById('rcInput');
  if (inp) inp.focus();
}

function recallFoundHtml() {
  const R = RECALL;
  if (!R.found.length) return `<div class="rc-empty">Пиши по одному названию и жми Enter. Порядок любой.</div>`;
  return R.found.slice().reverse().map(idx => {
    const it = R.items[idx];
    return `<div class="rc-chip"><b>${escapeHtml(it.ru[0])}</b> <i>${escapeHtml(it.lat[0])}</i></div>`;
  }).join('');
}

function recallSubmit() {
  const R = RECALL, inp = document.getElementById('rcInput'), msg = document.getElementById('rcMsg');
  const text = inp.value.trim();
  if (!text) return;
  const idx = recallMatch(R.items, text);
  if (idx === null) {
    msg.className = 'rc-msg bad'; msg.textContent = `«${text}» — такого в списке нет`;
    R.log.push({ text, ok: false });
  } else if (R.found.includes(idx)) {
    msg.className = 'rc-msg rep'; msg.textContent = `Уже было: ${R.items[idx].ru[0]}`;
  } else {
    R.found.push(idx);
    msg.className = 'rc-msg ok'; msg.textContent = `✓ ${R.items[idx].ru[0]} — ${R.items[idx].lat[0]}`;
    document.getElementById('rcList').innerHTML = recallFoundHtml();
    document.getElementById('rcCount').textContent = R.found.length + ' / ' + R.items.length;
    document.getElementById('rcBar').style.width = Math.round(R.found.length / R.items.length * 100) + '%';
    if (R.found.length === R.items.length) { recallFinish(); return; }
  }
  inp.value = ''; inp.focus();
}

function recallFinish() {
  const R = RECALL;
  if (R.done) return;
  R.done = true;
  const pct = Math.round(R.found.length / R.items.length * 100);
  recallSaveBest(R.key, pct);
  addXp(R.found.length * 2);
  render();
  window.scrollTo({ top: 0 });
}

function recallResultHtml() {
  const R = RECALL;
  const pct = Math.round(R.found.length / R.items.length * 100);
  const missed = R.items.map((it, i) => i).filter(i => !R.found.includes(i));
  let html = `<div class="rc-score">${pct === 100 ? '🎉 ' : ''}Вспомнил ${R.found.length} из ${R.items.length} — ${pct}%</div>`;
  if (missed.length) {
    html += `<div class="rc-head">Пропущено (${missed.length})</div>`;
    const groups = {};
    missed.forEach(i => { const g = R.items[i].g || ''; (groups[g] = groups[g] || []).push(i); });
    Object.entries(groups).forEach(([g, list]) => {
      if (g) html += `<div class="rc-sub">${escapeHtml(g)}</div>`;
      list.forEach(i => {
        const it = R.items[i];
        html += `<div class="rc-row miss"><b>${escapeHtml(it.ru[0])}</b> — <i>${escapeHtml(it.lat[0])}</i> <span class="rc-tr">${escapeHtml(recallLatToCyr(it.lat[0]).replace(/йу/g, 'ю').replace(/(^|\s)е/g, '$1э'))}</span>${it.pair ? ' <span class="rc-pair">парная</span>' : ''}</div>`;
      });
    });
  }
  if (R.found.length) {
    html += `<div class="rc-head">Вспомнил</div>`;
    R.found.forEach(i => { const it = R.items[i]; html += `<div class="rc-row ok"><b>${escapeHtml(it.ru[0])}</b> — <i>${escapeHtml(it.lat[0])}</i>${it.pair ? ' <span class="rc-pair">парная</span>' : ''}</div>`; });
  }
  const wrong = R.log.filter(l => !l.ok);
  if (wrong.length) html += `<div class="rc-head">Не засчитано</div><div class="rc-sub">${wrong.map(w => escapeHtml(w.text)).join(' · ')}</div>
    <div class="rc-note">Если что-то из этого на самом деле верно — напиши автору — добавлю этот вариант ответа.</div>`;
  html += `<div style="display:flex; gap:10px; margin-top:16px">
    <button class="btn btn-primary" style="flex:1" onclick='RECALL=null; render();'>Ещё раз</button>
    <button class="btn btn-ghost" style="flex:1" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'recallSetup' }))})'>К спискам</button></div>`;
  return html;
}

/* ===================== РЕЖИМ: ВОЗРАСТНЫЕ ОСОБЕННОСТИ ===================== */
/* Пункты-факты по Привесу (из блоков справочника). Одна кость = несколько пунктов.
   sex: 1 — половые различия. q/a/w — вопрос, верный ответ и 3 правдоподобных неверных для «По пунктам». */
const AGE_BONES = [
  { id: 'occipital', title: 'Затылочная кость', facts: [
    { t: 'Тип окостенения', text: 'Смешанная: верх чешуи окостеневает на соединительной ткани, остальные части — на хряще; у новорождённого части ещё не слились.',
      q: 'Как окостеневает затылочная кость?', a: 'Смешанно: верх чешуи — на соединительной ткани, остальное — на хряще', w: ['Целиком на хряще', 'Целиком на соединительной ткани', 'Смешанно: чешуя — на хряще, остальное — на соединительной ткани'] },
    { t: 'Межтеменная кость', text: 'Верхняя часть чешуи окостеневает отдельно и может на всю жизнь остаться отделённой поперечным швом — межтеменная кость (os interparietale).',
      q: 'Как называется верх затылочной чешуи, оставшийся отделённым поперечным швом?', a: 'Межтеменная кость (os interparietale)', w: ['Вставочная кость (os suturale)', 'Добавочная затылочная кость', 'Теменная косточка (os parietale minor)'] },
    { t: 'Срастание с клиновидной', text: 'Базилярная часть срастается с телом клиновидной кости (synchondrosis sphenooccipitalis) в 18–20 лет — на этом заканчивается рост основания черепа в длину.',
      q: 'Когда базилярная часть затылочной кости срастается с телом клиновидной?', a: 'В 18–20 лет', w: ['К концу 1-го года', 'В 6–7 лет', 'После 30 лет'] },
    { t: 'Задний родничок', text: 'Задний родничок (между теменными костями и затылочной чешуёй) зарастает на 2-м месяце жизни.',
      q: 'Когда зарастает задний родничок?', a: 'На 2-м месяце жизни', w: ['На 2-м году жизни', 'К концу 1-го года', 'На 6-м месяце жизни'] },
    { t: 'Половые различия', sex: 1, text: 'У женщин мышечный рельеф затылочной кости (выйные линии, наружный выступ) выражен слабее.',
      q: 'Чем женская затылочная кость отличается от мужской?', a: 'Слабее выражен мышечный рельеф (выйные линии, наружный выступ)', w: ['Больше большое отверстие', 'Мыщелки крупнее и выступают сильнее', 'Чешуя толще и выпуклее'] },
    { t: "Центры окостенения", text: "Окостеневает из центров вокруг большого затылочного отверстия: на 6-й неделе — два впереди отверстия, на 8–9-й — два по бокам и три позади. До слияния части разделены хрящом — передним и задним внутризатылочными синхондрозами (synchondroses intraoccipitales anterior et posterior).",
      q: "Вокруг чего концентрируются центры окостенения затылочной кости?", a: "Вокруг большого затылочного отверстия", w: ["Вокруг наружного затылочного выступа", "Вокруг затылочных мыщелков", "Вокруг яремного отверстия"], src: 'Синельников, с. 127' },
    { t: "Слияние частей", text: "Полное соединение четырёх частей затылочной кости начинается в 2–4 года и заканчивается в 8–10 лет; срастание базилярной части с телом клиновидной — к 20 годам.",
      q: "Когда заканчивается слияние частей затылочной кости (по Синельникову)?", a: "В 8–10 лет", w: ["К концу 1-го года", "В 3–6 лет", "К 20 годам"], src: 'Синельников, с. 127' },
  ] },
  { id: 'frontal', title: 'Лобная кость', facts: [
    { t: 'Точки окостенения', text: 'Окостеневает из двух точек — их следы у взрослого видны как лобные бугры; у новорождённого бугры выражены хорошо.',
      q: 'Из скольких точек окостеневает лобная кость и где их след у взрослого?', a: 'Из двух — их следы видны как лобные бугры', w: ['Из одной — в области глабеллы', 'Из трёх — по одной в чешуе и глазничных частях', 'Из двух — их следы видны как надбровные дуги'] },
    { t: 'Лобный шов', text: 'Две половины лобной кости срастаются по лобному шву примерно ко 2-му году (иногда шов сохраняется на всю жизнь).',
      q: 'Когда срастаются две половины лобной кости по лобному шву?', a: 'Примерно ко 2-му году', w: ['К 2-му месяцу', 'В 7 лет', 'В 18–20 лет'] },
    { t: 'Передний родничок', text: 'Передний родничок (на стыке лобной и теменных костей) зарастает на 2-м году жизни.',
      q: 'Когда зарастает передний родничок?', a: 'На 2-м году жизни', w: ['На 2-м месяце жизни', 'На 2–3-м месяце жизни', 'К 6 годам'] },
    { t: 'Лобная пазуха', text: 'Лобная пазуха появляется к концу 1-го года и затем растёт; размер сильно варьирует, она может отсутствовать.',
      q: 'Когда появляется лобная пазуха?', a: 'К концу 1-го года', w: ['Уже у новорождённого хорошо развита', 'Около 7 лет', 'В период полового созревания'] },
    { t: 'Половые различия', sex: 1, text: 'У женщин надбровные дуги развиты слабее, лоб более вертикальный.',
      q: 'Чем женская лобная кость отличается от мужской?', a: 'Надбровные дуги слабее, лоб более вертикальный', w: ['Надбровные дуги сильнее, лоб покатый', 'Лобные бугры выражены слабее, лоб покатый', 'Лобная пазуха всегда отсутствует'] },
    { t: "Тип и центры", text: "Перепончатая кость, кроме носовой части (на хряще). На 8–9-й неделе появляются парные центры в области будущих бугров и надглазничных краёв.",
      q: "Какая часть лобной кости развивается на основе хряща?", a: "Носовая часть", w: ["Чешуя", "Глазничные части", "Скуловые отростки"], src: 'Синельников, с. 128' },
    { t: "Лобный (метопический) шов", text: "При рождении кость из двух половин; срастание начинается с 6-го месяца и заканчивается на 3-м году образованием лобного (метопического) шва (sutura frontalis persistens / metopica), который сохраняется до 5 лет. (У Привеса — срастание примерно ко 2-му году.)",
      q: "До какого возраста сохраняется лобный (метопический) шов (по Синельникову)?", a: "До 5 лет", w: ["До 2 месяцев", "До 18–20 лет", "До 30 лет"], src: 'Синельников, с. 128' },
  ] },
  { id: 'parietal', title: 'Теменная кость', facts: [
    { t: 'Теменной бугор', text: 'Теменной бугор — место начала окостенения; у новорождённого выражен хорошо.',
      q: 'Что такое теменной бугор с точки зрения развития?', a: 'Место начала окостенения теменной кости', w: ['Место прикрепления височной мышцы', 'Остаток заднего родничка', 'Место срастания двух половин кости'] },
    { t: 'Роднички у углов', text: 'У углов теменной кости у новорождённого роднички: передний (лобный угол, зарастает на 2-м году), задний (затылочный угол, на 2-м месяце), клиновидный (клиновидный угол, на 2–3-м месяце) и сосцевидный (сосцевидный угол).',
      q: 'Когда зарастает клиновидный родничок?', a: 'На 2–3-м месяце жизни', w: ['На 2-м году жизни', 'К концу 1-го года', 'Сразу после рождения'] },
    { t: 'Швы в зрелом и пожилом возрасте', text: 'В зрелом возрасте швы свода окостеневают (синдесмоз переходит в синостоз), в старости кости черепа тоньше и легче.',
      q: 'Что происходит со швами свода черепа в зрелом возрасте?', a: 'Окостеневают: синдесмоз переходит в синостоз', w: ['Становятся шире: синостоз переходит в синдесмоз', 'Превращаются в хрящевые соединения (синхондрозы)', 'Не изменяются в течение всей жизни'] },
    { t: 'Половые различия', sex: 1, text: 'У женщин темя более плоское, поверхность черепа более гладкая.',
      q: 'Чем отличается теменная область женского черепа?', a: 'Темя более плоское, поверхность более гладкая', w: ['Темя более выпуклое, рельеф грубее', 'Теменные бугры отсутствуют', 'Кость заметно толще'] },
    { t: "Центры окостенения", text: "Развивается из двух центров в области будущих теменных бугров (8–10-я неделя внутриутробно); окостенение идёт радиально от бугра. У новорождённого углов нет, края разделены широкими прослойками соединительной ткани; окостенение заканчивается на 2-м году.",
      q: "Когда заканчивается окостенение теменной кости?", a: "На 2-м году жизни", w: ["К концу 1-го месяца", "В 7 лет", "В 12–15 лет"], src: 'Синельников, с. 127' },
    { t: "Височные линии", text: "Верхняя и нижняя височные линии (lineae temporales) отчётливо формируются к 12–15 годам.",
      q: "К какому возрасту отчётливо формируются височные линии теменной кости?", a: "К 12–15 годам", w: ["К 2 годам", "К 7 годам", "К 25 годам"], src: 'Синельников, с. 127' },
  ] },
  { id: 'sphenoid', title: 'Клиновидная кость', facts: [
    { t: 'Части к рождению', text: 'Развивается из нескольких точек окостенения; к рождению это 3 части, которые срастаются в одну кость к концу 1-го года.',
      q: 'Из скольких частей состоит клиновидная кость к рождению и когда они срастаются?', a: 'Из 3 частей, срастаются к концу 1-го года', w: ['Из 2 частей, срастаются на 2-м месяце', 'Из 4 частей, срастаются к 7 годам', 'Уже единая кость к рождению'] },
    { t: 'Клиновидная пазуха', text: 'Клиновидная пазуха у новорождённого очень маленькая и начинает быстро расти около 7 лет.',
      q: 'Когда начинает быстро расти клиновидная пазуха?', a: 'Около 7 лет', w: ['К концу 1-го года', 'В 18–20 лет', 'Сразу после рождения'] },
    { t: 'Срастание с затылочной', text: 'Тело клиновидной кости срастается с базилярной частью затылочной кости в 18–20 лет.',
      q: 'Когда тело клиновидной кости срастается с затылочной?', a: 'В 18–20 лет', w: ['К концу 1-го года', 'В 7 лет', 'После 40 лет'] },
    { t: "Окостенение крыльев", text: "Развивается почти целиком на хряще; центры появляются в конце 2-го месяца. Малые крылья соединяются с телом на 6–7-м месяце внутриутробно, большие — после рождения.",
      q: "Когда большие крылья клиновидной кости соединяются с телом?", a: "После рождения", w: ["На 6–7-м месяце внутриутробно", "В 18–20 лет", "В конце 2-го месяца внутриутробно"], src: 'Синельников, с. 128' },
  ] },
  { id: 'temporal', title: 'Височная кость', facts: [
    { t: 'Барабанная часть', text: 'У новорождённого барабанная часть — незамкнутое кольцо (annulus tympanicus), затянутое барабанной перепонкой; наружный слуховой проход ещё не сформирован.',
      q: 'Как выглядит барабанная часть височной кости у новорождённого?', a: 'Незамкнутое кольцо (annulus tympanicus), наружного слухового прохода ещё нет', w: ['Сформированный костный слуховой проход', 'Сплошная пластинка без отверстий', 'Отсутствует, появляется к 7 годам'] },
    { t: 'Среднее ухо у младенцев', text: 'Барабанная перепонка у новорождённого лежит близко к поверхности, поэтому у младенцев чаще болеет среднее ухо.',
      q: 'Почему у младенцев чаще болеет среднее ухо?', a: 'Барабанная перепонка лежит близко к поверхности', w: ['Сосцевидный отросток слишком крупный', 'Пирамида ещё хрящевая', 'Слуховой проход слишком длинный'] },
    { t: 'Сосцевидный родничок', text: 'Сосцевидный родничок у новорождённого — между теменной костью, основанием пирамиды и затылочной чешуёй.',
      q: 'Где находится сосцевидный родничок?', a: 'Между теменной костью, основанием пирамиды и затылочной чешуёй', w: ['Между лобной и теменными костями', 'Между теменными костями и затылочной чешуёй', 'Между теменной, лобной, клиновидной и височной чешуёй'] },
    { t: 'Мышечный рельеф', text: 'Мышечный рельеф (в том числе сосцевидный отросток) у новорождённого развит слабо и формируется с работой мышц.',
      q: 'Каков сосцевидный отросток у новорождённого?', a: 'Развит слабо, формируется с работой мышц', w: ['Хорошо развит, содержит крупные ячейки', 'Полностью отсутствует до 7 лет', 'Крупнее, чем у взрослого'] },
    { t: "Центры окостенения", text: "Чешуйчатая часть — в начале 3-го месяца, барабанная — в конце 3-го, каменистая — на 5-м месяце внутриутробно, шиловидный отросток — в конце 1-го года жизни. Полное окостенение — к 6 годам.",
      q: "Когда начинает окостеневать шиловидный отросток?", a: "В конце 1-го года жизни", w: ["На 5-м месяце внутриутробно", "В начале 3-го месяца внутриутробно", "В 6 лет"], src: 'Синельников, с. 128' },
    { t: "Наружный слуховой проход", text: "У новорождённого барабанная часть — неполное кольцо; в первые годы оно разрастается и вместе с чешуёй образует костную часть наружного слухового прохода (meatus acusticus externus).",
      q: "Из чего формируется костная часть наружного слухового прохода?", a: "Из разросшегося барабанного кольца и чешуйчатой части", w: ["Из каменистой части", "Из сосцевидного отростка", "Из шиловидного отростка"], src: 'Синельников, с. 128' },
  ] },
  { id: 'ethmoid', title: 'Решётчатая кость', facts: [
    { t: 'Решётчатые ячейки', text: 'Решётчатые ячейки видны на рентгенограмме уже в первые годы жизни.',
      q: 'Когда решётчатые ячейки становятся видны на рентгенограмме?', a: 'Уже в первые годы жизни', w: ['Только после 7 лет', 'Только к 18–20 годам', 'Не видны никогда'] },
    { t: "Порядок окостенения", text: "Хрящевая кость. Сначала окостеневают средняя (4-й месяц) и верхняя (5-й месяц) раковины, на 9-м месяце — решётчатая пластинка, после рождения (6 мес) — глазничная пластинка; на 2-м году — петушиный гребень, в 6–8 лет — перпендикулярная пластинка; ячейки лабиринта окончательно формируются к 12–14 годам.",
      q: "Когда окончательно формируются решётчатые ячейки?", a: "К 12–14 годам", w: ["К концу 1-го года", "На 2-м году", "К 25 годам"], src: 'Синельников, с. 128' },
  ] },
  { id: 'maxilla', title: 'Верхняя челюсть', facts: [
    { t: 'Лицевой череп новорождённого', text: 'У новорождённого лицевой череп мал: около 1/8 мозгового (у взрослого 1/4); альвеолярные отростки почти отсутствуют.',
      q: 'Какую долю мозгового черепа составляет лицевой у новорождённого?', a: 'Около 1/8 (у взрослого 1/4)', w: ['Около 1/4 (у взрослого 1/8)', 'Около 1/2', 'Столько же, сколько у взрослого'] },
    { t: 'Верхнечелюстная пазуха', text: 'Верхнечелюстная пазуха у новорождённого — щель величиной с горошину; полностью развивается к смене зубов, очень изменчива.',
      q: 'Когда полностью развивается верхнечелюстная пазуха?', a: 'К смене зубов', w: ['Уже у новорождённого', 'К концу 1-го года', 'В 18–20 лет'] },
    { t: 'Старость', text: 'В старости при выпадении зубов альвеолярный край атрофируется, лицо укорачивается.',
      q: 'Что происходит с верхней челюстью в старости при выпадении зубов?', a: 'Альвеолярный край атрофируется, лицо укорачивается', w: ['Альвеолярный отросток утолщается', 'Пазуха зарастает', 'Лицо удлиняется'] },
    { t: "5 центров окостенения", text: "Перепончатая кость, развивается из 5 центров (наружные верхний и нижний, внутренние передний и задний, средний); сливаются на 5-м месяце. У новорождённого сохраняется резцовый шов между резцовой костью (os incisivum) и остальной челюстью.",
      q: "Из скольких центров окостенения развивается верхняя челюсть?", a: "Из 5", w: ["Из 1", "Из 2", "Из 8"], src: 'Синельников, с. 128' },
    { t: "Верхнечелюстная пазуха", text: "Пазуха появляется на 6-м месяце внутриутробно и окончательно формируется к 12–14 годам.",
      q: "К какому возрасту окончательно формируется верхнечелюстная пазуха (по Синельникову)?", a: "К 12–14 годам", w: ["К концу 1-го года", "К 3 годам", "К 25 годам"], src: 'Синельников, с. 128' },
  ] },
  { id: 'mandible', title: 'Нижняя челюсть', facts: [
    { t: 'Две половины', text: 'У новорождённого нижняя челюсть состоит из двух половин, которые срастаются в 1–2 года; альвеолярная часть почти отсутствует.',
      q: 'Когда срастаются две половины нижней челюсти?', a: 'В 1–2 года', w: ['До рождения', 'На 2-м месяце жизни', 'В 6–7 лет'] },
    { t: 'Старость', text: 'В старости после выпадения зубов альвеолярная часть атрофируется, подбородок выдаётся вперёд, угол между ветвью и телом увеличивается.',
      q: 'Как меняется угол нижней челюсти в старости?', a: 'Увеличивается (подбородок выдаётся вперёд)', w: ['Уменьшается', 'Не изменяется', 'Становится прямым'] },
    { t: "Тип окостенения", text: "Смешанная: мыщелковый и венечный отростки — хрящевые, остальное — перепончатое. Закладывается парной вокруг хряща I жаберной дуги; половины начинают соединяться на 3-м месяце после рождения (подбородочный симфиз), полное срастание — к 2 годам.",
      q: "Какие части нижней челюсти развиваются на основе хряща?", a: "Мыщелковый и венечный отростки", w: ["Тело и альвеолярная часть", "Угол и ветвь", "Подбородочный выступ"], src: 'Синельников, с. 128' },
  ] },
  { id: 'vertebrae', title: 'Позвонки (общее)', facts: [
    { t: 'Точки окостенения до рождения', text: 'До рождения точки окостенения видны во всех позвонках, кроме копчиковых.',
      q: 'В каких позвонках до рождения нет точек окостенения?', a: 'В копчиковых', w: ['В шейных', 'В крестцовых', 'Во всех поясничных'] },
    { t: 'Тело у новорождённого', text: 'У новорождённого тело позвонка яйцевидное, без «углов»; на передней поверхности углубление (след неполного слияния точек окостенения и эмбриональных вен) — сохраняется до 14 лет, его нельзя путать с разрушением кости.',
      q: 'До какого возраста сохраняется углубление на передней поверхности тела позвонка?', a: 'До 14 лет', w: ['До 3 лет', 'До 23–26 лет', 'До 7 лет'] },
    { t: 'Срастание дуги', text: 'На 3-м году дуга срастается с телом, а обе половины дуги — между собой.',
      q: 'Когда дуга позвонка срастается с телом?', a: 'На 3-м году', w: ['На 1-м году', 'В 7 лет', 'В 23–26 лет'] },
    { t: 'Краевой кант', text: 'Краевой кант (limbus vertebrae) окостеневает из своих ядер (6–8 лет у девочек, 7–9 у мальчиков) и прирастает к телу в 23–26 лет; его ядра на снимке не принимают за перелом.',
      q: 'Когда краевой кант (limbus vertebrae) прирастает к телу позвонка?', a: 'В 23–26 лет', w: ['В 6–9 лет', 'На 3-м году', 'В 14 лет'] },
    { t: 'Взрослый вид', text: 'После 23–26 лет все части срастаются: тело четырёхугольное с округлыми «углами».',
      q: 'Какое тело у позвонка взрослого (после 23–26 лет)?', a: 'Четырёхугольное с округлыми «углами»', w: ['Яйцевидное, без «углов»', 'Четырёхугольное с острыми «углами»', 'Клиновидное'] },
    { t: 'Старость', text: 'В старости — остеопороз, обызвествление дисков и передней продольной связки, остеофиты по краям тел; «углы» тела становятся острыми.',
      q: 'Что из этого характерно для позвонков в старости?', a: 'Остеопороз, остеофиты, острые «углы» тела', w: ['Тело снова становится яйцевидным', 'Краевой кант отделяется от тела', 'Дуга расщепляется на две половины'] },
    { t: 'Добавочный отросток (поясничные)', text: 'Вариант: добавочный отросток поясничного позвонка (processus accessorius) бывает длиной более 4 мм и шиловидным — это норма.',
      q: 'Шиловидный добавочный отросток поясничного позвонка длиной более 4 мм — это…', a: 'Вариант нормы', w: ['Перелом', 'Признак остеопороза', 'Добавочное ребро'] },
    { t: "Срастание дуг и тела", text: "Центры: один в теле и два в дуге (конец 2-го месяца). Половины дуги срастаются в течение 1-го года (к 7 годам — почти все, в крестце иногда открыты до 15–18 лет); дуга с телом — в 3–5 лет, раньше в грудном отделе.",
      q: "Когда дуга позвонка срастается с телом (по Синельникову)?", a: "В 3–5 лет", w: ["На 1-м году", "В 16–20 лет", "В 23–26 лет"], src: 'Синельников, с. 124' },
    { t: "Краевые валики — разные данные", text: "По Синельникову краевые костные валики (кант) срастаются с телом в 16–20 лет; по Привесу — в 23–26 лет.",
      q: "Когда краевой кант срастается с телом позвонка по Синельникову?", a: "В 16–20 лет", w: ["В 3–5 лет", "В 23–26 лет", "После 30 лет"], src: 'Синельников, с. 124' },
    { t: "Атлант и осевой позвонок", text: "Передняя и задняя дуги атланта срастаются в 5–6 лет. Участок с собственной парой точек окостенения в 4–5 лет присоединяется к телу осевого позвонка, образуя зуб (dens).",
      q: "Когда передняя и задняя дуги атланта срастаются в одну кость?", a: "В 5–6 лет", w: ["На 1-м году", "В 4–5 месяцев", "В 18–20 лет"], src: 'Синельников, с. 124' },
    { t: "Изгибы позвоночника", text: "У новорождённого позвоночник прямой. Шейный лордоз формируется в первые 3 месяца, грудной кифоз — к 6–7 месяцам, поясничный лордоз — к концу 1-го года (в связи со стоянием).",
      q: "Когда формируется поясничный лордоз?", a: "К концу 1-го года жизни", w: ["В первые 3 месяца", "К 6–7 месяцам", "К 7 годам"], src: 'Синельников, с. 125' },
    { t: "Рост позвоночного столба", text: "В первые 2 года длина позвоночного столба увеличивается почти вдвое; у взрослого он более чем в 3 раза длиннее, чем у новорождённого.",
      q: "Во сколько раз увеличивается длина позвоночного столба за первые 2 года?", a: "Почти в 2 раза", w: ["В 1,2 раза", "В 3 раза", "В 4 раза"], src: 'Синельников, с. 124' },
  ] },
  { id: 'sacrum', title: 'Крестец и копчик', facts: [
    { t: 'Срастание крестцовых позвонков', text: 'Крестцовые позвонки срастаются в единую кость в 17–25 лет.',
      q: 'Когда крестцовые позвонки срастаются в единую кость?', a: 'В 17–25 лет', w: ['На 3-м году', 'В 7–9 лет', 'После 40 лет'] },
    { t: 'Половые различия', sex: 1, text: 'Мужской крестец относительно узкий и сильнее вогнут; женский — шире и более плоский, копчик у женщин меньше выдаётся вперёд (расширяет выход из малого таза).',
      q: 'Чем женский крестец отличается от мужского?', a: 'Шире и более плоский, копчик меньше выдаётся вперёд', w: ['Уже и сильнее вогнут', 'Длиннее и уже', 'Копчик сильнее загнут вперёд'] },
    { t: "Порядок срастания", text: "После 15 лет срастаются три нижних крестцовых позвонка, к 25 годам — два верхних (в целом 18–25 лет).",
      q: "Какие крестцовые позвонки срастаются раньше?", a: "Нижние", w: ["Верхние", "Все одновременно", "Средние"], src: 'Синельников, с. 124' },
    { t: "Копчик", text: "Центры окостенения копчика: I позвонок — на 2–3-й неделе после рождения, II — в 4–8 лет, III — в 9–13, IV — к 15 годам. Копчиковые позвонки срастаются после 30 лет.",
      q: "Когда срастаются копчиковые позвонки?", a: "После 30 лет", w: ["К 7 годам", "К 15 годам", "В 18–25 лет"], src: 'Синельников, с. 124' },
  ] },
  { id: 'ribs', title: 'Рёбра', facts: [
    { t: 'Точки окостенения', text: 'Основная точка — в области угла (за её счёт окостеневает тело; передний конец остаётся хрящом); дополнительные — в головке и бугорке, появляются в 15–20 лет и прирастают к 18–25 годам.',
      q: 'Где закладывается основная точка окостенения ребра?', a: 'В области угла', w: ['В головке', 'В бугорке', 'В переднем конце'] },
    { t: 'Варианты рёбер', text: 'Добавочные рёбра — шейное (от VII шейного позвонка) и поясничное; XII ребро изменчивее всех — длинное «саблевидное» или короткое «стилетовидное», может отсутствовать.',
      q: 'Какое ребро изменчивее всех?', a: 'XII ребро', w: ['I ребро', 'VII ребро', 'X ребро'] },
    { t: 'Форма грудной клетки с возрастом', text: 'У новорождённого преобладает переднезадний размер; когда ребёнок встаёт и ходит, клетка уплощается и начинает преобладать поперечный размер.',
      q: 'Какой размер грудной клетки преобладает у новорождённого?', a: 'Переднезадний', w: ['Поперечный', 'Вертикальный', 'Все размеры равны'] },
    { t: 'Половые различия', sex: 1, text: 'У женщин грудная клетка короче, уже в нижнем отделе и более округлая.',
      q: 'Чем женская грудная клетка отличается от мужской?', a: 'Короче, уже в нижнем отделе, более округлая', w: ['Длиннее и шире в нижнем отделе', 'Более плоская и широкая', 'Не отличается'] },
    { t: 'Патологические формы', text: 'При рахите — «куриная грудь» (грудина выступает вперёд); у сапожников описана воронкообразная (впалая) грудь.',
      q: 'Какая форма грудной клетки бывает при рахите?', a: '«Куриная грудь» — грудина выступает вперёд', w: ['Воронкообразная (впалая) грудь', 'Бочкообразная грудь', 'Плоская грудь'] },
    { t: "Окостенение рёбер", text: "Окостенение начинается со 2-го месяца внутриутробно (перихондрально, затем эндохондрально); центры в области угла и головки появляются в 15–20 лет.",
      q: "Когда в ребре появляются центры окостенения головки и угла (по Синельникову)?", a: "В 15–20 лет", w: ["На 2-м месяце внутриутробно", "На 1-м году", "После 30 лет"], src: 'Синельников, с. 125' },
    { t: "Периоды развития грудной клетки", text: "4 периода: до 2 лет — очень интенсивное развитие; 3–7 лет — быстрое; 8–12 лет — замедление; в половое созревание — снова рост, до 20–25 лет; заканчивается к 25 годам.",
      q: "Когда грудная клетка растёт особенно интенсивно?", a: "От рождения до 2 лет", w: ["В 3–7 лет", "В 8–12 лет", "После 25 лет"], src: 'Синельников, с. 125' },
  ] },
  { id: 'sternum', title: 'Грудина', facts: [
    { t: 'Точки окостенения', text: 'В рукоятке 1–2 точки, в теле 4–13 (нижние появляются перед рождением и на первом году), в мечевидном отростке — в 6–20 лет.',
      q: 'Когда появляется точка окостенения в мечевидном отростке?', a: 'В 6–20 лет', w: ['До рождения', 'На первом году жизни', 'После 30 лет'] },
    { t: 'Сращение частей', text: 'Нижние сегменты тела срастаются в 15–16 лет, верхний — к 25 годам; мечевидный отросток прирастает после 30 лет, рукоятка — ещё позже и не всегда (тогда виден синхондроз).',
      q: 'Когда мечевидный отросток прирастает к телу грудины?', a: 'После 30 лет', w: ['В 15–16 лет', 'К 25 годам', 'На 3-м году'] },
    { t: 'Добавочная косточка', text: 'Одна из точек окостенения у I ребра может сохраниться как добавочная косточка (os parasternale).',
      q: 'Как называется добавочная косточка грудины у I ребра?', a: 'Os parasternale', w: ['Os suprasternale', 'Os interparietale', 'Os xiphoideum'] },
    { t: "Закладка грудины", text: "Формируется на 3–4-м месяце из парных хрящевых грудинных полосок у концов верхних девяти рёбер, которые срастаются друг с другом.",
      q: "Из чего закладывается грудина?", a: "Из парных хрящевых грудинных полосок", w: ["Из одного непарного хряща", "Из передних концов I–II рёбер", "Из ключиц"], src: 'Синельников, с. 125' },
    { t: "Окостенение — разные данные", text: "По Синельникову первичный центр в рукоятке — на 6-м месяце внутриутробно; части тела сливаются к 10 годам и срастаются к 18; в мечевидном отростке центр к 6 годам (нередко он остаётся хрящевым); грудина в целом окостеневает в 30–35 лет. По Привесу — нижние сегменты тела срастаются в 15–16 лет, верхний — к 25.",
      q: "Когда грудина окостеневает целиком (по Синельникову)?", a: "В 30–35 лет", w: ["К 10 годам", "К 18 годам", "В 15–16 лет"], src: 'Синельников, с. 125' },
  ] },
  { id: 'clavicle', title: 'Ключица', facts: [
    { t: 'Начало окостенения', text: 'Окостенение в ключице начинается раньше и заканчивается позже остальных костей; первая точка (в теле) появляется на 5–6-й неделе внутриутробного развития.',
      q: 'Когда появляется первая точка окостенения в теле ключицы?', a: 'На 5–6-й неделе внутриутробного развития', w: ['На 5–6-м месяце внутриутробного развития', 'Сразу после рождения', 'На 2-м году жизни'] },
    { t: 'Грудинный конец и срастание', text: 'Вторая точка окостенения (на грудинном конце) появляется к 16–18 годам; точки срастаются к 22–25 годам.',
      q: 'Когда срастаются точки окостенения ключицы?', a: 'К 22–25 годам', w: ['К 16–18 годам', 'К 7 годам', 'К 30 годам'] },
    { t: "Тип окостенения", text: "Большая часть ключицы формируется как перепончатая кость, грудинный конец — как хрящевая. Первичный центр — в середине, на 6-й неделе; добавочный в грудинном конце — на 16–18-м году, срастается к 22–24 годам.",
      q: "Как развивается грудинный конец ключицы?", a: "Как хрящевая кость", w: ["Как перепончатая кость", "Остаётся хрящом всю жизнь", "Из отдельной косточки, не срастающейся с ключицей"], src: 'Синельников, с. 129' },
  ] },
  { id: 'hand', title: 'Кисть', facts: [
    { t: 'Рентген кисти и возраст', text: 'Кости кисти окостеневают в разное время (в основном под действием соматотропного гормона); по рентгену кисти можно определить возраст ребёнка до 12–14 лет включительно.',
      q: 'До какого возраста по рентгену кисти можно определить возраст ребёнка?', a: 'До 12–14 лет', w: ['До 3–4 лет', 'До 18–20 лет', 'До 25 лет'] },
    { t: "Порядок окостенения запястья", text: "Головчатая — 1-й год, крючковидная — начало 2-го, трёхгранная — конец 2-го, полулунная — конец 4-го, трапеция — 5 лет, ладьевидная — середина 5-го, трапециевидная — 6 лет, гороховидная — 8–10 лет.",
      q: "Какая кость запястья окостеневает последней?", a: "Гороховидная (8–10 лет)", w: ["Головчатая", "Ладьевидная", "Трапециевидная"], src: 'Синельников, с. 130' },
    { t: "Первая кость запястья", text: "Первой (на 1-м году жизни) начинает окостеневать головчатая кость (os capitatum); при рождении все кости запястья хрящевые.",
      q: "Какая кость запястья окостеневает первой?", a: "Головчатая", w: ["Ладьевидная", "Гороховидная", "Полулунная"], src: 'Синельников, с. 130' },
    { t: "Пястные кости", text: "Два центра: первичный (3-й месяц) — тело и основание, вторичный — головка; у I пястной наоборот — вторичный центр даёт основание. Вторичные центры — в 3–5 лет, срастаются в 14–16 лет.",
      q: "Чем отличается окостенение I пястной кости?", a: "Вторичный центр образует основание, а не головку", w: ["У неё нет вторичного центра", "Она окостеневает первой из всех костей кисти", "Вторичный центр образует тело"], src: 'Синельников, с. 130' },
    { t: "Фаланги", text: "Первичный центр (конец 2-го — начало 3-го месяца) даёт тело и головку, вторичный (2–3-й год) — основание; срастаются в 16–20 лет.",
      q: "Что образуется из вторичного центра окостенения фаланги?", a: "Основание фаланги", w: ["Головка фаланги", "Тело фаланги", "Бугристость дистальной фаланги"], src: 'Синельников, с. 130' },
  ] },
  { id: 'newborn', title: 'Череп новорождённого', facts: [
    { t: 'Передний родничок', text: 'Передний родничок — на стыке лобной и теменных костей, зарастает на 2-м году жизни.',
      q: 'Где находится передний родничок и когда он зарастает?', a: 'Между лобной и теменными костями, на 2-м году', w: ['Между теменными костями и затылочной чешуёй, на 2-м месяце', 'Между лобной и теменными костями, на 2-м месяце', 'У клиновидного угла теменной кости, на 2-м году'] },
    { t: 'Задний родничок', text: 'Задний родничок — между теменными костями и затылочной чешуёй, зарастает на 2-м месяце жизни.',
      q: 'Между какими костями находится задний родничок?', a: 'Между теменными костями и затылочной чешуёй', w: ['Между лобной и теменными костями', 'Между теменной, лобной и клиновидной костями', 'Между теменной костью и пирамидой височной кости'] },
    { t: 'Клиновидный родничок', text: 'Клиновидный родничок — у клиновидного угла теменной кости, зарастает на 2–3-м месяце.',
      q: 'Когда зарастает клиновидный родничок?', a: 'На 2–3-м месяце', w: ['На 2-м году', 'К концу 1-го года', 'В 3–4 года'] },
    { t: 'Сосцевидный родничок', text: 'Сосцевидный родничок — между теменной костью, основанием пирамиды и затылочной чешуёй.',
      q: 'Где находится сосцевидный родничок?', a: 'Между теменной костью, основанием пирамиды и затылочной чешуёй', w: ['Между лобной и теменными костями', 'Между теменными костями и затылочной чешуёй', 'У клиновидного угла теменной кости'] },
    { t: "5 периодов развития черепа", text: "1) до 7 лет — активный рост, роднички уменьшаются; 2) 7–14 лет — растут ямки, сосцевидный отросток, глазницы и полость носа; 3) половое созревание — 25 лет: удлиняется лицевой череп, выступают лобные бугры; 4) 25–45 лет — окостенение швов; 5) после 45 лет — атрофия лицевого, затем мозгового черепа.",
      q: "В каком периоде происходит окостенение швов черепа?", a: "С 25 до 45 лет", w: ["До 7 лет", "С 7 до 14 лет", "После 45 лет"], src: 'Синельников, с. 128' },
    { t: "Преждевременное зарастание швов", text: "Преждевременное окостенение сагиттального (стреловидного) шва ведёт к формированию короткого черепа, венечного — длинного.",
      q: "К чему ведёт преждевременное окостенение сагиттального шва?", a: "К короткому черепу", w: ["К длинному черепу", "К увеличению лицевого черепа", "К незаращению переднего родничка"], src: 'Синельников, с. 128' },
    { t: "Свод и основание", text: "Кости свода — перепончатые (теменные, лобная чешуя, чешуйчатая и барабанная части височной, верх затылочной чешуи); большая часть основания — хрящевая.",
      q: "Как развиваются кости свода черепа?", a: "Как перепончатые (минуя хрящ)", w: ["Как хрящевые", "Из жаберных дуг", "Смешанно, из хряща и перепонки поровну"], src: 'Синельников, с. 126' },
  ] },
  { id: 'facial_small', title: 'Мелкие кости лица', facts: [
    { t: "Тип окостенения", text: "Нижняя носовая раковина — хрящевая (1 центр, начало 3-го месяца); слёзная, сошник, нёбная и скуловая — перепончатые.",
      q: "Какая из мелких костей лица развивается на основе хряща?", a: "Нижняя носовая раковина", w: ["Слёзная кость", "Сошник", "Скуловая кость"], src: 'Синельников, с. 128' },
    { t: "Сошник", text: "Развивается из двух (правого и левого) центров на 2-м месяце; пластинки срастаются, а хрящ перегородки между ними после рождения рассасывается.",
      q: "Из скольких центров окостенения развивается сошник?", a: "Из двух", w: ["Из одного", "Из трёх", "Из пяти"], src: 'Синельников, с. 128' },
    { t: "Нёбная и скуловая", text: "Нёбная кость — 1 центр на 2-м месяце (на месте соединения пластинок); скуловая — 1 центр в конце 2-го месяца внутриутробно.",
      q: "Где появляется центр окостенения нёбной кости?", a: "В месте соединения перпендикулярной и горизонтальной пластинок", w: ["В пирамидальном отростке", "В глазничном отростке", "В середине горизонтальной пластинки"], src: 'Синельников, с. 128' },
  ] },
  { id: 'hyoid', title: 'Подъязычная кость', facts: [
    { t: "5 центров", text: "Развивается из 5 центров: тело и рога; центры тела и больших рогов — в конце внутриутробного периода или вскоре после рождения, малые рога окостеневают к 13–15 годам.",
      q: "Из скольких центров окостенения развивается подъязычная кость?", a: "Из 5", w: ["Из 1", "Из 2", "Из 3"], src: 'Синельников, с. 128' },
    { t: "Сращение рогов", text: "Большие рога срастаются с телом к 30–40 годам (иногда позже), малые — к старости.",
      q: "Когда большие рога подъязычной кости срастаются с телом?", a: "К 30–40 годам", w: ["На 1-м году", "К 13–15 годам", "Не срастаются никогда"], src: 'Синельников, с. 128' },
  ] },
  { id: 'scapula', title: 'Лопатка', facts: [
    { t: "Центры окостенения", text: "Один первичный центр (в средней части, конец 2-го месяца внутриутробно) — из него большая часть кости — и 6–8 вторичных.",
      q: "Сколько вторичных центров окостенения у лопатки?", a: "6–8", w: ["1", "2–3", "12–14"], src: 'Синельников, с. 129' },
    { t: "Вторичные центры и срастание", text: "Вторичные центры появляются в 11–18 лет и дают отростки, суставную впадину, нижний угол и медиальный край; все части срастаются в 20–24 года.",
      q: "Когда срастаются все части лопатки?", a: "В 20–24 года", w: ["К 7 годам", "В 11–18 лет", "После 30 лет"], src: 'Синельников, с. 129' },
  ] },
  { id: 'humerus', title: 'Плечевая кость', facts: [
    { t: "8 центров", text: "Первичный центр (2-й месяц внутриутробно) даёт тело и медиальный надмыщелок; из трёх вторичных — проксимальный эпифиз, из четырёх — дистальный.",
      q: "Из скольких центров окостенения развивается плечевая кость?", a: "Из 8 (1 первичный и 7 вторичных)", w: ["Из 3", "Из 5", "Из 2"], src: 'Синельников, с. 130' },
    { t: "Вторичные центры", text: "Вторичные центры появляются на 1-м году и позже (латеральный надмыщелок — к 11 годам); верхние раньше нижних, у девочек раньше, чем у мальчиков.",
      q: "К какому возрасту появляется центр окостенения латерального надмыщелка?", a: "К 11 годам", w: ["На 1-м году", "К 3 годам", "К 20 годам"], src: 'Синельников, с. 130' },
    { t: "Сращение эпифизов", text: "Проксимальный эпифиз срастается с диафизом в 20–25 лет, дистальный — к 20 годам.",
      q: "Когда проксимальный эпифиз плечевой кости срастается с диафизом?", a: "В 20–25 лет", w: ["К 7 годам", "В 14–16 лет", "После 30 лет"], src: 'Синельников, с. 130' },
  ] },
  { id: 'ulna', title: 'Локтевая кость', facts: [
    { t: "3 центра", text: "Первичный центр (2-й месяц) — диафиз; вторичные: проксимальный эпифиз — в 8–12 лет, дистальный — в 6–9 лет. Все части срастаются к 18–22 годам.",
      q: "Когда срастаются части локтевой кости?", a: "К 18–22 годам", w: ["К 7 годам", "В 14 лет", "После 30 лет"], src: 'Синельников, с. 130' },
  ] },
  { id: 'radius', title: 'Лучевая кость', facts: [
    { t: "4 центра", text: "Первичный — тело; два вторичных — эпифизы (дистальный в 2–3 года, проксимальный в 5–6 лет); четвёртый, дополнительный — бугристость лучевой кости.",
      q: "Какой дополнительный (четвёртый) центр окостенения есть у лучевой кости?", a: "Центр бугристости лучевой кости", w: ["Центр шиловидного отростка", "Центр головки", "Центр локтевой вырезки"], src: 'Синельников, с. 130' },
    { t: "Бугристость", text: "Центр бугристости появляется в 14 лет и срастается с диафизом к 18 годам; проксимальный эпифиз срастается в 16–17 лет.",
      q: "Когда появляется центр окостенения бугристости лучевой кости?", a: "В 14 лет", w: ["На 1-м году", "В 5–6 лет", "В 20 лет"], src: 'Синельников, с. 130' },
  ] },
  { id: 'pelvis', title: 'Тазовая кость', facts: [
    { t: "Три первичных центра", text: "Подвздошная часть — 3-й месяц, седалищная — 4-й, лобковая — 5-й месяц внутриутробно; плюс до 8 добавочных центров.",
      q: "В каком порядке появляются первичные центры тазовой кости?", a: "Подвздошная → седалищная → лобковая", w: ["Лобковая → седалищная → подвздошная", "Седалищная → подвздошная → лобковая", "Все одновременно"], src: 'Синельников, с. 130' },
    { t: "Вертлужная впадина", text: "В вертлужной впадине три закладки соединены хрящевыми прослойками; в них к 16–18 годам появляются добавочные центры. Все центры срастаются в 20–25 лет.",
      q: "Когда срастаются все части тазовой кости?", a: "В 20–25 лет", w: ["К 7 годам", "В 12–14 лет", "После 30 лет"], src: 'Синельников, с. 130' },
    { t: "Половые различия таза", text: "Половые различия таза появляются с 8–10 лет: у мальчиков преобладают вертикальные размеры, у девочек — поперечные и переднезадние.",
      q: "С какого возраста проявляются половые различия таза?", a: "С 8–10 лет", w: ["С рождения", "С 3 лет", "С 18 лет"], src: 'Синельников, с. 130' },
  ] },
  { id: 'femur', title: 'Бедренная кость и надколенник', facts: [
    { t: "5 центров", text: "Первичный (начало 2-го месяца) — тело; вторичные: дистальный эпифиз — в конце внутриутробного периода, проксимальный — конец 1-го — начало 2-го года, большой вертел — 3 года, малый — 8 лет. Срастаются в 16–20 лет.",
      q: "Какой вторичный центр бедренной кости появляется ещё до рождения?", a: "Дистального эпифиза", w: ["Проксимального эпифиза", "Большого вертела", "Малого вертела"], src: 'Синельников, с. 131' },
    { t: "Надколенник", text: "Сесамовидная кость на основе хряща; 1 центр — на 2-м году у девочек и на 4-м у мальчиков; окостенение заканчивается к 16–20 годам.",
      q: "Когда появляется центр окостенения надколенника у мальчиков?", a: "На 4-м году", w: ["На 2-м году", "До рождения", "В 12 лет"], src: 'Синельников, с. 132' },
  ] },
  { id: 'tibia', title: 'Большеберцовая кость', facts: [
    { t: "4 центра", text: "Первичный — 2-й месяц внутриутробно; вторичные: проксимальный эпифиз — 9-й месяц внутриутробно, дистальный — 1-й год, бугристость — на 18-м году. Срастание — от 16–18 до 20–24 лет.",
      q: "Когда появляется центр окостенения бугристости большеберцовой кости?", a: "На 18-м году", w: ["На 1-м году", "На 9-м месяце внутриутробно", "В 5 лет"], src: 'Синельников, с. 132' },
  ] },
  { id: 'fibula', title: 'Малоберцовая кость', facts: [
    { t: "3 центра", text: "Первичный — середина 2-го месяца; вторичные: дистальный — 1-й год, проксимальный — 3–5-й. Дистальный эпифиз срастается в 17–20 лет, проксимальный — в 19–21 год.",
      q: "Какой эпифиз малоберцовой кости срастается позже?", a: "Проксимальный (19–21 год)", w: ["Дистальный (17–20 лет)", "Оба одновременно", "Дистальный (19–21 год)"], src: 'Синельников, с. 132' },
  ] },
  { id: 'foot', title: 'Стопа', facts: [
    { t: "Предплюсна", text: "Пяточная — 6-й месяц внутриутробно (+ вторичный центр бугра к 9 годам, срастание к 16–18); таранная — последние месяцы внутриутробно (до 8 лет); кубовидная — конец внутриутробного периода или 3–6 мес; ладьевидная — 3–5-й год; клиновидные — от конца 1-го до 3–4 лет.",
      q: "Какая кость предплюсны начинает окостеневать первой?", a: "Пяточная (6-й месяц внутриутробно)", w: ["Таранная", "Ладьевидная", "Кубовидная"], src: 'Синельников, с. 132' },
    { t: "Ладьевидная кость", text: "Ладьевидная кость стопы окостеневает из одного центра, появляющегося на 3–5-м году жизни.",
      q: "Когда появляется центр окостенения ладьевидной кости стопы?", a: "На 3–5-м году", w: ["До рождения", "На 1-м году", "В 12 лет"], src: 'Синельников, с. 132' },
    { t: "Плюсна и фаланги", text: "Плюсневые кости и фаланги — по два центра; вторичные появляются к 4-му году. Плюсневые срастаются к 17 годам у девушек и к 20 у юношей, фаланги — в 15–20 лет.",
      q: "Когда срастаются части плюсневых костей у юношей?", a: "К 20 годам", w: ["К 7 годам", "К 14 годам", "К 25 годам"], src: 'Синельников, с. 132' },
  ] },
];
const WALL_BONES = [
  { id: 'w_ptpal', title: 'Крыловидно-нёбная ямка', facts: [
    { t: 'Передняя стенка', text: 'Спереди крыловидно-нёбная ямка ограничена задней стороной бугра верхней челюсти.',
      q: 'Что образует переднюю стенку крыловидно-нёбной ямки?', a: 'Бугор верхней челюсти', w: ['Основание крыловидного отростка', 'Перпендикулярная пластинка нёбной кости', 'Большое крыло клиновидной кости'] },
    { t: 'Задняя стенка', text: 'Задней стенкой служит основание крыловидного отростка клиновидной кости.',
      q: 'Что образует заднюю стенку крыловидно-нёбной ямки?', a: 'Основание крыловидного отростка клиновидной кости', w: ['Бугор верхней челюсти', 'Перпендикулярная пластинка нёбной кости', 'Пирамида височной кости'] },
    { t: 'Медиальная стенка', text: 'Медиальная стенка образована перпендикулярной пластинкой нёбной кости.',
      q: 'Что образует медиальную стенку крыловидно-нёбной ямки?', a: 'Перпендикулярная пластинка нёбной кости', w: ['Горизонтальная пластинка нёбной кости', 'Латеральная пластинка крыловидного отростка', 'Сошник'] },
    { t: 'Латерально', text: 'Латерально крыловидно-нёбная ямка сообщается с подвисочной ямкой.',
      q: 'С чем латерально сообщается крыловидно-нёбная ямка?', a: 'С подвисочной ямкой', w: ['С височной ямкой', 'С глазницей', 'С полостью носа'] },
    { t: 'Отверстия', text: 'В стенках ямки 5 отверстий: клиновидно-нёбное, круглое, крыловидный канал, нижняя глазничная щель и большой нёбный канал.',
      q: 'Сколько отверстий в стенках крыловидно-нёбной ямки?', a: '5', w: ['3', '4', '7'] },
  ] },
  { id: 'w_temp', title: 'Височная и подвисочная ямки', facts: [
    { t: 'Височная ямка', text: 'Височная ямка лежит над подвисочным гребнем большого крыла клиновидной кости; сверху ограничена нижней височной линией.',
      q: 'Что отделяет височную ямку от подвисочной?', a: 'Подвисочный гребень большого крыла', w: ['Скуловая дуга', 'Нижняя височная линия', 'Клиновидно-чешуйчатый шов'] },
    { t: 'Верхняя стенка подвисочной', text: 'Верхняя стенка подвисочной ямки — нижняя поверхность большого крыла клиновидной кости и подвисочный гребень.',
      q: 'Что образует верхнюю стенку подвисочной ямки?', a: 'Нижняя поверхность большого крыла и подвисочный гребень', w: ['Чешуя височной кости', 'Скуловая дуга', 'Малое крыло клиновидной кости'] },
    { t: 'Медиальная стенка подвисочной', text: 'Медиальная стенка подвисочной ямки — латеральная пластинка крыловидного отростка.',
      q: 'Что образует медиальную стенку подвисочной ямки?', a: 'Латеральная пластинка крыловидного отростка', w: ['Медиальная пластинка крыловидного отростка', 'Перпендикулярная пластинка нёбной кости', 'Бугор верхней челюсти'] },
    { t: 'Передняя стенка подвисочной', text: 'Передняя стенка — задняя сторона бугра верхней челюсти и, отчасти, скуловая кость.',
      q: 'Что образует переднюю стенку подвисочной ямки?', a: 'Бугор верхней челюсти и отчасти скуловая кость', w: ['Большое крыло клиновидной кости', 'Латеральная пластинка крыловидного отростка', 'Ветвь нижней челюсти'] },
    { t: 'Каких стенок нет', text: 'Латеральной и нижней стенок у подвисочной ямки нет.',
      q: 'Каких стенок нет у подвисочной ямки?', a: 'Латеральной и нижней', w: ['Верхней и медиальной', 'Передней и задней', 'Только нижней'] },
    { t: 'Связь с глазницей', text: 'Спереди нижняя глазничная щель сообщает подвисочную ямку с глазницей.',
      q: 'Через что подвисочная ямка сообщается с глазницей?', a: 'Через нижнюю глазничную щель', w: ['Через верхнюю глазничную щель', 'Через круглое отверстие', 'Через клиновидно-нёбное отверстие'] },
  ] },
  { id: 'w_base', title: 'Основание черепа', facts: [
    { t: 'Граница свода и основания', text: 'Граница свода и основания: наружный затылочный выступ, верхняя выйная линия, основание сосцевидного отростка, над наружным слуховым отверстием, основание скулового отростка височной кости, подвисочный гребень, скуловой отросток лобной кости, надглазничный край до носолобного шва.',
      q: 'По какой выйной линии проходит граница свода и основания черепа?', a: 'По верхней выйной линии', w: ['По нижней выйной линии', 'По наивысшей выйной линии', 'По наружному затылочному гребню'] },
    { t: 'Передняя / средняя ямки', text: 'Граница между передней и средней черепными ямками — задний край малых крыльев клиновидной кости и бугорок седла.',
      q: 'Что разделяет переднюю и среднюю черепные ямки?', a: 'Задний край малых крыльев и бугорок седла', w: ['Верхний край пирамид и спинка седла', 'Петушиный гребень', 'Большие крылья клиновидной кости'] },
    { t: 'Средняя / задняя ямки', text: 'Граница между средней и задней черепными ямками — верхний край пирамид височных костей и спинка седла.',
      q: 'Что разделяет среднюю и заднюю черепные ямки?', a: 'Верхний край пирамид и спинка седла', w: ['Задний край малых крыльев и бугорок седла', 'Скат', 'Поперечная борозда'] },
  ] },
  { id: 'w_orbit', title: 'Глазница', facts: [
    { t: 'Верхняя стенка', text: 'Верхняя стенка глазницы — глазничная часть лобной кости и малое крыло клиновидной кости.',
      q: 'Что образует верхнюю стенку глазницы?', a: 'Глазничная часть лобной кости и малое крыло клиновидной', w: ['Глазничная часть лобной кости и большое крыло клиновидной', 'Глазничная пластинка решётчатой кости', 'Лобная кость и скуловая кость'] },
    { t: 'Нижняя стенка', text: 'Нижняя стенка — глазничная поверхность верхней челюсти и скуловой кости, глазничный отросток нёбной кости.',
      q: 'Какая кость, кроме верхней челюсти и скуловой, участвует в нижней стенке глазницы?', a: 'Нёбная (глазничный отросток)', w: ['Слёзная', 'Решётчатая', 'Клиновидная (большое крыло)'] },
    { t: 'Медиальная стенка', text: 'Медиальная стенка — лобный отросток верхней челюсти, слёзная кость, глазничная пластинка решётчатой кости, тело клиновидной кости и вверху глазничная часть лобной кости.',
      q: 'Какая пластинка решётчатой кости участвует в медиальной стенке глазницы?', a: 'Глазничная', w: ['Перпендикулярная', 'Решётчатая', 'Крючковидный отросток'] },
    { t: 'Латеральная стенка', text: 'Латеральная стенка — глазничная поверхность большого крыла клиновидной кости, лобный отросток скуловой кости и скуловой отросток лобной кости.',
      q: 'Что образует латеральную стенку глазницы?', a: 'Большое крыло клиновидной и скуловая кость (+ скуловой отросток лобной)', w: ['Малое крыло клиновидной и слёзная кость', 'Верхняя челюсть и нёбная кость', 'Решётчатая и слёзная кости'] },
  ] },
  { id: 'w_nasal', title: 'Полость носа', facts: [
    { t: 'Верхняя стенка', text: 'Верхняя стенка полости носа — носовые кости, носовая часть лобной кости, решётчатая пластинка решётчатой кости и нижняя поверхность тела клиновидной кости.',
      q: 'Какая часть решётчатой кости образует верхнюю стенку полости носа?', a: 'Решётчатая пластинка', w: ['Перпендикулярная пластинка', 'Глазничная пластинка', 'Решётчатый лабиринт'] },
    { t: 'Нижняя стенка', text: 'Нижняя стенка — нёбные отростки верхних челюстей и горизонтальные пластинки нёбных костей.',
      q: 'Что образует нижнюю стенку полости носа?', a: 'Нёбные отростки верхних челюстей и горизонтальные пластинки нёбных костей', w: ['Альвеолярные отростки верхних челюстей', 'Перпендикулярные пластинки нёбных костей', 'Сошник и нёбные кости'] },
    { t: 'Латеральная стенка', text: 'Латеральная стенка — тело и лобный отросток верхней челюсти, слёзная кость, решётчатый лабиринт, перпендикулярная пластинка нёбной кости и медиальная пластинка крыловидного отростка.',
      q: 'Какая пластинка крыловидного отростка участвует в латеральной стенке полости носа?', a: 'Медиальная', w: ['Латеральная', 'Обе', 'Ни одна'] },
    { t: 'Верхний носовой ход', text: 'Верхний носовой ход через клиновидно-решётчатое углубление сообщается с задними ячейками решётчатой кости и клиновидной пазухой.',
      q: 'В какой носовой ход открывается клиновидная пазуха?', a: 'В верхний', w: ['В средний', 'В нижний', 'В носоглоточный проход'] },
    { t: 'Средний носовой ход', text: 'Средний носовой ход сообщается с передними и средними решётчатыми ячейками, через полулунную расщелину — с верхнечелюстной пазухой, через решётчатую воронку — с лобной пазухой, через клиновидно-нёбное отверстие — с крыловидно-нёбной ямкой.',
      q: 'Куда открывается верхнечелюстная (гайморова) пазуха?', a: 'В средний носовой ход (через полулунную расщелину)', w: ['В верхний носовой ход', 'В нижний носовой ход', 'В клиновидно-решётчатое углубление'] },
    { t: 'Нижний носовой ход', text: 'Нижний носовой ход через носослёзный канал сообщается с глазницей.',
      q: 'Что открывается в нижний носовой ход?', a: 'Носослёзный канал', w: ['Лобная пазуха', 'Клиновидная пазуха', 'Задние решётчатые ячейки'] },
  ] },
];
WALL_BONES.forEach(b => b.facts.forEach((f, i) => { f.id = b.id + ':' + i; f.bone = b; }));
AGE_BONES.forEach(b => b.facts.forEach((f, i) => { f.id = b.id + ':' + i; f.bone = b; }));
let AGE_SET = 'age';
function curBones() { return AGE_SET === 'walls' ? WALL_BONES : AGE_BONES; }

const AGE_KEY = 'anatoQuestAge_v1';
function ageStore() { try { return JSON.parse(localStorage.getItem(AGE_KEY) || '{}'); } catch (e) { return {}; } }
function ageProfileData() { const all = ageStore(); return all[getActiveProfile() || ''] || {}; }
function ageRecord(factId, ok) {
  try {
    const all = ageStore(), p = getActiveProfile() || '';
    const d = all[p] = all[p] || {};
    const h = (d[factId] = d[factId] || []); h.push(ok ? 1 : 0); if (h.length > 6) h.splice(0, h.length - 6);
    localStorage.setItem(AGE_KEY, JSON.stringify(all));
  } catch (e) {}
}
/* «слабый» пункт: в последних 3 ответах есть ошибка и последний ответ — не верный */
function ageWeakFacts() {
  const d = ageProfileData();
  return curBones().flatMap(b => b.facts).filter(f => { const h = d[f.id]; return h && h.length && !h[h.length - 1]; });
}

let AGE = null;
let AGE_SEL = null;   /* выбранные кости на экране настройки */
let AGE_SEX = true;   /* включать половые различия */

function renderAgeSetup() {
  const want = VIEW.set || 'age';
  if (want !== AGE_SET) { AGE_SET = want; AGE_SEL = null; }
  if (!AGE_SEL) AGE_SEL = new Set(curBones().map(b => b.id));
  const weak = ageWeakFacts();
  let html = renderTopbar() + backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>${AGE_SET === 'walls' ? '🧭 Стенки, ямки и ходы' : '👶 Возрастные особенности'}</h1>
    <div class="hub-latin">${AGE_SET === 'walls' ? 'Череп в целом: чем образованы стенки ямок, глазницы и полости носа, куда открываются ходы (по карточкам Сапина).' : 'Каждая кость разбита на пункты по Привесу и Синельникову (у пунктов Синельникова указана страница). Выбери кости и формат.'}</div></div>
    <div class="game-body">
    <div class="exam-sec-head"><span>${AGE_SET === 'walls' ? 'Темы' : 'Кости'}</span>
      <button class="exam-sec-toggle" onclick="ageToggleAll()">${AGE_SEL.size === curBones().length ? 'снять все' : 'выбрать все'}</button></div>
    <div class="base-groups">${curBones().map(b => `<button class="base-chip ${AGE_SEL.has(b.id) ? 'on' : ''}" onclick="ageToggle('${b.id}')">${b.title}<span class="base-chip-n">${b.facts.length}</span></button>`).join('')}</div>
    ${AGE_SET === 'walls' ? '' : `<label class="guide-skip"><input type="checkbox" ${AGE_SEX ? 'checked' : ''} onchange="AGE_SEX=this.checked; render();">Включать половые различия</label>`}
    <div class="mode-grid" style="padding:0">
      <div class="mode-card" onclick="ageStart('tell')">
        <div class="mode-emoji">🗣️</div>
        <div class="mode-body"><div class="mode-title">Расскажи всё</div>
        <div class="mode-desc">Вспомни всё по теме, потом отметь галочками, какие пункты назвал</div></div></div>
      <div class="mode-card" onclick="ageStart('quiz')">
        <div class="mode-emoji">❓</div>
        <div class="mode-body"><div class="mode-title">По пунктам</div>
        <div class="mode-desc">Отдельный вопрос на каждый факт с вариантами ответа</div></div></div>
      ${weak.length ? `<div class="mode-card" onclick="ageStart('weak')">
        <div class="mode-emoji">🎯</div>
        <div class="mode-body"><div class="mode-title">Повторить ошибки</div>
        <div class="mode-desc">${weak.length} пункт(ов), которые не вспомнил или ответил неверно</div></div></div>` : ''}
    </div><div class="rc-msg bad" id="ageMsg"></div></div>`;
  document.getElementById('app').innerHTML = html;
}
function ageToggle(id) { AGE_SEL.has(id) ? AGE_SEL.delete(id) : AGE_SEL.add(id); render(); }
function ageToggleAll() { AGE_SEL = AGE_SEL.size === curBones().length ? new Set() : new Set(curBones().map(b => b.id)); render(); }
function ageFactsOf(b) { return b.facts.filter(f => AGE_SEX || !f.sex); }

function ageStart(kind) {
  let qs;
  if (kind === 'tell') {
    qs = shuffleArr(curBones().filter(b => AGE_SEL.has(b.id) && ageFactsOf(b).length)).map(b => ({ bone: b, facts: ageFactsOf(b), checked: new Set(), shown: false }));
  } else {
    const facts = kind === 'weak' ? ageWeakFacts() : curBones().filter(b => AGE_SEL.has(b.id)).flatMap(ageFactsOf);
    qs = shuffleArr(facts).map(f => ({ fact: f, opts: shuffleArr([f.a].concat(f.w)), pick: null }));
  }
  if (!qs.length) { const m = document.getElementById('ageMsg'); if (m) m.textContent = 'Выбери хотя бы одну кость'; return; }
  AGE = { kind, qs, idx: 0, got: 0, total: 0, missed: [] };
  goTo({ screen: 'age' });
}

function renderAge() {
  if (!AGE) return goTo({ screen: 'ageSetup' });
  const A = AGE;
  let html = renderTopbar();
  if (A.idx >= A.qs.length) return renderAgeResult();
  const q = A.qs[A.idx];
  html += `<div class="game-topbar">
      <button class="exit-x" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'ageSetup', set: AGE_SET }))})'>✕</button>
      <div class="game-progress-bar"><div class="game-progress-fill" style="width:${Math.round(A.idx / A.qs.length * 100)}%"></div></div>
      <div class="base-counter">${A.idx + 1}/${A.qs.length}</div></div><div class="game-body">`;
  if (A.kind === 'tell') {
    html += `<div class="pic-prompt"><div class="prompt-ru">${AGE_SET === 'walls' ? 'Расскажи' : 'Возрастные особенности'}: ${q.bone.title.toLowerCase()}</div>
      <div class="prompt-lat">Расскажи вслух или про себя — пунктов: ${q.facts.length}</div></div>`;
    if (!q.shown) {
      html += `<button class="btn btn-primary btn-block" onclick="AGE.qs[AGE.idx].shown=true; render();">Проверить себя</button>`;
    } else {
      html += `<div class="rc-sub">Отметь пункты, которые назвал:</div>` + q.facts.map((f, i) => `
        <label class="age-item ${q.checked.has(i) ? 'on' : ''}"><input type="checkbox" ${q.checked.has(i) ? 'checked' : ''} onchange="ageCheck(${i})">
          <span><b>${f.t}${f.sex ? ' <span class="rc-pair">пол</span>' : ''}</b><br>${f.text}${f.src ? `<span class="age-fsrc">${f.src}</span>` : ''}</span></label>`).join('') +
        `<button class="btn btn-primary btn-block" style="margin-top:12px" onclick="ageTellNext()">${A.idx + 1 >= A.qs.length ? 'Итоги →' : 'Дальше →'}</button>`;
    }
  } else {
    const f = q.fact;
    html += `<div class="ws-tag">${f.bone.title} · ${f.t}</div>
      <div class="speed-prompt"><div class="sp-main" style="font-size:19px">${f.q}</div></div><div class="speed-options">` +
      q.opts.map((o, i) => {
        let cls = 'speed-opt';
        if (q.pick !== null) { if (o === f.a) cls += ' opt-correct'; else if (q.pick === i) cls += ' opt-wrong'; }
        return `<button class="${cls}" onclick="ageAnswer(${i})" ${q.pick !== null ? 'disabled' : ''}>${o}</button>`;
      }).join('') + `</div>`;
    if (q.pick !== null) {
      const ok = q.opts[q.pick] === f.a;
      html += `<div class="base-answer tap-next ${ok ? 'ok' : 'bad'}" onclick="ageNext()"><div class="base-answer-head">${ok ? 'Верно!' : 'Не совсем'}<span class="tap-next-mini">дальше →</span></div>${f.text}${f.src ? `<span class="age-fsrc">${f.src}</span>` : ''}</div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="ageNext()">${A.idx + 1 >= A.qs.length ? 'Итоги →' : 'Далее →'}</button>`;
    }
  }
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}
function ageCheck(i) { const q = AGE.qs[AGE.idx]; q.checked.has(i) ? q.checked.delete(i) : q.checked.add(i); render(); }
function ageTellNext() {
  const q = AGE.qs[AGE.idx];
  q.facts.forEach((f, i) => { const ok = q.checked.has(i); ageRecord(f.id, ok); AGE.total++; if (ok) AGE.got++; else AGE.missed.push(f); });
  AGE.idx++; render(); window.scrollTo(0, 0);
}
function ageAnswer(i) {
  const q = AGE.qs[AGE.idx]; if (q.pick !== null) return;
  q.pick = i; const ok = q.opts[i] === q.fact.a;
  ageRecord(q.fact.id, ok); AGE.total++; if (ok) AGE.got++; else AGE.missed.push(q.fact);
  render();
}
function ageNext() { AGE.idx++; render(); window.scrollTo(0, 0); }

function renderAgeResult() {
  const A = AGE;
  if (!A.done) { A.done = true; addXp(A.got * 3); }
  const pct = A.total ? Math.round(A.got / A.total * 100) : 0;
  let html = renderTopbar() + `<div class="game-body"><div class="rc-score">${pct === 100 ? '🎉 ' : ''}${A.kind === 'tell' ? 'Вспомнил' : 'Верно'} ${A.got} из ${A.total} — ${pct}%</div>`;
  if (A.missed.length) {
    html += `<div class="rc-head">Повтори (${A.missed.length}) — они попали в «Повторить ошибки»</div>`;
    A.missed.forEach(f => { html += `<div class="rc-row miss"><b>${f.bone.title} · ${f.t}</b><br>${f.text}</div>`; });
  }
  html += `<div style="display:flex; gap:10px; margin-top:16px">
    <button class="btn btn-primary" style="flex:1" onclick="ageStart('${A.kind}')">Ещё раз</button>
    <button class="btn btn-ghost" style="flex:1" onclick='APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'ageSetup', set: AGE_SET }))})'>К выбору</button></div></div>`;
  document.getElementById('app').innerHTML = html;
}

/* ===================== ПРОГРАММА КУРСА ===================== */
/* Темы практических занятий кафедры. go — куда ведёт тема, если она уже есть в тренажёре (иначе серая).
   PROGRAM_NEXT — следующее занятие (сдвигать при обновлениях). */
const PROGRAM_NEXT = { sem: 1, n: 12 };
const PROGRAM = [
  { sem: 1, title: '1 семестр', year: '2026/27, 1 курс', lessons: [
    { t: 'Знакомство с кафедрой анатомии. Введение в анатомию. Общая остеология. Скелет туловища. Позвоночный столб, кости грудной клетки.', go: { screen: 'group', groupId: 'spine' } },
    { t: 'Кости пояса и свободной верхней конечности.', go: { screen: 'group', groupId: 'limbs' } },
    { t: 'Кости пояса и свободной нижней конечности.', go: { screen: 'group', groupId: 'limbs' } },
    { t: 'Обзорное занятие по скелету туловища и конечностей.', rev: 1, go: { screen: 'group', groupId: 'limbs' } },
    { t: 'Скелет головы. Кости мозгового отдела черепа.', go: { screen: 'group', groupId: 'skull' } },
    { t: 'Кости лицевого отдела черепа. Череп в целом. Возрастные и половые особенности черепа.', go: { screen: 'group', groupId: 'skull' } },
    { t: 'Обзорное занятие по черепу.', rev: 1, go: { screen: 'group', groupId: 'skull' } },
    { t: 'Общая артрология. Соединения между позвонками. Соединения позвоночника с черепом. Позвоночный столб в целом. Соединения рёбер. Грудная клетка в целом. Соединения костей головы.', go: { screen: 'group', groupId: 'a_axial' } },
    { t: 'Соединения костей пояса и свободной верхней конечности. Кисть как орган труда.', go: { screen: 'group', groupId: 'a_upper' } },
    { t: 'Соединения костей пояса и свободной нижней конечности. Стопа как целое.', go: { screen: 'group', groupId: 'a_lower' } },
    { t: 'Обзорное занятие по артрологии.', rev: 1, go: { screen: 'group', groupId: 'a_all' } },
    { t: 'Миология. Мышцы и фасции спины и живота. Паховый канал. Мышцы и фасции шеи. Топография шеи.', go: { screen: 'group', groupId: 'm_trunk' } },
    { t: 'Мышцы пояса и свободной верхней конечности. Фасции и топография верхней конечности.' },
    { t: 'Мышцы пояса и свободной нижней конечности. Фасции и топография нижней конечности.' },
    { t: 'Обзорное занятие по миологии. Подведение итогов I семестра.', rev: 1 },
  ] },
  { sem: 2, title: '2 семестр', year: '2026/27, 1 курс', lessons: [
    { t: 'Общий обзор органов пищеварения. Полость рта. Глотка.' },
    { t: 'Области живота. Брюшная полость. Желудок. Общие закономерности строения кишечника. Тонкая кишка. Толстая кишка.' },
    { t: 'Печень, поджелудочная железа. Брюшина.' },
    { t: 'Обзорное занятие по пищеварительной системе.', rev: 1 },
    { t: 'Дыхательная система. Область носа. Гортань. Лёгкое. Плевра. Средостение.' },
    { t: 'Мочеполовой аппарат. Мочевые органы. Мужские половые органы.' },
    { t: 'Женские половые органы. Промежность.' },
    { t: 'Обзорное занятие по дыхательной системе и мочеполовому аппарату.', rev: 1 },
    { t: 'Ангиология. Круги кровообращения. Сердце: наружное строение, камеры, строение стенки. Сосуды сердца. Перикард. Топография сердца. Сосуды малого круга кровообращения.' },
    { t: 'Сосуды большого круга кровообращения. Аорта. Ветви дуги аорты. Плечеголовной ствол. Общая и наружная сонные артерии. Внутренняя сонная и подключичная артерии.' },
    { t: 'Артерии предплечья и кисти. Ветви грудной и брюшной аорты.' },
    { t: 'Общая, наружная и внутренняя подвздошные артерии. Артерии свободной нижней конечности.' },
    { t: 'Вены большого круга кровообращения. Системы верхней и нижней полых вен. Воротная вена. Порто-кавальные и кава-кавальные анастомозы. Особенности кровообращения плода.' },
    { t: 'Общий план строения лимфатической системы. Лимфатические сосуды и узлы отдельных областей тела. Органы кроветворения и иммунной системы.' },
    { t: 'Обзорное занятие по артериальной, венозной и лимфатической системам. Подведение итогов II семестра.', rev: 1 },
  ] },
  { sem: 3, title: '3 семестр', year: '2027/28, 2 курс', lessons: [
    { t: 'Неврология. Центральная нервная система. Спинной мозг. Оболочки спинного мозга. Головной мозг. Общий обзор головного мозга. Эмбриогенез головного мозга.' },
    { t: 'Ромбовидный мозг. Продолговатый мозг. Перешеек ромбовидного мозга. IV желудочек. Ромбовидная ямка.' },
    { t: 'Средний мозг. Промежуточный мозг. Конечный мозг. Плащ. Морфологические основы динамической локализации функций в коре большого мозга. Обонятельный мозг.' },
    { t: 'Боковые желудочки. Базальные ядра. Белое вещество полушарий конечного мозга. Оболочки головного мозга. Спинномозговая жидкость.' },
    { t: 'Общий обзор основных проводящих путей нервной системы. Афферентные (восходящие) и эфферентные (нисходящие) проводящие пути.' },
    { t: 'Обзорное занятие по центральной нервной системе и проводящим путям нервной системы.', rev: 1 },
    { t: 'Спинномозговые нервы. Задние ветви спинномозговых нервов. Шейное сплетение. Плечевое сплетение (короткие ветви).' },
    { t: 'Плечевое сплетение (длинные ветви). Межрёберные нервы.' },
    { t: 'Поясничное, крестцовое и копчиковое сплетения спинномозговых нервов.' },
    { t: 'Обзорное занятие по спинномозговым нервам.', rev: 1 },
    { t: 'Черепные нервы: I, II, III, IV, V, VI пары.' },
    { t: 'Черепные нервы: VII, VIII, IX, X, XI, XII пары.' },
    { t: 'Вегетативная нервная система.' },
    { t: 'Обзорное занятие по черепным нервам и вегетативной нервной системе.', rev: 1 },
    { t: 'Орган зрения. Преддверно-улитковый орган. Кожа. Подведение итогов III семестра.', rev: 1 },
  ] },
];

const PROGRAM_KEY = 'anatoQuestProgramDone_v1';
function progDone() { try { return (JSON.parse(localStorage.getItem(PROGRAM_KEY) || '{}')[getActiveProfile() || '']) || {}; } catch (e) { return {}; } }
function progToggle(key) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRAM_KEY) || '{}'), p = getActiveProfile() || '';
    const d = all[p] = all[p] || {};
    if (d[key]) delete d[key]; else d[key] = 1;
    localStorage.setItem(PROGRAM_KEY, JSON.stringify(all));
  } catch (e) {}
  render();
}
let PROG_OPEN = null;   /* null — авто: на ПК раскрыта, на телефоне свёрнута */
function pcWide() { return !!(window.matchMedia && matchMedia('(min-width: 1100px)').matches); }
function progIsOpen() { return PROG_OPEN === null ? pcWide() : PROG_OPEN; }
if (window.matchMedia) matchMedia('(min-width: 1100px)').addEventListener('change', () => { if (VIEW.screen === 'map' && PROG_OPEN === null) render(); });
let PROG_SEM = PROGRAM_NEXT.sem;

function programBlockHtml() {
  const done = progDone();
  const total = PROGRAM.reduce((a, s) => a + s.lessons.length, 0);
  const doneN = Object.keys(done).length;
  let html = `<div class="section-block"><div class="prog-box">
    <div class="prog-head" onclick="PROG_OPEN=!progIsOpen(); render();">
      <span class="prog-ico">📅</span>
      <div class="node-body"><div class="node-title">Программа курса</div>
      <div class="node-latin">Следующее занятие: №${PROGRAM_NEXT.n}, ${PROGRAM_NEXT.sem} семестр · отмечено пройденных: ${doneN} из ${total}</div></div>
      <span class="prog-arrow">${progIsOpen() ? '▴' : '▾'}</span></div>`;
  if (progIsOpen()) {
    html += `<div class="prog-tabs">${PROGRAM.map(s => `<button class="base-chip ${PROG_SEM === s.sem ? 'on' : ''}" onclick="PROG_SEM=${s.sem}; render();">${s.title}</button>`).join('')}</div>`;
    const sem = PROGRAM.find(s => s.sem === PROG_SEM);
    html += `<div class="prog-year">${sem.year} · ✓ — отметь, что прошёл; серые темы в тренажёр ещё не добавлены</div>`;
    sem.lessons.forEach((l, i) => {
      const n = i + 1, key = sem.sem + ':' + n, isDone = !!done[key];
      const isNext = sem.sem === PROGRAM_NEXT.sem && n === PROGRAM_NEXT.n;
      const cls = ['prog-row', l.go ? 'prog-live' : 'prog-off', l.rev ? 'prog-rev' : '', isNext ? 'prog-next' : '', isDone ? 'prog-done' : ''].join(' ');
      const open = l.go ? ` onclick='APP.goToJSON(${JSON.stringify(JSON.stringify(l.go))})'` : '';
      html += `<div class="${cls}">
        <button class="prog-check" onclick="progToggle('${key}')" title="Отметить как пройденное">${isDone ? '✓' : ''}</button>
        <div class="prog-n">№${n}</div>
        <div class="prog-t"${open}>${isNext ? '<span class="new-badge">следующее</span> ' : ''}${l.rev ? '<b>' + l.t + '</b>' : l.t}${l.go ? ' <span class="prog-go">→ в тренажёр</span>' : ''}</div>
      </div>`;
    });
  }
  html += `</div></div>`;
  return html;
}

const SCENARIOS = {"pelvis": {"src": "с. 156–159", "steps": [{"t": "Тазовая кость — os coxae", "text": "Парная кость, образующая пояс нижней конечности (cingulum membri inferioris). Плоская кость; функции: движение (сочленения с крестцом — os sacrum — и бедром — femur), защита органов таза (pelvis) и опора. Образована слиянием трёх костей — подвздошной (os ilium), лобковой (os pubis) и седалищной (os ischii)."}, {"t": "Вертлужная впадина — acetabulum", "h": ["acetabulum", "facies_lunata", "fossa_acetabuli", "limbus_acetabuli"], "text": "Место сращения трёх костей, на наружной стороне тазовой кости. Сочленяется с головкой бедренной кости (caput ossis femoris) — тазобедренный сустав (articulatio coxae). Гладкая полулунная поверхность (facies lunata); центр — шероховатая ямка вертлужной впадины (fossa acetabuli). Край (limbus acetabuli) прерывается вырезкой (incisura acetabuli)."}, {"t": "Подвздошная кость — os ilium", "h": ["os_ilium", "corpus_ossis_ilii", "ala_ossis_ilii"], "text": "Лежит кверху от вертлужной впадины (acetabulum). Нижний толстый отдел — тело (corpus ossis ilii), сливается с остальными частями в области впадины; верхний расширенный — крыло (ala ossis ilii)."}, {"t": "Подвздошный гребень — crista iliaca", "h": ["crista_iliaca", "labium_externum", "linea_intermedia", "labium_internum"], "text": "Верхний свободный край крыла (ala ossis ilii), утолщённый, S-образно изогнутый: наружная губа (labium externum), промежуточная линия (linea intermedia), внутренняя губа (labium internum). К нему прикрепляются три широкие мышцы живота (mm. abdominis)."}, {"t": "Подвздошные ости — spinae iliacae", "h": ["spina_iliaca_anterior_superior", "spina_iliaca_anterior_inferior", "spina_iliaca_posterior_superior", "spina_iliaca_posterior_inferior"], "text": "Гребень (crista iliaca) спереди заканчивается верхней передней подвздошной остью (spina iliaca anterior superior), сзади — верхней задней (spina iliaca posterior superior). Ниже каждой — нижняя передняя (spina iliaca anterior inferior) и нижняя задняя (spina iliaca posterior inferior) ости."}, {"t": "Подвздошная ямка — fossa iliaca", "h": ["fossa_iliaca", "linea_arcuata"], "text": "Гладкая, слегка вогнутая внутренняя поверхность крыла (ala ossis ilii) — поддержание внутренностей при вертикальном положении тела. Отделяется от тела (corpus ossis ilii) дугообразной линией (linea arcuata)."}, {"t": "Ушковидная поверхность — facies auricularis", "h": ["facies_auricularis", "tuberositas_iliaca"], "text": "Сзади и книзу от подвздошной ямки (fossa iliaca); сочленяется с ушковидной поверхностью крестца (facies auricularis ossis sacri) — крестцово-подвздошный сустав (articulatio sacroiliaca). Сзади и выше — подвздошная бугристость (tuberositas iliaca) для межкостных крестцово-подвздошных связок (ligg. sacroiliaca interossea)."}, {"t": "Ягодичные линии — lineae gluteae", "h": ["linea_glutea_anterior", "linea_glutea_posterior", "linea_glutea_inferior", "facies_glutea"], "text": "Шероховатые линии на наружной — ягодичной — поверхности крыла (facies glutea): передняя (linea glutea anterior), задняя (linea glutea posterior), нижняя (linea glutea inferior). Следы прикрепления ягодичных мышц (mm. glutei)."}, {"t": "Подвздошно-лобковое возвышение — eminentia iliopubica", "h": ["eminentia_iliopubica"], "text": "Книзу и кпереди от нижней передней ости (spina iliaca anterior inferior), на месте соединения подвздошной кости (os ilium) с лобковой (os pubis)."}, {"t": "Большая седалищная вырезка — incisura ischiadica major", "h": ["incisura_ischiadica_major"], "text": "Книзу от нижней задней ости (spina iliaca posterior inferior); замыкается внизу седалищной остью (spina ischiadica)."}, {"t": "Лобковая кость — os pubis", "h": ["os_pubis", "corpus_ossis_pubis", "ramus_superior_ossis_pubis", "ramus_inferior_ossis_pubis"], "text": "Лежит книзу и кпереди от вертлужной впадины (acetabulum). Короткое тело (corpus ossis pubis) примыкает к впадине; верхняя (ramus superior ossis pubis) и нижняя (ramus inferior ossis pubis) ветви расположены под углом друг к другу."}, {"t": "Симфизиальная поверхность — facies symphysialis", "h": ["facies_symphysialis"], "text": "Овальная поверхность на вершине угла, обращённого к средней линии, — место соединения с лобковой костью другой стороны: лобковый симфиз (symphysis pubica)."}, {"t": "Лобковый бугорок и гребень — tuberculum pubicum, pecten ossis pubis", "h": ["tuberculum_pubicum", "pecten_ossis_pubis"], "text": "Лобковый бугорок (tuberculum pubicum) — в 2 см латеральнее симфизиальной поверхности (facies symphysialis). От него вдоль заднего края верхней ветви (ramus superior) тянется гребень лобковой кости (pecten ossis pubis), переходящий кзади в дугообразную линию (linea arcuata). Снизу на верхней ветви — запирательная борозда (sulcus obturatorius)."}, {"t": "Седалищная кость — os ischii", "h": ["os_ischii", "corpus_ossis_ischii", "ramus_ossis_ischii"], "text": "Лежит книзу и кзади от вертлужной впадины (acetabulum). Тело (corpus ossis ischii) входит в состав впадины, ветвь (ramus ossis ischii) образует с ним угол."}, {"t": "Седалищный бугор — tuber ischiadicum", "h": ["tuber_ischiadicum"], "text": "Сильно утолщённая вершина угла между телом (corpus ossis ischii) и ветвью (ramus ossis ischii)."}, {"t": "Седалищная ость и малая вырезка — spina ischiadica, incisura ischiadica minor", "h": ["spina_ischiadica", "incisura_ischiadica_minor"], "text": "По заднему краю тела кверху от бугра (tuber ischiadicum) — малая седалищная вырезка (incisura ischiadica minor); седалищная ость (spina ischiadica) отделяет её от большой (incisura ischiadica major)."}, {"t": "Запирательное отверстие — foramen obturatum", "h": ["foramen_obturatum"], "text": "Ветвь седалищной кости (ramus ossis ischii) сливается с нижней ветвью лобковой (ramus inferior ossis pubis) — ветви окружают запирательное отверстие (foramen obturatum). Лежит книзу и медиально от вертлужной впадины (acetabulum), треугольное с закруглёнными углами."}, {"t": "Окостенение — ossificatio", "text": "У новорождённого три части разделены хрящом (cartilago). К 8-му году ветви лобковой (os pubis) и седалищной (os ischii) костей сливаются (os ischiopubicum); в 14–16 лет в области вертлужной впадины (acetabulum) образуется единая тазовая кость (os coxae). Добавочные точки (12–19 лет) сливаются в 20–25 лет; могут остаться ossa acetabuli."}]}, "femur": {"src": "с. 164–165, 168, 170", "steps": [{"t": "Бедренная кость — femur", "text": "Кость свободной нижней конечности (skeleton membri inferioris liberi) — бедро. Самая большая и толстая из длинных трубчатых костей, длинный рычаг движения: диафиз (diaphysis), метафизы (metaphyses), эпифизы (epiphyses) и апофизы (apophyses)."}, {"t": "Головка — caput ossis femoris", "h": ["caput_ossis_femoris"], "text": "Круглая суставная головка проксимального конца — эпифиз (epiphysis). Сочленяется с вертлужной впадиной (acetabulum, facies lunata) — тазобедренный сустав (articulatio coxae)."}, {"t": "Ямка головки — fovea capitis ossis femoris", "h": ["fovea_capitis_ossis_femoris"], "text": "Небольшая шероховатая ямка несколько книзу от середины головки (caput ossis femoris) — место прикрепления связки головки бедренной кости (lig. capitis femoris)."}, {"t": "Шейка — collum ossis femoris", "h": ["collum_ossis_femoris"], "text": "Соединяет головку (caput) с телом (corpus) под тупым углом (около 114–153°); у женщин угол ближе к прямому."}, {"t": "Большой вертел — trochanter major", "h": ["trochanter_major", "fossa_trochanterica"], "text": "Верхнее окончание тела бедренной кости — апофиз (apophysis). На медиальной поверхности, обращённой к шейке (collum), — вертельная ямка (fossa trochanterica)."}, {"t": "Малый вертел — trochanter minor", "h": ["trochanter_minor"], "text": "У нижнего края шейки (collum ossis femoris) с медиальной стороны и несколько кзади — апофиз (apophysis)."}, {"t": "Межвертельные гребень и линия — crista et linea intertrochanterica", "h": ["crista_intertrochanterica", "linea_intertrochanterica"], "text": "Соединяют вертелы (trochanteres): сзади — межвертельный гребень (crista intertrochanterica), спереди — межвертельная линия (linea intertrochanterica). Вертелы, гребень, линия и ямка обусловлены прикреплением мышц."}, {"t": "Тело — corpus ossis femoris", "h": ["corpus_ossis_femoris"], "text": "Несколько выгнуто кпереди, трёхгранно-закруглённое; передняя поверхность (facies anterior)."}, {"t": "Шероховатая линия — linea aspera", "h": ["linea_aspera", "labium_laterale", "labium_mediale", "linea_pectinea"], "text": "След прикрепления мышц бедра на задней стороне тела; состоит из латеральной (labium laterale) и медиальной (labium mediale) губ. Вверху латеральная губа переходит в ягодичную бугристость (tuberositas glutea), медиальная — в гребенчатую линию (linea pectinea)."}, {"t": "Подколенная поверхность — facies poplitea", "h": ["facies_poplitea", "linea_supracondylaris_medialis", "linea_supracondylaris_lateralis"], "text": "Гладкая треугольная площадка внизу задней поверхности, ограниченная расходящимися губами шероховатой линии — медиальной (linea supracondylaris medialis) и латеральной (linea supracondylaris lateralis) надмыщелковыми линиями."}, {"t": "Мыщелки — condylus medialis et lateralis", "h": ["condylus_medialis", "condylus_lateralis"], "text": "Два округлых, заворачивающихся назад мыщелка утолщённого дистального конца — эпифиз (epiphysis). Медиальный (condylus medialis) больше выдаётся книзу, но оба стоят на одном уровне, так как бедро расположено косо. Сочленяются с большеберцовой костью (tibia) — коленный сустав (articulatio genus)."}, {"t": "Надколенниковая поверхность — facies patellaris", "h": ["facies_patellaris"], "text": "Спереди суставные поверхности мыщелков (condyli) переходят друг в друга — к ней прилежит задней суставной поверхностью надколенник (patella)."}, {"t": "Межмыщелковая ямка — fossa intercondylaris", "h": ["fossa_intercondylaris", "linea_intercondylaris"], "text": "Глубокая ямка, разделяющая мыщелки (condyli) на задней и нижней сторонах; сверху ограничена межмыщелковой линией (linea intercondylaris)."}, {"t": "Надмыщелки — epicondylus medialis et lateralis", "h": ["epicondylus_medialis", "epicondylus_lateralis", "tuberculum_adductorium"], "text": "Шероховатые бугры сбоку на каждом мыщелке выше суставной поверхности: медиальный (epicondylus medialis) с приводящим бугорком (tuberculum adductorium) и латеральный (epicondylus lateralis)."}, {"t": "Надколенник — patella", "h": ["basis_patellae", "apex_patellae", "facies_articularis_patellae", "facies_anterior_patellae"], "text": "Большая сесамовидная кость (os sesamoideum) в толще сухожилия четырёхглавой мышцы бедра (m. quadriceps femoris). Верхний широкий конец — основание (basis patellae), нижний заострённый — верхушка (apex patellae). Задней суставной поверхностью (facies articularis) прилежит к надколенниковой поверхности бедра (facies patellaris)."}, {"t": "Окостенение — ossificatio", "text": "У новорождённого виден только диафиз (diaphysis); точка в головке (caput ossis femoris) появляется на 1-м году. Точка в дистальном эпифизе (epiphysis distalis) — незадолго до рождения или вскоре после (признак доношенности). Надколенник (patella) развивается из нескольких точек, сливающихся в 3–5 лет (иначе — patella bipartita). Синостоз эпифизов бедра — в 14–16 лет."}]}, "tibia": {"src": "с. 168–170", "steps": [{"t": "Большеберцовая кость — tibia", "text": "Кость голени (crus), лежит медиально; длинная трубчатая. Единственная из костей голени сочленяется с бедренной костью (femur) и несёт на себе всю тяжесть тела — поэтому толще малоберцовой (fibula)."}, {"t": "Мыщелки — condylus medialis et lateralis", "h": ["condylus_medialis", "condylus_lateralis"], "text": "Проксимальный конец — эпифиз (epiphysis) — образует медиальный (condylus medialis) и латеральный (condylus lateralis) мыщелки; их верхние суставные поверхности (facies articularis superior) сочленяются с мыщелками бедренной кости (condyli femoris) — коленный сустав (articulatio genus)."}, {"t": "Межмыщелковое возвышение — eminentia intercondylaris", "h": ["eminentia_intercondylaris", "tuberculum_intercondylare_mediale", "tuberculum_intercondylare_laterale", "area_intercondylaris_posterior"], "text": "Разделяет суставные поверхности мыщелков; имеет медиальный (tuberculum intercondylare mediale) и латеральный (tuberculum intercondylare laterale) бугорки. Спереди и сзади — переднее (area intercondylaris anterior) и заднее (area intercondylaris posterior) межмыщелковые поля — прикрепление крестообразных связок (ligg. cruciata)."}, {"t": "Бугристость — tuberositas tibiae", "h": ["tuberositas_tibiae"], "text": "Массивная шероховатая бугристость на передней поверхности ниже мыщелков — апофиз (apophysis); место прикрепления сухожилия четырёхглавой мышцы бедра (m. quadriceps femoris) в виде связки надколенника (lig. patellae)."}, {"t": "Малоберцовая суставная поверхность — facies articularis fibularis", "h": ["facies_articularis_fibularis"], "text": "Небольшая плоская площадка на заднебоковой части латерального мыщелка (condylus lateralis) — сочленение с головкой малоберцовой кости (caput fibulae): межберцовый сустав (articulatio tibiofibularis)."}, {"t": "Тело — corpus tibiae", "h": ["corpus_tibiae", "margo_anterior", "margo_medialis", "margo_interosseus", "facies_posterior", "facies_lateralis"], "text": "Трёхгранное: три края — передний (margo anterior), медиальный (margo medialis), межкостный (margo interosseus) для межкостной перепонки (membrana interossea cruris) — и три поверхности: задняя (facies posterior), медиальная (facies medialis), латеральная (facies lateralis). Медиальная поверхность и передний край прощупываются под кожей."}, {"t": "Линия камбаловидной мышцы — linea musculi solei", "h": ["linea_musculi_solei", "foramen_nutricium"], "text": "На задней поверхности тела (facies posterior) — линия камбаловидной мышцы (linea m. solei); там же — питательное отверстие (foramen nutricium)."}, {"t": "Медиальная лодыжка — malleolus medialis", "h": ["malleolus_medialis", "sulcus_malleolaris"], "text": "Крепкий отросток дистального конца — эпифиза (epiphysis) — с медиальной стороны. Позади — лодыжковая борозда (sulcus malleolaris), след прохождения сухожилия."}, {"t": "Нижняя суставная поверхность — facies articularis inferior", "h": ["facies_articularis_inferior"], "text": "Сочленяется с блоком таранной кости (trochlea tali) — голеностопный сустав (articulatio talocruralis); на латеральной стороне медиальной лодыжки — суставная поверхность лодыжки (facies articularis malleoli)."}, {"t": "Малоберцовая вырезка — incisura fibularis", "h": ["incisura_fibularis"], "text": "На латеральном крае дистального конца — место соединения с малоберцовой костью (fibula): межберцовый синдесмоз (syndesmosis tibiofibularis)."}, {"t": "Окостенение — ossificatio", "text": "Точка в проксимальном эпифизе (epiphysis proximalis) — незадолго до рождения или вскоре после. Бугристость (tuberositas tibiae) развивается из множественных точек (у девочек 11–13 лет, у мальчиков 12–15 лет). Синостоз проксимального эпифиза — в 14–16 лет, дистального — в 16–19 лет."}]}, "fibula": {"src": "с. 168–170", "steps": [{"t": "Малоберцовая кость — fibula", "text": "Кость голени (crus), лежит латерально. Тонкая и длинная трубчатая кость с утолщёнными концами; с бедренной костью (femur) не сочленяется."}, {"t": "Головка — caput fibulae", "h": ["caput_fibulae", "facies_articularis_capitis_fibulae"], "text": "Верхний (проксимальный) эпифиз (epiphysis). Плоской суставной поверхностью головки (facies articularis capitis fibulae) сочленяется с латеральным мыщелком большеберцовой кости (condylus lateralis tibiae) — межберцовый сустав (articulatio tibiofibularis)."}, {"t": "Верхушка головки — apex capitis fibulae", "h": ["apex_capitis_fibulae"], "text": "Костный выступ кверху, несколько кзади и вбок от суставной поверхности головки (facies articularis capitis fibulae)."}, {"t": "Шейка — collum fibulae", "h": ["collum_fibulae"], "text": "Переход головки (caput fibulae) в тело (corpus fibulae)."}, {"t": "Тело — corpus fibulae", "h": ["corpus_fibulae", "margo_interosseus", "margo_anterior", "margo_posterior", "facies_lateralis", "facies_medialis"], "text": "Трёхгранное, как бы скручено по продольной оси: края — передний (margo anterior), задний (margo posterior), межкостный (margo interosseus); поверхности — латеральная (facies lateralis), медиальная (facies medialis), задняя. Межкостный край обращён к большеберцовой кости — для межкостной перепонки голени (membrana interossea cruris)."}, {"t": "Латеральная лодыжка — malleolus lateralis", "h": ["malleolus_lateralis", "facies_articularis_malleoli"], "text": "Утолщённый дистальный эпифиз (epiphysis distalis); суставная поверхность лодыжки (facies articularis malleoli) сочленяется с блоком таранной кости (trochlea tali) — голеностопный сустав (articulatio talocruralis)."}, {"t": "Окостенение — ossificatio", "text": "Точка в проксимальном эпифизе (epiphysis proximalis) — на 3–5-м году, в дистальном (epiphysis distalis) — на 2-м году. Синостоз проксимального эпифиза — в 14–15 лет, дистального — в 20–22 года."}]}, "foot": {"src": "с. 174–177", "steps": [{"t": "Кости стопы — ossa pedis", "text": "Различают предплюсну (tarsus) — 7 коротких губчатых костей (ossa tarsi) в два ряда, плюсну (metatarsus) и кости пальцев стопы (ossa digitorum pedis)."}, {"t": "Таранная кость — talus", "h": ["talus", "collum_tali"], "text": "Проксимальный ряд. Тело (corpus tali) продолжается вперёд в шейку (collum tali) и головку (caput tali); суставная поверхность головки (facies articularis navicularis) сочленяется с ладьевидной костью (os naviculare). Снизу — суставные поверхности для пяточной кости (calcaneus); между ними — борозда таранной кости (sulcus tali)."}, {"t": "Блок таранной кости — trochlea tali", "h": ["trochlea_tali", "facies_malleolaris_medialis", "processus_lateralis_tali"], "text": "На верхней стороне тела; верхняя поверхность (facies superior) сочленяется с большеберцовой костью (tibia) — голеностопный сустав (articulatio talocruralis). Боковые лодыжковые поверхности — медиальная (facies malleolaris medialis) и латеральная (facies malleolaris lateralis) — для лодыжек; латеральная загибается на латеральный отросток (processus lateralis tali). Сзади — задний отросток (processus posterior tali)."}, {"t": "Пяточная кость — calcaneus", "h": ["calcaneus"], "text": "Проксимальный ряд, под таранной костью (talus); самая крупная кость стопы. Сверху — суставные поверхности для таранной кости; медиально — опора таранной кости (sustentaculum tali); спереди — седловидная кубовидная поверхность (facies articularis cuboidea). Борозда пяточной кости (sulcus calcanei) с бороздой таранной (sulcus tali) образует пазуху предплюсны (sinus tarsi)."}, {"t": "Пяточный бугор — tuber calcanei", "h": ["tuber_calcanei", "processus_lateralis_tuberis_calcanei"], "text": "Шероховатый задний конец пяточной кости (calcaneus); к подошве образует латеральный (processus lateralis tuberis calcanei) и медиальный (processus medialis tuberis calcanei) отростки."}, {"t": "Ладьевидная кость — os naviculare", "h": ["os_naviculare"], "text": "Между головкой таранной кости (caput tali) и тремя клиновидными костями (ossa cuneiformia). Медиально и книзу — бугристость (tuberositas ossis navicularis), легко прощупываемая через кожу."}, {"t": "Клиновидные кости — ossa cuneiformia", "h": ["os_cuneiforme_mediale", "os_cuneiforme_intermedium", "os_cuneiforme_laterale"], "text": "Медиальная (os cuneiforme mediale) — самая большая, промежуточная (os cuneiforme intermedium) — самая маленькая, латеральная (os cuneiforme laterale). Сочленяются с ладьевидной костью (os naviculare) и основаниями I–III плюсневых костей (ossa metatarsalia)."}, {"t": "Кубовидная кость — os cuboideum", "h": ["os_cuboideum"], "text": "На латеральном крае стопы между пяточной костью (calcaneus) и основаниями IV и V плюсневых костей. Снизу — бугристость (tuberositas ossis cuboidei) и борозда сухожилия длинной малоберцовой мышцы (sulcus tendinis m. peronei longi)."}, {"t": "Плюсна — ossa metatarsalia", "h": ["os_metatarsale_i", "os_metatarsale_ii", "basis_ossis_metatarsalis", "caput_ossis_metatarsalis", "tuberositas_ossis_metatarsalis_v"], "text": "Пять коротких трубчатых костей (ossa metatarsalia I–V), счёт от медиального края. Основание (basis), тело (corpus), головка (caput). I–III сочленяются с клиновидными (ossa cuneiformia), IV–V — с кубовидной (os cuboideum). Основание V несёт бугристость (tuberositas ossis metatarsalis V). I — самая короткая и толстая, II — самая длинная."}, {"t": "Фаланги — phalanges", "h": ["phalanx_proximalis", "phalanx_media", "phalanx_distalis", "tuberositas_phalangis_distalis"], "text": "По три фаланги — проксимальная (phalanx proximalis), средняя (phalanx media), дистальная (phalanx distalis); у I пальца (hallux) — две. Дистальные фаланги несут бугристость (tuberositas phalangis distalis). Сесамовидные кости (ossa sesamoidea) — у плюснефаланговых суставов (у I пальца постоянно)."}, {"t": "Окостенение — ossificatio", "text": "Точки: пяточная (calcaneus) — 6-й месяц внутриутробно, таранная (talus) — 7–8-й, кубовидная (os cuboideum) — 9-й месяц, латеральная клиновидная — 1-й год, медиальная — 2–4-й, промежуточная — 3–4-й, ладьевидная (os naviculare) — 4–5-й год. Пяточный бугор (tuber calcanei) окостеневает в 7–9 лет и сливается к 12–15 годам."}]}, "occipital": {"src": "с. 105–107, 126", "steps": [{"t": "Затылочная кость — os occipitale", "h": ["os_occipitale"], "text": "Кость мозгового черепа (cranium cerebrale), образует заднюю и нижнюю стенки черепной коробки — участвует и в своде (calvaria), и в основании (basis cranii). Смешанная кость: верх чешуи окостеневает на соединительной ткани, остальное — на хряще. Состоит из четырёх частей, срастающихся в 3–6 лет."}, {"t": "Большое затылочное отверстие — foramen magnum", "h": ["foramen_magnum"], "text": "Окружено четырьмя частями кости; место перехода спинного мозга (medulla spinalis) из позвоночного канала (canalis vertebralis) в полость черепа (cavitas cranii) — в продолговатый мозг (medulla oblongata)."}, {"t": "Базилярная часть — pars basilaris", "h": ["pars_basilaris", "clivus"], "text": "Спереди от отверстия. К 18 годам срастается с клиновидной костью (os sphenoidale) в единую основную кость (os basilare). На верхней поверхности — скат (clivus), на котором лежат продолговатый мозг (medulla oblongata) и мост (pons)."}, {"t": "Глоточный бугорок — tuberculum pharyngeum", "h": ["tuberculum_pharyngeum"], "text": "На нижней поверхности базилярной части (pars basilaris); к нему прикрепляется фиброзная оболочка глотки (fascia pharyngobasilaris)."}, {"t": "Латеральные части — partes laterales", "h": ["pars_lateralis", "condylus_occipitalis"], "text": "По сторонам от отверстия; участвуют в соединении черепа с позвоночником (columna vertebralis). Снизу — затылочный мыщелок (condylus occipitalis) с суставной поверхностью для атланта (atlas) — атлантозатылочный сустав (articulatio atlantooccipitalis)."}, {"t": "Подъязычный канал — canalis hypoglossalis", "h": ["canalis_hypoglossi", "canalis_condylaris", "fossa_condylaris"], "text": "Проходит сквозь кость около середины мыщелка — для подъязычного нерва (n. hypoglossus, XII пара). Позади мыщелка — мыщелковая ямка (fossa condylaris) с непостоянным мыщелковым каналом (canalis condylaris)."}, {"t": "Яремная вырезка и отросток — incisura et processus jugularis", "h": ["incisura_jugularis", "processus_jugularis", "processus_intrajugularis", "tuberculum_jugulare"], "text": "На латеральной части; яремная вырезка (incisura jugularis) вместе с одноимённой вырезкой височной кости (os temporale) образует яремное отверстие (foramen jugulare). Её делит внутриярёмный отросток (processus intrajugularis); латерально — яремный отросток (processus jugularis), сверху — яремный бугорок (tuberculum jugulare). На верхней поверхности латеральной части — борозда сигмовидного синуса (sulcus sinus sigmoidei)."}, {"t": "Затылочная чешуя — squama occipitalis", "h": ["squama_occipitalis"], "text": "Сзади от отверстия; покровная кость — пластинка, выпуклая снаружи и вогнутая изнутри. Верх чешуи окостеневает отдельно и может остаться межтеменной костью (os interparietale)."}, {"t": "Наружный рельеф чешуи — facies externa", "h": ["protuberantia_occipitalis_externa", "crista_occipitalis_externa", "linea_nuchalis_superior", "linea_nuchalis_suprema", "linea_nuchalis_inferior"], "text": "В центре — наружный затылочный выступ (protuberantia occipitalis externa; место появления точки окостенения). От него в стороны — верхняя выйная линия (linea nuchalis superior), выше — наивысшая (linea nuchalis suprema); вниз к отверстию — наружный затылочный гребень (crista occipitalis externa), от середины которого идут нижние выйные линии (lineae nuchales inferiores). Рельеф обусловлен прикреплением мышц и связок."}, {"t": "Внутренний рельеф чешуи — facies interna", "h": ["eminentia_cruciformis", "protuberantia_occipitalis_interna", "crista_occipitalis_interna", "sulcus_sagittalis", "sulcus_transversi"], "text": "Два перекрещивающихся гребня образуют крестообразное возвышение (eminentia cruciformis), на перекресте — внутренний затылочный выступ (protuberantia occipitalis interna). Нижняя половина продольного гребня — внутренний затылочный гребень (crista occipitalis interna); верхняя и поперечные несут борозды верхнего сагиттального (sulcus sinus sagittalis superioris) и поперечного (sulcus sinus transversi) синусов."}, {"t": "Ламбдовидный край — margo lambdoideus", "h": ["margo_lambdoideus"], "text": "Соединяется с теменными костями (ossa parietalia) — ламбдовидный шов (sutura lambdoidea). Внизу сосцевидный край (margo mastoideus) — с сосцевидной частью височной кости."}]}, "sphenoid": {"src": "с. 107–109", "steps": [{"t": "Клиновидная кость — os sphenoidale", "h": ["corpus_ossis_sphenoidalis"], "text": "Непарная кость в центре основания черепа (basis cranii), напоминает летящее насекомое. Смешанная кость: к рождению — 3 части, срастающиеся к концу 1-го года. Части: тело (corpus), большие крылья (alae majores), малые крылья (alae minores), крыловидные отростки (processus pterygoidei)."}, {"t": "Тело — corpus", "h": ["corpus_ossis_sphenoidalis", "dorsum_sellae", "processus_clinoideus_posterior"], "text": "Сверху — турецкое седло (sella turcica) с ямкой гипофиза (fossa hypophysialis); спереди — бугорок седла (tuberculum sellae) с предперекрёстной бороздой (sulcus prechiasmaticus), сзади — спинка седла (dorsum sellae) с задними наклонёнными отростками (processus clinoidei posteriores)."}, {"t": "Сонная борозда — sulcus caroticus", "h": ["sulcus_caroticus", "lingula_sphenoidalis"], "text": "На боковой поверхности тела — след внутренней сонной артерии (a. carotis interna); латерально её ограничивает клиновидный язычок (lingula sphenoidalis)."}, {"t": "Клиновидная пазуха — sinus sphenoidalis", "h": ["apertura_sinus_sphenoidalis", "crista_sphenoidalis", "rostrum_sphenoidale", "concha_sphenoidalis"], "text": "Воздухоносная пазуха в теле, разделена перегородкой (septum sinuum sphenoidalium). Апертуры (aperturae sinus sphenoidalis) по сторонам клиновидного гребня (crista sphenoidalis) сообщают её с полостью носа (cavitas nasi). Гребень соединяется с перпендикулярной пластинкой решётчатой кости (lamina perpendicularis ossis ethmoidalis), а клиновидный клюв (rostrum sphenoidale) входит между крыльями сошника (alae vomeris). По бокам — клиновидные раковины (conchae sphenoidales)."}, {"t": "Малые крылья — alae minores", "h": ["ala_minor", "canalis_opticus", "processus_clinoideus_anterior"], "text": "Две треугольные пластинки, отходят двумя корнями от передневерхнего края тела. Между корнями — зрительный канал (canalis opticus) для зрительного нерва (n. opticus) и глазной артерии (a. ophthalmica). Медиально-кзади — передние наклонённые отростки (processus clinoidei anteriores)."}, {"t": "Верхняя глазничная щель — fissura orbitalis superior", "h": ["fissura_orbitalis_superior"], "text": "Между малыми (alae minores) и большими (alae majores) крыльями; ведёт из полости черепа (cavitas cranii) в глазницу (orbita)."}, {"t": "Большие крылья — alae majores", "h": ["ala_major", "foramen_rotundum"], "text": "Отходят от боковых поверхностей тела латерально и вверх. Близ тела — круглое отверстие (foramen rotundum; II ветвь тройничного нерва, n. maxillaris) в крыловидно-нёбную ямку (fossa pterygopalatina); кзади — овальное (foramen ovale; III ветвь, n. mandibularis) и остистое (foramen spinosum; средняя менингеальная артерия, a. meningea media)."}, {"t": "Поверхности большого крыла — facies alae majoris", "h": ["facies_orbitalis_sphen", "facies_temporalis_sphen", "facies_maxillaris", "crista_infratemporalis"], "text": "Четыре: мозговая (facies cerebralis), глазничная (facies orbitalis), височная (facies temporalis) и верхнечелюстная (facies maxillaris). Височная делится подвисочным гребнем (crista infratemporalis) на височную и крыловидную (подвисочную) части."}, {"t": "Крыловидные отростки — processus pterygoidei", "h": ["processus_pterygoideus", "canalis_pterygoideus"], "text": "Отходят вертикально вниз от места соединения больших крыльев с телом. Основание пронизано крыловидным каналом (canalis pterygoideus; n. canalis pterygoidei и сосуды), открывается в крыловидно-нёбную ямку (fossa pterygopalatina)."}, {"t": "Пластинки отростка — laminae processus pterygoidei", "h": ["lamina_medialis", "lamina_lateralis", "fossa_pterygoidea", "hamulus_pterygoideus"], "text": "Медиальная (lamina medialis) и латеральная (lamina lateralis) пластинки, сзади между ними — крыловидная ямка (fossa pterygoidea). Медиальная пластинка внизу загибается крыловидным крючком (hamulus pterygoideus), через который перекидывается сухожилие мышцы, напрягающей нёбную занавеску (m. tensor veli palatini)."}]}, "temporal": {"src": "с. 109–113", "steps": [{"t": "Височная кость — os temporale", "h": ["pars_squamosa", "pars_tympanica", "pars_petrosa"], "text": "Парная кость боковой стенки и основания черепа (basis cranii); содержит органы слуха и равновесия (organum vestibulocochleare). Смешанная кость из трёх частей — чешуйчатой (pars squamosa), барабанной (pars tympanica) и каменистой (pars petrosa), сливающихся в течение 1-го года вокруг наружного слухового прохода (meatus acusticus externus)."}, {"t": "Чешуйчатая часть — pars squamosa", "h": ["pars_squamosa", "facies_temporalis_t", "sulcus_arteriae_temporalis_mediae"], "text": "Вертикальная пластинка боковой стенки черепа, окостеневает на соединительной ткани; краем накладывается на теменную кость (os parietale) — чешуйчатый шов (sutura squamosa). Наружная поверхность — височная (facies temporalis; участвует в височной ямке, fossa temporalis), на ней — борозда средней височной артерии (sulcus a. temporalis mediae)."}, {"t": "Скуловой отросток — processus zygomaticus", "h": ["processus_zygomaticus"], "text": "Идёт вперёд на соединение с височным отростком скуловой кости (processus temporalis ossis zygomatici) — скуловая дуга (arcus zygomaticus). У начала — два корня."}, {"t": "Нижнечелюстная ямка и суставной бугорок — fossa mandibularis, tuberculum articulare", "h": ["fossa_mandibularis", "tuberculum_articulare"], "text": "Между корнями скулового отростка — нижнечелюстная ямка (fossa mandibularis) для сочленения с головкой нижней челюсти (caput mandibulae) — височно-нижнечелюстной сустав (articulatio temporomandibularis). Суставной бугорок (tuberculum articulare) препятствует вывиху головки нижней челюсти вперёд."}, {"t": "Барабанная часть — pars tympanica", "h": ["pars_tympanica", "porus_acusticus_externus", "meatus_acusticus_externus"], "text": "Изогнутая пластинка, образует передний, нижний и часть заднего края наружного слухового отверстия (porus acusticus externus). Наружный слуховой проход (meatus acusticus externus) ведёт внутрь и вперёд к барабанной полости (cavitas tympani)."}, {"t": "Щели височной кости — fissurae", "h": ["fissura_petrosquamosa", "fissura_petrotympanica", "fissura_tympanomastoidea"], "text": "Следы слияния частей: каменисто-чешуйчатая (fissura petrosquamosa), каменисто-барабанная (fissura petrotympanica; через неё выходит барабанная струна, chorda tympani), барабанно-сосцевидная (fissura tympanomastoidea)."}, {"t": "Каменистая часть (пирамида) — pars petrosa", "h": ["pars_petrosa", "apix_partis_petrosae"], "text": "Вместилище органов слуха и равновесия; развивается на хряще. Трёхгранная пирамида: основание кнаружи, верхушка (apex partis petrosae) вперёд и внутрь. Три поверхности — передняя (facies anterior), задняя (facies posterior), нижняя (facies inferior) — и три края (margo superior, anterior, posterior)."}, {"t": "Передняя поверхность пирамиды — facies anterior partis petrosae", "h": ["facies_anterior_partis_petrosae", "impressio_trigemini", "eminentia_arcuata", "tegmen_tympani", "hiatus_canalis_petrosi_majoris", "hiatus_canalis_petrosi_minoris"], "text": "Дно средней черепной ямки (fossa cranii media). У верхушки — тройничное вдавление (impressio trigeminalis; узел тройничного нерва, ganglion trigeminale); расщелины каналов большого (hiatus canalis n. petrosi majoris) и малого (hiatus canalis n. petrosi minoris) каменистых нервов; дугообразное возвышение (eminentia arcuata; верхний полукружный канал, canalis semicircularis anterior); крыша барабанной полости (tegmen tympani)."}, {"t": "Задняя поверхность — facies posterior partis petrosae", "h": ["facies_posterior_partis_petrosae", "porus_acusticus_internus"], "text": "Передняя стенка задней черепной ямки (fossa cranii posterior). Посередине — внутреннее слуховое отверстие (porus acusticus internus): лицевой (n. facialis) и преддверно-улитковый (n. vestibulocochlearis) нервы, сосуды лабиринта (a. et v. labyrinthi)."}, {"t": "Нижняя поверхность — facies inferior partis petrosae", "h": ["processus_styloideus", "foramen_stylomastoideum", "fossa_jugularis", "canalis_caroticus"], "text": "Шиловидный отросток (processus styloideus; мышцы «анатомического букета», связки). Между шиловидным и сосцевидным — шилососцевидное отверстие (foramen stylomastoideum; выход лицевого нерва, n. facialis). Медиально — яремная ямка (fossa jugularis), кпереди — наружное отверстие сонного канала (apertura externa canalis carotici)."}, {"t": "Края пирамиды — margines partis petrosae", "h": ["canalis_musculotubarius", "sulcus_sinus_petrosi_superioris", "sulcus_sinus_petrosi_inferioris"], "text": "В углу между передним краем и чешуёй — мышечно-трубный канал (canalis musculotubarius): полуканал мышцы, напрягающей барабанную перепонку (semicanalis m. tensoris tympani), и полуканал слуховой трубы (semicanalis tubae auditivae). По верхнему краю — борозда верхнего каменистого синуса (sulcus sinus petrosi superioris), по заднему — нижнего (sulcus sinus petrosi inferioris)."}, {"t": "Сосцевидный отросток — processus mastoideus", "h": ["processus_mastoideus", "incisura_mastoidea", "sulcus_arteriae_occipitalis", "foramen_mastoideum"], "text": "Продолжение основания пирамиды книзу; к нему крепится грудино-ключично-сосцевидная мышца (m. sternocleidomastoideus; развит только у человека). Медиально — сосцевидная вырезка (incisura mastoidea; двубрюшная мышца, m. digastricus) и борозда затылочной артерии (sulcus a. occipitalis). Сзади — сосцевидное отверстие (foramen mastoideum). Внутри — воздухоносные сосцевидные ячейки (cellulae mastoideae)."}, {"t": "Борозда сигмовидного синуса — sulcus sinus sigmoidei", "h": ["sulcus_sinus_sigmoidei_t"], "text": "Глубокая борозда на мозговой поверхности основания пирамиды; продолжается на затылочную кость (os occipitale) к яремному отверстию (foramen jugulare)."}, {"t": "Каналы — canales", "h": ["canalis_caroticus"], "text": "Сонный канал (canalis caroticus) — внутренняя сонная артерия (a. carotis interna); открывается на верхушке пирамиды (apex partis petrosae). Лицевой канал (canalis facialis) — от внутреннего слухового прохода (meatus acusticus internus), образует коленце (geniculum canalis facialis) и заканчивается шилососцевидным отверстием (foramen stylomastoideum)."}]}, "parietal": {"src": "с. 113", "steps": [{"t": "Теменная кость — os parietale", "text": "Парная кость, образует среднюю часть свода черепа (calvaria). Типичная покровная кость (функция защиты): четырёхугольная пластинка, выпуклая снаружи (facies externa) и вогнутая изнутри (facies interna)."}, {"t": "Края — margines", "h": ["margo_frontalis", "margo_occipitalis", "margo_sagittalis", "margo_squamosa"], "text": "Лобный край (margo frontalis) — с лобной костью (os frontale): венечный шов (sutura coronalis); затылочный (margo occipitalis) — с затылочной (os occipitale): ламбдовидный шов (sutura lambdoidea); сагиттальный (margo sagittalis) — с теменной костью другой стороны: сагиттальный шов (sutura sagittalis); чешуйчатый (margo squamosus) — с чешуёй височной кости (squama ossis temporalis). Первые три зазубрены, последний — для чешуйчатого шва (sutura squamosa)."}, {"t": "Углы — anguli", "h": ["angulus_frontalis", "angulus_sphenoidalis", "angulus_occipitalis", "angulus_mastoideus"], "text": "Лобный (angulus frontalis) — с лобной костью (os frontale), клиновидный (angulus sphenoidalis) — с большим крылом клиновидной (ala major ossis sphenoidalis), затылочный (angulus occipitalis) — с затылочной (os occipitale), сосцевидный (angulus mastoideus) — с основанием сосцевидного отростка (processus mastoideus)."}, {"t": "Теменной бугор — tuber parietale", "h": ["tuber_parietale"], "text": "В центре наружной поверхности (facies externa) — место начала окостенения (punctum ossificationis)."}, {"t": "Височные линии — lineae temporales", "h": ["linea_temporalis_superior", "linea_temporalis_inferior"], "text": "Ниже бугра; верхняя (linea temporalis superior) — для височной фасции (fascia temporalis), нижняя (linea temporalis inferior) — для височной мышцы (m. temporalis)."}, {"t": "Теменное отверстие — foramen parietale", "h": ["foramen_parietale"], "text": "Вблизи медиального (сагиттального) края; для артерии и вены — эмиссарная вена (v. emissaria parietalis)."}, {"t": "Внутренняя поверхность — facies interna", "h": ["facies_interna", "sulcus_sagittalis", "sulcus_sigmoidei", "sulci_arteriosi", "foveolae_granulares"], "text": "Вдоль медиального края — борозда верхнего сагиттального синуса (sulcus sinus sagittalis superioris), у сосцевидного угла — борозда сигмовидного синуса (sulcus sinus sigmoidei). Артериальные борозды (sulci arteriosi) от сосудов твёрдой мозговой оболочки (a. meningea media), ямочки грануляций (foveolae granulares) паутинной оболочки (arachnoidea)."}]}, "frontal": {"src": "с. 113–115, 126", "steps": [{"t": "Лобная кость — os frontale", "text": "Непарная кость свода черепа (calvaria), покровная. Связана с органами зрения и обоняния. 4 части: чешуя (squama frontalis), две глазничные части (partes orbitales), носовая часть (pars nasalis)."}, {"t": "Лобная чешуя — squama frontalis", "h": ["squama_frontalis", "facies_externa", "tuber_frontale"], "text": "Пластинка, выпуклая снаружи (facies externa). Окостеневает из двух точек, видных у взрослого как лобные бугры (tubera frontalia; есть только у человека)."}, {"t": "Надглазничный край — margo supraorbitalis", "h": ["margo_supraorbitalis", "incisura_frontalis", "foramen_supraorbitale"], "text": "Нижний край чешуи. На границе внутренней и средней трети — надглазничная вырезка (incisura supraorbitalis, иногда отверстие — foramen supraorbitale) для одноимённых артерии и нерва (a. et n. supraorbitalis); медиальнее — лобная вырезка (incisura frontalis)."}, {"t": "Надбровные дуги и глабелла — arcus superciliares, glabella", "h": ["arcus_superciliaris", "glabella"], "text": "Выше края — надбровные дуги (arcus superciliares); медиально переходят в площадку — надпереносье (glabella)."}, {"t": "Скуловой отросток — processus zygomaticus", "h": ["processus_zygomaticus", "linea_temporalis", "facies_temporalis"], "text": "Наружный конец надглазничного края, соединяется со скуловой костью (os zygomaticum) — лобно-скуловой шов (sutura frontozygomatica). От него вверх — височная линия (linea temporalis), ограничивающая височную поверхность (facies temporalis)."}, {"t": "Внутренняя поверхность чешуи — facies interna", "text": "По средней линии — борозда верхнего сагиттального синуса (sulcus sinus sagittalis superioris), переходящая в лобный гребень (crista frontalis; прикрепление твёрдой мозговой оболочки, dura mater); ямочки грануляций (foveolae granulares)."}, {"t": "Глазничные части — partes orbitales", "h": ["pars_orbitalis", "facies_orbitalis"], "text": "Две горизонтальные пластинки: снизу (facies orbitalis) обращены в глазницу (orbita; верхняя стенка), сверху — в полость черепа (пальцевидные вдавления, impressiones digitatae); сзади соединяются с малыми крыльями клиновидной кости (alae minores ossis sphenoidalis)."}, {"t": "Образования глазничной поверхности", "h": ["fossa_glandulae_lacrimalis", "fovea_trochlearis", "spina_trochlearis"], "text": "У скулового отростка — ямка слёзной железы (fossa glandulae lacrimalis); у надглазничной вырезки — блоковая ямка (fovea trochlearis) и блоковая ость (spina trochlearis) — блок для сухожилия верхней косой мышцы глаза (m. obliquus superior)."}, {"t": "Решётчатая вырезка — incisura ethmoidalis", "h": ["incisura_ethmoidalis"], "text": "Разделяет глазничные части; на целом черепе заполнена решётчатой пластинкой решётчатой кости (lamina cribrosa ossis ethmoidalis)."}, {"t": "Носовая часть — pars nasalis", "h": ["pars_nasalis", "spina_nasalis", "margo_nasalis"], "text": "Спереди от решётчатой вырезки по средней линии; носовой край (margo nasalis) соединяется с носовыми костями (ossa nasalia), гребешок заканчивается носовой остью (spina nasalis) — участвует в носовой перегородке (septum nasi)."}, {"t": "Лобная пазуха — sinus frontalis", "text": "Воздухоносная полость в толще кости позади надбровных дуг (arcus superciliares), разделена перегородкой (septum sinuum frontalium); открывается в средний носовой ход (meatus nasi medius); величина сильно варьирует."}, {"t": "Теменной край — margo parietalis", "h": ["margo_parietalis"], "text": "Теменной край чешуи соединяется с теменными костями (ossa parietalia) — венечный шов (sutura coronalis)."}]}, "ethmoid": {"src": "с. 115–116", "steps": [{"t": "Решётчатая кость — os ethmoidale", "text": "Непарная кость; описывается в мозговом черепе (cranium cerebrale), но больше участвует в образовании лица — полости носа (cavitas nasi) и глазниц (orbitae). Развивается на хряще. Пластинки расположены буквой Т; 4 части: решётчатая пластинка (lamina cribrosa), перпендикулярная пластинка (lamina perpendicularis), два лабиринта (labyrinthi ethmoidales)."}, {"t": "Решётчатая пластинка — lamina cribrosa", "h": ["lamina_cribrosa"], "text": "Горизонтальная, заполняет решётчатую вырезку лобной кости (incisura ethmoidalis ossis frontalis). Пронизана отверстиями (foramina cribrosa) для обонятельных нервов (nn. olfactorii, около 30)."}, {"t": "Петушиный гребень — crista galli", "h": ["crista_galli", "ala_cristae_galli"], "text": "Возвышается по средней линии решётчатой пластинки; спереди — крылья петушиного гребня (alae cristae galli). Место прикрепления серпа большого мозга (falx cerebri) твёрдой мозговой оболочки."}, {"t": "Перпендикулярная пластинка — lamina perpendicularis", "h": ["lamina_perpendicularis"], "text": "Вертикальная часть буквы Т; верхняя часть костной носовой перегородки (septum nasi osseum)."}, {"t": "Решётчатые лабиринты — labyrinthi ethmoidales", "h": ["labyrinthus_ethmoidalis", "bulla_ethmoidalis"], "text": "Парный комплекс воздухоносных решётчатых ячеек (cellulae ethmoidales) по сторонам перпендикулярной пластинки; самая крупная — решётчатый пузырёк (bulla ethmoidalis)."}, {"t": "Глазничная пластинка — lamina orbitalis", "h": ["lamina_orbitalis", "foramen_ethmoidale_anterius", "foramen_ethmoidale_posterius"], "text": "Прикрывает лабиринт снаружи, образует медиальную стенку глазницы (paries medialis orbitae). Сверху соединяется с лобной костью (os frontale) — здесь переднее (foramen ethmoidale anterius) и заднее (foramen ethmoidale posterius) решётчатые отверстия; спереди — со слёзной (os lacrimale), сзади — с клиновидной (os sphenoidale) и нёбной (os palatinum), снизу — с верхней челюстью (maxilla)."}, {"t": "Носовые раковины — conchae nasales", "h": ["concha_nasalis_superior", "concha_nasalis_media", "processus_uncinatus"], "text": "На медиальной стороне лабиринтов — верхняя (concha nasalis superior) и средняя (concha nasalis media) раковины (иногда наивысшая, concha nasalis suprema); изогнутые пластинки увеличивают поверхность слизистой носа. Вниз от лабиринта — крючковидный отросток (processus uncinatus)."}]}, "maxilla": {"src": "с. 116–118", "steps": [{"t": "Верхняя челюсть — maxilla", "h": ["maxilla"], "text": "Парная кость лица (cranium viscerale); участвует в образовании глазницы (orbita), полости носа (cavitas nasi), перегородки между полостями носа и рта (palatum osseum) и в жевательном аппарате. Развивается на соединительной ткани. Состоит из тела (corpus) и четырёх отростков: лобного, скулового, альвеолярного, нёбного."}, {"t": "Тело и пазуха — corpus maxillae, sinus maxillaris", "h": ["corpus_maxillae", "hiatus_maxillaris"], "text": "Содержит верхнечелюстную (гайморову) пазуху (sinus maxillaris); широким отверстием — верхнечелюстной расщелиной (hiatus maxillaris) — она открывается в полость носа (средний носовой ход, meatus nasi medius). 4 поверхности."}, {"t": "Передняя поверхность — facies anterior", "h": ["facies_anterior", "fossa_canina", "juga_alveolaria", "margo_infraorbitalis", "foramen_infraorbitale", "incisura_nasalis"], "text": "Вогнута. Внизу — альвеолярные возвышения (juga alveolaria), выше — клыковая ямка (fossa canina). Сверху ограничена подглазничным краем (margo infraorbitalis), под ним — подглазничное отверстие (foramen infraorbitale; n. et a. infraorbitalis). Медиально — носовая вырезка (incisura nasalis)."}, {"t": "Подвисочная поверхность — facies infratemporalis", "h": ["facies_infratemporalis", "tuber_maxillae", "foramina_alveolaria"], "text": "Отделена скуловым отростком (processus zygomaticus); несёт бугор верхней челюсти (tuber maxillae) с альвеолярными отверстиями (foramina alveolaria) к задним зубам и большую нёбную борозду (sulcus palatinus major)."}, {"t": "Носовая поверхность — facies nasalis", "h": ["facies_nasalis", "crista_conchalis", "sulcus_lacrimalis"], "text": "Раковинный гребень (crista conchalis) для нижней носовой раковины (concha nasalis inferior). Слёзная борозда (sulcus lacrimalis) со слёзной костью (os lacrimale) и нижней раковиной образует носослёзный канал (canalis nasolacrimalis) — в нижний носовой ход (meatus nasi inferior)."}, {"t": "Глазничная поверхность — facies orbitalis", "h": ["facies_orbitalis", "incisura_lacrimalis", "sulcus_infraorbitalis"], "text": "Треугольная. На медиальном крае — слёзная вырезка (incisura lacrimalis). Подглазничная борозда (sulcus infraorbitalis) переходит в подглазничный канал (canalis infraorbitalis), от него — альвеолярные каналы (canales alveolares) к передним зубам."}, {"t": "Лобный отросток — processus frontalis", "h": ["processus_frontalis", "crista_lacrimalis_anterior", "crista_ethmoidalis"], "text": "Поднимается вверх к носовой части лобной кости (pars nasalis ossis frontalis); на латеральной поверхности — передний слёзный гребень (crista lacrimalis anterior), на медиальной — решётчатый гребень (crista ethmoidalis) для средней носовой раковины (concha nasalis media)."}, {"t": "Альвеолярный отросток — processus alveolaris", "h": ["processus_alveolaris", "arcus_alveolaris"], "text": "На нижнем крае — альвеолярная дуга (arcus alveolaris) с зубными альвеолами (alveoli dentales) восьми верхних зубов и межальвеолярными перегородками (septa interalveolaria)."}, {"t": "Нёбный отросток — processus palatinus", "h": ["processus_palatinus", "crista_nasalis", "canalis_incisivus"], "text": "Образует большую часть твёрдого нёба (palatum durum), соединяясь с парным срединным нёбным швом (sutura palatina mediana). Сверху — носовой гребень (crista nasalis; к сошнику, vomer) и вход в резцовый канал (canalis incisivus); снизу — нёбные борозды (sulci palatini)."}, {"t": "Скуловой отросток — processus zygomaticus", "h": ["processus_zygomaticus"], "text": "Соединяется со скуловой костью (os zygomaticum); толстая подпора (контрфорс), передающая жевательное давление."}]}, "palatine": {"src": "с. 118–119", "steps": [{"t": "Нёбная кость — os palatinum", "h": ["os_palatinum"], "text": "Парная кость лица; участвует в образовании полости носа (cavitas nasi), рта (cavitas oris), глазницы (orbita) и крыловидно-нёбной ямки (fossa pterygopalatina). Две пластинки под прямым углом, дополняющие верхнюю челюсть (maxilla)."}, {"t": "Горизонтальная пластинка — lamina horizontalis", "h": ["lamina_horizontalis", "facies_palatina", "spina_nasalis_posterior"], "text": "Дополняет сзади нёбный отросток верхней челюсти (processus palatinus maxillae), образуя твёрдое нёбо (palatum durum) — поперечный нёбный шов (sutura palatina transversa). Нижняя — нёбная поверхность (facies palatina); сзади по средней линии — задняя носовая ость (spina nasalis posterior). Снизу — большое нёбное отверстие (foramen palatinum majus; нёбные сосуды и нервы)."}, {"t": "Перпендикулярная пластинка — lamina perpendicularis", "h": ["lamina_perpendicularis", "sulcus_palatinus_major", "facies_nasalis"], "text": "Прилегает к носовой поверхности верхней челюсти (facies nasalis maxillae). Латерально — большая нёбная борозда (sulcus palatinus major), с одноимённой бороздой верхней челюсти образует большой нёбный канал (canalis palatinus major)."}, {"t": "Гребни для раковин — cristae", "h": ["crista_ethmoidalis", "crista_conchalis"], "text": "На медиальной (носовой) поверхности: решётчатый гребень (crista ethmoidalis) — для средней раковины (concha nasalis media), раковинный (crista conchalis) — для нижней (concha nasalis inferior)."}, {"t": "Пирамидальный отросток — processus pyramidalis", "h": ["processus_pyramidalis", "fossa_pterygoidea"], "text": "Отходит назад и латерально от угла между пластинками; заполняет крыловидную вырезку (incisura pterygoidea) клиновидной кости, дополняя крыловидную ямку (fossa pterygoidea). Пронизан малыми нёбными каналами (canales palatini minores)."}, {"t": "Глазничный и клиновидный отростки — processus orbitalis et sphenoidalis", "h": ["processus_orbitalis", "processus_sphenoidalis", "incisura_sphenopalatina"], "text": "На верхнем крае перпендикулярной пластинки; между ними — клиновидно-нёбная вырезка (incisura sphenopalatina), с телом клиновидной кости замыкающаяся в клиновидно-нёбное отверстие (foramen sphenopalatinum). Глазничный (processus orbitalis) дополняет дно глазницы, клиновидный (processus sphenoidalis) прилегает к телу клиновидной кости (corpus ossis sphenoidalis)."}]}, "facial_small": {"src": "с. 119–120", "steps": [{"t": "Мелкие кости лица — ossa faciei", "text": "Нижняя носовая раковина (concha nasalis inferior), носовая (os nasale), слёзная (os lacrimale), скуловая (os zygomaticum) кости — парные, и сошник (vomer) — непарный."}, {"t": "Нижняя носовая раковина — concha nasalis inferior", "h": ["concha_nasalis_inferior", "processus_lacrimalis", "processus_ethmoidalis", "processus_maxillaris"], "text": "Самостоятельная кость (в отличие от верхней и средней — частей решётчатой, os ethmoidale). Верхним краем прикрепляется к раковинным гребням (cristae conchales) верхней челюсти и нёбной кости; отростки — слёзный (processus lacrimalis), решётчатый (processus ethmoidalis), верхнечелюстной (processus maxillaris). Отделяет средний носовой ход (meatus nasi medius) от нижнего (meatus nasi inferior); нижний край свободен."}, {"t": "Носовая кость — os nasale", "h": ["os_nasale", "sulcus_ethmoidalis"], "text": "Прилегая к парной, образует спинку носа (dorsum nasi) у корня; вверху — с носовой частью лобной кости (pars nasalis ossis frontalis). На внутренней поверхности — решётчатая борозда (sulcus ethmoidalis) для переднего решётчатого нерва (n. ethmoidalis anterior)."}, {"t": "Слёзная кость — os lacrimale", "h": ["os_lacrimale", "crista_lacrimalis_posterior", "sulcus_lacrimalis", "hamulus_lacrimalis"], "text": "Тонкая пластинка медиальной стенки глазницы (paries medialis orbitae) позади лобного отростка верхней челюсти (processus frontalis maxillae). Задний слёзный гребень (crista lacrimalis posterior), заканчивающийся слёзным крючком (hamulus lacrimalis); кпереди — слёзная борозда (sulcus lacrimalis), вместе с бороздой верхней челюсти образующая ямку слёзного мешка (fossa sacci lacrimalis)."}, {"t": "Сошник — vomer", "h": ["vomer", "ala_vomeris", "sulcus_vomeris"], "text": "Непарная четырёхугольная пластинка костной перегородки носа (septum nasi osseum). Вверху — крылья сошника (alae vomeris), охватывающие клиновидный клюв (rostrum sphenoidale); сошниковая борозда (sulcus vomeris). Задний край свободен и разделяет хоаны (choanae)."}, {"t": "Скуловая кость — os zygomaticum", "h": ["os_zygomaticum", "facies_lateralis", "facies_temporalis", "facies_orbitalis"], "text": "Самая прочная кость лица; соединяет скуловые отростки лобной (os frontale), височной (os temporale) костей и верхней челюсти (maxilla). 3 поверхности: латеральная (facies lateralis), височная (facies temporalis), глазничная (facies orbitalis)."}, {"t": "Отростки скуловой кости — processus frontalis et temporalis", "h": ["processus_frontalis", "processus_temporalis"], "text": "Лобный (processus frontalis) — к скуловому отростку лобной кости и большому крылу клиновидной (ala major). Височный (processus temporalis) со скуловым отростком височной кости (processus zygomaticus ossis temporalis) образует скуловую дугу (arcus zygomaticus) — место начала жевательной мышцы (m. masseter)."}]}, "mandible": {"src": "с. 120–123", "steps": [{"t": "Нижняя челюсть — mandibula", "h": ["mandibula"], "text": "Подвижная кость черепа, подковообразная; развивается из I жаберной (висцеральной) дуги из двух зачатков, сливающихся на 2-м году по подбородочному симфизу (symphysis mandibulae). Делится на тело (corpus) и две ветви (rami)."}, {"t": "Тело — corpus mandibulae", "h": ["corpus_mandibulae", "pars_alveolaris", "arcus_alveolaris"], "text": "Горизонтальная часть; альвеолярная часть (pars alveolaris) с альвеолярной дугой (arcus alveolaris) несёт зубные альвеолы (alveoli dentales). Нижний массивный край — основание (basis mandibulae). В старости альвеолярная часть атрофируется."}, {"t": "Подбородочный выступ — protuberantia mentalis", "h": ["protuberantia_mentalis"], "text": "Треугольное возвышение по средней линии с подбородочными бугорками (tubercula mentalia) — признак современного человека."}, {"t": "Подбородочное отверстие — foramen mentale", "h": ["foramen_mentale"], "text": "На латеральной поверхности тела; выход канала нижней челюсти (canalis mandibulae; n. mentalis и сосуды). Назад и вверх — косая линия (linea obliqua)."}, {"t": "Внутренняя поверхность тела — facies interna", "h": ["spina_mentalis", "fossa_digastrica", "linea_mylohyoidea", "fovea_sublingualis", "fovea_submandibularis"], "text": "Подбородочная ость (spina mentalis; подбородочно-язычные (m. genioglossus) и подбородочно-подъязычные мышцы), двубрюшные ямки (fossae digastricae; m. digastricus), челюстно-подъязычная линия (linea mylohyoidea; m. mylohyoideus). Над линией — подъязычная ямка (fovea sublingualis), под ней — поднижнечелюстная (fovea submandibularis) — для одноимённых слюнных желёз."}, {"t": "Угол — angulus mandibulae", "h": ["angulus_mandibulae", "tuberositas_masseterica", "tuberositas_pterygoidea"], "text": "Снаружи — жевательная бугристость (tuberositas masseterica; m. masseter), изнутри — крыловидная (tuberositas pterygoidea; m. pterygoideus medialis). У новорождённого около 150°, у взрослого 130–110°, в старости вновь увеличивается."}, {"t": "Ветвь — ramus mandibulae", "h": ["ramus_mandibulae", "foramen_mandibulae", "lingula_mandibulae", "sulcus_mylohyoideus"], "text": "На внутренней поверхности — отверстие нижней челюсти (foramen mandibulae; вход в canalis mandibulae для n. alveolaris inferior) с язычком (lingula mandibulae); кзади-книзу — челюстно-подъязычная борозда (sulcus mylohyoideus)."}, {"t": "Венечный отросток — processus coronoideus", "h": ["processus_coronoideus", "incisura_mandibulae"], "text": "Передний отросток ветви — образовался под тягой височной мышцы (m. temporalis). Между отростками — вырезка нижней челюсти (incisura mandibulae)."}, {"t": "Мыщелковый отросток — processus condylaris", "h": ["processus_condylaris", "caput_mandibulae", "fovea_pterygoidea"], "text": "Задний отросток: головка (caput mandibulae) и шейка (collum mandibulae); сочленяется с нижнечелюстной ямкой височной кости (fossa mandibularis ossis temporalis) — височно-нижнечелюстной сустав (articulatio temporomandibularis). На шейке — крыловидная ямка (fovea pterygoidea; m. pterygoideus lateralis)."}, {"t": "Подъязычная кость — os hyoideum", "h": ["os_hyoideum", "corpus_ossis_hyoidei", "cornu_majus", "cornu_minus"], "text": "Между нижней челюстью (mandibula) и гортанью (larynx), у основания языка; из II и III жаберных дуг. Тело (corpus), большие (cornua majora) и малые (cornua minora) рога; подвешена шилоподъязычными связками (ligg. stylohyoidea) к шиловидным отросткам (processus styloidei)."}]}, "cervical": {"src": "с. 82–85, 88–90", "steps": [{"t": "Шейные позвонки — vertebrae cervicales", "text": "Позвоночный столб (columna vertebralis): 7 шейных позвонков (vertebrae cervicales). Позвонки — короткие губчатые кости (ossa brevia spongiosa). Тела шейных позвонков небольшие, соответственно меньшей нагрузке."}, {"t": "Тело — corpus vertebrae", "h": ["corpus_vertebrae"], "text": "Опорная часть позвонка, расположена спереди и утолщена в виде короткого столбика."}, {"t": "Дуга — arcus vertebrae", "h": ["arcus_vertebrae", "lamina_arcus_vertebrae", "foramen_vertebrale"], "text": "Прикрепляется к телу сзади двумя ножками (pediculi arcus vertebrae), пластинка дуги (lamina arcus vertebrae) замыкает позвоночное отверстие (foramen vertebrale). Позвоночные отверстия образуют позвоночный канал (canalis vertebralis) для спинного мозга (medulla spinalis) — функция защиты."}, {"t": "Суставные отростки — processus articulares", "h": ["processus_articularis_superior", "processus_articularis_inferior", "incisura_vertebralis_superior"], "text": "Парные верхние (processus articulares superiores) и нижние (processus articulares inferiores); образуют межпозвоночные (дугоотростчатые) суставы (articulationes zygapophysiales). Ограничивают сзади позвоночные вырезки (incisurae vertebrales), из которых получаются межпозвоночные отверстия (foramina intervertebralia) для нервов и сосудов."}, {"t": "Поперечный отросток с отверстием — foramen processus transversi", "h": ["processus_transversus", "foramen_processus_transversi", "sulcus_nervi_spinalis"], "text": "Отличительный признак шейных позвонков. Отверстие поперечного отростка (foramen processus transversi) образуется сращением поперечного отростка (processus transversus) с рудиментом ребра; канал из этих отверстий защищает позвоночные артерию и вену (a. et v. vertebralis). Сверху на отростке — борозда спинномозгового нерва (sulcus nervi spinalis)."}, {"t": "Передний и задний бугорки — tuberculum anterius et posterius", "h": ["tuberculum_anterius", "tuberculum_posterius"], "text": "На концах поперечных отростков — след их сращения с рудиментом ребра. Передний бугорок VI позвонка — сонный бугорок (tuberculum caroticum): к нему можно прижать общую сонную артерию (a. carotis communis) для остановки кровотечения."}, {"t": "Остистый отросток — processus spinosus", "h": ["processus_spinosus"], "text": "На концах раздвоен, кроме VI и VII. У VII позвонка он очень большой — выступающий позвонок (vertebra prominens), прощупывается у живого и используется для счёта позвонков."}, {"t": "Атлант — atlas (I шейный)", "h": ["atlas", "arcus_anterior", "arcus_posterior", "massa_lateralis"], "text": "Тела нет: большая его часть приросла ко II позвонку, образовав зуб (dens). Остались передняя (arcus anterior) и задняя (arcus posterior) дуги, соединённые боковыми массами (massae laterales); позвоночное отверстие (foramen vertebrale) увеличено."}, {"t": "Суставные ямки атланта — foveae articulares", "h": ["facies_articularis_superior", "facies_articularis_inferior", "fovea_dentis"], "text": "Верхняя, вогнутая (fovea articularis superior) — для мыщелка затылочной кости (condylus occipitalis): атлантозатылочный сустав (articulatio atlantooccipitalis); нижняя, уплощённая (facies articularis inferior) — для II позвонка: латеральный атлантоосевой сустав (articulatio atlantoaxialis lateralis). На внутренней стороне передней дуги — ямка зуба (fovea dentis)."}, {"t": "Бугорки и борозда атланта", "h": ["tuberculum_anterius_atlantis", "tuberculum_posterius_atlantis", "sulcus_arteriae_vertebralis"], "text": "На наружных поверхностях передней и задней дуг — передний (tuberculum anterius) и задний (tuberculum posterius) бугорки. Передний — опознавательный пункт при счёте позвонков на рентгенограмме. На задней дуге — борозда позвоночной артерии (sulcus arteriae vertebralis)."}, {"t": "Осевой позвонок — axis (II шейный)", "h": ["axis", "dens", "apex_dentis", "facies_articularis_anterior", "facies_articularis_posterior"], "text": "Отличается зубом (dens) с верхушкой (apex dentis), гомологичным телу атланта. Передняя суставная поверхность зуба (facies articularis anterior) сочленяется с передней дугой атланта, задняя (facies articularis posterior) — с поперечной связкой атланта (lig. transversum atlantis): срединный атлантоосевой сустав (articulatio atlantoaxialis mediana) — вращение головы."}, {"t": "Возрастные особенности", "text": "У новорождённого тело яйцевидное, без «углов»; на 3-м году дуга (arcus) срастается с телом (corpus). Краевой кант (limbus vertebrae) окостеневает с 6–9 лет и срастается с телом в 23–26 лет. В старости — остеопороз (osteoporosis), остеофиты (osteophyti), «углы» тела заостряются."}]}, "thoracic": {"src": "с. 82, 84–85", "steps": [{"t": "Грудные позвонки — vertebrae thoracicae", "text": "Позвоночный столб (columna vertebralis): 12 грудных позвонков (vertebrae thoracicae). Сочленяются с рёбрами (costae). Тела больше шейных соответственно большей нагрузке."}, {"t": "Тело — corpus vertebrae", "h": ["corpus_vertebrae"], "text": "Опорная часть позвонка."}, {"t": "Рёберные ямки тела — fovea costalis superior et inferior", "h": ["fovea_costalis_superior", "fovea_costalis_inferior"], "text": "На теле вблизи основания дуги; соединяются с головками рёбер (capita costarum) — сустав головки ребра (articulatio capitis costae). У большинства — по две половинные ямки: верхняя (fovea costalis superior) и нижняя (fovea costalis inferior), так как ребро сочленяется с двумя соседними позвонками. I позвонок: вверху полная ямка для I ребра; X — только верхняя полуямка; XI и XII — по одной полной ямке."}, {"t": "Дуга и ножка — arcus, pediculus arcus vertebrae", "h": ["arcus_vertebrae", "pediculus_arcus_vertebrae", "lamina_arcus_vertebrae", "foramen_vertebrale"], "text": "Дуга (arcus vertebrae) прикрепляется к телу двумя ножками (pediculi arcus vertebrae), пластинка дуги (lamina arcus vertebrae) замыкает позвоночное отверстие (foramen vertebrale)."}, {"t": "Позвоночные вырезки — incisurae vertebrales", "h": ["incisura_vertebralis_superior", "incisura_vertebralis_inferior"], "text": "Верхняя (incisura vertebralis superior) и нижняя (incisura vertebralis inferior) вырезки при наложении позвонков образуют межпозвоночные отверстия (foramina intervertebralia) для нервов и сосудов."}, {"t": "Суставные отростки — processus articulares", "h": ["processus_articularis_superior", "processus_articularis_inferior"], "text": "Верхние (processus articulares superiores) и нижние (processus articulares inferiores) стоят фронтально; образуют дугоотростчатые суставы (articulationes zygapophysiales)."}, {"t": "Поперечный отросток — processus transversus", "h": ["processus_transversus", "fovea_costalis_processus_transversi"], "text": "Направлен в стороны и назад. На передней стороне — рёберная ямка поперечного отростка (fovea costalis processus transversi) для бугорка ребра (tuberculum costae): рёберно-поперечный сустав (articulatio costotransversaria); у XI и XII позвонков её нет."}, {"t": "Остистый отросток — processus spinosus", "h": ["processus_spinosus"], "text": "Длинный, сильно наклонён книзу — налегают друг на друга наподобие черепицы (особенно в средней части грудного отдела)."}, {"t": "Возрастные особенности", "text": "У новорождённого тело (corpus) яйцевидное; на 3-м году дуга (arcus) срастается с телом. Краевой кант (limbus vertebrae) срастается с телом в 23–26 лет. В старости — остеопороз (osteoporosis) и остеофиты (osteophyti)."}]}, "lumbar": {"src": "с. 82, 86, 88", "steps": [{"t": "Поясничные позвонки — vertebrae lumbales", "text": "Позвоночный столб (columna vertebralis): 5 поясничных позвонков (vertebrae lumbales). Отличаются массивностью тел — нагрузка ещё больше, чем на вышележащие отделы."}, {"t": "Тело — corpus vertebrae", "h": ["corpus_vertebrae"], "text": "Самое массивное; на рентгенограмме напоминает «катушку» с перехватом — «талией»."}, {"t": "Позвоночное отверстие и вырезки — foramen vertebrale, incisurae vertebrales", "h": ["foramen_vertebrale", "incisura_vertebralis_superior", "incisura_vertebralis_inferior"], "text": "Ниже II поясничного позвонка (окончание спинного мозга, medulla spinalis) позвоночное отверстие (foramen vertebrale) постепенно суживается. Верхняя (incisura vertebralis superior) и нижняя (incisura vertebralis inferior) вырезки образуют межпозвоночные отверстия (foramina intervertebralia)."}, {"t": "Суставные отростки — processus articulares", "h": ["processus_articularis_superior", "processus_articularis_inferior", "processus_mammillaris"], "text": "Верхние (processus articulares superiores) и нижние (processus articulares inferiores) стоят сагиттально; хорошо развиты в подвижном поясничном отделе. На верхних — сосцевидные отростки (processus mammillares)."}, {"t": "Рёберный отросток — processus costalis", "h": ["processus_costalis"], "text": "Поперечный отросток (processus transversus) в большей части — рудиментарное ребро (costa), слившееся с настоящим поперечным отростком."}, {"t": "Добавочный отросток — processus accessorius", "h": ["processus_accessorius"], "text": "Остаток настоящего поперечного отростка позади основания рёберного (processus costalis). При длине более 4 мм принимает форму шила — вариант нормы, а не патология."}, {"t": "Остистый отросток — processus spinosus", "h": ["processus_spinosus"], "text": "Направлен прямо назад."}, {"t": "Возрастные особенности", "text": "На 3-м году дуга (arcus) срастается с телом (corpus), к 23–26 годам все части позвонка срастаются. Варианты: люмбализация (lumbalisatio, у 4% людей) и сакрализация (sacralisatio) V поясничного позвонка."}]}, "sacrum": {"src": "с. 86–87, 90", "steps": [{"t": "Крестец — os sacrum", "text": "5 крестцовых позвонков (vertebrae sacrales), сросшихся в юности в одну кость (17–25 лет) — приспособление к большой нагрузке при вертикальном положении. Треугольной формы."}, {"t": "Основание — basis ossis sacri", "h": ["basis_ossis_sacri", "processus_articularis_superior"], "text": "Обращено вверх, несёт верхние суставные отростки (processus articulares superiores) для V поясничного позвонка. Передний край основания с телом V поясничного позвонка образует выступающий вперёд мыс (promontorium)."}, {"t": "Верхушка — apex ossis sacri", "h": ["apex_ossis_sacri"], "text": "Обращена вниз, сочленяется с копчиком (os coccygis): крестцово-копчиковое соединение (articulatio sacrococcygea)."}, {"t": "Тазовая поверхность — facies pelvica", "h": ["lineae_transversae", "foramina_sacralia_anteriora"], "text": "Вогнута. Поперечные линии (lineae transversae) — места сращения тел позвонков; по их концам — тазовые крестцовые отверстия (foramina sacralia anteriora)."}, {"t": "Дорсальная поверхность и гребни — facies dorsalis, cristae sacrales", "h": ["crista_sacralis_mediana", "crista_sacralis_intermedia", "crista_sacralis_lateralis", "foramina_sacralia_posteriora"], "text": "5 гребней: срединный (crista sacralis mediana — сращение остистых отростков), парные промежуточные (cristae sacrales intermediae — суставных) и латеральные (cristae sacrales laterales — поперечных). Дорсальные крестцовые отверстия (foramina sacralia posteriora)."}, {"t": "Латеральные части — partes laterales", "h": ["pars_lateralis", "ala_sacralis"], "text": "Кнаружи от отверстий, образовались от слияния поперечных отростков (processus transversi) и крестцовых рёбер; вверху расширены в крылья крестца (alae sacrales)."}, {"t": "Ушковидная поверхность — facies auricularis", "h": ["facies_auricularis", "tuberositas_sacralis"], "text": "На латеральной стороне; соединяется с подвздошной костью (os ilium) — крестцово-подвздошный сустав (articulatio sacroiliaca). Кзади — крестцовая бугристость (tuberositas sacralis) для мышц и связок."}, {"t": "Крестцовый канал и щель — canalis sacralis, hiatus sacralis", "h": ["canalis_sacralis", "hiatus_sacralis", "cornu_sacrale"], "text": "Крестцовый канал (canalis sacralis) — продолжение позвоночного канала (canalis vertebralis). Внизу не замыкается, а открывается крестцовой щелью (hiatus sacralis), по бокам которой — крестцовые рога (cornua sacralia)."}, {"t": "Копчик — os coccygis", "h": ["os_coccygis", "cornu_coccygeum"], "text": "Рудиментарные копчиковые позвонки (vertebrae coccygeae, 1–5) — остаток исчезнувшего хвоста; сливаются в среднем возрасте в одну кость. Вверху — копчиковые рога (cornua coccygea)."}]}, "ribs": {"src": "с. 96–98", "steps": [{"t": "Рёбра — costae", "h": ["costae"], "text": "12 пар. Узкие изогнутые пластинки: задняя часть — рёберная кость (os costale, длинная губчатая кость), передняя — рёберный хрящ (cartilago costalis). Задними концами соединяются с телами грудных позвонков (vertebrae thoracicae)."}, {"t": "Истинные, ложные и колеблющиеся — costae verae, spuriae, fluctuantes", "h": ["costae_verae", "costae_spuriae", "costae_fluctuantes"], "text": "I–VII — истинные (costae verae): соединяются с грудиной (sternum) непосредственно. VIII–X — ложные (costae spuriae): хрящом к хрящу вышележащего ребра (реберная дуга, arcus costalis). XI–XII — колеблющиеся (costae fluctuantes): передние концы лежат свободно."}, {"t": "Головка ребра — caput costae", "h": ["caput_costae", "facies_articularis_capitis_costae", "crista_capitis_costae"], "text": "Утолщение заднего конца с суставной поверхностью (facies articularis capitis costae), разделённой гребешком (crista capitis costae); сочленяется с телами позвонков — сустав головки ребра (articulatio capitis costae). У I, X и XII рёбер гребешка нет."}, {"t": "Шейка — collum costae", "h": ["collum_costae", "crista_colli_costae"], "text": "Суженная часть за головкой; на верхнем крае — гребешок шейки (crista colli costae; нет у I и последнего рёбер)."}, {"t": "Бугорок ребра — tuberculum costae", "h": ["facies_articularis_tuberculi_costae"], "text": "У перехода шейки в тело; суставная поверхность бугорка (facies articularis tuberculi costae) сочленяется с поперечным отростком позвонка (processus transversus) — рёберно-поперечный сустав (articulatio costotransversaria). У XI и XII рёбер отсутствует."}, {"t": "Угол ребра — angulus costae", "h": ["angulus_costae"], "text": "Сбоку от бугорка (tuberculum costae) изгиб резко меняется. У VI ребра угол совпадает с бугорком; дальше расстояние растёт до XI; у XII угла нет."}, {"t": "Тело и борозда ребра — corpus costae, sulcus costae", "h": ["corpus_costae", "sulcus_costae"], "text": "На внутренней поверхности тела (corpus costae) средних рёбер вдоль нижнего края — борозда ребра (sulcus costae) для межрёберных сосудов (vasa intercostalia)."}, {"t": "I ребро — costa prima", "h": ["caput_costae_i", "collum_costae_i", "tuberculum_costae_i", "tuberculum_m_scaleni_anterioris", "sulcus_arteriae_subclaviae", "sulcus_venae_subclaviae"], "text": "Имеет головку (caput), шейку (collum) и бугорок (tuberculum). На верхней поверхности — бугорок передней лестничной мышцы (tuberculum m. scaleni anterioris). Позади него — борозда подключичной артерии (sulcus a. subclaviae), впереди — более плоская борозда подключичной вены (sulcus v. subclaviae)."}, {"t": "Окостенение и варианты — ossificatio", "text": "Точки окостенения (puncta ossificationis): в области угла (тело), в головке и бугорке (появляются в 15–20 лет, срастаются в 18–25). Варианты — шейное (costa cervicalis) и поясничное (costa lumbalis) добавочные рёбра; XII ребро саблеобразное или стилетообразное, может отсутствовать."}]}, "sternum": {"src": "с. 96–98", "steps": [{"t": "Грудина — sternum", "h": ["sternum"], "text": "Непарная кость грудной клетки (compages thoracis), напоминает кинжал. Состоит из трёх частей: рукоятки (manubrium), тела (corpus) и мечевидного отростка (processus xiphoideus)."}, {"t": "Рукоятка — manubrium sterni", "h": ["manubrium_sterni", "incisura_jugularis_sterni"], "text": "Верхняя часть. На верхнем крае — яремная вырезка (incisura jugularis)."}, {"t": "Ключичные вырезки — incisura clavicularis", "h": ["incisura_clavicularis"], "text": "По бокам от яремной вырезки; сочленяются с грудинными концами ключиц (extremitates sternales claviculae) — грудино-ключичный сустав (articulatio sternoclavicularis)."}, {"t": "Угол грудины — angulus sterni", "h": ["angulus_sterni"], "text": "Выдающийся кпереди угол между нижним краем рукоятки (manubrium) и верхним краем тела (corpus sterni); на уровне II ребра."}, {"t": "Тело — corpus sterni", "h": ["corpus_sterni"], "text": "Средняя часть грудины."}, {"t": "Рёберные вырезки — incisurae costales", "h": ["incisura_costalis_i", "incisura_costalis_ii", "incisurae_costales_iii_v", "incisurae_costales_vi_vii"], "text": "На боковых краях рукоятки и тела; сочленяются с хрящами истинных рёбер (cartilagines costarum verarum). Хрящ I ребра срастается с грудиной (синхондроз, synchondrosis sternocostalis), со II–VII — грудино-рёберные суставы (articulationes sternocostales)."}, {"t": "Мечевидный отросток — processus xiphoideus", "h": ["processus_xiphoideus"], "text": "Нижняя часть; сильно варьирует: может иметь отверстие, быть раздвоенным или отогнутым."}, {"t": "Клиника", "text": "Обилие губчатого вещества (substantia spongiosa) с богатой кровеносной сетью позволяет внутригрудинное переливание крови; красный костный мозг (medulla ossium rubra) грудины берут для пересадок (стернальная пункция)."}, {"t": "Окостенение — ossificatio", "text": "Точки окостенения (puncta ossificationis): в рукоятке 1–2, в теле 4–13, в мечевидном отростке — в 6–20 лет. Нижние отрезки тела срастаются в 15–16 лет, верхний — в 25 лет; мечевидный отросток прирастает после 30 лет, рукоятка — ещё позже и не всегда."}]}, "clavicula": {"src": "с. 137–138", "steps": [{"t": "Ключица — clavicula", "text": "Кость пояса верхней конечности (cingulum membri superioris). Единственная кость, скрепляющая верхнюю конечность со скелетом туловища: отставляет плечевой сустав (articulatio humeri) на должное расстояние от грудной клетки. Смешанная кость; делится на тело (corpus) и два конца (extremitates) — медиальный и латеральный."}, {"t": "Грудинный конец — extremitas sternalis", "h": ["extremitas_sternalis", "facies_articularis_sternalis"], "text": "Утолщённый медиальный конец. Несёт седловидную грудинную суставную поверхность (facies articularis sternalis) для сочленения с грудиной (sternum) — грудино-ключичный сустав (articulatio sternoclavicularis)."}, {"t": "Тело ключицы — corpus claviculae", "h": ["corpus_claviculae"], "text": "Изогнуто: медиальная часть, ближайшая к грудине (sternum), выпукла кпереди, латеральная — кзади (S-образная форма)."}, {"t": "Акромиальный конец — extremitas acromialis", "h": ["extremitas_acromialis", "facies_articularis_acromialis"], "text": "Латеральный конец. Плоская акромиальная суставная поверхность (facies articularis acromialis) — место сочленения с акромионом (acromion) лопатки: акромиально-ключичный сустав (articulatio acromioclavicularis)."}, {"t": "Конический бугорок — tuberculum conoideum", "h": ["tuberculum_conoideum"], "text": "На нижней поверхности акромиального конца (extremitas acromialis) — след прикрепления клювовидно-ключичной связки (lig. coracoclaviculare). На рентгенограмме может симулировать воспаление надкостницы."}, {"t": "Окостенение — ossificatio", "text": "Точка окостенения появляется раньше всех других костей — на 6-й неделе внутриутробного развития. На 16–18-м году возникает ядро в грудинном конце (extremitas sternalis) — эпифиз (epiphysis), оно сливается на 20–25-м году. Средняя часть окостеневает на соединительной ткани, концы — на хряще."}]}, "scapula": {"src": "с. 138–139", "steps": [{"t": "Лопатка — scapula", "text": "Плоская треугольная кость пояса верхней конечности (cingulum membri superioris). Прилегает к задней поверхности грудной клетки (thorax) на пространстве от II до VII ребра (costa). Различают 3 края (margines), 3 угла (anguli), 2 поверхности (facies) и отростки (processus)."}, {"t": "Верхний край — margo superior", "h": ["margo_superior", "incisura_scapulae"], "text": "На нём находится вырезка лопатки (incisura scapulae). Над вырезкой натягивается верхняя поперечная связка лопатки (lig. transversum scapulae superius), превращая её в отверстие."}, {"t": "Медиальный край — margo medialis", "h": ["margo_medialis"], "text": "Обращён к позвоночнику (columna vertebralis)."}, {"t": "Латеральный край — margo lateralis", "h": ["margo_lateralis"], "text": "Обращён к подмышечной впадине (fossa axillaris); сходится с другими краями под углами (anguli)."}, {"t": "Углы — angulus superior, inferior, lateralis", "h": ["angulus_superior", "angulus_inferior", "angulus_lateralis"], "text": "Нижний угол (angulus inferior) направлен книзу; верхний (angulus superior) и латеральный (angulus lateralis) находятся по концам верхнего края (margo superior). Латеральный угол значительно утолщён."}, {"t": "Суставная впадина — cavitas glenoidalis", "h": ["cavitas_glenoidalis"], "text": "Слабо углублённая впадина на латеральном угле (angulus lateralis), стоящая латерально. Сочленяется с головкой плечевой кости (caput humeri) — плечевой сустав (articulatio humeri)."}, {"t": "Шейка лопатки — collum scapulae", "h": ["collum_scapulae"], "text": "Перехват, отделяющий край суставной впадины (cavitas glenoidalis) от остальной части лопатки."}, {"t": "Подсуставной бугорок — tuberculum infraglenoidale", "h": ["tuberculum_infraglenoidale"], "text": "У нижнего края впадины; от него начинается длинная головка трёхглавой мышцы плеча (caput longum m. tricipitis brachii). Над верхним краем впадины — надсуставной бугорок (tuberculum supraglenoidale): длинная головка двуглавой мышцы плеча (caput longum m. bicipitis brachii)."}, {"t": "Клювовидный отросток — processus coracoideus", "h": ["processus_coracoideus"], "text": "Отходит от верхнего края лопатки (margo superior) поблизости от суставной впадины (cavitas glenoidalis); бывший коракоид."}, {"t": "Рёберная поверхность — facies costalis", "h": ["facies_costalis", "fossa_subscapularis"], "text": "Передняя, обращённая к рёбрам (costae) поверхность — плоское углубление, подлопаточная ямка (fossa subscapularis), где прикрепляется подлопаточная мышца (m. subscapularis)."}, {"t": "Задняя поверхность и ость — facies posterior, spina scapulae", "h": ["facies_posterior", "spina_scapulae", "fossa_supraspinata", "fossa_infraspinata"], "text": "Ость лопатки (spina scapulae) делит заднюю поверхность (facies posterior) на две неравные ямки: надостную (fossa supraspinata) и подостную (fossa infraspinata)."}, {"t": "Акромион — acromion", "h": ["acromion", "facies_articularis_acromialis", "angulus_acromialis"], "text": "Продолжение ости (spina scapulae) в латеральную сторону; нависает сзади и сверху над суставной впадиной (cavitas glenoidalis). Несёт суставную поверхность (facies articularis acromii) для сочленения с ключицей (clavicula); акромиальный угол (angulus acromialis)."}, {"t": "Окостенение — ossificatio", "text": "К рождению из костной ткани состоят только тело (corpus) и ость (spina scapulae). На 1-м году — точка в клювовидном отростке (processus coracoideus), синостоз в 16–17 лет; в 11–18 лет — добавочные точки. Акромион (acromion) окостеневает из множественных точек — одна может остаться как os acromiale. Полный синостоз — в 18–24 года."}]}, "humerus": {"src": "с. 141–142", "steps": [{"t": "Плечевая кость — humerus", "text": "Кость свободной верхней конечности (skeleton membri superioris liberi) — плечо (brachium). Длинный рычаг движения, типичная длинная трубчатая кость: диафиз (diaphysis), метафизы (metaphyses), эпифизы (epiphyses) и апофизы (apophyses)."}, {"t": "Головка — caput humeri", "h": ["caput_humeri"], "text": "Шарообразная суставная головка (caput humeri) на верхнем конце — проксимальный эпифиз (epiphysis proximalis). Сочленяется с суставной впадиной лопатки (cavitas glenoidalis scapulae) — плечевой сустав (articulatio humeri)."}, {"t": "Анатомическая шейка — collum anatomicum", "h": ["collum_anatomicum"], "text": "Узкая канавка, отделяющая головку (caput humeri) от остальной кости. На ней оканчивается капсула плечевого сустава (capsula articularis)."}, {"t": "Большой и малый бугорки — tuberculum majus et minus", "h": ["tuberculum_majus", "tuberculum_minus"], "text": "Мышечные бугорки — апофизы (apophyses) — тотчас за анатомической шейкой (collum anatomicum): большой (tuberculum majus) лежит латерально, малый (tuberculum minus) — немного кпереди."}, {"t": "Гребни бугорков — crista tuberculi majoris et minoris", "h": ["crista_tuberculi_majoris", "crista_tuberculi_minoris"], "text": "Гребень большого бугорка (crista tuberculi majoris) и гребень малого бугорка (crista tuberculi minoris) идут от бугорков книзу, служат для прикрепления мышц."}, {"t": "Межбугорковая борозда — sulcus intertubercularis", "h": ["sulcus_intertubercularis"], "text": "Проходит между бугорками и гребнями; в ней лежит сухожилие длинной головки двуглавой мышцы плеча (caput longum m. bicipitis brachii)."}, {"t": "Хирургическая шейка — collum chirurgicum", "h": ["collum_chirurgicum"], "text": "Часть кости тотчас ниже бугорков (tubercula) на границе с диафизом (diaphysis) — место наиболее частых переломов плеча."}, {"t": "Тело — corpus humeri", "h": ["corpus_humeri"], "text": "Вверху цилиндрической формы, внизу — трёхгранной призмы."}, {"t": "Дельтовидная бугристость — tuberositas deltoidea", "h": ["tuberositas_deltoidea"], "text": "Почти посередине тела (corpus humeri) на латеральной поверхности; к ней прикрепляется дельтовидная мышца (m. deltoideus)."}, {"t": "Борозда лучевого нерва — sulcus nervi radialis", "h": ["sulcus_nervi_radialis"], "text": "Позади дельтовидной бугристости (tuberositas deltoidea) по задней поверхности тела (facies posterior), пологой спиралью от медиальной стороны к латеральной; в ней проходит лучевой нерв (n. radialis)."}, {"t": "Мыщелок — condylus humeri", "h": ["condylus_humeri"], "text": "Расширенный и несколько загнутый кпереди нижний (дистальный) конец плечевой кости."}, {"t": "Надмыщелки — epicondylus medialis et lateralis", "h": ["epicondylus_medialis", "epicondylus_lateralis"], "text": "Шероховатые выступы по сторонам мыщелка (condylus humeri) — апофизы (apophyses) для прикрепления мышц и связок. Медиальный надмыщелок (epicondylus medialis) выражен сильнее латерального (epicondylus lateralis)."}, {"t": "Борозда локтевого нерва — sulcus nervi ulnaris", "h": ["sulcus_nervi_ulnaris"], "text": "На задней стороне медиального надмыщелка (epicondylus medialis); в ней лежит локтевой нерв (n. ulnaris)."}, {"t": "Блок — trochlea humeri", "h": ["trochlea_humeri"], "text": "Медиальная часть суставной поверхности, поперечный валик с выемкой посередине. Сочленяется с локтевой костью (ulna), охватывается её блоковидной вырезкой (incisura trochlearis) — плечелоктевой сустав (articulatio humeroulnaris)."}, {"t": "Головка мыщелка — capitulum humeri", "h": ["capitulum_humeri"], "text": "Латерально от блока (trochlea humeri), суставная поверхность в виде сегмента шара; сочленяется с головкой лучевой кости (caput radii) — плечелучевой сустав (articulatio humeroradialis)."}, {"t": "Ямки — fossa coronoidea, radialis, olecrani", "h": ["fossa_coronoidea", "fossa_radialis", "fossa_olecrani"], "text": "Над блоком (trochlea) спереди — венечная ямка (fossa coronoidea), сзади — ямка локтевого отростка (fossa olecrani); над головкой мыщелка (capitulum humeri) спереди — лучевая ямка (fossa radialis)."}, {"t": "Окостенение — ossificatio", "text": "К рождению проксимальный эпифиз (epiphysis proximalis) ещё хрящевой. Точки: медиальная часть головки (caput humeri) — 0–1 год, большой бугорок (tuberculum majus) и латеральная часть головки — 2–3 года, малый бугорок (tuberculum minus) — 3–4 года. Сливаются в головку в 4–6 лет, синостоз с диафизом (diaphysis) — на 12–18-м году."}]}, "ulna": {"src": "с. 144–145", "steps": [{"t": "Локтевая кость — ulna", "text": "Кость предплечья (antebrachium), лежит медиально. Длинная трубчатая кость; тело (corpus ulnae) трёхгранное: три поверхности (facies) и три края (margines)."}, {"t": "Локтевой отросток — olecranon", "h": ["olecranon"], "text": "Задний, более толстый отросток утолщённого проксимального конца — эпифиза (epiphysis)."}, {"t": "Венечный отросток — processus coronoideus", "h": ["processus_coronoideus"], "text": "Передний небольшой отросток проксимального конца."}, {"t": "Блоковидная вырезка — incisura trochlearis", "h": ["incisura_trochlearis"], "text": "Между локтевым (olecranon) и венечным (processus coronoideus) отростками; сочленяется с блоком плечевой кости (trochlea humeri) — плечелоктевой сустав (articulatio humeroulnaris)."}, {"t": "Лучевая вырезка — incisura radialis", "h": ["incisura_radialis"], "text": "На лучевой стороне венечного отростка (processus coronoideus); сочленяется с суставной окружностью головки лучевой кости (circumferentia articularis radii) — проксимальный лучелоктевой сустав (articulatio radioulnaris proximalis)."}, {"t": "Бугристость — tuberositas ulnae", "h": ["tuberositas_ulnae"], "text": "Спереди под венечным отростком (processus coronoideus); место прикрепления сухожилия плечевой мышцы (m. brachialis)."}, {"t": "Тело — corpus ulnae", "h": ["corpus_ulnae", "margo_interosseus", "facies_anterior", "facies_posterior"], "text": "Трёхгранное. Острый межкостный край (margo interosseus) обращён к лучевой кости (radius) и ограничивает межкостное пространство. На передней поверхности (facies anterior) — питательное отверстие (foramen nutricium)."}, {"t": "Головка — caput ulnae", "h": ["caput_ulnae", "circumferentia_articularis"], "text": "На дистальном конце, круглая, с плоской нижней поверхностью. По окружности — суставная окружность (circumferentia articularis) для сочленения с локтевой вырезкой лучевой кости (incisura ulnaris radii) — дистальный лучелоктевой сустав (articulatio radioulnaris distalis)."}, {"t": "Шиловидный отросток — processus styloideus", "h": ["processus_styloideus"], "text": "Отходит от головки (caput ulnae) с медиальной стороны — апофиз (apophysis)."}, {"t": "Окостенение — ossificatio", "text": "Точка в локтевом отростке (olecranon) появляется на 8–11-м году (бывает множественной). К 20 годам — синостоз. При неслиянии ядра локтевого отростка может остаться непостоянная кость — os sesamoideum cubiti (patella cubiti)."}]}, "radius": {"src": "с. 144–145", "steps": [{"t": "Лучевая кость — radius", "text": "Кость предплечья (antebrachium), расположена латерально. Длинная трубчатая кость; в отличие от локтевой (ulna), дистальный конец утолщён больше проксимального."}, {"t": "Головка — caput radii", "h": ["caput_radii"], "text": "Округлая головка проксимального конца — эпифиз (epiphysis) — с плоским углублением для сочленения с головкой мыщелка плечевой кости (capitulum humeri) — плечелучевой сустав (articulatio humeroradialis)."}, {"t": "Суставная окружность — circumferentia articularis", "h": ["circumferentia_articularis"], "text": "Треть-половина окружности головки (caput radii); причленяется к лучевой вырезке локтевой кости (incisura radialis ulnae) — проксимальный лучелоктевой сустав (articulatio radioulnaris proximalis)."}, {"t": "Шейка — collum radii", "h": ["collum_radii"], "text": "Отделяет головку (caput radii) от остальной кости."}, {"t": "Бугристость — tuberositas radii", "h": ["tuberositas_radii"], "text": "Тотчас ниже шейки (collum radii) с переднелоктевой стороны — апофиз (apophysis); место прикрепления двуглавой мышцы плеча (m. biceps brachii)."}, {"t": "Тело — corpus radii", "h": ["corpus_radii", "margo_interosseus", "facies_anterior", "facies_posterior", "facies_lateralis"], "text": "Трёхгранное: передняя (facies anterior), задняя (facies posterior) и латеральная (facies lateralis) поверхности. Межкостный край (margo interosseus) обращён к локтевой кости (ulna). На передней поверхности — питательное отверстие (foramen nutricium)."}, {"t": "Шиловидный отросток — processus styloideus", "h": ["processus_styloideus"], "text": "Продолжение латерального края дистального конца (epiphysis distalis) — апофиз (apophysis)."}, {"t": "Запястная суставная поверхность — facies articularis carpea", "text": "На дистальном эпифизе (epiphysis distalis), вогнута; сочленяется с ладьевидной (os scaphoideum) и полулунной (os lunatum) костями — лучезапястный сустав (articulatio radiocarpea). На медиальном крае — локтевая вырезка (incisura ulnaris) для головки локтевой кости (caput ulnae)."}, {"t": "Окостенение — ossificatio", "text": "Точка в головке (caput radii) появляется на 5–6-м году; к 20 годам происходит синостоз."}]}, "hand": {"src": "с. 148–150", "steps": [{"t": "Кости кисти — ossa manus", "text": "Скелет кисти: запястье (carpus), пясть (metacarpus) и кости пальцев (ossa digitorum manus) — фаланги (phalanges)."}, {"t": "Проксимальный ряд запястья — ossa carpi", "h": ["os_scaphoideum", "os_lunatum", "os_triquetrum", "os_pisiforme"], "text": "От большого пальца: ладьевидная (os scaphoideum), полулунная (os lunatum), трёхгранная (os triquetrum), гороховидная (os pisiforme). Первые три образуют выпуклую суставную поверхность для сочленения с лучевой костью (radius) — лучезапястный сустав (articulatio radiocarpea). Гороховидная в нём не участвует — это сесамовидная кость (os sesamoideum) в сухожилии локтевого сгибателя запястья (m. flexor carpi ulnaris)."}, {"t": "Дистальный ряд запястья — ossa carpi", "h": ["os_trapezium", "os_trapezoideum", "os_capitatum", "os_hamatum"], "text": "Кость-трапеция (os trapezium), трапециевидная (os trapezoideum), головчатая (os capitatum) и крючковидная (os hamatum). Названия отражают форму; на поверхностях — суставные фасетки для соседних костей."}, {"t": "Крючок крючковидной кости — hamulus ossis hamati", "h": ["hamulus_ossis_hamati"], "text": "Выступ на ладонной поверхности. Вместе с гороховидной костью (os pisiforme) образует локтевое возвышение запястья (eminentia carpi ulnaris); с лучевой стороны — лучевое возвышение (eminentia carpi radialis) из бугорков ладьевидной кости и трапеции. Между ними — борозда запястья (sulcus carpi)."}, {"t": "Пясть — ossa metacarpalia", "h": ["os_metacarpale_i", "os_metacarpale_iii", "basis_ossis_metacarpalis", "corpus_ossis_metacarpalis", "caput_ossis_metacarpalis"], "text": "Пять коротких трубчатых костей (ossa metacarpalia I–V) от большого пальца. У каждой — основание (basis), тело (corpus) и головка (caput). Основания сочленяются с дистальным рядом запястья; основание I — седловидное, с трапецией (os trapezium). Головки сочленяются с проксимальными фалангами (phalanges proximales). I — самая короткая и толстая, II — самая длинная."}, {"t": "Фаланги — phalanges", "h": ["phalanx_proximalis", "phalanx_media", "phalanx_distalis"], "text": "В каждом пальце три фаланги — проксимальная (phalanx proximalis), средняя (phalanx media), дистальная (phalanx distalis); в большом (pollex) — две. Основание проксимальной фаланги сочленяется с головкой пястной кости (caput ossis metacarpalis)."}, {"t": "Части фаланги — basis, corpus, caput phalangis", "h": ["basis_phalangis", "corpus_phalangis", "caput_phalangis", "tuberositas_phalangis_distalis"], "text": "Основание (basis phalangis), тело (corpus phalangis) и головка (caput phalangis) — в форме блока у проксимальной и средней. Конец дистальной фаланги сплюснут и несёт бугристость (tuberositas phalangis distalis)."}, {"t": "Сесамовидные кости — ossa sesamoidea", "h": ["ossa_sesamoidea"], "text": "В области пястно-фаланговых (articulationes metacarpophalangeae) и межфаланговых (articulationes interphalangeae) суставов, в местах прикрепления сухожилий. Постоянны на большом пальце (pollex)."}, {"t": "Окостенение — ossificatio", "text": "У новорождённого окостенели только диафизы (diaphyses) трубчатых костей; кости запястья (ossa carpi) и эпифизы (epiphyses) ещё хрящевые. Точки в запястье появляются по ходу часовой стрелки от головчатой кости (os capitatum); трёхгранная (os triquetrum) — в 3 года (по числу граней), далее +1 год к каждой соседней."}]}, "skull_base": {"src": "с. 123, 126–128, 131–132", "steps": [{"t": "Основание черепа — basis cranii", "text": "Различают наружное основание (basis cranii externa) — нижние поверхности лицевого (cranium viscerale, без нижней челюсти) и мозгового черепа (cranium cerebrale), и внутреннее (basis cranii interna), видимое после распила черепа."}, {"t": "Наружное основание: передний отдел", "h": ["palatum_durum", "processus_palatinus", "lamina_horizontalis_ossis_palatini", "sutura_palatina_mediana", "sutura_palatina_transversa"], "text": "Твёрдое нёбо (palatum durum) и альвеолярная дуга (arcus alveolaris) верхней челюсти (maxilla). Поперечный нёбный шов (sutura palatina transversa) — между нёбным отростком верхней челюсти (processus palatinus maxillae) и горизонтальной пластинкой нёбной кости (lamina horizontalis ossis palatini); срединный нёбный шов (sutura palatina mediana) соединяет парные части нёба и спереди сливается с резцовым отверстием (foramen incisivum). Сзади — большое нёбное отверстие (foramen palatinum majus)."}, {"t": "Наружное основание: средний отдел", "h": ["choanae", "vomer", "foramen_ovale", "foramen_spinosum", "foramen_lacerum", "canalis_caroticus"], "text": "От заднего края твёрдого нёба до переднего края большого затылочного отверстия (foramen magnum). На передней границе — хоаны (choanae), разделённые сошником (vomer). Здесь же овальное (foramen ovale), остистое (foramen spinosum) и рваное (foramen lacerum) отверстия, наружное отверстие сонного канала (apertura externa canalis carotici)."}, {"t": "Наружное основание: задний отдел", "h": ["foramen_magnum", "condylus_occipitalis", "foramen_jugulare", "foramen_stylomastoideum", "processus_mastoideus"], "text": "Большое затылочное отверстие (foramen magnum) с затылочными мыщелками (condyli occipitales). Яремное отверстие (foramen jugulare) — для IX, X и XI черепных нервов (nn. glossopharyngeus, vagus, accessorius); от него начинается внутренняя яремная вена (v. jugularis interna). Латеральнее — шилососцевидное отверстие (foramen stylomastoideum) и сосцевидный отросток (processus mastoideus)."}, {"t": "Внутреннее основание — три черепные ямки (fossae cranii)", "text": "В передней (fossa cranii anterior) и средней (fossa cranii media) ямках лежит большой мозг (cerebrum), в задней (fossa cranii posterior) — мозжечок (cerebellum). Граница передней и средней — задние края малых крыльев клиновидной кости (alae minores ossis sphenoidalis); средней и задней — верхний край пирамид височных костей (margo superior partis petrosae)."}, {"t": "Передняя черепная ямка — fossa cranii anterior", "h": ["pars_orbitalis_ossis_frontalis", "lamina_cribrosa", "crista_galli", "foramen_caecum", "ala_minor"], "text": "Образована глазничными частями лобной кости (partes orbitales ossis frontalis), решётчатой пластинкой (lamina cribrosa) решётчатой кости с петушиным гребнем (crista galli) и малыми крыльями клиновидной кости (alae minores). Впереди петушиного гребня — слепое отверстие (foramen caecum)."}, {"t": "Средняя черепная ямка — fossa cranii media", "h": ["fossa_hypophysialis", "tuberculum_sellae", "dorsum_sellae", "ala_major", "sulcus_caroticus"], "text": "Глубже передней. Средняя часть — турецкое седло (sella turcica) с гипофизарной ямкой (fossa hypophysialis), бугорком (tuberculum sellae) и спинкой седла (dorsum sellae); сбоку — сонная борозда (sulcus caroticus). Боковые части — большие крылья клиновидной кости (alae majores), чешуя (pars squamosa) и передняя поверхность пирамид височных костей (facies anterior partis petrosae)."}, {"t": "Отверстия средней ямки — foramina", "h": ["canalis_opticus", "foramen_rotundum", "foramen_ovale", "foramen_spinosum", "foramen_lacerum"], "text": "Зрительный канал (canalis opticus), верхняя глазничная щель (fissura orbitalis superior), круглое (foramen rotundum), овальное (foramen ovale), остистое (foramen spinosum) и рваное (foramen lacerum) отверстия."}, {"t": "Задняя черепная ямка — fossa cranii posterior", "h": ["clivus", "squama_occipitalis", "crista_occipitalis_interna", "sulcus_sinus_sigmoidei"], "text": "Самая глубокая и объёмистая: затылочная кость (os occipitale) со скатом (clivus), чешуёй (squama occipitalis) и внутренним затылочным гребнем (crista occipitalis interna), задние части тела клиновидной кости (corpus ossis sphenoidalis), пирамиды височных костей (partes petrosae) с бороздой сигмовидного синуса (sulcus sinus sigmoidei) и нижнезадние углы теменных костей (anguli mastoidei ossium parietalium)."}, {"t": "Отверстия задней ямки — foramina", "h": ["foramen_magnum", "canalis_hypoglossalis", "foramen_jugulare", "canalis_condylaris", "porus_acusticus_internus"], "text": "Большое затылочное отверстие (foramen magnum), подъязычный канал (canalis hypoglossalis), яремное отверстие (foramen jugulare), мыщелковый канал (canalis condylaris, иногда отсутствует), сосцевидное отверстие (foramen mastoideum), внутреннее слуховое отверстие (porus acusticus internus)."}, {"t": "Синхондрозы основания — synchondroses cranii", "h": ["synchondrosis_sphenooccipitalis", "fissura_petrooccipitalis", "fissura_sphenopetrosa"], "text": "Остатки хряща между костями основания: каменисто-затылочный (synchondrosis petrooccipitalis), клиновидно-каменистый (synchondrosis sphenopetrosa), клиновидно-решётчатый (synchondrosis sphenoethmoidalis); в молодом возрасте — клиновидно-затылочный (synchondrosis sphenooccipitalis). Его синостоз (synostosis, 18–20 лет) заканчивает рост основания черепа в длину."}, {"t": "Череп новорождённого — роднички (fonticuli)", "text": "Передний (fonticulus anterior, ромбовидный, на перекресте сагиттального (sutura sagittalis), лобного (sutura frontalis) и венечного (sutura coronalis) швов) — зарастает на 2-м году; задний (fonticulus posterior, треугольный) — на 2-м месяце; клиновидные (fonticuli sphenoidales) — на 2–3-м месяце; сосцевидные (fonticuli mastoidei). Лицевой череп составляет 1/8 мозгового (у взрослого 1/4)."}, {"t": "Половые различия", "text": "Мужской череп в среднем больше (объём примерно на 10%). Женский — более гладкий, надбровные дуги (arcus superciliares) слабее, лоб вертикальнее, темя (vertex) более плоское."}]}, "skull_fossae": {"src": "с. 124–126", "steps": [{"t": "Глазница — orbita", "text": "Углубление в форме закруглённой четырёхсторонней пирамиды для органа зрения (organum visus). Основание — вход в глазницу (aditus orbitae), верхушка (apex orbitae) направлена назад и медиально."}, {"t": "Медиальная стенка — paries medialis", "h": ["os_ethmoidale_lamina_orbitalis", "crista_lacrimalis_anterior", "crista_lacrimalis_posterior"], "text": "Лобный отросток верхней челюсти (processus frontalis maxillae) с передним слёзным гребнем (crista lacrimalis anterior), слёзная кость (os lacrimale) с задним слёзным гребнем (crista lacrimalis posterior), глазничная пластинка решётчатой кости (lamina orbitalis ossis ethmoidalis) и тело клиновидной кости (corpus ossis sphenoidalis) кпереди от зрительного канала."}, {"t": "Латеральная стенка — paries lateralis", "h": ["os_zygomaticum_facies_orbitalis", "ala_major_facies_orbitalis"], "text": "Глазничные поверхности (facies orbitales) скуловой кости (os zygomaticum) и больших крыльев клиновидной кости (alae majores ossis sphenoidalis)."}, {"t": "Верхняя и нижняя стенки — paries superior et inferior", "h": ["sulcus_infraorbitalis", "os_zygomaticum"], "text": "Верхняя (крыша) — глазничная часть лобной кости (pars orbitalis ossis frontalis) и малые крылья клиновидной (alae minores). Нижняя (дно) — скуловая кость (os zygomaticum) и верхняя челюсть (maxilla) с подглазничной бороздой (sulcus infraorbitalis), сзади — глазничный отросток нёбной кости (processus orbitalis ossis palatini)."}, {"t": "Отверстия у верхушки", "h": ["fissura_orbitalis_superior", "canalis_opticus"], "text": "Латерально — верхняя глазничная щель (fissura orbitalis superior), медиально — зрительный канал (canalis opticus); оба соединяют глазницу с полостью черепа (cavitas cranii)."}, {"t": "Нижняя глазничная щель — fissura orbitalis inferior", "h": ["fissura_orbitalis_inferior"], "text": "В углу между латеральной и нижней стенками; сзади ведёт в крыловидно-нёбную ямку (fossa pterygopalatina), спереди — в подвисочную (fossa infratemporalis)."}, {"t": "Слёзный мешок и носослёзный канал — canalis nasolacrimalis", "h": ["canalis_nasolacrimalis"], "text": "В передней части медиальной стенки — ямка слёзного мешка (fossa sacci lacrimalis); ведёт в носослёзный канал (canalis nasolacrimalis), открывающийся в нижний носовой ход (meatus nasi inferior)."}, {"t": "Решётчатые отверстия — foramina ethmoidalia", "h": ["foramina_ethmoidalia_anterius_et_posterius"], "text": "В шве между лобной и решётчатой костями (sutura frontoethmoidalis) — переднее (foramen ethmoidale anterius, в полость черепа) и заднее (foramen ethmoidale posterius, в полость носа) решётчатые отверстия для сосудов и нервов."}, {"t": "Височная ямка — fossa temporalis", "h": ["fossa_temporalis", "crista_infratemporalis"], "text": "Сверху и сзади — височная линия (linea temporalis), снизу — подвисочный гребень (crista infratemporalis) и нижний край скуловой дуги (arcus zygomaticus), спереди — скуловая кость (os zygomaticum). Выполнена височной мышцей (m. temporalis)."}, {"t": "Подвисочная ямка — fossa infratemporalis", "h": ["fossa_infratemporalis", "tuber_maxillae", "lamina_lateralis_processus_pterygoidei"], "text": "Продолжение височной ямки книзу; граница — подвисочный гребень (crista infratemporalis) большого крыла. Спереди — бугор верхней челюсти (tuber maxillae), медиально — латеральная пластинка крыловидного отростка (lamina lateralis processus pterygoidei). Снаружи частично прикрыта ветвью нижней челюсти (ramus mandibulae). Через нижнюю глазничную щель (fissura orbitalis inferior) сообщается с глазницей, через крыловидно-верхнечелюстную щель (fissura pterygomaxillaris) — с крыловидно-нёбной ямкой."}, {"t": "Крыловидно-нёбная ямка — fossa pterygopalatina", "h": ["fossa_pterygopalatina"], "text": "Спереди — верхняя челюсть (maxilla), сзади — крыловидный отросток (processus pterygoideus), медиально — перпендикулярная пластинка нёбной кости (lamina perpendicularis ossis palatini), отделяющая её от полости носа (cavitas nasi)."}, {"t": "5 отверстий крыловидно-нёбной ямки", "h": ["foramen_sphenopalatinum", "fissura_orbitalis_inferior"], "text": "1) клиновидно-нёбное (foramen sphenopalatinum) — в полость носа; 2) круглое (foramen rotundum) — в среднюю черепную ямку (II ветвь тройничного нерва, n. maxillaris); 3) нижняя глазничная щель (fissura orbitalis inferior) — в глазницу; 4) большой нёбный канал (canalis palatinus major) — в полость рта; 5) крыловидный канал (canalis pterygoideus) — на основание черепа."}]}, "nasal_cavity": {"src": "с. 128–129", "steps": [{"t": "Полость носа — cavitas nasi", "text": "Спереди открывается грушевидным отверстием (apertura piriformis), сзади хоаны (choanae) сообщают её с глоткой (pharynx). Костная перегородка носа (septum nasi osseum) делит полость на две не совсем симметричные половины; в каждой 5 стенок."}, {"t": "Латеральная стенка — paries lateralis", "h": ["os_nasale", "processus_frontalis_maxillae", "os_lacrimale", "concha_nasalis_inferior", "lamina_perpendicularis_ossis_palatini", "lamina_medialis_processus_pterygoidei"], "text": "Устроена сложнее всего. Спереди назад: носовая кость (os nasale), носовая поверхность тела (facies nasalis) и лобный отросток верхней челюсти (processus frontalis maxillae), слёзная кость (os lacrimale), лабиринт решётчатой кости (labyrinthus ethmoidalis), нижняя носовая раковина (concha nasalis inferior), перпендикулярная пластинка нёбной кости (lamina perpendicularis ossis palatini), медиальная пластинка крыловидного отростка (lamina medialis processus pterygoidei)."}, {"t": "Медиальная стенка — перегородка (septum nasi osseum)", "h": ["lamina_perpendicularis_ossis_ethmoidalis", "vomer", "crista_nasalis"], "text": "Перпендикулярная пластинка решётчатой кости (lamina perpendicularis ossis ethmoidalis), сошник (vomer); вверху — носовая ость лобной кости (spina nasalis ossis frontalis) и клиновидный гребень (crista sphenoidalis); внизу — носовые гребни (cristae nasales) верхней челюсти и нёбной кости."}, {"t": "Верхняя стенка — paries superior", "h": ["lamina_cribrosa", "crista_galli"], "text": "Небольшая часть лобной кости (os frontale), решётчатая пластинка (lamina cribrosa) и отчасти клиновидная кость (os sphenoidale)."}, {"t": "Нижняя стенка (дно) — paries inferior", "h": ["processus_palatinus_maxillae", "lamina_horizontalis_ossis_palatini", "canalis_incisivus", "foramen_incisivum"], "text": "Нёбный отросток верхней челюсти (processus palatinus maxillae) и горизонтальная пластинка нёбной кости (lamina horizontalis ossis palatini) — костное нёбо (palatum osseum); спереди — отверстие резцового канала (canalis incisivus)."}, {"t": "Носовые раковины — conchae nasales", "h": ["concha_nasalis_superior", "concha_nasalis_media", "concha_nasalis_inferior", "concha_nasalis_suprema"], "text": "Три раковины — верхняя (concha nasalis superior), средняя (concha nasalis media) и нижняя (concha nasalis inferior) — свисают с латеральной стенки и разделяют три носовых хода (meatus nasi)."}, {"t": "Верхний носовой ход — meatus nasi superior", "h": ["meatus_nasi_superior", "sinus_sphenoidalis", "apertura_sinus_sphenoidalis", "foramen_sphenopalatinum"], "text": "Между верхней и средней раковинами; вдвое короче среднего, только в заднем отделе. Сообщается с клиновидной пазухой (sinus sphenoidalis) через её апертуру (apertura sinus sphenoidalis) и клиновидно-нёбным отверстием (foramen sphenopalatinum); открываются задние решётчатые ячейки (cellulae ethmoidales posteriores)."}, {"t": "Средний носовой ход — meatus nasi medius", "h": ["meatus_nasi_medius", "sinus_maxillaris", "bulla_ethmoidalis", "processus_uncinatus", "sinus_frontalis"], "text": "Между средней и нижней раковинами. Открываются передние и средние решётчатые ячейки (cellulae ethmoidales anteriores et mediae) и верхнечелюстная пазуха (sinus maxillaris); выступает решётчатый пузырёк (bulla ethmoidalis), спереди — крючковидный отросток (processus uncinatus). Через решётчатую воронку (infundibulum ethmoidale) — с лобной пазухой (sinus frontalis) (переход насморка во фронтит)."}, {"t": "Нижний носовой ход — meatus nasi inferior", "h": ["meatus_nasi_inferior"], "text": "Между нижней раковиной и дном. В переднем отделе открывается носослёзный канал (canalis nasolacrimalis) — поэтому при плаче усиливаются выделения из носа."}, {"t": "Общий носовой ход и носоглоточный проход — meatus nasi communis, meatus nasopharyngeus", "h": ["meatus_nasopharyngeus"], "text": "Пространство между раковинами и перегородкой — общий носовой ход (meatus nasi communis). Сзади полость через носоглоточный ход (meatus nasopharyngeus) и хоаны (choanae) переходит в носовую часть глотки (pars nasalis pharyngis)."}]}};
/* ===================== СЦЕНАРИЙ ОТВЕТА ===================== */
/* Как рассказать кость на занятии: от проксимального к дистальному, шаг за шагом.
   Тексты — по М. Г. Привесу; источник показывается внизу справа на каждом шаге.
   SCENARIOS[topicId] = { src, steps: [{ t, text, h: [id терминов для подсветки на карточке] }] } */
const SCENARIO_BOOK = 'М. Г. Привес, «Анатомия человека»';
/* сценарии ответа по суставам и связкам */
Object.assign(SCENARIOS, {"j_general": {"src": "с. 134–136", "steps": [{"t": "Название и определение", "text": "Артрология (синдесмология) — учение о соединениях костей. Все соединения делят на <b>непрерывные (фиброзные), juncturae fibrosae</b>, и <b>прерывные (синовиальные) — суставы, juncturae synoviales</b>.", "h": []}, {"t": "Фиброзные соединения", "text": "<b>Синдесмозы (syndesmoses)</b> — плотная соединительная ткань: связки (lig. stylohyoideum), жёлтые связки (ligg. flava), межкостные перепонки (membrana interossea), роднички. <b>Швы (suturae)</b>: зубчатый (sutura serrata), чешуйчатый (sutura squamosa), плоский (sutura plana). <b>Вколачивание (gomphosis)</b> — зуб в альвеоле.", "h": []}, {"t": "Хрящевые и костные соединения", "text": "<b>Синхондроз (synchondrosis)</b> — сплошная прослойка хряща (между частями основания черепа, у детей — между диафизом и эпифизом). <b>Симфиз (symphysis)</b> — волокнистый хрящ со щелью внутри (межпозвоночный, лобковый). <b>Синостоз (synostosis)</b> — костное сращение, которое замещает синдесмоз или синхондроз с возрастом.", "h": []}, {"t": "Обязательные элементы сустава", "text": "1) <b>суставные поверхности</b>, покрытые суставным хрящом (cartilago articularis, обычно гиалиновым); 2) <b>суставная капсула</b> (capsula articularis): наружная фиброзная (membrana fibrosa) и внутренняя синовиальная (membrana synovialis) мембраны; 3) <b>суставная полость</b> (cavitas articularis) с синовиальной жидкостью.", "h": []}, {"t": "Вспомогательные элементы", "text": "<b>Связки</b> — внекапсульные, капсульные и внутрикапсульные. <b>Суставной диск</b> (discus articularis) — сплошная пластинка, делит полость на два этажа (ВНЧС, грудино-ключичный). <b>Мениски</b> (menisci) — серповидные, в коленном суставе. <b>Суставная губа</b> (labrum articulare) — углубляет впадину (плечевой, тазобедренный). Синовиальные сумки и складки.", "h": []}, {"t": "Классификация по строению", "text": "<b>Простой</b> (articulatio simplex) — 2 кости; <b>сложный</b> (articulatio composita) — 3 и более (локтевой). <b>Комплексный</b> (articulatio complexa) — есть диск или мениски (коленный, ВНЧС). <b>Комбинированный</b> — анатомически отдельные суставы работают вместе (правый и левый ВНЧС, атлантозатылочные).", "h": []}, {"t": "Форма и оси", "text": "<b>Одноосные</b>: цилиндрический (articulatio trochoidea) — вертикальная ось, вращение; блоковидный (ginglymus) — фронтальная ось, сгибание и разгибание. <b>Двуосные</b>: эллипсовидный (articulatio ellipsoidea), седловидный (articulatio sellaris), мыщелковый (articulatio bicondylaris). <b>Многоосные</b>: шаровидный (articulatio spheroidea), чашеобразный (articulatio cotylica), плоский (articulatio plana).", "h": []}, {"t": "Движения по осям", "text": "Вокруг <b>фронтальной</b> оси — сгибание (flexio) и разгибание (extensio); вокруг <b>сагиттальной</b> — отведение (abductio) и приведение (adductio); вокруг <b>вертикальной</b> — вращение (rotatio): кнутри (pronatio) и кнаружи (supinatio). В многоосных суставах — <b>круговое движение</b> (circumductio): кость описывает конус.", "h": []}, {"t": "План ответа о любом суставе", "text": "1) название по-русски и по-латински → 2) кости и суставные поверхности → 3) простой или сложный, комплексный, комбинированный → 4) форма и оси → 5) капсула: где прикрепляется → 6) диск, мениски, губа → 7) связки: откуда и куда, что тормозят → 8) движения по осям → 9) клиника и возрастные особенности.", "h": []}, {"t": "Развитие и возраст", "text": "Суставы закладываются на <b>2-м месяце</b> внутриутробного развития: между зачатками костей уплотняется мезенхима, в ней появляются щели, которые сливаются в суставную полость. Из нерассосавшейся мезенхимы — диски и мениски. У новорождённого все элементы есть, но капсулы туго натянуты, связки слабые; к старости снижается эластичность межпозвоночных дисков.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_tmj": {"src": "с. 149–151", "steps": [{"t": "Название", "text": "Височно-нижнечелюстной сустав — articulatio temporomandibularis. Парный, единственный синовиальный сустав черепа.", "h": []}, {"t": "Суставные поверхности", "text": "Головка нижней челюсти (caput mandibulae), нижнечелюстная ямка (fossa mandibularis) и суставной бугорок (tuberculum articulare) височной кости. Поверхности покрыты волокнистым (соединительнотканным) хрящом.", "h": ["caput_mandibulae", "tuberculum_articulare"]}, {"t": "Суставной диск", "text": "Двояковогнутый волокнисто-хрящевой суставной диск (discus articularis) срастается по краю с капсулой и делит полость на <b>верхний и нижний этажи</b>, каждый со своей синовиальной мембраной (membrana synovialis superior и inferior). К диску прикрепляется латеральная крыловидная мышца (m. pterygoideus lateralis).", "h": ["discus_articularis", "membrana_synovialis_superior", "membrana_synovialis_inferior", "m_pterygoideus_lateralis"]}, {"t": "Классификация", "text": "<b>Простой, комплексный</b> (есть диск), <b>комбинированный</b> — правый и левый суставы работают только вместе. По форме — <b>эллипсовидный</b> (по карточке; у Синельникова — блоковидный).", "h": []}, {"t": "Капсула", "text": "Суставная капсула (capsula articularis) прикрепляется на височной кости спереди по суставному бугорку, сзади — по каменисто-барабанной щели; на нижней челюсти охватывает её шейку. Капсула свободная.", "h": ["capsula_articularis", "capsula_articularis_temporomandibularis"]}, {"t": "Капсульные связки", "text": "<b>Латеральная связка</b> (lig. laterale) — от основания скулового отростка к шейке нижней челюсти, сзади; <b>медиальная связка</b> (lig. mediale) — от ости клиновидной кости к шейке. Обе вплетаются в капсулу.", "h": ["lig_laterale"]}, {"t": "Внекапсульные связки", "text": "<b>Клиновидно-нижнечелюстная</b> (lig. sphenomandibulare) — от ости клиновидной кости (spina ossis sphenoidalis) к язычку нижней челюсти; <b>шилонижнечелюстная</b> (lig. stylomandibulare) — от шиловидного отростка (processus styloideus) к углу челюсти. Рядом — крыловидно-остистая и шилоподъязычная связки.", "h": ["lig_sphenomandibulare", "lig_stylomandibulare", "spina_ossis_sphenoidalis", "processus_styloideus", "lig_pterygospinale", "lig_stylohyoideum"]}, {"t": "Движения", "text": "Вокруг <b>фронтальной</b> оси — опускание и поднятие челюсти (в нижнем этаже, головка вращается под диском). <b>Выдвижение вперёд</b> — головка вместе с диском скользит на суставной бугорок (верхний этаж). Вокруг <b>вертикальной</b> оси — смещение вправо и влево: на одной стороне головка вращается, на другой выходит на бугорок.", "h": []}, {"t": "Клиника и возраст", "text": "Вывих нижней челюсти — при резком открывании рта (зевок, привычка открывать зубами бутылки): боль, рот не закрывается, нарушена речь. Бывает привычный вывих при слабых связках. У новорождённого <b>нет суставного бугорка</b>, но диск уже сформирован.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_spine": {"src": "с. 136–141", "steps": [{"t": "Что рассказать", "text": "Соединения позвонков: между телами — <b>межпозвоночные симфизы</b> (диски), между дугами — <b>синдесмозы</b> (жёлтые связки), между отростками — <b>дугоотростчатые суставы</b> и связки. Плюс длинные связки по всему позвоночнику.", "h": []}, {"t": "Межпозвоночный диск", "text": "Межпозвоночный диск (discus intervertebralis): по периферии — <b>фиброзное кольцо</b> (anulus fibrosus) из волокнистого хряща, в центре — <b>студенистое ядро</b> (nucleus pulposus), которое работает как амортизатор. Всего 23 диска, самые толстые — в поясничном отделе.", "h": ["discus_intervertebralis", "anulus_fibrosus", "nucleus_pulposus"]}, {"t": "Длинные связки", "text": "<b>Передняя продольная связка</b> (lig. longitudinale anterius) — по передней поверхности тел от затылочной кости до крестца, тормозит разгибание. <b>Задняя продольная связка</b> (lig. longitudinale posterius) — по задней поверхности тел внутри позвоночного канала, тормозит сгибание.", "h": ["lig_longitudinale_anterius", "lig_longitudinale_posterius"]}, {"t": "Короткие связки", "text": "<b>Жёлтые связки</b> (ligg. flava) — между дугами (arcus vertebrae), эластичные, помогают разгибанию. <b>Межостистые</b> (lig. interspinale) — между остистыми отростками, <b>надостистая</b> (lig. supraspinale) — по их верхушкам (в шейном отделе — выйная связка), <b>межпоперечные</b> — между поперечными отростками.", "h": ["lig_flavum", "arcus_vertebrae", "lig_interspinale", "lig_supraspinale"]}, {"t": "Дугоотростчатые суставы", "text": "Дугоотростчатый сустав (articulatio zygapophysialis) — между нижней суставной поверхностью (facies articularis inferior) вышележащего позвонка и верхним суставным отростком (processus articularis superior) нижележащего. <b>Плоский</b>, малоподвижный, комбинированный (правый и левый вместе).", "h": ["articulatio_zygapophysialis", "facies_articularis_inferior", "processus_articularis_superior"]}, {"t": "Движения позвоночного столба", "text": "Сгибание и разгибание (фронтальная ось), наклоны вбок (сагиттальная ось), скручивание — вращение (вертикальная ось), круговое движение. Больше всего подвижны шейный и поясничный отделы.", "h": []}, {"t": "Клиника и возраст", "text": "Межпозвоночная грыжа — разрыв фиброзного кольца и выход студенистого ядра, чаще в пояснично-крестцовом отделе: боль при нагрузке, иррадиация в ягодицу и ногу, онемение; может ущемлять корешки спинномозговых нервов. У новорождённых диски относительно большие; в пожилом возрасте теряют эластичность и обызвествляются.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_atlas": {"src": "с. 142–146", "steps": [{"t": "Что рассказать", "text": "Соединения черепа с позвоночником: <b>атлантозатылочный сустав</b> (articulatio atlantooccipitalis), <b>срединный и латеральные атлантоосевые суставы</b>, мембраны и связки.", "h": ["articulatio_atlantooccipitalis", "articulatio_atlantoaxialis_mediana"]}, {"t": "Атлантозатылочный сустав", "text": "Парный: мыщелки затылочной кости (os occipitale) + верхние суставные ямки атланта (atlas). Капсула прикрепляется по краю хрящей. <b>Мыщелковый, эллипсовидный, комбинированный</b> — правый и левый работают вместе, двуосный.", "h": ["os_occipitale", "atlas", "articulatio_atlantooccipitalis", "capsula_articularis_atlantooccipitalis"]}, {"t": "Движения в атлантозатылочном", "text": "Вокруг <b>фронтальной</b> оси — кивательные движения: наклон головы вперёд (~20°) и назад (~30°). Вокруг <b>сагиттальной</b> — наклоны головы в стороны (~20°).", "h": []}, {"t": "Мембраны", "text": "<b>Передняя атлантозатылочная мембрана</b> (membrana atlantooccipitalis anterior) — между передним краем большого затылочного отверстия и передней дугой атланта, срастается с передней продольной связкой. <b>Задняя</b> (membrana atlantooccipitalis posterior) — к задней дуге. <b>Покровная мембрана</b> (membrana tectoria) — продолжение задней продольной связки к скату.", "h": ["membrana_atlantooccipitalis_anterior", "membrana_atlantooccipitalis_posterior", "membrana_tectoria", "lig_longitudinale_posterius"]}, {"t": "Срединный атлантоосевой сустав", "text": "Зуб осевого позвонка (dens axis) + ямка зуба на передней дуге атланта (arcus anterior atlantis) спереди и поперечная связка атланта сзади. <b>Цилиндрический</b>, одноосный: вращение головы вокруг вертикальной оси на 30–40° в каждую сторону.", "h": ["dens_axis", "arcus_anterior_atlantis", "axis", "articulatio_atlantoaxialis_mediana"]}, {"t": "Крестообразная связка атланта", "text": "Крестообразная связка атланта (lig. cruciforme atlantis) = <b>поперечная связка атланта</b> (lig. transversum atlantis) + <b>продольные пучки</b> (fasciculi longitudinales) к затылочной кости и телу осевого позвонка. Удерживает зуб, защищает спинной мозг.", "h": ["lig_cruciforme_atlantis", "lig_transversum_atlantis", "fasciculus_longitudinalis"]}, {"t": "Связки зуба", "text": "<b>Крыловидные связки</b> (ligg. alaria) — от боковых поверхностей зуба к мыщелкам затылочной кости, тормозят чрезмерный поворот головы. <b>Связка верхушки зуба</b> (lig. apicis dentis) — к переднему краю большого затылочного отверстия.", "h": ["lig_alare", "lig_apicis_dentis"]}, {"t": "Латеральные атлантоосевые суставы", "text": "Нижние суставные ямки атланта + верхние суставные поверхности осевого позвонка. <b>Плоские, комбинированные</b> — участвуют во вращении головы вместе со срединным. Все три сустава вместе дают движения головы вокруг трёх осей.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_costovert": {"src": "с. 146–148", "steps": [{"t": "Что рассказать", "text": "Рёбра соединяются с позвонками двумя суставами: <b>сустав головки ребра</b> (articulatio capitis costae) и <b>рёберно-поперечный сустав</b> (articulatio costotransversaria).", "h": ["articulatio_capitis_costae", "articulatio_costotransversaria"]}, {"t": "Сустав головки ребра", "text": "Суставная поверхность головки ребра (facies articularis capitis costae) + верхняя и нижняя рёберные ямки (fovea costalis superior, inferior) двух соседних позвонков. У I, XI и XII рёбер — одна полная ямка одного позвонка. <b>Шаровидный</b>, комбинированный.", "h": ["facies_articularis_capitis_costae", "fovea_costalis_superior", "fovea_costalis_inferior", "articulatio_capitis_costae"]}, {"t": "Связки сустава головки", "text": "<b>Внутрисуставная связка головки ребра</b> (lig. capitis costae intraarticulare) — от гребня головки к межпозвоночному диску (discus intervertebralis), делит полость на две (её нет у I, XI, XII). <b>Лучистая связка головки ребра</b> (lig. capitis costae radiatum) — снаружи капсулы, веером к телам позвонков.", "h": ["lig_capitis_costae_intraarticulare", "lig_capitis_costae_radiatum", "discus_intervertebralis"]}, {"t": "Рёберно-поперечный сустав", "text": "Бугорок ребра + рёберная ямка поперечного отростка (processus transversus). Есть у I–X рёбер. <b>Плоский</b>, комбинированный.", "h": ["articulatio_costotransversaria", "processus_transversus"]}, {"t": "Связки рёберно-поперечного", "text": "<b>Рёберно-поперечная связка</b> (lig. costotransversarium) — от шейки ребра к поперечному отростку; <b>латеральная рёберно-поперечная</b> (lig. costotransversarium laterale) — от бугорка ребра к верхушке поперечного отростка. Между отростками — межпоперечные связки.", "h": ["lig_costotransversarium", "lig_costotransversarium_laterale", "lig_intertransversarium"]}, {"t": "Движения", "text": "Оба сустава работают как один комбинированный: ребро вращается вокруг оси, проходящей через шейку, — <b>поднимание и опускание рёбер</b>. При вдохе передние концы рёбер и грудина поднимаются, межрёберные промежутки расширяются; при выдохе — наоборот.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_sternocostal": {"src": "с. 147–149", "steps": [{"t": "Что рассказать", "text": "Соединения рёбер с грудиной, рёбер между собой и частей грудины. Передние концы рёбер — хрящевые, поэтому соединения здесь и хрящевые, и суставные.", "h": []}, {"t": "I–VII рёбра", "text": "Хрящ <b>I ребра</b> срастается с рукояткой — <b>синхондроз</b>. Хрящи <b>II–VII</b> рёбер образуют с рёберными вырезками грудины <b>грудино-рёберные суставы</b> (articulationes sternocostales) — плоские. В суставе II ребра есть <b>внутрисуставная грудино-рёберная связка</b> (lig. sternocostale intraarticulare).", "h": ["articulationes_sternocostales", "lig_sternocostale_intraarticulare"]}, {"t": "Связки грудино-рёберных суставов", "text": "<b>Лучистые грудино-рёберные связки</b> (ligg. sternocostalia radiata) веером идут от хрящей к грудине и, переплетаясь, образуют <b>мембрану грудины</b> (membrana sterni). От VI–VII хрящей к мечевидному отростку — <b>рёберно-мечевидные связки</b> (ligg. costoxiphoidea).", "h": ["ligg_sternocostalia_radiata", "membrana_sterni", "ligg_costoxiphoidea"]}, {"t": "VIII–XII рёбра", "text": "Хрящи <b>VIII–X</b> рёбер не доходят до грудины и соединяются с вышележащим хрящом — <b>межхрящевые суставы</b> (articulationes interchondrales), так образуется рёберная дуга. <b>XI–XII</b> рёбра заканчиваются свободно в мышцах живота. Кость ребра с хрящом — <b>рёберно-хрящевые соединения</b>.", "h": ["articulationes_interchondrales", "articulationes_costochondrales"]}, {"t": "Соединения частей грудины", "text": "Рукоятка и тело — <b>рукоятко-грудинный синхондроз</b> (synchondrosis manubriosternalis), тело и мечевидный отросток — <b>мечевидно-грудинный синхондроз</b> (synchondrosis xiphosternalis). С возрастом они окостеневают.", "h": ["synchondrosis_manubriosternalis", "synchondrosis_xiphosternalis"]}, {"t": "Межрёберные мембраны", "text": "В межрёберьях — <b>наружная межрёберная мембрана</b> (membrana intercostalis externa) спереди, в области хрящей, и <b>внутренняя</b> — сзади, у позвоночника. Там, где мембраны, межрёберных мышц нет.", "h": ["membrana_intercostalis_externa"]}, {"t": "Грудная клетка в целом", "text": "Грудная клетка образована 12 грудными позвонками, 12 парами рёбер и грудиной. Рёбра I–VII — истинные (доходят до грудины), VIII–X — ложные, XI–XII — колеблющиеся. При дыхании рёбра поднимаются и опускаются, грудная клетка меняет объём.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_sternoclav": {"src": "с. 151–152", "steps": [{"t": "Название", "text": "Грудино-ключичный сустав — articulatio sternoclavicularis. Единственный сустав, соединяющий верхнюю конечность со скелетом туловища.", "h": []}, {"t": "Суставные поверхности", "text": "Грудинный конец ключицы (clavicula) + ключичная вырезка рукоятки грудины (manubrium sterni). Поверхности покрыты волокнистым хрящом, несоответствие выравнивает диск.", "h": ["clavicula", "manubrium_sterni"]}, {"t": "Классификация и форма", "text": "<b>Простой, комплексный</b> — внутри <b>суставной диск</b> (discus articularis), который делит полость на две части. По карточке — <b>плоский</b>, у Синельникова поверхности седловидные, а по объёму движений сустав приближается к <b>шаровидному</b> — многоосный.", "h": ["discus_articularis"]}, {"t": "Капсула и связки", "text": "Капсула прочная, по краю суставных поверхностей. <b>Передняя и задняя грудино-ключичные связки</b> (lig. sternoclaviculare anterius / posterius) укрепляют капсулу. <b>Межключичная связка</b> (lig. interclaviculare) — над яремной вырезкой между ключицами, тормозит опускание ключицы.", "h": ["lig_sternoclaviculare_anterius", "lig_interclaviculare"]}, {"t": "Рёберно-ключичная связка", "text": "<b>Рёберно-ключичная связка</b> (lig. costoclaviculare) — мощная, от I ребра (costa) к нижней поверхности ключицы; тормозит поднимание ключицы.", "h": ["lig_costoclaviculare", "costa"]}, {"t": "Движения", "text": "Вокруг <b>сагиттальной</b> оси — поднимание и опускание ключицы; вокруг <b>вертикальной</b> — движения вперёд и назад; возможно и <b>круговое</b> движение. Вместе с ключицей движется вся лопатка и плечо.", "h": []}, {"t": "Клиника", "text": "Вывих грудинного конца ключицы относительно редок (падение на вытянутую руку). Чаще вывихивается акромиальный конец — при ударе сверху по плечу. Симптомы: выпирание конца кости, боль, ограничение движений. Лечение — вправление и фиксация.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_shoulder": {"src": "с. 152–155", "steps": [{"t": "Что рассказать", "text": "Два сустава пояса и плеча: <b>акромиально-ключичный</b> (articulatio acromioclavicularis) и <b>плечевой</b> (articulatio humeri), плюс собственные связки лопатки.", "h": ["articulatio_acromioclavicularis"]}, {"t": "Акромиально-ключичный сустав", "text": "Акромиальный конец ключицы (clavicula) + суставная поверхность акромиона (acromion). Простой, <b>плоский</b>, многоосный, но движения очень малы — их ограничивают связки. Иногда есть диск.", "h": ["clavicula", "acromion", "articulatio_acromioclavicularis"]}, {"t": "Связки акромиально-ключичного", "text": "<b>Акромиально-ключичная связка</b> (lig. acromioclaviculare) — над суставом. <b>Клювовидно-ключичная</b> (lig. coracoclaviculare) — от клювовидного отростка к ключице, из двух частей: латеральной <b>трапециевидной</b> (lig. trapezoideum) и медиальной <b>конической</b> (lig. conoideum).", "h": ["lig_acromioclaviculare", "lig_coracoclaviculare", "lig_trapezoideum", "lig_conoideum", "processus_coracoideus"]}, {"t": "Собственные связки лопатки", "text": "<b>Клювовидно-акромиальная</b> (lig. coracoacromiale) — самая мощная, образует «свод плеча» над головкой плечевой кости. <b>Верхняя поперечная связка лопатки</b> — над вырезкой, превращает её в отверстие для надлопаточного нерва. <b>Нижняя поперечная</b> — от основания акромиона к краю впадины.", "h": ["lig_coracoacromiale", "lig_transversum_scapulae_superius", "lig_transversum_scapulae_inferius"]}, {"t": "Плечевой сустав: поверхности", "text": "Суставная впадина лопатки (cavitas glenoidalis) + головка плечевой кости. Впадина в 3–4 раза меньше головки; несоответствие уменьшает <b>суставная губа</b> (labrum glenoidale) по краю впадины. Сустав <b>простой, шаровидный</b>, многоосный.", "h": ["cavitas_glenoidalis", "labrum_glenoidale"]}, {"t": "Капсула плечевого сустава", "text": "Капсула (capsula articularis) — от края впадины и губы до <b>анатомической шейки</b>. Просторная, слабо натянутая, внизу тонкая. Через полость проходит <b>сухожилие длинной головки двуглавой мышцы</b> (от надсуставного бугорка), в межбугорковой борозде его окружает синовиальное влагалище.", "h": ["capsula_articularis", "membrana_synovialis", "tendo_m_bicipitis_brachii_caput_longum", "vagina_tendinis_intertubercularis"]}, {"t": "Связки плечевого сустава", "text": "<b>Клювовидно-плечевая связка</b> (lig. coracohumerale) — от клювовидного отростка к большому бугорку. <b>Суставно-плечевые связки</b> (ligg. glenohumeralia) — верхняя, средняя и нижняя, утолщения передней стенки капсулы. Капсулу укрепляют сухожилия мышц: надостной, подостной, малой круглой, подлопаточной (m. subscapularis).", "h": ["lig_coracohumerale", "lig_glenohumerale_superius", "lig_glenohumerale_mediale", "lig_glenohumerale_inferius", "m_subscapularis"]}, {"t": "Движения", "text": "Вокруг <b>фронтальной</b> оси — сгибание и разгибание; вокруг <b>сагиттальной</b> — отведение до горизонтали (выше — вместе с лопаткой) и приведение; вокруг <b>вертикальной</b> — вращение кнутри и кнаружи; <b>круговое</b> движение. Самый подвижный сустав тела.", "h": []}, {"t": "Клиника и возраст", "text": "Из-за свободной капсулы и маленькой впадины плечевой сустав <b>вывихивается чаще всех</b> — падение на вытянутую руку; чаще книзу и кпереди, где капсула тонкая. Симптомы: резкая боль, асимметрия плеч, головка прощупывается ниже. У новорождённого впадина плоская, капсула толстая; к <b>4–7 годам</b> сустав близок к взрослому.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_elbow": {"src": "с. 155–158", "steps": [{"t": "Название", "text": "Локтевой сустав — articulatio cubiti. <b>Сложный</b>: три кости (плечевая, локтевая, лучевая) и три сустава в <b>одной капсуле</b>.", "h": ["capsula_articularis"]}, {"t": "Плечелоктевой сустав", "text": "Блок плечевой кости + блоковидная вырезка локтевой кости. <b>Блоковидный</b>, одноосный — именно он даёт сгибание и разгибание.", "h": ["articulatio_humeroulnaris"]}, {"t": "Плечелучевой сустав", "text": "Головка мыщелка плечевой кости + ямка головки лучевой кости. По форме <b>шаровидный</b>, но движений только два: сгибание/разгибание (вместе с локтевой) и вращение лучевой кости. Отведения нет — локтевая кость не даёт.", "h": ["articulatio_humeroradialis"]}, {"t": "Проксимальный лучелоктевой сустав", "text": "Суставная окружность головки лучевой кости (circumferentia articularis) + лучевая вырезка локтевой. <b>Цилиндрический</b>: вращение лучевой кости вокруг продольной оси — пронация и супинация.", "h": ["articulatio_radioulnaris_proximalis", "circumferentia_articularis"]}, {"t": "Капсула", "text": "На плечевой кости капсула прикрепляется выше венечной и лучевой ямок спереди и ямки локтевого отростка сзади, <b>надмыщелки остаются снаружи</b>. На локтевой — по краю блоковидной и лучевой вырезок, на лучевой — к шейке. Спереди и сзади тонкая, по бокам укреплена связками.", "h": ["capsula_articularis"]}, {"t": "Коллатеральные связки", "text": "<b>Локтевая коллатеральная</b> (lig. collaterale ulnare) — от медиального надмыщелка к краю блоковидной вырезки. <b>Лучевая коллатеральная</b> (lig. collaterale radiale) — от латерального надмыщелка, охватывает головку лучевой кости и вплетается в кольцевую связку. Не дают боковых движений.", "h": ["lig_collaterale_ulnare", "lig_collaterale_radiale"]}, {"t": "Связки лучевой кости", "text": "<b>Кольцевая связка лучевой кости</b> (lig. anulare radii) охватывает головку и крепится к краям лучевой вырезки — удерживает головку при вращении. <b>Квадратная связка</b> (lig. quadratum) — от нижнего края лучевой вырезки к шейке лучевой кости.", "h": ["lig_anulare_radii", "lig_quadratum"]}, {"t": "Соединения костей предплечья", "text": "Между диафизами — <b>межкостная перепонка</b> (синдесмоз) и <b>косая хорда</b> (chorda obliqua) — от бугристости локтевой кости (tuberositas ulnae) к лучевой, ниже её бугристости. Рядом прикрепляется сухожилие двуглавой мышцы.", "h": ["chorda_obliqua", "tuberositas_ulnae", "tendo_m_bicipitis_brachii"]}, {"t": "Движения", "text": "Вокруг <b>фронтальной</b> оси — сгибание и разгибание предплечья, общий объём до <b>170°</b>. Вокруг <b>продольной</b> оси — пронация и супинация (вместе с дистальным лучелоктевым суставом).", "h": []}, {"t": "Возраст", "text": "У новорождённого связки слабые, капсула туго натянута; сустав формируется до <b>13–14 лет</b>.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_wrist": {"src": "с. 159–163", "steps": [{"t": "Что рассказать", "text": "Соединения кисти идут от предплечья к пальцам: дистальный лучелоктевой → лучезапястный → межзапястные → запястно-пястные → межпястные → пястно-фаланговые → межфаланговые.", "h": []}, {"t": "Дистальный лучелоктевой сустав", "text": "Головка локтевой кости (ulna) + локтевая вырезка лучевой (radius); от кисти отделён <b>суставным диском</b> (discus articularis). <b>Цилиндрический</b>; вместе с проксимальным — комбинированный: пронация и супинация. Капсула образует <b>мешкообразное углубление</b> (recessus sacciformis). Между костями — межкостная перепонка.", "h": ["articulatio_radioulnaris_distalis", "discus_articularis", "recessus_sacciformis", "membrana_interossea_antebrachii", "ulna", "radius"]}, {"t": "Лучезапястный сустав", "text": "Запястная суставная поверхность лучевой кости и диск + проксимальный ряд запястья: <b>ладьевидная, полулунная, трёхгранная</b> (os scaphoideum, lunatum, triquetrum). <b>Сложный, эллипсовидный</b>, двуосный. Капсула тонкая, по краю суставных поверхностей.", "h": ["articulatio_radiocarpea", "os_scaphoideum", "os_lunatum", "os_triquetrum"]}, {"t": "Связки лучезапястного сустава", "text": "<b>Лучевая коллатеральная связка запястья</b> — от шиловидного отростка лучевой к ладьевидной; <b>локтевая коллатеральная</b> — от шиловидного отростка локтевой к трёхгранной и гороховидной. <b>Ладонная и тыльная лучезапястные</b>, <b>ладонная локтезапястная</b> связки.", "h": ["lig_collaterale_carpi_radiale", "lig_collaterale_carpi_ulnare", "lig_radiocarpeum_palmare", "lig_radiocarpeum_dorsale", "lig_ulnocarpeum_palmare"]}, {"t": "Движения кисти", "text": "В лучезапястном и среднезапястном вместе: вокруг <b>фронтальной</b> оси — сгибание и разгибание, вокруг <b>сагиттальной</b> — отведение и приведение. Вращения нет — «поворот кисти» происходит в лучелоктевых суставах.", "h": []}, {"t": "Суставы запястья", "text": "<b>Среднезапястный сустав</b> (articulatio mediocarpea) — между проксимальным и дистальным рядами, S-образная щель. <b>Межзапястные суставы</b> — между соседними костями, укреплены межкостными, ладонными и тыльными межзапястными связками и <b>лучистой связкой запястья</b> (от головчатой кости). <b>Сустав гороховидной кости</b> — гороховидно-крючковидная и гороховидно-пястная связки.", "h": ["articulatio_mediocarpea", "articulationes_intercarpeae", "ligg_intercarpea_interossea", "lig_carpi_radiatum", "os_pisiforme", "lig_pisohamatum", "lig_pisometacarpeum"]}, {"t": "Запястно-пястные суставы", "text": "Дистальный ряд запястья (os trapezoideum, capitatum, hamatum) + основания II–V пястных костей. <b>Плоские</b>, малоподвижные, укреплены ладонными и тыльными запястно-пястными связками. Межпястные суставы — между основаниями II–V пястных, сообщаются с запястно-пястными.", "h": ["articulatio_carpometacarpea", "articulationes_intermetacarpeae", "ligg_metacarpea_interossea", "os_trapezoideum", "os_capitatum", "os_hamatum"]}, {"t": "Запястно-пястный сустав большого пальца", "text": "Кость-трапеция (os trapezium) + основание I пястной кости. <b>Седловидный</b>, двуосный, изолирован от остальных и очень подвижен: <b>противопоставление</b> большого пальца и обратное движение, отведение и приведение, круговое движение.", "h": ["articulatio_carpometacarpea_pollicis", "os_trapezium"]}, {"t": "Пястно-фаланговые суставы", "text": "Головки пястных костей + основания проксимальных фаланг. II–V — <b>шаровидные</b>, но вращения нет (его тормозят коллатеральные связки): сгибание/разгибание и отведение/приведение. I — <b>блоковидный</b>. С ладонной стороны — ладонные связки, между головками — глубокие поперечные пястные связки.", "h": ["articulatio_metacarpophalangea", "ligg_collateralia", "ligg_palmaria", "ligg_metacarpea_transversa_profunda"]}, {"t": "Межфаланговые суставы", "text": "Между фалангами. <b>Блоковидные</b>, одноосные: только сгибание и разгибание. Укреплены коллатеральными и ладонными связками; спереди проходят сухожилия поверхностного и глубокого сгибателей пальцев в фиброзных влагалищах.", "h": ["articulationes_interphalangeae_manus", "articulatio_interphalangea_manus", "tendo_m_flexoris_digitorum_superficialis", "tendo_m_flexoris_digitorum_profundi", "vagina_fibrosa_digiti_manus"]}, {"t": "Возраст", "text": "У новорождённого суставной диск ещё не оформлен и сливается с хрящевым эпифизом локтевой кости, капсула тонкая; кости кисти хрящевые, движения ограничены. Суставы формируются вместе с окостенением кисти.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_pelvis": {"src": "с. 163–166", "steps": [{"t": "Что рассказать", "text": "Таз — прочное <b>кольцо</b>: сзади кости таза соединены с крестцом <b>крестцово-подвздошными суставами</b>, спереди лобковые кости — <b>лобковым симфизом</b>; плюс мощные связки и запирательная мембрана.", "h": []}, {"t": "Крестцово-подвздошный сустав", "text": "Ушковидные поверхности подвздошной кости и крестца. Парный, <b>плоский</b>, почти неподвижный. Капсула туго натянута, по краю суставных поверхностей.", "h": ["articulatio_sacroiliaca"]}, {"t": "Связки крестцово-подвздошного сустава", "text": "<b>Передние (вентральные) крестцово-подвздошные</b> — спереди; <b>задние</b> — сзади; <b>межкостные</b> (ligg. sacroiliaca interossea) — самые прочные, в щели между бугристостями. <b>Подвздошно-поясничная связка</b> (lig. iliolumbale) — от поперечных отростков IV–V поясничных к подвздошному гребню.", "h": ["ligg_sacroiliaca_anteriora", "lig_sacroiliacum_ventrale", "ligg_sacroiliaca_posteriora", "ligg_sacroiliaca_interossea", "lig_iliolumbale"]}, {"t": "Лобковый симфиз", "text": "Лобковый симфиз (symphysis pubica) — между симфизиальными поверхностями лобковых костей, внутри <b>межлобковый диск</b> (discus interpubicus) из волокнистого хряща со щелевидной полостью. Сверху — <b>верхняя лобковая связка</b>, снизу — <b>дугообразная связка лобка</b> (lig. arcuatum pubis).", "h": ["symphysis_pubica", "discus_interpubicus", "lig_pubicum_superius", "lig_arcuatum_pubis"]}, {"t": "Крестцово-бугорная и крестцово-остистая связки", "text": "<b>Крестцово-бугорная</b> (lig. sacrotuberale) — от латерального края крестца и копчика к седалищному бугру, продолжается <b>серповидным отростком</b>. <b>Крестцово-остистая</b> (lig. sacrospinale) — от крестца и копчика к седалищной ости.", "h": ["lig_sacrotuberale", "lig_sacrospinale", "processus_falciformis"]}, {"t": "Седалищные отверстия", "text": "Эти связки вместе с вырезками седалищной кости ограничивают <b>большое седалищное отверстие</b> (выше крестцово-остистой) и <b>малое седалищное отверстие</b> (между связками). Через них выходят мышцы, сосуды и нервы.", "h": ["foramen_ischiadicum_majus", "foramen_ischiadicum_minus"]}, {"t": "Запирательная мембрана и паховая связка", "text": "<b>Запирательная мембрана</b> (membrana obturatoria) закрывает запирательное отверстие, оставляя <b>запирательный канал</b> (canalis obturatorius) для сосудов и нерва. <b>Паховая связка</b> (lig. inguinale) — от передней верхней подвздошной ости к лобковому бугорку.", "h": ["membrana_obturatoria", "canalis_obturatorius", "lig_inguinale"]}, {"t": "Клиника", "text": "При беременности симфиз размягчается — это нужно для родов. Возможен <b>симфизит</b>: боль и «щелчок» при ходьбе, трудно подниматься по лестнице.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_hip": {"src": "с. 166–168", "steps": [{"t": "Название", "text": "Тазобедренный сустав — articulatio coxae.", "h": []}, {"t": "Суставные поверхности", "text": "Полулунная поверхность <b>вертлужной впадины</b> тазовой кости + <b>головка бедренной кости</b>. Впадину углубляет <b>вертлужная губа</b> (labrum acetabuli), над вырезкой впадины — поперечная связка вертлужной впадины.", "h": ["labrum_acetabuli"]}, {"t": "Классификация", "text": "<b>Простой, чашеобразный</b> — разновидность шаровидного (articulatio cotylica), многоосный. Головка почти целиком погружена во впадину.", "h": []}, {"t": "Капсула", "text": "Капсула (capsula articularis) на тазе — по краю вертлужной впадины, на бедре спереди — по <b>межвертельной линии</b>, сзади захватывает около <b>2/3 шейки</b>, не доходя до межвертельного гребня. Очень прочная.", "h": ["capsula_articularis"]}, {"t": "Внутрисуставная связка", "text": "<b>Связка головки бедренной кости</b> (lig. capitis femoris) — от вырезки вертлужной впадины к ямке головки; окружена синовиальной мембраной, в ней идут сосуды к головке.", "h": []}, {"t": "Подвздошно-бедренная связка", "text": "<b>Подвздошно-бедренная</b> (lig. iliofemorale) — самая мощная связка тела: от нижней передней подвздошной ости к межвертельной линии. Тормозит разгибание, позволяет стоять без напряжения мышц.", "h": ["lig_iliofemorale"]}, {"t": "Лобково- и седалищно-бедренная", "text": "<b>Лобково-бедренная</b> (lig. pubofemorale) — от верхней ветви лобковой кости к нижней части межвертельной линии, тормозит отведение. <b>Седалищно-бедренная</b> (lig. ischiofemorale) — сзади, от тела седалищной кости к вертельной ямке, тормозит вращение внутрь. <b>Круговая зона</b> (zona orbicularis) — в толще капсулы, охватывает шейку.", "h": ["lig_ischiofemorale", "zona_orbicularis"]}, {"t": "Движения", "text": "Вокруг <b>фронтальной</b> оси — сгибание и разгибание; вокруг <b>сагиттальной</b> — отведение и приведение; вокруг <b>вертикальной</b> — вращение кнаружи и внутрь; <b>круговое</b> движение. Объём меньше, чем в плечевом: глубокая впадина и мощные связки.", "h": []}, {"t": "Возраст", "text": "У новорождённого впадина почти плоская, головка лежит вне её и выше; хорошо развита только подвздошно-бедренная связка. К <b>4–7 годам</b> головка погружается во впадину, к <b>13–14</b> сустав принимает окончательную форму. Отсюда важность ранней диагностики дисплазии.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_knee": {"src": "с. 169–173", "steps": [{"t": "Название", "text": "Коленный сустав — articulatio genus. Самый крупный и сложный сустав тела.", "h": []}, {"t": "Суставные поверхности", "text": "Медиальный и латеральный <b>мыщелки бедренной кости</b> и её надколенниковая поверхность + мыщелки <b>большеберцовой кости</b> (tibia) + суставная поверхность <b>надколенника</b> (patella). Малоберцовая кость в суставе не участвует.", "h": ["tibia", "patella", "facies_articularis_patellae"]}, {"t": "Классификация", "text": "<b>Сложный</b> (3 кости), <b>комплексный</b> (мениски), по форме <b>мыщелковый</b>, двуосный.", "h": []}, {"t": "Мениски", "text": "<b>Медиальный мениск</b> (meniscus medialis) — C-образный, срастается с большеберцовой коллатеральной связкой (поэтому чаще травмируется); <b>латеральный</b> (meniscus lateralis) — почти кольцо. Наружный край срастается с капсулой. Спереди мениски соединяет <b>поперечная связка колена</b> (lig. transversum genus); к бедру идут менискобедренные связки.", "h": ["meniscus_medialis", "meniscus_lateralis", "lig_transversum_genus", "lig_meniscofemorale_anterius"]}, {"t": "Крестообразные связки", "text": "<b>Передняя крестообразная</b> (lig. cruciatum anterius) — от внутренней поверхности латерального мыщелка бедра к передней межмыщелковой площадке, удерживает голень от смещения вперёд. <b>Задняя</b> (lig. cruciatum posterius) — от медиального мыщелка к задней площадке, не даёт голени сместиться назад.", "h": ["ligg_cruciata_genus", "lig_cruciatum_anterius", "lig_cruciatum_posterius"]}, {"t": "Коллатеральные связки", "text": "<b>Большеберцовая коллатеральная</b> (lig. collaterale tibiale) — от медиального надмыщелка бедра к большеберцовой кости, срастается с капсулой и медиальным мениском. <b>Малоберцовая коллатеральная</b> (lig. collaterale fibulare) — от латерального надмыщелка к головке малоберцовой кости. Натянуты при разогнутом колене — тормозят вращение.", "h": ["lig_collaterale_tibiale", "lig_collaterale_fibulare"]}, {"t": "Связки спереди и сзади", "text": "Спереди — <b>связка надколенника</b> (lig. patellae, продолжение сухожилия четырёхглавой мышцы) и <b>медиальная и латеральная поддерживающие связки надколенника</b>. Сзади — <b>косая подколенная</b> (lig. popliteum obliquum, от сухожилия полуперепончатой мышцы) и <b>дугообразная подколенная</b> (lig. popliteum arcuatum).", "h": ["lig_patellae", "retinaculum_patellae_mediale", "retinaculum_patellae_laterale", "lig_popliteum_obliquum", "lig_popliteum_arcuatum"]}, {"t": "Синовиальные сумки и складки", "text": "Капсула прикрепляется в ~1 см от суставных хрящей, синовиальная мембрана образует складки и сумки. <b>Наднадколенниковая</b> (bursa suprapatellaris) — самая крупная, сообщается с полостью; <b>глубокая поднадколенниковая</b>; <b>подкожная преднадколенниковая</b>. Под надколенником — <b>поднадколенниковое жировое тело</b> и синовиальная складка.", "h": ["bursa_suprapatellaris", "bursa_infrapatellaris_profunda", "bursa_subcutanea_prepatellaris", "corpus_adiposum_infrapatellare", "plica_synovialis_infrapatellaris"]}, {"t": "Движения", "text": "Вокруг <b>фронтальной</b> оси — сгибание и разгибание голени; вокруг <b>вертикальной</b> — вращение голени, но <b>только при согнутом колене</b>, когда коллатеральные связки расслаблены.", "h": []}, {"t": "Клиника и возраст", "text": "Разрыв менисков — профессиональная травма футболистов, лечится хирургически; часты разрывы передней крестообразной связки. У новорождённого капсула туго натянута, мениски — соединительнотканные пластинки, крестообразные связки короткие; окончательная форма — к <b>10–12 годам</b>.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_ankle": {"src": "с. 173–177", "steps": [{"t": "Что рассказать", "text": "Соединения костей голени (межберцовый сустав, перепонка, синдесмоз) и голеностопный сустав с его связками; плюс подтаранный сустав.", "h": []}, {"t": "Соединения костей голени", "text": "Вверху — <b>межберцовый сустав</b> (плоский, малоподвижный). По всей длине — <b>межкостная перепонка голени</b> (membrana interossea cruris). Внизу — <b>межберцовый синдесмоз</b>, укреплённый <b>передней и задней межберцовыми связками</b> (lig. tibiofibulare anterius / posterius).", "h": ["membrana_interossea_cruris", "lig_tibiofibulare_anterius", "lig_tibiofibulare_posterius"]}, {"t": "Голеностопный сустав", "text": "Articulatio talocruralis: нижние концы большеберцовой (tibia) и малоберцовой (fibula) костей, как «вилка», охватывают <b>блок таранной кости</b> (верхняя поверхность и лодыжковые поверхности). <b>Сложный, блоковидный</b>, одноосный.", "h": ["tibia", "fibula", "facies_superior_tali"]}, {"t": "Капсула", "text": "Прикрепляется по краю суставных хрящей, спереди немного переходит на шейку таранной кости. Спереди и сзади тонкая и свободная, по бокам укреплена мощными связками.", "h": []}, {"t": "Медиальная (дельтовидная) связка", "text": "От медиальной лодыжки веером, <b>4 части</b>: <b>большеберцово-ладьевидная</b> (pars tibionavicularis), <b>большеберцово-пяточная</b> (pars tibiocalcanea) — к опоре таранной кости, <b>передняя и задняя большеберцово-таранные</b> (pars tibiotalaris anterior / posterior).", "h": ["pars_tibionavicularis", "pars_tibiocalcanea", "pars_tibiotalaris_anterior", "pars_tibiotalaris_posterior", "sustentaculum_tali"]}, {"t": "Латеральная связка", "text": "От латеральной лодыжки, <b>3 отдельных связки</b>: <b>передняя таранно-малоберцовая</b> (lig. talofibulare anterius) — разрывается чаще всех при подворачивании стопы; <b>пяточно-малоберцовая</b> (lig. calcaneofibulare); <b>задняя таранно-малоберцовая</b> (lig. talofibulare posterius).", "h": ["lig_talofibulare_anterius", "lig_calcaneofibulare", "lig_talofibulare_posterius"]}, {"t": "Движения", "text": "Вокруг <b>фронтальной</b> оси — <b>тыльное сгибание</b> (разгибание) и <b>подошвенное сгибание</b> стопы. При подошвенном сгибании блок таранной кости узкой задней частью выходит из вилки — возможны небольшие колебания в стороны.", "h": []}, {"t": "Подтаранный сустав", "text": "Articulatio subtalaris — задняя часть таранной кости + пяточная кость. Цилиндрический. Связки: <b>межкостная таранно-пяточная</b> (lig. talocalcaneum interosseum, в пазухе предплюсны), <b>латеральная, медиальная, задняя таранно-пяточные</b>. Вместе с таранно-пяточно-ладьевидным суставом — супинация и пронация стопы.", "h": ["articulatio_subtalaris", "lig_talocalcaneum_interosseum", "lig_talocalcaneum_laterale", "lig_talocalcaneum_mediale", "lig_talocalcaneum_posterius"]}, {"t": "Возраст", "text": "У новорождённого капсулы тонкие, связки слабые; суставы формируются под влиянием стояния и ходьбы, параллельно окостенению костей стопы.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}, "j_foot": {"src": "с. 177–182", "steps": [{"t": "Что рассказать", "text": "Суставы стопы по порядку: суставы предплюсны (подтаранный, таранно-пяточно-ладьевидный, поперечный, клиноладьевидный) → предплюсне-плюсневые → межплюсневые → плюснефаланговые → межфаланговые; в конце — своды стопы.", "h": []}, {"t": "Поперечный сустав предплюсны (шопаров)", "text": "Articulatio tarsi transversa = <b>таранно-ладьевидный</b> (articulatio talonavicularis) + <b>пяточно-кубовидный</b> (articulatio calcaneocuboidea). Суставная щель S-образная. Используется для вычленения стопы при ампутации.", "h": ["articulatio_tarsi_transversa", "articulatio_talonavicularis", "articulatio_calcaneocuboidea"]}, {"t": "Ключ шопарова сустава", "text": "<b>Раздвоенная связка</b> (lig. bifurcatum) — от пяточной кости двумя пучками: <b>пяточно-ладьевидная</b> (lig. calcaneonaviculare) и <b>пяточно-кубовидная</b> (lig. calcaneocuboideum). Пока её не рассечь, сустав не раскрыть.", "h": ["lig_bifurcatum", "lig_calcaneonaviculare", "lig_calcaneocuboideum"]}, {"t": "Клиноладьевидный и соседние суставы", "text": "Ладьевидная кость (os naviculare) + три клиновидные. Плоский, малоподвижный. Кости связаны межкостными <b>межклиновидными</b> и <b>клинокубовидной</b> связками, тыльной кубовидно-ладьевидной связкой.", "h": ["articulatio_cuneonavicularis", "os_naviculare", "os_cuneiforme_mediale", "os_cuneiforme_intermedium", "os_cuneiforme_laterale", "lig_intercuneiforme_interosseum", "lig_cuneocuboideum_interosseum", "lig_cuboideonaviculare_dorsale"]}, {"t": "Предплюсне-плюсневые суставы (Лисфранка)", "text": "Articulationes tarsometatarsales: три клиновидные и кубовидная кости + основания I–V плюсневых. Плоские. <b>Ключ</b> — <b>медиальная межкостная клиноплюсневая связка</b> (от медиальной клиновидной ко II плюсневой).", "h": ["articulatio_tarsometatarsea", "lig_cuneometatarseum_interosseum", "os_cuboideum"]}, {"t": "Межплюсневые и плюснефаланговые", "text": "<b>Межплюсневые суставы</b> — между основаниями плюсневых, межкостные плюсневые связки. <b>Плюснефаланговые</b> — головки плюсневых + основания проксимальных фаланг, <b>шаровидные</b>: в основном разгибание и сгибание, немного отведение и приведение.", "h": ["articulationes_intermetatarsales", "ligg_metatarsalia_interossea", "articulatio_metatarsophalangea"]}, {"t": "Межфаланговые суставы стопы", "text": "<b>Блоковидные</b>: только сгибание и разгибание пальцев. Укреплены коллатеральными (ligg. collateralia) и подошвенными связками.", "h": ["articulationes_interphalangeae_pedis", "ligg_collateralia"]}, {"t": "Своды стопы", "text": "<b>Продольные</b> своды — по пяти плюсневым костям, начинаются от пяточной; <b>поперечный</b> — через кубовидную, клиновидные и основания плюсневых. Пассивно их держат связки (длинная подошвенная, подошвенная пяточно-ладьевидная, подошвенный апоневроз), активно — мышцы. Стопа бывает нормальной, сильно сводчатой и плоской.", "h": []}], "book": "Синельников, «Атлас анатомии человека», т. 1 · карточки Сапина «Синдесмология»"}});
let SCN = null;

function scnIsLimb(topicId) { const s = CONTENT.sections.find(x => x.topics.some(t => t.id === topicId)); return !!s && (s.id === 'upperlimb' || s.id === 'lowerlimb'); }
/* сценарии ответа по мышцам */
Object.assign(SCENARIOS, {"m_shoulder": {"src": "с. 222–225", "steps": [{"t": "Мышцы плечевого пояса и плеча", "text": "Мышцы плечевого пояса — <b>шесть</b>: дельтовидная, надостная, подостная, малая и большая круглые, подлопаточная. На плече спереди — сгибатели (<b>двуглавая, клювовидно-плечевая, плечевая</b>), сзади — разгибатели (<b>трёхглавая и локтевая</b>). Для каждой мышцы называем: начало → прикрепление → функцию → иннервацию.", "h": ["musculus_deltoideus", "musculus_biceps_brachii", "musculus_triceps_brachii"]}, {"t": "Дельтовидная мышца (musculus deltoideus)", "text": "<b>Начало:</b> латеральная треть ключицы, акромион, ость лопатки.<br><b>Прикрепление:</b> бугристость дельтовидная плечевой кости.<br><b>Функция:</b> передняя часть сгибает плечо, задняя разгибает, средняя (вся мышца) отводит руку до горизонтали.<br><b>Иннервация:</b> подмышечный нерв (n. axillaris) (CV–CVI).", "h": ["musculus_deltoideus", "acromion"]}, {"t": "Надостная мышца (musculus supraspinatus)", "text": "<b>Начало:</b> надостная ямка лопатки.<br><b>Прикрепление:</b> верхняя часть большого бугорка плечевой кости.<br><b>Функция:</b> отводит плечо (синергист дельтовидной), натягивает капсулу сустава.<br><b>Иннервация:</b> надлопаточный нерв (n. suprascapularis) (CV–CVI).", "h": ["musculus_supraspinatus"]}, {"t": "Подостная мышца (musculus infraspinatus)", "text": "<b>Начало:</b> подостная ямка лопатки.<br><b>Прикрепление:</b> большой бугорок плечевой кости.<br><b>Функция:</b> вращает плечо кнаружи.<br><b>Иннервация:</b> надлопаточный нерв (n. suprascapularis) (CV–CVI).", "h": ["musculus_infraspinatus"]}, {"t": "Малая круглая мышца (musculus teres minor)", "text": "<b>Начало:</b> латеральный край лопатки.<br><b>Прикрепление:</b> большой бугорок плечевой кости, ниже сухожилия подостной.<br><b>Функция:</b> вращает плечо кнаружи (как подостная).<br><b>Иннервация:</b> подмышечный нерв (n. axillaris) (CV–CVI).", "h": ["musculus_teres_minor"]}, {"t": "Большая круглая мышца (musculus teres major)", "text": "<b>Начало:</b> задняя поверхность нижнего угла лопатки.<br><b>Прикрепление:</b> гребень малого бугорка плечевой кости (вместе с широчайшей).<br><b>Функция:</b> тянет руку назад и вниз, приводит, вращает плечо внутрь.<br><b>Иннервация:</b> подлопаточный нерв (n. subscapularis) (CV–CVII).", "h": ["musculus_teres_major"]}, {"t": "Подлопаточная мышца (musculus subscapularis)", "text": "<b>Начало:</b> рёберная поверхность лопатки (вся).<br><b>Прикрепление:</b> малый бугорок плечевой кости.<br><b>Функция:</b> вращает плечо внутрь, натягивает капсулу сустава.<br><b>Иннервация:</b> подлопаточный нерв (n. subscapularis) (CV–CVII).", "h": ["musculus_subscapularis"]}, {"t": "Отверстия на задней поверхности", "text": "<b>Трёхстороннее</b> отверстие: сверху — подлопаточная, снизу — большая круглая, латерально — длинная головка трёхглавой. <b>Четырёхстороннее</b>: те же сверху, снизу и медиально, а латерально — хирургическая шейка плечевой кости.", "h": ["foramen_trilaterum", "foramen_quadrilaterum"]}, {"t": "Широчайшая мышца спины (musculus latissimus dorsi)", "text": "<b>Начало:</b> остистые отростки 4 (до 6) нижних грудных, всех поясничных и крестцовых позвонков, задняя часть гребня подвздошной кости, 4 нижних ребра.<br><b>Прикрепление:</b> гребень малого бугорка плечевой кости.<br><b>Функция:</b> разгибает и вращает плечо внутрь, приводит отведённую руку; при фиксированных руках подтягивает туловище.<br><b>Иннервация:</b> грудоспинной нерв (n. thoracodorsalis).", "h": ["musculus_latissimus_dorsi"]}, {"t": "Двуглавая мышца плеча (musculus biceps brachii)", "text": "<b>Начало:</b> длинная головка — надсуставной бугорок лопатки (сухожилие идёт через сустав в межбугорковой борозде); короткая — клювовидный отросток.<br><b>Прикрепление:</b> бугристость лучевой кости; апоневроз уходит в фасцию предплечья.<br><b>Функция:</b> сгибает плечо и предплечье, supинирует пронированное предплечье.<br><b>Иннервация:</b> мышечно-кожный нерв (n. musculocutaneus) (CV–CVII).", "h": ["musculus_biceps_brachii", "caput_longum_bicipitis", "caput_breve_bicipitis", "tendo_bicipitis", "aponeurosis_bicipitis", "fossa_cubitalis"]}, {"t": "Клювовидно-плечевая мышца (musculus coracobrachialis)", "text": "<b>Начало:</b> клювовидный отросток лопатки.<br><b>Прикрепление:</b> медиальная поверхность плечевой кости ниже гребня малого бугорка.<br><b>Функция:</b> сгибает и приводит плечо.<br><b>Иннервация:</b> мышечно-кожный нерв (n. musculocutaneus) (CV–CVII).", "h": ["musculus_coracobrachialis"]}, {"t": "Плечевая мышца (musculus brachialis)", "text": "<b>Начало:</b> передняя поверхность плечевой кости и обе межмышечные перегородки.<br><b>Прикрепление:</b> бугристость локтевой кости.<br><b>Функция:</b> только сгибает предплечье.<br><b>Иннервация:</b> мышечно-кожный нерв (n. musculocutaneus) (CV–CVII).", "h": ["musculus_brachialis"]}, {"t": "Трёхглавая мышца плеча (musculus triceps brachii)", "text": "<b>Начало:</b> длинная головка — подсуставной бугорок лопатки; латеральная — задняя поверхность плеча выше борозды лучевого нерва; медиальная — ниже борозды.<br><b>Прикрепление:</b> локтевой отросток (olecranon).<br><b>Функция:</b> разгибает предплечье; длинная головка разгибает и приводит плечо.<br><b>Иннервация:</b> лучевой нерв (n. radialis) (CV–CVIII).", "h": ["musculus_triceps_brachii", "caput_longum_tricipitis", "caput_laterale_tricipitis", "caput_mediale_tricipitis", "tendo_tricipitis", "olecranon"]}, {"t": "Локтевая мышца (musculus anconeus)", "text": "<b>Начало:</b> латеральный надмыщелок плечевой кости и лучевая коллатеральная связка.<br><b>Прикрепление:</b> задняя поверхность локтевой кости (проксимальная четверть).<br><b>Функция:</b> разгибает предплечье (как трёхглавая).<br><b>Иннервация:</b> лучевой нерв (n. radialis) (CVI–CVIII).", "h": ["musculus_anconeus"]}]}});
function scenarioOf(topicId) { return (typeof SCENARIOS !== 'undefined' && SCENARIOS[topicId]) || null; }

function scnStart(topicId, mode) {
  SCN = { topicId, mode, idx: 0, shown: mode === 'read', said: [], forgot: [], pick: null };
  goTo({ screen: 'scenario', topicId });
}

/* картинка шага: та карточка темы, где больше всего структур этого шага */
function scnImageFor(topic, ids) {
  if (!topic.images || !topic.images.length) return null;
  let best = topic.images[0], bestN = -1;
  topic.images.forEach(im => {
    const n = im.hotspots.filter(h => ids.includes(h.term)).length;
    if (n > bestN) { best = im; bestN = n; }
  });
  return best;
}

function renderScenarioIntro(topicId) {
  const topic = findTopic(topicId), sc = scenarioOf(topicId);
  let html = renderTopbar() + backRow(topic.title, { screen: 'hub', topicId });
  html += `<div class="hub-header"><h1>🗣️ Сценарий ответа</h1><div class="hub-latin">${topic.title} — ${isJointTopic(topicId) ? (topicId === 'j_general' ? 'общий план ответа о соединениях' : 'как рассказать соединение: кости → форма → капсула → связки → движения') : isMuscleTopic(topicId) ? 'как рассказать мышцу: начало → прикрепление → функция → иннервация' : 'как рассказать кость: ' + (scnIsLimb(topicId) ? 'от проксимального конца к дистальному' : 'название и положение, затем по частям')}, ${sc.steps.length} шагов</div></div>
    <div class="mode-grid">
      <div class="mode-card" onclick="scnStart('${topicId}','read')"><div class="mode-emoji">📖</div>
        <div class="mode-body"><div class="mode-title">Смотреть</div><div class="mode-desc">Листай шаги как конспект ответа — на карточке подсвечивается, о чём речь</div></div></div>
      <div class="mode-card" onclick="scnStart('${topicId}','tell')"><div class="mode-emoji">🗣️</div>
        <div class="mode-body"><div class="mode-title">Рассказать самому</div><div class="mode-desc">Видишь только шаг — расскажи, открой подсказку и отметь «сказал / забыл»</div></div></div>
    </div><div class="scn-src scn-src-intro">Источник: ${sc.book || SCENARIO_BOOK}, ${sc.src}</div>`;
  document.getElementById('app').innerHTML = html;
}

function renderScenario(topicId) {
  if (!SCN || SCN.topicId !== topicId) return renderScenarioIntro(topicId);
  const topic = findTopic(topicId), sc = scenarioOf(topicId), S = SCN;
  if (S.idx >= sc.steps.length) return renderScenarioResult(topic, sc);
  const st = sc.steps[S.idx], ids = st.h || [];
  const cards = scnCardsFor(topic, ids);
  const img = (S.card && cards.find(c => c.src === S.card)) || scnImageFor(topic, ids);
  let html = renderTopbar();
  html += `<div class="game-topbar">
      <button class="exit-x" onclick='SCN=null; APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'scenario', topicId }))})'>✕</button>
      <div class="game-progress-bar"><div class="game-progress-fill" style="width:${Math.round(S.idx / sc.steps.length * 100)}%"></div></div>
      <div class="base-counter">${S.idx + 1}/${sc.steps.length}</div></div><div class="game-body scn-body">`;
  /* кнопки шагов — наверху, над картинкой, чтобы не листать вниз через ответы */
  if (S.mode === 'tell' && !S.shown) {
    html += `<button class="btn btn-primary btn-block scn-btns-top" onclick="SCN.shown=true; render();">Показать подсказку</button>`;
  } else if (S.mode === 'tell') {
    html += `<div class="scn-btns scn-btns-top"><button class="btn btn-ghost" onclick="scnMark(false)">✕ Забыл</button><button class="btn btn-primary" onclick="scnMark(true)">✓ Сказал</button></div>`;
  } else {
    html += `<div class="scn-btns scn-btns-top"><button class="btn btn-ghost" onclick="scnGo(-1)" ${S.idx ? '' : 'disabled'}>← Шаг</button><button class="btn btn-primary" onclick="scnGo(1)">${S.idx + 1 >= sc.steps.length ? 'Готово ✓' : 'Шаг →'}</button></div>`;
  }
  if (cards.length > 1 && img) {
    const ci = cards.findIndex(c => c.src === img.src);
    html += `<div class="scn-cards"><button class="scn-cardarrow" onclick="scnCardStep(-1)" ${ci > 0 ? '' : 'disabled'}>‹</button>` +
      cards.map(c => `<button class="scn-cardbtn${c.src === img.src ? ' on' : ''}" onclick="scnCard('${c.src}')">${scnCardNo(c) ? 'карт. ' + scnCardNo(c) : cardShortLabel(c.label, c.src)}</button>`).join('') +
      `<button class="scn-cardarrow" onclick="scnCardStep(1)" ${ci < cards.length - 1 ? '' : 'disabled'}>›</button></div>`;
  }
  if (img) {
    const rings = ids.length ? img.hotspots.filter(h => ids.includes(h.term))
      .map(h => `<span class="scn-ring${S.pick ? (S.pick === h.term ? ' scn-ring-on' : ' scn-ring-dim') : ''}" style="left:${h.x}%;top:${h.y}%"></span>`).join('') : '';
    html += `<div class="pic-wrap scn-pic" onclick="openImageZoom('${img.src}')"><img src="${IMAGES[img.src]}" draggable="false">${rings}</div>`;
  }
  html += `<div class="scn-step"><div class="scn-num">Шаг ${S.idx + 1}</div><div class="scn-title">${st.t}</div>`;
  if (S.shown) html += `<div class="scn-text">${st.text}</div>`;
  html += `<div class="scn-src">Источник: ${sc.book || SCENARIO_BOOK}, ${sc.src}</div></div>`;
  if (S.shown) html += scnLegend(topic, img, ids);
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}
/* легенда шага — строки как в интерактивной карте */
function scnCardNo(im) { const m = /(\d+)\)?\s*$/.exec(im.label || ''); return m ? m[1] : ''; }
function scnLegend(topic, img, ids) {
  const rows = [];
  ids.forEach(id => {
    const term = topic.terms.find(t => t.id === id); if (!term) return;
    const h = img && img.hotspots.find(x => x.term === id);
    if (h) { rows.push({ term, n: h.n, ord: parseFloat(h.n) || 0, other: '' }); return; }
    const im2 = (topic.images || []).find(im => im.hotspots.some(x => x.term === id));
    const h2 = im2 && im2.hotspots.find(x => x.term === id);
    rows.push({ term, n: h2 ? h2.n : '', ord: 1e4, other: im2 ? (scnCardNo(im2) ? 'карт. ' + scnCardNo(im2) : 'др. карточка') : '' });
  });
  if (!rows.length) return '';
  rows.sort((a, b) => a.ord - b.ord);
  return `<div class="scn-legend">` + rows.map(r => `<div class="cm-info scn-row${SCN.pick === r.term.id ? ' scn-row-on' : ''}" onclick="scnPick('${r.term.id}', ${r.other ? 'false' : 'true'})">
      <span class="lg-num">${r.n || '•'}${r.other ? `<span class="tl-num-card">${r.other}</span>` : ''}</span>
      <div><b>${r.term.lat}</b>${r.term.translit ? ` <span class="base-tr">[${r.term.translit}]</span>` : ''}<div class="cm-info-ru">${r.term.ru}</div></div>
      ${favTermStar(topic.id, r.term.id, 'cm-info-star')}</div>`).join('') +
    `<div class="tl-hint" style="text-align:center">нажми на строку, чтобы найти цифру</div></div>`;
}
/* карточки, на которых есть структуры шага: больше всего цифр — первой */
function scnCardsFor(topic, ids) {
  const n = im => im.hotspots.filter(h => ids.includes(h.term)).length;
  return (topic.images || []).filter(im => n(im) > 0).sort((x, y) => n(y) - n(x));
}
function scnCard(src) { SCN.card = src; SCN.pick = null; render(); }
function scnCardStep(d) {
  const topic = findTopic(SCN.topicId), st = scenarioOf(SCN.topicId).steps[SCN.idx], cards = scnCardsFor(topic, st.h || []);
  const cur = (SCN.card && cards.findIndex(c => c.src === SCN.card)); const i = cur >= 0 && SCN.card ? cur : 0;
  const nx = cards[Math.max(0, Math.min(cards.length - 1, i + d))]; if (nx) scnCard(nx.src);
}
function scnPick(id, here) {
  if (!here) { const topic = findTopic(SCN.topicId), im = (topic.images || []).find(x => x.hotspots.some(h => h.term === id)); if (!im) return; SCN.card = im.src; SCN.pick = id; render(); return; }
  SCN.pick = SCN.pick === id ? null : id; render();
}
function scnGo(d) { SCN.card = null; SCN.pick = null; SCN.idx = Math.max(0, SCN.idx + d); render(); window.scrollTo(0, 0); }
function scnMark(ok) {
  const sc = scenarioOf(SCN.topicId);
  (ok ? SCN.said : SCN.forgot).push(SCN.idx);
  SCN.idx++; SCN.shown = false; SCN.pick = null; SCN.card = null; render(); window.scrollTo(0, 0);
  if (SCN.idx >= sc.steps.length && !SCN.xp) { SCN.xp = 1; addXp(SCN.said.length * 2); }
}
function renderScenarioResult(topic, sc) {
  const S = SCN;
  let html = renderTopbar() + `<div class="game-body">`;
  if (S.mode === 'tell') {
    const n = sc.steps.length, pct = Math.round(S.said.length / n * 100);
    html += `<div class="rc-score">${pct === 100 ? '🎉 ' : ''}Рассказал ${S.said.length} из ${n} шагов — ${pct}%</div>`;
    if (S.forgot.length) {
      html += `<div class="rc-head">Повтори</div>`;
      S.forgot.forEach(i => { html += `<div class="rc-row miss"><b>${sc.steps[i].t}</b><br>${sc.steps[i].text}</div>`; });
    }
  } else {
    html += `<div class="rc-score">Сценарий «${topic.title}» пройден ✓</div><div class="rc-note" style="text-align:center">Попробуй теперь рассказать сам — без подсказок.</div>`;
  }
  html += `<div style="display:flex; gap:10px; margin-top:16px">
    <button class="btn btn-primary" style="flex:1" onclick="scnStart('${topic.id}','tell')">Рассказать самому</button>
    <button class="btn btn-ghost" style="flex:1" onclick='SCN=null; APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'hub', topicId: topic.id }))})'>${isJointTopic(topic.id) ? 'К теме' : 'К кости'}</button></div>
    <div class="scn-src">Источник: ${sc.book || SCENARIO_BOOK}, ${sc.src}</div></div>`;
  document.getElementById('app').innerHTML = html;
}

/* Вопросы теста по черепу — строго по документу кафедры: r = ровно те ответы, что отмечены в тесте.
   w — неверные варианты для «Укажите…» (и отсев похожих слов в письменных).
   Структуры, которые есть у кости по учебнику, но в ответах теста не отмечены, — только в ex/note, не в r и не в w. */
const STEST = [
  { q: 'Перечислите отростки, которые имеет верхняя челюсть', r: [
      ['нёбный отросток', 'processus palatinus'], ['скуловой отросток', 'processus zygomaticus'],
      ['альвеолярный отросток', 'processus alveolaris'], ['лобный отросток', 'processus frontalis']],
    w: ['крыловидный отросток', 'венечный отросток', 'глазничный отросток'],
    ex: 'Тело и 4 отростка: лобный, скуловой, нёбный, альвеолярный. Глазничный отросток — у нёбной кости, венечный — у нижней челюсти.' },

  { q: 'Укажите, в образовании стенок каких полостей висцерального черепа принимает участие лобная кость', r: [
      ['полость носа', 'cavitas nasi'], ['глазница', 'orbita'], ['височная ямка', 'fossa temporalis']],
    w: ['крыловидно-нёбная ямка', 'подвисочная ямка', 'полость рта'],
    ex: 'Носовая часть — верхняя стенка полости носа, глазничная часть — крыша глазницы, височная поверхность чешуи — в височной ямке.',
    note: 'В тесте этот вопрос есть в двух вариантах: здесь височная ямка в ответах отмечена, во втором варианте — нет.' },

  { q: 'Перечислите части подъязычной кости', r: [
      ['тело', 'corpus'], ['большие рога', 'cornua majora', ['большой рог']], ['малые рога', 'cornua minora', ['малый рог']]],
    w: ['ветви', 'шейка', 'головка'],
    ex: 'Тело, большие и малые рога (Привес, с. 123).' },

  { q: 'Укажите, отверстия каких придаточных пазух открываются в верхний носовой ход', r: [
      ['апертура клиновидной пазухи', 'apertura sinus sphenoidalis'], ['задние ячейки решётчатой кости', 'cellulae ethmoidales posteriores'],
      ['клиновидно-нёбное отверстие', 'foramen sphenopalatinum']],
    w: ['верхнечелюстная пазуха', 'носослёзный канал', 'лобная пазуха'],
    ex: 'Верхний ход сообщается с клиновидной пазухой и клиновидно-нёбным отверстием, туда же открываются задние решётчатые ячейки (Привес, с. 129).' },

  { q: 'Назовите ямки, в которые можно попасть через нижнюю глазничную щель из глазницы', r: [
      ['подвисочная ямка', 'fossa infratemporalis'], ['крыловидно-нёбная ямка', 'fossa pterygopalatina']],
    w: ['средняя черепная ямка', 'височная ямка', 'передняя черепная ямка'],
    ex: 'Сзади щель ведёт в крыловидно-нёбную ямку, спереди — в подвисочную. В среднюю черепную ямку ведёт верхняя глазничная щель.' },

  { q: 'Перечислите кости, образующие верхнюю стенку полости носа', r: [
      ['носовые кости', 'ossa nasalia', ['носовая кость']], ['носовая часть лобной кости', 'pars nasalis ossis frontalis', ['лобная кость']],
      ['решётчатая пластинка решётчатой кости', 'lamina cribrosa', ['решётчатая пластинка', 'решётчатая кость']]],
    w: ['сошник', 'нёбная кость', 'горизонтальная пластинка нёбной кости'],
    ex: 'Носовые кости, носовая часть лобной кости и решётчатая пластинка.',
    note: 'По Привесу в верхнюю стенку входит ещё и клиновидная кость — в ответах теста её нет.' },

  { q: 'Перечислите анатомические образования, которые имеются на решётчатой кости', r: [
      ['слепое отверстие', 'foramen caecum'], ['петушиный гребень', 'crista galli'], ['средняя носовая раковина', 'concha nasalis media']],
    w: ['нижняя носовая раковина', 'носовая ость', 'сошник'],
    ex: 'На решётчатой кости есть также верхняя носовая раковина, решётчатая пластинка и крючковидный отросток — в этом вопросе теста они не отмечены.',
    note: 'По Привесу и Синельникову слепое отверстие (foramen caecum) относится к лобной кости — лежит впереди петушиного гребня. Но в ответах теста оно отмечено здесь.' },

  { q: 'Укажите, какие кости участвуют в образовании передней черепной ямки', r: [
      ['клиновидная кость', 'os sphenoidale'], ['лобная кость', 'os frontale'], ['решётчатая кость', 'os ethmoidale']],
    w: ['височная кость', 'теменная кость', 'затылочная кость'],
    ex: 'Глазничные части лобной кости, решётчатая пластинка, малые крылья клиновидной кости.' },

  { q: 'Назовите отверстия, которые открываются в средний носовой ход', r: [
      ['полулунная расщелина', 'hiatus semilunaris', ['полулунная щель']], ['передние ячейки решётчатой кости', 'cellulae ethmoidales anteriores'],
      ['средние ячейки решётчатой кости', 'cellulae ethmoidales mediae']],
    w: ['носослёзный канал', 'апертура клиновидной пазухи', 'задние ячейки решётчатой кости'],
    ex: 'Через полулунную расщелину в средний ход открываются также верхнечелюстная и лобная пазухи — в ответах теста они не отмечены. Носослёзный канал открывается в нижний ход.' },

  { q: 'Укажите анатомические образования, в которые открывается апертура лобной пазухи', r: [['средний носовой ход', 'meatus nasi medius']],
    w: ['верхний носовой ход', 'нижний носовой ход', 'общий носовой ход'],
    ex: 'Через решётчатую воронку — в средний носовой ход.' },

  { q: 'Перечислите носовые раковины, которые являются отростками решётчатой кости', r: [
      ['наивысшая носовая раковина', 'concha nasalis suprema'], ['верхняя носовая раковина', 'concha nasalis superior'],
      ['средняя носовая раковина', 'concha nasalis media']],
    w: ['нижняя носовая раковина', 'клиновидная раковина'],
    ex: 'Нижняя носовая раковина — самостоятельная кость лица.' },

  { q: 'Укажите, какие анатомические образования располагаются на ветви нижней челюсти', r: [
      ['венечный отросток', 'processus coronoideus'], ['мыщелковый отросток', 'processus condylaris'],
      ['язычок нижней челюсти', 'lingula mandibulae'], ['нижнечелюстное отверстие', 'foramen mandibulae', ['отверстие нижней челюсти']]],
    w: ['подбородочное отверстие', 'двубрюшная ямка', 'челюстно-подъязычная линия'],
    ex: 'Подбородочное отверстие, двубрюшная ямка и челюстно-подъязычная линия — на теле нижней челюсти.' },

  { q: 'Назовите отверстия, через которые можно попасть из крыловидно-нёбной ямки в полость носа', r: [['клиновидно-нёбное отверстие', 'foramen sphenopalatinum']],
    w: ['круглое отверстие', 'большой нёбный канал', 'крыловидный канал'],
    ex: 'Круглое — в среднюю черепную ямку, большой нёбный канал — в полость рта, крыловидный — на основание черепа.' },

  { q: 'Укажите кости, которые участвуют в образовании костной перегородки носа', r: [
      ['сошник', 'vomer'], ['решётчатая кость', 'os ethmoidale'], ['верхняя челюсть', 'maxilla']],
    w: ['нижняя носовая раковина', 'слёзная кость', 'скуловая кость'],
    ex: 'Перпендикулярная пластинка решётчатой кости и сошник, внизу — носовой гребень верхней челюсти.',
    note: 'Этот вопрос в тесте есть и во втором варианте — «Перечислите кости, образующие костную перегородку носа»; там в ответах отмечена ещё и нёбная кость.' },

  { q: 'Назовите отверстия глазницы', r: [
      ['заднее решётчатое отверстие', 'foramen ethmoidale posterius'], ['зрительный канал', 'canalis opticus'],
      ['носослёзный канал', 'canalis nasolacrimalis', ['носо-слёзный канал']], ['верхняя глазничная щель', 'fissura orbitalis superior'],
      ['переднее решётчатое отверстие', 'foramen ethmoidale anterius']],
    w: ['нижняя глазничная щель', 'круглое отверстие', 'овальное отверстие', 'клиновидно-нёбное отверстие'],
    ex: 'Круглое и овальное отверстия — в средней черепной ямке, клиновидно-нёбное — в крыловидно-нёбной ямке.',
    note: 'Нижняя глазничная щель — тоже отверстие глазницы, но в ответах теста она не отмечена.' },

  { q: 'Укажите поверхности, которые имеются на теле клиновидной кости', r: [
      ['верхняя поверхность', 'facies superior', ['верхняя']], ['задняя поверхность', 'facies posterior', ['задняя']],
      ['передняя поверхность', 'facies anterior', ['передняя']], ['боковая поверхность', 'facies lateralis', ['боковая']],
      ['нижняя поверхность', 'facies inferior', ['нижняя']]],
    w: ['глазничная поверхность', 'височная поверхность', 'мозговая поверхность'],
    ex: 'Глазничная, височная и мозговая — поверхности большого крыла, а не тела.' },

  { q: 'Укажите входное и выходное отверстия лицевого канала', r: [
      ['стенка внутреннего слухового прохода', 'meatus acusticus internus', ['внутренний слуховой проход']],
      ['шилососцевидное отверстие', 'foramen stylomastoideum', ['шило-сосцевидное отверстие']]],
    w: ['наружный слуховой проход', 'сосцевидное отверстие', 'сонный канал'],
    ex: 'Канал начинается на дне внутреннего слухового прохода и заканчивается шилососцевидным отверстием (Привес, с. 112).' },

  { q: 'Назовите кости, которые участвуют в образовании задней черепной ямки', r: [
      ['клиновидная кость', 'os sphenoidale'], ['височная кость', 'os temporale'],
      ['затылочная кость', 'os occipitale'], ['теменная кость', 'os parietale']],
    w: ['лобная кость', 'решётчатая кость'],
    ex: 'Затылочная кость, задняя часть тела клиновидной, пирамиды височных костей и нижнезадние углы теменных (Привес, с. 127).' },

  { q: 'Укажите, какие кости ограничивают яремное отверстие', r: [['затылочная кость', 'os occipitale'], ['височная кость', 'os temporale']],
    w: ['клиновидная кость', 'теменная кость'],
    ex: 'Яремные вырезки затылочной и височной костей.' },

  { q: 'Укажите кости, образующие латеральную стенку глазницы', r: [['клиновидная кость', 'os sphenoidale'], ['скуловая кость', 'os zygomaticum']],
    w: ['решётчатая кость', 'слёзная кость', 'верхняя челюсть'],
    ex: 'Глазничные поверхности скуловой кости и большого крыла клиновидной.' },

  { q: 'Перечислите части затылочной кости', r: [
      ['базилярная часть', 'pars basilaris'], ['латеральная часть', 'pars lateralis', ['латеральные части', 'боковые части']],
      ['затылочная чешуя', 'squama occipitalis', ['чешуя затылочной кости']]],
    w: ['каменистая часть', 'барабанная часть', 'носовая часть'],
    ex: 'Четыре части вокруг большого отверстия: базилярная, две латеральные и чешуя.' },

  { q: 'Укажите анатомические образования, расположенные на теле нижней челюсти', r: [
      ['косая линия', 'linea obliqua'], ['двубрюшная ямка', 'fossa digastrica'], ['челюстно-подъязычная линия', 'linea mylohyoidea']],
    w: ['язычок нижней челюсти', 'крыловидная ямка', 'венечный отросток'],
    ex: 'На теле есть также подбородочное отверстие и подбородочный выступ — в ответах теста они не отмечены. Язычок, венечный отросток и крыловидная ямка — на ветви.' },

  { q: 'Укажите отверстия, которые открываются в подвисочную ямку', r: [
      ['крыловидно-верхнечелюстная щель', 'fissura pterygomaxillaris'], ['нижняя глазничная щель', 'fissura orbitalis inferior']],
    w: ['круглое отверстие', 'верхняя глазничная щель', 'клиновидно-нёбное отверстие'],
    ex: 'Через нижнюю глазничную щель ямка сообщается с глазницей, через крыловидно-верхнечелюстную — с крыловидно-нёбной. На её крыше лежат ещё овальное и остистое отверстия, но в ответах теста они не отмечены.' },

  { q: 'Укажите, какие кости участвуют в образовании латеральной стенки полости носа', r: [
      ['слёзная кость', 'os lacrimale'], ['решётчатая кость', 'os ethmoidale'], ['клиновидная кость', 'os sphenoidale'],
      ['верхняя челюсть', 'maxilla'], ['нижняя носовая раковина', 'concha nasalis inferior']],
    w: ['сошник', 'скуловая кость', 'теменная кость'],
    ex: 'Сошник участвует в перегородке носа, а не в латеральной стенке.',
    note: 'По Привесу латеральную стенку образуют ещё носовая и нёбная кости — в ответах теста их нет.' },

  { q: 'Назовите кости, которые образуют крыловидно-нёбную ямку', r: [
      ['нёбная кость', 'os palatinum'], ['клиновидная кость', 'os sphenoidale'], ['верхняя челюсть', 'maxilla']],
    w: ['скуловая кость', 'височная кость', 'решётчатая кость'],
    ex: 'Спереди бугор верхней челюсти, сзади крыловидный отросток, медиально перпендикулярная пластинка нёбной кости.' },

  { q: 'Назовите анатомические образования, которые формируют свод черепа', r: [
      ['чешуя височной кости', 'pars squamosa ossis temporalis', ['чешуйчатая часть височной кости', 'височная чешуя']],
      ['чешуя затылочной кости', 'squama occipitalis', ['затылочная чешуя']],
      ['чешуя лобной кости', 'squama frontalis', ['лобная чешуя']],
      ['теменные кости', 'ossa parietalia', ['теменная кость']]],
    w: ['пирамида височной кости', 'базилярная часть затылочной кости', 'большие крылья клиновидной кости'],
    ex: 'Свод — теменные кости и чешуи лобной, затылочной и височных костей.' },

  { q: 'Укажите анатомические образования, расположенные на латеральной части затылочной кости', r: [
      ['подъязычный канал', 'canalis hypoglossalis'], ['яремный отросток', 'processus jugularis'],
      ['затылочный мыщелок', 'condylus occipitalis'], ['борозда сигмовидного синуса', 'sulcus sinus sigmoidei']],
    w: ['глоточный бугорок', 'скат', 'наружный затылочный выступ'],
    ex: 'Глоточный бугорок и скат — на базилярной части, наружный затылочный выступ — на чешуе.' },

  { q: 'Перечислите отростки височной кости', r: [
      ['шиловидный', 'processus styloideus', ['шиловидный отросток']], ['сосцевидный', 'processus mastoideus', ['сосцевидный отросток']],
      ['скуловой', 'processus zygomaticus', ['скуловой отросток']]],
    w: ['крыловидный', 'венечный', 'яремный'],
    ex: 'Крыловидный — у клиновидной кости, венечный — у нижней челюсти, яремный — у затылочной.' },

  { q: 'Укажите кости, которые участвуют в образовании средней черепной ямки', r: [['клиновидная кость', 'os sphenoidale'], ['височная кость', 'os temporale']],
    w: ['лобная кость', 'решётчатая кость', 'затылочная кость'],
    ex: 'Тело и большие крылья клиновидной кости, чешуя и передняя поверхность пирамид височных костей.' },

  { q: 'Перечислите анатомические образования, которые расположены на передней поверхности пирамиды височной кости', r: [
      ['дугообразное возвышение', 'eminentia arcuata'],
      ['борозда большого каменистого нерва', 'sulcus nervi petrosi majoris', ['расщелина канала большого каменистого нерва']]],
    w: ['внутреннее слуховое отверстие', 'яремная ямка', 'шилососцевидное отверстие'],
    ex: 'На передней поверхности есть также тройничное вдавление и крыша барабанной полости — в ответах теста они не отмечены. Внутреннее слуховое отверстие — на задней поверхности, яремная ямка и шилососцевидное отверстие — на нижней.' },

  { q: 'Укажите, какие анатомические образования имеются на нижней поверхности пирамиды височной кости', r: [
      ['сонное отверстие', 'apertura externa canalis carotici', ['наружное отверстие сонного канала']],
      ['яремная ямка', 'fossa jugularis'], ['шилососцевидное отверстие', 'foramen stylomastoideum']],
    w: ['дугообразное возвышение', 'внутреннее слуховое отверстие', 'тройничное вдавление'],
    ex: 'Дугообразное возвышение и тройничное вдавление — на передней поверхности, внутреннее слуховое отверстие — на задней.' },

  { q: 'Укажите кости, образующие мозговой череп', r: [
      ['лобная', 'os frontale'], ['клиновидная', 'os sphenoidale'], ['решётчатая', 'os ethmoidale'],
      ['затылочная', 'os occipitale'], ['теменная', 'os parietale']],
    w: ['нёбная', 'скуловая', 'слёзная'],
    ex: 'Мозговой череп: лобная, две теменные, затылочная, клиновидная, решётчатая и две височные кости.',
    note: 'В ответах теста височной кости нет, хотя она относится к мозговому черепу. Если на зачёте она будет среди вариантов — отмечай её.' },

  { q: 'Укажите, в образовании стенок каких полостей висцерального черепа принимает участие лобная кость:', r: [
      ['полость носа', 'cavitas nasi'], ['глазница', 'orbita']],
    w: ['подвисочная ямка', 'крыловидно-нёбная ямка', 'полость рта'],
    ex: 'Носовая часть — верхняя стенка полости носа, глазничная часть — крыша глазницы.',
    note: 'Второй вариант этого вопроса в тесте: здесь в ответах только полость носа и глазница, в первом варианте отмечена ещё височная ямка.' },

  { q: 'Укажите, с какими полостями сообщается крыловидно-нёбная ямка посредством круглого отверстия', r: [['средняя черепная ямка', 'fossa cranii media']],
    w: ['полость носа', 'глазница', 'полость рта'],
    ex: 'Через круглое отверстие проходит II ветвь тройничного нерва из средней черепной ямки.' },

  { q: 'Перечислите кости, образующие костную перегородку носа', r: [
      ['нёбная кость', 'os palatinum'], ['сошник', 'vomer'], ['решётчатая кость', 'os ethmoidale'], ['верхняя челюсть', 'maxilla']],
    w: ['нижняя носовая раковина', 'слёзная кость', 'скуловая кость'],
    ex: 'Перпендикулярная пластинка решётчатой кости и сошник; внизу — носовые гребни верхней челюсти и нёбной кости (Привес, с. 128).',
    note: 'Второй вариант этого вопроса в тесте — «Укажите кости, которые участвуют…»; там в ответах нёбной кости нет.' },

  { q: 'Укажите поверхности пирамиды височной кости', r: [
      ['передняя поверхность', 'facies anterior', ['передняя']], ['задняя поверхность', 'facies posterior', ['задняя']],
      ['нижняя поверхность', 'facies inferior', ['нижняя']]],
    w: ['верхняя поверхность', 'латеральная поверхность', 'медиальная поверхность'],
    ex: 'Три поверхности — передняя, задняя и нижняя — и три края.' },

  { q: 'Укажите кости лицевого черепа', r: [
      ['носовая', 'os nasale'], ['слёзная', 'os lacrimale'], ['нёбная', 'os palatinum']],
    w: ['решётчатая', 'клиновидная', 'височная'],
    ex: 'Решётчатая, клиновидная и височная кости относятся к мозговому черепу.',
    note: 'В ответах теста отмечены только три кости. К лицевому черепу относятся также верхняя и нижняя челюсти, скуловая кость, сошник, нижняя носовая раковина и подъязычная кость.' },

  { q: 'Укажите каналы височной кости', r: [
      ['лицевой канал', 'canalis facialis'], ['мышечно-трубный канал', 'canalis musculotubarius'], ['сонный канал', 'canalis caroticus']],
    w: ['крыловидный канал', 'подъязычный канал', 'зрительный канал'],
    ex: 'Крыловидный и зрительный каналы — в клиновидной кости, подъязычный — в затылочной.' },

  { q: 'Укажите отверстия средней черепной ямки', r: [
      ['круглое отверстие', 'foramen rotundum'], ['овальное отверстие', 'foramen ovale'], ['рваное отверстие', 'foramen lacerum']],
    w: ['яремное отверстие', 'подъязычный канал', 'внутреннее слуховое отверстие'],
    ex: 'Яремное отверстие, подъязычный канал и внутреннее слуховое отверстие — в задней черепной ямке.',
    note: 'В ответах теста не отмечены остистое отверстие, зрительный канал и верхняя глазничная щель, хотя они тоже относятся к средней черепной ямке.' },
];

/* ===================== ТЕСТ ПО ЧЕРЕПУ ===================== */
/* Единый тест: «Укажите…» — выбрать все верные варианты, «Перечислите…» и «Назовите…» — вписать самому.
   Режимы: все 39 вопросов, короткий на 10 (как на опросе), повтор ошибок, флеш-карточки со всеми ответами. */
const STEST_KEY = 'anatoQuestSTest_v3';
const STEST_SHORT_N = 10, STEST_SHORT_PICK = 6;   /* как на опросе: 10 вопросов, из них 6 с вариантами */
const STEST_FAIL_N = 3;   /* на опросе ошибка — минус балл, 3 ошибки — не сдано */
const STEST_SECTIONS = ['skull', 'face', 'skullwhole'];   /* карта ищется только по костям черепа */
/* общие названия частей — у многих костей одинаковые */
const STEST_GENERIC = /^(facies|margo|angulus|pars|corpus|caput|collum|basis|apex|crista|spina|processus|incisura|tuberculum) (superior|inferior|anterior|posterior|lateralis|lateralе|medialis|externa|interna|major|minor|superius|inferius|anterius|posterius|majus|minus)$/
let ST = null, STC = null;
function stestKind(q) { return /^Укажите/.test(q.q) ? 'pick' : 'write'; }
function stestStore() { try { return JSON.parse(localStorage.getItem(STEST_KEY) || '{}'); } catch (e) { return {}; } }
function stestProf() { return (getActiveProfile() || '') + '::'; }
function stestRecord(i, ok) {
  try { const a = stestStore(); a[stestProf() + i] = ok ? 1 : 0; localStorage.setItem(STEST_KEY, JSON.stringify(a)); } catch (e) {}
}
function stestWeak() { const a = stestStore(), p = stestProf(); return STEST.map((q, i) => i).filter(i => a[p + i] === 0); }
function stestItems(q) { return q.r.map(x => ({ ru: [x[0]].concat(x[2] || []), lat: [x[1]] })); }
function stestIdx(k) { return STEST.map((q, i) => i).filter(i => stestKind(STEST[i]) === k); }
function stestCount(k) { return stestIdx(k).length; }

/* ---------- связь ответов с интерактивной картой ---------- */
let STEST_TERMIDX = null;
function stNorm(s) { return (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function stestTermIndex() {
  if (STEST_TERMIDX) return STEST_TERMIDX;
  const idx = {};
  const put = (key, v) => { const k = stNorm(key); if (!k) return; (idx[k] = idx[k] || []).push(v); };
  CONTENT.sections.filter(sec => STEST_SECTIONS.includes(sec.id)).forEach(sec => sec.topics.forEach(t => {
    const cards = topicCards(t);
    t.terms.forEach(term => {
      let hit = null;
      for (const c of cards) { const h = c.hotspots.find(x => x.term === term.id); if (h) { hit = { src: c.src, n: h.n }; break; } }
      if (!hit) return;
      const v = { topicId: t.id, src: hit.src, n: hit.n };
      put(term.lat, v); put(term.ru, v);
    });
  }));
  STEST_TERMIDX = idx; return idx;
}
/* если ответ — целая кость или область («лобная кость», «полость носа»), ведём на её карточку целиком */
let STEST_TOPICIDX = null;
function stestTopicIndex() {
  if (STEST_TOPICIDX) return STEST_TOPICIDX;
  const idx = {}, cut = s => stNorm(s).replace(/\s*(кость|кости|парная)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  CONTENT.sections.filter(sec => STEST_SECTIONS.includes(sec.id)).forEach(sec => sec.topics.forEach(t => {
    const cards = topicCards(t); if (!cards.length) return;
    const v = { topicId: t.id, src: cards[0].src, n: null };
    [t.title, t.latin].forEach(name => (name || '').split(',').forEach(part => {
      const k = cut(part); if (k && !idx[k]) idx[k] = v;
    }));
  }));
  STEST_TOPICIDX = idx; return idx;
}
/* для каждого ответа — где он есть на карточке; кость выбираем ту, где нашлось больше ответов вопроса */
function stestLinks(q) {
  if (q._links) return q._links;
  const idx = stestTermIndex();
  const cand = q.r.map(x => {
    for (const key of [x[1], x[0]].concat(x[2] || [])) { const a = idx[stNorm(key)]; if (a && a.length) return a; }
    return null;
  });
  const cnt = {};
  cand.forEach(a => { if (a) new Set(a.map(v => v.topicId)).forEach(t => cnt[t] = (cnt[t] || 0) + 1); });
  let best = null, bn = 0;
  Object.keys(cnt).forEach(t => { if (cnt[t] > bn) { bn = cnt[t]; best = t; } });
  const tidx = stestTopicIndex(), cut = s => stNorm(s).replace(/\s*(кость|кости)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  q._links = cand.map((a, k) => {
    const x = q.r[k], generic = STEST_GENERIC.test(stNorm(x[1]));
    /* ответ — целая кость: ведём на её же карточку, а не на её подпись на чужой */
    let own = null;
    for (const key of [x[0], x[1]].concat(x[2] || [])) { const t = tidx[cut(key)]; if (t) { own = t; break; } }
    if (own) return (a && a.find(v => v.topicId === own.topicId)) || own;
    if (a) {
      /* «facies anterior» и подобные есть у многих костей: ведём на карту, только если на эту же
         кость указывают ещё минимум два ответа вопроса — иначе попадём не туда */
      const inBest = a.find(v => v.topicId === best);
      if (inBest && (!generic || bn >= 2)) return inBest;
      if (!generic && new Set(a.map(v => v.topicId)).size === 1) return a[0];
    }
    return null;
  });
  return q._links;
}
function stestAnsList(q, s) {
  const links = stestLinks(q), fromCards = VIEW.screen === 'stestCards';
  return `<div class="st-ans-list">` + q.r.map((x, k) => {
    const named = s && s.k === 'write' && s.found.includes(k), L = links[k];
    const v = L && { screen: 'cardmap', topicId: L.topicId, src: L.src, sel: L.n,
      back: { screen: fromCards ? 'stestCards' : 'stest' }, backLabel: fromCards ? 'Назад к карточкам' : 'Назад к тесту' };
    if (v && L.n === null) delete v.sel;
    return `<div class="st-ans ${named ? 'st-ans-ok' : ''}"><div class="st-ans-t">${named ? '✓ ' : ''}<b>${x[0]}</b> <i>${x[1]}</i></div>`
      + (v ? `<button class="st-map" title="${L.n === null ? 'Открыть карточку целиком' : 'Показать на интерактивной карте'}" onclick='event.stopPropagation(); APP.goToJSON(${JSON.stringify(JSON.stringify(v))})'>🗺️</button>` : '')
      + `</div>`;
  }).join('') + `</div>`;
}

function renderSTestSetup() {
  const weak = stestWeak();
  let html = renderTopbar() + backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>🧪 Тест по черепу</h1>
    <div class="hub-latin">${STEST.length} вопросов из теста кафедры, вперемешку — как на зачёте.</div></div>
    <div class="game-body">
      <div class="st-legend"><div><b>«Укажите…»</b> — ☑️ выбери все верные варианты (${stestCount('pick')})</div>
      <div><b>«Перечислите…», «Назовите…»</b> — ✍️ напиши сам: по-русски, на латыни или латынью кириллицей (${stestCount('write')})</div>
      <div class="st-legend-note">В письменных вопросах ответ засчитывается, если названа хотя бы <b>одна</b> структура — остальные можно дописать для себя.</div></div>
    </div>
    <div class="mode-grid">
      <div class="mode-card" onclick="stestStart('short')"><div class="mode-emoji">⏱️</div>
        <div class="mode-body"><div class="mode-title">Как на опросе · ${STEST_SHORT_N} вопросов</div>
        <div class="mode-desc">Случайные ${STEST_SHORT_N}: ${STEST_SHORT_PICK} с вариантами и ${STEST_SHORT_N - STEST_SHORT_PICK} письменных · ${STEST_FAIL_N} ошибки — не сдано</div></div></div>
      <div class="mode-card" onclick="stestStart('all')"><div class="mode-emoji">🧪</div>
        <div class="mode-body"><div class="mode-title">Полный тест</div><div class="mode-desc">Все ${STEST.length} вопросов в случайном порядке</div></div></div>
      <div class="mode-card" onclick="stestCardsStart(false)"><div class="mode-emoji">🃏</div>
        <div class="mode-body"><div class="mode-title">Все ответы — флеш-карточки</div>
        <div class="mode-desc">Спереди вопрос, сзади ответы с латынью — листай и проверяй себя</div></div></div>
      ${weak.length ? `<div class="mode-card" onclick="stestStart('weak')"><div class="mode-emoji">🎯</div>
        <div class="mode-body"><div class="mode-title">Повторить ошибки</div><div class="mode-desc">${weak.length} вопрос(ов), где ответ был неполным или с лишним — в том же формате</div></div></div>` : ''}
      ${tfavCard('skull', "stestStart('fav')")}
      ${thCard('skull')}
    </div>
    <div class="rc-note" style="padding:0 20px 20px">Верными считаются ровно те ответы, что отмечены в тесте кафедры. Где они расходятся с Привесом или Синельниковым, после ответа будет пометка ⚠️.</div>`;
  document.getElementById('app').innerHTML = html;
}

function stestStart(kind, one) {
  let idx;
  if (kind === 'one') idx = [one];
  else if (kind === 'weak') idx = stestWeak();
  else if (kind === 'fav') idx = tfavList('skull').slice();
  else if (kind === 'short') idx = thOrder('skull', stestIdx('pick')).slice(0, STEST_SHORT_PICK)
    .concat(thOrder('skull', stestIdx('write')).slice(0, STEST_SHORT_N - STEST_SHORT_PICK));
  else idx = STEST.map((q, i) => i);
  if (!idx.length) return;
  const qs = thOrder('skull', idx).map(i => {
    const q = STEST[i], k = stestKind(q);
    let opts = null;
    if (k === 'pick') {
      const right = shuffleArr(q.r.map(x => x[0])).slice(0, 5), wrong = shuffleArr(q.w).slice(0, Math.min(3, Math.max(2, 7 - right.length)));
      opts = shuffleArr(right.map(t => ({ t, ok: true })).concat(wrong.map(t => ({ t, ok: false }))));
    }
    return { i, k, opts, sel: new Set(), done: false, found: [], msg: '' };
  });
  ST = { qs, idx: 0, kind, fails: 0, limit: kind === 'short' ? STEST_FAIL_N : 0 };
  goTo({ screen: 'stest' });
}

function renderSTest() {
  if (!ST) return goTo({ screen: 'stestSetup' });
  if (ST.idx >= ST.qs.length) return renderSTestResult();
  const S = ST, s = S.qs[S.idx], q = STEST[s.i];
  let html = renderTopbar() + `<div class="game-topbar">
      <button class="exit-x" onclick='ST=null; APP.goToJSON(${JSON.stringify(JSON.stringify(S.kind === 'one' ? { screen: 'tstat', test: 'skull' } : { screen: 'stestSetup' }))})'>✕</button>
      <div class="game-progress-bar"><div class="game-progress-fill" style="width:${Math.round(S.idx / S.qs.length * 100)}%"></div></div>
      ${S.limit ? `<div class="st-fails ${S.fails ? 'on' : ''}">✕ ${S.fails}/${S.limit}</div>` : ''}
      <div class="base-counter">${S.idx + 1}/${S.qs.length}</div></div><div class="game-body">
      <div class="st-kind ${s.k}">${s.k === 'pick' ? '☑️ отметь все верные' : '✍️ напиши сам · хватит одной структуры, всего верных: ' + q.r.length}</div>
      <div class="tfav-q"><div class="speed-prompt"><div class="sp-main" style="font-size:19px">${q.q}</div></div>${tfavStar('skull', s.i)}</div>`;
  if (s.k === 'pick') {
    html += `<div class="speed-options">` + s.opts.map((o, k) => {
      let cls = 'speed-opt st-opt', mark = s.sel.has(k) ? '☑' : '☐';
      if (s.done) {
        if (o.ok && s.sel.has(k)) cls += ' opt-correct';
        else if (o.ok) cls += ' st-missed';
        else if (s.sel.has(k)) cls += ' opt-wrong';
      } else if (s.sel.has(k)) cls += ' opt-selected';
      const tag = s.done ? (o.ok && !s.sel.has(k) ? '<span class="st-tag">пропущено</span>' : !o.ok && s.sel.has(k) ? '<span class="st-tag">лишнее</span>' : '') : '';
      return `<button class="${cls}" onclick="stestToggle(${k})" ${s.done ? 'disabled' : ''}><span class="opt-checkbox">${mark}</span>${o.t}${tag}</button>`;
    }).join('') + `</div>`;
    if (!s.done) html += `<button class="btn btn-primary btn-block" style="margin-top:12px" onclick="stestCheck()" ${s.sel.size ? '' : 'disabled'}>Проверить</button>`;
  } else {
    if (!s.done) html += `<div class="rc-list">${s.found.map(k => `<span class="rc-chip">${q.r[k][0]} <i>${q.r[k][1]}</i></span>`).join('') || '<span class="rc-empty">Пока ничего не названо</span>'}</div>`;
    if (!s.done) {
      html += `<form class="rc-form" onsubmit="event.preventDefault(); stestAdd();">
          <input id="stIn" class="ed-input" autocomplete="off" autocapitalize="off" placeholder="по одному: по-русски или на латыни">
          <button class="btn btn-primary" type="submit">+</button></form>
        <div class="rc-msg ${s.msgCls || ''}">${s.msg}</div>
        <button class="btn btn-ghost btn-block" onclick="stestCheck()">Готово — показать ответ</button>`;
    } else {
      html += `<div class="rc-sub">Все ответы по тесту · 🗺️ — показать на карточке:</div>` + stestAnsList(q, s);
    }
  }
  if (s.done) {
    html += `<div class="base-answer ${s.ok ? 'ok' : 'bad'}"><div class="base-answer-head">${s.k === 'pick' ? (s.ok ? 'Верно!' : 'Не совсем') : s.found.length === 0 ? 'Не названо ни одной структуры' : s.found.length === q.r.length ? `Верно! Названо всё — ${q.r.length} из ${q.r.length}` : `Засчитано: названо ${s.found.length} из ${q.r.length}`}</div>
        ${s.k === 'pick' ? `<div class="rc-sub" style="margin-top:0">Все верные · 🗺️ — показать на карточке:</div>${stestAnsList(q, s)}` : ''}
        ${q.ex}${q.note ? `<div class="st-note">⚠️ ${q.note}</div>` : ''}${thLine('skull', s.i)}</div>
      ${stestFailed() ? '<div class="st-failbar">3 ошибки — на опросе это уже незачёт. Тест остановлен.</div>' : ''}
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="stestNext()">${S.kind === 'one' ? '← К статистике' : S.idx + 1 >= S.qs.length || stestFailed() ? 'Итоги →' : 'Далее →'}</button>`;
  }
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
  const inp = document.getElementById('stIn'); if (inp) inp.focus();
}
function stestToggle(k) { const s = ST.qs[ST.idx]; if (s.done) return; s.sel.has(k) ? s.sel.delete(k) : s.sel.add(k); render(); }
function stestAdd() {
  const s = ST.qs[ST.idx], q = STEST[s.i], inp = document.getElementById('stIn'), v = inp ? inp.value : '';
  if (!v.trim()) return;
  /* сверяем сразу с верными и неверными, чтобы «височная ямка» не засчиталась как «подвисочная» */
  let k = recallMatch(stestItems(q).concat(q.w.map(t => ({ ru: [t], lat: [] }))), v);
  if (k !== null && k >= q.r.length) k = null;
  if (k === null) { s.msg = `«${v.trim()}» — нет среди верных ответов`; s.msgCls = 'bad'; }
  else if (s.found.includes(k)) { s.msg = `${q.r[k][0]} — уже есть`; s.msgCls = 'rep'; }
  else { s.found.push(k); s.msg = `✓ ${q.r[k][0]}`; s.msgCls = 'ok'; }
  render();
  if (s.found.length === q.r.length) stestCheck();
}
function stestCheck() {
  const s = ST.qs[ST.idx]; if (s.done) return;
  const q = STEST[s.i];
  /* в письменных вопросах ответ засчитывается, если названа хотя бы одна структура */
  s.ok = s.k === 'pick' ? s.opts.every((o, k) => o.ok === s.sel.has(k)) : s.found.length > 0;
  s.done = true; stestRecord(s.i, s.ok); if (!['weak', 'fav', 'one'].includes(ST.kind)) thPush('skull', s.i, s.ok);
  if (!s.ok && S_LIMIT()) ST.fails++;
  render();
}
function S_LIMIT() { return ST && ST.limit; }
function stestFailed() { return !!(ST && ST.limit && ST.fails >= ST.limit); }
function stestNext() {
  if (ST && ST.kind === 'one') { ST = null; goTo({ screen: 'tstat', test: 'skull' }); window.scrollTo(0, 0); return; }
  if (stestFailed()) { ST.failed = true; ST.idx = ST.qs.length; } else ST.idx++;
  render(); window.scrollTo(0, 0);
}
function renderSTestResult() {
  const S = ST, done = S.qs.filter(s => s.done), n = done.length || 1, got = done.filter(s => s.ok).length;
  const pct = Math.round(got / n * 100), errs = n - got;
  if (!S.xp) { S.xp = 1; addXp(got * 3); }
  const part = k => { const a = done.filter(s => s.k === k); return a.length ? `${a.filter(s => s.ok).length} из ${a.length}` : '—'; };
  let html = renderTopbar() + `<div class="game-body">`;
  if (S.limit) {
    const mark = 5 - errs;
    html += S.failed
      ? `<div class="st-verdict bad">Не сдано · ${errs} ошибки<div class="st-verdict-sub">На опросе каждая ошибка — минус балл, а три ошибки уже незачёт. Разбери их ниже и попробуй снова.</div></div>`
      : `<div class="st-verdict ok">Сдано · ошибок: ${errs}<div class="st-verdict-sub">Если считать «ошибка — минус балл», это примерно на ${mark}.</div></div>`;
  }
  html += `<div class="rc-score">${pct === 100 ? '🎉 ' : ''}Полностью верно ${got} из ${n} — ${pct}%</div>
    <div class="st-summary-row"><div>☑️ Выбор вариантов<b>${part('pick')}</b></div><div>✍️ Написать самому<b>${part('write')}</b></div></div>`;
  const missed = done.filter(s => !s.ok);
  if (missed.length) {
    html += `<div class="rc-head">Повтори (${missed.length}) — они попали в «Повторить ошибки»</div>`;
    missed.forEach(s => { const q = STEST[s.i]; html += `<div class="rc-row miss"><b>${q.q}</b><br>${q.r.map(x => x[0]).join(', ')}</div>`; });
  }
  html += `<div style="display:flex; gap:10px; margin-top:16px">
    <button class="btn btn-primary" style="flex:1" onclick="stestStart('${S.kind || 'all'}')">Ещё раз</button>
    <button class="btn btn-ghost" style="flex:1" onclick='ST=null; APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'stestSetup' }))})'>К тесту</button></div></div>`;
  document.getElementById('app').innerHTML = html;
}

/* ---------- флеш-карточки: спереди вопрос, сзади ответы ---------- */
function stestCardsStart(shuffle) {
  const order = STEST.map((q, i) => i);
  STC = { order: shuffle ? shuffleArr(order) : order, idx: 0, flip: false, list: false, mixed: !!shuffle };
  goTo({ screen: 'stestCards' });
}
function stcAnswersHtml(q) {
  return stestAnsList(q, null)
    + `<div class="fc-ex">${q.ex}</div>` + (q.note ? `<div class="st-note">⚠️ ${q.note}</div>` : '');
}
function renderSTestCards() {
  if (!STC) STC = { order: STEST.map((q, i) => i), idx: 0, flip: false, list: false, mixed: false };
  const C = STC;
  let html = renderTopbar() + backRow('Тест по черепу', { screen: 'stestSetup' });
  html += `<div class="hub-header"><h1>🃏 Все ответы</h1>
    <div class="hub-latin">${STEST.length} карточек: спереди вопрос, сзади — ответы ровно по тесту кафедры.</div></div><div class="game-body">`;
  if (C.list) {
    html += `<button class="btn btn-ghost btn-block" onclick="STC.list=false; render();">← Вернуться к карточкам</button>`;
    html += `<div class="fc-list">` + C.order.map((i, n) => {
      const q = STEST[i];
      return `<div class="fc-item"><div class="fc-num">${n + 1}</div><div><div class="fc-q">${q.q}</div>${stcAnswersHtml(q)}</div></div>`;
    }).join('') + `</div>`;
  } else {
    const i = C.order[C.idx], q = STEST[i], k = stestKind(q);
    html += `<div class="fc" onclick="stcFlip()">
        <div class="fc-face ${C.flip ? 'fc-back' : 'fc-front'}" key="${C.idx}-${C.flip}">
          <div class="st-kind ${k}">${k === 'pick' ? '☑️ выбрать все верные' : '✍️ написать самому'} · верных ответов: ${q.r.length}</div>
          ${C.flip ? `<div class="fc-qsmall">${q.q}</div>${stcAnswersHtml(q)}`
            : `<div class="fc-q">${q.q}</div><div class="fc-hint">нажми, чтобы увидеть ответ</div>`}
        </div></div>
      <div class="fc-nav">
        <button class="btn btn-ghost" onclick="event.stopPropagation(); stcGo(-1)" ${C.idx ? '' : 'disabled'}>←</button>
        <div class="fc-count">${C.idx + 1} / ${C.order.length}</div>
        <button class="btn btn-ghost" onclick="event.stopPropagation(); stcGo(1)" ${C.idx + 1 < C.order.length ? '' : 'disabled'}>→</button>
      </div>
      <div class="fc-tools">
        <button class="base-chip ${C.mixed ? 'on' : ''}" onclick="stestCardsStart(${!C.mixed})">🔀 ${C.mixed ? 'Вперемешку' : 'Перемешать'}</button>
        <button class="base-chip" onclick="STC.list=true; render();">📄 Показать списком</button>
      </div>
      <div class="rc-note" style="text-align:center">Клавиши ← → листают, пробел переворачивает.</div>`;
  }
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}
function stcFlip() { STC.flip = !STC.flip; render(); }
function stcGo(d) {
  const n = STC.order.length;
  STC.idx = Math.min(n - 1, Math.max(0, STC.idx + d)); STC.flip = false; render(); window.scrollTo(0, 0);
}
document.addEventListener('keydown', e => {
  if (VIEW.screen !== 'stestCards' || !STC || STC.list) return;
  if (e.key === 'ArrowLeft') { stcGo(-1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { stcGo(1); e.preventDefault(); }
  else if (e.key === ' ' || e.key === 'Enter') { stcFlip(); e.preventDefault(); }
});

/* ===================== ОСИ И ДВИЖЕНИЯ ===================== */
/* Каждая кость — одна цельная фигура: части рисуются дважды (сначала толстым контуром,
   потом заливкой поверх), поэтому внутренние стыки не видны. Тень — общий радиальный градиент кости. */
const ART_LINE = '#7a6544';
let ART_UID = 0;
function artBone(parts, g, det) {
  const id = 'abg' + (++ART_UID);
  const [cx, cy, r] = g;
  const out = parts.map(p => p.replace(/\/>$/, ` fill="${ART_LINE}" stroke="${ART_LINE}" stroke-width="3.4" stroke-linejoin="round"/>`)).join('');
  const body = parts.map(p => p.replace(/\/>$/, ` fill="url(#${id})" stroke="url(#${id})" stroke-width=".6"/>`)).join('');
  return `<defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">
    <stop offset="0" stop-color="#fdf8ec"/><stop offset=".62" stop-color="#ecdcb8"/><stop offset="1" stop-color="#c9b185"/></radialGradient></defs>
    <g>${out}${body}${det || ''}</g>`;
}
const P = d => `<path d="${d}"/>`;
const C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const E = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`;
const DL = (d, w) => `<path d="${d}" fill="none" stroke="#a48c62" stroke-width="${w || 1.1}" stroke-linecap="round"/>`;
const CART = (d, w) => `<path d="${d}" fill="none" stroke="#9fc0d8" stroke-width="${w || 4}" stroke-linecap="round" opacity=".9"/>`;
const SOFT = (d) => `<path d="${d}" fill="#f2e9d6" stroke="#cdbb95" stroke-width="1.2"/>`;
const TXT = (x, y, t, s) => `<text x="${x}" y="${y}" font-size="${s || 14}" fill="#6b6455" font-weight="600">${t}</text>`;

/* ---------- кости и сцены ---------- */
const ART = {};
/* ПЛЕЧЕВОЙ ПОЯС, вид спереди (правая сторона: латерально — слева) */
ART.scapulaF = () => artBone([
  P('M114 72 Q150 64 232 70 Q228 118 212 168 Q196 218 178 258 Q160 228 141 190 Q124 152 118 124 Q114 106 114 92 Z'),
  P('M118 72 Q104 80 102 92 Q101 106 102 118 Q105 128 116 134 L124 128 Q118 105 124 80 Z'),
  P('M232 60 Q198 50 150 46 Q112 43 86 50 Q72 55 74 63 Q80 70 96 68 Q130 62 160 66 Q200 70 232 76 Z'),
  P('M138 82 Q128 74 120 82 Q113 92 106 96 Q99 100 101 105 Q108 108 117 102 Q128 96 140 92 Z')],
  [170, 130, 140],
  DL('M150 112 Q178 122 198 152') + DL('M142 152 Q164 162 180 198') + CART('M103 88 Q97 105 103 122', 5));
ART.claviculaF = () => artBone([P('M258 30 Q220 26 190 38 Q160 50 130 46 Q110 44 98 50 Q94 58 106 60 Q132 60 160 62 Q194 56 222 44 Q240 40 258 44 Z')], [180, 46, 90]);
ART.humerusF = () => artBone([
  P('M52 80 Q36 92 38 112 Q40 128 52 140 Q58 150 60 166 Q62 205 60 250 Q54 262 50 270 Q70 278 98 272 Q94 262 88 250 Q86 205 88 166 Q90 150 98 136 L76 116 Z'),
  C(78, 104, 25)],
  [74, 150, 120],
  DL('M60 84 Q53 104 62 126', 1) + DL('M56 100 Q58 124 64 148') + DL('M62 196 Q66 206 64 220') + CART('M93 85 Q105 104 93 124', 4));
/* вид сбоку (латеральный): вперёд — влево */
ART.scapulaS = () => artBone([
  P('M150 60 Q160 120 156 170 Q154 220 160 258 L172 258 Q166 210 168 160 Q172 110 168 60 Z'),
  P('M98 62 Q130 46 176 54 Q188 60 180 70 Q150 64 120 72 Q100 76 98 62 Z'),
  P('M160 78 Q130 78 112 86 Q104 90 108 96 Q124 94 160 92 Z')], [150, 110, 120]);
ART.humerusS = () => artBone([
  P('M108 112 Q112 140 118 160 Q120 200 118 250 Q114 262 112 270 L150 270 Q146 262 144 250 Q142 200 144 160 Q148 140 152 112 Z'),
  C(130, 104, 26)], [128, 150, 110], DL('M112 90 Q110 112 120 128', 1));
/* вид сверху, локоть согнут */
ART.trunkTop = () => SOFT('M60 70 Q160 20 250 70 Q262 110 240 150 Q160 186 70 150 Q50 112 60 70 Z') + TXT(130, 118, 'туловище', 13);
ART.girdleTop = () => artBone([P('M150 60 Q120 58 96 72 Q82 80 76 92 Q84 98 92 90 Q108 76 150 70 Z'),
  P('M86 98 Q110 140 196 154 L192 164 Q104 152 76 106 Z')], [120, 110, 90]);
ART.forearmTop = () => artBone([P('M60 112 L56 214 Q58 226 70 228 Q82 226 84 214 L80 112 Z'), E(70, 238, 15, 12)], [70, 170, 80]) +
  artBone([C(70, 110, 21)], [64, 104, 26]);

/* ЛОКОТЬ, вид сбоку: вперёд — вправо */
ART.humerusElb = () => artBone([P('M112 0 L110 118 Q102 138 108 152 Q118 170 134 168 Q152 166 156 150 Q158 136 150 120 L148 0 Z'), C(132, 150, 19)],
  [130, 90, 110], CART('M114 150 Q118 172 140 170', 4));
ART.ulnaElb = () => artBone([P('M118 126 Q108 140 112 160 Q116 172 124 178 L128 300 Q132 308 140 302 L142 178 Q148 170 150 164 Q142 172 132 170 Q118 166 118 150 Q120 138 126 132 Z')], [130, 210, 110]);
ART.radiusElb = () => artBone([P('M146 160 Q158 160 160 170 L156 298 Q150 306 144 298 L142 174 Q140 162 146 160 Z')], [150, 220, 90]);
/* предплечье спереди: латерально (лучевая) — слева */
ART.humerusElbF = () => artBone([P('M100 0 L102 40 Q80 50 72 64 Q84 76 100 72 Q120 80 140 72 Q158 76 168 64 Q160 50 138 40 L140 0 Z')], [120, 40, 80], CART('M90 72 Q120 82 150 72', 4));
ART.ulnaF = () => artBone([P('M126 66 Q146 60 152 74 Q148 88 140 94 L136 248 Q142 260 132 266 Q122 262 125 248 L128 94 Z')], [136, 160, 110]);
ART.radiusF = () => artBone([P('M90 74 Q104 68 112 78 Q112 88 105 92 L108 238 Q116 252 110 262 Q96 268 84 262 Q86 250 95 238 L96 92 Q88 86 90 74 Z')], [100, 170, 110]);

/* КИСТЬ спереди (ладонь, правая: большой палец слева); центр запястья (110,104) */
ART.forearmW = () => artBone([P('M62 0 L64 70 Q60 86 64 96 L114 96 L114 0 Z')], [88, 50, 70]) +
  artBone([P('M120 0 L120 92 Q136 98 150 90 Q154 80 148 70 L148 0 Z')], [134, 46, 60]) + CART('M66 96 L112 96', 3);
ART.carpus = () => artBone([P('M70 100 Q110 92 150 100 Q158 120 150 140 Q110 150 72 140 Q64 120 70 100 Z')], [110, 120, 50],
  DL('M90 104 Q88 120 92 138') + DL('M110 102 L110 142') + DL('M130 104 Q132 120 128 140') + DL('M72 120 Q110 124 150 120'));
ART.fingerF = (x, len) => artBone([P(`M${x - 6} 138 L${x - 5} 226 Q${x - 7} 234 ${x - 5} 240 L${x - 4} ${240 + len} Q${x} ${246 + len} ${x + 4} ${240 + len} L${x + 5} 240 Q${x + 7} 234 ${x + 5} 226 L${x + 6} 138 Z`)],
  [x, 200, 90], DL(`M${x - 6} 233 L${x + 6} 233`) + DL(`M${x - 5} ${240 + len * .55} L${x + 5} ${240 + len * .55}`) + DL(`M${x - 4} ${240 + len * .85} L${x + 4} ${240 + len * .85}`));
ART.thumbF = () => artBone([P('M70 128 Q60 132 62 142 L44 190 Q40 200 44 206 L30 238 Q28 248 36 250 Q44 248 46 240 L58 208 Q62 200 58 192 L76 146 Q80 132 70 128 Z')], [52, 190, 70],
  DL('M42 198 L58 202') + DL('M36 228 L48 232'));
/* кисть сбоку: вперёд (ладонь) — вправо */
ART.forearmWS = () => artBone([P('M86 0 L88 92 Q92 102 110 102 Q128 102 132 92 L134 0 Z')], [110, 50, 70]);
ART.handS = () => artBone([P('M92 104 Q110 96 128 104 Q134 120 128 136 L124 230 Q126 250 120 290 Q116 300 108 296 L104 236 L96 140 Q88 122 92 104 Z')], [110, 190, 110],
  DL('M96 138 L128 138') + DL('M100 236 L124 234') + DL('M104 268 L122 268'));
/* палец сбоку (пястно-фаланговый и межфаланговые): ладонь — вправо */
ART.metacarpalS = () => artBone([P('M96 0 L94 98 Q92 112 104 114 Q118 114 116 98 L114 0 Z')], [104, 60, 70], CART('M94 108 Q104 118 116 108', 3));
ART.phal1 = () => artBone([P('M96 116 Q104 112 114 116 L112 172 Q114 180 104 182 Q94 180 96 172 Z')], [104, 148, 40], CART('M96 176 Q104 182 112 176', 3));
ART.phal2 = () => artBone([P('M97 184 Q104 181 111 184 L110 222 Q111 228 104 229 Q97 228 98 222 Z')], [104, 205, 30]);
ART.phal3 = () => artBone([P('M98 231 Q104 229 110 231 L109 252 Q104 260 99 252 Z')], [104, 242, 22]);

/* ТАЗОБЕДРЕННЫЙ спереди (правый: латерально — слева); центр головки (100,140) */
ART.pelvisF = () => artBone([
  P('M150 20 Q100 10 70 40 Q56 64 66 92 Q76 110 96 116 Q112 122 122 136 L172 150 Q192 110 188 70 Q182 34 150 20 Z'),
  P('M118 128 Q150 132 214 146 L216 170 Q160 168 128 162 Z'),
  P('M88 148 Q96 192 118 202 Q140 206 152 188 Q142 170 128 160 L104 150 Z'),
  C(102, 140, 28),
  P('M186 40 Q222 50 228 82 Q228 120 208 142 Q196 110 188 70 Z')], [140, 100, 140],
  `<circle cx="102" cy="140" r="21" fill="#e0cca4" stroke="#a48c62" stroke-width="1"/>` + DL('M150 50 Q170 80 168 120') + DL('M216 146 L216 170', 1.5));
ART.femurF = () => artBone([
  P('M98 126 L66 146 Q48 146 48 164 Q50 180 64 182 Q70 230 74 300 Q72 312 66 320 L112 320 Q104 310 100 300 Q98 232 96 186 Q100 176 104 168 L118 150 Z'),
  C(100, 140, 22)], [86, 220, 140],
  DL('M90 192 Q102 196 100 206') + DL('M74 152 Q82 160 80 172') + CART('M88 124 Q112 120 120 140', 4));
/* сбоку: вперёд — вправо; центр головки (130,130) */
ART.pelvisS = () => artBone([P('M60 20 Q140 0 200 40 Q192 80 164 108 Q140 118 150 150 Q154 186 120 214 Q96 214 92 196 Q100 170 96 150 Q80 120 62 84 Z'),
  C(130, 130, 28)], [130, 100, 130], `<circle cx="130" cy="130" r="22" fill="#e0cca4" stroke="#a48c62" stroke-width="1"/>`);
ART.femurS = () => artBone([P('M116 136 Q112 220 118 300 Q116 312 112 320 L154 320 Q150 312 148 300 Q150 220 146 140 Z'),
  P('M110 122 Q98 146 114 160 L140 148 Z'), C(130, 130, 21)], [130, 220, 140]);
/* сверху, бедро согнуто */
ART.pelvisTop = () => artBone([P('M20 80 Q70 30 130 52 Q190 30 240 80 Q232 118 180 126 Q130 146 80 126 Q28 118 20 80 Z')], [130, 80, 120],
  `<ellipse cx="130" cy="88" rx="42" ry="22" fill="#f4f1e8" stroke="#a48c62" stroke-width="1.2"/>`) + TXT(104, 30, 'таз', 13);
ART.femurTop = () => artBone([P('M58 126 L54 250 Q56 262 70 264 Q84 262 86 250 L82 126 Z'), C(70, 124, 20)], [70, 190, 90]);

/* КОЛЕНО сбоку: вперёд — вправо; ось через мыщелки (134,158) */
ART.femurK = () => artBone([P('M110 0 L112 118 Q100 140 104 160 Q114 180 136 180 Q160 178 166 158 Q168 140 156 122 L150 0 Z'), C(134, 158, 22)],
  [132, 100, 120], CART('M112 168 Q130 184 156 176', 4));
ART.patella = () => artBone([P('M168 126 Q184 130 184 152 Q180 172 166 174 Q160 150 168 126 Z')], [174, 150, 30]);
ART.tibiaK = () => artBone([P('M104 180 Q134 188 166 180 Q172 198 160 212 L150 340 Q146 348 136 348 Q126 348 124 340 L118 212 Q102 198 104 180 Z'),
  P('M156 198 Q170 204 162 218 L156 214 Z')], [136, 250, 120]);
ART.fibulaK = () => artBone([P('M104 196 Q96 200 98 210 L104 334 L114 334 L110 210 Q112 200 104 196 Z')], [106, 260, 80]);
/* колено сверху, согнуто */
ART.thighTop = () => artBone([P('M90 0 L92 70 Q60 80 62 104 Q80 126 120 124 Q160 126 176 104 Q178 80 146 70 L148 0 Z')], [118, 70, 90]) + TXT(156, 30, 'бедро', 13);
ART.footTop = () => artBone([P('M100 112 Q122 106 132 122 L136 210 Q140 240 124 250 Q106 256 96 240 Q90 226 96 210 L92 128 Q92 116 100 112 Z')], [114, 180, 90],
  DL('M100 200 L130 200') + DL('M98 220 L134 220'));

/* ГОЛЕНОСТОП сбоку (латерально): вперёд — вправо; центр блока таранной кости (126,190) */
ART.tibiaA = () => artBone([P('M104 0 L106 150 Q100 172 108 180 L152 180 Q158 168 152 150 L150 0 Z')], [128, 90, 110], CART('M108 180 Q128 172 150 180', 3));
ART.fibulaA = () => artBone([P('M92 30 L96 170 Q90 194 100 200 Q112 196 110 172 L106 30 Z')], [100, 120, 90]);
ART.footA = () => artBone([
  P('M104 180 Q126 170 150 180 Q158 196 148 206 L110 206 Q98 196 104 180 Z'),
  P('M56 202 Q66 186 104 196 L124 218 Q104 240 72 238 Q52 228 56 202 Z'),
  P('M142 194 Q172 196 222 222 Q252 232 272 236 Q280 244 268 250 Q222 250 172 238 Q140 234 118 222 Z')], [150, 214, 130],
  DL('M150 200 Q156 214 150 228') + DL('M180 210 L186 236') + DL('M232 228 L236 244'));
/* палец стопы сбоку: вперёд — вправо */
ART.metatarsalS = () => artBone([P('M0 96 L98 94 Q112 92 114 104 Q114 118 98 116 L0 114 Z')], [60, 104, 70], CART('M108 94 Q118 104 108 116', 3));
ART.toe1 = () => artBone([P('M116 96 Q112 104 116 112 L160 112 Q168 104 160 96 Z')], [140, 104, 30], CART('M162 97 Q168 104 162 111', 3));
ART.toe2 = () => artBone([P('M164 97 Q160 104 164 111 L190 110 Q200 104 190 98 Z')], [178, 104, 24]);

/* ВНЧС сбоку: вперёд — вправо; головка (114,176) */
const SKULL_S = 'M60 160 Q34 140 36 110 Q40 40 120 22 Q200 14 228 64 Q236 84 236 100 L246 118 Q240 126 236 128 Q240 150 232 166 L228 182 L170 182 Q150 176 130 178 L112 176 Q84 172 60 160 Z';
const MAND_S = 'M108 172 Q118 166 124 176 L126 188 Q136 196 146 178 L154 166 L160 180 Q162 192 172 196 L224 194 Q234 212 228 234 Q200 242 150 240 Q118 240 108 232 Q100 224 102 212 L106 192 Q106 182 108 172 Z';
ART.skullS = () => artBone([P(SKULL_S)], [140, 100, 150],
  `<ellipse cx="204" cy="98" rx="17" ry="14" fill="#f4f1e8" stroke="#a48c62"/>` + DL('M128 158 Q160 146 196 146', 2.2) + DL('M176 180 L226 180', 1.5) + DL('M58 120 Q70 150 92 164') + CART('M104 174 Q114 168 126 176', 3));
ART.mandS = () => artBone([P(MAND_S)], [160, 210, 100], DL('M176 198 L222 197', 1.5));
/* вид спереди: смещение вправо-влево */
ART.skullFront = () => artBone([P('M50 110 Q40 20 130 14 Q220 20 210 110 Q206 140 190 150 L70 150 Q54 140 50 110 Z')], [130, 80, 110],
  `<ellipse cx="96" cy="90" rx="20" ry="16" fill="#f4f1e8" stroke="#a48c62"/><ellipse cx="164" cy="90" rx="20" ry="16" fill="#f4f1e8" stroke="#a48c62"/>` + DL('M120 130 L140 130') + DL('M84 148 L176 148', 1.5));
ART.mandF = () => artBone([P('M60 120 Q58 200 130 222 Q202 200 200 120 L186 120 Q184 188 130 204 Q76 188 74 120 Z'), P('M58 112 L76 112 L76 130 L58 130 Z'), P('M184 112 L202 112 L202 130 L184 130 Z')], [130, 180, 90],
  DL('M94 170 L166 170', 1.5));

/* ГОЛОВА И ШЕЯ сбоку: вперёд — вправо; мыщелки затылочной кости (96,178) */
ART.neckS = () => [0, 1, 2, 3].map(i => { const y = 188 + i * 32; return artBone([P(`M78 ${y} L112 ${y - 2} Q120 ${y + 12} 112 ${y + 24} L78 ${y + 26} Q72 ${y + 12} 78 ${y} Z`), P(`M76 ${y + 6} L52 ${y + 12} L54 ${y + 22} L76 ${y + 20} Z`)], [92, y + 12, 34]); }).join('');
ART.headS = () => artBone([P(SKULL_S)], [140, 100, 150], `<ellipse cx="204" cy="98" rx="17" ry="14" fill="#f4f1e8" stroke="#a48c62"/>` + DL('M128 158 Q160 146 196 146', 2.2)) + ART.mandS();
/* спереди: наклон в сторону; мыщелки (130,170) */
ART.neckF = () => [0, 1, 2, 3].map(i => artBone([P(`M104 ${184 + i * 32} L156 ${184 + i * 32} Q166 ${196 + i * 32} 156 ${208 + i * 32} L104 ${208 + i * 32} Q94 ${196 + i * 32} 104 ${184 + i * 32} Z`)], [130, 196 + i * 32, 36])).join('');
ART.headF = () => ART.skullFront() + artBone([P('M70 132 Q66 196 130 214 Q194 196 190 132 L176 132 Q174 186 130 198 Q86 186 84 132 Z')], [130, 180, 80]);
/* сверху: поворот головы; атлант и зуб (130,130) */
ART.atlasTop = () => artBone([P('M70 130 Q70 80 130 76 Q190 80 190 130 Q190 176 130 182 Q70 176 70 130 Z')], [130, 130, 70],
  `<ellipse cx="130" cy="140" rx="36" ry="30" fill="#f4f1e8" stroke="#a48c62"/>`) + artBone([C(130, 100, 12)], [126, 96, 14]);
ART.headTop = () => `<g opacity=".72">` + SOFT('M60 130 Q60 40 130 34 Q200 40 200 130 Q200 220 130 226 Q60 220 60 130 Z') +
  SOFT('M120 34 Q130 14 140 34 Z') + SOFT('M56 120 Q44 130 56 146 Z') + SOFT('M204 120 Q216 130 204 146 Z') + `</g>` + TXT(118, 70, 'нос', 13);

/* ГРУДИНО-КЛЮЧИЧНЫЙ спереди (правая ключица — влево); грудинный конец (176,62) */
ART.sternumF = () => artBone([P('M164 54 Q190 46 214 54 L210 100 Q206 106 198 108 L196 230 Q190 244 182 230 L180 108 Q172 106 168 100 Z')], [190, 120, 110],
  CART('M166 58 Q170 66 168 74', 3)) + artBone([P('M168 104 Q120 106 80 130 Q72 136 80 140 Q122 120 170 118 Z')], [120, 120, 70]);
ART.clavF = () => artBone([P('M178 52 Q150 44 120 54 Q90 64 60 56 Q38 52 30 60 Q34 70 52 70 Q86 74 118 66 Q150 60 176 70 Z')], [104, 60, 90]);
/* сверху */
ART.sternumTop = () => artBone([E(190, 150, 28, 14)], [190, 150, 30]) + SOFT('M60 120 Q140 90 250 150 Q250 220 150 230 Q60 210 60 120 Z').replace('<path', '<path opacity=".45"') + TXT(200, 210, 'грудная клетка', 12);
ART.clavTop = () => artBone([P('M172 140 Q150 120 124 128 Q96 136 70 120 Q52 112 44 120 Q48 132 66 134 Q94 148 124 142 Q152 136 170 156 Z')], [110, 132, 80]);

/* ---------- сцены: что неподвижно, что двигается, вокруг какой точки ---------- */
const SCENES = {
  sh_front: { vb: '-95 10 350 280', stat: () => ART.scapulaF() + ART.claviculaF(), mov: () => ART.humerusF(), pv: [78, 104] },
  sh_side: { vb: '-60 10 290 290', stat: () => ART.scapulaS(), mov: () => ART.humerusS(), pv: [130, 104], label: TXT(-50, 290, '← вперёд', 15) },
  sh_top: { vb: '0 0 260 270', stat: () => ART.trunkTop() + ART.girdleTop(), mov: () => ART.forearmTop(), pv: [70, 110], label: TXT(8, 264, 'вид сверху, локоть согнут', 13) },
  el_side: { vb: '-10 -10 320 330', stat: () => ART.humerusElb(), mov: () => ART.ulnaElb() + ART.radiusElb(), pv: [132, 150], label: TXT(220, 310, 'вперёд →', 14) },
  el_front: { vb: '20 -5 200 280', stat: () => ART.humerusElbF() + ART.ulnaF(), mov: () => ART.radiusF(), pv: [101, 80], label: TXT(24, 274, 'лучевая', 12) },
  wr_front: { vb: '0 -5 230 380', stat: () => ART.forearmW(), mov: () => ART.carpus() + ART.thumbF() + [80, 100, 120, 140].map((x, i) => ART.fingerF(x, [74, 82, 76, 60][i])).join(''), pv: [110, 104] },
  wr_side: { vb: '-20 -5 260 320', stat: () => ART.forearmWS(), mov: () => ART.handS(), pv: [110, 104], label: TXT(170, 300, 'ладонь →', 13) },
  th_front: { vb: '0 -5 230 380', stat: () => ART.forearmW() + ART.carpus() + [80, 100, 120, 140].map((x, i) => ART.fingerF(x, [74, 82, 76, 60][i])).join(''), mov: () => ART.thumbF(), pv: [72, 134] },
  mcp_front: { vb: '0 -5 230 380', stat: () => ART.forearmW() + ART.carpus() + ART.thumbF() + ART.fingerF(100, 82), pv: [110, 230], multi: [[80, 74, -14], [120, 76, 9], [140, 60, 16]] },
  fi_side: { vb: '40 0 150 270', stat: () => ART.metacarpalS(), mov: () => ART.phal1() + ART.phal2() + ART.phal3(), pv: [104, 112], label: TXT(140, 262, 'ладонь →', 12) },
  ip_side: { vb: '40 0 150 270', stat: () => ART.metacarpalS() + ART.phal1(), mov: () => ART.phal2() + ART.phal3(), pv: [104, 182], nest: { pv: [104, 229], k: .7 }, label: TXT(140, 262, 'ладонь →', 12) },
  hip_front: { vb: '-60 0 300 330', stat: () => ART.pelvisF(), mov: () => ART.femurF(), pv: [100, 140] },
  hip_side: { vb: '-20 0 330 330', stat: () => ART.pelvisS(), mov: () => ART.femurS(), pv: [130, 130], label: TXT(230, 320, 'вперёд →', 14) },
  hip_top: { vb: '0 0 260 280', stat: () => ART.pelvisTop(), mov: () => ART.femurTop(), pv: [70, 124], label: TXT(8, 276, 'вид сверху, бедро согнуто', 13) },
  kn_side: { vb: '-30 -5 260 360', stat: null, mov: () => ART.fibulaK() + ART.tibiaK(), pv: [134, 158], over: () => ART.femurK() + ART.patella(), label: TXT(170, 350, 'вперёд →', 14) },
  kn_top: { vb: '30 0 180 270', stat: () => ART.thighTop(), mov: () => ART.footTop(), pv: [116, 110], label: TXT(36, 266, 'вид сверху, колено согнуто', 12) },
  an_side: { vb: '30 -5 260 270', stat: () => ART.tibiaA(), mov: () => ART.footA(), pv: [126, 190], over: () => ART.fibulaA(), label: TXT(210, 264, 'вперёд →', 14) },
  toe_side: { vb: '0 40 210 130', stat: () => ART.metatarsalS() + ART.toe1(), mov: () => ART.toe2(), pv: [162, 104], label: TXT(140, 160, 'вперёд →', 12) },
  tmj_side: { vb: '20 0 250 280', stat: () => ART.skullS(), mov: () => ART.mandS(), pv: [114, 176], label: TXT(200, 276, 'вперёд →', 13) },
  tmj_front: { vb: '30 0 200 240', stat: () => ART.skullFront(), mov: () => ART.mandF(), pv: [130, 120] },
  ao_side: { vb: '20 0 250 320', stat: () => ART.neckS(), mov: () => ART.headS(), pv: [96, 178], label: TXT(200, 316, 'вперёд →', 13) },
  ao_front: { vb: '30 0 200 320', stat: () => ART.neckF(), mov: () => ART.headF(), pv: [130, 176] },
  aa_top: { vb: '40 10 180 240', stat: () => ART.atlasTop(), mov: () => ART.headTop(), pv: [130, 120], label: TXT(48, 246, 'вид сверху', 12) },
  sc_front: { vb: '10 20 230 240', stat: () => ART.sternumF(), mov: () => ART.clavF(), pv: [176, 62] },
  sc_top: { vb: '20 80 250 170', stat: () => ART.sternumTop(), mov: () => ART.clavTop(), pv: [172, 148], label: TXT(30, 244, 'вид сверху', 12) },
};

/* анимация: rot [a,b] — качание между углами; tr [dx,dy]; circ [r] — конус (только для качающейся кости) */
function artScene(id, anim, opt) {
  const s = SCENES[id]; opt = opt || {};
  const [px, py] = s.pv, dur = opt.dur || 3.2;
  let mov = '';
  if (s.multi) {
    const a = anim && anim.rot ? 1 : 0;
    mov = s.multi.map(([x, len, ang]) => `<g>${a ? `<animateTransform attributeName="transform" type="rotate" values="0 ${x} 232;${ang} ${x} 232;0 ${x} 232" dur="${dur}s" repeatCount="indefinite"/>` : ''}${ART.fingerF(x, len)}</g>`).join('');
  } else if (s.mov) {
    let inner = s.mov();
    let tf = '';
    if (anim && anim.rot) {
      const [a, b] = anim.rot;
      tf = `<animateTransform attributeName="transform" type="rotate" values="${a} ${px} ${py};${b} ${px} ${py};${a} ${px} ${py}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/>`;
    } else if (anim && anim.tr) {
      const [dx, dy] = anim.tr;
      tf = `<animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy};0 0;${-dx} ${-dy};0 0" dur="${dur}s" repeatCount="indefinite"/>`;
      if (anim.half) tf = `<animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy};0 0" dur="${dur}s" repeatCount="indefinite"/>`;
    } else if (anim && anim.circ) {
      const r = anim.circ, v = [];
      for (let t = 0; t <= 24; t++) v.push((r * Math.cos(t * Math.PI / 12)).toFixed(1) + ` ${px} ${py}`);
      tf = `<animateTransform attributeName="transform" type="rotate" values="${v.join(';')}" dur="${dur}s" repeatCount="indefinite"/>`;
    }
    mov = opt.pose !== undefined ? `<g transform="rotate(${opt.pose} ${px} ${py})">${inner}</g>` : `<g>${tf}${inner}</g>`;
  }
  let extra = '';
  if (anim && anim.circ && opt.cone) {
    const [cx, cy, rx, ry] = opt.cone;
    extra = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#b8901f" stroke-width="2.5" stroke-dasharray="5 4"/>
      <circle r="6" fill="#b8901f"><animateMotion dur="${dur}s" repeatCount="indefinite" path="M${cx + rx} ${cy} A${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}"/></circle>`;
  }
  const dot = opt.dot ? `<circle cx="${px}" cy="${py}" r="9" fill="#fff" stroke="${opt.dot}" stroke-width="3"/><circle cx="${px}" cy="${py}" r="3" fill="${opt.dot}"/>` : '';
  return `<svg viewBox="${s.vb}" xmlns="http://www.w3.org/2000/svg">${s.stat ? s.stat() : ''}${mov}${s.over ? s.over() : ''}${extra}${opt.axes || ''}${dot}${s.label || ''}</svg>`;
}

/* ---------- данные игры «Оси и движения» ---------- */
const AXM = {
  flex: 'сгибание и разгибание', abd: 'отведение и приведение', rot: 'вращение кнутри и кнаружи', prosup: 'пронация и супинация',
  circ: 'круговое движение', jaw: 'опускание и поднятие нижней челюсти', jawlat: 'смещение челюсти вправо и влево',
  jawpro: 'выдвижение челюсти вперёд и назад', nod: 'наклоны головы вперёд и назад', tilt: 'наклоны головы в стороны',
  turn: 'повороты головы вправо и влево', clavup: 'поднимание и опускание ключицы', clavfb: 'движения ключицы вперёд и назад',
  oppos: 'противопоставление большого пальца', dorsi: 'тыльное и подошвенное сгибание стопы',
};
const AXZ = {
  F: { t: 'Фронтальная ось', c: '#c0392b', s: 'слева направо' },
  S: { t: 'Сагиттальная ось', c: '#2e6fd0', s: 'спереди назад' },
  V: { t: 'Вертикальная ось', c: '#2a9d4b', s: 'сверху вниз, вдоль кости' },
  ALL: { t: 'Вокруг всех осей по очереди', c: '#b8901f' },
  SL: { t: 'Без оси — скольжение', c: '#8a7a5a' },
};
const AXF = {
  ball: { t: 'Шаровидный', n: '3 оси', r: 'шар → 3 оси (многоосный): сгибание/разгибание, отведение/приведение, вращение и круговое движение' },
  cup: { t: 'Чашеобразный', n: '3 оси', r: 'чашеобразный — разновидность шаровидного: тоже 3 оси, но объём движений меньше — впадина глубокая' },
  ell: { t: 'Эллипсовидный', n: '2 оси', r: 'эллипс → 2 оси: фронтальная и сагиттальная — сгибание/разгибание и отведение/приведение' },
  cond: { t: 'Мыщелковый', n: '2 оси', r: 'мыщелковый — переход между блоковидным и эллипсовидным: 2 оси' },
  sad: { t: 'Седловидный', n: '2 оси', r: 'седло → 2 оси, движения вокруг двух взаимно перпендикулярных осей' },
  troch: { t: 'Блоковидный', n: '1 ось', r: 'блок → 1 ось (фронтальная): только сгибание и разгибание' },
  cyl: { t: 'Цилиндрический', n: '1 ось', r: 'цилиндр → 1 ось (вертикальная, вдоль кости): только вращение' },
  flat: { t: 'Плоский', n: 'много осей, малый объём', r: 'плоский → теоретически многоосный, но движения небольшие, похожи на скольжение' },
};
const AXFORM_ORDER = ['ball', 'cup', 'ell', 'cond', 'sad', 'troch', 'cyl', 'flat'];
/* z — правильная раскладка движений по осям; opt — движения, которые можно поставить или не ставить;
   an — анимация для каждого движения: сцена + размах; main — рисунок для шага «Оси» (view: front/side/top) */
const AXJ = [
 { id: 'tmj', tp: 'j_tmj', grp: 'head', ru: 'Височно-нижнечелюстной сустав', lat: 'articulatio temporomandibularis',
   bones: 'головка нижней челюсти + нижнечелюстная ямка и суставной бугорок височной кости; внутри — суставной диск',
   form: 'ell', alt: ['troch'], z: { F: ['jaw'], V: ['jawlat'], SL: ['jawpro'] }, w: ['flex', 'rot', 'abd'],
   an: { jaw: { sc: 'tmj_side', rot: [0, 22] }, jawlat: { sc: 'tmj_front', tr: [12, 0] }, jawpro: { sc: 'tmj_side', tr: [10, 3], half: 1 } },
   main: { sc: 'tmj_side', view: 'side' },
   expl: 'Парный, комплексный (есть диск), комбинированный: правый и левый работают вместе. Опускание и поднятие — вокруг фронтальной оси; поворот вправо-влево — вокруг вертикальной; выдвижение вперёд — скольжение головки вместе с диском на суставной бугорок.',
   note: 'На карточке Сапина — <b>эллипсовидный</b>, у Синельникова (с. 150–151) — <b>блоковидный</b>. Засчитываются оба ответа.' },
 { id: 'ao', tp: 'j_atlas', grp: 'head', ru: 'Атлантозатылочный сустав', lat: 'articulatio atlantooccipitalis',
   bones: 'мыщелки затылочной кости + верхние суставные ямки атланта',
   form: 'ell', alt: ['cond'], z: { F: ['nod'], S: ['tilt'] }, w: ['turn', 'rot', 'circ'],
   an: { nod: { sc: 'ao_side', rot: [-14, 16] }, tilt: { sc: 'ao_front', rot: [-12, 12] } }, main: { sc: 'ao_side', view: 'side' },
   expl: 'Эллипсовидный (мыщелковый), комбинированный — правый и левый суставы действуют вместе. Вокруг фронтальной оси — кивательные движения: наклон вперёд около 20°, назад около 30°. Вокруг сагиттальной — наклоны головы в стороны около 20°.',
   note: 'На карточке названы обе формы: «мыщелковый, эллипсовидный» — засчитываются обе.' },
 { id: 'aa', tp: 'j_atlas', grp: 'head', ru: 'Срединный атлантоосевой сустав', lat: 'articulatio atlantoaxialis mediana',
   bones: 'зуб осевого позвонка + ямка зуба на передней дуге атланта и поперечная связка атланта',
   form: 'cyl', z: { V: ['turn'] }, w: ['nod', 'tilt', 'flex'],
   an: { turn: { sc: 'aa_top', rot: [-35, 35] } }, main: { sc: 'aa_top', view: 'top' },
   expl: 'Цилиндрический, одноосный: атлант вместе с черепом поворачивается вокруг зуба — на 30–40° в каждую сторону. Ось вертикальная, проходит через зуб.' },
 { id: 'sc', tp: 'j_sternoclav', grp: 'upper', ru: 'Грудино-ключичный сустав', lat: 'articulatio sternoclavicularis',
   bones: 'грудинный конец ключицы + ключичная вырезка рукоятки грудины; внутри — суставной диск',
   form: 'flat', alt: ['sad'], z: { S: ['clavup'], V: ['clavfb'], ALL: ['circ'] }, w: ['flex', 'rot', 'abd'],
   an: { clavup: { sc: 'sc_front', rot: [-5, 16] }, clavfb: { sc: 'sc_top', rot: [-15, 15] }, circ: { sc: 'sc_front', circ: 10 } }, main: { sc: 'sc_front', view: 'front' },
   expl: 'Комплексный (есть диск), многоосный. Вокруг сагиттальной оси ключица поднимается и опускается, вокруг вертикальной — движется вперёд и назад, возможны и круговые движения.',
   note: 'На карточке Сапина форма — <b>плоский</b>, у Синельникова (с. 151) поверхности <b>седловидные</b>, а по объёму движений сустав близок к шаровидному. Засчитываются оба.' },
 { id: 'sh', tp: 'j_shoulder', grp: 'upper', ru: 'Плечевой сустав', lat: 'articulatio humeri',
   bones: 'суставная впадина лопатки (с суставной губой) + головка плечевой кости',
   form: 'ball', z: { F: ['flex'], S: ['abd'], V: ['rot'], ALL: ['circ'] }, w: ['prosup', 'oppos', 'dorsi'],
   an: { flex: { sc: 'sh_side', rot: [-25, 80] }, abd: { sc: 'sh_front', rot: [0, 80] }, rot: { sc: 'sh_top', rot: [-45, 45] }, circ: { sc: 'sh_front', circ: 24, cone: [64, 262, 46, 12] } },
   main: { sc: 'sh_front', view: 'front' },
   expl: 'Шаровидный, многоосный: сгибание и разгибание, отведение до горизонтали (выше — уже с лопаткой), приведение, вращение кнутри и кнаружи, круговое движение. Свободная капсула — поэтому вывихи здесь самые частые.' },
 { id: 'hu', tp: 'j_elbow', grp: 'upper', ru: 'Плечелоктевой сустав', lat: 'articulatio humeroulnaris',
   bones: 'блок плечевой кости + блоковидная вырезка локтевой кости',
   form: 'troch', z: { F: ['flex'] }, w: ['abd', 'prosup', 'rot'],
   an: { flex: { sc: 'el_side', rot: [0, -130] } }, main: { sc: 'el_side', view: 'side' },
   expl: 'Блоковидный, одноосный (часть сложного локтевого сустава): сгибание и разгибание предплечья вокруг фронтальной оси, общий объём до 170°.' },
 { id: 'hr', tp: 'j_elbow', grp: 'upper', ru: 'Плечелучевой сустав', lat: 'articulatio humeroradialis',
   bones: 'головка мыщелка плечевой кости + ямка головки лучевой кости',
   form: 'ball', z: { F: ['flex'], V: ['prosup'] }, w: ['abd', 'circ', 'rot'],
   an: { flex: { sc: 'el_side', rot: [0, -130] }, prosup: { sc: 'el_front', rot: [0, -12] } }, main: { sc: 'el_side', view: 'side' },
   expl: 'По форме шаровидный, но движений только два: сгибание/разгибание вместе с локтевой костью и вращение лучевой кости (пронация и супинация). Отведения нет — его не даёт локтевая кость.' },
 { id: 'ru', tp: 'j_elbow', grp: 'upper', ru: 'Лучелоктевые суставы (проксимальный и дистальный)', lat: 'articulationes radioulnares proximalis et distalis',
   bones: 'суставная окружность головки лучевой + лучевая вырезка локтевой; внизу — головка локтевой + локтевая вырезка лучевой',
   form: 'cyl', z: { V: ['prosup'] }, w: ['flex', 'abd', 'circ'],
   an: { prosup: { sc: 'el_front', rot: [0, -12] } }, main: { sc: 'el_front', view: 'front' },
   expl: 'Цилиндрические, вместе — комбинированный сустав с продольной осью (через головки лучевой и локтевой костей). Лучевая кость с кистью вращается вокруг локтевой: пронация — внутрь, супинация — кнаружи. Мнемоника: в ладони миска супа — при супинации суп остаётся, при пронации проливается.' },
 { id: 'wr', tp: 'j_wrist', grp: 'upper', ru: 'Лучезапястный сустав', lat: 'articulatio radiocarpea',
   bones: 'запястная суставная поверхность лучевой кости и суставной диск + ладьевидная, полулунная и трёхгранная кости',
   form: 'ell', z: { F: ['flex'], S: ['abd'] }, opt: ['circ'], w: ['rot', 'prosup', 'oppos'],
   an: { flex: { sc: 'wr_side', rot: [40, -70] }, abd: { sc: 'wr_front', rot: [-15, 25] }, circ: { sc: 'wr_front', circ: 16 } }, main: { sc: 'wr_front', view: 'front' },
   expl: 'Эллипсовидный, двуосный: сгибание и разгибание кисти вокруг фронтальной оси, отведение и приведение — вокруг сагиттальной. Вращения нет: «поворот кисти» — это пронация и супинация в лучелоктевых суставах.',
   note: 'Круговое движение кисти (сумма движений по двум осям) на карточке не названо — можно ставить, можно не ставить.' },
 { id: 'cmc1', tp: 'j_wrist', grp: 'upper', ru: 'Запястно-пястный сустав большого пальца', lat: 'articulatio carpometacarpea pollicis',
   bones: 'кость-трапеция + основание I пястной кости',
   form: 'sad', z: { F: ['oppos'], S: ['abd'] }, opt: ['circ'], w: ['rot', 'prosup', 'flex'],
   an: { oppos: { sc: 'th_front', rot: [0, -50] }, abd: { sc: 'th_front', rot: [-6, 18] }, circ: { sc: 'th_front', circ: 14 } }, main: { sc: 'th_front', view: 'front' },
   expl: 'Седловидный, двуосный, изолирован от других суставов кисти и очень подвижен: противопоставление большого пальца остальным и обратное движение, отведение и приведение.',
   note: 'Круговое движение (сумма движений по двум осям) на карточке не названо — можно ставить, можно не ставить.' },
 { id: 'mcp', tp: 'j_wrist', grp: 'upper', ru: 'Пястно-фаланговые суставы II–V', lat: 'articulationes metacarpophalangeae',
   bones: 'головки пястных костей + основания проксимальных фаланг',
   form: 'ball', z: { F: ['flex'], S: ['abd'] }, opt: ['circ'], w: ['rot', 'prosup', 'oppos'],
   an: { flex: { sc: 'fi_side', rot: [0, -80] }, abd: { sc: 'mcp_front', rot: [0, 1] }, circ: { sc: 'fi_side', circ: 22 } }, main: { sc: 'fi_side', view: 'side' },
   expl: 'По форме шаровидные, но движения — сгибание/разгибание и отведение/приведение пальцев (вращению мешают коллатеральные связки). Первый пястно-фаланговый — блоковидный.',
   note: 'Круговое движение пальца можно ставить, можно не ставить.' },
 { id: 'iph', tp: 'j_wrist', grp: 'upper', ru: 'Межфаланговые суставы кисти', lat: 'articulationes interphalangeae manus',
   bones: 'головка проксимальной (средней) фаланги + основание следующей фаланги',
   form: 'troch', z: { F: ['flex'] }, w: ['abd', 'rot', 'circ'],
   an: { flex: { sc: 'ip_side', rot: [0, -80] } }, main: { sc: 'ip_side', view: 'side' },
   expl: 'Блоковидные, одноосные: только сгибание и разгибание фаланг.' },
 { id: 'hip', tp: 'j_hip', grp: 'lower', ru: 'Тазобедренный сустав', lat: 'articulatio coxae',
   bones: 'вертлужная впадина тазовой кости (с вертлужной губой) + головка бедренной кости',
   form: 'cup', alt: ['ball'], z: { F: ['flex'], S: ['abd'], V: ['rot'], ALL: ['circ'] }, w: ['prosup', 'dorsi', 'oppos'],
   an: { flex: { sc: 'hip_side', rot: [15, -90] }, abd: { sc: 'hip_front', rot: [-12, 40] }, rot: { sc: 'hip_top', rot: [-30, 30] }, circ: { sc: 'hip_front', circ: 20, cone: [86, 312, 44, 11] } },
   main: { sc: 'hip_front', view: 'front' },
   expl: 'Чашеобразный — разновидность шаровидного, многоосный: сгибание, разгибание, отведение, приведение, вращение кнаружи и внутрь, круговое движение бедра. Глубокая впадина и мощные связки делают движения меньше, чем в плечевом.',
   note: 'Ответ «шаровидный» тоже засчитывается: чашеобразный — его разновидность.' },
 { id: 'kn', tp: 'j_knee', grp: 'lower', ru: 'Коленный сустав', lat: 'articulatio genus',
   bones: 'мыщелки бедренной кости + мыщелки большеберцовой кости + надколенник; внутри — мениски и крестообразные связки',
   form: 'cond', z: { F: ['flex'], V: ['rot'] }, w: ['abd', 'circ', 'prosup'],
   an: { flex: { sc: 'kn_side', rot: [0, 120] }, rot: { sc: 'kn_top', rot: [-25, 25] } }, main: { sc: 'kn_side', view: 'side' },
   expl: 'Мыщелковый, сложный, комплексный: сгибание и разгибание голени вокруг фронтальной оси; вращение вокруг вертикальной — только при согнутом колене.' },
 { id: 'an', tp: 'j_ankle', grp: 'lower', ru: 'Голеностопный сустав', lat: 'articulatio talocruralis',
   bones: 'нижние концы большеберцовой и малоберцовой костей (вилка) + блок таранной кости',
   form: 'troch', z: { F: ['dorsi'] }, w: ['abd', 'rot', 'circ'],
   an: { dorsi: { sc: 'an_side', rot: [-20, 35] } }, main: { sc: 'an_side', view: 'side' },
   expl: 'Блоковидный, сложный: тыльное и подошвенное сгибание стопы вокруг фронтальной оси. При подошвенном сгибании возможны небольшие колебания стопы в стороны.' },
 { id: 'ipf', tp: 'j_foot', grp: 'lower', ru: 'Межфаланговые суставы стопы', lat: 'articulationes interphalangeae pedis',
   bones: 'головка проксимальной (средней) фаланги + основание следующей фаланги',
   form: 'troch', z: { F: ['flex'] }, w: ['abd', 'rot', 'dorsi'],
   an: { flex: { sc: 'toe_side', rot: [-15, 40] } }, main: { sc: 'toe_side', view: 'side' },
   expl: 'Блоковидные: сгибание и разгибание пальцев стопы. Плюснефаланговые суставы — шаровидные (Синельников, с. 182).' },
];
const AXGRP = { all: 'Все суставы', head: 'Голова и шея', upper: 'Верхняя конечность', lower: 'Нижняя конечность' };

/* ---------- игра «Оси и движения» ---------- */
const AX_KEY = 'anatoQuestAxes_v1';
let AX = null, AX_SET = 'all', AX_DIFF = 'medium', AX_TABLE = false;
function axStore() { try { return JSON.parse(localStorage.getItem(AX_KEY) || '{}'); } catch (e) { return {}; } }
function axProf() { return (getActiveProfile() || '') + '::'; }
function axRecord(id, ok) {
  try { const a = axStore(), k = axProf() + id, r = a[k] || { s: 0, bad: 0 };
    if (ok) r.s++; else { r.s = 0; r.bad++; } a[k] = r; localStorage.setItem(AX_KEY, JSON.stringify(a)); } catch (e) {}
}
/* слабое место: ошибался и ещё не ответил верно два раза подряд */
function axWeak() { const a = axStore(), p = axProf(); return AXJ.filter(j => { const r = a[p + j.id]; return r && r.bad && r.s < 2; }).map(j => j.id); }
function axJ(id) { return AXJ.find(j => j.id === id); }
function axFormOk(j, f) { return f === j.form || (j.alt || []).includes(f); }
function axAxes(j) { return ['F', 'S', 'V'].filter(a => j.z[a]); }
function axFormIcon(k) {
  const I = {
    ball: '<circle cx="40" cy="24" r="14"/><path d="M18 16 Q40 -6 62 16" fill="none" stroke-width="3.5"/>',
    cup: '<circle cx="40" cy="26" r="12"/><path d="M19 28 Q19 3 40 3 Q61 3 61 28" fill="none" stroke-width="4"/>',
    ell: '<ellipse cx="40" cy="25" rx="21" ry="11"/>',
    cond: '<ellipse cx="29" cy="25" rx="10" ry="12"/><ellipse cx="51" cy="25" rx="10" ry="12"/>',
    sad: '<path d="M12 32 Q26 8 40 22 Q54 36 68 12" fill="none" stroke-width="6" stroke-linecap="round"/>',
    troch: '<rect x="17" y="13" width="46" height="22" rx="10"/><path d="M40 13 L40 35" stroke-width="3"/>',
    cyl: '<rect x="30" y="4" width="20" height="38" rx="9"/><ellipse cx="40" cy="8" rx="10" ry="4" fill="none"/>',
    flat: '<rect x="13" y="14" width="54" height="8"/><rect x="13" y="25" width="54" height="8"/>' };
  return `<svg viewBox="0 0 80 46"><g fill="#efe2c4" stroke="#7a6544" stroke-width="2">${I[k]}</g></svg>`;
}

/* оси поверх рисунка: вид спереди — Ф горизонтально, В вертикально, С «в глубину»; сбоку — С горизонтально, Ф в глубину; сверху — В в глубину */
function axAxesOverlay(j, on, reveal) {
  const s = SCENES[j.main.sc], [px, py] = s.pv, vb = s.vb.split(' ').map(Number);
  const W = vb[2], H = vb[3], hl = W * .42, vl = H * .44, dl = Math.min(W, H) * .24;
  const lines = {
    h: `M${px - hl} ${py} L${px + hl} ${py}`, v: `M${px} ${py - vl} L${px} ${py + vl}`,
    d: `M${px - dl} ${py + dl * .9} L${px + dl} ${py - dl * .9}` };
  const dir = { front: { F: 'h', V: 'v', S: 'd' }, side: { S: 'h', V: 'v', F: 'd' }, top: { F: 'h', S: 'v', V: 'd' } }[j.main.view];
  return ['F', 'S', 'V'].map(a => {
    const isOn = on.has(a), right = !!j.z[a];
    let op = isOn ? 1 : .22, extra = '';
    if (reveal) { op = right ? 1 : .12; if (isOn !== right) extra = `<text x="${px + 8}" y="${py - 8}" font-size="0"></text>`; }
    const dash = dir[a] === 'd' ? ' stroke-dasharray="11 7"' : '';
    return `<path d="${lines[dir[a]]}" stroke="${AXZ[a].c}" stroke-width="${W / 48}" stroke-linecap="round" opacity="${op}"${dash}/>${extra}`;
  }).join('') + `<circle cx="${px}" cy="${py}" r="${W / 34}" fill="#fff" stroke="#333" stroke-width="${W / 120}"/>`;
}

function axStart(kind, ids) {
  let list;
  if (kind === 'weak') list = axWeak().map(axJ);
  else if (ids) list = ids.map(axJ);
  else list = AXJ.filter(j => AX_SET === 'all' || j.grp === AX_SET);
  list = shuffleArr(list.slice());
  const qs = list.map(j => ({ j: j.id, k: AX_DIFF === 'hard' && Math.random() < .5 ? 'rev' : 'std' }));
  AX = { qs: qs.map(axNewQ), idx: 0, diff: AX_DIFF, rep: new Set(), log: {}, back: VIEW.screen === 'hub' ? { screen: 'hub', topicId: VIEW.topicId } : { screen: 'axesSetup' } };
  goTo({ screen: 'axes' });
}
function axNewQ(q) {
  const j = axJ(q.j);
  const moves = Object.values(j.z).flat().concat(j.opt || []);
  const o = { j: q.j, k: q.k, rep: q.rep, step: 1, form: null, axes: new Set(), place: {}, pick: null, done: false, ok: false, errs: [],
    pool: shuffleArr(moves.concat(j.w)) };
  if (q.k === 'rev') {
    const others = shuffleArr(AXJ.filter(x => x.id !== j.id && x.form !== j.form)).slice(0, 3);
    o.jopts = shuffleArr([j.id].concat(others.map(x => x.id))); o.jsel = null;
  }
  return o;
}
function axCur() { return AX && AX.qs[AX.idx]; }

function axPickForm(f) { const q = axCur(); if (q.form) return; q.form = f; if (!axFormOk(axJ(q.j), f)) q.errs.push('form'); render(); }
function axToggleAxis(a) { const q = axCur(); if (q.step !== 2 || q.axChecked) return; q.axes.has(a) ? q.axes.delete(a) : q.axes.add(a); render(); }
function axCheckAxes() { const q = axCur(), j = axJ(q.j); q.axChecked = true;
  if (axAxes(j).join() !== ['F', 'S', 'V'].filter(a => q.axes.has(a)).join()) q.errs.push('axes'); render(); }
function axNext(step) { const q = axCur(); q.step = step; render(); setTimeout(() => { const el = document.getElementById('axStep' + step); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); }
function axChip(m) { const q = axCur(); if (q.done) return; q.pick = q.pick === m ? null : m; render(); }
function axDrop(z) { const q = axCur(); if (q.done) return; if (q.pick) { q.place[q.pick] = z; q.pick = null; render(); } }
function axUnplace(m) { const q = axCur(); if (q.done) return; delete q.place[m]; render(); }
function axMoveErrs(j, q) {
  const errs = [];
  q.pool.forEach(m => {
    const want = Object.keys(j.z).find(z => j.z[z].includes(m)) || null, got = q.place[m] || null;
    if ((j.opt || []).includes(m)) { if (got && got !== 'ALL') errs.push({ m, want: 'ALL', got }); return; }
    if (want !== got) errs.push({ m, want, got });
  });
  return errs;
}
function axCheck() {
  const q = axCur(), j = axJ(q.j);
  q.merrs = axMoveErrs(j, q);
  if (q.merrs.length) q.errs.push('moves');
  axFinish(q);
}
function axRevPickForm(f) { const q = axCur(); if (q.done) return; q.form = f; render(); }
function axRevPickJ(id) { const q = axCur(); if (q.done) return; q.jsel = id; render(); }
function axRevCheck() {
  const q = axCur(), j = axJ(q.j);
  if (!axFormOk(j, q.form)) q.errs.push('form');
  if (q.jsel !== j.id) q.errs.push('joint');
  axFinish(q);
}
function axFinish(q) {
  q.done = true; q.ok = !q.errs.length;
  AX.log[q.j] = AX.log[q.j] === false ? false : (AX.log[q.j] === undefined ? q.ok : AX.log[q.j] && q.ok);
  if (!q.rep) axRecord(q.j, q.ok); else if (q.ok) axRecord(q.j, true);
  /* ошибка — этот сустав вернётся через 2 вопроса, уже без подсказки */
  if (!q.ok && !AX.rep.has(q.j)) { AX.rep.add(q.j); AX.qs.splice(Math.min(AX.idx + 3, AX.qs.length), 0, axNewQ({ j: q.j, k: 'std', rep: true })); }
  render();
  setTimeout(() => { const el = document.getElementById('axRes'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
}
function axGo() { AX.idx++; render(); window.scrollTo(0, 0); }

function axMoveAnim(j, m) {
  const a = j.an[m]; if (!a) return '';
  const zone = Object.keys(j.z).find(z => j.z[z].includes(m)) || 'ALL';
  const col = (AXZ[zone] || AXZ.ALL).c;
  return `<div class="ax-anim">${artScene(a.sc, a, { dot: zone === 'SL' ? null : col, cone: a.cone })}
    <div class="ax-anim-t">${AXM[m]}</div><div class="ax-anim-s" style="color:${col}">${zone === 'ALL' ? 'по всем осям — конус' : AXZ[zone].t.toLowerCase()}</div></div>`;
}
function axRuleBox() {
  return `<div class="ax-rule"><b>Правило:</b> шар → 3 оси · эллипс, седло, мыщелки → 2 оси · блок, цилиндр → 1 ось · плоский → скольжение
    <div class="ax-rule-s">Фронтальная — сгибание/разгибание · сагиттальная — отведение/приведение · вертикальная — вращение</div></div>`;
}

function renderAxes() {
  if (!AX) return goTo({ screen: 'axesSetup' });
  if (AX.idx >= AX.qs.length) return renderAxesResult();
  const q = axCur(), j = axJ(q.j), easy = AX.diff === 'easy';
  let html = renderTopbar() + `<div class="game-topbar">
      <button class="exit-x" onclick='AX=null; APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'axesSetup' }))})'>✕</button>
      <div class="game-progress-bar"><div class="game-progress-fill" style="width:${Math.round(AX.idx / AX.qs.length * 100)}%"></div></div>
      <div class="base-counter">${AX.idx + 1}/${AX.qs.length}</div></div><div class="game-body ax-body">`;
  if (q.rep) html += `<div class="ax-repbadge">🔁 Повтор — здесь была ошибка</div>`;
  if (easy) html += axRuleBox();
  if (q.k === 'rev') return renderAxesRev(html, q, j);
  html += `<div class="ax-q"><div class="ax-q-ru">${j.ru}</div><div class="ax-q-lat">${j.lat}</div><div class="ax-q-b">${j.bones}</div></div>
    <div class="ax-steps">${['Форма', 'Оси', 'Движения'].map((t, i) => `<span class="ax-st ${q.step > i + 1 || (q.step === 3 && q.done) ? 'done' : q.step === i + 1 ? 'on' : ''}">${i + 1} · ${t}</span>`).join('')}</div>`;
  /* шаг 1 */
  html += `<div class="ax-card" id="axStep1"><h3>Какая форма суставных поверхностей?</h3><div class="ax-forms">` +
    AXFORM_ORDER.map(f => { let c = 'ax-form'; if (q.form) { if (f === q.form) c += axFormOk(j, f) ? ' ok' : ' bad'; else if (f === j.form) c += ' ok'; }
      return `<button class="${c}" onclick="axPickForm('${f}')" ${q.form ? 'disabled' : ''}>${axFormIcon(f)}<span>${AXF[f].t}</span></button>`; }).join('') + `</div>`;
  if (q.form) {
    const ok = axFormOk(j, q.form);
    html += `<div class="ax-fb ${ok ? 'ok' : 'bad'}">${ok ? '✓ Верно' : '✗ Нет'} — <b>${AXF[j.form].t.toLowerCase()}</b>: ${AXF[j.form].r}.</div>`;
    if (q.step === 1) html += `<button class="btn btn-primary btn-block" onclick="axNext(2)">Дальше → оси</button>`;
  }
  html += `</div>`;
  /* шаг 2 */
  if (q.step >= 2) {
    html += `<div class="ax-card" id="axStep2"><h3>Вокруг каких осей возможны движения?</h3>
      <div class="ax-stage"><div class="ax-pic">${artScene(j.main.sc, null, { axes: axAxesOverlay(j, q.axes, q.axChecked) })}</div>
      <div class="ax-axbtns">${['F', 'S', 'V'].map(a => { let c = 'ax-axbtn' + (q.axes.has(a) ? ' sel' : '');
        if (q.axChecked) c += j.z[a] ? (q.axes.has(a) ? ' ok' : ' miss') : (q.axes.has(a) ? ' bad' : '');
        return `<button class="${c}" style="--c:${AXZ[a].c}" onclick="axToggleAxis('${a}')"><i></i><span>${AXZ[a].t.replace(' ось', '')}<small>${AXZ[a].s}</small></span></button>`; }).join('')}</div></div>`;
    if (!q.axChecked) html += `<button class="btn btn-primary btn-block" onclick="axCheckAxes()">Проверить оси</button>`;
    else {
      const n = axAxes(j).length, ok = !q.errs.includes('axes');
      html += `<div class="ax-fb ${ok ? 'ok' : 'bad'}">${ok ? '✓ Верно' : '✗ Не совсем'} — ${n === 1 ? 'одна ось' : n === 2 ? 'две оси' : 'три оси'}: ${axAxes(j).map(a => AXZ[a].t.toLowerCase()).join(', ')}.${j.z.SL ? ' Плюс скольжение без оси.' : ''}</div>`;
      if (q.step === 2) html += `<button class="btn btn-primary btn-block" onclick="axNext(3)">Дальше → движения</button>`;
    }
    html += `</div>`;
  }
  /* шаг 3 */
  if (q.step >= 3) {
    const zones = ['F', 'S', 'V', 'ALL', 'SL'];
    html += `<div class="ax-card" id="axStep3"><h3>Разложи движения по осям</h3>
      <div class="ax-hint">Нажми на движение, потом на ось. Лишние — оставь внизу.</div>` +
      zones.map(z => { const items = q.pool.filter(m => q.place[m] === z);
        return `<div class="ax-drop ${q.pick && !q.done ? 'target' : ''}" style="--c:${AXZ[z].c}" onclick="axDrop('${z}')"><b>${AXZ[z].t}</b>${items.map(m => {
          let c = 'ax-chip in'; if (q.done) { const e = q.merrs.find(x => x.m === m); c += e ? ' bad' : ' ok'; }
          return `<button class="${c}" onclick="event.stopPropagation(); axUnplace('${m}')">${AXM[m]}${q.done ? '' : ' ✕'}</button>`; }).join('')}</div>`; }).join('') +
      `<div class="ax-pool">${q.pool.filter(m => !q.place[m]).map(m => { let c = 'ax-chip' + (q.pick === m ? ' picked' : '');
        if (q.done) { const e = q.merrs.find(x => x.m === m); c += e ? ' miss' : ' rest'; }
        return `<button class="${c}" onclick="axChip('${m}')" ${q.done ? 'disabled' : ''}>${AXM[m]}</button>`; }).join('')}</div>`;
    if (!q.done) html += `<button class="btn btn-primary btn-block" onclick="axCheck()">Проверить</button>`;
    html += `</div>`;
  }
  if (q.done) html += renderAxesAnswer(q, j);
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}

function axErrText(j, e) {
  const zn = z => z ? (z === 'ALL' ? 'вокруг всех осей' : z === 'SL' ? 'скольжение без оси' : AXZ[z].t.toLowerCase()) : null;
  if (!e.want) return `«${AXM[e.m]}» — лишнее: в этом суставе его нет`;
  if (!e.got) return `«${AXM[e.m]}» — пропущено: ${zn(e.want)}`;
  return `«${AXM[e.m]}» — не ${zn(e.got)}, а ${zn(e.want)}`;
}
function renderAxesAnswer(q, j) {
  const moves = Object.values(j.z).flat().concat((j.opt || []).filter(m => j.an[m]));
  let h = `<div id="axRes" class="ax-res ${q.ok ? 'ok' : 'bad'}"><h4>${q.ok ? '✅ Всё верно!' : '❌ Есть ошибки'}</h4>`;
  if (q.merrs && q.merrs.length) h += `<ul class="ax-errs">${q.merrs.map(e => `<li>${axErrText(j, e)}</li>`).join('')}</ul>`;
  h += `<div class="ax-expl"><b>${j.ru} — ${AXF[j.form].t.toLowerCase()}, ${axAxes(j).length === 1 ? 'одноосный' : axAxes(j).length === 2 ? 'двуосный' : 'многоосный'}.</b> ${j.expl}</div>`;
  if (j.note) h += `<div class="st-note">⚠️ ${j.note}</div>`;
  h += `</div><div class="ax-card"><h3>Посмотри, как он двигается</h3><div class="ax-anims">${moves.map(m => axMoveAnim(j, m)).join('')}</div></div>`;
  if (!q.ok && !q.rep) h += `<div class="ax-later">🔁 Этот сустав вернётся через 2 вопроса — уже без подсказки</div>`;
  h += `<button class="btn btn-primary btn-block" onclick="axGo()">${AX.idx + 1 >= AX.qs.length ? 'Итоги →' : 'Следующий сустав →'}</button>`;
  return h;
}

/* «Врач»: обратная задача — по движениям узнать форму и сустав */
function renderAxesRev(html, q, j) {
  const moves = Object.keys(j.z).flatMap(z => j.z[z].map(m => ({ m, z })));
  html += `<div class="ax-q"><div class="ax-q-kind">🩺 Обратная задача</div><div class="ax-q-ru" style="font-size:18px">В суставе возможны:</div></div>
    <div class="ax-card"><div class="ax-givens">${moves.map(x => `<div class="ax-given" style="--c:${AXZ[x.z].c}"><b>${AXM[x.m]}</b><span>${x.z === 'ALL' ? 'вокруг всех осей' : x.z === 'SL' ? 'без оси' : AXZ[x.z].t.toLowerCase()}</span></div>`).join('')}</div>
    <div class="ax-hint">Других движений в нём нет.</div></div>
    <div class="ax-card"><h3>1. Какая форма?</h3><div class="ax-forms">` +
    AXFORM_ORDER.map(f => { let c = 'ax-form' + (q.form === f ? ' sel' : ''); if (q.done) { if (f === j.form) c += ' ok'; else if (f === q.form && !axFormOk(j, f)) c += ' bad'; }
      return `<button class="${c}" onclick="axRevPickForm('${f}')" ${q.done ? 'disabled' : ''}>${axFormIcon(f)}<span>${AXF[f].t}</span></button>`; }).join('') +
    `</div></div><div class="ax-card"><h3>2. Какой это сустав?</h3><div class="speed-options">` +
    q.jopts.map(id => { const x = axJ(id); let c = 'speed-opt' + (q.jsel === id ? ' opt-selected' : ''); if (q.done) { if (id === j.id) c += ' opt-correct'; else if (id === q.jsel) c += ' opt-wrong'; }
      return `<button class="${c}" onclick="axRevPickJ('${id}')" ${q.done ? 'disabled' : ''}>${x.ru}</button>`; }).join('') + `</div></div>`;
  if (!q.done) html += `<button class="btn btn-primary btn-block" onclick="axRevCheck()" ${q.form && q.jsel ? '' : 'disabled'}>Проверить</button>`;
  else html += renderAxesAnswer(q, j);
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}

function renderAxesResult() {
  const ids = Object.keys(AX.log), okN = ids.filter(id => AX.log[id]).length;
  if (!AX.xp) { AX.xp = 1; addXp(okN * 3); }
  let html = renderTopbar() + `<div class="result-wrap" style="padding-bottom:12px">
    <div class="result-pct">${okN} / ${ids.length}</div><h2 class="result-title">${okN === ids.length ? 'Все суставы без ошибок!' : 'Суставов без ошибок'}</h2>
    <div class="result-sub">+${okN * 3} XP · ошибки сохранены в «Повторить ошибки»</div></div>
    <div class="game-body"><div class="ax-card"><h3>📋 Шпаргалка по игре</h3>${axTable(ids.map(axJ), id => !AX.log[id])}
    <div class="ax-hint">Красным — суставы, где были ошибки.</div></div>
    <div style="display:flex;gap:10px"><button class="btn btn-primary" style="flex:1" onclick="axStart('again', ${JSON.stringify(AX.qs.filter(q => !q.rep).map(q => q.j)).replace(/"/g, '&quot;')})">Ещё раз</button>
    <button class="btn btn-ghost" style="flex:1" onclick='AX=null; APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'axesSetup' }))})'>К выбору</button></div></div>`;
  document.getElementById('app').innerHTML = html;
}
function axTable(list, isBad) {
  return `<div class="ax-tbl-wrap"><table class="ax-tbl"><tr><th>Сустав</th><th>Форма</th><th>Оси</th><th>Движения</th></tr>` + list.map(j => {
    const bad = isBad && isBad(j.id);
    const mv = Object.keys(j.z).map(z => j.z[z].map(m => `<span style="color:${AXZ[z].c}">${AXM[m]}</span>`).join(', ')).join('; ');
    return `<tr class="${bad ? 'bad' : ''}"><td>${j.ru}</td><td>${AXF[j.form].t}${j.alt ? '*' : ''}</td><td>${axAxes(j).length}</td><td>${mv}${j.opt ? ' <i>(+ круговое)</i>' : ''}</td></tr>`;
  }).join('') + `</table></div><div class="ax-hint">Цвет движения — его ось: <span style="color:${AXZ.F.c}">фронтальная</span>, <span style="color:${AXZ.S.c}">сагиттальная</span>, <span style="color:${AXZ.V.c}">вертикальная</span>, <span style="color:${AXZ.ALL.c}">все оси</span>. * — есть вторая допустимая форма.</div>`;
}

function renderAxesSetup() {
  const weak = axWeak();
  let html = renderTopbar() + backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>🧭 Оси и движения</h1>
    <div class="hub-latin">Форма сустава → оси → движения. ${AXJ.length} суставов, в каждом — анимация движений.</div></div>
    <div class="game-body">
    <div class="ax-setlab">Какие суставы</div><div class="base-groups">${Object.keys(AXGRP).map(k => `<button class="base-chip ${AX_SET === k ? 'on' : ''}" onclick="AX_SET='${k}'; render();">${AXGRP[k]} <span class="base-chip-n">${k === 'all' ? AXJ.length : AXJ.filter(j => j.grp === k).length}</span></button>`).join('')}</div>
    <div class="ax-setlab">Сложность</div><div class="base-groups">${[['easy', '🙂 Лёгкая', 'правило-подсказка на экране'], ['medium', '😐 Средняя', 'без подсказки'], ['hard', '🩺 Врач', '+ обратные задачи: по движениям узнай сустав']].map(([k, t]) => `<button class="base-chip ${AX_DIFF === k ? 'on' : ''}" onclick="AX_DIFF='${k}'; render();">${t}</button>`).join('')}</div>
    <div class="ax-hint">${{ easy: 'Правило «форма → оси → движения» видно на каждом шаге.', medium: 'Без подсказки — вспоминаешь сам.', hard: 'Без подсказки, и половина вопросов — обратные: даны движения, нужно назвать форму и сустав.' }[AX_DIFF]}</div>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="axStart('set')">▶ Начать</button>
    ${weak.length ? `<button class="btn btn-ghost btn-block" style="margin-top:10px" onclick="axStart('weak')">🎯 Повторить ошибки (${weak.length})</button>` : ''}
    <div class="ax-card" style="margin-top:16px"><h3>Как устроена игра</h3><ol class="ax-how">
      <li><b>Форма</b> — выбери форму суставных поверхностей.</li><li><b>Оси</b> — отметь оси на рисунке сустава.</li>
      <li><b>Движения</b> — разложи движения по осям, лишние оставь.</li><li>После ответа — анимация каждого движения и объяснение.</li>
      <li>Ошибка — сустав вернётся через 2 вопроса и попадёт в «Повторить ошибки», пока не ответишь верно 2 раза подряд.</li></ol>
      ${axRuleBox()}</div>
    <button class="btn btn-ghost btn-block" onclick="AX_TABLE=!AX_TABLE; render();">📋 ${AX_TABLE ? 'Скрыть' : 'Показать'} таблицу всех суставов</button>
    ${AX_TABLE ? `<div class="ax-card" style="margin-top:10px">${axTable(AXJ)}</div>` : ''}
    <div class="rc-note" style="margin-top:12px">Формы и движения — по карточкам Сапина «Синдесмология»; где Синельников называет иначе, засчитываются оба ответа и есть пометка ⚠️.</div>
    </div>`;
  document.getElementById('app').innerHTML = html;
}


/* ---------- статистика тестов: последние 10 попаданий каждого вопроса ---------- */
const THIST_KEY = 'anatoQuestTestHist_v1', THIST_N = 10;
const TEST_META = { skull: { title: 'Тест по черепу', back: 'stestSetup' }, arthro: { title: 'Тест обзора: артрология', back: 'otestSetup' } };
function thAll() { try { const o = JSON.parse(localStorage.getItem(THIST_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function thKey(test) { return (getActiveProfile() || '') + '::' + test; }
function thTest(test) { const o = thAll()[thKey(test)]; return o && typeof o === 'object' ? o : {}; }
function thOf(test, i) { const a = thTest(test)[i]; return Array.isArray(a) ? a : []; }
function thPush(test, i, ok) { try { const all = thAll(), k = thKey(test), t = all[k] && typeof all[k] === 'object' ? all[k] : {};
  t[i] = (Array.isArray(t[i]) ? t[i] : []).concat(ok ? 1 : 0).slice(-THIST_N); all[k] = t; localStorage.setItem(THIST_KEY, JSON.stringify(all)); } catch (e) {} }
function thPct(test, i) { const a = thOf(test, i); return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 100) : null; }
/* вес: 100% верных — 0.4, 0% — 10, новый вопрос — 4 */
function thWeight(test, i) { const p = thPct(test, i); return p === null ? 4 : 0.4 + 9.6 * (1 - p / 100); }
/* взвешенный порядок: вопросы с ошибками встают в очередь раньше */
function thOrder(test, idx) { return idx.map(i => ({ i, k: Math.pow(Math.random(), 1 / thWeight(test, i)) })).sort((a, b) => b.k - a.k).map(x => x.i); }
function thFreq(test, i) { const w = thWeight(test, i); return w >= 7 ? 'попадается очень часто' : w >= 4 ? 'попадается часто' : w >= 1.5 ? 'попадается реже' : 'попадается редко'; }
function thLine(test, i) { const a = thOf(test, i); const wk = test === 'arthro' ? OT && OT.kind : ST && ST.kind;
  if (wk === 'weak') return `<div class="th-line">🎯 Работа над ошибками в статистику не идёт</div>`;
  if (wk === 'fav') return `<div class="th-line">★ Избранное в статистику не идёт</div>`;
  if (wk === 'one') return `<div class="th-line">📊 Отработка из статистики — в статистику не идёт</div>`; if (!a.length) return ''; const y = a.reduce((x, v) => x + v, 0);
  return `<div class="th-line">📊 По этому вопросу: ${y} из ${a.length} верно (${thPct(test, i)}%) — ${thFreq(test, i)}</div>`; }
function thCard(test) { const n = Object.keys(thTest(test)).length;
  return `<div class="mode-card" onclick='TSTAT_RESET=false; APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'tstat', test }))})'><div class="mode-emoji">📊</div>
    <div class="mode-body"><div class="mode-title">Статистика</div><div class="mode-desc">${n ? `Процент верных по каждому вопросу за последние 10 попаданий · вопросов: ${n}` : 'Появится после первого теста'}</div></div></div>`; }
let TSTAT_RESET = false;
function renderTStat() {
  const test = VIEW.test === 'arthro' ? 'arthro' : 'skull', Q = test === 'arthro' ? OTEST : STEST, meta = TEST_META[test];
  const txt = i => test === 'arthro' ? otText(Q[i]) : Q[i].q;
  const seen = Q.map((_, i) => i).filter(i => thOf(test, i).length);
  const tot = seen.reduce((a, i) => a + thOf(test, i).length, 0), ok = seen.reduce((a, i) => a + thOf(test, i).reduce((x, y) => x + y, 0), 0);
  let html = renderTopbar() + backRow(meta.title, { screen: meta.back });
  html += `<div class="hub-header"><h1>📊 Статистика</h1><div class="hub-latin">${meta.title}</div></div><div class="game-body">
    <div class="th-top"><div><b>${seen.length}</b><span>из ${Q.length} вопросов попадались</span></div><div><b>${tot ? Math.round(ok / tot * 100) : 0}%</b><span>верных в среднем</span></div>
    <div><b>${seen.filter(i => thPct(test, i) < 50).length}</b><span>вопросов ниже 50%</span></div></div>
    <div class="rc-note" style="margin:10px 0">Для каждого вопроса считаются последние 10 попаданий: новое вытесняет самое старое. Чем ниже процент, тем чаще вопрос попадается в тесте.</div>`;
  if (!seen.length) html += `<div class="rc-note">Пока пусто — пройди тест, и здесь появится процент по каждому вопросу.</div>`;
  seen.sort((a, b) => thPct(test, a) - thPct(test, b) || thOf(test, b).length - thOf(test, a).length).forEach(i => {
    const a = thOf(test, i), p = thPct(test, i), y = a.reduce((x, v) => x + v, 0);
    html += `<div class="th-row"><div class="th-q">${escapeHtml(txt(i))}</div><div class="th-pct ${p < 50 ? 'lo' : p < 80 ? 'mid' : 'hi'}">${p}%</div>
      <div class="th-dots">${a.map(v => `<span class="th-dot ${v ? 'y' : 'n'}"></span>`).join('')}${'<span class="th-dot"></span>'.repeat(THIST_N - a.length)}<span class="th-freq">${y} из ${a.length} · ${thFreq(test, i)}</span></div><button class="th-solve" onclick="${test === 'arthro' ? 'otStart' : 'stestStart'}('one', ${i})">▶ Решить</button></div>`;
  });
  if (seen.length && seen.length < Q.length) html += `<div class="rc-note" style="margin-top:10px">Ещё не попадались: ${Q.length - seen.length} — они идут в тест с повышенным шансом.</div>`;
  if (seen.length) html += TSTAT_RESET
    ? `<div class="data-confirm" style="margin-top:16px"><b>Сбросить статистику этого теста?</b><div class="data-confirm-btns"><button class="btn btn-danger" onclick="thReset('${test}')">Сбросить</button><button class="btn btn-ghost" onclick="TSTAT_RESET=false; render()">Отмена</button></div></div>`
    : `<button class="btn btn-ghost btn-block" style="margin-top:16px" onclick="TSTAT_RESET=true; render()">Сбросить статистику</button>`;
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}
function thReset(test) { try { const all = thAll(); delete all[thKey(test)]; localStorage.setItem(THIST_KEY, JSON.stringify(all)); } catch (e) {} TSTAT_RESET = false; render(); }

/* ---------- избранные вопросы тестов (звёздочка) ---------- */
const TFAV_KEY = 'anatoQuestTestFav_v1';
function tfavAll() { try { return JSON.parse(localStorage.getItem(TFAV_KEY) || '{}'); } catch (e) { return {}; } }
function tfavList(test) { const a = tfavAll()[(getActiveProfile() || '') + '::' + test]; return Array.isArray(a) ? a : []; }
function tfavHas(test, i) { return tfavList(test).includes(i); }
function tfavToggle(test, i) { try { const a = tfavAll(), k = (getActiveProfile() || '') + '::' + test, l = tfavList(test);
  a[k] = l.includes(i) ? l.filter(x => x !== i) : l.concat(i); localStorage.setItem(TFAV_KEY, JSON.stringify(a)); } catch (e) {} render(); }
function tfavStar(test, i) { const on = tfavHas(test, i);
  return `<button class="tfav-star ${on ? 'on' : ''}" onclick="tfavToggle('${test}', ${i})" title="${on ? 'Убрать из избранного' : 'В избранное'}" aria-label="В избранное">${on ? '★' : '☆'}</button>`; }
function tfavCard(test, onclick) { const n = tfavList(test).length;
  return `<div class="mode-card" ${n ? `onclick="${onclick}"` : 'style="opacity:.55;cursor:default"'}><div class="mode-emoji">⭐</div>
    <div class="mode-body"><div class="mode-title">Избранное (${n})</div><div class="mode-desc">${n ? 'Вопросы, отмеченные звёздочкой' : 'Отмечай вопросы звёздочкой ☆ во время теста — они соберутся здесь'}</div></div></div>`; }

/* ===================== ТЕСТ ОБЗОРА: АРТРОЛОГИЯ ===================== */
const OTEST = [{"q": "Укажите, какие виды соединения костей относятся к непрерывным", "o": [["синдесмозы", 1], ["швы", 1], ["вколачивания", 1], ["синхондрозы", 1], ["симфизы", 0]]}, {"q": "Укажите связки срединного атланто-осевого сустава", "o": [["крестообразная", 1], ["крыловидная", 1], ["связка верхушки зуба", 1], ["покровная мембрана", 1], ["желтая связка", 0]]}, {"q": "Назовите связки, которые соединяют дуги позвонков", "o": [["желтая связка", 1], ["передняя продольная связка", 0], ["задняя продольная связка", 0], ["выйная связка", 0], ["крыловидная связка", 0]]}, {"q": "Укажите форму грудино-ключичного сустава", "o": [["блоковидный", 0], ["седловидный", 1], ["мыщелковый", 0], ["шаровидный", 0], ["эллипсовидный", 0]]}, {"q": "Укажите, каким суставом является плечевой сустав", "o": [["простой", 1], ["сложный", 0], ["комплексный", 0], ["комбинированный", 0], ["многоосный", 1]]}, {"q": "Укажите форму лучезапястного сустава", "o": [["блоковидный", 0], ["седловидный", 0], ["мыщелковый", 0], ["эллипсовидный", 1], ["цилиндрический", 0]]}, {"q": "Перечислите кости и части костей, образующие большой таз", "o": [["ветви лобковых костей", 0], ["5 поясничный позвонок", 1], ["крестец", 0], ["крылья подвздошных костей", 1], ["ветвь седалищной кости", 0]]}, {"q": "Назовите, какие вспомогательные элементы сустава делят полость сустава на камеры (части, этажи и т.д.)", "o": [["диски", 1], ["мениски", 1], ["суставные губы", 0], ["суставные сумки", 0], ["связки", 0]]}, {"q": "Укажите связки крестцово-подвздошного сустава", "o": [["передняя крестцово-подвздошная", 1], ["задняя крестцово-подвздошная", 1], ["латеральная крестцово-подвздошная", 0], ["межкостная", 1], ["подвздошно-поясничная", 1]]}, {"q": "Укажите форму межфаланговых суставов стопы", "o": [["блоковидные", 1], ["мыщелковые", 0], ["седловидные", 0], ["шаровидные", 0], ["эллипсовидные", 0]]}, {"q": "Перечислите типы швов, соединяющие кости черепа", "o": [["зубчатый", 1], ["чешуйчатый", 1], ["плоский", 1], ["комбинированный", 0], ["комплексный", 0]]}, {"q": "Укажите форму срединного атланто-осевого сустава", "o": [["блоковидный", 0], ["цилиндрический", 1], ["эллипсовидный", 0], ["мыщелковый", 0], ["шаровидный", 0]]}, {"q": "Назовите, какие связки соединяют тела позвонков", "o": [["желтые", 0], ["передняя продольная", 1], ["задняя продольная", 1], ["выйная", 0], ["крыловидная", 0]]}, {"q": "Укажите, каким суставом является акромиально-ключичный сустав", "o": [["простой", 1], ["сложный", 0], ["комплексный", 0], ["комбинированный", 0], ["плоский", 1]]}, {"q": "Перечислите структуры, образующие малый таз", "o": [["крестец", 1], ["копчик", 1], ["ветви лобковых костей", 1], ["лобковый симфиз", 1], ["гребни подвздошных костей", 0]]}, {"q": "Охарактеризуйте таранно-пяточно-ладьевидный сустав", "o": [["простой", 0], ["сложный", 1], ["комплексный", 0], ["комбинированный", 0], ["одноосный", 0]]}, {"q": "Укажите внутрикапсульные связки тазобедренного сустава", "o": [["продольная связка вертлужной впадины", 0], ["поперечная связка вертлужной впадины", 1], ["связка головки бедренной кости", 1], ["круговая зона", 0], ["лобково-бедренная связка", 0]]}, {"q": "Перечислите симфизы тела человека", "o": [["межпозвоночный", 1], ["лобковый", 1], ["рукоятки грудины", 0], ["крестцовый", 0], ["копчиковый", 0]]}, {"q": "Укажите, к каким соединениям относятся межпозвоночные диски", "o": [["синдесмозы", 0], ["симфизы", 1], ["диартрозы", 0], ["синхондрозы", 1], ["синостозы", 0]]}, {"q": "Укажите связки локтевого сустава", "o": [["локтевая коллатеральная связка", 1], ["лучевая коллатеральная связка", 1], ["кольцевая связка лучевой кости", 1], ["кольцевая связка локтевой кости", 0], ["передняя коллатеральная связка", 0]]}, {"q": "Назовите движения, возможные во 2-5 пястно-фаланговых суставах", "o": [["сгибание-разгибание", 1], ["приведение-отведение", 1], ["вращение кнутри-кнаружи", 0], ["круговое движение", 1], ["все ответы верные", 0]]}, {"q": "Пограничная линия (верхняя апертура малого таза) образована", "o": [["дугообразная линия", 1], ["мыс", 1], ["верхний край лобкового симфиза", 1], ["лобковый гребень", 1], ["подвздошно-лобковое возвышение", 0]]}, {"q": "Укажите, каким суставом является голеностопный сустав", "o": [["простой", 0], ["сложный", 1], ["комплексный", 0], ["комбинированный", 0], ["одноосный", 1]]}, {"q": "Укажите внекапсульные (наружные) связки тазобедренного сустава", "o": [["подвздошно-бедренная", 1], ["поперечная связка вертлужной впадины", 0], ["лобково-бедренная", 1], ["седалищно-бедренная", 1], ["круговая зона", 1]]}, {"q": "Укажите форму межплюсневых суставов", "o": [["блоковидные", 0], ["мыщелковые", 0], ["седловидные", 0], ["плоские", 1], ["эллипсовидные", 0]]}, {"q": "Перечислите, чем образована нижняя апертура малого таза", "o": [["нижние края нижних ветвей лобковых костей", 1], ["нижние края ветвей седалищных костей", 1], ["седалищные бугры", 1], ["верхушка копчика", 1], ["вертлужная впадина", 0]]}, {"q": "Укажите, каким суставом является локтевой сустав", "o": [["простой", 0], ["сложный", 1], ["комплексный", 0], ["комбинированный", 0], ["многоосный", 0]]}, {"q": "Укажите внутрикапсульные связки коленного сустава", "o": [["передняя крестообразная", 1], ["задняя крестообразная", 1], ["латеральная крестообразная", 0], ["поперечная связка колена", 1], ["большеберцовая коллатеральная", 0]]}, {"q": "Назовите вспомогательные образования, присущие суставам", "o": [["суставные диски", 1], ["суставные мениски", 1], ["суставные губы", 1], ["суставные связки", 1], ["синовиальные сумки", 1]]}, {"q": "Укажите лордозы позвоночного столба", "o": [["шейный", 1], ["грудной", 0], ["поясничный", 1], ["крестцовый", 0], ["копчиковый", 0]]}, {"q": "Перечислите суставы верхней конечности, которые принимают участие в образовании комбинированного сустава", "o": [["плечевой", 0], ["плечелоктевой", 0], ["проксимальный лучелоктевой", 1], ["дистальный лучелоктевой", 1], ["лучезапястный", 0]]}, {"q": "Укажите, каким суставом является дистальный лучелоктевой сустав", "o": [["простой", 1], ["сложный", 0], ["комплексный", 0], ["комбинированный", 1], ["одноосный", 1]]}, {"q": "Укажите, чему равен межостный размер (distantia spinarum) большого таза", "o": [["21-23 см", 0], ["23-25 см", 0], ["25-27 см", 1], ["27-29 см", 0], ["30-32 см", 0]]}, {"q": "Укажите, каким суставом является тазобедренный сустав", "o": [["простой", 1], ["сложный", 0], ["комплексный", 0], ["комбинированный", 0], ["чашеобразный", 1]]}, {"q": "Укажите внекапсульные (наружные) связки коленного сустава", "o": [["большеберцовая коллатеральная", 1], ["малоберцовая коллатеральная", 1], ["связка надколенника", 1], ["косая подколенная связка", 1], ["передняя крестообразная", 0]]}, {"q": "Укажите форму таранно-пяточно-ладьевидного сустава", "o": [["блоковидный", 0], ["мыщелковый", 0], ["седловидный", 0], ["шаровидный", 1], ["эллипсовидный", 0]]}, {"q": "Укажите, чему равен межгребневый размер (distantia cristarum) большого таза", "o": [["27-29 см", 1], ["21-23 см", 0], ["23-25 см", 0], ["25-27 см", 0], ["30-32 см", 0]]}, {"q": "Укажите, каким суставом является крестцово-подвздошный сустав", "o": [["простой", 1], ["сложный", 0], ["комплексный", 0], ["комбинированный", 0], ["плоский", 1]]}, {"q": "Укажите, какие суставы верхней конечности относятся к сложным", "o": [["плечевой", 0], ["локтевой", 1], ["лучезапястный", 1], ["запястно-пястный сустав 1 пальца", 0]]}, {"q": "Укажите связки лучезапястного сустава", "o": [["лучевая коллатеральная связка запястья", 1], ["локтевая коллатеральная связка запястья", 1], ["ладонная лучезапястная связка", 1], ["тыльная лучезапястная связка", 1], ["лучистая связка", 0]]}, {"q": "Укажите, чему равен межвертельный размер (distantia trochanterica) большого таза", "o": [["21-23 см", 0], ["23-25 см", 0], ["25-27 см", 0], ["27-29 см", 0], ["30-32 см", 1]]}, {"q": "Укажите, чему равен прямой размер входа в малый таз", "o": [["10 см", 0], ["11 см", 1], ["12 см", 0], ["13 см", 0], ["14 см", 0]]}, {"q": "Укажите, какие суставы относятся к многоосным", "o": [["цилиндрический", 0], ["шаровидный", 1], ["блоковидный", 0], ["плоский", 1], ["эллипсовидный", 0]]}, {"q": "Укажите, какие суставы относятся к одноосным", "o": [["цилиндрический", 1], ["седловидный", 0], ["шаровидный", 0], ["блоковидный", 1], ["мыщелковый", 0]]}, {"q": "Охарактеризуйте запястно-пястный сустав 1 пальца", "o": [["простой", 1], ["сложный", 0], ["плоский", 0], ["комбинированный", 0], ["седловидный", 1]]}, {"q": "Назовите, какие суставы нижней конечности относятся к сложным", "o": [["крестцово-подвздошный", 0], ["тазобедренный", 0], ["коленный", 1], ["голеностопный", 1], ["межфаланговый", 0]]}, {"q": "Перечислите, какими суставами образован поперечный сустав предплюсны (Шопаров сустав)", "o": [["пяточно-кубовидный", 1], ["подтаранный", 0], ["таранно-ладьевидный", 1], ["таранно-пяточный", 0], ["голеностопный", 0]]}, {"q": "Укажите, какие суставы относятся к двуосным", "o": [["цилиндрический", 0], ["седловидный", 1], ["эллипсовидный", 1], ["мыщелковый", 1], ["шаровидный", 0]]}, {"q": "Перечислите основные признаки сустава", "o": [["суставная полость", 1], ["суставная связка", 0], ["суставные поверхности", 1], ["суставная капсула", 1], ["синовиальные сумки", 0]]}, {"q": "Перечислите собственные связки лопатки", "o": [["верхняя поперечная", 1], ["нижняя поперечная", 1], ["клювовидно-акромиальная", 1], ["клювовидно-ключичная", 0], ["акромиально-ключичная", 0]]}];
const OT_KEY = 'anatoQuestOTest_v1', OT_SHORT = 10, OT_FAIL = 3;
let OT = null;
function otStore() { try { return JSON.parse(localStorage.getItem(OT_KEY) || '{}'); } catch (e) { return {}; } }
function otWrong() { const a = otStore()[getActiveProfile() || ''] ; return Array.isArray(a) ? a : []; }
function otSetWrong(list) { try { const a = otStore(); a[getActiveProfile() || ''] = list; localStorage.setItem(OT_KEY, JSON.stringify(a)); } catch (e) {} }
function otText(q) { return q.q.replace(/^(Перечислите|Назовите|Охарактеризуйте)/, 'Укажите'); }
function otStart(kind, one) {
  let idx = OTEST.map((_, i) => i);
  if (kind === 'one') idx = [one];
  else if (kind === 'short') idx = thOrder('arthro', idx).slice(0, OT_SHORT);
  else if (kind === 'weak') idx = thOrder('arthro', otWrong().slice());
  else if (kind === 'fav') idx = thOrder('arthro', tfavList('arthro').slice());
  else idx = thOrder('arthro', idx);
  if (!idx.length) return;
  OT = { kind, k: 0, fails: 0, qs: idx.map(i => ({ i, opts: shuffleArr(OTEST[i].o.map(o => ({ t: o[0], ok: !!o[1] }))), sel: [], done: false, ok: false })) };
  goTo({ screen: 'otest' });
}
function otToggle(j) { const c = OT.qs[OT.k]; if (c.done) return; const p = c.sel.indexOf(j); if (p >= 0) c.sel.splice(p, 1); else c.sel.push(j); render(); }
function otCheck() {
  const c = OT.qs[OT.k]; if (!c.sel.length) return; c.done = true;
  c.ok = c.opts.every((o, j) => o.ok === c.sel.includes(j));
  if (!['weak', 'fav', 'one'].includes(OT.kind)) thPush('arthro', c.i, c.ok);
  let w = otWrong();
  if (!c.ok) { OT.fails++; if (!w.includes(c.i)) w.push(c.i); }
  else if (OT.kind === 'weak') w = w.filter(x => x !== c.i);
  otSetWrong(w); render();
}
function otFailed() { return OT.kind === 'short' && OT.fails >= OT_FAIL; }
function otNext() { if (OT.kind === 'one') { OT = null; goTo({ screen: 'tstat', test: 'arthro' }); window.scrollTo(0, 0); return; } if (otFailed() || OT.k + 1 >= OT.qs.length) { OT.end = true; render(); window.scrollTo(0, 0); return; } OT.k++; render(); window.scrollTo(0, 0); }
function renderOTestSetup() {
  const w = otWrong();
  let html = renderTopbar() + backRow('Карта тем', { screen: 'map' });
  html += `<div class="hub-header"><h1>🦴 Тест обзора: артрология</h1>
    <div class="hub-latin">${OTEST.length} вопросов теста кафедры. Отметь все верные варианты — засчитывается, только если выбраны все верные и ни одного лишнего.</div></div>
    <div class="mode-grid">
      <div class="mode-card" onclick="otStart('short')"><div class="mode-emoji">📝</div><div class="mode-body"><div class="mode-title">Как на опросе</div><div class="mode-desc">${OT_SHORT} случайных вопросов, 3 ошибки — не сдано</div></div></div>
      <div class="mode-card" onclick="otStart('all')"><div class="mode-emoji">📚</div><div class="mode-body"><div class="mode-title">Все вопросы</div><div class="mode-desc">Все ${OTEST.length} вопросов в случайном порядке</div></div></div>
      <div class="mode-card" ${w.length ? `onclick="otStart('weak')"` : 'style="opacity:.5;cursor:default"'}><div class="mode-emoji">🎯</div><div class="mode-body"><div class="mode-title">Работа над ошибками (${w.length})</div><div class="mode-desc">${w.length ? 'Вопросы, где ты ошибся; верный ответ убирает вопрос из списка' : 'Пока ошибок нет'}</div></div></div>
      ${tfavCard('arthro', "otStart('fav')")}
      ${thCard('arthro')}
    </div>`;
  document.getElementById('app').innerHTML = html;
}
function renderOTest() {
  if (!OT) return goTo({ screen: 'otestSetup' });
  if (OT.end) return renderOTestResult();
  const c = OT.qs[OT.k], q = OTEST[c.i], n = OT.qs.length;
  let html = renderTopbar() + `<div class="game-topbar">
    <button class="exit-x" onclick='OT=null; APP.goToJSON(${JSON.stringify(JSON.stringify(OT.kind === 'one' ? { screen: 'tstat', test: 'arthro' } : { screen: 'otestSetup' }))})'>✕</button>
    <div class="game-progress-bar"><div class="game-progress-fill" style="width:${Math.round(OT.k / n * 100)}%"></div></div>
    <div class="base-counter">${OT.k + 1}/${n}</div>${OT.kind === 'short' ? `<div class="lives-row">${[0, 1, 2].map(i => i < OT.fails ? '❌' : '⚪').join('')}</div>` : ''}</div>
    <div class="game-body"><div class="tfav-q"><div class="speed-prompt"><div class="sp-sub">ОТМЕТЬ ВСЕ ВЕРНЫЕ</div><div class="sp-main" style="font-size:19px">${escapeHtml(otText(q))}</div></div>${tfavStar('arthro', c.i)}</div><div class="speed-options">`;
  c.opts.forEach((o, j) => {
    const on = c.sel.includes(j); let cls = 'speed-opt', mark = on ? '☑' : '☐', tag = '';
    if (c.done) { if (o.ok && on) cls += ' opt-correct'; else if (o.ok) { cls += ' opt-correct'; tag = ' <i>— пропущен</i>'; mark = '☐'; } else if (on) { cls += ' opt-wrong'; tag = ' <i>— лишний</i>'; } }
    else if (on) cls += ' opt-selected';
    html += `<button class="${cls}" onclick="otToggle(${j})" ${c.done ? 'disabled' : ''}><span class="opt-checkbox">${mark}</span> ${escapeHtml(o.t)}${tag}</button>`;
  });
  html += `</div>`;
  if (!c.done) html += `<button class="btn btn-primary btn-block" style="margin-top:14px" onclick="otCheck()" ${c.sel.length ? '' : 'disabled'}>Проверить</button>`;
  else html += `<div class="base-answer ${c.ok ? 'ok' : 'bad'}"><div class="base-answer-head">${c.ok ? '✓ Верно' : '✗ Неверно'}</div>Верно: ${q.o.filter(o => o[1]).map(o => escapeHtml(o[0])).join(', ')}${thLine('arthro', c.i)}</div>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="otNext()">${OT.kind === 'one' ? '← К статистике' : otFailed() ? 'Итог: не сдано' : (OT.k + 1 < n ? 'Дальше' : 'Итоги')}</button>`;
  html += `</div>`;
  document.getElementById('app').innerHTML = html;
}
function renderOTestResult() {
  const ans = OT.qs.filter(c => c.done), okN = ans.filter(c => c.ok).length, bad = ans.filter(c => !c.ok);
  if (!OT.xp) { OT.xp = 1; addXp(okN * 2); }
  let html = renderTopbar() + `<div class="result-wrap" style="padding-bottom:10px"><div class="result-pct">${okN} / ${OT.qs.length}</div>
    ${OT.kind === 'short' ? `<h2 class="result-title">${OT.fails < OT_FAIL ? '✅ Сдано' : '❌ Не сдано — 3 ошибки'}</h2>` : ''}
    <div class="result-sub">+${okN * 2} XP</div></div><div class="game-body">`;
  if (bad.length) html += `<div class="mistakes-block" style="max-width:none"><div class="mistakes-title">Ошибки</div>${bad.map(c => { const q = OTEST[c.i]; return `<div class="mistake-row"><b>${escapeHtml(otText(q))}</b><div class="mistake-ru">Верно: ${q.o.filter(o => o[1]).map(o => escapeHtml(o[0])).join(', ')}</div></div>`; }).join('')}</div>`;
  else html += `<div class="mistakes-clean">Без ошибок!</div>`;
  const kind = OT.kind;
  html += `<div class="result-actions" style="max-width:none"><button class="btn btn-primary" onclick="otStart('${kind}')">Ещё раз</button>
    <button class="btn btn-ghost" onclick='OT=null; APP.goToJSON(${JSON.stringify(JSON.stringify({ screen: 'otestSetup' }))})'>К выбору режима</button></div></div>`;
  document.getElementById('app').innerHTML = html;
}

/* ===================== РЕГИСТРАЦИЯ МОДУЛЕЙ ===================== */
GAME_MODULES.picture = PictureGame;
GAME_MODULES.legend = LegendGame;
GAME_MODULES.base = BaseGame;
GAME_MODULES.truefalse = TrueFalseGame;
GAME_MODULES.builder = BuilderGame;
GAME_MODULES.speed = SpeedGame;
GAME_MODULES.exam = ExamGame;
GAME_MODULES.weakspots = WeakSpotsGame;

/* ===================== СТАРТ ===================== */
render();
