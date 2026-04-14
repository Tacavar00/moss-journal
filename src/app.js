import {
  STORAGE_KEY,
  DEFAULT_STATE,
  addSession,
  addSymptomLog,
  buildDoctorExportCsv,
  computeDashboard,
  computeInsights,
  createBreakPlanFromForm,
  createDemoState,
  createSessionFromForm,
  createSymptomLogFromForm,
  decryptBackup,
  encryptBackup,
  formatDate,
  formatSessionDate,
  getBreakProgress,
  getReentryProtocol,
  normalizeState,
  updateBreakPlan,
} from './logic.js'

let state = loadState()

const elements = {
  sessionForm: document.querySelector('#session-form'),
  breakForm: document.querySelector('#break-form'),
  symptomForm: document.querySelector('#symptom-form'),
  sessionList: document.querySelector('#session-list'),
  insightList: document.querySelector('#insight-list'),
  effectSummary: document.querySelector('#effect-summary'),
  breakSummary: document.querySelector('#break-summary'),
  breakPlanTitle: document.querySelector('#break-plan-title'),
  reentryList: document.querySelector('#reentry-list'),
  symptomList: document.querySelector('#symptom-list'),
  statusBanner: document.querySelector('#status-banner'),
  sessionCount: document.querySelector('#session-count'),
  lastSessionLabel: document.querySelector('#last-session-label'),
  topOutcomeLabel: document.querySelector('#top-outcome-label'),
  topOutcomeDetail: document.querySelector('#top-outcome-detail'),
  breakStreakLabel: document.querySelector('#break-streak-label'),
  breakStreakDetail: document.querySelector('#break-streak-detail'),
  backupStatusLabel: document.querySelector('#backup-status-label'),
  backupPassphrase: document.querySelector('#backup-passphrase'),
  backupImportText: document.querySelector('#backup-import-text'),
  exportJsonButton: document.querySelector('#export-json-button'),
  exportEncryptedButton: document.querySelector('#export-encrypted-button'),
  importEncryptedButton: document.querySelector('#import-encrypted-button'),
  exportCsvButton: document.querySelector('#export-csv-button'),
  loadDemoButton: document.querySelector('#load-demo-button'),
}

initialize()

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js')
    } catch (_error) {
      showStatus('Offline mode could not be enabled in this browser.', true)
    }
  }
}

function initialize() {
  registerServiceWorker()
  initializeDefaultDates()
  wireTabs()
  wireSliderOutputs()
  wireForms()
  wireActions()
  render()
}

function initializeDefaultDates() {
  const now = new Date()
  const dateTimeLocal = toDateTimeLocalValue(now)
  const dateOnly = now.toISOString().slice(0, 10)

  setValueIfEmpty(elements.sessionForm?.elements.sessionAt, dateTimeLocal)
  setValueIfEmpty(elements.breakForm?.elements.startDate, dateOnly)
  setValueIfEmpty(elements.symptomForm?.elements.logDate, dateOnly)
}

function wireTabs() {
  const tabButtons = [...document.querySelectorAll('.tab-button')]
  const panels = [...document.querySelectorAll('.tab-panel')]

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-tab-target')

      tabButtons.forEach((item) => {
        item.classList.remove('active')
        item.setAttribute('aria-selected', 'false')
      })

      panels.forEach((panel) => {
        panel.classList.remove('active')
        panel.hidden = true
      })

      button.classList.add('active')
      button.setAttribute('aria-selected', 'true')

      const panel = document.getElementById(targetId)
      panel.classList.add('active')
      panel.hidden = false
    })
  })
}

function wireSliderOutputs() {
  const sliders = [...document.querySelectorAll('input[type="range"]')]

  sliders.forEach((slider) => {
    const output = document.querySelector(`[data-output-for="${slider.name}"]`)
    const syncValue = () => {
      output.textContent = slider.value
    }
    slider.addEventListener('input', syncValue)
    syncValue()
  })
}

