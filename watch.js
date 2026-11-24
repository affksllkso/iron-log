'use strict';

const watchTypes = {
  traditionalStrengthTraining: '従来型筋力トレーニング',
  functionalStrengthTraining: '機能的筋力トレーニング'
};
const healthySyncKey = 'ironlog-healthy-sync';
let healthySyncRunning = false;

function workoutTimestamp(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error('Invalid workout timestamp');
  }
  const day = value.slice(0, 10);
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw new Error('Invalid workout date');
  }
  return new Date(value).toISOString();
}

function normalizeWorkout(row) {
  if (!row || !Object.hasOwn(watchTypes, row.type)) throw new Error('Unknown workout type');
  const start = workoutTimestamp(row.start);
  const end = workoutTimestamp(row.end);
  if (end <= start) throw new Error('Invalid workout interval');
  const workout = {type: row.type, date: row.start.slice(0, 10), time: row.start.slice(11, 16), start, end};
  for (const field of ['minutes', 'kcal', 'bpm']) {
    const input = row[field];
    if (input == null || input === '') continue;
    if (typeof input !== 'number' && (typeof input !== 'string' || !/^\d+(?:\.\d+)?$/.test(input.trim()))) {
      throw new Error('Invalid workout metric');
    }
    const value = Number(input);
    if (!Number.isFinite(value) || value < 0 || (field !== 'kcal' && value === 0)) {
      throw new Error('Invalid workout metric');
    }
    workout[field] = value;
  }
  return workout;
}

function workoutKey(workout) {
  return [workout.type, workout.start.slice(0, 19), workout.end.slice(0, 19)].join('/');
}

function validWorkoutBackup(rows) {
  if (rows === undefined) return true;
  if (!Array.isArray(rows)) return false;
  try {
    const keys = new Set();
    return rows.every(row => {
      const normalized = normalizeWorkout(row);
      const key = workoutKey(normalized);
      if (row.start !== normalized.start || row.end !== normalized.end ||
          !validDate(row.date) || new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date ||
          typeof row.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.time) ||
          keys.has(key) || ['minutes', 'kcal', 'bpm'].some(field => row[field] !== normalized[field])) return false;
      keys.add(key);
      return true;
    });
  } catch {
    return false;
  }
}

function watchWorkouts(day) {
  return (db.watchWorkouts ?? []).filter(workout => !day || workout.date === day)
    .sort((a, b) => b.start.localeCompare(a.start));
}

function workoutDuration(workout) {
  return workout.minutes ?? (Date.parse(workout.end) - Date.parse(workout.start)) / 60000;
}

function workoutSummary(workout) {
  return [
    `${fmt(workoutDuration(workout))} 分${workout.minutes === undefined ? '（開始から終了まで）' : ''}`,
    ...(workout.kcal === undefined ? [] : [`${fmt(workout.kcal)} kcal`]),
    ...(workout.bpm === undefined ? [] : [`平均 ${fmt(workout.bpm)} bpm`])
  ].join(' / ');
}

const workoutRingMetrics = [
  {className: 'duration', label: '運動時間', unit: '分', value: workoutDuration},
  {className: 'energy', label: '消費カロリー', unit: 'kcal', value: workout => workout.kcal},
  {className: 'heart', label: '平均心拍', unit: 'bpm', value: workout => workout.bpm}
];

function workoutRingCards(workouts) {
  if (!workouts.length) return '';
  const history = db.watchWorkouts ?? [];
  const metrics = workoutRingMetrics.map(metric => ({
    ...metric,
    max: history.reduce((max, workout) => Math.max(max, metric.value(workout) ?? 0), 0)
  }));

  return workouts.map(workout => `
    <article class="workout-card">
      <header class="workout-card-heading">
        <h4>${watchTypes[workout.type]}</h4>
        <time datetime="${esc(workout.start)}">${esc(workout.date)} ${esc(workout.time)}</time>
      </header>
      <dl class="workout-rings">
        ${metrics.map(metric => {
          const value = metric.value(workout);
          const label = metric.className === 'duration' && workout.minutes === undefined ? '経過時間' : metric.label;
          const fill = value == null || metric.max === 0 ? 0 : Math.min(100, 100 * value / metric.max);
          return `<div class="workout-metric workout-metric-${metric.className}">
            <dt>${label}</dt>
            <dd class="workout-ring" style="--ring-fill:${fill}%">
              ${value == null ? '<span class="workout-ring-missing">記録なし</span>' :
                `<strong>${fmt(value)}</strong><small>${metric.unit}</small>`}
            </dd>
          </div>`;
        }).join('')}
      </dl>
    </article>`).join('') + '<p class="workout-ring-scale">リング一周は、項目ごとの記録内最大値です。</p>';
}

function workoutEntries(workouts, showDelete = false) {
  return workouts.map(workout => `
    <div class="entry">
      <div>${esc(workout.date)} ${esc(workout.time)} / ${watchTypes[workout.type]}<br><small>${workoutSummary(workout)}</small></div>
      ${showDelete ? `<button class="danger" onclick="deleteWatchWorkout('${esc(workoutKey(workout))}')">削除</button>` : ''}
    </div>`).join('');
}

