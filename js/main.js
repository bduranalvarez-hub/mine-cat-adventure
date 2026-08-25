'use strict';

// Arranque: canvas, entrada y bucle de animación.
(() => {
  const canvas = document.getElementById('game');
  Game.setup(canvas);
  setupInput(Game.handleAction, Game.handleRelease);
  window.MineCat = Game;

  // SDK de anuncios (solo hace algo dentro de la app compilada).
  // No bloquea el arranque: si falla, Ads.available() queda en false y
  // el juego sigue igual, sin ofrecer revivir ni anuncios en la tienda.
  Ads.init();

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

  // Aviso de version nueva. Se consulta al arrancar y NO bloquea: si no
  // hay conexion o el manifiesto falla, Version.check() devuelve null y
  // el juego arranca igual.
  Version.check().then((info) => {
    if (!info) return;
    const banner = document.getElementById('update-banner');
    const text = document.getElementById('update-text');
    const action = document.getElementById('update-action');
    const close = document.getElementById('update-close');
    if (!banner) return;

    const pintar = () => {
      text.textContent = I18n.t(
        info.kind === 'android' ? 'updateAndroid' : 'updateWeb',
        { v: info.label }
      );
      action.textContent = I18n.t(
        info.kind === 'android' ? 'updateBtnPlay' : 'updateBtnReload'
      );
    };
    pintar();
    // El aviso puede quedar en pantalla mientras se cambia de idioma.
    document.addEventListener('mca-lang-change', pintar);

    action.addEventListener('click', () => {
      if (info.kind === 'android') {
        // La app nativa no puede actualizarse sola: se abre su ficha de
        // Play y el usuario decide.
        window.open(info.url, '_blank');
      } else {
        // En web basta recargar: el service worker es red-primero, asi
        // que la recarga ya trae los archivos nuevos.
        window.location.reload();
      }
    });
    close.addEventListener('click', () => {
      Version.dismiss(info.remoteNum);
      banner.classList.add('hidden');
    });
    banner.classList.remove('hidden');
  });

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
