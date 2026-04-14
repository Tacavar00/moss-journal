export const STORAGE_KEY = 'moss-journal-state-v1'

export const DEFAULT_EFFECTS = {
  sleep: 6,
  pain: 6,
  anxiety: 6,
  mood: 6,
  focus: 6,
}

export const DEFAULT_STATE = {
  sessions: [],
  breakPlan: null,
  symptomLogs: [],
}

const OUTCOME_LABELS = {
  sleep: 'Sleep',
  pain: 'Pain relief',
  anxiety: 'Anxiety relief',
  mood: 'Mood lift',
  focus: 'Focus',
}

export function createId(prefix = 'entry') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeState(input) {
  const state = input && typeof input === 'object' ? input : {}

  return {
    sessions: Array.isArray(state.sessions)
      ? state.sessions
          .map((session) => normalizeSession(session))
          .sort((left, right) => right.sessionAt.localeCompare(left.sessionAt))
      : [],
    breakPlan: state.breakPlan ? normalizeBreakPlan(state.breakPlan) : null,
    symptomLogs: Array.isArray(state.symptomLogs)
      ? state.symptomLogs
          .map((log) => normalizeSymptomLog(log))
          .sort((left, right) => right.logDate.localeCompare(left.logDate))
      : [],
  }
}

export function normalizeSession(session) {
  const effects = {
    ...DEFAULT_EFFECTS,
    ...(session?.effects ?? {}),
  }

  return {
    id: session?.id ?? createId('session'),
    productName: session?.productName?.trim?.() || 'Untitled product',
    strainName: session?.strainName?.trim?.() || '',
    dose: Number(session?.dose ?? 0),
    method: session?.method?.trim?.() || 'Edible',
    sessionAt: normalizeDateTime(session?.sessionAt) ?? new Date().toISOString(),
    contextTag: session?.contextTag?.trim?.() || '',
    notes: session?.notes?.trim?.() || '',
    effects: {
      sleep: normalizeScore(effects.sleep),
      pain: normalizeScore(effects.pain),
      anxiety: normalizeScore(effects.anxiety),
      mood: normalizeScore(effects.mood),
      focus: normalizeScore(effects.focus),
    },
  }
}

export function normalizeBreakPlan(plan) {
  return {
    startDate: normalizeDate(plan?.startDate) ?? new Date().toISOString().slice(0, 10),
    targetDays: Math.max(3, Number(plan?.targetDays ?? 14)),
    goal: plan?.goal?.trim?.() || '',
  }
}

export function normalizeSymptomLog(log) {
  return {
    id: log?.id ?? createId('symptom'),
    logDate: normalizeDate(log?.logDate) ?? new Date().toISOString().slice(0, 10),
    severity: normalizeScore(log?.severity),
    symptomNote: log?.symptomNote?.trim?.() || 'General discomfort',
  }
}

export function createSessionFromForm(data) {
  return normalizeSession({
    id: createId('session'),
    productName: data.productName,
    strainName: data.strainName,
    dose: data.dose,
    method: data.method,
    sessionAt: data.sessionAt,
    contextTag: data.contextTag,
    notes: data.notes,
    effects: {
      sleep: data.sleep,
      pain: data.pain,
      anxiety: data.anxiety,
      mood: data.mood,
      focus: data.focus,
    },
  })
}

export function createBreakPlanFromForm(data) {
  return normalizeBreakPlan({
    startDate: data.startDate,
    targetDays: data.targetDays,
    goal: data.goal,
  })
}

export function createSymptomLogFromForm(data) {
  return normalizeSymptomLog({
    id: createId('symptom'),
    logDate: data.logDate,
    severity: data.severity,
    symptomNote: data.symptomNote,
  })
}

export function addSession(state, session) {
  return normalizeState({
    ...state,
    sessions: [session, ...state.sessions],
  })
}

export function updateBreakPlan(state, breakPlan) {
  return normalizeState({
    ...state,
    breakPlan,
  })
}