function mergeWatchWorkouts(workouts) {
  const previous = db;
  const merged = new Map(watchWorkouts().map(workout => [workoutKey(workout), workout]));
  const before = merged.size;
  let changed = false;
  for (const workout of workouts) {
    const key = workoutKey(workout);
    const existing = merged.get(key);
    const updated = existing ? {...workout, ...existing} : workout;
    for (const field of ['minutes', 'kcal', 'bpm']) {
      if (workout[field] !== undefined) updated[field] = workout[field];
    }
    if (Object.keys(updated).some(field => updated[field] !== existing?.[field])) {
      merged.set(key, updated);
      changed = true;
    }
  }
  if (!changed) return {changed: false, added: 0};

  db = {...db, watchWorkouts: [...merged.values()]};
  if (!save()) {
    db = previous;
    return null;
  }
  return {changed: true, added: merged.size - before};
}

function deleteWatchWorkout(key) {
  if (!confirm('このワークアウトを削除しますか？')) return;
  const previous = db;
  db = {...db, watchWorkouts: watchWorkouts().filter(workout => workoutKey(workout) !== key)};
  if (save()) render();
  else db = previous;
}

function healthySyncConfig() {
  try {
    return JSON.parse(localStorage.getItem(healthySyncKey));
  } catch {
    return null;
  }
}

async function readHealthyWorkouts(config) {
  const url = new URL('/api/iron-log/workouts', config.origin);
  url.searchParams.set('after', config.cursor);
  const response = await fetch(url, {
    headers: {Authorization: `Bearer ${config.token}`}, cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Sync request failed');
  const page = await response.json();
  if (!Array.isArray(page.workouts) || typeof page.more !== 'boolean' || !Number.isSafeInteger(page.cursor) ||
      page.cursor < config.cursor || (page.more && page.cursor <= config.cursor)) throw new Error('Invalid sync response');
  return {...page, workouts: page.workouts.map(normalizeWorkout)};
}

async function startHealthySync(event) {
  event.preventDefault();
  if (healthySyncRunning) return;
  healthySyncRunning = true;
  const submit = event.submitter;
  if (submit) submit.disabled = true;
  try {
    const url = new URL($('healthy-sync-url').value.trim());
    const token = $('healthy-sync-token').value.trim();
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        !/^[a-zA-Z0-9_-]{32,128}$/.test(token)) throw new Error('Invalid sync settings');
    const config = {origin: url.origin, token, cursor: 0};
    await readHealthyWorkouts(config);
    localStorage.setItem(healthySyncKey, JSON.stringify(config));
    render();
  } catch {
    toast('接続できませんでした。同期APIのURLと閲覧用トークンを確認してください。');
    return;
  } finally {
    healthySyncRunning = false;
    if (submit) submit.disabled = false;
  }
  syncHealthyWorkouts(true);
}

function stopHealthySync() {
  localStorage.removeItem(healthySyncKey);
  render();
  toast('HealthySyncの自動取り込みを停止しました。');
}

async function syncHealthyWorkouts(manual = false) {
  if (healthySyncRunning || !healthySyncConfig()) return;
  healthySyncRunning = true;
  const run = async () => {
    let config = healthySyncConfig();
    if (!config) return;
    let added = 0;
    let changed = false;
    let page;
    do {
      page = await readHealthyWorkouts(config);
      const current = healthySyncConfig();
      if (current?.origin !== config.origin || current.token !== config.token || current.cursor !== config.cursor) return;
      const result = mergeWatchWorkouts(page.workouts);
      if (!result) return;
      added += result.added;
      changed ||= result.changed;
      config = {...config, cursor: page.cursor};
      localStorage.setItem(healthySyncKey, JSON.stringify(config));
      if (result.changed && (manual || tab === 'home' || tab === 'history')) render();
    } while (page.more);
    if (added) toast(`HealthySyncから ${added} 件取り込みました。`);
    else if (manual) toast(changed ? 'ワークアウトを更新しました。' : '新しいワークアウトはありません。');
  };
  try {
    if (navigator.locks) await navigator.locks.request(healthySyncKey, run);
    else await run();
  } catch {
    if (manual) toast('同期できませんでした。通信状況と接続設定を確認してください。');
  } finally {
    healthySyncRunning = false;
  }
}

function watchSettings() {
  return `<section><h3>Apple Watch ワークアウト（HealthySync）</h3>
    ${healthySyncConfig() ? `<p class="muted">接続済み。IRON LOGを開いたときに新しいワークアウトを自動で取り込みます。</p>
      <button class="full" onclick="syncHealthyWorkouts(true)">今すぐ同期</button>
      <button class="full secondary" onclick="stopHealthySync()">接続を解除</button>` :
    `<p class="muted">HealthySync の同期APIと閲覧用トークンを設定すると、Apple Watch のワークアウトを自動で取り込みます。</p>
    <form onsubmit="startHealthySync(event)">
      <label>同期APIのURL<input id="healthy-sync-url" type="url" required autocapitalize="none"></label>
      <label>閲覧用トークン<input id="healthy-sync-token" type="password" required autocomplete="off"></label>
      <button class="full">接続する</button>
    </form>`}
    ${workoutEntries(watchWorkouts(), true)}
  </section>`;
}
