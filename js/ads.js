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
  // ¿Se puede precargar AHORA? Solo fuera de la partida. Descargar y
  // preparar un vídeo es caro y en móviles modestos se nota como tirones
  // en pleno juego; el menú es el momento tranquilo para pagarlo.
  let preloadAllowed = false;

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
  let initializing = null;
  async function init() {
    const p = getPlugin();
    if (!p || ready) return ready;
    if (initializing) return initializing;
    initializing = doInit(p).finally(() => {
      initializing = null;
    });
    return initializing;
  }

  async function doInit(p) {
    try {
      await p.initialize({
        // Sin dispositivos de prueba declarados: con los IDs de prueba
        // de Google no hacen falta, y en producción no queremos que
        // ningún dispositivo reciba anuncios de relleno.
        initializeForTesting: false,
      });
      ready = true;
      listenFullscreen(p);
      // NO se precarga aquí. Antes se hacía, y en dispositivos modestos
      // la descarga del vídeo caía justo cuando el jugador ya estaba
      // corriendo: el juego arrancaba bien y a los pocos segundos daba
      // tirones. Ahora la precarga la abre el menú (setPreloadAllowed),
      // así el anuncio queda listo ANTES de empezar la partida y el
      // botón de revivir sigue respondiendo al instante.
      prepare();
      return true;
    } catch (err) {
      ready = false;
      return false;
    }
  }

  // El plugin (@capacitor-community/admob 7.2) SOLO resuelve
  // showRewardVideoAd() cuando se gana la recompensa. Si el jugador cierra
  // el anuncio antes, la promesa no termina nunca, y el juego se quedaba
  // "mostrando" para siempre: sin más anuncios en esa sesión. El evento de
  // cierre desbloquea esa espera.
  let onDismissed = null;
  let onShowFailed = null;
  let onShowed = null;
  // Tras el cierre se espera un poco por la recompensa: en el móvil de un
  // tester (1.10), con algunos anuncios el aviso de cierre llegaba ANTES
  // que el de recompensa, y dar el anuncio por no visto dejaba sin revivir
  // a quien lo había visto entero.
  const REWARD_GRACE_MS = 2500;
  // Si el anuncio no llega a mostrarse, el plugin solo lo avisa con el
  // evento FailedToShow y tampoco resuelve la promesa. Sin estos avisos, el
  // botón de revivir se quedaba "cargando" para siempre.
  const SHOW_WATCHDOG_MS = 10000;
  // Como mucho se espera esto a que cargue un anuncio pedido al momento.
  const LOAD_WAIT_MS = 15000;

  function diagLog(what) {
    if (typeof Diag !== 'undefined') Diag.log(what);
  }

  // Aviso al juego de cuándo hay un anuncio a pantalla completa, para
  // pausar la música y, al cerrarse, estrenar un lienzo nuevo. Hace falta
  // porque en Android la página NO pasa a oculta mientras el anuncio la
  // tapa (el panel de diagnóstico nunca registró vis-hidden en un anuncio
  // normal): visibilitychange no sirve para esto.
  //
  // El cierre NO se deduce de la recompensa: la recompensa llega con el
  // vídeo todavía en pantalla. Cuenta el aviso de cierre del SDK (o el
  // fallo al mostrarse), y como red de seguridad un tope de tiempo.
  const AD_SCREEN_MAX_MS = 150000;
  let adScreenOpen = false;
  let adScreenTimer = null;
  const adScreenHandlers = [];

  function onAdScreen(onOpen, onClose) {
    adScreenHandlers.push({ onOpen, onClose });
  }

  function runHandlers(kind) {
    adScreenHandlers.forEach((h) => {
      try {
        if (h[kind]) h[kind]();
      } catch (err) { /* un fallo del juego no puede romper el anuncio */ }
    });
  }

  function openAdScreen() {
    if (adScreenOpen) return;
    adScreenOpen = true;
    clearTimeout(adScreenTimer);
    adScreenTimer = setTimeout(closeAdScreen, AD_SCREEN_MAX_MS);
    runHandlers('onOpen');
  }

  function closeAdScreen() {
    if (!adScreenOpen) return;
    adScreenOpen = false;
    clearTimeout(adScreenTimer);
    runHandlers('onClose');
  }

  let showedEventReady = false;
  function listenFullscreen(p) {
    if (typeof p.addListener !== 'function') return;
    const on = (name, fn) => {
      try {
        p.addListener(name, fn);
        return true;
      } catch (err) {
        return false; // sin eventos: queda el comportamiento anterior
      }
    };
    on('onRewardedVideoAdDismissed', () => {
      diagLog('ad-dismiss');
      if (onDismissed) onDismissed();
      closeAdScreen();
    });
    on('onRewardedVideoAdFailedToShow', () => {
      diagLog('ad-fallo-mostrar');
      if (onShowFailed) onShowFailed();
      closeAdScreen();
    });
    showedEventReady = on('onRewardedVideoAdShowed', () => {
      if (onShowed) onShowed();
    });
  }

  // Carga de verdad. Silencioso: que no haya inventario disponible es
  // normal y no es un error que mostrar. Si ya hay una carga en curso (la
  // precarga del menú), se espera ESA: antes se respondía "no hay
  // anuncio" al instante y el botón de revivir parecía no hacer nada.
  let loadPromise = null;
  function loadAd() {
    const p = getPlugin();
    if (!p || !ready || loaded) return Promise.resolve(loaded);
    if (loadPromise) return loadPromise;
    preparing = true;
    loadPromise = p.prepareRewardVideoAd({ adId: REWARDED_ID })
      .then(() => {
        loaded = true;
      })
      .catch(() => {
        loaded = false;
        diagLog('ad-sin-carga');
      })
      .then(() => {
        preparing = false;
        loadPromise = null;
        return loaded;
      });
    return loadPromise;
  }

  // Espera la carga, pero no más de LOAD_WAIT_MS: con mala red el jugador
  // recibe un "no se pudo cargar" y puede reintentar. La carga sigue por
  // detrás y deja el anuncio listo para el siguiente intento.
  function loadWithLimit() {
    return Promise.race([
      loadAd(),
      new Promise((resolve) => setTimeout(() => resolve(false), LOAD_WAIT_MS)),
    ]);
  }

  // Precarga OPORTUNISTA: solo si estamos en un momento tranquilo. La
  // usa el arranque y la apertura del menú. Durante la partida no hace
  // nada; showRewarded() sí carga bajo demanda cuando hace falta.
  async function prepare() {
    if (!preloadAllowed) return loaded;
    if (typeof Diag !== 'undefined' && Diag.preloadDisabled()) return loaded;
    return loadAd();
  }

  // El juego abre y cierra la ventana de precarga: abierta en el menú,
  // cerrada al empezar a jugar. Al abrirla se aprovecha para dejar el
  // anuncio listo, de modo que si el jugador muere a mitad de partida
  // el botón de revivir ya lo tiene cargado.
  function setPreloadAllowed(allowed) {
    preloadAllowed = Boolean(allowed);
    // Si el SDK no arrancó (p. ej. se abrió la app sin conexión), se
    // reintenta al volver al menú en vez de quedarse sin anuncios.
    if (preloadAllowed && !ready && getPlugin()) {
      init();
      return;
    }
    if (preloadAllowed) prepare();
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
    // Bajo demanda se salta la ventana de precarga: el jugador acaba de
    // pedir el anuncio, así que se carga aunque estemos en partida.
    if (!loaded && !(await loadWithLimit())) {
      return { ok: false, code: 'no_disponible' };
    }
    showing = true;
    shownCount += 1;
    diagLog('ad-show');
    let reward = null;
    let failed = false;
    let watchdog = null;
    try {
      const closed = new Promise((resolve) => {
        // Un cierre solo cuenta si ESTE anuncio ya apareció: así un aviso
        // atrasado del anuncio anterior no corta el actual.
        let shown = !showedEventReady;
        onDismissed = () => {
          if (shown) setTimeout(() => resolve(null), REWARD_GRACE_MS);
        };
        const fail = () => {
          failed = true;
          closeAdScreen();
          resolve(null);
        };
        onShowFailed = fail;
        // Si el anuncio no aparece en SHOW_WATCHDOG_MS, se da por fallido.
        // Solo con el evento Showed registrado: sin él no se sabría si
        // apareció y se cortaría un anuncio en curso.
        if (showedEventReady) {
          watchdog = setTimeout(() => {
            diagLog('ad-no-aparecio');
            fail();
          }, SHOW_WATCHDOG_MS);
        }
        onShowed = () => {
          shown = true;
          clearTimeout(watchdog);
        };
      });
      openAdScreen();
      // Gana la recompensa si llega (antes del cierre o durante la espera
      // posterior). Cerrar antes de tiempo resuelve con null.
      reward = await Promise.race([p.showRewardVideoAd(), closed]);
      if (reward) diagLog('ad-reward');
    } catch (err) {
      // Un fallo al mostrar puede llegar como excepción.
      reward = null;
      failed = true;
      closeAdScreen();
    } finally {
      // Sin eventos del SDK no hay forma de saber cuándo se cierra: se da
      // por cerrado aquí para no dejar la música en pausa para siempre.
      if (!showedEventReady) closeAdScreen();
      clearTimeout(watchdog);
      onDismissed = null;
      onShowFailed = null;
      onShowed = null;
      showing = false;
      // Se consumió: el siguiente hay que volver a cargarlo. La
      // precarga es oportunista, así que tras revivir -que devuelve al
      // jugador a la partida- no se encadena otra descarga; esperará al
      // menú. Desde la tienda sí se recarga en el acto.
      loaded = false;
      prepare();
    }
    if (!reward) return { ok: false, code: failed ? 'no_disponible' : 'sin_recompensa' };

    // Vista confirmada: que el servidor la registre y decida si toca
    // desbloquear alguna épica.
    // rewarded: el SDK confirmó el anuncio completo, pase lo que pase luego
    // en el servidor. Revivir se conforma con eso (ver game.js); las
    // monedas y las épicas siguen exigiendo ok del servidor.
    if (typeof Account === 'undefined') {
      return { ok: false, rewarded: true, code: 'no_autorizado' };
    }
    const res = await Account.watchAd();
    if (!res.ok && typeof Diag !== 'undefined') Diag.log(`servidor: ${res.code}`);
    return { ...res, rewarded: true };
  }

  // Anuncios mostrados en esta sesión (ver la calidad adaptativa de game.js).
  let shownCount = 0;
  function shownThisSession() {
    return shownCount;
  }

  function diagInfo() {
    return { loaded, showing, preparing };
  }

  return {
    diagInfo, shownThisSession, onAdScreen, init, available, prepare, setPreloadAllowed, showRewarded, USING_TEST_IDS,
  };
})();
