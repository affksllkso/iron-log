'use strict';

// ============================================================================
// 共通：拡張データ初期化・セッション構築・バックアップ検証
// ============================================================================
const REST_GROUPS = [
  {id: 'chest', label: '胸', muscles: ['chest'], defHours: 48},
  {id: 'back', label: '背中', muscles: ['lats', 'traps', 'erectors'], defHours: 48},
  {id: 'shoulders', label: '肩', muscles: ['delt_front', 'delt_side', 'delt_rear'], defHours: 48},
  {id: 'biceps', label: '二頭筋', muscles: ['biceps'], defHours: 36},
  {id: 'triceps', label: '三頭筋', muscles: ['triceps'], defHours: 36},
  {id: 'legs', label: '脚', muscles: ['quads', 'hams', 'glutes', 'calves'], defHours: 72},
  {id: 'abs', label: '腹筋', muscles: ['abs'], defHours: 24},
  {id: 'forearm', label: '前腕', muscles: ['forearm'], defHours: 36}
];

const DEFAULT_ACH_TARGETS = {
  bench1: 60,
  bench2: 80,
  bench3: 90,
  bench4: 100,
  squat1: 120,
  dead1: 150,
  big3: 400,
  workouts1: 10,
  workouts2: 50,
  workouts3: 100,
  sets1: 100,
  sets2: 500,
  sets3: 1000,
  body1: 75
};

function ensureProgressDb(target) {
  if (!target || typeof target !== 'object') return target;
  if (typeof target.restIncludeSecondary !== 'boolean') target.restIncludeSecondary = false;
  if (!target.restTargets || typeof target.restTargets !== 'object') target.restTargets = {};
  for (const g of REST_GROUPS) {
    if (!(typeof target.restTargets[g.id] === 'number' && target.restTargets[g.id] >= 6 && target.restTargets[g.id] <= 336)) {
      target.restTargets[g.id] = g.defHours;
    }
  }
  if (!target.achievementTargets || typeof target.achievementTargets !== 'object') target.achievementTargets = {};
  for (const [k, v] of Object.entries(DEFAULT_ACH_TARGETS)) {
    if (!(typeof target.achievementTargets[k] === 'number' && target.achievementTargets[k] > 0)) {
      target.achievementTargets[k] = k === 'bench4' && target.goals?.bench ? target.goals.bench :
        k === 'body1' && target.goals?.body ? target.goals.body : v;
    }
  }
  if (typeof target.badgeNotify !== 'boolean') target.badgeNotify = true;
  if (target.manualSession === undefined) target.manualSession = null;
  const hadUnlockedMap = target.unlockedAchievements && typeof target.unlockedAchievements === 'object';
  if (!hadUnlockedMap) target.unlockedAchievements = {};
  // 既存履歴から解除状況を同期（初回読み込み時は過去分を静かに反映し重複通知を防ぐ）
  syncUnlockedAchievements(target, false);
  return target;
}

function validProgressBackup(d) {
  const num = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  for (const s of d.sets || []) {
    if (s.at !== undefined && s.at !== null && (typeof s.at !== 'string' || isNaN(Date.parse(s.at)))) return false;
    if (s.sessionId !== undefined && s.sessionId !== null && typeof s.sessionId !== 'string') return false;
    if (s.sessionName !== undefined && s.sessionName !== null && typeof s.sessionName !== 'string') return false;
    if (s.templateId !== undefined && s.templateId !== null && typeof s.templateId !== 'string') return false;
  }
  if (d.restTargets !== undefined && (typeof d.restTargets !== 'object' || d.restTargets === null)) return false;
  if (d.achievementTargets !== undefined && (typeof d.achievementTargets !== 'object' || d.achievementTargets === null)) return false;
  if (d.unlockedAchievements !== undefined && (typeof d.unlockedAchievements !== 'object' || d.unlockedAchievements === null)) return false;
  if (d.badgeNotify !== undefined && typeof d.badgeNotify !== 'boolean') return false;
  if (d.restIncludeSecondary !== undefined && typeof d.restIncludeSecondary !== 'boolean') return false;
  for (const v of Object.values(d.achievementTargets || {})) {
    if (!num(v) || v <= 0) return false;
  }
  return true;
}

// 手動記録時のセッションID管理（3時間以内の同日記録は同一セッション、または明示的に新規セッション分割可能）
function resolveManualSession(targetDate) {
  const now = Date.now();
  const cur = db.manualSession;
  if (cur && cur.date === targetDate && (!cur.lastAt || now - cur.lastAt < 3 * 3600 * 1000)) {
    cur.lastAt = now;
    return cur.id;
  }
  const freshId = 'ms-' + uid();
  db.manualSession = {id: freshId, date: targetDate, lastAt: now};
  return freshId;
}

function startNewManualSession() {
  db.manualSession = {id: 'ms-' + uid(), date, lastAt: Date.now()};
  save();
  render();
  toast('新しいセッション枠を開始しました（同日複数回として区別されます）');
}

// ============================================================================
// 追加機能①：部位別休養時間管理（REST TRACKER）
// ============================================================================
let rtSelectedGroup = null;
let rtShowSettings = false;

function formatLocalDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function calcElapsedInfo(lastAt, lastDate) {
  if (!lastDate) return {text: '未記録', sub: '実施記録なし', approxHours: null, exact: false};
  if (lastAt && !isNaN(Date.parse(lastAt))) {
    const diffMs = Math.max(0, Date.now() - Date.parse(lastAt));
    const totalHours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const exactHours = diffMs / 3600000;
    if (totalHours < 24) {
      const label = totalHours === 0 ? `${Math.max(1, mins)}分（1時間未満）` : `${totalHours}時間`;
      return {text: label, sub: `最終 ${formatLocalDateTime(lastAt)}`, approxHours: exactHours, exact: true};
    }
    const days = Math.floor(totalHours / 24);
    const remH = totalHours % 24;
    return {text: `${days}日${remH}時間`, sub: `最終 ${formatLocalDateTime(lastAt)}`, approxHours: exactHours, exact: true};
  }
  // 時刻がない過去記録：正確な時間を捏造せず日単位の参考表示とする
  const [ty, tm, td] = today().split('-').map(Number);
  const [ly, lm, ld] = lastDate.split('-').map(Number);
  const dayDiff = Math.max(0, Math.round((new Date(ty, tm - 1, td) - new Date(ly, lm - 1, ld)) / 86400000));
  return {
    text: dayDiff === 0 ? '当日実施（時刻未記録）' : `約${dayDiff}日（日単位参考）`,
    sub: `最終 ${lastDate}（時刻データなし）`,
    approxHours: dayDiff * 24,
    exact: false
  };
}

