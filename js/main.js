'use strict';

// Arranque: canvas, entrada y bucle de animación.
(() => {
  const canvas = document.getElementById('game');
  Game.setup(canvas);
  setupInput(Game.handleAction, Game.handleRelease);
  window.MineCat = Game;

  window.addEventListener('resize', () => Game.resize());
  window.addEventListener('orientationchange', () => {
    setTimeout(() => Game.resize(), 250);
  });

  // PWA: el service worker permite jugar sin conexión e instalar
  // el juego en la pantalla de inicio.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* sin soporte o protocolo file:// — el juego funciona igual */
      });
    });
  }

  let lastTime = performance.now();
  function frame(now) {
    // Limita dt para evitar saltos enormes al volver de segundo plano.
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;
    Game.update(dt);
    Game.render(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
