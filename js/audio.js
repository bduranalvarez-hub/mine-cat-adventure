'use strict';

// Efectos de sonido generados con WebAudio (sin archivos externos).
const GameAudio = (() => {
  let ctx = null;

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freqStart, freqEnd, duration, type, volume) {
    const ac = ensureContext();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(freqEnd, 1),
      ac.currentTime + duration
    );
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  }

  function noise(duration, volume) {
    const ac = ensureContext();
    if (!ac) return;
    const length = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ac.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start();
  }

  return {
    unlock: ensureContext,
    jump() {
      tone(320, 620, 0.14, 'square', 0.12);
    },
    land() {
      tone(180, 120, 0.08, 'triangle', 0.1);
    },
    crash() {
      noise(0.4, 0.35);
      tone(220, 40, 0.4, 'sawtooth', 0.2);
    },
    fall() {
      tone(600, 90, 0.6, 'square', 0.14);
    },
    record() {
      tone(523, 523, 0.12, 'square', 0.12);
      setTimeout(() => tone(784, 784, 0.2, 'square', 0.12), 130);
    },
  };
})();