function computeRestTracker(includeSecondary = db.restIncludeSecondary) {
  const workSets = db.sets.filter(s => (s.tag || 'work') !== 'warmup');
  return REST_GROUPS.map(g => {
    const mSet = new Set(g.muscles);
    const matched = workSets.filter(s => {
      const e = ex(s.e);
      if (!e) return false;
      const hitPrim = (e.primary || []).some(m => mSet.has(m));
      const hitSec = includeSecondary && (e.secondary || []).some(m => mSet.has(m));
      return hitPrim || hitSec;
    });
    const targetHours = db.restTargets?.[g.id] ?? g.defHours;
    if (!matched.length) {
      return {...g, targetHours, lastDate: null, lastAt: null, elapsed: calcElapsedInfo(null, null), recentSets: 0, recentExercises: [], history: []};
    }
    const dates = [...new Set(matched.map(s => s.date))].sort();
    const lastDate = dates.at(-1);
    const lastDaySets = matched.filter(s => s.date === lastDate);
    const timestamps = lastDaySets.map(s => s.at).filter(a => a && !isNaN(Date.parse(a))).sort();
    const lastAt = timestamps.at(-1) || null;
    const elapsed = calcElapsedInfo(lastAt, lastDate);
    const exSummary = {};
    for (const s of lastDaySets) exSummary[s.e] = (exSummary[s.e] || 0) + 1;
    const recentExercises = Object.entries(exSummary).map(([eid, cnt]) => ({name: name(eid), sets: cnt}));
    const history = dates.slice(-5).reverse().map(d => {
      const ds = matched.filter(s => s.date === d);
      const names = [...new Set(ds.map(s => name(s.e)))].join('・');
      return {date: d, sets: ds.length, names};
    });
    return {
      ...g,
      targetHours,
      lastDate,
      lastAt,
      elapsed,
      recentSets: lastDaySets.length,
      recentExercises,
      history
    };
  });
}

// PERSONAL COACH への休養間隔の参考情報提供
function getRestHintForExercise(exId) {
  const e = ex(exId);
  if (!e || !(e.primary || []).length) return '';
  const groups = computeRestTracker(false);
  const g = groups.find(gr => gr.muscles.some(m => e.primary.includes(m)));
  if (!g || !g.lastDate) return '';
  return `休養参考（${g.label}）：前回から ${g.elapsed.text}（個人目安 ${g.targetHours}時間）※回復断定ではなく参考値です`;
}

function saveRestTargets(ev) {
  ev.preventDefault();
  for (const g of REST_GROUPS) {
    const el = $('rt-h-' + g.id);
    if (el) {
      const v = Math.min(336, Math.max(6, Math.round(+el.value || g.defHours)));
      db.restTargets[g.id] = v;
    }
  }
  rtShowSettings = false;
  save();
  render();
  toast('部位別の休養時間目安を保存しました');
}

function renderRestTrackerSection() {
  const rows = computeRestTracker(db.restIncludeSecondary);
  const sel = rows.find(r => r.id === rtSelectedGroup) || null;
  return `<section>
    <div class="sec-head">
      <h3>REST TRACKER（部位別休養時間）</h3>
      <div class="btn-group">
        <button type="button" class="${db.restIncludeSecondary ? '' : 'secondary'} xs-btn" onclick="db.restIncludeSecondary=!db.restIncludeSecondary;save();render()">${db.restIncludeSecondary ? '補助筋含む' : '主働筋のみ'}</button>
        <button type="button" class="secondary xs-btn" onclick="rtShowSettings=!rtShowSettings;render()">目安設定</button>
      </div>
    </div>
    ${rtShowSettings ? `<form class="sub-box" onsubmit="saveRestTargets(event)">
      <h4>部位別の休養目安（時間）</h4>
      <div class="grid">
        ${REST_GROUPS.map(g => `<label>${esc(g.label)}（時間）<input id="rt-h-${g.id}" type="number" min="6" max="336" value="${db.restTargets[g.id] ?? g.defHours}"></label>`).join('')}
      </div>
      <button class="full sm-btn">休養目安を保存</button>
    </form>` : ''}
    <div class="rt-grid">
      ${rows.map(r => {
        const pct = r.elapsed.approxHours == null ? 0 : Math.min(100, Math.round(r.elapsed.approxHours / r.targetHours * 100));
        return `<button type="button" class="rt-card ${rtSelectedGroup === r.id ? 'active' : ''}" onclick="rtSelectedGroup=rtSelectedGroup==='${r.id}'?null:'${r.id}';render()">
          <div class="sec-head" style="gap:4px">
            <strong>${esc(r.label)}</strong>
            <small>${r.lastDate ? `直近${r.recentSets}set` : '―'}</small>
          </div>
          <div class="rt-elapsed">${esc(r.elapsed.text)}</div>
          <div class="bar" style="height:6px;margin:5px 0"><i style="width:${pct}%;background:${pct >= 100 ? '#5ea2ff' : '#3568b8'}"></i></div>
          <small class="muted" style="font-size:10.5px">${r.lastDate ? `目安 ${r.targetHours}h / ${esc(r.lastDate.slice(5))}` : `目安 ${r.targetHours}h / 未記録`}</small>
        </button>`;
      }).join('')}
    </div>
    ${sel ? `<div class="sub-box">
      <div class="sec-head">
        <strong>${esc(sel.label)} の実施詳細</strong>
        <small>${esc(sel.elapsed.sub)}</small>
      </div>
      ${sel.lastDate ? `
        <small class="muted" style="display:block;margin:5px 0">直近実施（${esc(sel.lastDate)}）：${sel.recentExercises.map(x => `${esc(x.name)} ${x.sets}set`).join(' / ')}</small>
        ${sel.history.map(h => `<div class="entry" style="padding:6px 0"><div>${esc(h.date)}<br><small>${esc(h.names)}</small></div><small>${h.sets} セット</small></div>`).join('')}
      ` : '<p class="muted" style="margin:6px 0">まだ完了したセット記録がありません。</p>'}
    </div>` : ''}
    <small class="muted" style="display:block;margin-top:8px">※経過時間は最終実施からの時間であり、筋肉の回復完了を断定するものではありません。体調や張りに応じて調整してください。</small>
  </section>`;
}

