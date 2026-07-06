'use strict';

// Modos de dificultad. Todos los valores que cambian entre modos
// viven aqui; el resto de modulos los lee con Modes.get().
const Modes = (() => {
  const NORMAL = Object.freeze({
    key: 'normal', // la clave interna no cambia: conserva récords y ranking
    label: 'FÁCIL',
    baseSpeed: 450,
    maxSpeed: 980,
    speedRamp: 8.5,
    zoom: 1, // cuanto se aleja la camara (mas zoom = ves mas pista)
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
    oncoming: Object.freeze({
      firstDelay: 10,
      intervalStart: 8,
      intervalEnd: 4,
      speedStart: 180,
      speedRange: 180,
      meetWreckMargin: 400,
      meetRailMargin: 280,
    }),
    storageKey: 'mine-cat-carnage-best',
  });

  const HARD = Object.freeze({
    key: 'hard',
    label: 'DIFÍCIL',
    baseSpeed: 560,
    maxSpeed: 1160,
    speedRamp: 11,
    zoom: 1.12,
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
    oncoming: Object.freeze({
      firstDelay: 5.5,
      intervalStart: 5.5,
      intervalEnd: 2.8,
      speedStart: 250,
      speedRange: 240,
      meetWreckMargin: 480,
      meetRailMargin: 340,
    }),
    storageKey: 'mine-cat-carnage-best-hard',
  });

  // El doble de obstaculos y enemigos que DIFICIL, velocidad extrema
  // y colinas salvajes. La camara se aleja para que puedas verlo venir.
  const HARDCORE = Object.freeze({
    key: 'hardcore',
    label: 'HARDCORE',
    baseSpeed: 700,
    maxSpeed: 1350,
    speedRamp: 14,
    zoom: 1.3,
    gapMaxStart: 240,
    gapMaxEnd: 340,
    railMin: 300,
    railMax: 900,
    heightRange: 300,
    maxSlope: 0.75,
    // Con rieles de 300-600 casi todo es salto: los vagones caben
    // solo en los tramos largos y el margen se reduce acorde.
    wreckSpacingFactor: 0.35,
    wreckRailMargin: 240,
    warnDistance: 1500,
    musicTempo: 150,
    oncoming: Object.freeze({
      firstDelay: 4,
      intervalStart: 2.75, // el doble de carros que DIFICIL
      intervalEnd: 1.4,
      speedStart: 460, // y el doble de rapidos
      speedRange: 440,
      meetWreckMargin: 560,
      meetRailMargin: 130, // rieles de 300-600: si fuera mayor, nunca aparecerían
    }),
    storageKey: 'mine-cat-carnage-best-hardcore',
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
