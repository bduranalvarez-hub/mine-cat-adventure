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

  // Guarda la mejor marca de cada jugador por modo en el ranking LOCAL
  // (también para el invitado) y, si hay backend Y cuenta vinculada, la
  // envía al ranking mundial sin bloquear el juego.
  //
  // Las dos rutas son INDEPENDIENTES a propósito: el ranking local y el
  // del servidor pueden estar desincronizados, así que una marca que no
  // mejora la copia local igual tiene que viajar. Antes un único
  // "return" cortaba la función cuando no había récord local y, de
  // paso, cancelaba el envío: tras reiniciar el ranking mundial el
  // récord local seguía en el dispositivo y el jugador desaparecía del
  // mundial hasta superarse a sí mismo.
  function submit(name, meters, modeKey) {
    if (!name || !Number.isFinite(meters) || meters <= 0) return;

    // 1) Ranking local: solo se reescribe si mejora la marca guardada.
    const list = loadAll();
    const existing = list.find((e) => e.name === name && e.mode === modeKey);
    if (!existing) {
      list.push({ name, meters, mode: modeKey, date: Date.now() });
      saveAll(capPerMode(list));
    } else if (meters > existing.meters) {
      existing.meters = meters;
      existing.date = Date.now();
      saveAll(capPerMode(list));
    }

    // 2) Ranking mundial: SIEMPRE se intenta. Enviar de más es inocuo
    // porque submit_score solo sobrescribe si la marca nueva supera a
    // la guardada en el servidor. Sin token no hay envío: el invitado
    // se queda con el ranking local de arriba.
    if (remoteEnabled()) {
      const token = typeof Account !== 'undefined' ? Account.sessionToken() : null;
      if (token) {
        Remote.submit(name, token, Math.floor(meters), modeKey).catch(() => {});
      }
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