// ============================================================================
// 追加機能②：前回とのトレーニング比較（WORKOUT COMPLETE）
// ============================================================================
let wcModalSessionKey = null;
let wcCompareTargetKey = null;
let wcCommonOnly = false;
let histSelectedSessionKey = null;

function buildCompletedSessions(sourceDb = db) {
  const allSets = (sourceDb.sets || []).filter(s => s && validDate(s.date));
  if (!allSets.length) return [];
  const rawMap = new Map();
  for (const s of allSets) {
    const sid = s.sessionId || ('day:' + s.date);
    const key = `${s.date}::${sid}`;
    if (!rawMap.has(key)) {
      rawMap.set(key, {
        key,
        date: s.date,
        sessionId: sid,
        templateId: s.templateId || null,
        sessionName: s.sessionName || null,
        sets: []
      });
    }
    const g = rawMap.get(key);
    if (!g.templateId && s.templateId) g.templateId = s.templateId;
    if (!g.sessionName && s.sessionName) g.sessionName = s.sessionName;
    g.sets.push(s);
  }
  const byDay = {};
  for (const sess of rawMap.values()) {
    (byDay[sess.date] = byDay[sess.date] || []).push(sess);
  }
  const list = [];
  for (const d of Object.keys(byDay).sort()) {
    const daySessions = byDay[d];
    daySessions.sort((a, b) => {
      const aAt = a.sets.map(s => s.at).filter(Boolean).sort()[0] || '';
      const bAt = b.sets.map(s => s.at).filter(Boolean).sort()[0] || '';
      return aAt.localeCompare(bAt);
    });
    const dayWatch = [...(sourceDb.watchWorkouts || [])].filter(w => w.date === d).sort((a, b) => a.start.localeCompare(b.start));
    const usedWatch = new Set();
    daySessions.forEach((sess, idx) => {
      const workSets = sess.sets.filter(s => (s.tag || 'work') !== 'warmup');
      const basisSets = workSets.length ? workSets : sess.sets;
      const partCounts = {};
      for (const s of basisSets) {
        const p = (sourceDb.exercises || []).find(e => e.id === s.e)?.part || 'その他';
        partCounts[p] = (partCounts[p] || 0) + 1;
      }
      const sortedParts = Object.entries(partCounts).sort((a, b) => b[1] - a[1]).map(([p]) => p);
      sess.mainPart = sortedParts[0] || 'その他';
      sess.partsLabel = sortedParts.slice(0, 2).join('・') || 'トレーニング';
      const ats = sess.sets.map(s => s.at).filter(a => a && !isNaN(Date.parse(a))).sort();
      sess.firstAt = ats[0] || null;
      sess.lastAt = ats.at(-1) || null;
      sess.dayIndex = daySessions.length > 1 ? idx + 1 : 0;
      const timeHint = sess.firstAt ? formatLocalDateTime(sess.firstAt).slice(11) : '';
      sess.title = (sess.sessionName || `${sess.partsLabel}トレーニング`) +
        (sess.dayIndex ? ` #${sess.dayIndex}${timeHint ? ` (${timeHint})` : ''}` : '');
      sess.sortKey = `${sess.date}#${String(idx).padStart(2, '0')}#${sess.firstAt || ''}`;

      // Apple Watch ワークアウト紐付け（時刻重なり優先、単一セッション日は単一Watchを紐付け）
      let matchedW = null;
      if (sess.firstAt) {
        const s0 = Date.parse(sess.firstAt) - 30 * 60000, s1 = Date.parse(sess.lastAt || sess.firstAt) + 30 * 60000;
        matchedW = dayWatch.find((w, wi) => !usedWatch.has(wi) && Date.parse(w.start) <= s1 && Date.parse(w.end) >= s0);
        if (matchedW) usedWatch.add(dayWatch.indexOf(matchedW));
      } else if (daySessions.length === 1 && dayWatch.length === 1) {
        matchedW = dayWatch[0];
        usedWatch.add(0);
      } else if (dayWatch[idx] && !usedWatch.has(idx)) {
        matchedW = dayWatch[idx];
        usedWatch.add(idx);
      }
      sess.watch = matchedW || null;
      list.push(sess);
    });
  }

  // 各セッション時点での自己ベスト更新数（実測重量PR・推定1RM PR・実効回数PR）を時系列順で算出
  const seenSets = [];
  for (const sess of list) {
    let prCount = 0;
    for (const s of sess.sets) {
      if ((s.tag || 'work') === 'warmup') { seenSets.push(s); continue; }
      const exPrev = seenSets.filter(x => x.e === s.e && (x.tag || 'work') !== 'warmup');
      if (exPrev.length) {
        if (s.mode !== 'body') {
          const nb = exPrev.filter(x => x.mode !== 'body');
          const oldW = Math.max(0, ...nb.map(x => x.w));
          const oldEst = Math.max(0, ...nb.map(est));
          const sameOrHeavier = nb.filter(x => x.w >= s.w);
          const hitW = oldW > 0 && s.w > oldW;
          const hitEst = oldEst > 0 && est(s) > oldEst + 0.05;
          const hitRep = s.w > 0 && oldW > 0 && s.w >= oldW * 0.7 && sameOrHeavier.length && s.reps > Math.max(...sameOrHeavier.map(x => x.reps));
          if (hitW || hitEst || hitRep) prCount++;
        } else {
          const bs = exPrev.filter(x => x.mode === 'body');
          const oldBW = Math.max(0, ...bs.map(x => x.w));
          const sameW = bs.filter(x => x.w >= s.w);
          if ((oldBW > 0 && s.w > oldBW) || (sameW.length && s.reps > Math.max(...sameW.map(x => x.reps)))) prCount++;
        }
      }
      seenSets.push(s);
    }
    sess.prCount = prCount;
  }
  return list;
}

function pickDefaultPrevSession(cur, allSessions) {
  const priors = allSessions.filter(s => s.sortKey < cur.sortKey);
  if (!priors.length) return null;
  if (cur.templateId) {
    const byTpl = priors.filter(s => s.templateId === cur.templateId).at(-1);
    if (byTpl) return byTpl;
  }
  const byPart = priors.filter(s => s.mainPart === cur.mainPart).at(-1);
  return byPart || priors.at(-1);
}

