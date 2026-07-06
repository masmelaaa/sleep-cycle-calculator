const CYCLE_MIN = 90;
const FALL_ASLEEP_MIN = 15;

const tabs = {
  wake: document.getElementById('tab-wake'),
  sleep: document.getElementById('tab-sleep'),
};
const panels = {
  wake: document.getElementById('panel-wake'),
  sleep: document.getElementById('panel-sleep'),
};
const thumb = document.querySelector('.segmented__thumb');
const resultsEl = document.getElementById('results');
const wakeTimeInput = document.getElementById('wake-time');
const nowReadout = document.getElementById('now-readout');

let currentMode = 'wake';

function formatTime(date) {
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(date, reference) {
  const sameDay = date.toDateString() === reference.toDateString();
  return sameDay ? 'hoy' : 'mañana';
}

function switchTab(mode) {
  if (mode === currentMode) return;
  currentMode = mode;

  tabs.wake.setAttribute('aria-selected', String(mode === 'wake'));
  tabs.sleep.setAttribute('aria-selected', String(mode === 'sleep'));
  thumb.setAttribute('data-pos', mode === 'wake' ? '0' : '1');

  const showEl = panels[mode];
  const hideEl = panels[mode === 'wake' ? 'sleep' : 'wake'];

  hideEl.hidden = true;
  showEl.hidden = false;
  showEl.classList.add('entering');
  // eslint-disable-next-line no-unused-expressions
  showEl.offsetHeight; // force reflow so the transition runs
  requestAnimationFrame(() => showEl.classList.remove('entering'));

  resultsEl.innerHTML = '';

  if (mode === 'sleep') updateNowReadout();
}

tabs.wake.addEventListener('click', () => switchTab('wake'));
tabs.sleep.addEventListener('click', () => switchTab('sleep'));

function updateNowReadout() {
  const now = new Date();
  nowReadout.innerHTML = `${formatTime(now)}<small>Hora actual</small>`;
}

setInterval(() => {
  if (currentMode === 'sleep') updateNowReadout();
}, 15000);

function mountCards(cards) {
  cards.forEach((card, i) => {
    resultsEl.appendChild(card);
    setTimeout(() => {
      requestAnimationFrame(() => {
        card.dataset.visible = 'true';
      });
    }, i * 60);
  });
}

function renderResults(items) {
  resultsEl.innerHTML = '';
  const cards = items.map((item) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    if (item.recommended) card.dataset.recommended = 'true';
    card.innerHTML = `
      <span class="result-card__time">${item.timeLabel}</span>
      <span class="result-card__meta">
        <span class="result-card__cycles">${item.cycles} ciclos · ${item.hoursLabel}</span>
        ${item.recommended ? '<span class="result-card__badge">Recomendado</span>' : ''}
      </span>
    `;
    return card;
  });
  mountCards(cards);
}

function renderBedtimeResults(items) {
  resultsEl.innerHTML = '';
  const cards = items.map((item) => {
    const card = document.createElement('div');
    card.className = 'result-card result-card--split';
    if (item.recommended) card.dataset.recommended = 'true';
    card.innerHTML = `
      <span class="result-card__times">
        <span class="result-card__row">
          <span class="result-card__row-label">Acostarse</span>
          <span class="result-card__row-time">${item.bedLabel}</span>
        </span>
        <span class="result-card__row">
          <span class="result-card__row-label">Dormir</span>
          <span class="result-card__row-time result-card__row-time--primary">${item.sleepLabel}</span>
        </span>
      </span>
      <span class="result-card__meta">
        <span class="result-card__cycles">${item.cycles} ciclos · ${item.hoursLabel}</span>
        ${item.recommended ? '<span class="result-card__badge">Recomendado</span>' : ''}
      </span>
    `;
    return card;
  });
  mountCards(cards);
}

function hoursLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

document.getElementById('calc-wake').addEventListener('click', () => {
  if (!wakeTimeInput.value) {
    wakeTimeInput.focus();
    return;
  }
  const [h, m] = wakeTimeInput.value.split(':').map(Number);
  const now = new Date();
  const wake = new Date(now);
  wake.setHours(h, m, 0, 0);
  if (wake <= now) wake.setDate(wake.getDate() + 1);

  const cyclesOptions = [6, 5, 4, 3];
  const items = cyclesOptions
    .map((cycles) => {
      const sleepTime = new Date(wake.getTime() - cycles * CYCLE_MIN * 60000);
      const bedTime = new Date(sleepTime.getTime() - FALL_ASLEEP_MIN * 60000);
      return {
        cycles,
        date: bedTime,
        bedLabel: `${formatTime(bedTime)} · ${formatDayLabel(bedTime, now)}`,
        sleepLabel: `${formatTime(sleepTime)} · ${formatDayLabel(sleepTime, now)}`,
        hoursLabel: hoursLabel(cycles * CYCLE_MIN),
        recommended: cycles === 5 || cycles === 6,
      };
    })
    .sort((a, b) => a.date - b.date);

  renderBedtimeResults(items);
});

document.getElementById('calc-sleep').addEventListener('click', () => {
  const now = new Date();
  const fallAsleepAt = new Date(now.getTime() + FALL_ASLEEP_MIN * 60000);

  const cyclesOptions = [3, 4, 5, 6];
  const items = cyclesOptions
    .map((cycles) => {
      const wake = new Date(fallAsleepAt.getTime() + cycles * CYCLE_MIN * 60000);
      return {
        cycles,
        date: wake,
        timeLabel: `${formatTime(wake)} · ${formatDayLabel(wake, now)}`,
        hoursLabel: hoursLabel(cycles * CYCLE_MIN),
        recommended: cycles === 5 || cycles === 6,
      };
    })
    .sort((a, b) => a.date - b.date);

  renderResults(items);
});

// Default the wake-time input to a sensible value (7:00 AM) on first load
if (!wakeTimeInput.value) {
  wakeTimeInput.value = '07:00';
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
