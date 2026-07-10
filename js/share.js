'use strict';

// Compartir puntuación al estilo Flappy Bird: genera una tarjeta-imagen
// con la marca del jugador y la comparte por el menú nativo del móvil
// (WhatsApp, Instagram, etc.). En escritorio descarga la imagen y copia
// el texto al portapapeles. Todo el dibujo es canvas, sin dependencias.
const Share = (() => {
  const W = 720;
  const H = 820;

  // Medallas por distancia (universal a todos los modos).
  const MEDALS = [
    { min: CONFIG.MEDAL_METERS.PLATINUM, name: 'PLATINO', a: '#e6f7ff', b: '#7ec8e3', ring: '#4a90a4' },
    { min: CONFIG.MEDAL_METERS.GOLD, name: 'ORO', a: '#ffe57a', b: '#f0a800', ring: '#a86f00' },
    { min: CONFIG.MEDAL_METERS.SILVER, name: 'PLATA', a: '#f0f0f5', b: '#a8a8b8', ring: '#6e6e7c' },
    { min: CONFIG.MEDAL_METERS.BRONZE, name: 'BRONCE', a: '#f0b878', b: '#b06a28', ring: '#7a4818' },
  ];

  function medalFor(meters) {
    return MEDALS.find((m) => meters >= m.min) || null;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawMedal(ctx, x, y, meters) {
    const medal = medalFor(meters);
    ctx.save();
    ctx.translate(x, y);
    if (!medal) {
      // Hueco vacío (aún sin medalla).
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a7256';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(I18n.t('cardNoMedal1'), 0, -2);
      ctx.fillText(I18n.t('cardNoMedal2'), 0, 16);
      ctx.restore();
      return;
    }
    // Aro exterior.
    ctx.fillStyle = medal.ring;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fill();
    // Disco con degradado.
    const g = ctx.createLinearGradient(-30, -30, 30, 30);
    g.addColorStop(0, medal.a);
    g.addColorStop(1, medal.b);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    // Estrella grabada.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? 22 : 9;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Brillo.
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(-14, -14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function buildCard(data) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');

    // Fondo de mina.
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a1710');
    bg.addColorStop(0.5, '#3a2212');
    bg.addColorStop(1, '#1c0f07');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Marco dorado.
    ctx.strokeStyle = '#7a4a12';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    // --- Título ---
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = '900 62px system-ui, "Segoe UI", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillText('MINE CAT', W / 2, 96);
    ctx.fillText('ADVENTURE', W / 2, 158);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // --- Nombre del jugador (pastilla) ---
    const name = (data.player || 'Minero').slice(0, 14);
    roundRect(ctx, W / 2 - 200, 186, 400, 52, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.strokeStyle = '#7a4a12';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffe9c4';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillText(name, W / 2, 222);

    // --- Panel principal ---
    const px = 60;
    const py = 268;
    const pw = W - 120;
    const ph = 340;
    roundRect(ctx, px, py, pw, ph, 22);
    ctx.fillStyle = '#e8cfa8';
    ctx.fill();
    ctx.strokeStyle = '#8a5a24';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Puntuación y récord.
    ctx.fillStyle = '#6b4a26';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(I18n.t('cardDistance'), px + pw * 0.3, py + 60);
    ctx.fillText(I18n.t('cardRecord'), px + pw * 0.7, py + 60);

    ctx.fillStyle = '#3a2412';
    ctx.font = '900 76px system-ui, sans-serif';
    ctx.fillText(`${data.meters}`, px + pw * 0.3, py + 140);
    ctx.fillText(`${data.best}`, px + pw * 0.7, py + 140);
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillStyle = '#6b4a26';
    ctx.fillText(I18n.t('cardMeters'), px + pw * 0.3, py + 172);
    ctx.fillText(I18n.t('cardMeters'), px + pw * 0.7, py + 172);

    // Insignia de modo.
    const modeColors = {
      normal: ['#8f6d4a', '#ffe9c4'],
      hard: ['#a83224', '#ffd9c9'],
      hardcore: ['#5c1a73', '#f2c9ff'],
    };
    const mc = modeColors[data.modeKey] || modeColors.normal;
    roundRect(ctx, px + 40, py + 218, 180, 60, 14);
    ctx.fillStyle = mc[0];
    ctx.fill();
    ctx.fillStyle = mc[1];
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillText(data.modeLabel, px + 130, py + 256);

    // Medalla.
    ctx.fillStyle = '#6b4a26';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(I18n.t('cardMedal'), px + pw - 130, py + 218);
    drawMedal(ctx, px + pw - 130, py + 262, data.meters);

    // --- Banner de récord ---
    if (data.isRecord) {
      ctx.save();
      ctx.translate(W / 2, py + ph + 46);
      ctx.fillStyle = '#7dff8e';
      ctx.font = '900 40px system-ui, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillText(I18n.t('cardNewRecord'), 0, 0);
      ctx.restore();
    }

    // --- Gato en el título ---
    if (typeof Sprites !== 'undefined') {
      ctx.save();
      ctx.translate(W - 96, 118);
      ctx.scale(0.72, 0.72);
      Sprites.drawPlayer(ctx, 0, 0, 0.1, 0.6, 0.3, 0.4);
      ctx.restore();
    }

    // --- Marca inferior ---
    ctx.fillStyle = '#1c0f07';
    ctx.fillRect(12, H - 78, W - 24, 66);
    ctx.fillStyle = '#ffd76a';
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.fillText('MINE CAT ADVENTURE', W / 2, H - 34);

    return c;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => {
      if (canvas.toBlob) canvas.toBlob(resolve, 'image/png');
      else resolve(null);
    });
  }

  function downloadCanvas(canvas, filename) {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Enlace al juego (origen + ruta, sin query ni hash) para que quien
  // reciba la puntuación pueda entrar a jugar directamente.
  function gameUrl() {
    try {
      return location.origin + location.pathname;
    } catch (err) {
      return '';
    }
  }

  function shareText(data) {
    const url = gameUrl();
    const msg = I18n.t('shareText', { m: data.meters, mode: data.modeLabel });
    return `${msg}${url ? `\n${url}` : ''}`;
  }

  // Devuelve un estado para avisar al usuario: 'shared' | 'downloaded' | 'cancelled'.
  async function share(data) {
    const canvas = buildCard(data);
    const text = shareText(data);
    const blob = await canvasToBlob(canvas);
    const file = blob
      ? new File([blob], 'mine-cat-adventure.png', { type: 'image/png' })
      : null;

    // 1) Web Share API con imagen (móvil moderno).
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Mine Cat Adventure', text });
        return 'shared';
      } catch (err) {
        return 'cancelled'; // el usuario cerró el diálogo
      }
    }

    // 2) Web Share API solo texto.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mine Cat Adventure', text });
        return 'shared';
      } catch (err) {
        return 'cancelled';
      }
    }

    // 3) Escritorio: descarga la imagen y copia el texto.
    downloadCanvas(canvas, 'mine-cat-adventure.png');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    return 'downloaded';
  }

  return { share, buildCard };
})();