function summarizeSessionForCompare(sess, allowedExIds = null) {
  if (!sess) return null;
  const workSets = sess.sets.filter(s => (s.tag || 'work') !== 'warmup' && (!allowedExIds || allowedExIds.has(s.e)));
  const warmupCount = sess.sets.filter(s => (s.tag || 'work') === 'warmup' && (!allowedExIds || allowedExIds.has(s.e))).length;
  const totalSets = workSets.length;
  const totalVol = workSets.reduce((a, s) => a + volume(s), 0);
  const bodyZeroSets = workSets.filter(s => s.mode === 'body' && !(s.w > 0)).length;
  let minutes = null;
  if (sess.watch) {
    minutes = workoutDuration(sess.watch);
  } else if (sess.firstAt && sess.lastAt && sess.lastAt > sess.firstAt) {
    const diffMin = (Date.parse(sess.lastAt) - Date.parse(sess.firstAt)) / 60000;
    if (diffMin >= 1) minutes = Math.round(diffMin);
  }
  return {
    totalSets,
    warmupCount,
    totalVol,
    bodyZeroSets,
    minutes,
    kcal: sess.watch?.kcal ?? null,
    bpm: sess.watch?.bpm ?? null,
    prCount: sess.prCount || 0
  };
}

function formatExerciseSlashSets(sets) {
  if (!sets.length) return '―';
  const groups = [];
  for (const s of sets) {
    const wLabel = s.mode === 'body' ? (s.w > 0 ? `自重+${fmt(s.w)}kg` : '自重') :
      `${fmt(s.w)}kg${s.mode === 'pair' ? '(片手)' : s.mode === 'single' ? '(片側)' : ''}`;
    const last = groups.at(-1);
    if (last && last.wLabel === wLabel) last.reps.push(s.reps);
    else groups.push({wLabel, reps: [s.reps]});
  }
  return groups.map(g => `${g.wLabel}×${g.reps.join('/')}回`).join('、');
}

function formatMetricDiff(curVal, prevVal, unit, hasPrevSession) {
  if (curVal == null) return {valText: '記録なし', diffText: '―'};
  const valText = `${fmt(curVal)} ${unit}`.trim();
  if (!hasPrevSession) return {valText, diffText: '初回記録'};
  if (prevVal == null) return {valText, diffText: '前回記録なし'};
  const diff = curVal - prevVal;
  const sign = diff > 0 ? '+' : '';
  if (prevVal === 0) {
    return {valText, diffText: diff === 0 ? '±0（前回0）' : `${sign}${fmt(diff)} ${unit}（初回算出）`};
  }
  const pct = (diff / prevVal) * 100;
  return {valText, diffText: `${sign}${fmt(diff)} ${unit}（${sign}${fmt(pct)}%）`};
}

function buildWorkoutComparison(curKey, overridePrevKey = null, commonOnly = false) {
  const all = buildCompletedSessions();
  const cur = all.find(s => s.key === curKey);
  if (!cur) return null;
  const prev = overridePrevKey === 'none' ? null :
    (overridePrevKey ? all.find(s => s.key === overridePrevKey && s.key !== cur.key) : null) || pickDefaultPrevSession(cur, all);
  const curWork = cur.sets.filter(s => (s.tag || 'work') !== 'warmup');
  const prevWork = prev ? prev.sets.filter(s => (s.tag || 'work') !== 'warmup') : [];
  const curExOrder = [...new Set(curWork.map(s => s.e))];
  const prevExOrder = [...new Set(prevWork.map(s => s.e))];
  const commonSet = new Set(curExOrder.filter(id => prevExOrder.includes(id)));
  const filterSet = commonOnly && prev ? commonSet : null;

  const curSum = summarizeSessionForCompare(cur, filterSet);
  const prevSum = prev ? summarizeSessionForCompare(prev, filterSet) : null;

  const allExIds = commonOnly && prev ? [...commonSet] : [...new Set([...curExOrder, ...prevExOrder])];
  const exerciseRows = allExIds.map(eid => {
    const cSets = curWork.filter(s => s.e === eid);
    const pSets = prevWork.filter(s => s.e === eid);
    const cNonBody = cSets.filter(s => s.mode !== 'body');
    const pNonBody = pSets.filter(s => s.mode !== 'body');
    const cEst = cNonBody.length ? Math.max(...cNonBody.map(est)) : null;
    const pEst = pNonBody.length ? Math.max(...pNonBody.map(est)) : null;
    const cVol = cSets.reduce((a, s) => a + volume(s), 0);
    const pVol = pSets.reduce((a, s) => a + volume(s), 0);
    const status = cSets.length && pSets.length ? 'both' : cSets.length ? 'added' : 'removed';
    return {
      exId: eid,
      name: name(eid),
      status,
      curText: formatExerciseSlashSets(cSets),
      prevText: formatExerciseSlashSets(pSets),
      curEst: cEst,
      prevEst: pEst,
      curVol: cVol,
      prevVol: pVol,
      curHasBodyZero: cSets.some(s => s.mode === 'body' && !(s.w > 0))
    };
  });

  return {all, cur, prev, curSum, prevSum, commonCount: commonSet.size, exerciseRows, commonOnly};
}

function openWorkoutComplete(sessionKey = null) {
  const all = buildCompletedSessions();
  const target = sessionKey ? all.find(s => s.key === sessionKey) : all.filter(s => s.date === date).at(-1) || all.at(-1);
  if (!target) { toast('完了したセット記録がまだありません'); return; }
  wcModalSessionKey = target.key;
  wcCompareTargetKey = null;
  wcCommonOnly = false;
  render();
}

function closeWorkoutComplete() {
  wcModalSessionKey = null;
  render();
}

