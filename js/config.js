'use strict';

// Todas las medidas están en unidades virtuales: la altura de la
// pantalla siempre equivale a VIRTUAL_HEIGHT, el ancho se escala.
const CONFIG = Object.freeze({
  VIRTUAL_HEIGHT: 720,
  // Ancho mínimo de mundo visible: garantiza tiempo de reacción en
  // pantallas angostas (móvil vertical), sin importar cuán poco ancho
  // físico tengan. Igual para los tres modos. Ver resize() en game.js.
  MIN_VIEW_WIDTH: 850,

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
