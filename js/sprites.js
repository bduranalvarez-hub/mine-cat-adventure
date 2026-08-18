'use strict';

// Dibujo de personajes y vagonetas. Los personajes (jugador con su skin
// activa y enemigo) son imágenes PNG recortadas que se estampan sobre la
// vagoneta. La vagoneta, sus ruedas y los vagones averiados siguen siendo
// vectoriales y horneados: se dibujan una vez a 2x fuera de pantalla y se
// estampan cada frame, así el detalle no cuesta rendimiento y la vagoneta
// puede inclinarse y girar las ruedas. El punto (x, y) de cada sprite es
// el centro del eje de ruedas.
const Sprites = (() => {
  const CART_W = CONFIG.CART.WIDTH;
  const CART_H = CONFIG.CART.HEIGHT;
  const WHEEL_R = CONFIG.CART.WHEEL_RADIUS;

  // Base del personaje: dónde apoya su recorte sobre el borde de la
  // vagoneta. Se dibuja ANTES que el cuerpo de la vagoneta, de modo que el
  // frente de madera y el borde tapan la parte baja y el gato "se sienta"
  // dentro. Cabeza y pecho quedan asomando por encima.
  const CHAR_BOTTOM_Y = -WHEEL_R - CART_H + 6;

  // Paletas de la vagoneta (madera y metal) por bando.
  const PLAYER = { plankLight: '#8f6d4a', plankDark: '#71553a', metal: '#565660', metalLight: '#9494a2' };
  const ENEMY = { plankLight: '#606855', plankDark: '#4b5343', metal: '#383d33', metalLight: '#697060' };

  // --- Horneado ----------------------------------------------------------
  const baked = {};
  const BAKE_SCALE = 2;

  function bake(key, w, h, ax, ay, drawFn) {
    if (baked[key]) return baked[key];
    const canvas = document.createElement('canvas');
    canvas.width = w * BAKE_SCALE;
    canvas.height = h * BAKE_SCALE;
    const b = canvas.getContext('2d');
    b.scale(BAKE_SCALE, BAKE_SCALE);
    b.translate(ax, ay);
    drawFn(b);
    baked[key] = { canvas, w, h, ax, ay };
    return baked[key];
  }

  function stamp(ctx, sprite, x, y) {
    ctx.drawImage(sprite.canvas, x - sprite.ax, y - sprite.ay, sprite.w, sprite.h);
  }

  function stampRotated(ctx, sprite, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(sprite.canvas, -sprite.ax, -sprite.ay, sprite.w, sprite.h);
    ctx.restore();
  }

  // --- Personaje (imagen) ------------------------------------------------
  // Estampa el recorte del personaje centrado en x=0, con su base apoyada
  // en el borde de la vagoneta. `entry` es una skin ({rec, renderW, dy}) o
  // Skins.ENEMY. `extraDy` anima el rebote.
  function drawCharImage(ctx, entry, extraDy) {
    const rec = entry && entry.rec;
    if (!rec || !rec.ready) return;
    const s = entry.renderW / rec.w;
    const w = rec.w * s;
    const h = rec.h * s;
    const bottom = CHAR_BOTTOM_Y + (entry.dy || 0) + (extraDy || 0);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(rec.img, -w / 2 + (entry.dx || 0), bottom - h, w, h);
    ctx.restore();
  }

  // --- Vagoneta ----------------------------------------------------------
  function cartSprite(kind, p) {
    return bake(`cart-${kind}`, 124, 84, 62, 70, (b) => {
      const bottom = -WHEEL_R + 2;
      const top = bottom - CART_H;
      const halfTop = CART_W * 0.5;
      const halfBottom = CART_W * 0.37;

      const body = new Path2D();
      body.moveTo(-halfTop, top);
      body.lineTo(halfTop, top);
      body.lineTo(halfBottom, bottom);
      body.lineTo(-halfBottom, bottom);
      body.closePath();

      // Tablones de madera verticales.
      b.save();
      b.clip(body);
      const plankW = 17;
      for (let i = 0; i < 8; i += 1) {
        const x = -halfTop + i * plankW;
        b.fillStyle = i % 2 === 0 ? p.plankLight : p.plankDark;
        b.fillRect(x, top, plankW, CART_H + 4);
        // Filo iluminado del tablón.
        b.fillStyle = 'rgba(255, 220, 180, 0.09)';
        b.fillRect(x, top, 2, CART_H + 4);
        // Vetas.
        b.strokeStyle = 'rgba(40, 22, 8, 0.35)';
        b.lineWidth = 1;
        b.beginPath();
        b.moveTo(x + 4 + (i % 3), top + 6);
        b.quadraticCurveTo(x + 7, top + CART_H * 0.5, x + 4, bottom - 4);
        b.stroke();
      }
      // Brillo diagonal (luz de los faroles).
      b.fillStyle = 'rgba(255, 240, 210, 0.08)';
      b.beginPath();
      b.moveTo(-halfTop, top);
      b.lineTo(-halfTop + 34, top);
      b.lineTo(-halfBottom + 16, bottom);
      b.lineTo(-halfBottom, bottom);
      b.closePath();
      b.fill();
      // Sombreado global: luz a la izquierda, sombra a la derecha,
      // y sombra interior bajo el borde.
      const shade = b.createLinearGradient(-halfTop, 0, halfTop, 0);
      shade.addColorStop(0, 'rgba(255, 230, 190, 0.14)');
      shade.addColorStop(0.45, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
      b.fillStyle = shade;
      b.fillRect(-halfTop, top, halfTop * 2, CART_H + 4);
      b.fillStyle = 'rgba(0,0,0,0.32)';
      b.fillRect(-halfTop, top, halfTop * 2, 7);
      b.restore();

      // Flejes metálicos diagonales.
      b.strokeStyle = p.metal;
      b.lineWidth = 6;
      [-1, 1].forEach((side) => {
        b.beginPath();
        b.moveTo(side * (halfTop - 8), top + 4);
        b.lineTo(side * (halfBottom - 6), bottom - 3);
        b.stroke();
      });

      // Contorno.
      b.strokeStyle = 'rgba(30, 18, 8, 0.85)';
      b.lineWidth = 3;
      b.stroke(body);

      // Banda inferior y borde superior metálicos.
      const rim = b.createLinearGradient(0, top - 7, 0, top + 4);
      rim.addColorStop(0, p.metalLight);
      rim.addColorStop(1, p.metal);
      b.fillStyle = rim;
      b.fillRect(-halfTop - 4, top - 6, halfTop * 2 + 8, 10);
      b.strokeStyle = 'rgba(20, 20, 26, 0.8)';
      b.lineWidth = 1.5;
      b.strokeRect(-halfTop - 4, top - 6, halfTop * 2 + 8, 10);

      const band = b.createLinearGradient(0, bottom - 7, 0, bottom + 2);
      band.addColorStop(0, p.metalLight);
      band.addColorStop(1, p.metal);
      b.fillStyle = band;
      b.fillRect(-halfBottom - 3, bottom - 6, halfBottom * 2 + 6, 8);

      // Remaches con brillo.
      for (let i = -2; i <= 2; i += 1) {
        const rx = i * halfTop * 0.42;
        b.fillStyle = p.metalLight;
        b.beginPath();
        b.arc(rx, top - 1, 2.2, 0, Math.PI * 2);
        b.fill();
        b.fillStyle = 'rgba(255,255,255,0.6)';
        b.beginPath();
        b.arc(rx - 0.7, top - 1.7, 0.8, 0, Math.PI * 2);
        b.fill();
      }
    });
  }

  function wheelSprite() {
    return bake('wheel', 34, 34, 17, 17, (b) => {
      // Llanta.
      b.fillStyle = '#26262e';
      b.beginPath();
      b.arc(0, 0, WHEEL_R, 0, Math.PI * 2);
      b.fill();
      // Disco metálico.
      const disc = b.createRadialGradient(-3, -4, 1, 0, 0, WHEEL_R);
      disc.addColorStop(0, '#8d8d9c');
      disc.addColorStop(1, '#4a4a56');
      b.fillStyle = disc;
      b.beginPath();
      b.arc(0, 0, WHEEL_R - 2.4, 0, Math.PI * 2);
      b.fill();
      // Ranuras (radios).
      b.fillStyle = 'rgba(20, 20, 28, 0.75)';
      for (let i = 0; i < 4; i += 1) {
        b.save();
        b.rotate((i * Math.PI) / 2 + Math.PI / 4);
        b.beginPath();
        b.ellipse(0, -6.4, 2, 3.6, 0, 0, Math.PI * 2);
        b.fill();
        b.restore();
      }
      // Buje.
      b.fillStyle = '#9c9cab';
      b.beginPath();
      b.arc(0, 0, 3.4, 0, Math.PI * 2);
      b.fill();
      b.fillStyle = 'rgba(255,255,255,0.7)';
      b.beginPath();
      b.arc(-1, -1.2, 1.1, 0, Math.PI * 2);
      b.fill();
    });
  }

  function drawWheels(ctx, spin) {
    const w = wheelSprite();
    stampRotated(ctx, w, -CART_W * 0.27, -WHEEL_R + 2, spin);
    stampRotated(ctx, w, CART_W * 0.27, -WHEEL_R + 2, spin * 1.13);
  }

  // Sombra suave de la vagoneta sobre el riel.
  function drawCartShadow(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 52, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Sprites públicos ----------------------------------------------------
  // Los personajes con manos/garras agarradas al borde (front: true en su
  // entrada de Skins) se dibujan DELANTE de la vagoneta, así las manos se
  // ven sobre el borde metálico. Los demás van detrás y el frente del
  // carro les tapa el cuerpo.
  function drawPlayer(ctx, x, y, tilt, spin, time, speedFactor) {
    const bob = Math.sin(time * 10) * 2;
    const skin = Skins.getActive();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    drawCartShadow(ctx);
    if (!skin.front) drawCharImage(ctx, skin, bob);
    stamp(ctx, cartSprite('player', PLAYER), 0, 0);
    drawWheels(ctx, spin);
    if (skin.front) drawCharImage(ctx, skin, bob);
    ctx.restore();
  }

  function drawEnemy(ctx, x, y, time, tilt, worldXPos) {
    const bob = Math.sin(time * 9) * 1.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    drawCartShadow(ctx);
    if (!Skins.ENEMY.front) drawCharImage(ctx, Skins.ENEMY, bob);
    stamp(ctx, cartSprite('enemy', ENEMY), 0, 0);
    // Ruedas girando hacia atrás: viene en sentido contrario.
    drawWheels(ctx, -(worldXPos || 0) / WHEEL_R);
    if (Skins.ENEMY.front) drawCharImage(ctx, Skins.ENEMY, bob);
    ctx.restore();
  }

  // --- Vagones averiados -----------------------------------------------
  // Una vagoneta rota y volcada sobre la vía, como los carros
  // abandonados del nivel original. (x, y) es la base sobre el riel.
  function wreckSprite(variant) {
    const lean = variant === 0 ? 0.22 : variant === 1 ? -0.18 : 0.08;
    return bake(`wreck-${variant}`, 130, 90, 65, 78, (b) => {
      // Óxido rojizo, NO gris-marrón. El vagón averiado es el obstáculo
      // que hay que ver con tiempo, y desde el nivel PLATA la pared de
      // la mina es gris/blanca/azul: la paleta vieja (#5f584c/#4a443a)
      // coincidía con ella en tono Y en valor, así que se perdía de
      // vista. El naranja-rojo es el único tono que contrasta contra los
      // tres minerales problemáticos a la vez, sin salirse del arte.
      const wood = { light: '#a8532a', dark: '#7d3a1c' };

      // Sombra en la base.
      b.fillStyle = 'rgba(0, 0, 0, 0.3)';
      b.beginPath();
      b.ellipse(0, 0, 54, 7, 0, 0, Math.PI * 2);
      b.fill();

      // Rueda suelta tirada junto al vagón.
      b.save();
      b.translate(variant === 1 ? 42 : -46, -8);
      b.rotate(0.9 + variant);
      b.fillStyle = '#26262e';
      b.beginPath();
      b.arc(0, 0, WHEEL_R * 0.9, 0, Math.PI * 2);
      b.fill();
      b.fillStyle = '#55555f';
      b.beginPath();
      b.arc(0, 0, WHEEL_R * 0.5, 0, Math.PI * 2);
      b.fill();
      b.restore();

      // Cuerpo volcado e inclinado.
      b.save();
      b.rotate(lean);
      b.translate(0, -26);
      const halfTop = CART_W * 0.42;
      const halfBottom = CART_W * 0.31;
      const h = CART_H * 0.82;

      const body = new Path2D();
      body.moveTo(-halfTop, -h / 2);
      body.lineTo(halfTop, -h / 2);
      body.lineTo(halfBottom, h / 2);
      body.lineTo(-halfBottom, h / 2);
      body.closePath();

      b.save();
      b.clip(body);
      for (let i = 0; i < 7; i += 1) {
        const x = -halfTop + i * 15;
        b.fillStyle = i % 2 === 0 ? wood.light : wood.dark;
        b.fillRect(x, -h / 2, 15, h);
      }
      // Sombreado y suciedad.
      b.fillStyle = 'rgba(0,0,0,0.3)';
      b.fillRect(-halfTop, -h / 2, halfTop * 2, 7);
      b.fillStyle = 'rgba(30, 20, 8, 0.25)';
      b.fillRect(-halfTop, h / 2 - 10, halfTop * 2, 10);
      b.restore();

      // Tablón roto que sobresale.
      b.fillStyle = wood.dark;
      b.save();
      b.translate(halfTop - 12, -h / 2);
      b.rotate(-0.55);
      b.fillRect(-4, -22, 9, 26);
      b.restore();

      b.strokeStyle = '#1a0a03';
      b.lineWidth = 4.5;
      b.stroke(body);

      // Fleje metálico oxidado y remaches caídos.
      b.strokeStyle = '#d4762f';
      b.lineWidth = 5;
      b.beginPath();
      b.moveTo(-halfTop + 6, -h / 2 + 4);
      b.lineTo(-halfBottom + 4, h / 2 - 3);
      b.stroke();

      // Una sola rueda que le queda, torcida.
      b.save();
      b.translate(variant === 1 ? -26 : 24, h / 2 + 4);
      b.rotate(0.35);
      b.fillStyle = '#26262e';
      b.beginPath();
      b.arc(0, 0, WHEEL_R * 0.85, 0, Math.PI * 2);
      b.fill();
      b.fillStyle = '#4a4a56';
      b.beginPath();
      b.arc(0, 0, WHEEL_R * 0.45, 0, Math.PI * 2);
      b.fill();
      b.restore();
      b.restore();

      // Piedritas y astillas alrededor de la base.
      b.fillStyle = '#7d3a1c';
      [[-34, -4], [30, -3], [8, -2], [-12, -3]].forEach(([px, py]) => {
        b.beginPath();
        b.arc(px, py, 3.2, 0, Math.PI * 2);
        b.fill();
      });
    });
  }

  function drawWreck(ctx, x, y, seed) {
    stamp(ctx, wreckSprite(Math.floor((seed * 10) % 3)), x, y);
  }

  return { drawPlayer, drawEnemy, drawWreck };
})();