function copyComparisonReport(curKey, prevKey, commonOnly) {
  const cmp = buildWorkoutComparison(curKey, prevKey, commonOnly);
  if (!cmp) return;
  const {cur, prev, curSum, prevSum, exerciseRows} = cmp;
  const hasPrev = !!prev;
  const mSets = formatMetricDiff(curSum.totalSets, prevSum?.totalSets, 'set', hasPrev);
  const mVol = formatMetricDiff(curSum.totalVol, prevSum?.totalVol, 'kg', hasPrev);
  const mMin = formatMetricDiff(curSum.minutes, prevSum?.minutes, '分', hasPrev);
  const mKcal = formatMetricDiff(curSum.kcal, prevSum?.kcal, 'kcal', hasPrev);
  const mBpm = formatMetricDiff(curSum.bpm, prevSum?.bpm, 'bpm', hasPrev);
  const lines = [
    `【WORKOUT COMPLETE｜前回比較（${commonOnly ? '共通種目のみ' : 'セッション全体'}）】`,
    `今回：${cur.date} ${cur.title}`,
    `比較対象：${prev ? `${prev.date} ${prev.title}` : 'なし（初回記録）'}`,
    `・実施セット：${mSets.valText}（${mSets.diffText}）`,
    `・総外部負荷：${mVol.valText}（${mVol.diffText}）`,
    `・運動時間：${mMin.valText}${curSum.minutes != null ? `（${mMin.diffText}）` : ''}`,
    `・自己ベスト更新：${curSum.prCount} 件`,
    `・消費カロリー：${mKcal.valText}${curSum.kcal != null ? `（${mKcal.diffText}）` : ''}`,
    `・平均心拍：${mBpm.valText}${curSum.bpm != null ? `（${mBpm.diffText}）` : ''}`,
    '',
    '【種目別推移】',
    ...exerciseRows.map(r => {
      const badge = r.status === 'added' ? '［今回追加］' : r.status === 'removed' ? '［今回未実施］' : '';
      return `・${r.name}${badge}：${prev ? `${r.prevText} → ` : ''}${r.curText}` +
        (r.curEst != null ? `（推定MAX ${r.prevEst != null ? `${fmt(r.prevEst)}→` : ''}${fmt(r.curEst)}kg / 負荷 ${prev ? `${fmt(r.prevVol)}→` : ''}${fmt(r.curVol)}kg）` : '');
    }),
    'このトレーニング内容を評価し、次回の調整案があれば教えてください。'
  ];
  copyText(lines.join('\n'));
}

function renderComparisonCardInner(curKey, isModal = false) {
  const cmp = buildWorkoutComparison(curKey, wcCompareTargetKey, wcCommonOnly);
  if (!cmp) return '<p class="muted">比較可能な完了セッションがありません。</p>';
  const {all, cur, prev, curSum, prevSum, commonCount, exerciseRows} = cmp;
  const otherSessions = all.filter(s => s.key !== cur.key).reverse();
  const hasPrev = !!prev;
  const metrics = [
    ['実施セット数', formatMetricDiff(curSum.totalSets, prevSum?.totalSets, 'set', hasPrev)],
    ['総外部負荷', formatMetricDiff(curSum.totalVol, prevSum?.totalVol, 'kg', hasPrev)],
    ['運動時間', formatMetricDiff(curSum.minutes, prevSum?.minutes, '分', hasPrev)],
    ['自己ベスト更新', {valText: `${curSum.prCount} 件`, diffText: hasPrev ? `前回 ${prevSum.prCount} 件` : '初回記録'}],
    ['消費カロリー', formatMetricDiff(curSum.kcal, prevSum?.kcal, 'kcal', hasPrev)],
    ['平均心拍', formatMetricDiff(curSum.bpm, prevSum?.bpm, 'bpm', hasPrev)]
  ];

  return `<div class="wc-box">
    <div class="sec-head">
      <div><span class="tag">WORKOUT COMPLETE</span><h3 style="margin:2px 0 0">${esc(cur.date)}｜${esc(cur.title)}</h3></div>
      ${isModal ? `<button type="button" class="secondary sm-btn" onclick="closeWorkoutComplete()">閉じる</button>` : ''}
    </div>
    ${otherSessions.length ? `<label style="margin:8px 0">比較対象セッション
      <select onchange="wcCompareTargetKey=this.value;render()">
        ${otherSessions.map(s => `<option value="${esc(s.key)}" ${prev?.key === s.key ? 'selected' : ''}>${esc(s.date)}｜${esc(s.title)}（${s.sets.filter(x=>(x.tag||'work')!=='warmup').length}set）</option>`).join('')}
      </select>
    </label>` : `<p class="muted" style="margin:6px 0">比較対象の過去セッションがまだないため「初回記録」として表示しています。</p>`}
    ${hasPrev ? `<div class="btn-group" style="margin-bottom:8px">
      <button type="button" class="${!wcCommonOnly ? '' : 'secondary'} xs-btn" onclick="wcCommonOnly=false;render()">セッション全体で比較</button>
      <button type="button" class="${wcCommonOnly ? '' : 'secondary'} xs-btn" onclick="wcCommonOnly=true;render()">共通種目のみで比較（${commonCount}種目）</button>
    </div>` : ''}
    <div class="grid wc-metrics">
      ${metrics.map(([lbl, m]) => `<div class="wc-stat">
        <small>${lbl}</small>
        <strong>${esc(m.valText)}</strong>
        <span class="wc-diff">${esc(m.diffText)}</span>
      </div>`).join('')}
    </div>
    <h4 style="margin:12px 0 6px;font-size:14px">種目別の前回比較</h4>
    ${exerciseRows.length ? exerciseRows.map(r => `<div class="wc-ex-row">
      <div class="sec-head" style="gap:4px">
        <strong>${esc(r.name)}</strong>
        ${r.status === 'added' ? '<span class="wc-badge add">今回追加</span>' : r.status === 'removed' ? '<span class="wc-badge rem">今回未実施</span>' : ''}
      </div>
      <div class="wc-rep-line">${hasPrev ? `<span class="muted">${esc(r.prevText)}</span> → ` : ''}<strong>${esc(r.curText)}</strong></div>
      <small class="muted">
        ${r.curEst != null || r.prevEst != null ? `推定MAX：${r.prevEst != null ? `${fmt(r.prevEst)}kg → ` : ''}${r.curEst != null ? `${fmt(r.curEst)}kg` : '―'} ／ ` : ''}
        外部負荷：${hasPrev ? `${fmt(r.prevVol)}kg → ` : ''}${fmt(r.curVol)}kg${r.curHasBodyZero ? '（※自重0kg分は外部負荷に含まず）' : ''}
      </small>
    </div>`).join('') : '<p class="muted">共通する種目がありません。「セッション全体で比較」に切り替えて確認できます。</p>'}
    <small class="muted" style="display:block;margin-top:8px">※ウォームアップおよび未実施予定セットは集計対象外です。数値の増減は種目順や負荷調整・回復目的のメニュー変更によっても生じるため、優劣を示すものではありません。</small>
    <button type="button" class="secondary full" onclick="copyComparisonReport('${esc(cur.key)}','${esc(prev?.key || 'none')}',${wcCommonOnly})">比較レポートをChatGPT用にコピー</button>
  </div>`;
}

