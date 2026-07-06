'use strict';

// Jugador y ranking. Por ahora las puntuaciones se guardan en el
// dispositivo (localStorage). Para un ranking mundial de verdad,
// implementa `remoteSubmit` / `remoteTop` contra un backend
// (p. ej. Supabase o Firebase) y pon REMOTE en true.
const Leaderboard = (() => {
  const SCORES_KEY = 'mcc-ranking';
  const PLAYER_KEY = 'mcc-player';
  const MAX_ENTRIES = 100;
  const REMOTE = false;

  function loadAll() {
    try {
      const raw = localStorage.getItem(SCORES_KEY);
      const list = raw === null ? [] : JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveAll(list) {
    try {
      localStorage.setItem(SCORES_KEY, JSON.stringify(list));
    } catch (err) { /* sin almacenamiento: el ranking vive en memoria */ }
  }

  function getPlayer() {
    try {
      return localStorage.getItem(PLAYER_KEY) || '';
    } catch (err) {
      return '';
    }
  }

  function setPlayer(name) {
    try {
      localStorage.setItem(PLAYER_KEY, name);
    } catch (err) { /* sin almacenamiento */ }
  }

  // Guarda solo la mejor marca de cada jugador por modo.
  function submit(name, meters, modeKey) {
    if (!name || !Number.isFinite(meters) || meters <= 0) return;
    const list = loadAll();
    const existing = list.find((e) => e.name === name && e.mode === modeKey);
    if (existing) {
      if (meters <= existing.meters) return;
      existing.meters = meters;
      existing.date = Date.now();
    } else {
      list.push({ name, meters, mode: modeKey, date: Date.now() });
    }
    list.sort((a, b) => b.meters - a.meters);
    saveAll(list.slice(0, MAX_ENTRIES));
    if (REMOTE) {
      // remoteSubmit(name, meters, modeKey);
    }
  }

  function top(modeKey, n) {
    return loadAll()
      .filter((e) => e.mode === modeKey)
      .slice(0, n);
  }

  return { getPlayer, setPlayer, submit, top };
})();
