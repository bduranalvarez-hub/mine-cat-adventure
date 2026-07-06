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
  url: '', // ej: 'https://abcdefgh.supabase.co'
  anonKey: '', // clave anon/public
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

  // Inserta una puntuación. El servidor valida rango y modo (constraints).
  async function submit(name, meters, mode) {
    if (!enabled()) return false;
    try {
      const res = await withTimeout((signal) =>
        fetch(`${RemoteConfig.url}/rest/v1/scores`, {
          method: 'POST',
          headers: { ...headers(), Prefer: 'return=minimal' },
          body: JSON.stringify({ name, meters, mode }),
          signal,
        })
      );
      return res.ok;
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

  return { enabled, submit, top };
})();