function renderWorkoutCompleteModal() {
  if (!wcModalSessionKey) return '';
  return `<div class="wc-modal-bg" onclick="if(event.target===this)closeWorkoutComplete()">
    <div class="wc-modal">${renderComparisonCardInner(wcModalSessionKey, true)}</div>
  </div>`;
}

function renderHistoryComparisonSection(targetDate) {
  const daySessions = buildCompletedSessions().filter(s => s.date === targetDate);
  if (!daySessions.length) return '';
  const activeSession = daySessions.find(s => s.key === histSelectedSessionKey) || daySessions.at(-1);
  return `<section>
    ${daySessions.length > 1 ? `<div class="btn-group" style="margin-bottom:8px">
      ${daySessions.map(s => `<button type="button" class="${s.key === activeSession.key ? '' : 'secondary'} xs-btn" onclick="histSelectedSessionKey='${esc(s.key)}';wcCompareTargetKey=null;render()">${esc(s.title)}</button>`).join('')}
    </div>` : ''}
    ${renderComparisonCardInner(activeSession.key, false)}
  </section>`;
}

// ============================================================================
// 追加機能③：実績解除・バッジ（ACHIEVEMENTS）
// ============================================================================
let achShowTargetEdit = false;
let achSelectedId = null;
let achBannerTimer = 0;

function actualBestLift(sourceDb, exId) {
  const valid = (sourceDb.sets || []).filter(s => s.e === exId && s.mode !== 'body' && (s.tag || 'work') !== 'warmup' && s.reps >= 1 && s.w > 0);
  if (!valid.length) return {best: 0, firstFor: () => null, hasLift: false};
  const sorted = [...valid].sort((a, b) => a.date.localeCompare(b.date));
  const maxW = Math.max(...valid.map(s => s.w));
  return {
    best: maxW,
    hasLift: true,
    firstFor: target => sorted.find(s => s.w >= target)?.date || null
  };
}

