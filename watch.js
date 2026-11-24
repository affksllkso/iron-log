'use strict';

const watchTypes = {
  traditionalStrengthTraining: '従来型筋力トレーニング',
  functionalStrengthTraining: '機能的筋力トレーニング'
};
const exportWorkoutTypes = new Map(Object.entries({
  'traditional strength training': 'traditionalStrengthTraining',
  'functional strength training': 'functionalStrengthTraining',
  '従来型筋力トレーニング': 'traditionalStrengthTraining',
  '機能的筋力トレーニング': 'functionalStrengthTraining'
}));
const watchLinkPrefix = '#watch=';
const watchLinkKey = 'ironlog-watch-link';
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

// Shortcuts date formatting can omit fractional seconds.
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

function workoutSummary(workout) {
  const duration = workout.minutes ?? (Date.parse(workout.end) - Date.parse(workout.start)) / 60000;
  return [
    `${fmt(duration)} 分${workout.minutes === undefined ? '（開始から終了まで）' : ''}`,
    ...(workout.kcal === undefined ? [] : [`${fmt(workout.kcal)} kcal`]),
    ...(workout.bpm === undefined ? [] : [`平均 ${fmt(workout.bpm)} bpm`])
  ].join(' / ');
}

function workoutEntries(workouts, showDelete = false) {
  return workouts.map(workout => `
    <div class="entry">
      <div>${esc(workout.date)} ${esc(workout.time)} / ${watchTypes[workout.type]}<br><small>${workoutSummary(workout)}</small></div>
      ${showDelete ? `<button class="danger" onclick="deleteWatchWorkout('${esc(workoutKey(workout))}')">削除</button>` : ''}
    </div>`).join('');
}

function exportedStrengthWorkouts(data) {
  const rows = data?.data?.workouts ?? data?.workouts;
  if (!Array.isArray(rows)) throw new Error('Missing workouts');
  const iso = value => value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4');
  return rows.flatMap(row => {
    const type = exportWorkoutTypes.get(row?.name?.toLowerCase?.());
    if (!type) return [];
    const energy = row.activeEnergyBurned;
    const heart = row.heartRate?.avg ?? row.avgHeartRate;
    return [{
      type,
      start: iso(row.start),
      end: iso(row.end),
      minutes: typeof row.duration === 'number' && row.duration > 0 ? row.duration / 60 : undefined,
      kcal: energy?.units === 'kcal' ? energy.qty : energy?.units === 'kJ' ? energy.qty / 4.184 : undefined,
      bpm: ['count/min', 'bpm'].includes(heart?.units) ? heart.qty : undefined
    }];
  });
}

function importWatchWorkouts(raw, allowExport = false) {
  let workouts;
  try {
    const data = JSON.parse(raw.replace(/^\uFEFF/, ''));
    const rows = data?.format === 'iron-log-workouts-v1' ? data.workouts : allowExport ? exportedStrengthWorkouts(data) : null;
    if (!Array.isArray(rows)) throw new Error('Unknown workout format');
    workouts = rows.map(normalizeWorkout);
  } catch {
    toast('ワークアウトのJSON形式、日時、数値を確認してください。');
    return;
  }
  if (!workouts.length) {
    toast('筋力トレーニングのワークアウトが見つかりませんでした。');
    return;
  }

  const result = mergeWatchWorkouts(workouts);
  if (!result) return;
  if (!result.changed) {
    toast('取り込み済みのワークアウトです。');
    return;
  }
  render();
  toast(result.added ? `ワークアウトを ${result.added} 件取り込みました。` : 'ワークアウトを更新しました。');
}

function mergeWatchWorkouts(workouts) {
  const previous = db;
  const merged = new Map(watchWorkouts().map(workout => [workoutKey(workout), workout]));
  const before = merged.size;
  let changed = false;
  for (const workout of workouts) {
    const key = workoutKey(workout);
    const existing = merged.get(key);
    // Keep the local date and time used when this workout was first recorded.
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

async function importWatchClipboard() {
  let raw;
  try {
    raw = await navigator.clipboard.readText();
  } catch {
    toast('クリップボードを読めませんでした。設定からファイルを選択できます。');
    return;
  }
  importWatchWorkouts(raw);
}

function copyWatchLink() {
  try {
    let key = localStorage.getItem(watchLinkKey);
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(watchLinkKey, key);
    }
    copyText(`${new URL('./index.html', location.href).href}${watchLinkPrefix}${key}.`);
  } catch {
    toast('Safari連携用のURLを作成できませんでした。');
  }
}

function receiveWatchLink() {
  if (!location.hash.startsWith(watchLinkPrefix)) return;
  const fragment = location.hash.slice(watchLinkPrefix.length);
  try {
    window.history.replaceState(window.history.state, '', location.pathname + location.search);
    const key = localStorage.getItem(watchLinkKey);
    if (!key || !fragment.startsWith(`${key}.`)) {
      toast('このブラウザの設定からSafari連携用のURLをコピーしてください。');
      return;
    }
    importWatchWorkouts(decodeURIComponent(fragment.slice(key.length + 1)));
  } catch {
    toast('ワークアウトのURLを確認してください。');
  }
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

function healthySyncSettings() {
  return `<details><summary>HealthySyncで自動取り込み</summary>
    ${healthySyncConfig() ? `<p class="muted">接続済み。IRON LOGを開いたときに新しいワークアウトを取り込みます。</p>
      <button class="full secondary" onclick="syncHealthyWorkouts(true)">今すぐ同期</button>
      <button class="full secondary" onclick="stopHealthySync()">接続を解除</button>` :
    `<form onsubmit="startHealthySync(event)">
      <label>同期APIのURL<input id="healthy-sync-url" type="url" required autocapitalize="none"></label>
      <label>閲覧用トークン<input id="healthy-sync-token" type="password" required autocomplete="off"></label>
      <button class="full secondary">接続する</button>
    </form>`}</details>`;
}

function watchSettings() {
  return `<section><h3>Apple Watch ワークアウト</h3>
    ${healthySyncSettings()}
    <button class="full" onclick="importWatchClipboard()">ショートカットから取り込む</button>
    <label>ワークアウトのJSONファイル<input type="file" accept=".json,application/json" onchange="readFile(this,raw=>importWatchWorkouts(raw,true));this.value=''"></label>
    <details><summary>Safariで自動取り込み</summary>
      <p class="muted">SafariでIRON LOGを使う場合は、連携用のURLをショートカットに登録してください。ホーム画面のWebアプリでは上の取り込みボタンを使用します。</p>
      <button class="full secondary" onclick="copyWatchLink()">Safari連携用のURLをコピー</button>
    </details>
    ${workoutEntries(watchWorkouts(), true)}
  </section>`;
}
