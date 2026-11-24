'use strict';

const MUSCLES = [
  {id: 'chest', label: '胸', view: 'front'},
  {id: 'delt_front', label: '三角筋前部', view: 'front'},
  {id: 'delt_side', label: '三角筋中部', view: 'front'},
  {id: 'delt_rear', label: '三角筋後部', view: 'back'},
  {id: 'biceps', label: '上腕二頭筋', view: 'front'},
  {id: 'triceps', label: '上腕三頭筋', view: 'back'},
  {id: 'forearm', label: '前腕', view: 'front'},
  {id: 'lats', label: '広背筋', view: 'back'},
  {id: 'traps', label: '僧帽筋', view: 'back'},
  {id: 'erectors', label: '脊柱起立筋', view: 'back'},
  {id: 'abs', label: '腹筋', view: 'front'},
  {id: 'quads', label: '大腿四頭筋', view: 'front'},
  {id: 'hams', label: 'ハムストリングス', view: 'back'},
  {id: 'glutes', label: '臀筋', view: 'back'},
  {id: 'calves', label: 'ふくらはぎ', view: 'back'}
];
const MUSCLE_IDS = new Set(MUSCLES.map(m => m.id));
const muscleLabel = id => MUSCLES.find(m => m.id === id)?.label || id;

const PART_DEFAULT_MUSCLES = {
  '胸': {primary: ['chest'], secondary: ['delt_front', 'triceps'], goalType: 'hypertrophy', repMin: 8, repMax: 10, step: 2.5},
  '背中': {primary: ['lats'], secondary: ['biceps', 'traps'], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2.5},
  '脚': {primary: ['quads', 'glutes'], secondary: ['hams'], goalType: 'hypertrophy', repMin: 8, repMax: 10, step: 2.5},
  '肩': {primary: ['delt_front', 'delt_side'], secondary: ['triceps'], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2},
  '腕': {primary: ['biceps'], secondary: ['forearm'], goalType: 'hypertrophy', repMin: 10, repMax: 12, step: 2},
  '腹': {primary: ['abs'], secondary: [], goalType: 'hypertrophy', repMin: 10, repMax: 15, step: 2.5},
  'その他': {primary: [], secondary: [], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2.5}
};

const CATALOG_PRESETS = {
  'ベンチプレス': {primary: ['chest'], secondary: ['delt_front', 'triceps'], goalType: 'strength', repMin: 3, repMax: 5, step: 2.5, defMode: 'normal'},
  'インクラインスミスベンチプレス': {primary: ['chest', 'delt_front'], secondary: ['triceps'], goalType: 'hypertrophy', repMin: 8, repMax: 10, step: 2.5, defMode: 'normal'},
  'ケーブルチェストプレス': {primary: ['chest'], secondary: ['delt_front', 'triceps'], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2.5, defMode: 'normal'},
  'ペックフライ': {primary: ['chest'], secondary: ['delt_front'], goalType: 'hypertrophy', repMin: 10, repMax: 12, step: 2.5, defMode: 'normal'},
  'ディップス': {primary: ['chest', 'triceps'], secondary: ['delt_front'], goalType: 'hypertrophy', repMin: 8, repMax: 10, step: 2.5, defMode: 'body'},
  'ダンベルショルダープレス': {primary: ['delt_front', 'delt_side'], secondary: ['triceps'], goalType: 'hypertrophy', repMin: 6, repMax: 10, step: 2, defMode: 'pair'},
  'ケーブルサイドレイズ': {primary: ['delt_side'], secondary: ['traps'], goalType: 'hypertrophy', repMin: 10, repMax: 15, step: 1, defMode: 'single'},
  'マシンショルダープレス': {primary: ['delt_front', 'delt_side'], secondary: ['triceps'], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2.5, defMode: 'normal'},
  'デッドリフト': {primary: ['erectors', 'hams', 'glutes'], secondary: ['lats', 'traps', 'forearm'], goalType: 'strength', repMin: 3, repMax: 5, step: 2.5, defMode: 'normal'},
  'ハーフデッドリフト': {primary: ['erectors', 'lats', 'traps'], secondary: ['glutes', 'hams', 'forearm'], goalType: 'strength', repMin: 5, repMax: 8, step: 2.5, defMode: 'normal'},
  'ラットプルダウン': {primary: ['lats'], secondary: ['biceps', 'delt_rear', 'forearm'], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2.5, defMode: 'normal'},
  'シーテッドロー': {primary: ['lats', 'traps'], secondary: ['delt_rear', 'biceps', 'erectors'], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2.5, defMode: 'normal'},
  'ダンベルロー': {primary: ['lats'], secondary: ['traps', 'delt_rear', 'biceps', 'forearm'], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2, defMode: 'single'},
  'チンニング': {primary: ['lats'], secondary: ['biceps', 'delt_rear', 'forearm'], goalType: 'hypertrophy', repMin: 6, repMax: 10, step: 2.5, defMode: 'body'},
  'インクラインダンベルカール': {primary: ['biceps'], secondary: ['forearm'], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2, defMode: 'pair'},
  'インクラインダンベルハンマーカール': {primary: ['biceps', 'forearm'], secondary: [], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2, defMode: 'pair'},
  'オーバーヘッドエクステンション': {primary: ['triceps'], secondary: [], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2, defMode: 'normal'},
  'EZバーカール': {primary: ['biceps'], secondary: ['forearm'], goalType: 'hypertrophy', repMin: 8, repMax: 12, step: 2.5, defMode: 'normal'},
  'ケーブルプレスダウン': {primary: ['triceps'], secondary: [], goalType: 'hypertrophy', repMin: 10, repMax: 12, step: 2.5, defMode: 'normal'},
  'ケーブルオーバーヘッドエクステンション': {primary: ['triceps'], secondary: [], goalType: 'hypertrophy', repMin: 10, repMax: 12, step: 2.5, defMode: 'normal'},
  'バーベルスクワット': {primary: ['quads', 'glutes'], secondary: ['hams', 'erectors'], goalType: 'strength', repMin: 5, repMax: 8, step: 2.5, defMode: 'normal'},
  'ブルガリアンスクワット': {primary: ['quads', 'glutes'], secondary: ['hams'], goalType: 'hypertrophy', repMin: 8, repMax: 10, step: 2, defMode: 'pair'},
  'ナローベンチプレス': {primary: ['triceps', 'chest'], secondary: ['delt_front'], goalType: 'strength', repMin: 5, repMax: 8, step: 2.5, defMode: 'normal'}
};

function defaultExMeta(exObj) {
  const p = CATALOG_PRESETS[exObj.name] || PART_DEFAULT_MUSCLES[exObj.part] || PART_DEFAULT_MUSCLES['その他'];
  return {
    primary: [...p.primary],
    secondary: [...p.secondary],
    goalType: p.goalType || 'hypertrophy',
    repMin: p.repMin || 8,
    repMax: p.repMax || 12,
    step: p.step || 2.5
  };
}

function ensureDb(target) {
  if (!target || typeof target !== 'object') return target;
  if (!Array.isArray(target.health)) target.health = [];
  if (!Array.isArray(target.templates)) target.templates = [];
  if (target.activePlan === undefined) target.activePlan = null;
  if (!target.coachDismissed || typeof target.coachDismissed !== 'object') target.coachDismissed = {};
  for (const e of target.exercises || []) {
    const def = defaultExMeta(e);
    if (!Array.isArray(e.primary)) e.primary = def.primary;
    else e.primary = e.primary.filter(m => MUSCLE_IDS.has(m));
    if (!Array.isArray(e.secondary)) e.secondary = def.secondary.filter(m => !e.primary.includes(m));
    else e.secondary = e.secondary.filter(m => MUSCLE_IDS.has(m) && !e.primary.includes(m));
    if (!['strength', 'hypertrophy'].includes(e.goalType)) e.goalType = def.goalType;
    if (!(typeof e.repMin === 'number' && e.repMin >= 1)) e.repMin = def.repMin;
    if (!(typeof e.repMax === 'number' && e.repMax >= e.repMin)) e.repMax = Math.max(e.repMin, def.repMax);
    if (!(typeof e.step === 'number' && e.step > 0)) e.step = def.step;
  }
  if (typeof ensureProgressDb === 'function') ensureProgressDb(target);
  return target;
}

