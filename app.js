const CYCLE_MIN = 90;
const FALL_ASLEEP_MIN = 15;
const FAVORITES_KEY = 'sleepcycle.favorites.v1';
const PIN_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.26L21 9.27l-4.5 4.38L17.8 21 12 17.77 6.2 21l1.3-7.35L3 9.27l6.1-1.01z"/></svg>';

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
const favoritesRow = document.getElementById('favorites-row');
const addFavoriteBtn = document.getElementById('add-favorite');
const favoriteForm = document.getElementById('favorite-form');
const favoriteLabelInput = document.getElementById('favorite-label');
const favoriteTimeInput = document.getElementById('favorite-time');
const favoriteCancelBtn = document.getElementById('favorite-cancel');

let currentMode = 'wake';

function formatTime(date) {
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(date, reference) {
  const sameDay = date.toDateString() === reference.toDateString();
  return sameDay ? 'hoy' : 'mañana';
}

function timeAndDay(date, reference) {
  return { time: formatTime(date), day: formatDayLabel(date, reference) };
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

function timeMarkup(time, day, extraClass = '') {
  return `<span class="result-card__row-time ${extraClass}">${time}</span><span class="result-card__day">${day}</span>`;
}

function renderResults(items) {
  resultsEl.innerHTML = '';
  const cards = items.map((item) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    if (item.recommended) card.dataset.recommended = 'true';
    card.innerHTML = `
      <span class="result-card__time-wrap">${timeMarkup(item.time, item.day, 'result-card__row-time--primary')}</span>
      <span class="result-card__meta">
        <span class="result-card__cycles">${item.cycles} ciclos · ${item.hoursLabel}</span>
        ${item.recommended ? '<span class="result-card__badge">Recomendado</span>' : ''}
      </span>
      <button type="button" class="result-card__pin" data-pin-time="${item.time}" data-pin-label="Despertar · ${item.cycles} ciclos" aria-label="Guardar como hora favorita">${PIN_ICON}</button>
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
          <span class="result-card__time-wrap">${timeMarkup(item.bedTime.time, item.bedTime.day)}</span>
        </span>
        <span class="result-card__row">
          <span class="result-card__row-label">Dormir</span>
          <span class="result-card__time-wrap">${timeMarkup(item.sleepTime.time, item.sleepTime.day, 'result-card__row-time--primary')}</span>
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

function computeWakeResults() {
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
        bedTime: timeAndDay(bedTime, now),
        sleepTime: timeAndDay(sleepTime, now),
        hoursLabel: hoursLabel(cycles * CYCLE_MIN),
        recommended: cycles === 5 || cycles === 6,
      };
    })
    .sort((a, b) => a.date - b.date);

  renderBedtimeResults(items);
}

document.getElementById('calc-wake').addEventListener('click', computeWakeResults);

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
        ...timeAndDay(wake, now),
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

// --- Horas favoritas -------------------------------------------------

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(list) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch {
    // Safari private mode or storage full: favorites just won't persist.
  }
}

function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let favorites = loadFavorites();

function formatFavoriteTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatTime(d);
}

function renderFavorites() {
  favoritesRow.querySelectorAll('.favorite-chip').forEach((chip) => chip.remove());

  favorites.forEach((fav) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'favorite-chip';
    chip.dataset.id = fav.id;
    chip.innerHTML = `
      <span class="favorite-chip__label">${fav.label}</span>
      <span class="favorite-chip__time">${formatFavoriteTime(fav.time)}</span>
      <span class="favorite-chip__remove" data-remove="${fav.id}" role="button" aria-label="Eliminar ${fav.label}">×</span>
    `;
    favoritesRow.insertBefore(chip, addFavoriteBtn);
  });
}

function addFavorite(label, time) {
  const exists = favorites.some((f) => f.time === time && f.label === label);
  if (exists) return;
  favorites.push({ id: makeId(), label: label || 'Favorita', time });
  saveFavorites(favorites);
  renderFavorites();
}

function removeFavorite(id) {
  favorites = favorites.filter((f) => f.id !== id);
  saveFavorites(favorites);
  renderFavorites();
}

favoritesRow.addEventListener('click', (e) => {
  const removeTarget = e.target.closest('[data-remove]');
  if (removeTarget) {
    e.stopPropagation();
    removeFavorite(removeTarget.dataset.remove);
    return;
  }
  const chip = e.target.closest('.favorite-chip');
  if (!chip) return;
  const fav = favorites.find((f) => f.id === chip.dataset.id);
  if (!fav) return;
  wakeTimeInput.value = fav.time;
  if (currentMode !== 'wake') switchTab('wake');
  computeWakeResults();
});

function toggleFavoriteForm(show) {
  favoriteForm.hidden = !show;
  addFavoriteBtn.setAttribute('aria-expanded', String(show));
  if (show) {
    favoriteForm.offsetHeight; // force reflow so the transition runs
    requestAnimationFrame(() => {
      favoriteForm.dataset.visible = 'true';
    });
    favoriteLabelInput.focus();
  } else {
    delete favoriteForm.dataset.visible;
    favoriteForm.reset();
  }
}

addFavoriteBtn.addEventListener('click', () => {
  toggleFavoriteForm(favoriteForm.hidden);
});

favoriteCancelBtn.addEventListener('click', () => toggleFavoriteForm(false));

favoriteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!favoriteTimeInput.value) {
    favoriteTimeInput.focus();
    return;
  }
  addFavorite(favoriteLabelInput.value.trim(), favoriteTimeInput.value);
  toggleFavoriteForm(false);
});

resultsEl.addEventListener('click', (e) => {
  const pinBtn = e.target.closest('.result-card__pin');
  if (!pinBtn) return;
  addFavorite(pinBtn.dataset.pinLabel, pinBtn.dataset.pinTime);
  pinBtn.dataset.pinned = 'true';
  pinBtn.classList.remove('pulse');
  // eslint-disable-next-line no-unused-expressions
  pinBtn.offsetWidth; // restart the animation on repeated taps
  pinBtn.classList.add('pulse');
});

renderFavorites();

// --- Weekly health report (hidden scaffold) ---------------------------
// Stays hidden until Health Auto Export + the sync backend are set up
// (targeted for 2026-08-05). Preview with ?beta=health in the URL.
if (new URLSearchParams(location.search).get('beta') === 'health') {
  const reportSection = document.getElementById('report-section');
  if (reportSection) reportSection.hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
