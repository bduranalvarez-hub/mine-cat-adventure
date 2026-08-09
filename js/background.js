'use strict';

// Fondo de mina con parallax: pared rocosa texturizada, entramado de
// madera con pernos, vigas con faroles parpadeantes y polvo flotante.
// La textura de roca se hornea una sola vez fuera de pantalla.
const Background = (() => {
  const DUST_COUNT = 26;
  const TILE = 260;
  const TIER_FADE_SECONDS = 1.4; // duración del fundido entre minerales
  const GLINT_CELL = 190; // celda de mundo donde puede haber un destello

  // Niveles de mineral. Los cinco primeros van ligados a los mismos
  // umbrales que las medallas (CONFIG.MEDAL_METERS); DIAMANTE es un
  // nivel extra solo visual, sin medalla asociada. Al alcanzarlos, la
  // roca del fondo cambia. Los destellos aparecen desde la plata y son
  // más densos cuanto más valioso es el mineral.
  //
  // sheetCol indica la columna de img/ores.png (arte del jugador) con
  // los grupos de roca de ese mineral; ver ORE_SHEET y bakeRockTile.
  const MEDAL = CONFIG.MEDAL_METERS;
  const DIAMOND_METERS = 3000;
  const ORE_TIERS = [
    { min: 0, sheetCol: 0, base: '#201007',
      wall: [[16, 7, 2], [34, 17, 7], [21, 10, 4]],
      glintDensity: 0, glint: null },
    { min: MEDAL.BRONZE, sheetCol: 1, base: '#1f0f06',
      wall: [[18, 7, 3], [39, 18, 8], [22, 10, 4]],
      glintDensity: 0, glint: null },
    { min: MEDAL.SILVER, sheetCol: 2, base: '#121316',
      wall: [[10, 11, 13], [25, 27, 32], [14, 15, 18]],
      glintDensity: 0.10, glint: [242, 246, 255] },
    { min: MEDAL.GOLD, sheetCol: 3, base: '#1e1505',
      wall: [[16, 10, 2], [36, 26, 6], [19, 13, 3]],
      glintDensity: 0.17, glint: [255, 233, 160] },
    { min: MEDAL.PLATINUM, sheetCol: 4, base: '#0f151a',
      wall: [[7, 11, 14], [20, 29, 36], [10, 15, 19]],
      glintDensity: 0.27, glint: [234, 250, 255] },
    { min: DIAMOND_METERS, sheetCol: 5, base: '#08121d',
      wall: [[5, 12, 22], [13, 30, 48], [8, 18, 30]],
      glintDensity: 0.40, glint: [170, 225, 255] },
  ];

  // Hoja de sprites con los bloques de roca dibujados a mano: 6
  // columnas, una por mineral, en el mismo orden que ORE_TIERS. Las
  // celdas son RECTANGULARES (más altas que anchas), así que al
  // estamparlas hay que respetar su proporción o las rocas se
  // deforman (ver bakeRockTile). Un solo bloque por mineral: la
  // variedad sale del tamaño, la rotación y el volteo horizontal.
  const ORE_SHEET = { cols: 6, cellW: 197, cellH: 345 };
  const oreImg = new Image();
  let oreReady = false;
  oreImg.onload = () => { oreReady = true; };
  oreImg.src = 'img/ores.png';

  let dust = [];
  const tiles = [];     // textura de roca horneada, por nivel
  const patterns = [];  // patrón repetible, por nivel
  const glintSprites = []; // sprite de destello, por nivel
  let vignette = null;
  let vignetteKey = '';

  // Fundido entre el nivel visible y el recién alcanzado.
  let shownTier = 0;
  let nextTier = 0;
  let fade = 1; // 1 = transición terminada

  function reset(viewW, viewH) {
    dust = Array.from({ length: DUST_COUNT }, () => ({
      x: Math.random() * viewW,
      y: Math.random() * viewH,
      r: 1 + Math.random() * 2.5,
      speed: 0.05 + Math.random() * 0.2,
      drift: (Math.random() - 0.5) * 12,
    }));
    shownTier = 0;
    nextTier = 0;
    fade = 1;

    // Se hornean todas las texturas por adelantado (una sola vez): así
    // cruzar un umbral a mitad de partida nunca provoca un tirón. Si
    // el arte aún no cargó, patternFor() las horneará al estar listo.
    if (oreReady) {
      for (let i = 0; i < ORE_TIERS.length; i += 1) {
        if (!tiles[i]) tiles[i] = bakeRockTile(i);
      }
    }
  }

  function tierIndexFor(meters) {
    for (let i = ORE_TIERS.length - 1; i >= 0; i -= 1) {
      if (meters >= ORE_TIERS[i].min) return i;
    }
    return 0;
  }

  // Hash determinista: mismas posiciones de destello en cada partida,
  // ancladas al mundo (no al mosaico), así no se repiten visiblemente.
  function hash2(x, y) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // --- Textura de roca (tile repetible, uno por nivel) --------------------
  // Estampa los grupos de roca dibujados a mano (img/ores.png) sobre el
  // color base del mineral. La semilla fija hace que los grupos ocupen
  // las MISMAS posiciones en todos los niveles: al cambiar de mineral
  // solo cambia el arte, no la composición.
  function bakeRockTile(tierIdx) {
    const tier = ORE_TIERS[tierIdx];
    const CW = ORE_SHEET.cellW;
    const CH = ORE_SHEET.cellH;
    const ASPECT = CH / CW; // los bloques son más altos que anchos
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const b = c.getContext('2d');
    b.fillStyle = tier.base;
    b.fillRect(0, 0, TILE, TILE);

    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // Cada bloque se estampa también desplazado ±TILE para que el
    // patrón repita sin costuras. flip voltea en horizontal: como hay
    // un solo bloque por mineral, es lo que evita que se note repetido.
    const stampGroup = (x, y, w, rot, flip) => {
      const sx = tier.sheetCol * CW;
      const h = w * ASPECT;
      [-TILE, 0, TILE].forEach((ox) => {
        [-TILE, 0, TILE].forEach((oy) => {
          b.save();
          b.translate(x + ox, y + oy);
          b.rotate(rot);
          b.scale(flip, 1);
          b.drawImage(oreImg, sx, 0, CW, CH, -w / 2, -h / 2, w, h);
          b.restore();
        });
      });
    };

    // Menos bloques y más grandes que con el arte anterior: estos ya
    // vienen llenos de roca, así que 5 pasadas cubren la pared sin
    // volverla ruidosa.
    for (let i = 0; i < 5; i += 1) {
      const x = rnd() * TILE;
      const y = rnd() * TILE;
      const w = TILE * (0.45 + rnd() * 0.3);
      const rot = (rnd() - 0.5) * 0.5;
      const flip = rnd() < 0.5 ? -1 : 1;
      stampGroup(x, y, w, rot, flip);
    }
    return c;
  }

  function patternFor(ctx, tierIdx) {
    // El arte llega por red: hasta que cargue no hay textura (la pared
    // muestra solo su gradiente) y se hornea en el primer frame listo.
    if (!oreReady) return null;
    if (!tiles[tierIdx]) tiles[tierIdx] = bakeRockTile(tierIdx);
    if (!patterns[tierIdx]) {
      patterns[tierIdx] = ctx.createPattern(tiles[tierIdx], 'repeat');
    }
    return patterns[tierIdx];
  }

  // Sprite de destello (se estampa con blending aditivo).
  function glintSprite(rgb) {
    const S = 48;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const b = c.getContext('2d');
    const [r, g, bl] = rgb;
    const grad = b.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.3, `rgba(${r},${g},${bl},0.35)`);
    grad.addColorStop(1, `rgba(${r},${g},${bl},0)`);
    b.fillStyle = grad;
    b.beginPath();
    b.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    b.fill();
    b.strokeStyle = 'rgba(255,255,255,0.8)';
    b.lineWidth = 1.6;
    b.lineCap = 'round';
    b.beginPath();
    b.moveTo(4, S / 2); b.lineTo(S - 4, S / 2);
    b.moveTo(S / 2, 4); b.lineTo(S / 2, S - 4);
    b.stroke();
    return c;
  }

  // Avanza el fundido hacia el nivel de mineral que corresponde a la
  // distancia recorrida en esta partida.
  function updateTier(worldX, dt) {
    const meters = worldX / CONFIG.UNITS_PER_METER;
    const target = tierIndexFor(meters);
    if (target !== nextTier) {
      shownTier = nextTier;
      nextTier = target;
      fade = 0;
    }
    if (fade < 1) {
      fade = Math.min(1, fade + dt / TIER_FADE_SECONDS);
      if (fade >= 1) shownTier = nextTier;
    }
  }

  function wallGradient(ctx, viewH) {
    const a = ORE_TIERS[shownTier].wall;
    const b = ORE_TIERS[nextTier].wall;
    const grad = ctx.createLinearGradient(0, 0, 0, viewH);
    for (let i = 0; i < 3; i += 1) {
      const r = Math.round(a[i][0] + (b[i][0] - a[i][0]) * fade);
      const g = Math.round(a[i][1] + (b[i][1] - a[i][1]) * fade);
      const bl = Math.round(a[i][2] + (b[i][2] - a[i][2]) * fade);
      grad.addColorStop(i * 0.5, `rgb(${r},${g},${bl})`);
    }
    return grad;
  }

  function drawWall(ctx, worldX, camY, viewW, viewH) {
    ctx.fillStyle = wallGradient(ctx, viewH);
    ctx.fillRect(0, 0, viewW, viewH);

    const shownPattern = patternFor(ctx, shownTier);
    if (!shownPattern) return; // arte aún cargando: queda el gradiente

    const ox = -((worldX * 0.15) % TILE);
    const oy = -((camY * 0.2) % TILE);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = shownPattern;
    ctx.fillRect(-TILE, -TILE, viewW + TILE * 2, viewH + TILE * 2);
    if (nextTier !== shownTier) {
      // El mineral nuevo aparece por encima del anterior.
      ctx.globalAlpha = 0.85 * fade;
      ctx.fillStyle = patternFor(ctx, nextTier);
      ctx.fillRect(-TILE, -TILE, viewW + TILE * 2, viewH + TILE * 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Destellos titilantes sobre la roca. Se calculan en cada frame a
  // partir de coordenadas de mundo (no se hornean en el mosaico), así
  // no aparecen repetidos en una cuadrícula visible.
  function drawGlintsForTier(ctx, tierIdx, worldX, camY, viewW, viewH, time, alpha) {
    const tier = ORE_TIERS[tierIdx];
    if (!tier.glint || tier.glintDensity <= 0 || alpha <= 0.01) return;
    if (!glintSprites[tierIdx]) glintSprites[tierIdx] = glintSprite(tier.glint);
    const sprite = glintSprites[tierIdx];

    // Mismo parallax que la pared de roca: los destellos van pegados a ella.
    const px = worldX * 0.15;
    const py = camY * 0.2;
    const cx0 = Math.floor((px - GLINT_CELL) / GLINT_CELL);
    const cx1 = Math.floor((px + viewW + GLINT_CELL) / GLINT_CELL);
    const cy0 = Math.floor((py - GLINT_CELL) / GLINT_CELL);
    const cy1 = Math.floor((py + viewH + GLINT_CELL) / GLINT_CELL);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let cx = cx0; cx <= cx1; cx += 1) {
      for (let cy = cy0; cy <= cy1; cy += 1) {
        // Los niveles ricos usan una densidad mayor sobre el mismo
        // hash, así los destellos se acumulan en vez de reubicarse.
        if (hash2(cx, cy) > tier.glintDensity) continue;
        const gx = cx * GLINT_CELL + hash2(cx + 1013, cy - 77) * GLINT_CELL - px;
        const gy = cy * GLINT_CELL + hash2(cx - 91, cy + 557) * GLINT_CELL - py;
        const phase = hash2(cx + 31, cy + 17);
        const pulse = Math.max(0, Math.sin(time * 1.9 + phase * Math.PI * 2));
        const tw = pulse * pulse * pulse * pulse * pulse * pulse; // picos breves
        const size = 16 + 16 * tw;
        ctx.globalAlpha = alpha * (0.18 + 0.82 * tw);
        ctx.drawImage(sprite, gx - size / 2, gy - size / 2, size, size);
      }
    }
    ctx.restore();
  }

  function drawGlints(ctx, worldX, camY, viewW, viewH, time) {
    if (nextTier !== shownTier) {
      drawGlintsForTier(ctx, shownTier, worldX, camY, viewW, viewH, time, 1 - fade);
      drawGlintsForTier(ctx, nextTier, worldX, camY, viewW, viewH, time, fade);
    } else {
      drawGlintsForTier(ctx, shownTier, worldX, camY, viewW, viewH, time, 1);
    }
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
    updateTier(state.worldX, dt);
    drawWall(ctx, state.worldX, state.camY, viewW, viewH);
    // Los destellos van sobre la roca pero DETRÁS de la madera.
    drawGlints(ctx, state.worldX, state.camY, viewW, viewH, state.time);
    drawLattice(ctx, state.worldX, state.camY, viewW, viewH);
    drawBeams(ctx, state.worldX, state.camY, viewW, viewH, state.time);
    drawDust(ctx, dt, state.speed, viewW, viewH);
    drawPit(ctx, viewW, viewH);
  }

  return { reset, draw, drawVignette };
})();
