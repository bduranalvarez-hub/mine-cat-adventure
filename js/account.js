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
  // Dueño del progreso local (monedas/skins): el nombre de la última
  // cuenta que inició sesión, o 'guest' si nunca hubo una. Permite
  // distinguir, al iniciar sesión, entre "el mismo usuario vuelve /
  // un invitado vincula su progreso" (se fusiona) y "entra OTRA
  // cuenta en este dispositivo" (el progreso local se descarta y se
  // adopta el de esa cuenta, para que no herede lo del usuario
  // anterior).
  const KEY_OWNER = 'mca-progress-owner';

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

  function readOwner() {
    try {
      return localStorage.getItem(KEY_OWNER);
    } catch (err) {
      return null;
    }
  }

  function persistOwner(name) {
    try {
      localStorage.setItem(KEY_OWNER, name);
    } catch (err) {
      // Sin persistencia: se re-resolverá en el próximo login.
    }
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

  // Reemplaza el progreso local por el de la cuenta (sin fusionar):
  // el que había pertenecía a OTRO usuario de este dispositivo.
  function replaceLocalState(remote) {
    if (!remote) return;
    Coins.replaceBalance(Number.isFinite(remote.coins) ? remote.coins : 0);
    Skins.replaceOwned(remote.skinsOwned, remote.activeSkin);
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
      // Dueño previo del progreso local: el marcador guardado o, si no
      // existe (partidas anteriores a esta versión), la cuenta que
      // estaba vinculada; sin ninguna de las dos, era de un invitado.
      const prevOwner = readOwner() || (link ? link.name : 'guest');
      link = { name: remote.name, token: remote.token };
      persistLink();
      const sameOwner = prevOwner === 'guest'
        || prevOwner.toLowerCase() === remote.name.toLowerCase();
      if (sameOwner) {
        // Mismo usuario que vuelve, o invitado que vincula su
        // progreso: se fusiona y se sube el resultado al servidor.
        adoptRemoteState(remote);
        await push();
      } else {
        // Entró OTRA cuenta: el progreso local se descarta y se
        // adopta el suyo tal cual (nada que subir).
        replaceLocalState(remote);
      }
      persistOwner(remote.name);
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

  // Canjea un código de regalo por monedas. Requiere cuenta vinculada:
  // el canje es único POR CUENTA, algo imposible de garantizar para un
  // invitado. El servidor suma las monedas y devuelve el saldo nuevo,
  // que se adopta localmente (setBalance solo sube, y un regalo siempre
  // sube). Devuelve { ok: true, coins, balance } o { ok: false, code }
  // con el motivo (no_autorizado, sin_conexion, codigo_invalido,
  // codigo_vencido, codigo_agotado, ya_canjeado).
  async function redeem(code) {
    if (!link) return { ok: false, code: 'no_autorizado' };
    if (!remoteEnabled()) return { ok: false, code: 'sin_conexion' };
    try {
      const res = await Remote.redeemCode(link.name, link.token, code);
      if (res && Number.isFinite(res.balance)) Coins.setBalance(res.balance);
      return { ok: true, coins: res ? res.coins : 0, balance: res ? res.balance : null };
    } catch (err) {
      return { ok: false, code: err && err.code ? err.code : 'sin_conexion' };
    }
  }

  // Deja de usar la cuenta vinculada: el progreso local permanece en
  // el dispositivo (no se borra), simplemente deja de sincronizarse.
  function unlink() {
    link = null;
    persistLink();
  }

  return { isLinked, linkedName, login, push, unlink, redeem };
})();