function wireForms() {
  elements.sessionForm?.addEventListener('submit', (event) => {
    event.preventDefault()
    const formData = new FormData(elements.sessionForm)
    const session = createSessionFromForm({
      productName: formData.get('productName'),
      strainName: formData.get('strainName'),
      dose: formData.get('dose'),
      method: formData.get('method'),
      sessionAt: formData.get('sessionAt'),
      contextTag: formData.get('contextTag'),
      notes: formData.get('notes'),
      sleep: formData.get('sleep'),
      pain: formData.get('pain'),
      anxiety: formData.get('anxiety'),
      mood: formData.get('mood'),
      focus: formData.get('focus'),
    })

    state = addSession(state, session)
    persistState()
    render()
    elements.sessionForm.reset()
    initializeDefaultDates()
    wireSliderOutputs()
    showStatus('Session saved locally.')
  })

  elements.breakForm?.addEventListener('submit', (event) => {
    event.preventDefault()
    const formData = new FormData(elements.breakForm)
    const breakPlan = createBreakPlanFromForm({
      startDate: formData.get('startDate'),
      targetDays: formData.get('targetDays'),
      goal: formData.get('goal'),
    })

    state = updateBreakPlan(state, breakPlan)
    persistState()
    render()
    showStatus('Tolerance break plan updated.')
  })

  elements.symptomForm?.addEventListener('submit', (event) => {
    event.preventDefault()
    const formData = new FormData(elements.symptomForm)
    const symptomLog = createSymptomLogFromForm({
      logDate: formData.get('logDate'),
      severity: formData.get('severity'),
      symptomNote: formData.get('symptomNote'),
    })

    state = addSymptomLog(state, symptomLog)
    persistState()
    render()
    elements.symptomForm.reset()
    initializeDefaultDates()
    showStatus('Symptom note added.')
  })
}

function wireActions() {
  elements.loadDemoButton?.addEventListener('click', () => {
    state = createDemoState()
    persistState()
    render()
    showStatus('Demo data loaded. Replace it with your own entries whenever you want.')
  })

  elements.exportJsonButton?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    downloadBlob(blob, 'moss-journal-backup.json')
    showStatus('JSON backup downloaded.')
  })

  elements.exportEncryptedButton?.addEventListener('click', async () => {
    try {
      const passphrase = elements.backupPassphrase.value.trim()
      const encrypted = await encryptBackup(state, passphrase)
      const blob = new Blob([JSON.stringify(encrypted, null, 2)], { type: 'application/json' })
      downloadBlob(blob, 'moss-journal-backup.encrypted.json')
      elements.backupStatusLabel.textContent = 'Encrypted backup ready'
      showStatus('Encrypted backup downloaded.')
    } catch (error) {
      showStatus(error.message, true)
    }
  })

  elements.importEncryptedButton?.addEventListener('click', async () => {
    try {
      const passphrase = elements.backupPassphrase.value.trim()
      const packageObject = JSON.parse(elements.backupImportText.value)
      state = await decryptBackup(packageObject, passphrase)
      persistState()
      render()
      showStatus('Encrypted backup restored.')
    } catch (error) {
      showStatus(`Import failed: ${error.message}`, true)
    }
  })

  elements.exportCsvButton?.addEventListener('click', () => {
    const csv = buildDoctorExportCsv(state)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, 'moss-journal-clinician-export.csv')
    showStatus('Doctor-friendly CSV downloaded.')
  })
}

function render() {
  const dashboard = computeDashboard(state)
  const insights = computeInsights(state)
  const breakProgress = getBreakProgress(state.breakPlan)

  elements.sessionCount.textContent = String(dashboard.sessionCount)
  elements.lastSessionLabel.textContent = dashboard.lastSessionLabel
  elements.topOutcomeLabel.textContent = dashboard.topOutcome
  elements.topOutcomeDetail.textContent = dashboard.topOutcomeDetail
  elements.breakStreakLabel.textContent = dashboard.breakLabel
  elements.breakStreakDetail.textContent = dashboard.breakDetail

  renderSessions()
  renderInsights(insights)
  renderBreakSection(breakProgress)
}

