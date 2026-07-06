'use strict';

// La pista tiene tres capas:
//  - points: perfil base de altura (colinas), interpolado suave.
//  - segments: tramos con riel [x0, x1]; entre ellos hay huecos mortales.
//  - cada tramo tiene además su propio desnivel `dy`: el riel siguiente
//    puede estar en un saliente más alto o más bajo.
// Las alturas son coordenadas de mundo: 0 es la línea base, +y es abajo.
const Track = (() => {
  const MAX_RISE = 90; // subida máxima saltable entre tramos
  const MAX_DROP = 260; // caída máxima entre tramos
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function create() {
    const flatUntil = CONFIG.TRACK.FIRST_RAIL * 0.55;
    return {
      points: [
        { x: -600, y: 0 },
        { x: flatUntil, y: 0 },
      ],
      segments: [{ x0: -400, x1: CONFIG.TRACK.FIRST_RAIL, dy: 0 }],
      generatedUntil: CONFIG.TRACK.FIRST_RAIL,
      pointsUntil: flatUntil,
      lastY: 0,
    };
  }

  function extendHeights(track, untilX) {
    const t = CONFIG.TRACK;
    const mode = Modes.get();
    while (track.pointsUntil < untilX) {
      const dx = rand(t.POINT_DX_MIN, t.POINT_DX_MAX);
      const maxDy = mode.maxSlope * dx;
      const dy = rand(-maxDy, maxDy);
      const y = clamp(track.lastY + dy, -mode.heightRange, mode.heightRange);
      track.points.push({ x: track.pointsUntil + dx, y });
      track.pointsUntil += dx;
      track.lastY = y;
    }
  }

  // Genera rieles y alturas por delante; los huecos crecen con la
  // dificultad (0 → 1). Cada tramo nuevo puede quedar en un saliente
  // más alto o más bajo que el anterior.
  function extend(track, untilX, difficulty) {
    const t = CONFIG.TRACK;
    extendHeights(track, untilX + 900);
    const mode = Modes.get();
    while (track.generatedUntil < untilX) {
      const gapMax = mode.gapMaxStart + (mode.gapMaxEnd - mode.gapMaxStart) * difficulty;
      let gap = rand(t.GAP_MIN, gapMax);
      // Cuesta arriba el salto cubre menos distancia: hueco más corto
      // (y mucho más corto si la subida es muy empinada).
      const slope = baseSlopeAt(track, track.generatedUntil + gap * 0.5);
      if (slope < -0.45) gap *= 0.5;
      else if (slope < -0.3) gap *= 0.6;
      else if (slope < -0.12) gap *= 0.72;

      const prev = track.segments[track.segments.length - 1];
      const x0 = track.generatedUntil + gap;
      const railLen = rand(mode.railMin, mode.railMax);

      // Desnivel del nuevo tramo: caídas grandes, subidas cortas,
      // con tendencia a volver al nivel base.
      const step = Math.random() < 0.55 ? rand(25, 150) : -rand(15, 85);
      let dy = clamp(prev.dy * 0.7 + step, -160, 220);

      // La subida total (perfil base + desnivel) debe ser saltable, y
      // la caída no puede ser un abismo.
      const edgePrev = baseHeightAt(track, prev.x1) + prev.dy;
      const edgeNew = baseHeightAt(track, x0) + dy;
      const rise = edgePrev - edgeNew; // +y es abajo: positivo = subir
      if (rise > MAX_RISE) dy += rise - MAX_RISE;
      if (-rise > MAX_DROP) dy -= -rise - MAX_DROP;

      track.segments.push({ x0, x1: x0 + railLen, dy });
      track.generatedUntil = x0 + railLen;
    }
  }

  function prune(track, beforeX) {
    while (track.segments.length > 1 && track.segments[0].x1 < beforeX) {
      track.segments.shift();
    }
    while (track.points.length > 2 && track.points[1].x < beforeX) {
      track.points.shift();
    }
  }

  // Perfil base de colinas (interpolación coseno entre puntos).
  function baseHeightAt(track, x) {
    const pts = track.points;
    if (x <= pts[0].x) return pts[0].y;
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (x <= pts[i + 1].x) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const t = (x - p0.x) / (p1.x - p0.x);
        const s = (1 - Math.cos(t * Math.PI)) / 2;
        return p0.y + (p1.y - p0.y) * s;
      }
    }
    return pts[pts.length - 1].y;
  }

  function baseSlopeAt(track, x) {
    return (baseHeightAt(track, x + 10) - baseHeightAt(track, x - 10)) / 20;
  }

  // Desnivel del tramo que contiene x. En los huecos se usa el del
  // tramo siguiente (a la derecha), para que los objetos que caen por
  // el borde no den un salto brusco.
  function segmentDyAt(track, x) {
    const segs = track.segments;
    for (let i = 0; i < segs.length; i += 1) {
      if (x <= segs[i].x1) return segs[i].dy;
    }
    return segs[segs.length - 1].dy;
  }

  // Altura real del riel en x: colinas + desnivel del tramo.
  function heightAt(track, x) {
    return baseHeightAt(track, x) + segmentDyAt(track, x);
  }

  function slopeAt(track, x) {
    return (heightAt(track, x + 10) - heightAt(track, x - 10)) / 20;
  }

  function hasRailAt(track, x) {
    return track.segments.some((s) => x >= s.x0 && x <= s.x1);
  }

  // Comprueba que haya riel continuo en [x - margin, x + margin].
  function hasRailAround(track, x, margin) {
    return track.segments.some(
      (s) => x - margin >= s.x0 && x + margin <= s.x1
    );
  }

  function buildRailPath(track, worldX, camY, x0, x1, dx, dy) {
    const step = 18;
    const path = new Path2D();
    path.moveTo(x0 - worldX + dx, heightAt(track, x0) - camY + dy);
    for (let x = x0 + step; x < x1 + step; x += step) {
      const cx = Math.min(x, x1);
      path.lineTo(cx - worldX + dx, heightAt(track, cx) - camY + dy);
    }
    return path;
  }

  // Vía de dos rieles gruesos y redondeados en perspectiva (el
  // trasero arriba y detrás), traviesas de madera entre ambos y
  // remaches a lo largo del riel delantero.
  const BACK_DX = 5;
  const BACK_DY = -12;

  function drawRail(ctx, track, worldX, camY, x0, x1) {
    const front = buildRailPath(track, worldX, camY, x0, x1, 0, 0);
    const back = buildRailPath(track, worldX, camY, x0, x1, BACK_DX, BACK_DY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Riel trasero (más fino y oscuro).
    ctx.strokeStyle = '#1d1d24';
    ctx.lineWidth = 9;
    ctx.stroke(back);
    ctx.strokeStyle = '#45454f';
    ctx.lineWidth = 4.5;
    ctx.stroke(back);

    // Traviesas de madera entre los dos rieles.
    const tieSpacing = 46;
    const firstTie = Math.ceil(x0 / tieSpacing) * tieSpacing;
    for (let x = firstTie; x < x1; x += tieSpacing) {
      const sx = x - worldX;
      const sy = heightAt(track, x) - camY;
      ctx.strokeStyle = '#3a2510';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(sx + BACK_DX + 2, sy + BACK_DY - 4);
      ctx.lineTo(sx - 2, sy + 4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120, 78, 38, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + BACK_DX + 1, sy + BACK_DY - 3);
      ctx.lineTo(sx - 3, sy + 3);
      ctx.stroke();
    }

    // Riel delantero: gordo, oscuro y con cuerpo metálico.
    ctx.strokeStyle = '#1d1d24';
    ctx.lineWidth = 12;
    ctx.stroke(front);
    ctx.strokeStyle = '#585864';
    ctx.lineWidth = 6.5;
    ctx.stroke(front);
    ctx.save();
    ctx.translate(0, -3.2);
    ctx.strokeStyle = 'rgba(190, 190, 208, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.stroke(front);
    ctx.restore();

    // Remaches a lo largo del riel delantero.
    const rivetSpacing = 92;
    const firstRivet = Math.ceil(x0 / rivetSpacing) * rivetSpacing;
    for (let x = firstRivet; x < x1; x += rivetSpacing) {
      const sx = x - worldX;
      const sy = heightAt(track, x) - camY;
      ctx.fillStyle = '#121218';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(sx - 0.9, sy - 0.9, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(ctx, track, worldX, camY, viewW, viewH) {
    track.segments.forEach((seg) => {
      const x0 = Math.max(seg.x0, worldX - 60);
      const x1 = Math.min(seg.x1, worldX + viewW + 60);
      if (x1 <= x0) return;

      drawRail(ctx, track, worldX, camY, x0, x1);

      // Bordes del hueco: poste astillado y muñón de riel doblado.
      [[seg.x0, -1], [seg.x1, 1]].forEach(([edge, side]) => {
        const sx = edge - worldX;
        if (sx < -60 || sx > viewW + 60) return;
        const sy = heightAt(track, edge) - camY;
        ctx.save();
        ctx.translate(sx, sy);
        // Poste principal.
        ctx.fillStyle = '#4a2f16';
        ctx.fillRect(-3.5, -3, 7, 23);
        // Astilla inclinada hacia el vacío.
        ctx.rotate(side * 0.5);
        ctx.fillStyle = '#5a3a1c';
        ctx.fillRect(-2, -14, 4, 15);
        ctx.restore();
        // Muñones de ambos rieles doblados hacia abajo.
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#585864';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + side * 8, sy + 1, sx + side * 13, sy + 8);
        ctx.stroke();
        ctx.strokeStyle = '#45454f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx + 5, sy - 12);
        ctx.quadraticCurveTo(sx + 5 + side * 6, sy - 11, sx + 5 + side * 10, sy - 5);
        ctx.stroke();
      });
    });
  }

  return {
    create, extend, prune, heightAt, slopeAt,
    hasRailAt, hasRailAround, draw,
  };
})();