function validExtendedBackup(d) {
  const safeId = s => typeof s === 'string' && /^[a-zA-Z0-9_-]+$/.test(s);
  const num = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  for (const e of d.exercises) {
    if (e.primary !== undefined && (!Array.isArray(e.primary) || !e.primary.every(m => MUSCLE_IDS.has(m)))) return false;
    if (e.secondary !== undefined && (!Array.isArray(e.secondary) || !e.secondary.every(m => MUSCLE_IDS.has(m)))) return false;
    if (e.goalType !== undefined && !['strength', 'hypertrophy'].includes(e.goalType)) return false;
    if (e.repMin !== undefined && (!Number.isInteger(e.repMin) || e.repMin < 1 || e.repMin > 100)) return false;
    if (e.repMax !== undefined && (!Number.isInteger(e.repMax) || e.repMax < 1 || e.repMax > 100)) return false;
    if (e.step !== undefined && (!num(e.step) || e.step <= 0 || e.step > 100)) return false;
  }
  for (const s of d.sets) {
    if (s.tag !== undefined && !['work', 'warmup', 'drop', 'max'].includes(s.tag)) return false;
    if (s.rir !== undefined && s.rir !== null && (!num(s.rir) || s.rir > 10)) return false;
    if (s.cond !== undefined && s.cond !== null && !['ok', 'fatigue', 'pain'].includes(s.cond)) return false;
  }
  if (d.templates !== undefined) {
    if (!Array.isArray(d.templates)) return false;
    for (const tpl of d.templates) {
      if (!tpl || !safeId(tpl.id) || typeof tpl.name !== 'string' || !tpl.name.trim() || !Array.isArray(tpl.items)) return false;
      for (const it of tpl.items) {
        if (!it || !safeId(it.id) || !d.exercises.some(e => e.id === it.e) || !num(it.w) ||
            !Number.isInteger(it.reps) || it.reps < 1 || !Number.isInteger(it.sets) || it.sets < 1 || it.sets > 50 ||
            !['normal', 'pair', 'single', 'body'].includes(it.mode || 'normal') || !num(it.rest ?? 180)) return false;
      }
    }
  }
  if (typeof validProgressBackup === 'function' && !validProgressBackup(d)) return false;
  return true;
}

// ============================================================================
// 1位：トレーニングメニューテンプレート & 予定/実績分離セッション
// ============================================================================
let tplEditingId = null;
let tplDraft = null;
let showTplManager = false;
let planFinishPrompt = false;

function lastAchievementFor(exId) {
  const work = db.sets.filter(s => s.e === exId && (s.tag || 'work') === 'work');
  const pool = work.length ? work : db.sets.filter(s => s.e === exId);
  if (!pool.length) {
    const preset = CATALOG_PRESETS[name(exId)];
    const e = ex(exId);
    return {w: 0, reps: e?.repMin || 8, sets: 3, mode: preset?.defMode || 'normal', rest: db.rest || 180, hasHistory: false};
  }
  const latestDate = [...new Set(pool.map(s => s.date))].sort().at(-1);
  const daySets = pool.filter(s => s.date === latestDate);
  const top = daySets[0];
  return {
    w: top.w,
    reps: top.reps,
    sets: Math.min(20, Math.max(1, daySets.length)),
    mode: top.mode || 'normal',
    rest: top.rest ?? db.rest ?? 180,
    date: latestDate,
    hasHistory: true
  };
}

function openTemplateManager(editTplId = null) {
  showTplManager = true;
  if (editTplId === 'new') {
    const firstEx = db.exercises[0]?.id || 'e0';
    const init = lastAchievementFor(firstEx);
    tplEditingId = 'new';
    tplDraft = {
      id: uid(),
      name: '',
      items: [{id: uid(), e: firstEx, w: init.w, reps: init.reps, sets: init.sets, mode: init.mode, rest: init.rest}]
    };
  } else if (editTplId) {
    const found = db.templates.find(t => t.id === editTplId);
    if (found) {
      tplEditingId = found.id;
      tplDraft = JSON.parse(JSON.stringify(found));
    }
  } else {
    tplEditingId = null;
    tplDraft = null;
  }
  render();
}

function closeTemplateManager() {
  showTplManager = false;
  tplEditingId = null;
  tplDraft = null;
  render();
}

function syncTplDraftFromDOM() {
  if (!tplDraft) return;
  const nameInput = $('tpl-name');
  if (nameInput) tplDraft.name = nameInput.value;
  tplDraft.items.forEach((it, idx) => {
    const elE = $('ti-e-' + idx), elW = $('ti-w-' + idx), elR = $('ti-r-' + idx), elS = $('ti-s-' + idx), elM = $('ti-m-' + idx), elRest = $('ti-rest-' + idx);
    if (elE) it.e = elE.value;
    if (elW) it.w = Math.max(0, +elW.value || 0);
    if (elR) it.reps = Math.max(1, Math.round(+elR.value || 1));
    if (elS) it.sets = Math.min(50, Math.max(1, Math.round(+elS.value || 1)));
    if (elM) it.mode = elM.value;
    if (elRest) it.rest = Math.min(3600, Math.max(0, Math.round(+elRest.value || 0)));
  });
}

function tplAddItem() {
  syncTplDraftFromDOM();
  const exId = db.exercises[0]?.id || 'e0';
  const init = lastAchievementFor(exId);
  tplDraft.items.push({id: uid(), e: exId, w: init.w, reps: init.reps, sets: init.sets, mode: init.mode, rest: init.rest});
  render();
}

function tplRemoveItem(idx) {
  syncTplDraftFromDOM();
  tplDraft.items.splice(idx, 1);
  render();
}

function tplMoveItem(idx, dir) {
  syncTplDraftFromDOM();
  const target = idx + dir;
  if (target < 0 || target >= tplDraft.items.length) return;
  [tplDraft.items[idx], tplDraft.items[target]] = [tplDraft.items[target], tplDraft.items[idx]];
  render();
}

function tplFillItemFromLast(idx) {
  syncTplDraftFromDOM();
  const it = tplDraft.items[idx];
  if (!it) return;
  const last = lastAchievementFor(it.e);
  Object.assign(it, {w: last.w, reps: last.reps, sets: last.sets, mode: last.mode, rest: last.rest});
  render();
  toast(last.hasHistory ? `${last.date} の実績を反映しました` : '初期値をセットしました（過去記録なし）');
}

function tplSaveDraft(ev) {
  ev.preventDefault();
  syncTplDraftFromDOM();
  const cleanName = (tplDraft?.name || '').trim();
  if (!cleanName) { toast('メニュー名を入力してください'); return; }
  if (!tplDraft.items.length) { toast('種目を1つ以上追加してください'); return; }
  const saved = {...tplDraft, name: cleanName};
  const idx = db.templates.findIndex(t => t.id === saved.id);
  if (idx >= 0) db.templates[idx] = saved;
  else db.templates.push(saved);
  tplEditingId = null;
  tplDraft = null;
  save();
  render();
  toast('メニューを保存しました');
}

function duplicateTemplate(id) {
  const orig = db.templates.find(t => t.id === id);
  if (!orig) return;
  const copy = JSON.parse(JSON.stringify(orig));
  copy.id = uid();
  copy.name = orig.name + '（コピー）';
  copy.items.forEach(it => it.id = uid());
  db.templates.push(copy);
  save();
  render();
  toast('メニューを複製しました');
}

function renameTemplatePrompt(id) {
  const orig = db.templates.find(t => t.id === id);
  if (!orig) return;
  const next = prompt('新しいメニュー名を入力してください', orig.name);
  if (next && next.trim()) {
    orig.name = next.trim();
    save();
    render();
    toast('名称を変更しました');
  }
}

function deleteTemplate(id) {
  const orig = db.templates.find(t => t.id === id);
  if (!orig || !confirm(`メニュー「${orig.name}」を削除しますか？`)) return;
  db.templates = db.templates.filter(t => t.id !== id);
  save();
  render();
  toast('削除しました');
}

function saveDayAsTemplate(d) {
  const daySets = byDate(d).filter(s => (s.tag || 'work') !== 'warmup');
  const source = daySets.length ? daySets : byDate(d);
  if (!source.length) { toast('この日の記録がありません'); return; }
  const partLabel = [...new Set(source.map(s => ex(s.e)?.part).filter(Boolean))].join('・') || d;
  const tplName = prompt('保存するメニュー名を入力してください', `${partLabel}メニュー`);
  if (!tplName || !tplName.trim()) return;
  const groups = [];
  for (const s of source) {
    const last = groups.at(-1);
    if (last && last.e === s.e && last.mode === s.mode) {
      last.sets++;
    } else {
      groups.push({id: uid(), e: s.e, w: s.w, reps: s.reps, sets: 1, mode: s.mode || 'normal', rest: s.rest ?? db.rest ?? 180});
    }
  }
  db.templates.push({id: uid(), name: tplName.trim(), items: groups});
  save();
  render();
  toast(`「${tplName.trim()}」をテンプレート保存しました`);
}

