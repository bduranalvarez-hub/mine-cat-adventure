'use strict';

// Modos de dificultad. Todos los valores que cambian entre modos
// viven aqui; el resto de modulos los lee con Modes.get().
const Modes = (() => {
  const NORMAL = Object.freeze({
    key: 'normal', // la clave interna no cambia: conserva récords y ranking
    label: 'FÁCIL',
    labelKey: 'modeEasyClean',
    baseSpeed: 450,
    maxSpeed: 980,
    speedRamp: 8.5,
    gapMaxStart: 210,
    gapMaxEnd: 310,
    railMin: 550,
    railMax: 1150,
    heightRange: 220, // amplitud de las colinas
    maxSlope: 0.55, // pendiente maxima
    wreckSpacingFactor: 1,
    // Evita aterrizar de un salto directamente sobre un vagon averiado.
    wreckRailMargin: 450,
    warnDistance: 800, // aviso "!" de carro que viene
    musicTempo: 112,
    // Multiplicador de monedas: cuanto mas dificil el modo, mas paga
    // por la misma distancia (ver CONFIG.COINS y js/coins.js).
    coinMultiplier: 1,
    oncoming: Object.freeze({
      firstDelay: 10,
      intervalStart: 8,
      intervalEnd: 4,
      speedStart: 180,
      speedRange: 180,
      meetWreckMargin: 400,
      meetRailMargin: 280,
    }),
    storageKey: 'mine-cat-adventure-best',
  });

  const HARD = Object.freeze({
    key: 'hard',
    label: 'DIFÍCIL',
    labelKey: 'modeHardClean',
    baseSpeed: 560,
    maxSpeed: 1160,
    speedRamp: 11,
    gapMaxStart: 230,
    gapMaxEnd: 330,
    railMin: 600,
    railMax: 1250,
    heightRange: 260,
    maxSlope: 0.65,
    wreckSpacingFactor: 0.7,
    wreckRailMargin: 520,
    warnDistance: 1050,
    musicTempo: 128,
    coinMultiplier: 2,
    oncoming: Object.freeze({
      firstDelay: 5.5,
      intervalStart: 5.5,
      intervalEnd: 2.8,
      speedStart: 250,
      speedRange: 240,
      meetWreckMargin: 480,
      meetRailMargin: 340,
    }),
    storageKey: 'mine-cat-adventure-best-hard',
  });

  // El doble de obstaculos y enemigos que DIFICIL, velocidad extrema
  // y colinas salvajes.
  const HARDCORE = Object.freeze({
    key: 'hardcore',
    label: 'HARDCORE',
    labelKey: 'modeHardcoreClean',
    baseSpeed: 700,
    maxSpeed: 1350,
    speedRamp: 14,
    gapMaxStart: 240,
    gapMaxEnd: 340,
    railMin: 300,
    railMax: 900,
    heightRange: 300,
    maxSlope: 0.75,
    // Con rieles de 300-600 casi todo es salto: los vagones caben
    // solo en los tramos largos y el margen se reduce acorde.
    // Vagones bastante espaciados: en el terreno fragmentado de
    // hardcore, si estan muy juntos ocupan casi todos los tramos de
    // riel firme y el enemigo (que necesita cruce valido) casi nunca
    // aparece. Con 0.72 quedan ~70 vagones y el enemigo respira.
    wreckSpacingFactor: 0.72,
    wreckRailMargin: 240,
    warnDistance: 1500,
    musicTempo: 150,
    coinMultiplier: 3,
    oncoming: Object.freeze({
      firstDelay: 4,
      intervalStart: 2.5,
      intervalEnd: 1.25,
      speedStart: 460, // el doble de rapidos que DIFICIL
      speedRange: 440,
      // Margen anti-vagon holgado para no encadenar enemigo+vagon muy
      // pegados, pero menor que antes (560) para no posponer tanto.
      meetWreckMargin: 400,
      meetRailMargin: 110, // rieles de 300-900: si fuera mayor, casi no aparecerían
      // Al posponer un intento (cruce invalido), reintenta pronto: en
      // hardcore los tramos validos son escasos, asi que probar mas
      // seguido es lo que hace que el enemigo llegue a aparecer.
      retryDelay: 0.25,
    }),
    storageKey: 'mine-cat-adventure-best-hardcore',
  });

  let current = NORMAL;

  return {
    NORMAL,
    HARD,
    HARDCORE,
    ALL: Object.freeze([NORMAL, HARD, HARDCORE]),
    get: () => current,
    set: (mode) => {
      current = mode;
    },
    byKey: (key) => {
      if (key === 'hardcore') return HARDCORE;
      if (key === 'hard') return HARD;
      return NORMAL;
    },
  };
})();
