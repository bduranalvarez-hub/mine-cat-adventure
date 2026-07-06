'use strict';

// Entrada unificada: toque, clic y teclado disparan la misma acción.
// Al soltar se avisa con onRelease (para el salto variable).
// Los elementos interactivos (botones, campos de texto) quedan fuera:
// gestionan sus propios eventos.
function setupInput(onAction, onRelease) {
  const isInteractive = (target) =>
    target && target.closest && target.closest('button, input, a, select, textarea');

  window.addEventListener(
    'pointerdown',
    (event) => {
      if (isInteractive(event.target)) return;
      event.preventDefault();
      GameAudio.unlock();
      onAction();
    },
    { passive: false }
  );

  window.addEventListener('pointerup', (event) => {
    if (isInteractive(event.target)) return;
    onRelease();
  });
  window.addEventListener('pointercancel', () => onRelease());

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (isInteractive(event.target)) return; // escribiendo en el login
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      GameAudio.unlock();
      onAction();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (isInteractive(event.target)) return;
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      onRelease();
    }
  });

  // Evita el scroll elástico y el zoom con doble toque en iOS.
  document.addEventListener(
    'touchmove',
    (e) => {
      if (!isInteractive(e.target)) e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener('dblclick', (e) => {
    if (!isInteractive(e.target)) e.preventDefault();
  });
}