function startFromTemplate(tplId, targetDate = today()) {
  const tpl = db.templates.find(t => t.id === tplId);
  if (!tpl) return;
  if (db.activePlan && db.activePlan.blocks.some(b => b.rows.some(r => !r.done))) {
    if (!confirm('展開中の未完了メニューがあります。新しいメニューで置き換えますか？（完了済みの記録は残ります）')) return;
  }
  date = targetDate;
  db.activePlan = {
    id: uid(),
    date: targetDate,
    templateId: tpl.id,
    templateName: tpl.name,
    blocks: tpl.items.map(it => ({
      id: uid(),
      e: it.e,
      mode: it.mode || 'normal',
      rest: it.rest ?? db.rest ?? 180,
      rows: Array.from({length: it.sets}, () => ({
        id: uid(),
        w: it.w,
        reps: it.reps,
        rir: '',
        tag: 'work',
        done: false,
        setId: null
      }))
    }))
  };
  if (tpl.items[0]) exercise = tpl.items[0].e;
  planFinishPrompt = false;
  showTplManager = false;
  tab = 'log';
  save();
  render();
  window.scrollTo(0, 0);
  toast(`「${tpl.name}」を展開しました`);
}

function syncPlanInputsFromDOM() {
  const plan = db.activePlan;
  if (!plan) return;
  for (const b of plan.blocks) {
    const restEl = $('pb-rest-' + b.id), modeEl = $('pb-mode-' + b.id);
    if (restEl) b.rest = Math.min(3600, Math.max(0, Math.round(+restEl.value || 0)));
    if (modeEl) b.mode = modeEl.value;
    for (const r of b.rows) {
      if (r.done) continue;
      const wEl = $('pr-w-' + r.id), rEl = $('pr-r-' + r.id), rirEl = $('pr-rir-' + r.id), tagEl = $('pr-tag-' + r.id);
      if (wEl) r.w = Math.max(0, +wEl.value || 0);
      if (rEl) r.reps = Math.max(1, Math.round(+rEl.value || 1));
      if (rirEl) r.rir = rirEl.value;
      if (tagEl) r.tag = tagEl.value;
    }
  }
}

function completePlanRow(blockId, rowId) {
  syncPlanInputsFromDOM();
  const plan = db.activePlan;
  if (!plan) return;
  const block = plan.blocks.find(b => b.id === blockId);
  const idx = block?.rows.findIndex(r => r.id === rowId) ?? -1;
  if (!block || idx < 0) return;
  const row = block.rows[idx];
  if (row.done) return;
  const w = +row.w, reps = Math.round(+row.reps), mode = block.mode || 'normal', rest = block.rest ?? db.rest ?? 180;
  if (!Number.isFinite(w) || w < 0 || !Number.isInteger(reps) || reps < 1) {
    toast('重量と回数を確認してください');
    return;
  }
  const rirVal = row.rir === '' || row.rir == null ? undefined : +row.rir;
  const tagVal = row.tag || 'work';
  const prior = [...db.sets];
  const pr = tagVal !== 'warmup' ? evaluatePR(prior, block.e, w, reps, mode, plan.date, 1) : null;
  const newSet = {
    id: uid(),
    date: plan.date,
    e: block.e,
    w,
    reps,
    mode,
    note: '',
    rest,
    tag: tagVal,
    sessionId: plan.id,
    sessionName: plan.templateName,
    ...(plan.templateId ? {templateId: plan.templateId} : {}),
    ...(plan.date === today() ? {at: new Date().toISOString()} : {})
  };
  if (rirVal !== undefined && Number.isFinite(rirVal)) newSet.rir = rirVal;
  db.sets.push(newSet);
  row.done = true;
  row.setId = newSet.id;
  if (typeof syncUnlockedAchievements === 'function') syncUnlockedAchievements(db, true);
  // 次セットへ入力値を引き継ぎ
  const nextRow = block.rows.slice(idx + 1).find(r => !r.done);
  if (nextRow) {
    nextRow.w = w;
    nextRow.reps = reps;
  }
  exercise = block.e;
  save();
  render();
  if (pr) celebratePR(pr);
  else toast(`${name(block.e)} ${idx + 1}セット目を記録しました`);
  if (rest > 0 && plan.date === today()) startTimer(rest);
}

function undoPlanRow(blockId, rowId) {
  syncPlanInputsFromDOM();
  const plan = db.activePlan;
  const block = plan?.blocks.find(b => b.id === blockId);
  const row = block?.rows.find(r => r.id === rowId);
  if (!row || !row.done) return;
  if (row.setId) db.sets = db.sets.filter(s => s.id !== row.setId);
  row.done = false;
  row.setId = null;
  if (typeof syncUnlockedAchievements === 'function') syncUnlockedAchievements(db, false);
  save();
  render();
  toast('完了を取り消しました');
}

function planMoveBlock(idx, dir) {
  syncPlanInputsFromDOM();
  const blocks = db.activePlan?.blocks;
  if (!blocks) return;
  const t = idx + dir;
  if (t < 0 || t >= blocks.length) return;
  [blocks[idx], blocks[t]] = [blocks[t], blocks[idx]];
  save();
  render();
}

function planAddRow(blockId) {
  syncPlanInputsFromDOM();
  const block = db.activePlan?.blocks.find(b => b.id === blockId);
  if (!block || block.rows.length >= 50) return;
  const ref = block.rows.at(-1) || {w: 0, reps: 8};
  block.rows.push({id: uid(), w: ref.w, reps: ref.reps, rir: '', tag: 'work', done: false, setId: null});
  save();
  render();
}

function planRemoveRow(blockId, rowId) {
  syncPlanInputsFromDOM();
  const block = db.activePlan?.blocks.find(b => b.id === blockId);
  if (!block) return;
  block.rows = block.rows.filter(r => r.id !== rowId);
  if (!block.rows.length) db.activePlan.blocks = db.activePlan.blocks.filter(b => b.id !== blockId);
  save();
  render();
}

function planAddExercise() {
  syncPlanInputsFromDOM();
  const sel = $('plan-add-ex');
  const exId = sel ? sel.value : exercise;
  if (!db.activePlan || !exId) return;
  const init = lastAchievementFor(exId);
  db.activePlan.blocks.push({
    id: uid(),
    e: exId,
    mode: init.mode,
    rest: init.rest,
    rows: Array.from({length: init.sets}, () => ({id: uid(), w: init.w, reps: init.reps, rir: '', tag: 'work', done: false, setId: null}))
  });
  save();
  render();
  toast(`${name(exId)} をメニューに追加しました`);
}

function finishActivePlan(updateTemplate) {
  syncPlanInputsFromDOM();
  const plan = db.activePlan;
  if (!plan) return;
  if (updateTemplate && plan.templateId) {
    const tpl = db.templates.find(t => t.id === plan.templateId);
    if (tpl) {
      const updatedItems = plan.blocks.map(b => {
        const doneRows = b.rows.filter(r => r.done && (r.tag || 'work') !== 'warmup');
        const basis = doneRows.length ? doneRows : b.rows;
        const ref = basis[0] || {w: 0, reps: 8};
        return {
          id: uid(),
          e: b.e,
          w: +ref.w || 0,
          reps: Math.max(1, Math.round(+ref.reps || 8)),
          sets: doneRows.length ? doneRows.length : basis.length,
          mode: b.mode || 'normal',
          rest: b.rest ?? db.rest ?? 180
        };
      }).filter(it => it.sets > 0);
      if (updatedItems.length) tpl.items = updatedItems;
    }
  }
  const finishedKey = `${plan.date}::${plan.id}`;
  const hadDone = plan.blocks.some(b => b.rows.some(r => r.done));
  db.activePlan = null;
  planFinishPrompt = false;
  save();
  if (hadDone && typeof openWorkoutComplete === 'function') openWorkoutComplete(finishedKey);
  else render();
  toast(updateTemplate ? '実績をテンプレートへ反映して終了しました' : 'メニューを終了しました（未実施セットは除外）');
}

