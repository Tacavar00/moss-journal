import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addSession,
  buildDoctorExportCsv,
  computeInsights,
  createBreakPlanFromForm,
  createSessionFromForm,
  decryptBackup,
  encryptBackup,
  getBreakProgress,
  getReentryProtocol,
  normalizeState,
} from '../src/logic.js'

test('create session and compute sleep insight', () => {
  let state = normalizeState({})

  state = addSession(
    state,
    createSessionFromForm({
      productName: 'Night gummies',
      strainName: 'Blueberry',
      dose: 10,
      method: 'Edible',
      sessionAt: '2026-04-10T21:00',
      contextTag: 'Sleep',
      notes: 'Strong sleep support',
      sleep: 9,
      pain: 8,
      anxiety: 8,
      mood: 7,
      focus: 3,
    })
  )

  state = addSession(
    state,
    createSessionFromForm({
      productName: 'Day tincture',
      strainName: '1:1',
      dose: 4,
      method: 'Tincture',
      sessionAt: '2026-04-11T17:30',
      contextTag: 'After work',
      notes: 'Steady calm',
      sleep: 6,
      pain: 6,
      anxiety: 9,
      mood: 8,
      focus: 7,
    })
  )

  const insights = computeInsights(state)

  assert.equal(insights.topCards[0].title, 'Best for sleep')
  assert.match(insights.topCards[0].detail, /10mg edible/i)
})

test('break progress advances against the target plan', () => {
  const breakPlan = createBreakPlanFromForm({
    startDate: '2026-04-01',
    targetDays: 14,
    goal: 'Reset tolerance',
  })

  const progress = getBreakProgress(breakPlan, new Date('2026-04-08T10:00:00Z'))

  assert.equal(progress.streakDays, 8)
  assert.equal(progress.percentComplete, 57)
  assert.equal(progress.currentPhase, 'Stabilizing')
})

test('encrypted backups round-trip with the correct passphrase', async () => {
  const state = normalizeState({
    sessions: [
      {
        productName: 'Night gummies',
        dose: 10,
        method: 'Edible',
        sessionAt: '2026-04-10T21:00:00.000Z',
        effects: { sleep: 9, pain: 7, anxiety: 8, mood: 7, focus: 4 },
      },
    ],
  })

  const encrypted = await encryptBackup(state, 'correct horse battery staple')
  const restored = await decryptBackup(encrypted, 'correct horse battery staple')

  assert.equal(restored.sessions.length, 1)
  assert.equal(restored.sessions[0].productName, 'Night gummies')
})

test('encrypted backups also work without Buffer for browser-style execution', async () => {
  const originalBuffer = globalThis.Buffer
  globalThis.Buffer = undefined

  try {
    const state = normalizeState({
      sessions: [
        {
          productName: 'Night gummies',
          dose: 10,
          method: 'Edible',
          sessionAt: '2026-04-10T21:00:00.000Z',
          effects: { sleep: 9, pain: 7, anxiety: 8, mood: 7, focus: 4 },
        },
      ],
    })

    const encrypted = await encryptBackup(state, 'browser-mode-passphrase')
    const restored = await decryptBackup(encrypted, 'browser-mode-passphrase')

    assert.equal(restored.sessions[0].productName, 'Night gummies')
  } finally {
    globalThis.Buffer = originalBuffer
  }
})

test('doctor csv export includes a header and the session row', () => {
  const state = normalizeState({
    sessions: [
      {
        productName: 'Night gummies',
        strainName: 'Blueberry',
        dose: 10,
        method: 'Edible',
        sessionAt: '2026-04-10T21:00:00.000Z',
        contextTag: 'Sleep',
        notes: 'Worked well',
        effects: { sleep: 9, pain: 7, anxiety: 8, mood: 7, focus: 4 },
      },
    ],
  })

  const csv = buildDoctorExportCsv(state)

  assert.match(csv, /"date_time","product","strain","dose_mg","method"/i)
  assert.match(csv, /Night gummies/)
  assert.match(csv, /Blueberry/)
})

test('re-entry protocol starts below the recent average dose', () => {
  const sessions = [
    {
      productName: 'Night gummies',
      dose: 10,
      method: 'Edible',
      sessionAt: '2026-04-10T21:00:00.000Z',
      effects: { sleep: 9, pain: 7, anxiety: 8, mood: 7, focus: 4 },
    },
    {
      productName: 'Night gummies',
      dose: 12,
      method: 'Edible',
      sessionAt: '2026-04-08T21:00:00.000Z',
      effects: { sleep: 8, pain: 6, anxiety: 8, mood: 7, focus: 3 },
    },
  ]

  const steps = getReentryProtocol({ targetDays: 14 }, sessions)

  assert.match(steps[0], /5\.5mg/)
})
