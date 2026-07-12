'use strict';

// Vincula monedas y skins a una cuenta (nombre + PIN) en Supabase, para
// que el progreso sobreviva a un cambio de dispositivo o a borrar los
// datos de la app. Si el jugador prefiere no crear cuenta, puede seguir
// como invitado: el progreso queda solo en este dispositivo (ver
// Leaderboard/Coins/Skins, que ya funcionan así por defecto).
//
// La sincronización siempre FUSIONA en vez de sobrescribir (máximo de
// monedas, unión de skins): jugar offline nunca hace perder progreso.
const Account = (() => {
  const KEY_NAME = 'mca-account-name';
  const KEY_TOKEN = 'mca-account-token';

  function remoteEnabled() {
    return typeof Remote !== 'undefined' && Remote.enabled();
  }

  function readLink() {
    try {
      const name = localStorage.getItem(KEY_NAME);
      const token = localStorage.getItem(KEY_TOKEN);
      if (name && token) return { name, token };
    } catch (err) {
      // Sin almacenamiento: el juego sigue en modo invitado.
    }
    return null;
  }

  let link = readLink();

  function persistLink() {
    try {
      if (link) {
        localStorage.setItem(KEY_NAME, link.name);
        localStorage.setItem(KEY_TOKEN, link.token);
      } else {
        localStorage.removeItem(KEY_NAME);
        localStorage.removeItem(KEY_TOKEN);
      }
    } catch (err) {
      // Sin persistencia: el vínculo vale solo para esta sesión.
    }
  }

  function isLinked() {
    return Boolean(link);
  }

  function linkedName() {
    return link ? link.name : null;
  }

  // Adopta en el dispositivo el estado más alto entre lo local y lo
  // que devolvió el servidor (auth o sync ya vienen fusionados, pero
  // esto cubre también la primera vez que se vincula una cuenta con
  // progreso local previo).
  function adoptRemoteState(remote) {
    if (!remote) return;
    if (Number.isFinite(remote.coins)) Coins.setBalance(remote.coins);
    if (Array.isArray(remote.skinsOwned)) {
      remote.skinsOwned.forEach((id) => Skins.grant(id));
    }
    if (remote.activeSkin && Skins.isOwned(remote.activeSkin)) {
      Skins.setActive(remote.activeSkin);
    }
  }

  // Inicia sesión o crea la cuenta si el nombre no existe. Devuelve
  // { ok: true } o { ok: false, code, retryAfter? } con el motivo
  // (pin_invalido, pin_incorrecto, nombre_invalido, cuenta_bloqueada,
  // sin_conexion). cuenta_bloqueada viene tras 5 PIN incorrectos
  // seguidos y trae retryAfter con los segundos de espera.
  async function login(name, pin) {
    if (!remoteEnabled()) return { ok: false, code: 'sin_conexion' };
    try {
      const remote = await Remote.authAccount(name, pin);
      link = { name: remote.name, token: remote.token };
      persistLink();
      adoptRemoteState(remote);
      // Sube el progreso ya fusionado (por si el local traía algo que
      // el remoto no tenía) para dejar el servidor al día.
      await push();
      return { ok: true };
    } catch (err) {
      const code = err && err.code ? err.code : 'sin_conexion';
      const retryAfter = err && err.retryAfter;
      return { ok: false, code, retryAfter };
    }
  }

  // Sube el progreso local y adopta el resultado fusionado. Falla en
  // silencio (sin conexión, cuenta no vinculada): el progreso local ya
  // quedó guardado por Coins/Skins de todas formas.
  async function push() {
    if (!link || !remoteEnabled()) return;
    const remote = await Remote.syncAccount(
      link.name, link.token, Coins.getBalance(), Skins.ownedList(), Skins.activeId()
    );
    adoptRemoteState(remote);
  }

  // Deja de usar la cuenta vinculada: el progreso local permanece en
  // el dispositivo (no se borra), simplemente deja de sincronizarse.
  function unlink() {
    link = null;
    persistLink();
  }

  return { isLinked, linkedName, login, push, unlink };
})();