function renderHomeTemplatesSection() {
  const active = db.activePlan;
  return `<section>
    <div class="sec-head"><h3>メニューから開始</h3><button class="secondary sm-btn" onclick="openTemplateManager()">メニュー管理</button></div>
    ${active ? `<div class="plan-banner">
      <div><strong>展開中：${esc(active.templateName)}</strong><br><small>${esc(active.date)} / 完了 ${active.blocks.reduce((a,b)=>a+b.rows.filter(r=>r.done).length,0)} / ${active.blocks.reduce((a,b)=>a+b.rows.length,0)} セット</small></div>
      <button onclick="date='${esc(active.date)}';go('log')">再開する</button>
    </div>` : ''}
    ${db.templates.length ? `<div class="tpl-list">${db.templates.map(t => `<div class="tpl-card">
      <div class="tpl-info">
        <strong>${esc(t.name)}</strong>
        <small>${t.items.map(it => `${esc(name(it.e))} ${it.mode==='body'?(it.w?`+${fmt(it.w)}kg`:'自重'):`${fmt(it.w)}kg`}×${it.reps}×${it.sets}`).join(' / ')}</small>
      </div>
      <button onclick="startFromTemplate('${esc(t.id)}')">開始</button>
    </div>`).join('')}</div>` : `<p class="muted">定番メニュー（胸・肩、背中、脚など）を登録しておくと、1タップで当日の予定セットを展開できます。過去の記録からも作成可能です。</p><button class="secondary full" onclick="openTemplateManager('new')">＋ 最初のメニューを作成</button>`}
    ${showTplManager ? renderTemplateManagerModal() : ''}
  </section>`;
}

function renderTemplateManagerModal() {
  if (tplDraft) {
    return `<div class="sub-box">
      <h4>${tplEditingId === 'new' ? '新規メニュー作成' : 'メニューを編集'}</h4>
      <form onsubmit="tplSaveDraft(event)">
        <label>メニュー名<input id="tpl-name" required maxlength="60" placeholder="例：胸・肩の日" value="${esc(tplDraft.name)}"></label>
        ${tplDraft.items.map((it, idx) => `<div class="tpl-edit-item">
          <div class="row" style="justify-content:space-between">
            <strong>#${idx + 1}</strong>
            <div class="btn-group">
              <button type="button" class="secondary sm-btn" onclick="tplFillItemFromLast(${idx})">前回実績を呼出</button>
              <button type="button" class="secondary sm-btn" onclick="tplMoveItem(${idx},-1)" ${idx===0?'disabled':''}>↑</button>
              <button type="button" class="secondary sm-btn" onclick="tplMoveItem(${idx},1)" ${idx===tplDraft.items.length-1?'disabled':''}>↓</button>
              <button type="button" class="danger sm-btn" onclick="tplRemoveItem(${idx})" ${tplDraft.items.length===1?'disabled':''}>削除</button>
            </div>
          </div>
          <label>種目<select id="ti-e-${idx}" onchange="syncTplDraftFromDOM();render()">${db.exercises.map(e => `<option value="${esc(e.id)}" ${e.id===it.e?'selected':''}>${esc(e.name)}（${esc(e.part)}）</option>`).join('')}</select></label>
          <div class="grid">
            <label>予定重量 kg<input id="ti-w-${idx}" type="number" min="0" step="0.01" value="${it.w}"></label>
            <label>予定回数<input id="ti-r-${idx}" type="number" min="1" max="1000" value="${it.reps}"></label>
            <label>セット数<input id="ti-s-${idx}" type="number" min="1" max="50" value="${it.sets}"></label>
            <label>重量の種類<select id="ti-m-${idx}">${[['normal','合計重量'],['pair','左右各重量'],['single','片側重量'],['body','自重＋追加重量']].map(([v,l])=>`<option value="${v}" ${v===it.mode?'selected':''}>${l}</option>`).join('')}</select></label>
          </div>
          <label>休憩（秒）<input id="ti-rest-${idx}" type="number" min="0" max="3600" value="${it.rest ?? 180}"></label>
        </div>`).join('')}
        <button type="button" class="secondary full" onclick="tplAddItem()">＋ 種目を追加</button>
        <button class="full">メニューを保存</button>
        <button type="button" class="secondary full" onclick="tplEditingId=null;tplDraft=null;render()">一覧へ戻る</button>
      </form>
    </div>`;
  }
  return `<div class="sub-box">
    <div class="sec-head"><h4>メニューテンプレート管理</h4><button class="secondary sm-btn" onclick="closeTemplateManager()">閉じる</button></div>
    <button class="full" onclick="openTemplateManager('new')">＋ 新しいメニューを作成</button>
    ${db.templates.map(t => `<div class="entry">
      <div><strong>${esc(t.name)}</strong><br><small>${t.items.length}種目 / 計${t.items.reduce((a,i)=>a+i.sets,0)}セット</small></div>
      <button class="secondary" onclick="openTemplateManager('${esc(t.id)}')">編集</button>
      <button class="secondary" onclick="renameTemplatePrompt('${esc(t.id)}')">名変</button>
      <button class="secondary" onclick="duplicateTemplate('${esc(t.id)}')">複製</button>
      <button class="danger" onclick="deleteTemplate('${esc(t.id)}')">削除</button>
    </div>`).join('') || '<p class="muted">登録されたメニューはまだありません。</p>'}
  </div>`;
}

