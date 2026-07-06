'use strict';

// Física del jugador en coordenadas de mundo: sobre el riel sigue el
// perfil de altura; en el aire cae por gravedad y solo aterriza si
// hay riel debajo.
const Player = (() => {
  function create() {
    return {
      worldY: 0,
      vy: 0,
      onRail: true,
      coyote: 0,
      tilt: 0,
      spin: 0,
      // Posición vertical relativa al riel en el frame anterior
      // (negativa = por encima). Sirve para detectar el aterrizaje.
      lastRel: 0,
    };
  }

  function jump(player) {
    if (!player.onRail && player.coyote <= 0) return false;
    player.vy = CONFIG.JUMP_VELOCITY;
    player.onRail = false;
    player.coyote = 0;
    return true;
  }

  // Salto variable: al soltar el dedo/tecla mientras aún sube, el
  // impulso restante se recorta. Tap corto = salto bajo; mantener
  // presionado = salto completo.
  function jumpCut(player) {
    if (player.onRail) return;
    if (player.vy < CONFIG.JUMP_CUT_VELOCITY) {
      player.vy = CONFIG.JUMP_CUT_VELOCITY;
    }
  }

  // Devuelve 'landed' cuando aterriza (para sonido/partículas).
  function update(player, dt, track, px, speed) {
    let landed = false;
    player.coyote = Math.max(0, player.coyote - dt);
    player.spin += (speed / CONFIG.CART.WHEEL_RADIUS) * dt;

    if (player.onRail) {
      if (!Track.hasRailAt(track, px)) {
        // Se acabó el riel: sale despedido siguiendo la pendiente.
        // Acotada: en los bordes con desnivel la pendiente medida
        // se dispara y catapultaría la vagoneta.
        player.onRail = false;
        player.coyote = CONFIG.COYOTE_TIME;
        player.vy = Math.max(-450, Math.min(560, Track.slopeAt(track, px) * speed));
        player.lastRel = 0;
      } else {
        player.worldY = Track.heightAt(track, px);
        const slope = Track.slopeAt(track, px);
        player.tilt += (Math.atan(slope) - player.tilt) * Math.min(1, 14 * dt);
        player.lastRel = 0;
      }
    }

    if (!player.onRail) {
      player.vy += CONFIG.GRAVITY * dt;
      player.worldY += player.vy * dt;

      // Aterrizaje RELATIVO al riel: se aterriza cuando la posición
      // pasa de estar por encima del riel a estar en/bajo él. En las
      // subidas empinadas es el riel el que sube a buscar a la
      // vagoneta (más rápido que el arco del salto), así que el cruce
      // puede ocurrir incluso mientras la vagoneta aún asciende.
      const railY = Track.heightAt(track, px);
      const rel = player.worldY - railY;
      if (Track.hasRailAt(track, px) && rel >= 0 && player.lastRel <= 4) {
        player.worldY = railY;
        player.vy = 0;
        player.onRail = true;
        landed = true;
        player.lastRel = 0;
      } else {
        player.lastRel = rel;
      }
      // Inclinación según la velocidad vertical.
      player.tilt = Math.max(-0.3, Math.min(0.45, player.vy / 1900));
    }

    return landed;
  }

  return { create, jump, jumpCut, update };
})();
