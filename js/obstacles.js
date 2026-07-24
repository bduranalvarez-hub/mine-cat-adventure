'use strict';

// Dos tipos de peligro sobre los rieles:
//  - 'wreck': vagoneta averiada y volcada sobre la vía, se salta.
//  - 'cart': vagoneta enemiga que viene de frente; si llega a un
//    hueco, se cae al pozo (y deja de ser peligrosa).
const Obstacles = (() => {
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function create() {
    return {
      list: [],
      nextWreckX: CONFIG.WRECKS.FIRST_AT,
      cartTimer: Modes.get().oncoming.firstDelay,
    };
  }

  // Vagones averiados: siempre sobre riel firme y lejos de los
  // bordes de los huecos.
  function spawnWrecks(obstacles, track, untilX, difficulty) {
    const w = CONFIG.WRECKS;
    const mode = Modes.get();
    const spacingMin =
      lerp(w.SPACING_MIN_START, w.SPACING_MIN_END, difficulty) * mode.wreckSpacingFactor;
    const spacingMax =
      lerp(w.SPACING_MAX_START, w.SPACING_MAX_END, difficulty) * mode.wreckSpacingFactor;

    let guard = 0;
    while (obstacles.nextWreckX < untilX && guard < 200) {
      guard += 1;
      // Nunca en subidas empinadas: ahí el salto gana poca altura.
      const uphill = Track.slopeAt(track, obstacles.nextWreckX) < -0.25;
      if (!uphill && Track.hasRailAround(track, obstacles.nextWreckX, mode.wreckRailMargin)) {
        obstacles.list.push({
          type: 'wreck',
          x: obstacles.nextWreckX,
          dropY: 0,
          seed: Math.random() * 10,
        });
        obstacles.nextWreckX += rand(spacingMin, spacingMax);
      } else {
        obstacles.nextWreckX += 100;
      }
    }
  }

  // Un salto en subida gana poca altura (el riel ascendente alcanza a
  // la vagoneta y corta el tiempo de aire), así que no se puede saltar
  // a un enemigo a tiempo. Detecta si la zona donde el jugador lanzaría
  // y completaría el salto (un poco antes del cruce y en el cruce) cae
  // en una pendiente ascendente pronunciada. Pendiente < 0 = terreno
  // que sube.
  function ascendingNear(track, x) {
    const here = Track.slopeAt(track, x);
    const beforeJump = Track.slopeAt(track, x - 150);
    return Math.min(here, beforeJump) < -0.2;
  }

  // Vagonetas de frente: aparecen fuera de pantalla y ruedan hacia
  // el jugador. Antes de aparecer se estima dónde se cruzarán con el
  // jugador: si allí hay un vagón averiado, un hueco, o una subida
  // pronunciada (donde no se puede saltar al enemigo), el cruce sería
  // una trampa sin salida y se pospone.
  function spawnCarts(obstacles, track, dt, worldX, viewW, difficulty, px, playerSpeed) {
    const c = Modes.get().oncoming;
    obstacles.cartTimer -= dt;
    if (obstacles.cartTimer > 0) return;

    const spawnX = worldX + viewW + 220;
    const cartSpeed = c.speedStart + c.speedRange * difficulty;
    const tMeet = (spawnX - px) / (playerSpeed + cartSpeed);
    const meetX = px + playerSpeed * tMeet;

    const wreckNearMeet = obstacles.list.some(
      (o) => o.type === 'wreck' && Math.abs(o.x - meetX) < c.meetWreckMargin
    );
    const railOkAtMeet = Track.hasRailAround(track, meetX, c.meetRailMargin);
    if (
      wreckNearMeet ||
      !railOkAtMeet ||
      ascendingNear(track, meetX) ||
      !Track.hasRailAt(track, spawnX)
    ) {
      obstacles.cartTimer = c.retryDelay || 0.7; // reintenta en un momento
      return;
    }

    obstacles.cartTimer =
      lerp(c.intervalStart, c.intervalEnd, difficulty) * rand(0.75, 1.3);
    obstacles.list.push({
      type: 'cart',
      x: spawnX,
      vx: -cartSpeed,
      vy: 0,
      dropY: 0,
      falling: false,
      seed: Math.random() * 10,
    });
  }

  function update(obstacles, track, dt, worldX, viewW, difficulty, px, playerSpeed) {
    spawnWrecks(obstacles, track, worldX + viewW * 1.8, difficulty);
    spawnCarts(obstacles, track, dt, worldX, viewW, difficulty, px, playerSpeed);

    obstacles.list.forEach((o) => {
      if (o.type !== 'cart') return;
      if (!o.falling) {
        o.x += o.vx * dt;
        if (!Track.hasRailAt(track, o.x)) o.falling = true;
      } else {
        o.x += o.vx * 0.4 * dt;
        o.vy += CONFIG.GRAVITY * dt;
        o.dropY += o.vy * dt;
      }
    });

    obstacles.list = obstacles.list.filter(
      (o) => o.x > worldX - 400 && o.dropY < 2000
    );
  }

  function worldYOf(o, track) {
    return Track.heightAt(track, o.x) + o.dropY;
  }

  // Colisión contra el jugador en coordenadas de mundo. Cajas algo
  // más pequeñas que el dibujo: los roces se perdonan.
  // Devuelve null, 'deadly' o 'bounce'. Tocar la mitad superior de un
  // vagón averiado rebota (¡no mata!): con rieles cortos el punto de
  // aterrizaje es difícil de controlar y sería una muerte sin salida.
  // Solo el choque frontal a ras de riel es letal.
  function collide(obstacles, track, px, playerWorldY) {
    for (const o of obstacles.list) {
      const hitX = o.type === 'cart' ? 70 : 56;
      if (Math.abs(o.x - px) >= hitX) continue;
      const dy = worldYOf(o, track) - playerWorldY; // + = obstáculo más abajo
      if (o.type === 'wreck') {
        if (Math.abs(dy) >= 46) continue;
        if (dy > 14) return 'bounce';
        return 'deadly';
      }
      if (Math.abs(dy) < 56) return 'deadly';
    }
    return null;
  }

  function draw(ctx, obstacles, track, worldX, camY, viewW, time) {
    obstacles.list.forEach((o) => {
      const sx = o.x - worldX;

      // Aviso de carro que viene: en pantallas estrechas casi no hay
      // tiempo de reacción, así que se anuncia antes de entrar.
      if (o.type === 'cart' && !o.falling && sx > viewW && sx < viewW + Modes.get().warnDistance) {
        drawWarning(ctx, viewW - 34, worldYOf(o, track) - camY - 90, time);
        return;
      }
      if (sx < -160 || sx > viewW + 260) return;

      const sy = worldYOf(o, track) - camY;
      if (o.type === 'wreck') {
        Sprites.drawWreck(ctx, sx, sy, o.seed);
      } else {
        const tilt = o.falling ? 0.5 : Math.atan(Track.slopeAt(track, o.x));
        Sprites.drawEnemy(ctx, sx, sy, time + o.seed, tilt, o.x);
      }
    });
  }

  function drawWarning(ctx, x, y, time) {
    if (Math.sin(time * 14) < -0.3) return; // parpadeo
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(220, 50, 30, 0.95)';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(20, 14);
    ctx.lineTo(-20, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, 9);
    ctx.restore();
  }

  return { create, update, collide, worldYOf, draw };
})();
