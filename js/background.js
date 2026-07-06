'use strict';

// Fondo de mina con parallax: pared rocosa texturizada, entramado de
// madera con pernos, vigas con faroles parpadeantes y polvo flotante.
// La textura de roca se hornea una sola vez fuera de pantalla.
const Background = (() => {
  const DUST_COUNT = 26;
  const TILE = 260;

  let dust = [];
  let rockTile = null;
  let rockPattern = null;
  let vignette = null;
  let vignetteKey = '';

  function reset(viewW, viewH) {
    dust = Array.from({ length: DUST_COUNT }, () => ({
      x: Math.random() * viewW,
      y: Math.random() * viewH,
      r: 1 + Math.random() * 2.5,
      speed: 0.05 + Math.random() * 0.2,
      drift: (Math.random() - 0.5) * 12,
    }));
  }

  // --- Textura de roca (tile repetible) ----------------------------------
  function bakeRockTile() {
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const b = c.getContext('2d');
    b.fillStyle = '#201007';
    b.fillRect(0, 0, TILE, TILE);

    // Cada roca se dibuja también desplazada ±TILE para que el patrón
    // no tenga costuras.
    const drawStone = (x, y, r, seed) => {
      [-TILE, 0, TILE].forEach((ox) => {
        [-TILE, 0, TILE].forEach((oy) => {
          const g = b.createRadialGradient(
            x + ox - r * 0.35, y + oy - r * 0.45, r * 0.15,
            x + ox, y + oy, r * 1.1
          );
          g.addColorStop(0, 'rgba(66, 38, 20, 0.85)');
          g.addColorStop(1, 'rgba(22, 11, 5, 0.85)');
          b.fillStyle = g;
          b.beginPath();
          const sides = 7;
          for (let k = 0; k <= sides; k += 1) {
            const a = (k / sides) * Math.PI * 2;
            const rr = r * (0.72 + Math.sin(a * 3 + seed) * 0.2);
            const px = x + ox + Math.cos(a) * rr;
            const py = y + oy + Math.sin(a) * rr;
            if (k === 0) b.moveTo(px, py);
            else b.lineTo(px, py);
          }
          b.closePath();
          b.fill();
          b.strokeStyle = 'rgba(0, 0, 0, 0.35)';
          b.lineWidth = 1.6;
          b.stroke();
        });
      });
    };

    for (let i = 0; i < 22; i += 1) {
      drawStone(
        Math.random() * TILE,
        Math.random() * TILE,
        16 + Math.random() * 30,
        i * 2.3
      );
    }

    // Vetas doradas diminutas.
    b.fillStyle = 'rgba(255, 205, 100, 0.5)';
    for (let i = 0; i < 9; i += 1) {
      b.fillRect(Math.random() * TILE, Math.random() * TILE, 2.2, 2.2);
    }
    return c;
  }

  function drawWall(ctx, worldX, camY, viewW, viewH) {
    const grad = ctx.createLinearGradient(0, 0, 0, viewH);
    grad.addColorStop(0, '#100702');
    grad.addColorStop(0.5, '#221107');
    grad.addColorStop(1, '#150a04');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);

    if (!rockTile) rockTile = bakeRockTile();
    if (!rockPattern) rockPattern = ctx.createPattern(rockTile, 'repeat');
    const ox = -((worldX * 0.15) % TILE);
    const oy = -((camY * 0.2) % TILE);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = rockPattern;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-TILE, -TILE, viewW + TILE * 2, viewH + TILE * 2);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Rejilla de madera del fondo (parallax lento) con pernos.
  function drawLattice(ctx, worldX, camY, viewW, viewH) {
    const offset = (worldX * 0.25) % 140;
    const vOffset = (camY * 0.25) % 130;

    ctx.strokeStyle = 'rgba(58, 33, 16, 0.9)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    for (let x = -offset; x < viewW + 140; x += 140) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewH);
    }
    for (let y = 40 - vOffset - 130; y < viewH + 130; y += 130) {
      ctx.moveTo(0, y);
      ctx.lineTo(viewW, y);
    }
    ctx.stroke();

    // Borde iluminado y veta de cada tablón.
    ctx.strokeStyle = 'rgba(96, 58, 28, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = -offset - 7; x < viewW + 140; x += 140) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewH);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20, 10, 4, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = -offset + 8; x < viewW + 140; x += 140) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewH);
    }
    ctx.stroke();

    // Pernos en las intersecciones.
    for (let x = -offset; x < viewW + 140; x += 140) {
      for (let y = 40 - vOffset - 130; y < viewH + 130; y += 130) {
        ctx.fillStyle = 'rgba(15, 8, 3, 0.8)';
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(150, 100, 50, 0.35)';
        ctx.beginPath();
        ctx.arc(x - 1, y - 1, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Vigas de soporte cercanas (parallax medio) con faroles colgantes.
  // Postes, travesaños y faroles están anclados a coordenadas de MUNDO
  // (nada de módulos sobre la cámara): al saltar se desplazan de forma
  // continua, sin brincos.
  function drawBeams(ctx, worldX, camY, viewW, viewH, time) {
    const spacingX = 460;
    const spacingY = 300;
    const px = worldX * 0.6; // desplazamiento de parallax
    const py = camY * 0.6;

    const firstX = Math.floor(px / spacingX) * spacingX;
    const firstY = Math.floor(py / spacingY) * spacingY;

    for (let bx = firstX; bx < px + viewW + spacingX; bx += spacingX) {
      const x = bx - px;
      // Poste con vetas (a lo alto de toda la pantalla).
      ctx.fillStyle = '#3f2712';
      ctx.fillRect(x, 0, 26, viewH);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 18, 0, 8, viewH);
      ctx.fillStyle = 'rgba(90, 55, 25, 0.4)';
      ctx.fillRect(x + 2, 0, 3, viewH);

      for (let by = firstY; by < py + viewH + spacingY; by += spacingY) {
        const y = by - py;
        // Travesaño.
        ctx.fillStyle = '#3f2712';
        ctx.fillRect(x - 34, y, 94, 20);
        ctx.fillStyle = 'rgba(90, 55, 25, 0.4)';
        ctx.fillRect(x - 34, y, 94, 4);

        // Farol en travesaños alternos, con fase de parpadeo propia.
        const col = Math.round(bx / spacingX);
        const row = Math.round(by / spacingY);
        if ((col + row) % 2 !== 0) continue;
        const flick = 0.75 + 0.25 * Math.sin(time * 7 + col * 13.7 + row * 5.3);
        const lx = x + 13;
        const ly = y + 42;
        const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 60 * flick);
        glow.addColorStop(0, 'rgba(255, 190, 90, 0.32)');
        glow.addColorStop(1, 'rgba(255, 160, 60, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(lx, ly, 60 * flick, 0, Math.PI * 2);
        ctx.fill();
        // Cadena y cuerpo del farol.
        ctx.strokeStyle = 'rgba(20, 12, 6, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx, y + 20);
        ctx.lineTo(lx, ly - 9);
        ctx.stroke();
        ctx.fillStyle = '#2a1a0c';
        ctx.fillRect(lx - 5, ly - 9, 10, 15);
        ctx.fillStyle = `rgba(255, 205, 110, ${0.75 + 0.25 * flick})`;
        ctx.fillRect(lx - 3, ly - 6, 6, 9);
      }
    }
  }

  function drawDust(ctx, dt, speed, viewW, viewH) {
    ctx.fillStyle = 'rgba(255, 220, 160, 0.35)';
    dust.forEach((p) => {
      p.x -= speed * p.speed * dt;
      p.y += p.drift * dt;
      if (p.x < -5) {
        p.x = viewW + 5;
        p.y = Math.random() * viewH;
      }
      if (p.y < -5) p.y = viewH + 5;
      if (p.y > viewH + 5) p.y = -5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Oscuridad al fondo del pozo, en la parte baja de la pantalla.
  function drawPit(ctx, viewW, viewH) {
    const top = viewH * 0.72;
    const grad = ctx.createLinearGradient(0, top, 0, viewH);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, viewW, viewH - top);
  }

  // Viñeta: esquinas oscuras sobre TODO lo demás (se llama al final
  // del render). Se hornea de nuevo solo si cambia el tamaño.
  function vignetteFor(ctx, viewW, viewH) {
    const key = `${Math.round(viewW)}x${Math.round(viewH)}`;
    if (vignetteKey !== key) {
      vignette = ctx.createRadialGradient(
        viewW / 2, viewH * 0.45, Math.min(viewW, viewH) * 0.45,
        viewW / 2, viewH * 0.5, Math.max(viewW, viewH) * 0.78
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
      vignetteKey = key;
    }
    return vignette;
  }

  function drawVignette(ctx, viewW, viewH) {
    ctx.fillStyle = vignetteFor(ctx, viewW, viewH);
    ctx.fillRect(0, 0, viewW, viewH);
  }

  function draw(ctx, state, dt, viewW, viewH) {
    drawWall(ctx, state.worldX, state.camY, viewW, viewH);
    drawLattice(ctx, state.worldX, state.camY, viewW, viewH);
    drawBeams(ctx, state.worldX, state.camY, viewW, viewH, state.time);
    drawDust(ctx, dt, state.speed, viewW, viewH);
    drawPit(ctx, viewW, viewH);
  }

  return { reset, draw, drawVignette };
})();