function computeAchievements(sourceDb = db) {
  const t = sourceDb.achievementTargets || DEFAULT_ACH_TARGETS;
  const bench = actualBestLift(sourceDb, 'e0');
  const squat = actualBestLift(sourceDb, 'e20');
  const dead = actualBestLift(sourceDb, 'e8');

  // BIG3実測合計：3種目すべての有効な実測自己ベストが揃った場合のみ算出
  const big3ReadyCount = [bench.hasLift, squat.hasLift, dead.hasLift].filter(Boolean).length;
  const big3Ready = big3ReadyCount === 3;
  const big3Total = big3Ready ? bench.best + squat.best + dead.best : 0;
  let big3FirstDate = null;
  if (big3Ready && big3Total >= t.big3) {
    const dates = [...new Set((sourceDb.sets || []).filter(s => ['e0', 'e20', 'e8'].includes(s.e) && s.mode !== 'body' && (s.tag || 'work') !== 'warmup' && s.w > 0).map(s => s.date))].sort();
    let bMax = 0, sMax = 0, dMax = 0;
    for (const dt of dates) {
      for (const s of sourceDb.sets) {
        if (s.date !== dt || s.mode === 'body' || (s.tag || 'work') === 'warmup' || !(s.w > 0)) continue;
        if (s.e === 'e0' && s.w > bMax) bMax = s.w;
        if (s.e === 'e20' && s.w > sMax) sMax = s.w;
        if (s.e === 'e8' && s.w > dMax) dMax = s.w;
      }
      if (bMax > 0 && sMax > 0 && dMax > 0 && bMax + sMax + dMax >= t.big3) { big3FirstDate = dt; break; }
    }
  }

  // 重複を除いた完了ワークアウト数（セット完了セッション ＋ 別日のApple Watch完了セッション）
  const setSessions = buildCompletedSessions(sourceDb);
  const coveredWatchKeys = new Set(setSessions.filter(s => s.watch).map(s => workoutKey(s.watch)));
  const extraWatch = (sourceDb.watchWorkouts || []).filter(w => !coveredWatchKeys.has(workoutKey(w)));
  const allWorkoutDates = [
    ...setSessions.map(s => s.date),
    ...extraWatch.map(w => w.date)
  ].sort();
  const totalWorkouts = allWorkoutDates.length;
  const nthWorkoutDate = n => allWorkoutDates.length >= n ? allWorkoutDates[n - 1] : null;

  // 実際に完了したセット数
  const completedSets = [...(sourceDb.sets || [])].sort((a, b) => a.date.localeCompare(b.date));
  const totalSets = completedSets.length;
  const nthSetDate = n => completedSets.length >= n ? completedSets[n - 1].date : null;

  // 体重実績
  const sortedWeights = [...(sourceDb.weights || [])].sort((a, b) => a.date.localeCompare(b.date));
  const maxBodyKg = sortedWeights.length ? Math.max(...sortedWeights.map(w => w.kg)) : 0;
  const bodyFirstDate = sortedWeights.find(w => w.kg >= t.body1)?.date || null;

  const defs = [
    {id: 'bench1', icon: 'bar', title: `ベンチ ${fmt(t.bench1)}kg`, cond: `ベンチプレス実測 ${fmt(t.bench1)}kg 以上を成功`, cur: bench.best, target: t.bench1, unit: 'kg', firstDate: bench.firstFor(t.bench1)},
    {id: 'bench2', icon: 'bar', title: `ベンチ ${fmt(t.bench2)}kg`, cond: `ベンチプレス実測 ${fmt(t.bench2)}kg 以上を成功`, cur: bench.best, target: t.bench2, unit: 'kg', firstDate: bench.firstFor(t.bench2)},
    {id: 'bench3', icon: 'crown', title: `ベンチ ${fmt(t.bench3)}kg`, cond: `ベンチプレス実測 ${fmt(t.bench3)}kg 以上を成功`, cur: bench.best, target: t.bench3, unit: 'kg', firstDate: bench.firstFor(t.bench3)},
    {id: 'bench4', icon: 'star', title: `ベンチ ${fmt(t.bench4)}kg`, cond: `ベンチプレス実測 ${fmt(t.bench4)}kg 以上を成功`, cur: bench.best, target: t.bench4, unit: 'kg', firstDate: bench.firstFor(t.bench4)},
    {id: 'squat1', icon: 'bar', title: `スクワット ${fmt(t.squat1)}kg`, cond: `バーベルスクワット実測 ${fmt(t.squat1)}kg 以上を成功`, cur: squat.best, target: t.squat1, unit: 'kg', firstDate: squat.firstFor(t.squat1)},
    {id: 'dead1', icon: 'bolt', title: `デッド ${fmt(t.dead1)}kg`, cond: `デッドリフト実測 ${fmt(t.dead1)}kg 以上を成功`, cur: dead.best, target: t.dead1, unit: 'kg', firstDate: dead.firstFor(t.dead1)},
    {
      id: 'big3', icon: 'crown', title: `BIG3 ${fmt(t.big3)}kg`,
      cond: `ベンチ・スクワット・デッド3種目の実測ベスト合計 ${fmt(t.big3)}kg 以上`,
      cur: big3Ready ? big3Total : 0, target: t.big3, unit: 'kg',
      firstDate: big3FirstDate,
      progressLabel: big3Ready ? `${fmt(big3Total)} / ${fmt(t.big3)} kg（B${fmt(bench.best)}+S${fmt(squat.best)}+D${fmt(dead.best)}）` : `実測 ${big3ReadyCount}/3 種目記録済み（3種目揃うと合計算出）`
    },
    {id: 'workouts1', icon: 'shield', title: `${fmt(t.workouts1)} ワークアウト`, cond: `重複を除いた完了セッション累計 ${fmt(t.workouts1)} 回`, cur: totalWorkouts, target: t.workouts1, unit: '回', firstDate: nthWorkoutDate(t.workouts1)},
    {id: 'workouts2', icon: 'shield', title: `${fmt(t.workouts2)} ワークアウト`, cond: `重複を除いた完了セッション累計 ${fmt(t.workouts2)} 回`, cur: totalWorkouts, target: t.workouts2, unit: '回', firstDate: nthWorkoutDate(t.workouts2)},
    {id: 'workouts3', icon: 'star', title: `${fmt(t.workouts3)} ワークアウト`, cond: `重複を除いた完了セッション累計 ${fmt(t.workouts3)} 回`, cur: totalWorkouts, target: t.workouts3, unit: '回', firstDate: nthWorkoutDate(t.workouts3)},
    {id: 'sets1', icon: 'bolt', title: `${fmt(t.sets1)} セット完了`, cond: `実際に完了した累計セット数 ${fmt(t.sets1)} セット`, cur: totalSets, target: t.sets1, unit: 'set', firstDate: nthSetDate(t.sets1)},
    {id: 'sets2', icon: 'bolt', title: `${fmt(t.sets2)} セット完了`, cond: `実際に完了した累計セット数 ${fmt(t.sets2)} セット`, cur: totalSets, target: t.sets2, unit: 'set', firstDate: nthSetDate(t.sets2)},
    {id: 'sets3', icon: 'crown', title: `${fmt(t.sets3)} セット完了`, cond: `実際に完了した累計セット数 ${fmt(t.sets3)} セット`, cur: totalSets, target: t.sets3, unit: 'set', firstDate: nthSetDate(t.sets3)},
    {id: 'body1', icon: 'scale', title: `体重 ${fmt(t.body1)}kg`, cond: `体重記録で ${fmt(t.body1)}kg 以上に到達`, cur: maxBodyKg, target: t.body1, unit: 'kg', firstDate: bodyFirstDate}
  ];

  return defs.map(item => {
    const unlocked = !!item.firstDate && item.cur >= item.target;
    const pct = item.id === 'big3' && !big3Ready ? Math.round(big3ReadyCount / 3 * 100) :
      Math.min(100, Math.max(0, Math.round((item.cur / item.target) * 100)));
    return {
      ...item,
      unlocked,
      pct,
      progressText: item.progressLabel || `${fmt(item.cur)} / ${fmt(item.target)} ${item.unit}`
    };
  });
}

// 記録追加・訂正・削除時に再計算し、新規解除のみ1回だけ控えめに通知
function syncUnlockedAchievements(targetDb = db, allowNotify = true) {
  const list = computeAchievements(targetDb);
  const prevMap = targetDb.unlockedAchievements || {};
  const nextMap = {};
  const newlyUnlocked = [];
  for (const b of list) {
    if (b.unlocked) {
      nextMap[b.id] = b.firstDate || prevMap[b.id] || today();
      if (!prevMap[b.id]) newlyUnlocked.push(b);
    }
  }
  targetDb.unlockedAchievements = nextMap;
  if (allowNotify && newlyUnlocked.length && targetDb.badgeNotify !== false) {
    showAchievementBanner(newlyUnlocked);
  }
  return newlyUnlocked;
}

