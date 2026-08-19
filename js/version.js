'use strict';

// Comprobación de versión al arrancar: avisa al jugador cuando su build
// quedó atrás respecto a lo publicado.
//
// Por qué hace falta: la app nativa lleva TODO el juego empaquetado
// (js, css, imágenes) dentro del APK, así que no se actualiza sola. Un
// jugador puede quedarse meses con una versión vieja sin enterarse —
// pasó ya: el build instalado dejó de enviar marcas al ranking mundial
// tras un cambio de servidor, y desde la app no había forma de saberlo.
const Version = (() => {
  // Identidad de ESTE build. androidVersionCode DEBE coincidir con el
  // versionCode de android/app/build.gradle; scripts/build-mobile.mjs
  // aborta el build si divergen, porque un desajuste silencioso haría
  // que se avise de más (a quien ya está al día) o de menos (nunca).
  const LOCAL = Object.freeze({
    webBuild: 45,
    androidVersionCode: 4,
  });

  // Se consulta SIEMPRE la URL remota absoluta, nunca una ruta relativa:
  // dentro de la app nativa el WebView sirve los archivos locales, así
  // que un fetch relativo devolvería la copia empaquetada del propio
  // build y jamás detectaría una versión nueva.
  const MANIFEST_URL =
    'https://bduranalvarez-hub.github.io/mine-cat-adventure/version.json';
  const PLAY_URL =
    'https://play.google.com/store/apps/details?id=com.minecatadventure.app';

  const DISMISSED_KEY = 'mca-update-dismissed';
  const TIMEOUT_MS = 6000;

  function isNative() {
    return Boolean(
      window.Capacitor
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform()
    );
  }

  function readDismissed() {
    try {
      const v = parseInt(localStorage.getItem(DISMISSED_KEY), 10);
      return Number.isFinite(v) ? v : -1;
    } catch (err) {
      return -1;
    }
  }

  // Recuerda el descarte POR VERSIÓN: si el jugador cierra el aviso de
  // la build 43 no se le vuelve a molestar con esa, pero cuando salga
  // la 44 se le avisa de nuevo.
  function dismiss(remoteNum) {
    try {
      localStorage.setItem(DISMISSED_KEY, String(remoteNum));
    } catch (err) {
      /* sin almacenamiento: el aviso reaparecerá, no es grave */
    }
  }

  function fetchManifest() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    // cache:'no-store' para no leer una copia vieja del propio navegador
    // (el service worker además deja pasar esta ruta sin cachearla).
    return fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .finally(() => clearTimeout(timer));
  }

  // Devuelve null si está al día, no se pudo comprobar, o el jugador ya
  // descartó ese aviso. Si hay novedad: { kind, label, url, remoteNum }.
  // Nunca lanza: quedarse sin conexión no puede romper el arranque.
  async function check() {
    try {
      const data = await fetchManifest();
      if (!data) return null;
      const native = isNative();
      const remoteNum = native
        ? (data.android && data.android.versionCode)
        : (data.web && data.web.build);
      const localNum = native ? LOCAL.androidVersionCode : LOCAL.webBuild;
      if (!Number.isFinite(remoteNum) || remoteNum <= localNum) return null;
      if (readDismissed() >= remoteNum) return null;
      const info = native ? data.android : data.web;
      return {
        kind: native ? 'android' : 'web',
        label: (info && info.label) || '',
        url: native ? PLAY_URL : null,
        remoteNum,
      };
    } catch (err) {
      return null; // sin conexión o manifiesto ilegible: se juega igual
    }
  }

  return { check, dismiss, isNative, LOCAL };
})();
