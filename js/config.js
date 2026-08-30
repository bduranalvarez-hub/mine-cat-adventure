'use strict';

// Todas las medidas están en unidades virtuales: la altura de la
// pantalla siempre equivale a VIRTUAL_HEIGHT, el ancho se escala.
const CONFIG = Object.freeze({
  VIRTUAL_HEIGHT: 720,
  // Ancho mínimo de mundo visible: garantiza tiempo de reacción en
  // pantallas angostas (móvil vertical), sin importar cuán poco ancho
  // físico tengan. Igual para los tres modos. Ver resize() en game.js.
  MIN_VIEW_WIDTH: 850,
  // Alto mínimo de mundo visible: en pantallas anchas y bajas
  // (escritorio 16:9) fijar solo VIRTUAL_HEIGHT dejaba ~275 unidades
  // bajo el jugador, y tras una pendiente el riel de destino caía
  // fuera de pantalla: no se veía dónde aterrizar. Ver resize().
  MIN_VIEW_HEIGHT: 1080,

  // Distancia (en metros) para cada medalla. Fuente única: la usan la
  // tarjeta de compartir (share.js) y el mineral del fondo de la mina
  // (background.js), de modo que siempre coincidan.
  MEDAL_METERS: Object.freeze({
    BRONZE: 100,
    SILVER: 300,
    GOLD: 700,
    PLATINUM: 1500,
  }),

  // Economía: monedas por distancia recorrida, con tope diario para
  // que farmear no rompa la tienda. Las usa js/coins.js.
  COINS: Object.freeze({
    METERS_PER_COIN: 100,
    DAILY_CAP: 100,
    // Monedas por anuncio recompensado visto. NO cuenta para DAILY_CAP
    // (ese tope es de la distancia recorrida); su freno es el tope
    // diario de anuncios del servidor, 10 al dia, o sea 100 monedas
    // como maximo por esta via. Ver js/ads.js y record_ad_watch.
    PER_AD: 10,
  }),

  GRAVITY: 2500,
  JUMP_VELOCITY: -940,
  // Al soltar el toque mientras sube, la velocidad se recorta a este
  // valor: es lo que hace que un tap corto dé un salto corto.
  JUMP_CUT_VELOCITY: -300,
  COYOTE_TIME: 0.09,

  // La velocidad y su progresión dependen del modo: ver js/modes.js.

  // Cuesta abajo se acelera y cuesta arriba se frena.
  SLOPE_BOOST: 0.55,
  SLOPE_SPEED_MIN: 0.8,
  SLOPE_SPEED_MAX: 1.28,

  PLAYER_X_RATIO: 0.26,
  UNITS_PER_METER: 60,

  CAMERA: Object.freeze({
    FOLLOW: 5, // rapidez con la que la cámara persigue al jugador
    PLAYER_RATIO: 0.62, // altura del jugador en pantalla (0 = arriba)
  }),

  CART: Object.freeze({
    WIDTH: 96,
    HEIGHT: 54,
    WHEEL_RADIUS: 13,
    // Salto del enemigo sobre los huecos: en pantallas anchas (móvil
    // horizontal) el enemigo cruza muchos tramos antes de encontrarse
    // con el jugador; sin saltar caía al vacío antes de la interacción.
    // Salta huecos de hasta HOP_MAX_GAP; los más anchos igual lo hacen
    // caer (así no TODOS sobreviven, se conserva algo de variedad).
    HOP_MAX_GAP: 300,
    HOP_MIN_HEIGHT: 55, // altura mínima del arco (px de mundo)
    HOP_HEIGHT_FACTOR: 0.5, // altura extra proporcional al ancho del hueco
    HOP_MAX_HEIGHT: 130,
    // Al aterrizar de un salto, el enemigo se posa unos px DENTRO del
    // riel (no justo en el borde derecho): así slopeAt no muestrea sobre
    // el hueco y no aparece un frame "acostado". Debe superar el ±10 de
    // slopeAt para que la muestra caiga sobre el riel.
    HOP_LAND_INSET: 14,
  }),

  TRACK: Object.freeze({
    FIRST_RAIL: 2200,
    GAP_MIN: 130,
    // Huecos máximos, largo de rieles, amplitud y pendiente de las
    // colinas dependen del modo: ver js/modes.js.
    POINT_DX_MIN: 340,
    POINT_DX_MAX: 700,
  }),

  // Vagones averiados: obstáculos fijos sobre el riel, se saltan.
  // (frecuencia y márgenes según el modo: ver js/modes.js)
  WRECKS: Object.freeze({
    FIRST_AT: 1500,
    SPACING_MIN_START: 850,
    SPACING_MAX_START: 1700,
    SPACING_MIN_END: 540,
    SPACING_MAX_END: 1050,
  }),
});