function renderActivePlanSection() {
  const plan = db.activePlan;
  if (!plan || plan.date !== date) {
    if (!db.templates.length) return '';
    return `<section class="compact-sec">
      <div class="sec-head"><small>メニューから予定を展開（未実施分は集計されません）</small></div>
      <div class="row">
        <select id="log-tpl-pick">${db.templates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}（${t.items.length}種目）</option>`).join('')}</select>
        <button class="secondary" style="flex:0 0 auto" onclick="startFromTemplate($('log-tpl-pick').value, date)">展開</button>
      </div>
    </section>`;
  }
  const totalRows = plan.blocks.reduce((a, b) => a + b.rows.length, 0);
  const doneRows = plan.blocks.reduce((a, b) => a + b.rows.filter(r => r.done).length, 0);
  const hasOriginTpl = db.templates.some(t => t.id === plan.templateId);
  return `<section class="plan-sec">
    <div class="sec-head">
      <div><span class="tag">MENU SESSION</span><h3 style="margin:2px 0 0">${esc(plan.templateName)}</h3></div>
      <small>${doneRows} / ${totalRows} 完了</small>
    </div>
    ${progress(doneRows, Math.max(1, totalRows))}
    <small class="muted" style="display:block;margin-top:6px">完了ボタンを押したセットのみ実績として記録・集計されます。</small>
    ${plan.blocks.map((b, bIdx) => {
      const adv = getCoachAdvice(b.e, plan.date);
      return `<div class="plan-block">
        <div class="sec-head">
          <strong onclick="exercise='${esc(b.e)}';render()" style="cursor:pointer">${bIdx + 1}. ${esc(name(b.e))}</strong>
          <div class="btn-group">
            <button type="button" class="secondary sm-btn" onclick="planMoveBlock(${bIdx},-1)" ${bIdx===0?'disabled':''}>↑</button>
            <button type="button" class="secondary sm-btn" onclick="planMoveBlock(${bIdx},1)" ${bIdx===plan.blocks.length-1?'disabled':''}>↓</button>
          </div>
        </div>
        ${adv.status === 'ready' && !isCoachDismissed(b.e, plan.date) ? `<div class="coach-inline">
          <small>💡 推奨：<strong>${esc(adv.headline)}</strong>（${esc(adv.shortReason)}）</small>
          <button type="button" class="secondary sm-btn" onclick="applyCoachToPlanBlock('${esc(b.id)}','${esc(b.e)}')">予定に反映</button>
        </div>` : ''}
        <div class="plan-meta-row">
          <select id="pb-mode-${b.id}" onchange="syncPlanInputsFromDOM()">${[['normal','合計'],['pair','左右各'],['single','片側'],['body','自重＋']].map(([v,l])=>`<option value="${v}" ${v===b.mode?'selected':''}>${l}</option>`).join('')}</select>
          <label class="inline-lbl">休憩秒<input id="pb-rest-${b.id}" type="number" min="0" max="3600" value="${b.rest ?? 180}" onchange="syncPlanInputsFromDOM()"></label>
        </div>
        ${b.rows.map((r, rIdx) => r.done ? `<div class="plan-row done">
          <span class="plan-idx">✓#${rIdx + 1}</span>
          <span class="plan-done-txt">${b.mode==='body'?'自重＋':''}${fmt(r.w)}kg × ${r.reps}回${r.rir!==''&&r.rir!=null?` (RIR${r.rir})`:''}${r.tag&&r.tag!=='work'?` [${ ({warmup:'アップ',drop:'ドロップ',max:'MAX'})[r.tag] }]`:''}</span>
          <button type="button" class="secondary sm-btn" onclick="undoPlanRow('${esc(b.id)}','${esc(r.id)}')">取消</button>
        </div>` : `<div class="plan-row">
          <span class="plan-idx">#${rIdx + 1}</span>
          <input id="pr-w-${r.id}" type="number" min="0" step="0.01" value="${r.w}" aria-label="重量kg">
          <span class="unit-x">kg×</span>
          <input id="pr-r-${r.id}" type="number" min="1" max="1000" value="${r.reps}" aria-label="回数">
          <select id="pr-rir-${r.id}" aria-label="RIR"><option value="" ${r.rir===''?'selected':''}>RIR</option>${[0,1,2,3,4].map(v=>`<option value="${v}" ${String(r.rir)===String(v)?'selected':''}>残${v}</option>`).join('')}</select>
          <select id="pr-tag-${r.id}" aria-label="種別">${[['work','通常'],['warmup','アップ'],['drop','ドロップ'],['max','MAX']].map(([v,l])=>`<option value="${v}" ${v===(r.tag||'work')?'selected':''}>${l}</option>`).join('')}</select>
          <button type="button" class="sm-btn" onclick="completePlanRow('${esc(b.id)}','${esc(r.id)}')">完了</button>
          <button type="button" class="danger sm-btn" onclick="planRemoveRow('${esc(b.id)}','${esc(r.id)}')">×</button>
        </div>`).join('')}
        <button type="button" class="secondary sm-btn" style="margin-top:6px" onclick="planAddRow('${esc(b.id)}')">＋ セット追加</button>
      </div>`;
    }).join('')}
    <div class="row" style="margin-top:10px">
      <select id="plan-add-ex">${db.exercises.map(e => `<option value="${esc(e.id)}" ${e.id===exercise?'selected':''}>${esc(e.name)}</option>`).join('')}</select>
      <button type="button" class="secondary" style="flex:0 0 auto" onclick="planAddExercise()">＋ 種目追加</button>
    </div>
    ${planFinishPrompt ? `<div class="sub-box" style="margin-top:10px">
      <strong>メニューを終了しますか？</strong>
      <p class="muted" style="margin:6px 0">今回の実施重量・回数・セット数を元のテンプレート「${esc(plan.templateName)}」へ反映するか選べます（自動上書きはしません）。</p>
      ${hasOriginTpl && doneRows > 0 ? `<button type="button" class="full" onclick="finishActivePlan(true)">実績をテンプレートに反映して終了</button>` : ''}
      <button type="button" class="secondary full" onclick="finishActivePlan(false)">テンプレートを変更せず終了</button>
      <button type="button" class="secondary full" onclick="planFinishPrompt=false;render()">キャンセル</button>
    </div>` : `<button type="button" class="secondary full" onclick="syncPlanInputsFromDOM();planFinishPrompt=true;render()">メニューセッションを終了</button>`}
  </section>`;
}

// ============================================================================
// 2位：次回の推奨重量・回数（PERSONAL COACH）
// ============================================================================
let showCoachConfig = false;

function roundToStep(val, step) {
  const s = step > 0 ? step : 2.5;
  return Math.round(Math.round(val / s) * s * 100) / 100;
}

function isWorkingSet(s) {
  if (s.tag) return s.tag === 'work';
  const n = s.note || '';
  if (/アップ|ウォームアップ|warmup/i.test(n)) return false;
  if (/ドロップ|drop/i.test(n)) return false;
  return true;
}

function hasPainSignal(sets) {
  return sets.some(s => s.cond === 'pain' || /痛|違和感|怪我/.test(s.note || ''));
}

function hasFatigueSignal(sets) {
  return sets.some(s => s.cond === 'fatigue' || /疲労|重すぎ|バテ/.test(s.note || ''));
}

function isCoachDismissed(exId, d) {
  return db.coachDismissed?.[exId] === d;
}

function dismissCoach(exId, d) {
  db.coachDismissed[exId] = d;
  save();
  render();
}

function restoreCoach(exId) {
  delete db.coachDismissed[exId];
  save();
  render();
}

function getCoachAdvice(exId, asOfDate = date) {
  const e = ex(exId);
  if (!e) return {status: 'insufficient', reason: '種目が見つかりません。'};
  const repMin = e.repMin || 8, repMax = e.repMax || 12, step = e.step || 2.5;
  const allExSets = db.sets.filter(s => s.e === exId);
  const pastWork = allExSets.filter(s => s.date < asOfDate && isWorkingSet(s));
  const fallbackWork = pastWork.length ? pastWork : allExSets.filter(s => isWorkingSet(s));
  const sessionDates = [...new Set(fallbackWork.map(s => s.date))].sort();
  if (!sessionDates.length) {
    return {
      status: 'insufficient',
      exId,
      repMin,
      repMax,
      step,
      reason: '通常セットの実績がまだないため提案を保留しています。1回以上記録すると次回目安を算出します。'
    };
  }
  const sessions = sessionDates.slice(-4).map(d => {
    const sets = fallbackWork.filter(s => s.date === d);
    const maxW = Math.max(...sets.map(s => s.w));
    const mainSets = sets.filter(s => s.w === maxW);
    const rirs = mainSets.map(s => s.rir).filter(v => typeof v === 'number' && Number.isFinite(v));
    const bestEpley = Math.max(...sets.map(est));
    return {
      date: d,
      sets,
      mainSets,
      w: maxW,
      mode: mainSets[0]?.mode || 'normal',
      nSets: Math.min(8, Math.max(1, mainSets.length)),
      minReps: Math.min(...mainSets.map(s => s.reps)),
      maxReps: Math.max(...mainSets.map(s => s.reps)),
      avgRir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null,
      minRir: rirs.length ? Math.min(...rirs) : null,
      pain: hasPainSignal(sets),
      fatigue: hasFatigueSignal(sets),
      bestEpley
    };
  });

  const last = sessions.at(-1);
  const prev1 = sessions.length >= 2 ? sessions.at(-2) : null;
  const prev2 = sessions.length >= 3 ? sessions.at(-3) : null;
  const twoDrop = prev1 && prev2 && last.bestEpley < prev1.bestEpley - 0.5 && prev1.bestEpley < prev2.bestEpley - 0.5;
  const nonBody = allExSets.filter(s => s.mode !== 'body');
  const prW = nonBody.length ? Math.max(...nonBody.map(s => s.w)) : 0;
  const prEst = nonBody.length ? Math.max(...nonBody.map(est)) : 0;
  const modeLabel = last.mode === 'pair' ? '（片手）' : last.mode === 'single' ? '（片側）' : last.mode === 'body' ? '（追加重量）' : '';

  let recW = last.w, recReps = last.minReps, recRepsText = `${last.minReps}回`, recSets = last.nSets, reason = '', shortReason = '';

  if (last.pain) {
    recW = last.mode === 'body' ? 0 : roundToStep(last.w * 0.9, step);
    recReps = repMin;
    recRepsText = `${repMin}回`;
    shortReason = '前回の痛み・違和感に配慮し負荷軽減';
    reason = `前回（${last.date}）に痛み・違和感の記録があるため、無理な増量は避け ${recW}kg${modeLabel} × ${repMin}回前後でフォームと関節状態を確認する保守的な目安です。`;
  } else if (last.fatigue || twoDrop) {
    recW = last.w;
    recReps = Math.max(repMin, last.minReps);
    recRepsText = `${recReps}回`;
    shortReason = twoDrop ? '直近2回連続で出力低下のため維持' : '前回の強い疲労を考慮し重量維持';
    reason = `${twoDrop ? '直近2セッション連続で推定出力が低下している' : `前回（${last.date}）に強い疲労の記録がある`}ため、${fmt(recW)}kg${modeLabel} × ${recReps}回 × ${recSets}セットで維持（重ければ-${fmt(step)}kg調整）を推奨します。`;
  } else if (last.mode === 'body' && last.w === 0) {
    if (last.minReps >= repMax) {
      recW = step;
      recReps = repMin;
      recRepsText = `${repMin}〜${Math.min(repMax, repMin + 2)}回`;
      shortReason = `自重${repMax}回達成→軽い加重を検討`;
      reason = `前回（${last.date}）に自重で全${last.nSets}セット${last.minReps}回以上を達成。余力とフォームが安定していれば、追加重量 +${fmt(step)}kg × ${recRepsText} から段階的に試す目安です（慎重に進めるなら自重で+1回も可）。`;
    } else {
      recW = 0;
      recReps = Math.min(repMax, last.minReps + 1);
      recRepsText = `${recReps}回`;
      shortReason = '自重で回数の積み上げ';
      reason = `前回は自重で最低${last.minReps}回。まずは目標上限（${repMax}回）に向け、自重 × ${recReps}回 × ${recSets}セットを目標にします。`;
    }
  } else if (last.minReps >= repMax) {
    if (last.minRir !== null && last.minRir >= 1) {
      recW = roundToStep(last.w + step, step);
      recReps = repMin;
      recRepsText = repMax - repMin >= 3 ? `${repMin}〜${repMin + 2}回` : `${repMin}回`;
      shortReason = `上限${repMax}回＆余力あり→+${fmt(step)}kg検討`;
      reason = `前回（${last.date}）は ${fmt(last.w)}kg${modeLabel} で全セット目標上限（${repMax}回）を達成し余力（RIR ${last.minRir}以上）も確認できたため、+${fmt(step)}kg の ${fmt(recW)}kg × ${recRepsText} × ${recSets}セットを検討できます。`;
    } else if (last.minRir === 0) {
      recW = last.w;
      recReps = repMax;
      recRepsText = `${repMax}回`;
      shortReason = '上限達成・RIR0のため同重量で定着優先';
      reason = `前回は ${fmt(last.w)}kg${modeLabel} × ${repMax}回を達成しましたが限界（RIR 0）だったため、同重量でフォームと余力を安定させてから +${fmt(step)}kg へ進む保守的な提案です。`;
    } else {
      recW = roundToStep(last.w + step, step);
      recReps = repMin;
      recRepsText = repMax - repMin >= 3 ? `${repMin}〜${repMin + 2}回` : `${repMin}回`;
      shortReason = `上限${repMax}回達成→余力があれば+${fmt(step)}kg検討`;
      reason = `前回（${last.date}）に ${fmt(last.w)}kg${modeLabel} × ${last.minReps}回×${last.nSets}セットを達成。RIR未入力のため断定はせず、フォーム・余力が十分なら ${fmt(recW)}kg × ${recRepsText} を検討、重ければ ${fmt(last.w)}kg 維持をおすすめします。`;
    }
  } else if (last.maxReps < repMin) {
    if (last.minRir === 0 && last.w > step) {
      recW = roundToStep(last.w - step, step);
      recReps = repMin;
      recRepsText = `${repMin}回`;
      shortReason = `目標下限${repMin}回未達＆限界→-${fmt(step)}kg調整`;
      reason = `前回は ${fmt(last.w)}kg${modeLabel} × ${last.minReps}回（RIR 0）で目標回数範囲（${repMin}〜${repMax}回）を下回ったため、${fmt(recW)}kg に調整して確実に回数を稼ぐ提案です。`;
    } else {
      recW = last.w;
      recReps = repMin;
      recRepsText = `${repMin}回`;
      shortReason = `同重量で目標下限${repMin}回を目指す`;
      reason = `前回（${last.date}）は ${fmt(last.w)}kg${modeLabel} × ${last.minReps}回。まずは同重量のまま目標下限の ${repMin}回 × ${recSets}セット達成を目安にします。`;
    }
  } else {
    recW = last.w;
    recReps = Math.min(repMax, last.minReps + 1);
    recRepsText = `${recReps}回`;
    shortReason = '同重量で+1回を目標';
    reason = `前回（${last.date}）は ${fmt(last.w)}kg${modeLabel} × ${last.minReps === last.maxReps ? `${last.minReps}回` : `${last.minReps}〜${last.maxReps}回`} × ${last.nSets}セット。余力に応じて同重量で ${recReps}回（目標範囲 ${repMin}〜${repMax}回）を目指します${last.minRir === null ? '（RIR未入力のため無理のない範囲で調整）' : ''}。`;
  }

  const dispW = last.mode === 'body' ? (recW > 0 ? `自重＋${fmt(recW)}kg` : '自重') : `${fmt(recW)}kg${modeLabel}`;
  const headline = `${dispW} × ${recRepsText} × ${recSets}セット`;
  const progressNote = prW > 0
    ? `自己ベスト ${fmt(prW)}kg / 推定MAX ${fmt(prEst)}kg${exId === 'e0' ? `（目標${fmt(db.goals.bench)}kgまであと${fmt(Math.max(0, db.goals.bench - prW))}kg）` : ''} ※毎回のMAX挑戦より通常セットの積み上げを優先`
    : '';

  return {
    status: 'ready',
    exId,
    w: recW,
    reps: recReps,
    sets: recSets,
    mode: last.mode,
    repMin,
    repMax,
    step,
    headline,
    shortReason,
    reason,
    progressNote
  };
}

function applyCoachAdvice(exId) {
  const adv = getCoachAdvice(exId, date);
  if (adv.status !== 'ready') return;
  if ($('w')) $('w').value = adv.w;
  if ($('r')) $('r').value = adv.reps;
  if ($('n') && !editId) $('n').value = adv.sets;
  if ($('mode')) $('mode').value = adv.mode;
  if (db.activePlan && db.activePlan.date === date) {
    syncPlanInputsFromDOM();
    const block = db.activePlan.blocks.find(b => b.e === exId);
    if (block) {
      block.mode = adv.mode;
      block.rows.filter(r => !r.done).forEach(r => { r.w = adv.w; r.reps = adv.reps; });
      save();
      render();
      if ($('w')) $('w').value = adv.w;
      if ($('r')) $('r').value = adv.reps;
      if ($('n') && !editId) $('n').value = adv.sets;
      if ($('mode')) $('mode').value = adv.mode;
    }
  }
  toast('推奨値を入力欄へ反映しました（自由に変更できます）');
}

function applyCoachToPlanBlock(blockId, exId) {
  syncPlanInputsFromDOM();
  const adv = getCoachAdvice(exId, db.activePlan?.date || date);
  const block = db.activePlan?.blocks.find(b => b.id === blockId);
  if (adv.status !== 'ready' || !block) return;
  block.mode = adv.mode;
  block.rows.filter(r => !r.done).forEach(r => { r.w = adv.w; r.reps = adv.reps; });
  save();
  render();
  toast(`${name(exId)} の未完了セットに推奨値を反映しました`);
}

function saveCoachConfig(ev) {
  ev.preventDefault();
  const e = ex(exercise);
  if (!e) return;
  const gt = $('cc-type').value;
  const rMin = Math.max(1, Math.round(+$('cc-min').value || 5));
  const rMax = Math.max(rMin, Math.round(+$('cc-max').value || rMin));
  const st = Math.max(0.25, +$('cc-step').value || 2.5);
  Object.assign(e, {goalType: gt, repMin: rMin, repMax: rMax, step: st});
  showCoachConfig = false;
  save();
  render();
  toast('種目の推奨設定を保存しました');
}

function renderCoachBox(exId) {
  const e = ex(exId);
  if (!e) return '';
  if (isCoachDismissed(exId, date)) {
    return `<div class="coach-dismissed"><small class="muted">PERSONAL COACH の提案を非表示中</small><button type="button" class="secondary sm-btn" onclick="restoreCoach('${esc(exId)}')">再表示</button></div>`;
  }
  const adv = getCoachAdvice(exId, date);
  return `<div class="coach-box">
    <div class="sec-head">
      <span class="tag">PERSONAL COACH｜次回目安</span>
      <small class="muted">${e.goalType === 'strength' ? '筋力重視' : '筋肥大重視'} ${e.repMin}〜${e.repMax}回 / 刻み${fmt(e.step)}kg</small>
    </div>
    ${adv.status === 'ready' ? `
      <div class="coach-main">${esc(adv.headline)}</div>
      <p class="coach-reason">${esc(adv.reason)}</p>
      ${typeof getRestHintForExercise === 'function' && getRestHintForExercise(exId) ? `<small class="coach-prog">${esc(getRestHintForExercise(exId))}</small>` : ''}
      ${adv.progressNote ? `<small class="coach-prog">${esc(adv.progressNote)}</small>` : ''}
      <div class="btn-group" style="margin-top:8px">
        <button type="button" class="sm-btn" onclick="applyCoachAdvice('${esc(exId)}')">採用（入力欄へ反映）</button>
        <button type="button" class="secondary sm-btn" onclick="showCoachConfig=!showCoachConfig;render()">設定・編集</button>
        <button type="button" class="secondary sm-btn" onclick="dismissCoach('${esc(exId)}','${esc(date)}')">無視</button>
      </div>
    ` : `
      <p class="coach-reason">${esc(adv.reason)}</p>
      <button type="button" class="secondary sm-btn" onclick="showCoachConfig=!showCoachConfig;render()">回数範囲・重量刻みを設定</button>
    `}
    ${showCoachConfig ? `<form class="sub-box" style="margin-top:8px" onsubmit="saveCoachConfig(event)">
      <div class="grid">
        <label>タイプ<select id="cc-type" onchange="if(this.value==='strength'){$('cc-min').value=3;$('cc-max').value=5}else{$('cc-min').value=8;$('cc-max').value=12}">
          <option value="strength" ${e.goalType==='strength'?'selected':''}>筋力重視（低回数）</option>
          <option value="hypertrophy" ${e.goalType==='hypertrophy'?'selected':''}>筋肥大重視（中〜高回数）</option>
        </select></label>
        <label>重量刻み kg<input id="cc-step" type="number" min="0.25" max="50" step="0.25" value="${e.step}"></label>
        <label>目標下限（回）<input id="cc-min" type="number" min="1" max="100" value="${e.repMin}"></label>
        <label>目標上限（回）<input id="cc-max" type="number" min="1" max="100" value="${e.repMax}"></label>
      </div>
      <button class="full sm-btn">この種目の推奨設定を保存</button>
    </form>` : ''}
  </div>`;
}

// ============================================================================
// 3位：筋肉ヒートマップ（MUSCLE MAP）
// ============================================================================
let mmView = 'front';
let mmRange = '7d';
let mmFrom = '';
let mmTo = '';
let mmWeightMode = 'primary';
let mmSelected = 'chest';

function shiftDays(baseStr, deltaDays) {
  const [y, m, d] = baseStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function getMuscleMapBounds() {
  const t = today();
  if (mmRange === '1d') return {from: t, to: t, label: `当日（${t}）`};
  if (mmRange === '30d') return {from: shiftDays(t, -29), to: t, label: '直近30日間'};
  if (mmRange === 'custom') {
    const f = validDate(mmFrom) ? mmFrom : shiftDays(t, -6);
    const e = validDate(mmTo) ? mmTo : t;
    return f <= e ? {from: f, to: e, label: `${f} 〜 ${e}`} : {from: e, to: f, label: `${e} 〜 ${f}`};
  }
  return {from: shiftDays(t, -6), to: t, label: '直近7日間'};
}

function computeMuscleStats() {
  const bounds = getMuscleMapBounds();
  const stats = {};
  for (const m of MUSCLES) {
    stats[m.id] = {primarySets: 0, secondarySets: 0, score: 0, lastDate: null, byEx: {}};
  }
  const allCompleted = db.sets.filter(s => (s.tag || 'work') !== 'warmup');
  for (const s of allCompleted) {
    const e = ex(s.e);
    if (!e) continue;
    const prim = e.primary || [], sec = e.secondary || [];
    for (const m of [...prim, ...sec]) {
      if (stats[m] && (!stats[m].lastDate || s.date > stats[m].lastDate)) stats[m].lastDate = s.date;
    }
    if (s.date < bounds.from || s.date > bounds.to) continue;
    for (const m of prim) {
      if (!stats[m]) continue;
      stats[m].primarySets += 1;
      stats[m].byEx[e.id] = stats[m].byEx[e.id] || {name: e.name, primary: 0, secondary: 0};
      stats[m].byEx[e.id].primary += 1;
    }
    for (const m of sec) {
      if (!stats[m]) continue;
      stats[m].secondarySets += 1;
      stats[m].byEx[e.id] = stats[m].byEx[e.id] || {name: e.name, primary: 0, secondary: 0};
      stats[m].byEx[e.id].secondary += 1;
    }
  }
  for (const m of MUSCLES) {
    const st = stats[m.id];
    st.score = mmWeightMode === 'weighted' ? st.primarySets + st.secondarySets * 0.5 : st.primarySets;
  }
  const totalPeriodSets = allCompleted.filter(s => s.date >= bounds.from && s.date <= bounds.to).length;
  return {bounds, stats, totalPeriodSets};
}

function muscleHeatColor(score) {
  if (!(score > 0)) return '#222d3f';
  if (score < 3) return '#1f4478';
  if (score < 6) return '#2b63b4';
  if (score < 10) return '#4485e8';
  return '#73b4ff';
}

function selectMuscle(id) {
  mmSelected = id;
  render();
}

function renderBodySvg(view, stats) {
  const pAttr = id => {
    const fill = muscleHeatColor(stats[id]?.score || 0);
    const sel = mmSelected === id;
    return `fill="${fill}" stroke="${sel ? '#eef4ff' : '#3a4f6e'}" stroke-width="${sel ? '2.2' : '1.1'}" class="mm-part" onclick="selectMuscle('${id}')"`;
  };
  if (view === 'front') {
    return `<svg class="mm-svg" viewBox="0 0 220 365" role="img" aria-label="筋肉ヒートマップ（前面）">
      <circle cx="110" cy="28" r="16" fill="#172234" stroke="#31445f" stroke-width="1.2"/>
      <rect x="103" y="43" width="14" height="10" rx="4" fill="#172234"/>
      <g ${pAttr('traps')}><title>僧帽筋</title><path d="M84 56L103 49L99 63L77 63ZM136 56L117 49L121 63L143 63Z"/></g>
      <g ${pAttr('delt_side')}><title>三角筋中部</title><path d="M56 73C58 64 64 62 68 67L66 91C59 88 55 81 56 73ZM164 73C162 64 156 62 152 67L154 91C161 88 165 81 164 73Z"/></g>
      <g ${pAttr('delt_front')}><title>三角筋前部</title><path d="M67 66C73 61 81 62 84 70L80 89C72 88 67 80 67 66ZM153 66C147 61 139 62 136 70L140 89C148 88 153 80 153 66Z"/></g>
      <g ${pAttr('chest')}><title>胸</title><path d="M84 65H108V101C95 103 84 98 81 87ZM136 65H112V101C125 103 136 98 139 87Z"/></g>
      <g ${pAttr('biceps')}><title>上腕二頭筋</title><path d="M58 93L72 91L70 128L56 126ZM162 93L148 91L150 128L164 126Z"/></g>
      <g ${pAttr('forearm')}><title>前腕</title><path d="M53 131L68 131L63 171L49 168ZM167 131L152 131L157 171L171 168Z"/></g>
      <path d="M82 101L88 167H132L138 101" fill="#172234" stroke="#2c3e57"/>
      <g ${pAttr('abs')}><title>腹筋</title>
        <rect x="93" y="105" width="15" height="17" rx="4"/><rect x="112" y="105" width="15" height="17" rx="4"/>
        <rect x="93" y="125" width="15" height="17" rx="4"/><rect x="112" y="125" width="15" height="17" rx="4"/>
        <rect x="94" y="145" width="14" height="18" rx="4"/><rect x="112" y="145" width="14" height="18" rx="4"/>
      </g>
      <g ${pAttr('quads')}><title>大腿四頭筋</title><path d="M80 172H107L104 252C91 254 80 245 77 220ZM140 172H113L116 252C129 254 140 245 143 220Z"/></g>
      <g ${pAttr('calves')}><title>ふくらはぎ</title><path d="M82 264H101L98 332H84ZM138 264H119L122 332H136Z"/></g>
      <path d="M47 171L43 184L54 186L59 172ZM173 171L177 184L166 186L161 172ZM82 335H99L97 350H79ZM138 335H121L123 350H141Z" fill="#172234"/>
    </svg>`;
  }
  return `<svg class="mm-svg" viewBox="0 0 220 365" role="img" aria-label="筋肉ヒートマップ（背面）">
    <circle cx="110" cy="28" r="16" fill="#172234" stroke="#31445f" stroke-width="1.2"/>
    <rect x="103" y="43" width="14" height="9" rx="4" fill="#172234"/>
    <g ${pAttr('traps')}><title>僧帽筋</title><path d="M82 58L110 48L138 58L124 106L110 120L96 106Z"/></g>
    <g ${pAttr('delt_side')}><title>三角筋中部</title><path d="M56 72L66 66L65 89L57 85ZM164 72L154 66L155 89L163 85Z"/></g>
    <g ${pAttr('delt_rear')}><title>三角筋後部</title><path d="M66 65L82 61L83 86L66 88ZM154 65L138 61L137 86L154 88Z"/></g>
    <g ${pAttr('lats')}><title>広背筋</title><path d="M82 88L96 107L105 147L86 145C78 125 77 105 82 88ZM138 88L124 107L115 147L134 145C142 125 143 105 138 88Z"/></g>
    <g ${pAttr('erectors')}><title>脊柱起立筋</title><path d="M97 121H108V168H95ZM112 121H123L125 168H112Z"/></g>
    <g ${pAttr('triceps')}><title>上腕三頭筋</title><path d="M57 92L72 90L70 128L55 126ZM163 92L148 90L150 128L165 126Z"/></g>
    <g ${pAttr('forearm')}><title>前腕</title><path d="M52 131L67 131L62 171L48 168ZM168 131L153 131L158 171L172 168Z"/></g>
    <g ${pAttr('glutes')}><title>臀筋</title><path d="M82 170H109V207C93 210 81 202 79 187ZM138 170H111V207C127 210 139 202 141 187Z"/></g>
    <g ${pAttr('hams')}><title>ハムストリングス</title><path d="M81 210H106L103 261H83ZM139 210H114L117 261H137Z"/></g>
    <g ${pAttr('calves')}><title>ふくらはぎ</title><path d="M81 266H102L98 334H84ZM139 266H118L122 334H136Z"/></g>
    <path d="M47 171L43 184L54 186L59 172ZM173 171L177 184L166 186L161 172ZM82 336H99L97 350H79ZM138 336H121L123 350H141Z" fill="#172234"/>
  </svg>`;
}

function renderMuscleMapSection() {
  const {bounds, stats, totalPeriodSets} = computeMuscleStats();
  const cur = stats[mmSelected] || stats.chest;
  const exRows = Object.values(cur.byEx).sort((a, b) => (b.primary + b.secondary * 0.5) - (a.primary + a.secondary * 0.5));
  return `<section>
    <div class="sec-head"><h3>MUSCLE MAP（筋肉ヒートマップ）</h3><small>${esc(bounds.label)}</small></div>
    <div class="btn-group" style="margin-bottom:8px">
      ${[['7d','直近7日'],['1d','当日'],['30d','30日間'],['custom','任意期間']].map(([id,lbl])=>`<button type="button" class="${mmRange===id?'':'secondary'} sm-btn" onclick="mmRange='${id}';if('${id}'==='custom'&&!mmFrom){mmFrom=shiftDays(today(),-6);mmTo=today()}render()">${lbl}</button>`).join('')}
    </div>
    ${mmRange === 'custom' ? `<div class="grid" style="margin-bottom:8px">
      <label>開始日<input type="date" value="${esc(bounds.from)}" onchange="mmFrom=this.value;render()"></label>
      <label>終了日<input type="date" value="${esc(bounds.to)}" onchange="mmTo=this.value;render()"></label>
    </div>` : ''}
    <div class="row" style="margin-bottom:8px">
      <div class="btn-group">
        <button type="button" class="${mmView==='front'?'':'secondary'} sm-btn" onclick="mmView='front';render()">前面</button>
        <button type="button" class="${mmView==='back'?'':'secondary'} sm-btn" onclick="mmView='back';render()">背面</button>
      </div>
      <select style="flex:1" onchange="mmWeightMode=this.value;render()">
        <option value="primary" ${mmWeightMode==='primary'?'selected':''}>主働筋セット数で表示（基準）</option>
        <option value="weighted" ${mmWeightMode==='weighted'?'selected':''}>補助筋×0.5 を含む参考値</option>
      </select>
    </div>
    <div class="mm-layout">
      <div class="mm-stage">
        ${renderBodySvg(mmView, stats)}
        <div class="mm-legend">
          <span><i style="background:#222d3f"></i>0</span>
          <span><i style="background:#1f4478"></i>1-2</span>
          <span><i style="background:#2b63b4"></i>3-5</span>
          <span><i style="background:#4485e8"></i>6-9</span>
          <span><i style="background:#73b4ff"></i>10+</span>
        </div>
      </div>
      <div class="mm-list">
        ${MUSCLES.map(m => {
          const st = stats[m.id];
          return `<button type="button" class="mm-chip ${mmSelected===m.id?'active':''}" onclick="mmView='${m.view}';selectMuscle('${m.id}')">
            <span class="mm-dot" style="background:${muscleHeatColor(st.score)}"></span>
            <span class="mm-name">${esc(m.label)}</span>
            <strong>${fmt(st.score)}<small>set</small></strong>
          </button>`;
        }).join('')}
      </div>
    </div>
    <div class="sub-box" style="margin-top:10px">
      <div class="sec-head">
        <strong>${esc(muscleLabel(mmSelected))} の内訳</strong>
        <small>最終実施日：${cur.lastDate ? esc(cur.lastDate) : '記録なし'}</small>
      </div>
      <small class="muted" style="display:block;margin:4px 0 8px">主働筋：${cur.primarySets} セット ／ 補助筋：${cur.secondarySets} セット（期間内の全身総実施セット数：${totalPeriodSets} セット）</small>
      ${exRows.length ? exRows.map(r => `<div class="entry" style="padding:6px 0"><div>${esc(r.name)}</div><small>${r.primary ? `主働 ${r.primary}set` : ''}${r.primary && r.secondary ? ' / ' : ''}${r.secondary ? `補助 ${r.secondary}set` : ''}</small></div>`).join('') : '<p class="muted" style="margin:4px 0">この期間の対象セットはありません。</p>'}
    </div>
    <small class="muted" style="display:block;margin-top:8px">※色の濃淡は選択期間内の実施セット数（トレーニング量）の指標であり、筋疲労・回復度・筋肥大そのものを示すものではありません。ウォームアップおよび未実施予定セットは集計から除外されます。</small>
  </section>`;
}

// 種目編集用の主働筋・補助筋ピッカー
let exEditPrimary = ['chest'];
let exEditSecondary = ['delt_front', 'triceps'];

function loadExEditorMuscles(exId) {
  if (exId) {
    const e = ex(exId);
    exEditPrimary = [...(e?.primary || [])];
    exEditSecondary = [...(e?.secondary || [])];
  } else {
    const partVal = $('ep')?.value || '胸';
    const def = PART_DEFAULT_MUSCLES[partVal] || PART_DEFAULT_MUSCLES['その他'];
    exEditPrimary = [...def.primary];
    exEditSecondary = [...def.secondary];
  }
}

function toggleExMuscle(role, mId) {
  const nEl = $('en'), pEl = $('ep'), idEl = $('eid');
  const savedName = nEl?.value || '', savedPart = pEl?.value || '胸', savedId = idEl?.value || '';
  if (role === 'primary') {
    if (exEditPrimary.includes(mId)) exEditPrimary = exEditPrimary.filter(x => x !== mId);
    else {
      exEditPrimary.push(mId);
      exEditSecondary = exEditSecondary.filter(x => x !== mId);
    }
  } else {
    if (exEditSecondary.includes(mId)) exEditSecondary = exEditSecondary.filter(x => x !== mId);
    else {
      exEditSecondary.push(mId);
      exEditPrimary = exEditPrimary.filter(x => x !== mId);
    }
  }
  render();
  if ($('eid')) $('eid').value = savedId;
  if ($('en')) $('en').value = savedName;
  if ($('ep')) $('ep').value = savedPart;
}

function renderExerciseMuscleFields() {
  return `<div style="margin:8px 0">
    <small style="display:block;color:#b4c4db;margin-bottom:4px">主働筋（タップで選択）</small>
    <div class="chip-wrap">${MUSCLES.map(m => `<button type="button" class="${exEditPrimary.includes(m.id)?'':'secondary'} xs-btn" onclick="toggleExMuscle('primary','${m.id}')">${esc(m.label)}</button>`).join('')}</div>
    <small style="display:block;color:#b4c4db;margin:8px 0 4px">補助筋（タップで選択）</small>
    <div class="chip-wrap">${MUSCLES.map(m => `<button type="button" class="${exEditSecondary.includes(m.id)?'':'secondary'} xs-btn" onclick="toggleExMuscle('secondary','${m.id}')">${esc(m.label)}</button>`).join('')}</div>
  </div>`;
}
