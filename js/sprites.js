'use strict';

// Dibujo de gatos sphynx y vagonetas con calidad "ilustración":
// degradados, sombreado y textura. Las partes estáticas se hornean
// una sola vez en canvases fuera de pantalla (a 2x) y luego se
// estampan cada frame, así el detalle no cuesta rendimiento.
// El punto (x, y) de cada sprite es el centro del eje de ruedas.
const Sprites = (() => {
  const CART_W = CONFIG.CART.WIDTH;
  const CART_H = CONFIG.CART.HEIGHT;
  const WHEEL_R = CONFIG.CART.WHEEL_RADIUS;
  const HEAD_Y = -WHEEL_R - CART_H - 36;

  const PLAYER = {
    skinLight: '#f8d8c6', skin: '#eeb49e', skinShadow: '#cd8770',
    line: 'rgba(150, 85, 60, 0.75)',
    earInner: '#e8886c', earInnerDeep: '#c96a50',
    iris: '#a4c05c', irisDark: '#647f31', eyeball: '#f2f5e8',
    plankLight: '#8f6d4a', plankDark: '#71553a',
    metal: '#565660', metalLight: '#9494a2',
    scarf: '#d94330', scarfDark: '#9e2416',
  };

  const ENEMY = {
    skinLight: '#f4dcca', skin: '#e2bca8', skinShadow: '#b98d75',
    line: 'rgba(130, 90, 65, 0.75)',
    earInner: '#df9376', earInnerDeep: '#bd6f52',
    iris: '#9cd8f0', irisDark: '#3f96bd', eyeball: '#eef4f6',
    plankLight: '#606855', plankDark: '#4b5343',
    metal: '#383d33', metalLight: '#697060',
  };

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

  // --- Cabeza de sphynx --------------------------------------------------
  function drawEar(b, p, side) {
    const grad = b.createLinearGradient(side * 8, -14, side * 38, -56);
    grad.addColorStop(0, p.skin);
    grad.addColorStop(1, p.skinLight);

    b.fillStyle = grad;
    b.strokeStyle = p.line;
    b.lineWidth = 2;
    b.beginPath();
    b.moveTo(side * 4, -15);
    b.quadraticCurveTo(side * 24, -30, side * 37, -55);
    b.quadraticCurveTo(side * 33, -26, side * 21, -2);
    b.closePath();
    b.fill();
    b.stroke();

    // Interior de la oreja con su propio degradado.
    const inner = b.createLinearGradient(side * 12, -12, side * 33, -48);
    inner.addColorStop(0, p.earInnerDeep);
    inner.addColorStop(1, p.earInner);
    b.fillStyle = inner;
    b.beginPath();
    b.moveTo(side * 11, -14);
    b.quadraticCurveTo(side * 25, -28, side * 33, -47);
    b.quadraticCurveTo(side * 29, -24, side * 20, -6);
    b.closePath();
    b.fill();

    // Pliegue en la base.
    b.strokeStyle = p.line;
    b.lineWidth = 1.4;
    b.beginPath();
    b.moveTo(side * 8, -12);
    b.quadraticCurveTo(side * 14, -16, side * 18, -13);
    b.stroke();
  }

  function drawEye(b, p, side, angry) {
    const ex = side * 11.5;
    const ey = -2;

    b.save();
    b.translate(ex, ey);
    b.rotate(side * 0.2);

    // Sombra de la cuenca.
    b.fillStyle = 'rgba(90, 40, 25, 0.14)';
    b.beginPath();
    b.ellipse(0, 1.5, 8.6, 7, 0, 0, Math.PI * 2);
    b.fill();

    // Globo ocular.
    b.fillStyle = p.eyeball;
    b.beginPath();
    b.ellipse(0, 0, 7.6, angry ? 5.2 : 6.4, 0, 0, Math.PI * 2);
    b.fill();

    // Iris con degradado y pupila vertical.
    const iris = b.createRadialGradient(side * 1, -1.4, 0.6, side * 1.2, 0, 4.8);
    iris.addColorStop(0, p.iris);
    iris.addColorStop(1, p.irisDark);
    b.fillStyle = iris;
    b.beginPath();
    b.arc(side * 1.2, 0.3, 4.7, 0, Math.PI * 2);
    b.fill();
    b.fillStyle = '#1b140e';
    b.beginPath();
    b.ellipse(side * 1.2, 0.3, 1.7, 3.5, 0, 0, Math.PI * 2);
    b.fill();

    // Brillos.
    b.fillStyle = 'rgba(255,255,255,0.95)';
    b.beginPath();
    b.arc(side * 1.2 - 1.6, -1.4, 1.35, 0, Math.PI * 2);
    b.fill();
    b.fillStyle = 'rgba(255,255,255,0.45)';
    b.beginPath();
    b.arc(side * 1.2 + 1.6, 1.6, 0.8, 0, Math.PI * 2);
    b.fill();

    // Párpado superior.
    b.strokeStyle = p.line;
    b.lineWidth = 1.8;
    b.beginPath();
    b.ellipse(0, 0, 7.6, angry ? 5.2 : 6.4, 0, Math.PI * 1.15, Math.PI * 1.85);
    b.stroke();
    b.restore();

    if (angry) {
      // Párpado en diagonal: bajo junto a la nariz, alto hacia afuera.
      // Es lo que convierte la mirada en un ceño de verdad.
      b.fillStyle = p.skin;
      b.beginPath();
      b.moveTo(ex - side * 9.5, ey - 0.5); // interior, bajo
      b.lineTo(ex + side * 9.5, ey - 8.5); // exterior, alto
      b.lineTo(ex + side * 9.5, ey - 13);
      b.lineTo(ex - side * 9.5, ey - 13);
      b.closePath();
      b.fill();
      // Ceja marcada sobre el borde del párpado.
      b.strokeStyle = 'rgba(95, 55, 38, 0.95)';
      b.lineWidth = 2.8;
      b.lineCap = 'round';
      b.beginPath();
      b.moveTo(ex - side * 8.5, ey - 1);
      b.lineTo(ex + side * 8, ey - 8);
      b.stroke();
      b.lineCap = 'butt';
    }
  }

  function drawClosedEye(b, p, side) {
    const ex = side * 11.5;
    b.strokeStyle = p.line;
    b.lineWidth = 2.4;
    b.beginPath();
    b.moveTo(ex - 6, -2);
    b.quadraticCurveTo(ex, 2, ex + 6, -2);
    b.stroke();
  }

  function drawMuzzle(b, p, angry) {
    // Hocico más claro.
    const grad = b.createRadialGradient(0, 8, 2, 0, 10, 15);
    grad.addColorStop(0, p.skinLight);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    b.fillStyle = grad;
    b.beginPath();
    b.ellipse(0, 10, 14, 10, 0, 0, Math.PI * 2);
    b.fill();

    // Puntos de bigotes.
    b.fillStyle = p.line;
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 3; i += 1) {
        b.beginPath();
        b.arc(side * (5 + i * 3.4), 9 + (i % 2) * 2.6, 0.7, 0, Math.PI * 2);
        b.fill();
      }
    });

    // Nariz con degradado.
    const nose = b.createLinearGradient(0, 4, 0, 10);
    nose.addColorStop(0, '#e08d7c');
    nose.addColorStop(1, '#bf6353');
    b.fillStyle = nose;
    b.strokeStyle = 'rgba(120, 55, 40, 0.8)';
    b.lineWidth = 1.2;
    b.beginPath();
    b.moveTo(-4.2, 4.5);
    b.lineTo(4.2, 4.5);
    b.quadraticCurveTo(4.6, 5.2, 3, 7.6);
    b.quadraticCurveTo(0, 10, -3, 7.6);
    b.quadraticCurveTo(-4.6, 5.2, -4.2, 4.5);
    b.closePath();
    b.fill();
    b.stroke();

    // Boca.
    b.strokeStyle = p.line;
    b.lineWidth = 1.7;
    b.beginPath();
    b.moveTo(0, 9.6);
    b.lineTo(0, 12.6);
    if (angry) {
      b.moveTo(0, 12.6);
      b.quadraticCurveTo(-5.5, 11, -9, 14.6);
      b.moveTo(0, 12.6);
      b.quadraticCurveTo(5.5, 11, 9, 14.6);
    } else {
      b.moveTo(0, 12.6);
      b.quadraticCurveTo(-5, 16.4, -9, 13.2);
      b.moveTo(0, 12.6);
      b.quadraticCurveTo(5, 16.4, 9, 13.2);
    }
    b.stroke();

    if (angry) {
      // Colmillos.
      b.fillStyle = '#f6f2e8';
      [-1, 1].forEach((side) => {
        b.beginPath();
        b.moveTo(side * 6.4, 12.2);
        b.lineTo(side * 8.4, 12.6);
        b.lineTo(side * 7.4, 16.6);
        b.closePath();
        b.fill();
      });
    }
  }

  function drawHead(b, p, angry, blink) {
    drawEar(b, p, -1);
    drawEar(b, p, 1);

    // Cara: cráneo redondeado, pómulos y mentón.
    const skin = b.createRadialGradient(-8, -12, 6, 0, 0, 34);
    skin.addColorStop(0, p.skinLight);
    skin.addColorStop(0.62, p.skin);
    skin.addColorStop(1, p.skinShadow);
    b.fillStyle = skin;
    b.strokeStyle = p.line;
    b.lineWidth = 2;
    b.beginPath();
    b.moveTo(0, -26);
    b.bezierCurveTo(15, -26, 26, -16, 26, -3);
    b.bezierCurveTo(26, 8, 20, 16, 11, 20);
    b.quadraticCurveTo(0, 23.5, -11, 20);
    b.bezierCurveTo(-20, 16, -26, 8, -26, -3);
    b.bezierCurveTo(-26, -16, -15, -26, 0, -26);
    b.closePath();
    b.fill();
    b.stroke();

    // Arrugas de la frente (marca de la casa sphynx).
    b.strokeStyle = p.line;
    b.lineWidth = 1.4;
    for (let i = 0; i < 3; i += 1) {
      b.beginPath();
      b.moveTo(-13 + i * 2, -20 + i * 4);
      b.quadraticCurveTo(0, -24 + i * 4.4, 13 - i * 2, -20 + i * 4);
      b.stroke();
      b.strokeStyle = 'rgba(255, 235, 220, 0.35)';
      b.lineWidth = 1;
      b.beginPath();
      b.moveTo(-12 + i * 2, -18.8 + i * 4);
      b.quadraticCurveTo(0, -22.8 + i * 4.4, 12 - i * 2, -18.8 + i * 4);
      b.stroke();
      b.strokeStyle = p.line;
      b.lineWidth = 1.4;
    }

    // Arrugas de mejillas.
    [-1, 1].forEach((side) => {
      b.beginPath();
      b.moveTo(side * 22, 4);
      b.quadraticCurveTo(side * 17, 8, side * 18, 13);
      b.stroke();
    });

    if (angry) {
      // Arrugas de enfado en V sobre el puente de la nariz.
      b.strokeStyle = p.line;
      b.lineWidth = 1.7;
      [-1, 1].forEach((side) => {
        b.beginPath();
        b.moveTo(side * 2.4, -8.5);
        b.lineTo(side * 5.2, -14.5);
        b.stroke();
      });
    }

    if (blink) {
      drawClosedEye(b, p, -1);
      drawClosedEye(b, p, 1);
    } else {
      drawEye(b, p, -1, angry);
      drawEye(b, p, 1, angry);
    }
    drawMuzzle(b, p, angry);
  }

  function headSprite(kind, p, angry, blink) {
    return bake(`head-${kind}-${blink ? 'b' : 'o'}`, 96, 92, 48, 60, (b) => {
      drawHead(b, p, angry, blink);
    });
  }

  // --- Cuerpo y patas ----------------------------------------------------
  function bodySprite(kind, p) {
    return bake(`body-${kind}`, 76, 60, 38, 30, (b) => {
      const skin = b.createLinearGradient(0, -28, 0, 30);
      skin.addColorStop(0, p.skinLight);
      skin.addColorStop(1, p.skinShadow);
      b.fillStyle = skin;
      b.strokeStyle = p.line;
      b.lineWidth = 2;
      // Hombros y pecho asomando por la vagoneta.
      b.beginPath();
      b.moveTo(-24, 30);
      b.quadraticCurveTo(-26, -6, -14, -20);
      b.quadraticCurveTo(0, -30, 14, -20);
      b.quadraticCurveTo(26, -6, 24, 30);
      b.closePath();
      b.fill();
      b.stroke();
      // Pliegues de piel del cuello.
      b.lineWidth = 1.5;
      for (let i = 0; i < 3; i += 1) {
        b.beginPath();
        b.moveTo(-15 + i, -12 + i * 7);
        b.quadraticCurveTo(0, -7 + i * 7, 15 - i, -12 + i * 7);
        b.stroke();
      }
    });
  }

  function pawSprite(kind, p) {
    return bake(`paw-${kind}`, 20, 18, 10, 9, (b) => {
      const skin = b.createLinearGradient(0, -8, 0, 8);
      skin.addColorStop(0, p.skinLight);
      skin.addColorStop(1, p.skin);
      b.fillStyle = skin;
      b.strokeStyle = p.line;
      b.lineWidth = 1.6;
      b.beginPath();
      b.ellipse(0, 0, 7.4, 8, 0, 0, Math.PI * 2);
      b.fill();
      b.stroke();
      // Deditos.
      b.lineWidth = 1.2;
      [-2.6, 2.6].forEach((dx) => {
        b.beginPath();
        b.moveTo(dx, 3);
        b.lineTo(dx, 7.4);
        b.stroke();
      });
    });
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

  // --- Bufanda del jugador (animada, se dibuja en vivo) -------------------
  // Las colas van DETRÁS del cuerpo (salen por detrás del hombro) y la
  // banda rodea el cuello por delante, justo bajo la barbilla.
  const SCARF_Y = HEAD_Y + 27;

  // Las colas nacen EN el nudo (-9, SCARF_Y + 1) y ondean sobre el
  // hombro, siempre a la altura del cuello: así nunca se separan de
  // la banda aunque la vagoneta se incline o el gato salte.
  function drawScarfTails(ctx, time, speedFactor) {
    const y = SCARF_Y + 1;
    const kx = -9; // posición del nudo
    const w1 = Math.sin(time * 13) * (2.5 + 5 * speedFactor);
    const w2 = Math.sin(time * 13 + 1.3) * (2 + 4 * speedFactor);

    const grad = ctx.createLinearGradient(kx, y, kx - 48, y);
    grad.addColorStop(0, PLAYER.scarfDark);
    grad.addColorStop(1, PLAYER.scarf);
    ctx.fillStyle = grad;

    // Cola superior, larga.
    ctx.beginPath();
    ctx.moveTo(kx, y - 4);
    ctx.quadraticCurveTo(kx - 20, y - 8 + w1, kx - 44, y - 6 + w1 * 1.5);
    ctx.lineTo(kx - 40, y + 2 + w1);
    ctx.quadraticCurveTo(kx - 18, y + 2, kx, y + 2);
    ctx.closePath();
    ctx.fill();

    // Cola inferior, más corta y desfasada.
    ctx.beginPath();
    ctx.moveTo(kx, y);
    ctx.quadraticCurveTo(kx - 16, y + 4 + w2, kx - 34, y + 6 + w2 * 1.4);
    ctx.lineTo(kx - 31, y + 12 + w2);
    ctx.quadraticCurveTo(kx - 14, y + 8, kx, y + 6);
    ctx.closePath();
    ctx.fill();
  }

  function drawScarfBand(ctx) {
    const y = SCARF_Y;
    ctx.save();
    ctx.translate(5, 0); // alineada con la cabeza

    // Banda que abraza el cuello, curvada sobre los hombros.
    const band = ctx.createLinearGradient(0, y - 5, 0, y + 9);
    band.addColorStop(0, PLAYER.scarf);
    band.addColorStop(1, PLAYER.scarfDark);
    ctx.fillStyle = band;
    ctx.beginPath();
    ctx.moveTo(-16, y - 5);
    ctx.quadraticCurveTo(0, y + 1, 16, y - 5);
    ctx.lineTo(15, y + 4);
    ctx.quadraticCurveTo(0, y + 10, -15, y + 4);
    ctx.closePath();
    ctx.fill();

    // Pliegues de la tela.
    ctx.strokeStyle = 'rgba(110, 20, 8, 0.55)';
    ctx.lineWidth = 1.3;
    [-7, 0, 7].forEach((dx) => {
      ctx.beginPath();
      ctx.moveTo(dx, y - 1.5);
      ctx.lineTo(dx - 2, y + 5.5);
      ctx.stroke();
    });

    // Nudo lateral del que salen las colas.
    ctx.fillStyle = PLAYER.scarfDark;
    ctx.beginPath();
    ctx.ellipse(-14, y + 1, 4.6, 5.6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 150, 130, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-15, y - 1, 1.8, 2.4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Sombra suave de la vagoneta sobre el riel.
  function drawCartShadow(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 52, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Sprites públicos ----------------------------------------------------
  function drawPlayer(ctx, x, y, tilt, spin, time, speedFactor) {
    const blink = Math.sin(time * 1.7) > 0.985;
    const bob = Math.sin(time * 10) * 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    drawCartShadow(ctx);

    stamp(ctx, bodySprite('player', PLAYER), 4, HEAD_Y + 34);
    drawScarfBand(ctx);
    drawScarfTails(ctx, time, speedFactor);
    ctx.save();
    ctx.translate(5, HEAD_Y + bob);
    ctx.rotate(0.06);
    stamp(ctx, headSprite('player', PLAYER, false, blink), 0, 0);
    ctx.restore();

    stamp(ctx, cartSprite('player', PLAYER), 0, 0);
    drawWheels(ctx, spin);

    // Patitas agarradas al borde.
    const paw = pawSprite('player', PLAYER);
    stamp(ctx, paw, -17, -WHEEL_R - CART_H - 2);
    stamp(ctx, paw, 21, -WHEEL_R - CART_H - 2);
    ctx.restore();
  }

  function drawEnemy(ctx, x, y, time, tilt, worldXPos) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    drawCartShadow(ctx);

    stamp(ctx, bodySprite('enemy', ENEMY), -3, HEAD_Y + 34);
    ctx.save();
    ctx.translate(-4, HEAD_Y + Math.sin(time * 9) * 1.5);
    ctx.rotate(-0.05);
    stamp(ctx, headSprite('enemy', ENEMY, true, false), 0, 0);
    ctx.restore();

    stamp(ctx, cartSprite('enemy', ENEMY), 0, 0);
    // Ruedas girando hacia atrás: viene en sentido contrario.
    drawWheels(ctx, -(worldXPos || 0) / WHEEL_R);

    const paw = pawSprite('enemy', ENEMY);
    stamp(ctx, paw, -20, -WHEEL_R - CART_H - 2);
    stamp(ctx, paw, 14, -WHEEL_R - CART_H - 2);
    ctx.restore();
  }

  // --- Vagones averiados -----------------------------------------------
  // Una vagoneta rota y volcada sobre la vía, como los carros
  // abandonados del nivel original. (x, y) es la base sobre el riel.
  function wreckSprite(variant) {
    const lean = variant === 0 ? 0.22 : variant === 1 ? -0.18 : 0.08;
    return bake(`wreck-${variant}`, 130, 90, 65, 78, (b) => {
      const wood = { light: '#5f584c', dark: '#4a443a' };

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

      b.strokeStyle = 'rgba(25, 15, 8, 0.85)';
      b.lineWidth = 3;
      b.stroke(body);

      // Fleje metálico oxidado y remaches caídos.
      b.strokeStyle = '#5a4636';
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
      b.fillStyle = '#4e453d';
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
