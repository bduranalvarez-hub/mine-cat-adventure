'use strict';

// Ranking mundial vía Supabase (API REST, sin librerías).
//
// CONFIGURA AQUÍ tu proyecto: pega la URL y la clave "anon public".
// Mientras estén vacías, el juego usa el ranking LOCAL del dispositivo.
//
// La clave anon es SEGURA de exponer en el cliente: el acceso lo
// controla Row Level Security (RLS) en Supabase. NUNCA pongas aquí la
// clave service_role.
const RemoteConfig = Object.freeze({
  url: 'https://xeludbllrshwswywhttp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbHVkYmxscnNod3N3eXdodHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNzM3NTMsImV4cCI6MjA5ODk0OTc1M30.WlaqdYDtjMAbIj-wGv3Km89Twc-17sLVRcjCudjhVXw',
});

const Remote = (() => {
  const TIMEOUT_MS = 6000;

  function enabled() {
    return Boolean(RemoteConfig.url && RemoteConfig.anonKey);
  }

  function headers() {
    return {
      apikey: RemoteConfig.anonKey,
      Authorization: `Bearer ${RemoteConfig.anonKey}`,
      'Content-Type': 'application/json',
    };
  }

  function withTimeout(promiseFactory) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    return promiseFactory(ctrl.signal).finally(() => clearTimeout(timer));
  }

  // Inserción directa: respaldo si el backend aún no tiene la función
  // submit_score. Con la restricción única (name, mode), duplicar una
  // marca existente falla, así que nadie sobrescribe la de otro.
  function insertScore(name, meters, mode) {
    return withTimeout((signal) =>
      fetch(`${RemoteConfig.url}/rest/v1/scores`, {
        method: 'POST',
        headers: { ...headers(), Prefer: 'return=minimal' },
        body: JSON.stringify({ name, meters, mode }),
        signal,
      })
    ).then((r) => r.ok).catch(() => false);
  }

  // Envía una puntuación vía RPC submit_score, que mantiene UNA sola
  // fila por jugador y modo (la actualiza solo si supera la anterior).
  // Así la tabla no crece sin control. El servidor valida rango y modo
  // con sus constraints.
  async function submit(name, meters, mode) {
    if (!enabled()) return false;
    try {
      const res = await withTimeout((signal) =>
        fetch(`${RemoteConfig.url}/rest/v1/rpc/submit_score`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ p_name: name, p_meters: meters, p_mode: mode }),
          signal,
        })
      );
      if (res.ok) return true;
      // La función todavía no existe (base sin migrar): respaldo.
      if (res.status === 404) return insertScore(name, meters, mode);
      return false;
    } catch (err) {
      return false; // sin conexión: la marca ya quedó guardada localmente
    }
  }

  // Devuelve [{ name, meters }] con la mejor marca por jugador del modo.
  async function top(mode, limit) {
    if (!enabled()) throw new Error('remote-disabled');
    const res = await withTimeout((signal) =>
      fetch(`${RemoteConfig.url}/rest/v1/rpc/top_scores`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ mode_key: mode, max_rows: limit }),
        signal,
      })
    );
    if (!res.ok) throw new Error(`http-${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    // Normaliza: nombre string acotado y distancia entera no negativa.
    return data.map((e) => ({
      name: String(e && e.name != null ? e.name : '').slice(0, 14),
      meters: Number.isFinite(e && e.meters) ? Math.max(0, Math.floor(e.meters)) : 0,
    }));
  }

  // Inicia sesión o crea la cuenta (nombre único, PIN de 4 a 8 dígitos).
  // Devuelve { name, token, coins, skinsOwned, activeSkin } si todo
  // sale bien. Los fallos esperados (PIN incorrecto, cuenta bloqueada
  // por intentos fallidos, nombre/PIN inválido) llegan del servidor
  // como { error, retryAfter? } en vez de un código HTTP de error,
  // así que se relanzan como excepción con esos mismos datos.
  async function authAccount(name, pin) {
    if (!enabled()) return null;
    const res = await withTimeout((signal) =>
      fetch(`${RemoteConfig.url}/rest/v1/rpc/auth_account`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ p_name: name, p_pin: pin }),
        signal,
      })
    );
    if (!res.ok) {
      const err = new Error('http_error');
      err.code = 'sin_conexion';
      throw err;
    }
    const body = await res.json();
    if (body && body.error) {
      const err = new Error(body.error);
      err.code = body.error;
      err.retryAfter = body.retryAfter;
      throw err;
    }
    return body;
  }

  // Sube el progreso local y adopta el resultado ya fusionado por el
  // servidor (nunca pierde monedas ni skins entre dispositivos).
  async function syncAccount(name, token, coins, skinsOwned, activeSkin) {
    if (!enabled()) return null;
    try {
      const res = await withTimeout((signal) =>
        fetch(`${RemoteConfig.url}/rest/v1/rpc/sync_account`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            p_name: name, p_token: token, p_coins: coins,
            p_skins_owned: skinsOwned, p_active_skin: activeSkin,
          }),
          signal,
        })
      );
      if (!res.ok) return null;
      return res.json();
    } catch (err) {
      return null; // sin conexión: el progreso local sigue valiendo
    }
  }

  // Borra la cuenta y todos sus datos (progreso + entradas del ranking
  // mundial) del servidor. Requiere el PIN correcto, igual que
  // authAccount; los errores llegan igual (pin_incorrecto,
  // cuenta_bloqueada con retryAfter, no_encontrada).
  async function deleteAccount(name, pin) {
    if (!enabled()) return null;
    const res = await withTimeout((signal) =>
      fetch(`${RemoteConfig.url}/rest/v1/rpc/delete_account`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ p_name: name, p_pin: pin }),
        signal,
      })
    );
    if (!res.ok) {
      const err = new Error('http_error');
      err.code = 'sin_conexion';
      throw err;
    }
    const body = await res.json();
    if (body && body.error) {
      const err = new Error(body.error);
      err.code = body.error;
      err.retryAfter = body.retryAfter;
      throw err;
    }
    return body;
  }

  // Canjea un código de regalo por monedas. Requiere el token de la
  // cuenta (igual que syncAccount). Devuelve { ok, coins, balance } si
  // acierta; los fallos esperados (codigo_invalido, codigo_vencido,
  // codigo_agotado, ya_canjeado, no_autorizado) llegan como
  // { error } y se relanzan como excepción con ese código.
  async function redeemCode(name, token, code) {
    if (!enabled()) return null;
    const res = await withTimeout((signal) =>
      fetch(`${RemoteConfig.url}/rest/v1/rpc/redeem_code`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ p_name: name, p_token: token, p_code: code }),
        signal,
      })
    );
    if (!res.ok) {
      const err = new Error('http_error');
      err.code = 'sin_conexion';
      throw err;
    }
    const body = await res.json();
    if (body && body.error) {
      const err = new Error(body.error);
      err.code = body.error;
      throw err;
    }
    return body;
  }

  // Registra que el jugador vio un anuncio recompensado (revivir o
  // monedas) y devuelve el conteo actualizado. El servidor aplica el
  // tope diario y detecta el desbloqueo de la skin épica por vistas.
  // Los fallos esperados (limite_diario, no_autorizado) llegan como
  // { error } y se relanzan como excepción con ese código.
  async function recordAdWatch(name, token) {
    if (!enabled()) return null;
    const res = await withTimeout((signal) =>
      fetch(`${RemoteConfig.url}/rest/v1/rpc/record_ad_watch`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ p_name: name, p_token: token }),
        signal,
      })
    );
    if (!res.ok) {
      const err = new Error('http_error');
      err.code = 'sin_conexion';
      throw err;
    }
    const body = await res.json();
    if (body && body.error) {
      const err = new Error(body.error);
      err.code = body.error;
      throw err;
    }
    return body;
  }

  // Consulta el estado de anuncios (vistas hoy/tope y total/umbral de
  // desbloqueo) sin registrar una vista nueva. Para pintar el
  // contador en la tienda al abrirla. Falla en silencio (null): el
  // contador no es crítico para jugar.
  async function adStatus(name, token) {
    if (!enabled()) return null;
    try {
      const res = await withTimeout((signal) =>
        fetch(`${RemoteConfig.url}/rest/v1/rpc/get_ad_status`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ p_name: name, p_token: token }),
          signal,
        })
      );
      if (!res.ok) return null;
      const body = await res.json();
      return body && !body.error ? body : null;
    } catch (err) {
      return null;
    }
  }

  return {
    enabled, submit, top, authAccount, syncAccount, deleteAccount, redeemCode,
    recordAdWatch, adStatus,
  };
})();