export function addSymptomLog(state, symptomLog) {
  return normalizeState({
    ...state,
    symptomLogs: [symptomLog, ...state.symptomLogs],
  })
}

export function formatSessionDate(isoDateTime) {
  const parsed = new Date(isoDateTime)
  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatDate(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00`)
  return parsed.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function computeDashboard(state) {
  const normalized = normalizeState(state)
  const sessions = normalized.sessions
  const insights = computeInsights(normalized)
  const breakProgress = getBreakProgress(normalized.breakPlan)

  return {
    sessionCount: sessions.length,
    lastSessionLabel: sessions[0]
      ? `${sessions[0].productName} on ${formatSessionDate(sessions[0].sessionAt)}`
      : 'No sessions yet',
    topOutcome: insights.topCards[0]
      ? `${insights.topCards[0].title}`
      : 'Waiting for data',
    topOutcomeDetail: insights.topCards[0]
      ? insights.topCards[0].detail
      : 'Log a few sessions to unlock it.',
    breakLabel: normalized.breakPlan
      ? `${breakProgress.streakDays} day${breakProgress.streakDays === 1 ? '' : 's'}`
      : '0 days',
    breakDetail: normalized.breakPlan
      ? `${breakProgress.percentComplete}% of ${normalized.breakPlan.targetDays}-day plan`
      : 'Start a tolerance break when ready.',
  }
}

export function computeInsights(state) {
  const normalized = normalizeState(state)
  const sessions = normalized.sessions

  if (!sessions.length) {
    return {
      topCards: [],
      averageEffects: createAverageEffects([]),
    }
  }

  const grouped = new Map()

  for (const session of sessions) {
    const key = `${session.method}::${session.productName}::${session.strainName || 'general'}`
    const bucket = grouped.get(key) ?? {
      key,
      productName: session.productName,
      strainName: session.strainName,
      method: session.method,
      doseTotal: 0,
      count: 0,
      effectTotals: createEmptyTotals(),
    }

    bucket.count += 1
    bucket.doseTotal += session.dose
    bucket.effectTotals.sleep += session.effects.sleep
    bucket.effectTotals.pain += session.effects.pain
    bucket.effectTotals.anxiety += session.effects.anxiety
    bucket.effectTotals.mood += session.effects.mood
    bucket.effectTotals.focus += session.effects.focus
    grouped.set(key, bucket)
  }

  const groups = [...grouped.values()].map((bucket) => {
    const averages = averageEffectsFromTotals(bucket.effectTotals, bucket.count)
    const calmScore = (averages.anxiety + averages.mood) / 2
    const balanceScore =
      (averages.sleep + averages.pain + averages.anxiety + averages.mood + averages.focus) / 5

    return {
      label: `${round(bucket.doseTotal / bucket.count, 1)}mg ${bucket.method.toLowerCase()}${bucket.strainName ? ` • ${bucket.strainName}` : ''}`,
      detail: `${bucket.productName}${bucket.count > 1 ? ` across ${bucket.count} logs` : ''}`,
      averages,
      calmScore,
      balanceScore,
      count: bucket.count,
    }
  })

  const bestSleep = maxBy(groups, (group) => group.averages.sleep)
  const bestPain = maxBy(groups, (group) => group.averages.pain)
  const bestCalm = maxBy(groups, (group) => group.calmScore)
  const bestBalance = maxBy(groups, (group) => group.balanceScore)

  const cards = [
    bestSleep
      ? {
          title: 'Best for sleep',
          detail: `${bestSleep.label} is averaging ${round(bestSleep.averages.sleep, 1)}/10 sleep support.`,
          chip: 'Sleep',
        }
      : null,
    bestPain
      ? {
          title: 'Best for pain relief',
          detail: `${bestPain.label} is averaging ${round(bestPain.averages.pain, 1)}/10 for pain relief.`,
          chip: 'Pain',
        }
      : null,
    bestCalm
      ? {
          title: 'Best for calm',
          detail: `${bestCalm.label} is averaging ${round(bestCalm.calmScore, 1)}/10 across anxiety relief and mood.`,
          chip: 'Calm',
        }
      : null,
    bestBalance
      ? {
          title: 'Most balanced option',
          detail: `${bestBalance.label} is your most consistent all-around session pattern.`,
          chip: 'Balanced',
        }
      : null,
  ].filter(Boolean)

  return {
    topCards: cards,
    averageEffects: createAverageEffects(sessions),
  }
}

export function getBreakProgress(breakPlan, now = new Date()) {
  if (!breakPlan) {
    return {
      streakDays: 0,
      percentComplete: 0,
      currentPhase: 'Not started',
    }
  }

  const start = new Date(`${breakPlan.startDate}T00:00:00`)
  const diff = now.getTime() - start.getTime()
  const streakDays = Math.max(0, Math.floor(diff / 86400000) + 1)
  const percentComplete = Math.min(100, round((streakDays / breakPlan.targetDays) * 100, 0))

  let currentPhase = 'Reset'
  if (streakDays >= Math.ceil(breakPlan.targetDays * 0.66)) {
    currentPhase = 'Re-entry ready'
  } else if (streakDays >= Math.ceil(breakPlan.targetDays * 0.33)) {
    currentPhase = 'Stabilizing'
  }

  return {
    streakDays,
    percentComplete,
    currentPhase,
  }
}

export function getReentryProtocol(breakPlan, sessions) {
  const recentSessions = normalizeState({ sessions }).sessions.slice(0, 6)
  const averageDose =
    recentSessions.length > 0
      ? recentSessions.reduce((sum, session) => sum + session.dose, 0) / recentSessions.length
      : 10
  const reentryDose = Math.max(1, round(averageDose * 0.5, 1))

  const target = breakPlan?.targetDays ?? 14

  return [
    `Restart at roughly ${reentryDose}mg or half of your usual dose on day one.`,
    `Give the first session at least ${target >= 14 ? '48' : '24'} hours before the second one so you can read the response clearly.`,
    'Log onset timing, body feel, sleep quality, and any anxious rebound the same night.',
    'Stay with the lowest effective dose for three sessions before increasing.',
  ]
}

export function buildDoctorExportCsv(state) {
  const normalized = normalizeState(state)
  const header = [
    'date_time',
    'product',
    'strain',
    'dose_mg',
    'method',
    'context',
    'sleep',
    'pain_relief',
    'anxiety_relief',
    'mood',
    'focus',
    'notes',
  ]

  const rows = normalized.sessions.map((session) => [
    session.sessionAt,
    session.productName,
    session.strainName,
    session.dose,
    session.method,
    session.contextTag,
    session.effects.sleep,
    session.effects.pain,
    session.effects.anxiety,
    session.effects.mood,
    session.effects.focus,
    session.notes,
  ])

  return [header, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(',')
    )
    .join('\n')
}

export async function encryptBackup(state, passphrase) {
  if (!passphrase) {
    throw new Error('Passphrase required for encrypted export.')
  }

  const normalized = normalizeState(state)
  const payload = new TextEncoder().encode(JSON.stringify(normalized))
  const cryptoObject = await getCrypto()
  const salt = cryptoObject.getRandomValues(new Uint8Array(16))
  const iv = cryptoObject.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, cryptoObject)
  const encrypted = await cryptoObject.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload)

  return {
    version: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    payload: toBase64(new Uint8Array(encrypted)),
  }
}

export async function decryptBackup(packageObject, passphrase) {
  if (!packageObject || typeof packageObject !== 'object') {
    throw new Error('Invalid encrypted backup payload.')
  }
  if (!passphrase) {
    throw new Error('Passphrase required for import.')
  }

  const cryptoObject = await getCrypto()
  const salt = fromBase64(packageObject.salt)
  const iv = fromBase64(packageObject.iv)
  const encrypted = fromBase64(packageObject.payload)
  const key = await deriveKey(passphrase, salt, cryptoObject)
  const decrypted = await cryptoObject.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
  const decoded = JSON.parse(new TextDecoder().decode(decrypted))
  return normalizeState(decoded)
}

export function createDemoState() {
  return normalizeState({
    sessions: [
      {
        productName: 'Night gummies',
        strainName: 'Blueberry indica',
        dose: 10,
        method: 'Edible',
        sessionAt: dateTimeDaysAgo(1, 20),
        contextTag: 'Sleep',
        notes: 'Fast onset for an edible. Slept through the night with no grogginess.',
        effects: { sleep: 9, pain: 7, anxiety: 8, mood: 7, focus: 4 },
      },
      {
        productName: 'Balanced tincture',
        strainName: '1:1 CBD THC',
        dose: 6,
        method: 'Tincture',
        sessionAt: dateTimeDaysAgo(3, 19),
        contextTag: 'Post-work unwind',
        notes: 'Calm without feeling sedated. Helped jaw tension.',
        effects: { sleep: 7, pain: 6, anxiety: 9, mood: 8, focus: 6 },
      },
      {
        productName: 'Night gummies',
        strainName: 'Blueberry indica',
        dose: 10,
        method: 'Edible',
        sessionAt: dateTimeDaysAgo(6, 20),
        contextTag: 'Sleep',
        notes: 'Best sleep of the week. Mild dry mouth only.',
        effects: { sleep: 9, pain: 8, anxiety: 8, mood: 7, focus: 3 },
      },
    ],
    breakPlan: {
      startDate: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10),
      targetDays: 14,
      goal: 'Reset tolerance before returning to evenings only.',
    },
    symptomLogs: [
      {
        logDate: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
        severity: 6,
        symptomNote: 'Irritable after dinner, but cravings eased with tea and a walk.',
      },
      {
        logDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
        severity: 3,
        symptomNote: 'Dreams are vivid. Sleep onset finally improving.',
      },
    ],
  })
}

function normalizeScore(value) {
  return Math.min(10, Math.max(1, Math.round(Number(value ?? 6))))
}

function normalizeDate(date) {
  if (!date) return null
  const value = String(date).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function normalizeDateTime(dateTime) {
  if (!dateTime) return null
  const parsed = new Date(dateTime)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function createEmptyTotals() {
  return {
    sleep: 0,
    pain: 0,
    anxiety: 0,
    mood: 0,
    focus: 0,
  }
}

function averageEffectsFromTotals(totals, count) {
  return {
    sleep: totals.sleep / count,
    pain: totals.pain / count,
    anxiety: totals.anxiety / count,
    mood: totals.mood / count,
    focus: totals.focus / count,
  }
}

function createAverageEffects(sessions) {
  if (!sessions.length) {
    return Object.entries(OUTCOME_LABELS).map(([key, label]) => ({
      key,
      label,
      average: 0,
    }))
  }

  const totals = sessions.reduce((sum, session) => {
    sum.sleep += session.effects.sleep
    sum.pain += session.effects.pain
    sum.anxiety += session.effects.anxiety
    sum.mood += session.effects.mood
    sum.focus += session.effects.focus
    return sum
  }, createEmptyTotals())

  return Object.entries(OUTCOME_LABELS).map(([key, label]) => ({
    key,
    label,
    average: round(totals[key] / sessions.length, 1),
  }))
}

function round(value, precision = 1) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function maxBy(items, scorer) {
  if (!items.length) return null
  return items.reduce((best, item) => (scorer(item) > scorer(best) ? item : best))
}

function dateTimeDaysAgo(daysAgo, hour) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

async function getCrypto() {
  if (globalThis.crypto?.subtle) {
    return globalThis.crypto
  }

  const nodeCrypto = await import('node:crypto')
  return nodeCrypto.webcrypto
}

async function deriveKey(passphrase, salt, cryptoObject) {
  const baseKey = await cryptoObject.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return cryptoObject.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 150000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function toBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function fromBase64(value) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64')
  }

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
