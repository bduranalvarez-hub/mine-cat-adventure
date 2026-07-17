'use strict';

// Bucle principal, estados (menú / jugando / muerto), puntuación y HUD.
const Game = (() => {
  const MODES = { MENU: 'menu', PLAYING: 'playing', DEAD: 'dead' };

  let canvas = null;
  let ctx = null;
  let scale = 1;
  let viewW = 0;
  // El zoom del modo aleja la cámara: a más velocidad, más pista visible.
  let viewH = CONFIG.VIRTUAL_HEIGHT;
  let playerX = 0;

  let state = null;
  let sparks = [];
  let lastShownMeters = -1;

  const dom = {};

  function loadBest(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      const value = raw === null ? 0 : parseInt(raw, 10);
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest(storageKey, meters) {
    try {
      localStorage.setItem(storageKey, String(meters));
    } catch (err) {
      /* almacenamiento no disponible: el récord vive solo en la sesión */
    }
  }

  function createState(mode) {
    return {
      mode,
      worldX: 0,
      camY: -viewH * CONFIG.CAMERA.PLAYER_RATIO,
      speed: Modes.get().baseSpeed,
      time: 0,
      deathTimer: 0,
      cause: null,
      isRecord: false,
      best: loadBest(Modes.get().storageKey),
      player: Player.create(),
      track: Track.create(),
      obstacles: Obstacles.create(),
    };
  }

  function meters() {
    return Math.floor(state.worldX / CONFIG.UNITS_PER_METER);
  }

  function difficulty() {
    const m = Modes.get();
    return (state.speed - m.baseSpeed) / (m.maxSpeed - m.baseSpeed);
  }

  function playerScreenY() {
    return state.player.worldY - state.camY;
  }

  let rankTab = 'normal';

  function setup(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    [
      'hud', 'distance', 'menu', 'login', 'ranking', 'rank-list', 'rank-status',
      'gameover', 'go-title', 'go-distance', 'go-record', 'go-best',
      'go-retry', 'go-menu', 'go-share', 'go-buttons', 'go-coins',
      'best-normal', 'best-hard', 'best-hardcore',
      'player-name', 'nick', 'pin', 'login-error', 'btn-login', 'guest-notice',
      'btn-music', 'menu-coin-balance', 'btn-add-coins',
      'shop', 'shop-list', 'shop-coins', 'shop-daily', 'menu-coins',
    ].forEach((id) => {
      dom[id] = document.getElementById(id);
    });

    // Botones: paran la propagación para que el toque no llegue al
    // manejador global de salto. Se escuchan pointerdown y click
    // (según el dispositivo llega uno u otro primero); si pointerdown
    // ya ejecutó la acción, el click duplicado del MISMO botón se
    // ignora. El guard es por botón: no bloquea taps rápidos en
    // botones distintos (p. ej. cambiar pestañas del ranking).
    const wireButton = (id, fn) => {
      const el = document.getElementById(id);
      let lastPointer = 0;
      const run = () => {
        GameAudio.unlock();
        fn();
      };
      el.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        event.preventDefault();
        lastPointer = performance.now();
        run();
      });
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (performance.now() - lastPointer < 600) return;
        run();
      });
    };
    wireButton('btn-normal', () => start('normal'));
    wireButton('btn-hard', () => start('hard'));
    wireButton('btn-hardcore', () => start('hardcore'));
    wireButton('go-menu', showMenu);
    wireButton('go-share', shareScore);
    wireButton('btn-login', doLogin);
    wireButton('btn-guest', doGuest);
    wireButton('btn-logout', showLogin);
    wireButton('btn-link-account', showLogin);
    wireButton('btn-ranking', () => showRanking(Modes.get().key));
    wireButton('btn-rank-back', showMenu);
    wireButton('btn-shop', showShop);
    wireButton('btn-shop-back', showMenu);
    wireButton('tab-normal', () => showRanking('normal'));
    wireButton('tab-hard', () => showRanking('hard'));
    wireButton('tab-hardcore', () => showRanking('hardcore'));
    wireButton('btn-music', toggleMusic);
    wireButton('btn-lang', () => I18n.toggle());
    // La recompensa por anuncio aún no está implementada: solo avisa.
    wireButton('btn-add-coins', () => window.alert(I18n.t('comingSoon')));
    wireButton('btn-lang-login', () => I18n.toggle());
    dom.nick.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') dom.pin.focus();
    });
    dom.pin.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') doLogin();
    });

    // Al cambiar de idioma, refresca los textos que se generan por
    // código (no cubiertos por data-i18n).
    I18n.setOnChange(refreshDynamicText);
    I18n.apply();

    resize();
    state = createState(MODES.MENU);
    if (Leaderboard.getPlayer()) {
      showMenu();
    } else {
      showLogin();
    }
    Background.reset(viewW, viewH);
  }

  // Vuelve a pintar los textos dinámicos según el idioma actual.
  function refreshDynamicText() {
    updateMusicButton();
    updateCoinsUI();
    if (dom.menu && !dom.menu.classList.contains('hidden')) {
      updateMenuBest();
    }
    if (dom.ranking && !dom.ranking.classList.contains('hidden')) {
      showRanking(rankTab);
    }
    if (dom.shop && !dom.shop.classList.contains('hidden')) {
      renderShop();
    }
  }

  // --- Tienda de skins -----------------------------------------------------
  function updateCoinsUI() {
    dom['menu-coin-balance'].textContent = String(Coins.getBalance());
    dom['menu-coins'].textContent = I18n.t('shopCoinsPlain', { n: Coins.getBalance() });
    dom['shop-coins'].textContent = I18n.t('shopCoins', { n: Coins.getBalance() });
    dom['shop-daily'].textContent = I18n.t('shopDaily', {
      e: Coins.earnedToday(),
      cap: Coins.dailyCap(),
      m: CONFIG.COINS.METERS_PER_COIN,
    });
  }

  // Pinta las tarjetas de la tienda. Construcción con DOM + textContent
  // (nada se interpreta como HTML). Se regenera entera en cada acción:
  // son 5 tarjetas, no hay costo apreciable.
  function renderShop() {
    updateCoinsUI();
    const listEl = dom['shop-list'];
    listEl.textContent = '';
    Skins.LIST.forEach((skin) => {
      const card = document.createElement('div');
      card.className = 'skin-card';

      const thumb = document.createElement('img');
      thumb.className = 'skin-thumb';
      thumb.src = skin.src;
      thumb.alt = '';
      thumb.draggable = false;

      const name = document.createElement('span');
      name.className = 'skin-name';
      name.textContent = I18n.t(skin.nameKey);

      const btn = document.createElement('button');
      btn.className = 'skin-btn';
      const equipped = Skins.activeId() === skin.id;
      if (equipped) {
        btn.textContent = I18n.t('shopEquipped');
        btn.classList.add('equipped');
        btn.disabled = true;
      } else if (Skins.isOwned(skin.id)) {
        btn.textContent = I18n.t('shopEquip');
        btn.addEventListener('pointerdown', (event) => {
          event.stopPropagation();
          Skins.setActive(skin.id);
          GameAudio.unlock();
          Account.push();
          renderShop();
        });
      } else {
        btn.textContent = I18n.t('shopBuy', { n: skin.price });
        const affordable = Coins.getBalance() >= skin.price;
        btn.classList.add('buy');
        btn.disabled = !affordable;
        if (affordable) {
          btn.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
            if (!Coins.spend(skin.price)) return;
            Skins.grant(skin.id);
            Skins.setActive(skin.id);
            GameAudio.unlock();
            GameAudio.record();
            Account.push();
            renderShop();
          });
        }
      }

      card.append(thumb, name, btn);
      listEl.appendChild(card);
    });
  }

  function showShop() {
    dom.menu.classList.add('hidden');
    renderShop();
    dom.shop.classList.remove('hidden');
  }

  // --- Login y ranking ---------------------------------------------------
  function showLogin() {
    state = createState(MODES.MENU);
    dom.menu.classList.add('hidden');
    dom.ranking.classList.add('hidden');
    dom.shop.classList.add('hidden');
    dom.gameover.classList.add('hidden');
    dom.hud.classList.add('hidden');
    dom.nick.value = Leaderboard.getPlayer();
    dom.pin.value = '';
    dom['login-error'].classList.add('hidden');
    dom.login.classList.remove('hidden');
  }

  // Valida y normaliza el nombre del campo; si es inválido, enfoca el
  // campo y avisa. Devuelve null cuando no se debe continuar.
  function readNickOrWarn() {
    const name = dom.nick.value.trim().slice(0, 14);
    if (!name) {
      dom.nick.focus();
      return null;
    }
    if (!Moderation.isAllowed(name)) {
      dom.nick.value = '';
      dom.nick.placeholder = I18n.t('nameNotAllowed');
      dom.nick.focus();
      return null;
    }
    return name;
  }

  function enterMenu() {
    dom.pin.value = '';
    dom.login.classList.add('hidden');
    Music.start(Modes.NORMAL.musicTempo);
    showMenu();
  }

  // Inicia sesión o crea la cuenta (nombre + PIN). El nombre es único:
  // si ya existe, el PIN debe coincidir. El progreso local (monedas,
  // skins) se fusiona con el de la cuenta, nunca se pierde.
  async function doLogin() {
    const name = readNickOrWarn();
    if (!name) return;
    const pin = dom.pin.value.trim();
    if (!pin) {
      dom.pin.focus();
      return;
    }
    dom['login-error'].classList.add('hidden');
    dom['btn-login'].disabled = true;
    const result = await Account.login(name, pin);
    dom['btn-login'].disabled = false;
    if (!result.ok) {
      if (result.code === 'cuenta_bloqueada') {
        const mins = Math.max(1, Math.ceil((result.retryAfter || 60) / 60));
        dom['login-error'].textContent = I18n.t('errCuentaBloqueada', { m: mins });
      } else {
        const key = {
          pin_incorrecto: 'errPinIncorrecto',
          pin_invalido: 'errPinInvalido',
          nombre_invalido: 'errNombreInvalido',
        }[result.code] || 'errSinConexion';
        dom['login-error'].textContent = I18n.t(key);
      }
      dom['login-error'].classList.remove('hidden');
      return;
    }
    Leaderboard.setPlayer(name);
    enterMenu();
  }

  // Juega sin cuenta: el progreso queda solo en este dispositivo. Pide
  // confirmación porque borrar los datos de la app o cambiar de
  // teléfono lo pierde.
  function doGuest() {
    const name = readNickOrWarn();
    if (!name) return;
    if (!window.confirm(I18n.t('guestWarning'))) return;
    Account.unlink();
    Leaderboard.setPlayer(name);
    enterMenu();
  }

  // Token para descartar respuestas remotas obsoletas si el jugador
  // cambia de pestaña antes de que llegue la anterior.
  let rankRequest = 0;

  // Pinta la lista. Construcción con DOM + textContent: el nombre y la
  // distancia NUNCA se interpretan como HTML, aunque vengan de otro
  // jugador (importante para el ranking en línea).
  function renderRankList(entries) {
    const listEl = dom['rank-list'];
    listEl.textContent = '';
    if (!entries || entries.length === 0) {
      const li = document.createElement('li');
      li.className = 'rank-empty';
      li.textContent = I18n.t('rankEmpty');
      listEl.appendChild(li);
      return;
    }
    entries.forEach((e, i) => {
      const li = document.createElement('li');
      const pos = document.createElement('span');
      pos.className = 'rank-pos';
      pos.textContent = `${i + 1}.`;
      const name = document.createElement('span');
      name.className = 'rank-name';
      name.textContent = String(e.name || '').slice(0, 14);
      const dist = document.createElement('span');
      dist.className = 'rank-m';
      const m = Number.isFinite(e.meters) ? Math.floor(e.meters) : 0;
      dist.textContent = `${m} m`;
      li.append(pos, name, dist);
      listEl.appendChild(li);
    });
  }

  function showRanking(modeKey) {
    rankTab = modeKey;
    dom.menu.classList.add('hidden');
    dom.ranking.classList.remove('hidden');
    ['normal', 'hard', 'hardcore'].forEach((key) => {
      document.getElementById(`tab-${key}`).classList.toggle('active', key === modeKey);
    });

    const req = ++rankRequest;

    if (!Leaderboard.remoteEnabled()) {
      dom['rank-status'].textContent = I18n.t('rankLocal');
      renderRankList(Leaderboard.top(modeKey, 10));
      return;
    }

    dom['rank-status'].textContent = I18n.t('rankLoading');
    dom['rank-list'].textContent = '';
    Leaderboard.topGlobal(modeKey, 10)
      .then((entries) => {
        if (req !== rankRequest) return; // respuesta obsoleta
        dom['rank-status'].textContent = I18n.t('rankWorld');
        renderRankList(entries);
      })
      .catch(() => {
        if (req !== rankRequest) return;
        dom['rank-status'].textContent = I18n.t('rankOffline');
        renderRankList(Leaderboard.top(modeKey, 10));
      });
  }

  function toggleMusic() {
    Music.setEnabled(!Music.isEnabled());
    if (Music.isEnabled()) Music.start(Modes.get().musicTempo);
    updateMusicButton();
  }

  function updateMusicButton() {
    dom['btn-music'].textContent = Music.isEnabled() ? '🔊' : '🔇';
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);

    // La cámara es igual para los tres modos (no depende de la
    // dificultad). El zoom se elige para que el mundo visible cumpla
    // DOS mínimos a la vez, gobernando el eje más restrictivo:
    // - MIN_VIEW_WIDTH: tiempo de reacción en pantallas angostas
    //   (móvil vertical), donde manda el ancho.
    // - MIN_VIEW_HEIGHT: visibilidad vertical en pantallas anchas y
    //   bajas (escritorio 16:9), donde manda la altura; sin esto el
    //   riel tras una pendiente caía fuera de pantalla y no se veía
    //   dónde iba a aterrizar la vagoneta.
    // El eje no limitante simplemente crece (más mina visible).
    scale = Math.min(
      canvas.width / CONFIG.MIN_VIEW_WIDTH,
      canvas.height / CONFIG.MIN_VIEW_HEIGHT
    );

    viewH = canvas.height / scale;
    viewW = canvas.width / scale;
    playerX = viewW * CONFIG.PLAYER_X_RATIO;
  }

  function updateMenuBest() {
    Modes.ALL.forEach((mode) => {
      const best = loadBest(mode.storageKey);
      dom[`best-${mode.key}`].textContent =
        best > 0 ? I18n.t('recordShort', { m: best }) : I18n.t('noRecord');
    });
  }

  function showMenu() {
    state = createState(MODES.MENU);
    dom.gameover.classList.add('hidden');
    dom.ranking.classList.add('hidden');
    dom.shop.classList.add('hidden');
    dom.login.classList.add('hidden');
    dom.hud.classList.add('hidden');
    dom['player-name'].textContent = Leaderboard.getPlayer();
    dom['guest-notice'].classList.toggle('hidden', Account.isLinked());
    updateMenuBest();
    updateCoinsUI();
    Music.setTempo(Modes.NORMAL.musicTempo);
    Music.start(Modes.NORMAL.musicTempo);
    dom.menu.classList.remove('hidden');
  }

  function start(modeKey) {
    Modes.set(Modes.byKey(modeKey));
    resize(); // aplica el zoom del modo
    Background.reset(viewW, viewH);
    Music.start(Modes.get().musicTempo);
    Music.setTempo(Modes.get().musicTempo);
    startGame();
  }

  function startGame() {
    state = createState(MODES.PLAYING);
    sparks = [];
    lastShownMeters = -1;
    dom.menu.classList.add('hidden');
    dom.gameover.classList.add('hidden');
    dom['go-record'].classList.add('hidden');
    dom['go-coins'].classList.add('hidden');
    dom['go-retry'].classList.add('hidden');
    dom['go-buttons'].classList.add('hidden');
    dom.hud.classList.remove('hidden');
    dom.distance.classList.toggle('hard', Modes.get().key === 'hard');
    dom.distance.classList.toggle('hardcore', Modes.get().key === 'hardcore');
    dom.distance.textContent = '0 m';
  }

  function die(cause) {
    state.mode = MODES.DEAD;
    state.cause = cause;
    state.deathTimer = 0;

    const finalMeters = meters();
    if (finalMeters > state.best) {
      state.best = finalMeters;
      state.isRecord = true;
      saveBest(Modes.get().storageKey, finalMeters);
    }
    state.coinResult = Coins.earnFromRun(finalMeters, Modes.get().coinMultiplier);
    Leaderboard.submit(Leaderboard.getPlayer(), finalMeters, Modes.get().key);
    if (state.coinResult.earned > 0) Account.push();

    if (cause === 'crash') {
      state.player.onRail = false;
      state.player.vy = -620;
      GameAudio.crash();
      burstSparks(playerX, playerScreenY() - 30, 26);
    } else {
      GameAudio.fall();
    }
    if (navigator.vibrate) navigator.vibrate(cause === 'crash' ? 120 : 60);
  }

  function showGameOver() {
    dom.hud.classList.add('hidden');
    dom['go-title'].textContent =
      state.cause === 'fall' ? I18n.t('fallTitle') : I18n.t('crashTitle');
    dom['go-distance'].textContent = String(meters());
    dom['go-best'].textContent = I18n.t('recordMode', {
      mode: I18n.t(Modes.get().labelKey),
      m: state.best,
    });
    if (state.isRecord) {
      dom['go-record'].classList.remove('hidden');
      GameAudio.record();
    }
    const coins = state.coinResult || { earned: 0, capped: false };
    if (coins.earned > 0 || coins.capped) {
      dom['go-coins'].textContent = I18n.t(
        coins.capped ? 'goCoinsCapped' : 'goCoins',
        { n: coins.earned }
      );
      dom['go-coins'].classList.remove('hidden');
    }
    dom.gameover.classList.remove('hidden');
  }

  // Comparte la puntuación de la última partida como tarjeta-imagen.
  function shareScore() {
    const btn = dom['go-share'];
    const original = btn.textContent;
    btn.textContent = '…';
    Share.share({
      player: Leaderboard.getPlayer(),
      meters: meters(),
      best: state.best,
      isRecord: state.isRecord,
      modeKey: Modes.get().key,
      modeLabel: I18n.t(Modes.get().labelKey),
    })
      .then((result) => {
        btn.textContent = result === 'downloaded' ? I18n.t('imgSaved') : original;
        if (result === 'downloaded') {
          setTimeout(() => { btn.textContent = original; }, 2200);
        }
      })
      .catch(() => { btn.textContent = original; });
  }

  function handleAction() {
    if (state.mode === MODES.MENU) {
      return; // en el menú se elige modo con los botones
    }
    if (state.mode === MODES.PLAYING) {
      if (Player.jump(state.player)) GameAudio.jump();
      return;
    }
    if (state.mode === MODES.DEAD && state.deathTimer > 1.1) {
      startGame();
    }
  }

  // Al soltar el toque/tecla: recorta el salto en curso.
  function handleRelease() {
    if (state.mode === MODES.PLAYING) {
      Player.jumpCut(state.player);
    }
  }

  // --- Chispas de las ruedas -------------------------------------------
  function burstSparks(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      sparks.push({
        x,
        y,
        vx: (Math.random() - 0.7) * 420,
        vy: -Math.random() * 320,
        life: 0.3 + Math.random() * 0.35,
      });
    }
  }

  function updateSparks(dt) {
    sparks.forEach((s) => {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 1400 * dt;
    });
    sparks = sparks.filter((s) => s.life > 0);
  }

  function drawSparks() {
    sparks.forEach((s) => {
      ctx.fillStyle = s.life > 0.2 ? '#ffd76a' : '#ff8c42';
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    });
  }

  // --- Actualización -----------------------------------------------------
  function updateCamera(dt) {
    const target = state.player.worldY - viewH * CONFIG.CAMERA.PLAYER_RATIO;
    state.camY += (target - state.camY) * Math.min(1, CONFIG.CAMERA.FOLLOW * dt);
  }

  function slopeSpeedFactor(px) {
    if (!state.player.onRail) return 1;
    const slope = Track.slopeAt(state.track, px);
    const factor = 1 + slope * CONFIG.SLOPE_BOOST;
    return Math.max(CONFIG.SLOPE_SPEED_MIN, Math.min(CONFIG.SLOPE_SPEED_MAX, factor));
  }

  function updatePlaying(dt) {
    const mode = Modes.get();
    state.speed = Math.min(mode.maxSpeed, state.speed + mode.speedRamp * dt);

    const pxBefore = state.worldX + playerX;
    const effSpeed = state.speed * slopeSpeedFactor(pxBefore);
    state.worldX += effSpeed * dt;

    const px = state.worldX + playerX;
    Track.extend(state.track, state.worldX + viewW * 2, difficulty());
    Track.prune(state.track, state.worldX - 500);
    Obstacles.update(
      state.obstacles, state.track, dt, state.worldX, viewW,
      difficulty(), px, effSpeed
    );

    const landed = Player.update(state.player, dt, state.track, px, effSpeed);
    if (landed) {
      GameAudio.land();
      burstSparks(playerX, playerScreenY(), 8);
    }

    updateCamera(dt);

    if (state.player.onRail && Math.random() < 0.35) {
      burstSparks(playerX - CONFIG.CART.WIDTH * 0.3, playerScreenY(), 1);
    }

    const collision = Obstacles.collide(
      state.obstacles, state.track, px, state.player.worldY
    );
    if (collision === 'deadly') {
      die('crash');
      return;
    }
    if (collision === 'bounce') {
      // Rebote sobre un vagón averiado: pequeño salto gratis.
      state.player.vy = -680;
      state.player.onRail = false;
      GameAudio.jump();
      burstSparks(playerX, playerScreenY() + 20, 12);
    }
    if (!state.player.onRail && playerScreenY() > viewH + 140) {
      die('fall');
      return;
    }

    const m = meters();
    if (m !== lastShownMeters) {
      lastShownMeters = m;
      dom.distance.textContent = `${m} m`;
    }
  }

  function updateDead(dt) {
    state.deathTimer += dt;
    state.player.vy += CONFIG.GRAVITY * dt;
    state.player.worldY += state.player.vy * dt;
    if (state.cause === 'crash') {
      state.player.tilt += 5 * dt;
    }
    if (state.deathTimer > 0.9 && dom.gameover.classList.contains('hidden')) {
      showGameOver();
    }
    if (state.deathTimer > 1.1) {
      dom['go-retry'].classList.remove('hidden');
      dom['go-buttons'].classList.remove('hidden');
    }
  }

  function update(dt) {
    state.time += dt;
    if (state.mode === MODES.PLAYING) updatePlaying(dt);
    if (state.mode === MODES.DEAD) updateDead(dt);
    updateSparks(dt);
  }

  // --- Dibujo ------------------------------------------------------------
  function render(dt) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Sacudida de pantalla justo tras un choque.
    if (state.mode === MODES.DEAD && state.cause === 'crash' && state.deathTimer < 0.35) {
      const shake = (0.35 - state.deathTimer) * 26;
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    Background.draw(ctx, state, dt, viewW, viewH);
    Track.draw(ctx, state.track, state.worldX, state.camY, viewW, viewH);
    Obstacles.draw(ctx, state.obstacles, state.track, state.worldX, state.camY, viewW, state.time);

    const speedFactor = state.speed / Modes.get().maxSpeed;
    Sprites.drawPlayer(
      ctx, playerX, playerScreenY(), state.player.tilt,
      state.player.spin, state.time, speedFactor
    );
    drawSparks();
    Background.drawVignette(ctx, viewW, viewH);
  }

  // Estado interno de solo lectura, para pruebas automatizadas.
  function debugState() {
    return {
      mode: state.mode,
      difficultyMode: Modes.get().key,
      cause: state.cause,
      worldX: state.worldX,
      camY: state.camY,
      speed: state.speed,
      playerX,
      viewW,
      viewH,
      playerWorldY: state.player.worldY,
      onRail: state.player.onRail,
      playerSlope: Track.slopeAt(state.track, state.worldX + playerX),
      segments: state.track.segments.slice(),
      obstacles: state.obstacles.list.map((o) => ({
        type: o.type, x: o.x, vx: o.vx || 0, falling: !!o.falling,
      })),
    };
  }

  return { setup, resize, handleAction, handleRelease, start, update, render, debugState };
})();
