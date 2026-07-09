'use strict';

// Jugador y ranking. Guarda siempre una copia LOCAL en el dispositivo
// (para jugar sin conexión) y, si el backend está configurado en
// remote.js, también envía y lee el ranking MUNDIAL vía Supabase.
const Leaderboard = (() => {
  const SCORES_KEY = 'mca-ranking';
  const PLAYER_KEY = 'mca-player';
  const MAX_PER_MODE = 100;

  function remoteEnabled() {
    return typeof Remote !== 'undefined' && Remote.enabled();
  }

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

  // Deja como máximo MAX_PER_MODE entradas por modo (las mejores),
  // sin que un modo con distancias altas (Fácil) desplace a otro.
  function capPerMode(list) {
    const byMode = {};
    list.forEach((e) => {
      (byMode[e.mode] = byMode[e.mode] || []).push(e);
    });
    const out = [];
    Object.keys(byMode).forEach((mode) => {
      byMode[mode].sort((a, b) => b.meters - a.meters);
      out.push(...byMode[mode].slice(0, MAX_PER_MODE));
    });
    return out;
  }

  // Guarda solo la mejor marca de cada jugador por modo (local) y, si
  // hay backend, la envía al ranking mundial sin bloquear el juego.
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
    saveAll(capPerMode(list));
    if (remoteEnabled()) {
      Remote.submit(name, Math.floor(meters), modeKey).catch(() => {});
    }
  }

  // Ranking local (síncrono), ordenado por distancia descendente.
  function top(modeKey, n) {
    return loadAll()
      .filter((e) => e.mode === modeKey)
      .sort((a, b) => b.meters - a.meters)
      .slice(0, n);
  }

  // Ranking mundial (asíncrono). Lanza si el backend no está listo.
  function topGlobal(modeKey, n) {
    return Remote.top(modeKey, n);
  }

  return { getPlayer, setPlayer, submit, top, topGlobal, remoteEnabled };
})();
