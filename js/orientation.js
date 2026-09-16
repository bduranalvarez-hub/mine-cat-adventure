'use strict';

// Orientación de pantalla elegida por el jugador: vertical (por defecto)
// u horizontal. Solo existe en la app nativa, vía el plugin oficial
// @capacitor/screen-orientation: en web/PWA el navegador no deja fijar la
// orientación fuera de pantalla completa, así que available() es false y
// el botón del menú se oculta.
//
// El juego ya sabe dibujar en pantallas anchas (ver resize() en
// js/game.js y los márgenes de modes.js pensados para móvil horizontal):
// aquí solo se fija la orientación y se recuerda la elección.
const Orientation = (() => {
  const KEY = 'mca-orientation';
  const PORTRAIT = 'portrait';
  const LANDSCAPE = 'landscape';

  function plugin() {
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) {
      return null;
    }
    return (cap.Plugins && cap.Plugins.ScreenOrientation) || null;
  }

  function available() {
    return Boolean(plugin());
  }

  function read() {
    try {
      return localStorage.getItem(KEY) === LANDSCAPE ? LANDSCAPE : PORTRAIT;
    } catch (err) {
      return PORTRAIT;
    }
  }

  // En memoria además de en localStorage: si guardar falla, el cambio
  // sigue valiendo durante la sesión.
  let current = read();

  function get() {
    return current;
  }

  // Fija la orientación guardada. Nunca lanza: si el plugin falla, el
  // juego sigue en la orientación del manifiesto (vertical).
  async function apply() {
    const p = plugin();
    if (!p) return;
    try {
      await p.lock({ orientation: get() });
    } catch (err) {
      /* sin plugin operativo: se queda en vertical */
    }
  }

  async function toggle() {
    const next = current === LANDSCAPE ? PORTRAIT : LANDSCAPE;
    current = next;
    try {
      localStorage.setItem(KEY, next);
    } catch (err) {
      /* sin almacenamiento: vale para esta sesión */
    }
    await apply();
    return next;
  }

  return { available, get, apply, toggle, PORTRAIT, LANDSCAPE };
})();
