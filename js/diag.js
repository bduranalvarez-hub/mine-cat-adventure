'use strict';

// Panel de diagnóstico de rendimiento, oculto por defecto.
//
// Existe porque la lentitud después del anuncio de revivir NO se puede
// reproducir en el navegador: solo pasa en un móvil real, con el SDK de
// AdMob. El panel mide en el propio teléfono dónde se va el tiempo de
// cada fotograma, para decidir con datos y no a ciegas:
// - "juego" (update + render) alto: el dibujado propio se volvió caro,
//   por ejemplo un lienzo que perdió la GPU.
// - "fuera" alto con "juego" bajo: el tiempo lo consume otra cosa del
//   mismo proceso (el navegador, el compositor, un WebView del anuncio).
//
// Se abre y se cierra manteniendo pulsado 2 s el logo del menú (cualquier
// zona sin botón). La elección se guarda.
const Diag = (() => {
  const KEY = 'mca-diag';
  const KEY_NO_PRELOAD = 'mca-diag-nopreload';
  const LONG_PRESS_MS = 2000;
  const REFRESH_MS = 1000;
  const MAX_EVENTS = 8;

  let enabled = false;
  let panel = null;
  let frames = [];     // [intervalo, update, render] del último segundo
  let lastPaint = 0;
  let longTasks = 0;
  let events = [];
  let lastFps = 0;
  // Capas apagadas a mano y calidad automática, para buscar en el móvil
  // qué parte del dibujo se vuelve cara tras el anuncio.
  const skipped = { fondo: false, via: false, obst: false, jugador: false };
  let autoQualityOn = true;
  // Tiempo de pintado del navegador (no de nuestro JS): lo da la API de
  // "long animation frames", que separa el trabajo de dibujado del resto.
  let loafTotal = 0;
  let loafRender = 0;
  let loafCount = 0;
  const counters = { adsShown: 0, adsDismissed: 0, surfaceRefresh: 0 };

  try {
    enabled = localStorage.getItem(KEY) === '1';
  } catch (err) { /* sin almacenamiento: queda apagado */ }

  function now() {
    return performance.now();
  }

  function stamp() {
    const d = new Date();
    return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  // Deja constancia de un suceso junto con los fps de ese momento, para
  // ver qué pasó justo antes de que el juego se pusiera lento.
  function log(what) {
    if (what === 'ad-show') counters.adsShown += 1;
    if (what === 'ad-dismiss') counters.adsDismissed += 1;
    if (what === 'surface') counters.surfaceRefresh += 1;
    events.push(`${stamp()} ${what} (${lastFps} fps)`);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  }

  // Experimento: sin precarga, el anuncio solo se descarga al pedirlo.
  // Sirve para ver si un anuncio cargado y en espera frena el juego.
  function preloadDisabled() {
    try {
      return localStorage.getItem(KEY_NO_PRELOAD) === '1';
    } catch (err) {
      return false;
    }
  }

  function setPreloadDisabled(value) {
    try {
      localStorage.setItem(KEY_NO_PRELOAD, value ? '1' : '0');
    } catch (err) { /* sin almacenamiento */ }
  }

  // Crea un botón del panel que no deja pasar el toque al juego.
  function makeButton(label, onTap) {
    const btn = document.createElement('button');
    btn.className = 'diag-btn';
    btn.textContent = label;
    btn.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onTap(btn);
    });
    return btn;
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'diag-panel';
    panel.className = 'diag-panel';
    const text = document.createElement('pre');
    text.id = 'diag-text';
    const fila = document.createElement('div');
    fila.className = 'diag-row';

    const preload = makeButton('', (b) => {
      setPreloadDisabled(!preloadDisabled());
      b.textContent = `precarga: ${preloadDisabled() ? 'NO' : 'SÍ'}`;
    });
    preload.textContent = `precarga: ${preloadDisabled() ? 'NO' : 'SÍ'}`;

    const auto = makeButton(`auto-calidad: SÍ`, (b) => {
      autoQualityOn = !autoQualityOn;
      b.textContent = `auto-calidad: ${autoQualityOn ? 'SÍ' : 'NO'}`;
    });

    const lienzo = makeButton('lienzo nuevo', () => {
      if (typeof Game !== 'undefined' && Game.newSurface) Game.newSurface();
    });

    fila.append(preload, auto, lienzo);

    const capas = document.createElement('div');
    capas.className = 'diag-row';
    Object.keys(skipped).forEach((capa) => {
      capas.appendChild(makeButton(capa, (b) => {
        skipped[capa] = !skipped[capa];
        b.textContent = skipped[capa] ? `${capa}: NO` : capa;
        b.classList.toggle('off', skipped[capa]);
      }));
    });

    panel.append(text, fila, capas);
    document.body.appendChild(panel);
    return panel;
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    try {
      localStorage.setItem(KEY, enabled ? '1' : '0');
    } catch (err) { /* sin almacenamiento */ }
    if (enabled) ensurePanel().classList.remove('hidden');
    else if (panel) panel.classList.add('hidden');
  }

  // Mantener pulsado el elemento abre o cierra el panel, solo si when()
  // lo permite en ese momento (p. ej. con el menú en pantalla).
  function attachLongPress(el, when) {
    if (!el) return;
    let timer = null;
    const cancel = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    el.addEventListener('pointerdown', () => {
      cancel();
      if (when && !when()) return;
      timer = setTimeout(() => {
        timer = null;
        setEnabled(!enabled);
        if (navigator.vibrate) navigator.vibrate(40);
      }, LONG_PRESS_MS);
    });
    ['pointerup', 'pointercancel'].forEach((t) => el.addEventListener(t, cancel));
  }

  // ¿Se puede saltar esta capa del dibujo? Solo con el panel abierto.
  function skip(capa) {
    return enabled && skipped[capa] === true;
  }

  function autoQuality() {
    return autoQualityOn;
  }

  // Mide cuánto del fotograma se va en el dibujado del navegador.
  // Solo los fotogramas lentos de los últimos segundos: el promedio desde
  // el arranque mezclaba el momento del lag con horas de juego normal.
  const LOAF_WINDOW_MS = 3000;
  let loafRecent = [];
  function observeFrames() {
    try {
      const po = new PerformanceObserver((list) => {
        list.getEntries().forEach((e) => {
          loafCount += 1;
          loafTotal += e.duration;
          // renderStart marca el comienzo del dibujado dentro del fotograma.
          const render = e.renderStart ? Math.max(0, e.startTime + e.duration - e.renderStart) : 0;
          loafRender += render;
          // Scripts de NUESTRA página que corrieron en ese fotograma. Si el
          // fotograma es largo y aquí no hay casi nada, el tiempo se lo
          // llevó algo de fuera (otro WebView del mismo hilo, el recolector).
          let script = 0;
          let top = null;
          (e.scripts || []).forEach((s) => {
            script += s.duration;
            if (!top || s.duration > top.duration) top = s;
          });
          loafRecent.push({
            t: e.startTime, dur: e.duration, render, script,
            top: top ? `${top.invoker || top.invokerType || '?'} ${Math.round(top.duration)}ms` : '',
          });
        });
        const limite = now() - LOAF_WINDOW_MS;
        loafRecent = loafRecent.filter((f) => f.t >= limite);
      });
      po.observe({ type: 'long-animation-frame', buffered: false });
    } catch (err) { /* navegador sin soporte: la línea queda en "-" */ }
  }

  // De quién son las tareas largas: "self" es nuestra página; "unknown" o
  // "multiple-contexts" apuntan a otro documento del mismo hilo.
  const longTaskKinds = {};
  function observeLongTasks() {
    try {
      const po = new PerformanceObserver((list) => {
        list.getEntries().forEach((e) => {
          longTasks += 1;
          longTaskKinds[e.name] = (longTaskKinds[e.name] || 0) + 1;
        });
      });
      po.observe({ type: 'longtask', buffered: false });
    } catch (err) { /* no soportado: se queda en 0 */ }
  }

  function loafLine() {
    const limite = now() - LOAF_WINDOW_MS;
    const recientes = loafRecent.filter((f) => f.t >= limite);
    if (!recientes.length) return 'lentos 3s: ninguno';
    const n = recientes.length;
    const dur = recientes.reduce((a, f) => a + f.dur, 0) / n;
    const ren = recientes.reduce((a, f) => a + f.render, 0) / n;
    const scr = recientes.reduce((a, f) => a + f.script, 0) / n;
    const peor = recientes.reduce((a, f) => (f.script > a.script ? f : a), recientes[0]);
    return `lentos 3s: ${n} de ${fmt(dur)} ms (dib ${fmt(ren)} js ${fmt(scr)} otro ${fmt(Math.max(0, dur - ren - scr))})${peor.top ? '  top: ' + peor.top : ''}`;
  }

  function longTaskLine() {
    const partes = Object.keys(longTaskKinds).map((k) => `${k} ${longTaskKinds[k]}`);
    return `tareas largas ${longTasks}${partes.length ? ' (' + partes.join(', ') + ')' : ''}`;
  }

  // ¿Qué pinta el WebView? Crea un contexto WebGL de prueba y lee el nombre
  // del renderizador: "SwiftShader" o sin WebGL significa que se quedó sin
  // GPU. Es caro, así que se consulta como mucho cada 10 s y el contexto se
  // libera en el acto.
  const GPU_PROBE_MS = 30000;
  let gpuName = '-';
  let gpuProbedAt = -Infinity;
  function probeGpu() {
    if (now() - gpuProbedAt < GPU_PROBE_MS) return gpuName;
    gpuProbedAt = now();
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) {
        gpuName = 'SIN WEBGL';
      } else {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        gpuName = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'webgl (sin nombre)';
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (err) {
      gpuName = 'error';
    }
    return gpuName;
  }

  function median(values) {
    if (!values.length) return 0;
    const s = values.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  function avg(values) {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  function fmt(n) {
    return Number.isFinite(n) ? n.toFixed(1) : '-';
  }

  // Lo llama el bucle de main.js en cada fotograma.
  function frame(interval, updateMs, renderMs) {
    if (!enabled) return;
    if (Number.isFinite(interval) && interval > 0 && interval < 1000) {
      frames.push([interval, updateMs, renderMs]);
    }
    const t = now();
    if (t - lastPaint < REFRESH_MS) return;
    lastPaint = t;
    paint();
    frames = [];
  }

  function paint() {
    ensurePanel();
    const iv = frames.map((f) => f[0]);
    const up = frames.map((f) => f[1]);
    const rd = frames.map((f) => f[2]);
    const med = median(iv);
    const peor = iv.length ? Math.max(...iv) : 0;
    lastFps = med > 0 ? Math.round(1000 / med) : 0;
    const juego = avg(up) + avg(rd);
    const fuera = Math.max(0, avg(iv) - juego);
    const g = (typeof Game !== 'undefined' && Game.diagInfo) ? Game.diagInfo() : {};
    const m = (typeof Music !== 'undefined' && Music.diagInfo) ? Music.diagInfo() : {};
    const a = (typeof Ads !== 'undefined' && Ads.diagInfo) ? Ads.diagInfo() : {};
    const mem = performance.memory
      ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB`
      : '-';
    const lines = [
      `fps ${lastFps}  mediana ${fmt(med)} ms  peor ${fmt(peor)} ms`,
      `juego ${fmt(juego)} ms (upd ${fmt(avg(up))} / dib ${fmt(avg(rd))})  fuera ${fmt(fuera)} ms`,
      `lienzo ${g.canvas || '-'}  dpr ${g.dpr || '-'}  calidad ${g.ultraLow ? 'ULTRA' : (g.lowQuality ? 'BAJA' : 'alta')}`,
      `gpu ${probeGpu().slice(0, 48)}`,
      `jugador y ${g.playerY == null ? '-' : g.playerY}  (vista ${g.viewH == null ? '-' : g.viewH})`,
      `ctx perdido ${g.contextLost ? 'SÍ' : 'no'}  refrescos ${counters.surfaceRefresh}  modo ${g.mode || '-'}`,
      `anuncios vistos ${counters.adsShown}  cerrados ${counters.adsDismissed}  cargado ${a.loaded ? 'sí' : 'no'}  mostrando ${a.showing ? 'sí' : 'no'}`,
      `música ${m.state || '-'} timer ${m.timer ? 'sí' : 'no'} atraso ${fmt(m.lag)} s  nodos/s ${m.nodesPerSec == null ? '-' : m.nodesPerSec}`,
      longTaskLine(),
      loafLine(),
      `memoria ${mem}  ${document.visibilityState}`,
      ...events,
    ];
    document.getElementById('diag-text').textContent = lines.join('\n');
  }

  function init() {
    observeLongTasks();
    observeFrames();
    document.addEventListener('visibilitychange', () => log(`vis-${document.visibilityState}`));
    if (enabled) ensurePanel();
  }

  return {
    init, frame, log, attachLongPress, preloadDisabled, skip, autoQuality,
    isEnabled: () => enabled,
  };
})();
