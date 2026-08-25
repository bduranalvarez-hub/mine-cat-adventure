'use strict';

// Anuncios recompensados (AdMob). Es el puente entre el SDK nativo y el
// juego: mostrar el video y, si el usuario se lo ganó, avisar al
// servidor a través de Account.watchAd(), que es quien lleva la cuenta
// real de vistas y concede las skins épicas.
//
// SOLO existe en la app compilada. En web/PWA no hay SDK nativo, así
// que available() devuelve false y la tienda dice que los anuncios
// solo están en la app de Android, en vez de un contador congelado.
//
// Diseño deliberado: aquí NO se decide nada sobre recompensas. El
// cliente puede mentir (un APK modificado diría "vi mil anuncios"), así
// que el conteo, el tope diario y el desbloqueo viven en el servidor.
// Este módulo solo reporta "el SDK confirmó una vista".
const Ads = (() => {
  // IDs de AdMob. El de PRUEBA de Google se conserva para poder volver
  // a él al depurar: NUNCA pruebes con el ID real en tu propio
  // teléfono, porque ver o pulsar tus propios anuncios cuenta como
  // tráfico inválido y Google suspende cuentas por eso.
  const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';
  // ID REAL del bloque bonificado (cuenta de AdMob creada el
  // 2026-08-25). Va en pareja con el APPLICATION_ID del
  // android/app/src/main/AndroidManifest.xml: si cambias uno, cambia el
  // otro, porque el SDK exige que ambos sean de la misma cuenta. No es
  // un secreto: los IDs de AdMob viajan dentro del APK.
  const REWARDED_ID = 'ca-app-pub-6167652699679734/1251724644';
  // Marca si seguimos con los IDs de prueba. La usa el aviso de la
  // tienda para no prometer ingresos que no existen y, sobre todo,
  // para que sea obvio al revisar el build qué configuración lleva.
  const USING_TEST_IDS = REWARDED_ID === TEST_REWARDED_ID;

  let plugin = null;
  let ready = false;      // initialize() terminó bien
  let preparing = false;  // hay una carga en curso (evita solaparlas)
  let loaded = false;     // hay un anuncio cargado listo para mostrar
  let showing = false;    // se está mostrando (evita dobles toques)

  function isNativeApp() {
    return Boolean(
      window.Capacitor
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform()
    );
  }

  function getPlugin() {
    if (plugin) return plugin;
    if (!isNativeApp()) return null;
    const plugins = window.Capacitor.Plugins;
    plugin = (plugins && plugins.AdMob) || null;
    return plugin;
  }

  // Arranca el SDK. Se llama una vez al inicio; si falla (sin red, SDK
  // ausente, consentimiento denegado) se queda en no disponible y el
  // juego sigue funcionando igual: los anuncios son opcionales.
  async function init() {
    const p = getPlugin();
    if (!p || ready) return ready;
    try {
      await p.initialize({
        // Sin dispositivos de prueba declarados: con los IDs de prueba
        // de Google no hacen falta, y en producción no queremos que
        // ningún dispositivo reciba anuncios de relleno.
        initializeForTesting: false,
      });
      ready = true;
      // Se precarga de inmediato: un anuncio recompensado tarda unos
      // segundos en llegar, y pedirlo recién cuando el jugador acaba de
      // morir haría que el botón de revivir se sintiera roto.
      prepare();
      return true;
    } catch (err) {
      ready = false;
      return false;
    }
  }

  // Deja un anuncio cargado en memoria. Silencioso: que no haya
  // inventario disponible es normal y no es un error que mostrar.
  async function prepare() {
    const p = getPlugin();
    if (!p || !ready || loaded || preparing) return loaded;
    preparing = true;
    try {
      await p.prepareRewardVideoAd({ adId: REWARDED_ID });
      loaded = true;
    } catch (err) {
      loaded = false;
    } finally {
      preparing = false;
    }
    return loaded;
  }

  // ¿Se pueden ofrecer anuncios ahora mismo? La tienda y el botón de
  // revivir preguntan esto antes de mostrarse. Exige SDK iniciado, no
  // que haya uno cargado: si no lo hay se intenta cargar al pulsar.
  function available() {
    return Boolean(getPlugin() && ready);
  }

  // Muestra un anuncio recompensado y registra la vista en el servidor.
  //
  // Devuelve { ok, code, today, cap, total }:
  //   ok:false + code 'no_disponible'  -> no hay SDK o no cargó
  //   ok:false + code 'sin_recompensa' -> lo cerró antes de terminar
  //   ok:false + code <del servidor>   -> p. ej. 'limite_diario'
  //
  // La recompensa la concede SIEMPRE el servidor (Account.watchAd);
  // aquí solo se comprueba que el SDK confirmara que se vio entero.
  async function showRewarded() {
    const p = getPlugin();
    if (!p || !ready || showing) return { ok: false, code: 'no_disponible' };
    if (!loaded && !(await prepare())) {
      return { ok: false, code: 'no_disponible' };
    }
    showing = true;
    let reward = null;
    try {
      reward = await p.showRewardVideoAd();
    } catch (err) {
      // Cerrar el anuncio antes de tiempo llega como excepción.
      reward = null;
    } finally {
      showing = false;
      // Se consumió: el siguiente hay que volver a cargarlo. Se
      // precarga ya para que el próximo botón responda al instante.
      loaded = false;
      prepare();
    }
    if (!reward) return { ok: false, code: 'sin_recompensa' };

    // Vista confirmada: que el servidor la registre y decida si toca
    // desbloquear alguna épica.
    if (typeof Account === 'undefined') {
      return { ok: false, code: 'no_autorizado' };
    }
    return Account.watchAd();
  }

  return { init, available, prepare, showRewarded, USING_TEST_IDS };
})();
