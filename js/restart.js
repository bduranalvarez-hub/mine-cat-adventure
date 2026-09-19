'use strict';

// Reinicio de la página cuando el WebView deja el dibujo degradado.
//
// Medido en un móvil real (Redmi Note 11S, Mali-G57, WebView 152) con la app
// de diagnóstico: cada vez que la app queda tapada (un anuncio, apagar la
// pantalla, cambiar de app) el WebView puede volver pintando los lienzos por
// CPU. El juego pasa de 60 a ~8 fps y se queda así. Rehacer el lienzo, o
// todas las imágenes auxiliares, NO lo arregla; recargar la página SIEMPRE
// devuelve los 60 fps.
//
// Así que, al volver, se mide ~1 s. Si quedó lento, se guarda la partida en
// curso (sessionStorage sobrevive a la recarga), se recarga y el juego la
// restaura congelada en "toca para continuar". Solo en un momento seguro
// (ver hooks.safe en js/game.js): nunca con un anuncio en curso, con envíos
// al servidor a medias ni con la partida muerta.
const Restart = (() => {
  const KEY_SNAPSHOT = 'mca-resume';
  const KEY_LOG = 'mca-restarts';
  const KEY_STARTUP = 'mca-startup-checked';
  // Recargar no devolvió la fluidez (un móvil lento de verdad): no se
  // insiste en esta sesión y la lentitud la resuelve la calidad automática.
  const KEY_USELESS = 'mca-restart-useless';
  // El vigilante de la partida (ver requestFromPlay) actúa una vez por sesión.
  const KEY_WATCHDOG = 'mca-restart-watchdog';
  const SNAPSHOT_VERSION = 1;
  const SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;
  // Tope contra bucles: aunque cada recarga sirva, nunca más de estas en la
  // ventana. Los anuncios de monedas pueden verse seguidos.
  const MAX_RESTARTS = 5;
  const RESTART_WINDOW_MS = 5 * 60 * 1000;
  // Si la última recarga fue hace menos que esto, la página viene de ella:
  // al arrancar se mide si sirvió.
  const JUST_RESTARTED_MS = 20 * 1000;
  const AFTER_RESTART = 'tras-reinicio';
  // Los primeros cuadros tras volver siempre van peor: se esperan y luego se
  // mide un rato. Al arrancar la página se espera más, porque los primeros
  // pagan la carga de las imágenes. Por encima de SLOW_MS (~33 fps) se
  // considera degradado: el WebView degradado da 100-300 ms por cuadro.
  // Todo se cuenta en tiempo de FOTOGRAMAS, no de reloj: si el hilo se queda
  // parado (el aviso de monedas tras un anuncio es un alert que lo bloquea),
  // la medición espera en vez de agotarse sin muestras.
  const CHECK_DELAY_MS = 400;
  const BOOT_DELAY_MS = 1000;
  const CHECK_SPAN_MS = 1200;
  const CHECK_MIN_SAMPLES = 3;
  const SLOW_MS = 30;

  let hooks = null;   // { snapshot(): object|null, safe(): boolean }
  let check = null;   // medición en curso
  let pending = false; // hay que reiniciar en cuanto sea seguro
  // Ya se guardó la partida y la recarga está en marcha: el juego no debe
  // avanzar ni un fotograma más (ver Game.isRenderPaused). Si la vagoneta
  // chocaba en ese instante, pagehide cobraba la carrera y, al retomar la
  // copia de antes del choque, ese tramo se cobraba dos veces.
  let reloading = false;

  function readSession(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function writeSession(key, value) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function recentRestarts() {
    const now = Date.now();
    try {
      const list = JSON.parse(readSession(KEY_LOG) || '[]');
      return Array.isArray(list) ? list.filter((t) => now - t < RESTART_WINDOW_MS) : [];
    } catch (err) {
      return [];
    }
  }

  function log(what) {
    if (typeof Diag !== 'undefined') Diag.log(what);
  }

  function configure(h) {
    hooks = h;
  }

  function scheduleCheck(reason, delayMs = CHECK_DELAY_MS) {
    check = { reason, delayLeft: delayMs, spanLeft: CHECK_SPAN_MS, samples: [] };
  }

  // Al arrancar la página. Si viene de una recarga nuestra, se mide si
  // sirvió. Si no, se mide una vez por sesión del WebView: tras instalar o
  // actualizar, la primera sesión podía empezar ya degradada.
  function boot() {
    const recent = recentRestarts();
    const last = recent.length ? recent[recent.length - 1] : 0;
    if (Date.now() - last < JUST_RESTARTED_MS) {
      scheduleCheck(AFTER_RESTART, BOOT_DELAY_MS);
      return;
    }
    if (readSession(KEY_STARTUP)) return;
    writeSession(KEY_STARTUP, '1');
    scheduleCheck('inicio', BOOT_DELAY_MS);
  }

  function showOverlay() {
    const el = document.createElement('div');
    el.className = 'restart-overlay';
    el.textContent = typeof I18n !== 'undefined' ? I18n.t('reloading') : '…';
    document.body.appendChild(el);
  }

  function tryNow() {
    if (!pending || !hooks || !hooks.safe()) return;
    pending = false;
    const snap = hooks.snapshot();
    const saved = snap
      ? writeSession(KEY_SNAPSHOT, JSON.stringify({ v: SNAPSHOT_VERSION, t: Date.now(), ...snap }))
      : writeSession(KEY_SNAPSHOT, null);
    // Sin almacenamiento la partida se perdería: mejor seguir lento.
    if (snap && !saved) {
      log('reinicio-omitido (sin almacenamiento)');
      return;
    }
    writeSession(KEY_LOG, JSON.stringify([...recentRestarts(), Date.now()]));
    reloading = true;
    log('reiniciando');
    showOverlay();
    // Un respiro para que el aviso llegue a pintarse antes de recargar.
    setTimeout(() => location.reload(), 60);
  }

  // Pide un reinicio, que se hará en cuanto sea seguro. Devuelve false si
  // no se va a hacer: en este móvil recargar no sirve, o se llegó al tope.
  function request(reason) {
    if (pending) return true;
    // Con la calidad automática apagada en el panel de diagnóstico se quiere
    // ver el problema tal cual: tampoco se recarga (el botón sí fuerza).
    if (typeof Diag !== 'undefined' && !Diag.autoQuality()) {
      log(`reinicio-omitido (auto apagado) ${reason}`);
      return false;
    }
    if (readSession(KEY_USELESS)) {
      log(`reinicio-omitido (no sirve) ${reason}`);
      return false;
    }
    if (recentRestarts().length >= MAX_RESTARTS) {
      log(`reinicio-omitido (tope) ${reason}`);
      return false;
    }
    log(`degradado ${reason}`);
    pending = true;
    tryNow();
    return true;
  }

  // Vigilante para la lentitud extrema en plena partida sin un anuncio ni
  // una vuelta del fondo que la explique (p. ej. la que aparecía al empezar
  // a jugar tras instalar). Una sola vez por sesión: si la partida vuelve a
  // ir así de lenta, la resuelve la calidad automática.
  function requestFromPlay(ms) {
    if (readSession(KEY_WATCHDOG)) return false;
    // Si no se puede apuntar, tampoco se podría guardar la partida.
    if (!writeSession(KEY_WATCHDOG, '1')) return false;
    return request(`en partida (${Math.round(ms)} ms)`);
  }

  function finishCheck() {
    const sorted = check.samples.slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const reason = check.reason;
    check = null;
    const slow = median > SLOW_MS;
    const ms = Math.round(median);
    if (reason === AFTER_RESTART) {
      if (slow) writeSession(KEY_USELESS, '1');
      log(`${slow ? 'reinicio-inutil' : 'reinicio-ok'} (${ms} ms)`);
      return;
    }
    if (slow) request(`tras ${reason} (${ms} ms)`);
  }

  // Lo llama el bucle de main.js con el tiempo real de cada fotograma.
  function feed(ms) {
    if (pending) {
      tryNow();
      return;
    }
    if (!check) return;
    // Un fotograma de más de 1 s es el hilo detenido, no el dibujo.
    if (!Number.isFinite(ms) || ms <= 0 || ms >= 1000) return;
    if (check.delayLeft > 0) {
      check.delayLeft -= ms;
      return;
    }
    check.samples.push(ms);
    check.spanLeft -= ms;
    if (check.spanLeft <= 0 && check.samples.length >= CHECK_MIN_SAMPLES) finishCheck();
  }

  // Devuelve (y borra) la partida guardada antes de recargar, si es válida.
  function takeSnapshot() {
    const raw = readSession(KEY_SNAPSHOT);
    writeSession(KEY_SNAPSHOT, null);
    if (!raw) return null;
    try {
      const snap = JSON.parse(raw);
      if (!snap || snap.v !== SNAPSHOT_VERSION) return null;
      if (!Number.isFinite(snap.t) || Date.now() - snap.t > SNAPSHOT_MAX_AGE_MS) return null;
      return snap;
    } catch (err) {
      return null;
    }
  }

  // Mientras se mide o se espera para reiniciar, la calidad automática no
  // debe tocar nada: el problema es otro y se arregla recargando.
  function isBusy() {
    return Boolean(check) || pending || reloading;
  }

  function isReloading() {
    return reloading;
  }

  // Para el panel de diagnóstico: reiniciar ya (si es seguro), sin topes.
  function force() {
    pending = true;
    tryNow();
  }

  return {
    configure, boot, scheduleCheck, feed, requestFromPlay, takeSnapshot, isBusy, isReloading,
    force,
  };
})();