function renderSessions() {
  if (!state.sessions.length) {
    elements.sessionList.innerHTML = emptyState(
      'No sessions logged yet. Add the first one and the insight engine will start learning.'
    )
    return
  }

  elements.sessionList.innerHTML = state.sessions
    .map(
      (session) => `
        <article class="session-card">
          <header>
            <div>
              <h4 class="session-title">${escapeHtml(session.productName)}</h4>
              <div class="session-meta">${escapeHtml(formatSessionDate(session.sessionAt))}</div>
            </div>
            <span class="session-chip">${escapeHtml(session.method)}</span>
          </header>
          <div class="session-metrics">
            <span class="metric-pill">${session.dose}mg</span>
            ${session.strainName ? `<span class="metric-pill">${escapeHtml(session.strainName)}</span>` : ''}
            ${session.contextTag ? `<span class="metric-pill">${escapeHtml(session.contextTag)}</span>` : ''}
          </div>
          <div class="session-metrics">
            ${Object.entries(session.effects)
              .map(([key, value]) => `<span class="metric-pill">${escapeHtml(key)} ${value}/10</span>`)
              .join('')}
          </div>
          ${session.notes ? `<p class="session-note">${escapeHtml(session.notes)}</p>` : ''}
        </article>
      `
    )
    .join('')
}

function renderInsights(insights) {
  if (!insights.topCards.length) {
    elements.insightList.innerHTML = emptyState(
      'Insights appear after you log a few sessions with outcomes.'
    )
  } else {
    elements.insightList.innerHTML = insights.topCards
      .map(
        (card) => `
          <article class="insight-card">
            <header>
              <div>
                <h4 class="insight-title">${escapeHtml(card.title)}</h4>
                <p class="insight-copy">${escapeHtml(card.detail)}</p>
              </div>
              <span class="insight-chip">${escapeHtml(card.chip)}</span>
            </header>
          </article>
        `
      )
      .join('')
  }

  elements.effectSummary.innerHTML = insights.averageEffects
    .map(
      (item) => `
        <article class="effect-summary-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${item.average ? `${item.average}/10` : '—'}</strong>
        </article>
      `
    )
    .join('')
}

function renderBreakSection(breakProgress) {
  if (!state.breakPlan) {
    elements.breakPlanTitle.textContent = 'No active break'
    elements.breakSummary.innerHTML = emptyState(
      'Set a start date and a target length to begin tracking your reset.'
    )
  } else {
    elements.breakPlanTitle.textContent = `${state.breakPlan.targetDays}-day break`
    elements.breakSummary.innerHTML = `
      <div class="break-stats">
        <span class="metric-pill">Started ${escapeHtml(formatDate(state.breakPlan.startDate))}</span>
        <span class="metric-pill">${breakProgress.streakDays} days complete</span>
        <span class="metric-pill">${escapeHtml(breakProgress.currentPhase)}</span>
      </div>
      <div class="progress-track" aria-label="Break completion">
        <div class="progress-fill" style="width:${breakProgress.percentComplete}%"></div>
      </div>
      <p>${escapeHtml(state.breakPlan.goal || 'No explicit goal saved yet.')}</p>
    `
  }

  elements.reentryList.innerHTML = getReentryProtocol(state.breakPlan, state.sessions)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('')

  if (!state.symptomLogs.length) {
    elements.symptomList.innerHTML = emptyState(
      'Symptom notes will show up here during your tolerance break.'
    )
    return
  }

  elements.symptomList.innerHTML = state.symptomLogs
    .map(
      (log) => `
        <article class="symptom-card">
          <header>
            <strong>${escapeHtml(formatDate(log.logDate))}</strong>
            <span class="session-chip">${log.severity}/10</span>
          </header>
          <p class="session-note">${escapeHtml(log.symptomNote)}</p>
        </article>
      `
    )
    .join('')
}

function showStatus(message, isError = false) {
  elements.statusBanner.textContent = message
  elements.statusBanner.style.color = isError ? 'var(--danger)' : 'var(--accent-2)'
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return normalizeState(DEFAULT_STATE)
  }

  try {
    return normalizeState(JSON.parse(raw))
  } catch {
    return normalizeState(DEFAULT_STATE)
  }
}

function setValueIfEmpty(field, value) {
  if (field && !field.value) {
    field.value = value
  }
}

function toDateTimeLocalValue(date) {
  const offset = date.getTimezoneOffset()
  const normalized = new Date(date.getTime() - offset * 60000)
  return normalized.toISOString().slice(0, 16)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
