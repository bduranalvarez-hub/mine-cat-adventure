'use strict';

// Música de fondo chiptune generada con WebAudio: un loop de 4
// compases (bajo + arpegio + percusión) que acelera según el modo.
// Sin archivos externos.
const Music = (() => {
  const STORAGE_KEY = 'mca-music-on';
  const LOOKAHEAD = 0.15; // segundos programados por adelantado
  const STEPS_PER_BAR = 16;
  const BARS = 4;

  // Progresión Am - G - F - E (nota MIDI de la fundamental).
  const BASS_ROOTS = [45, 43, 41, 40];
  // Arpegios por compás (notas MIDI, un ciclo por compás).
  const ARPS = [
    [69, 72, 76, 81],
    [67, 71, 74, 79],
    [65, 69, 72, 77],
    [64, 68, 71, 76],
  ];

  let ctx = null;
  let master = null;
  let timer = null;
  let nextNoteTime = 0;
  let step = 0;
  let tempo = 112;
  let enabled = true;
  let nodesCreated = 0;       // para el panel de diagnóstico
  let nodesMark = { t: 0, n: 0, rate: null };
  let resumeOnVisible = false;

  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== '0';
  } catch (err) { /* sin almacenamiento: queda activada */ }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function ensureContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.14;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function note(freq, time, duration, type, volume) {
    nodesCreated += 2;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain).connect(master);
    osc.start(time);
    osc.stop(time + duration);
  }

  function hat(time, volume) {
    nodesCreated += 3;
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(master);
    src.start(time);
  }

  function scheduleStep(s, time) {
    const stepLen = 60 / tempo / 4; // semicorchea
    const bar = Math.floor(s / STEPS_PER_BAR) % BARS;
    const inBar = s % STEPS_PER_BAR;

    // Bajo: negras (triángulo), con octava en la 3ª negra.
    if (inBar % 4 === 0) {
      const octaveUp = inBar === 8 ? 12 : 0;
      note(midiToFreq(BASS_ROOTS[bar] + octaveUp), time, stepLen * 3.4, 'triangle', 0.5);
    }
    // Arpegio: corcheas (cuadrada suave).
    if (inBar % 2 === 0) {
      const arp = ARPS[bar];
      note(midiToFreq(arp[(inBar / 2) % arp.length]), time, stepLen * 1.6, 'square', 0.12);
    }
    // Percusión: hi-hat en contratiempos, más marcado en el pulso.
    if (inBar % 2 === 0) hat(time, inBar % 4 === 0 ? 0.18 : 0.08);
  }

  function schedulerTick() {
    if (!ctx) return;
    const stepLen = 60 / tempo / 4;
    // Si el temporizador estuvo parado (app tapada por un anuncio) y el
    // audio siguió avanzando, no se recupera lo perdido: se programarían
    // de golpe cientos de notas en el pasado. Se retoma desde ahora.
    if (nextNoteTime < ctx.currentTime - 0.3) nextNoteTime = ctx.currentTime + 0.05;
    while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(step, nextNoteTime);
      step = (step + 1) % (STEPS_PER_BAR * BARS);
      nextNoteTime += stepLen;
    }
  }

  function start(bpm) {
    tempo = bpm || 112;
    if (!enabled) return;
    if (!ensureContext()) return;
    if (timer === null) {
      nextNoteTime = ctx.currentTime + 0.05;
      step = 0;
      timer = setInterval(schedulerTick, 50);
    }
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function setTempo(bpm) {
    tempo = bpm;
  }

  function setEnabled(value) {
    enabled = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch (err) { /* sin almacenamiento */ }
    if (!value) stop();
  }

  function isEnabled() {
    return enabled;
  }

  // Con la app oculta (un anuncio encima, otra app) la música se pausa
  // del todo: nada de temporizadores ni audio corriendo sin que se oiga.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      resumeOnVisible = timer !== null;
      stop();
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    } else if (resumeOnVisible) {
      resumeOnVisible = false;
      start(tempo);
    }
  });

  function diagInfo() {
    const t = performance.now();
    if (t - nodesMark.t >= 1000) {
      if (nodesMark.t > 0) {
        nodesMark.rate = Math.round((nodesCreated - nodesMark.n) / ((t - nodesMark.t) / 1000));
      }
      nodesMark = { t, n: nodesCreated, rate: nodesMark.rate };
    }
    return {
      state: ctx ? ctx.state : 'sin contexto',
      timer: timer !== null,
      lag: ctx ? ctx.currentTime - nextNoteTime : NaN,
      nodesPerSec: nodesMark.rate,
    };
  }

  return { start, stop, setTempo, setEnabled, isEnabled, diagInfo };
})();