function showAchievementBanner(badges) {
  const el = $('ach-toast');
  if (!el) return;
  clearTimeout(achBannerTimer);
  const main = badges[0];
  const extra = badges.length > 1 ? ` ほか${badges.length - 1}件` : '';
  el.innerHTML = `<div class="ach-banner-inner" onclick="elCloseAch()">
    ${renderHexBadgeSvg(main.icon, true, 40)}
    <div>
      <small class="tag">ACHIEVEMENT UNLOCKED</small>
      <strong>${esc(main.title)}${esc(extra)} を解除しました</strong>
    </div>
  </div>`;
  el.hidden = false;
  achBannerTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

function elCloseAch() {
  const el = $('ach-toast');
  if (el) el.hidden = true;
}

function renderHexBadgeSvg(icon, unlocked, size = 64) {
  const outerStroke = unlocked ? '#74b4ff' : '#2c3d57';
  const innerStroke = unlocked ? '#3c72be' : '#1f2c40';
  const bg1 = unlocked ? '#1b3968' : '#111927';
  const bg2 = unlocked ? '#0d1b33' : '#0d131e';
  const fg = unlocked ? '#dceaff' : '#4a5f7d';
  const accent = unlocked ? '#6bb0ff' : '#334663';
  const glyph = {
    bar: `<rect x="18" y="37" width="36" height="4" rx="2" fill="${fg}"/><rect x="15" y="29" width="5" height="20" rx="2" fill="${accent}"/><rect x="21" y="32" width="4" height="14" rx="1.5" fill="${fg}"/><rect x="52" y="29" width="5" height="20" rx="2" fill="${accent}"/><rect x="47" y="32" width="4" height="14" rx="1.5" fill="${fg}"/>`,
    crown: `<path d="M20 47L23 30l13 8 0-11 0 11 13-8 3 17Z" fill="none"/><path d="M20 46l3-15 9 7 4-10 4 10 9-7 3 15z" fill="${fg}"/><rect x="21" y="48" width="30" height="3.5" rx="1.5" fill="${accent}"/>`,
    star: `<path d="M36 22l4.3 9.2 10.1 1.2-7.5 6.9 2 10-8.9-5-8.9 5 2-10-7.5-6.9 10.1-1.2z" fill="${fg}"/>`,
    bolt: `<path d="M39 21L25 40h10l-3 15 15-20H37z" fill="${fg}"/>`,
    shield: `<path d="M36 22l14 5v11c0 9-6 15-14 18-8-3-14-9-14-18V27z" fill="${accent}" opacity=".35"/><path d="M36 24l12 4.3v9.5c0 7.6-5 12.8-12 15.6-7-2.8-12-8-12-15.6v-9.5z" fill="none" stroke="${fg}" stroke-width="2.2"/><path d="M30 39l4.2 4.2L43 34" fill="none" stroke="${fg}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    scale: `<rect x="22" y="25" width="28" height="28" rx="6" fill="none" stroke="${fg}" stroke-width="2.2"/><path d="M28 35a8 8 0 0 1 16 0" fill="none" stroke="${accent}" stroke-width="2"/><path d="M36 35l4-5" stroke="${fg}" stroke-width="2.2" stroke-linecap="round"/>`
  }[icon] || '';
  return `<svg width="${size}" height="${Math.round(size * 1.08)}" viewBox="0 0 72 78" aria-hidden="true">
    <polygon points="36,3 67,20 67,58 36,75 5,58 5,20" fill="${bg1}" stroke="${outerStroke}" stroke-width="${unlocked ? '2.4' : '1.5'}"/>
    <polygon points="36,9 61,23 61,55 36,69 11,55 11,23" fill="${bg2}" stroke="${innerStroke}" stroke-width="1.2"/>
    ${glyph}
  </svg>`;
}

function saveAchievementTargets(ev) {
  ev.preventDefault();
  for (const k of Object.keys(DEFAULT_ACH_TARGETS)) {
    const el = $('ach-t-' + k);
    if (el) {
      const v = +el.value;
      if (Number.isFinite(v) && v > 0) db.achievementTargets[k] = Math.round(v * 10) / 10;
    }
  }
  achShowTargetEdit = false;
  syncUnlockedAchievements(db, false);
  save();
  render();
  toast('実績バッジの目標値を更新しました');
}

function badgesView() {
  const list = computeAchievements(db);
  const unlockedCount = list.filter(b => b.unlocked).length;
  const sel = list.find(b => b.id === achSelectedId) || list[0];
  const t = db.achievementTargets;
  const targetLabels = [
    ['bench1', 'ベンチ1 (kg)'], ['bench2', 'ベンチ2 (kg)'], ['bench3', 'ベンチ3 (kg)'], ['bench4', 'ベンチ4 (kg)'],
    ['squat1', 'スクワット (kg)'], ['dead1', 'デッドリフト (kg)'], ['big3', 'BIG3合計 (kg)'], ['body1', '体重目標 (kg)'],
    ['workouts1', '累計トレ1 (回)'], ['workouts2', '累計トレ2 (回)'], ['workouts3', '累計トレ3 (回)'],
    ['sets1', '累計セット1'], ['sets2', '累計セット2'], ['sets3', '累計セット3']
  ];
  return `<section>
    <div class="sec-head">
      <div><span class="tag">ACHIEVEMENTS</span><h3 style="margin:2px 0 0">実績バッジ（${unlockedCount} / ${list.length} 解除）</h3></div>
      <div class="btn-group">
        <button type="button" class="${db.badgeNotify ? '' : 'secondary'} xs-btn" onclick="db.badgeNotify=!db.badgeNotify;save();render()">通知 ${db.badgeNotify ? 'ON' : 'OFF'}</button>
        <button type="button" class="secondary xs-btn" onclick="achShowTargetEdit=!achShowTargetEdit;render()">目標編集</button>
      </div>
    </div>
    ${progress(unlockedCount, list.length)}
    <small class="muted" style="display:block;margin-top:6px">重量実績は実測成功記録のみで判定し、推定MAXとは区別しています。連続日数ノルマはなく、休養を挟みながら積み上げられます。</small>
    ${achShowTargetEdit ? `<form class="sub-box" onsubmit="saveAchievementTargets(event)">
      <h4>各バッジの目標値をカスタマイズ</h4>
      <div class="grid">
        ${targetLabels.map(([k, lbl]) => `<label>${lbl}<input id="ach-t-${k}" type="number" min="1" step="0.5" value="${t[k]}"></label>`).join('')}
      </div>
      <button class="full sm-btn">目標値を保存して再判定</button>
    </form>` : ''}
    <div class="ach-grid">
      ${list.map(b => `<button type="button" class="ach-hex-card ${b.unlocked ? 'unlocked' : 'locked'} ${sel?.id === b.id ? 'chosen' : ''}" onclick="achSelectedId='${b.id}';render()">
        ${renderHexBadgeSvg(b.icon, b.unlocked, 60)}
        <strong>${esc(b.title)}</strong>
        <small>${b.unlocked ? `✓ ${esc(b.firstDate)}` : `${b.pct}%`}</small>
      </button>`).join('')}
    </div>
    ${sel ? `<div class="sub-box">
      <div class="sec-head">
        <strong>${esc(sel.title)} ${sel.unlocked ? '<span class="tag">［達成済み］</span>' : '<span class="muted">［未解除］</span>'}</strong>
        <small>初回達成日：${sel.unlocked ? esc(sel.firstDate) : '未達成'}</small>
      </div>
      <p class="muted" style="margin:6px 0">解除条件：${esc(sel.cond)}</p>
      <div class="bar" style="margin:6px 0"><i style="width:${sel.pct}%"></i></div>
      <small>現在進捗：${esc(sel.progressText)}</small>
    </div>` : ''}
  </section>`;
}
