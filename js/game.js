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
      // La partida ya se cobró (récord, monedas, ranking). Ver
      // settleRun(): el choque y el fin de la partida son momentos
      // distintos desde que existe "revivir viendo un anuncio".
      settled: false,
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

  // Último estado conocido de anuncios vistos, tal como lo lleva el
  // SERVIDOR (record_ad_watch). null mientras no haya cuenta vinculada
  // o no haya llegado la respuesta. Solo sirve para pintar el avance de
  // la skin épica: el desbloqueo real lo decide el servidor.
  let adStatus = null;

  // ¿Hay anuncios recompensados disponibles? Requieren el SDK nativo de
  // AdMob, que solo existe en la app compilada (no en web/PWA) y que
  // todavía no está integrado. Hasta entonces esto es false y la tienda
  // lo dice, en vez de mostrar un contador congelado sin explicación.
  function adsAvailable() {
    return typeof Ads !== 'undefined' && Ads.available();
  }

  function refreshAdStatus() {
    if (typeof Account === 'undefined' || !Account.isLinked()) {
      adStatus = null;
      return;
    }
    Account.adStatus().then((s) => {
      if (!s) return;
      adStatus = s;
      // Si el servidor ya dio por cumplido el desbloqueo, que la skin
      // aparezca ahora y no en la próxima sesión.
      if (s.total >= s.unlockAt) Skins.grant('ads_epica');
      if (dom.shop && !dom.shop.classList.contains('hidden')) renderShop();
    }).catch(() => {});
  }

  // Modo del panel de credenciales: 'create' | 'login' | 'guest'.
  let authMode = 'login';

  // Marca de tiempo hasta la que hay que tragarse el "click" sintetizado
  // que sigue a un toque en un botón (ver wireButton y el listener de
  // captura en setup). Evita el "ghost click" que dispararía un botón
  // recién aparecido debajo del dedo al cambiar de pantalla.
  let swallowClickUntil = 0;

  function setup(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    [
      'hud', 'distance', 'menu', 'login', 'welcome', 'login-title',
      'ranking', 'rank-list', 'rank-status',
      'gameover', 'go-title', 'go-distance', 'go-record', 'go-best',
      'go-retry', 'go-menu', 'go-share', 'go-buttons', 'go-coins',
      'best-normal', 'best-hard', 'best-hardcore',
      'player-name', 'nick', 'pin', 'login-error', 'btn-login', 'guest-notice',
      'btn-music', 'menu-coin-balance', 'btn-add-coins',
      'shop', 'shop-list', 'shop-coins', 'shop-daily', 'menu-coins',
      'shop-redeem', 'redeem-input', 'btn-redeem', 'redeem-status',
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
        // Al actuar en pointerdown y cambiar de pantalla, el "click"
        // sintetizado del MISMO toque caería sobre lo que quede debajo
        // del dedo (p. ej. un botón de modo del menú) y dispararía una
        // acción no deseada. Se marca para tragárselo (ver setup).
        swallowClickUntil = lastPointer + 400;
        run();
      });
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (performance.now() - lastPointer < 600) return;
        run();
      });
    };

    // Se traga el click fantasma que sigue a un toque en un botón que
    // acaba de cambiar de pantalla. En fase de CAPTURA (corre antes que
    // el handler de cualquier botón), así impide que ese mismo toque
    // active un botón recién aparecido debajo del dedo. Es de un solo
    // disparo: solo come el primer click dentro de la ventana.
    window.addEventListener(
      'click',
      (event) => {
        if (performance.now() < swallowClickUntil) {
          swallowClickUntil = 0;
          event.stopPropagation();
          event.preventDefault();
        }
      },
      true
    );

    wireButton('btn-normal', () => start('normal'));
    wireButton('btn-hard', () => start('hard'));
    wireButton('btn-hardcore', () => start('hardcore'));
    wireButton('go-menu', showMenu);
    wireButton('go-share', shareScore);
    // El botón principal del panel sirve a los tres modos: en 'guest'
    // no hay PIN que validar, solo el nombre.
    wireButton('btn-login', () => (authMode === 'guest' ? doGuest() : doLogin()));
    wireButton('btn-go-create', () => showLogin('create'));
    wireButton('btn-go-login', () => showLogin('login'));
    wireButton('btn-guest', () => showLogin('guest'));
    wireButton('btn-login-back', showWelcome);
    wireButton('btn-logout', showWelcome);
    wireButton('btn-link-account', showWelcome);
    wireButton('btn-ranking', () => showRanking(Modes.get().key));
    wireButton('btn-rank-back', showMenu);
    wireButton('btn-shop', showShop);
    wireButton('btn-shop-back', showMenu);
    wireButton('btn-redeem', doRedeem);
    dom['redeem-input'].addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') doRedeem();
    });
    wireButton('tab-normal', () => showRanking('normal'));
    wireButton('tab-hard', () => showRanking('hard'));
    wireButton('tab-hardcore', () => showRanking('hardcore'));
    wireButton('btn-music', toggleMusic);
    wireButton('btn-lang', () => I18n.toggle());
    // La recompensa por anuncio aún no está implementada: solo avisa.
    wireButton('btn-add-coins', () => window.alert(I18n.t('comingSoon')));
    wireButton('btn-lang-welcome', () => I18n.toggle());
    dom.nick.addEventListener('keydown', (event) => {
      event.stopPropagation();
      // Como invitado no hay campo de PIN al que saltar: Enter confirma.
      if (event.key !== 'Enter') return;
      if (authMode === 'guest') doGuest();
      else dom.pin.focus();
    });
    dom.pin.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') doLogin();
    });

    // Si la app se va a segundo plano o se cierra con una partida ya
    // perdida pero sin cerrar, se liquida ahí mismo (ver settleIfDead):
    // el bucle se detiene y esa carrera se quedaría sin cobrar.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') settleIfDead();
    });
    window.addEventListener('pagehide', settleIfDead);

    // Al cambiar de idioma, refresca los textos que se generan por
    // código (no cubiertos por data-i18n).
    I18n.setOnChange(refreshDynamicText);
    I18n.apply();

    resize();
    state = createState(MODES.MENU);
    if (Leaderboard.getPlayer()) {
      showMenu();
    } else {
      showWelcome();
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
      const rar = skin.rarity ? Skins.RARITY[skin.rarity] : null;
      const card = document.createElement('div');
      card.className = 'skin-card';
      if (rar) card.style.setProperty('--rarity', rar.color);

      const thumb = document.createElement('img');
      thumb.className = 'skin-thumb';
      thumb.src = skin.src;
      thumb.alt = '';
      thumb.draggable = false;

      const info = document.createElement('div');
      info.className = 'skin-info';
      const name = document.createElement('span');
      name.className = 'skin-name';
      name.textContent = I18n.t(skin.nameKey);
      info.appendChild(name);
      if (rar) {
        const badge = document.createElement('span');
        badge.className = 'skin-rarity';
        badge.textContent = I18n.t(rar.nameKey);
        badge.style.color = rar.color;
        badge.style.borderColor = rar.color;
        info.appendChild(badge);
      }

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
      } else if (skin.unlockBy === 'ads') {
        // No se compra con monedas: se libera al llegar al total de
        // anuncios vistos, y de eso lleva la cuenta el SERVIDOR
        // (record_ad_watch). Aquí solo se pinta el avance.
        const total = adStatus ? adStatus.total : 0;
        const meta = adStatus ? adStatus.unlockAt : 100;
        btn.textContent = I18n.t('shopAdsProgress', { n: total, t: meta });
        btn.disabled = true;
        const hint = document.createElement('span');
        hint.className = 'skin-hint';
        // Mientras el SDK de anuncios no exista (web/PWA, o build sin
        // AdMob), se dice claro que todavía no hay forma de avanzar:
        // un contador congelado en 0/100 sin explicación confunde.
        hint.textContent = adsAvailable()
          ? I18n.t('shopAdsHint', { t: meta })
          : I18n.t('shopAdsSoon');
        info.appendChild(hint);
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

      card.append(thumb, info, btn);
      listEl.appendChild(card);
    });
    updateRedeemUI();
  }


  // Muestra (o limpia) el mensaje del canje. kind: 'ok' | 'err'.
  function setRedeemStatus(key, kind, params) {
    const el = dom['redeem-status'];
    if (!key) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.textContent = I18n.t(key, params);
    el.classList.remove('hidden', 'ok', 'err');
    el.classList.add(kind === 'ok' ? 'ok' : 'err');
  }

  // El canje exige cuenta vinculada: el "una vez por cuenta" no se
  // puede garantizar para un invitado. Sin cuenta, deshabilita el campo
  // y muestra el aviso.
  function updateRedeemUI() {
    const linked = Account.isLinked();
    dom['redeem-input'].disabled = !linked;
    dom['btn-redeem'].disabled = !linked;
    if (!linked) {
      dom['redeem-input'].value = '';
      setRedeemStatus('redeemNeedAccount', 'err');
    }
  }

  // Canjea el código escrito por monedas de regalo (vía Account →
  // Supabase). Refresca la tienda al acertar: sube el saldo y quizá
  // desbloquea compras.
  async function doRedeem() {
    if (!Account.isLinked()) {
      setRedeemStatus('redeemNeedAccount', 'err');
      return;
    }
    const code = dom['redeem-input'].value.trim();
    if (!code) {
      setRedeemStatus('redeemEmpty', 'err');
      dom['redeem-input'].focus();
      return;
    }
    dom['btn-redeem'].disabled = true;
    const result = await Account.redeem(code);
    dom['btn-redeem'].disabled = false;
    if (result.ok) {
      dom['redeem-input'].value = '';
      GameAudio.record();
      renderShop();
      setRedeemStatus('redeemOk', 'ok', { n: result.coins });
      return;
    }
    const key = {
      codigo_invalido: 'redeemErrInvalido',
      codigo_vencido: 'redeemErrVencido',
      codigo_agotado: 'redeemErrAgotado',
      ya_canjeado: 'redeemErrYaCanjeado',
      no_autorizado: 'redeemNeedAccount',
    }[result.code] || 'errSinConexion';
    setRedeemStatus(key, 'err');
  }

  function showShop() {
    dom.menu.classList.add('hidden');
    setRedeemStatus(null);
    dom['redeem-input'].value = '';
    refreshAdStatus();
    renderShop();
    dom.shop.classList.remove('hidden');
  }

  // --- Login y ranking ---------------------------------------------------

  // Pantalla previa: elegir entre crear cuenta, ingresar o jugar de
  // invitado. Antes las dos primeras compartían un único formulario, y
  // el servidor tenía que adivinar la intención: un nombre mal tecleado
  // no daba error, daba una cuenta nueva y vacía.
  function showWelcome() {
    state = createState(MODES.MENU);
    dom.menu.classList.add('hidden');
    dom.ranking.classList.add('hidden');
    dom.shop.classList.add('hidden');
    dom.gameover.classList.add('hidden');
    dom.hud.classList.add('hidden');
    dom.login.classList.add('hidden');
    dom.welcome.classList.remove('hidden');
  }

  // mode: 'create' | 'login' | 'guest'. Además del título, decide la
  // intención que se le declara al servidor (ver Account.login), que es
  // de donde salen los errores "ese nombre ya está ocupado" y "no existe
  // una cuenta con ese nombre".
  function showLogin(mode) {
    authMode = mode;
    const guest = mode === 'guest';
    const titleKey = guest ? 'loginTitleGuest'
      : (mode === 'create' ? 'loginTitleCreate' : 'loginTitleEnter');
    const actionKey = guest ? 'btnGuestPlay' : 'btnLogin';

    // Se actualiza el atributo además del texto: I18n.apply() lo relee
    // al cambiar de idioma, así el título no revierte al del otro modo.
    dom['login-title'].setAttribute('data-i18n', titleKey);
    dom['login-title'].textContent = I18n.t(titleKey);
    dom['btn-login'].setAttribute('data-i18n', actionKey);
    dom['btn-login'].textContent = I18n.t(actionKey);

    // El invitado no tiene cuenta, así que no hay PIN que pedirle.
    dom.pin.classList.toggle('hidden', guest);
    dom.pin.value = '';
    // Al crear cuenta se parte de un campo vacío: rellenarlo con el
    // nombre anterior invita a repetirlo, y ese nombre ya está tomado.
    dom.nick.value = mode === 'login' ? Leaderboard.getPlayer() : '';
    dom['login-error'].classList.add('hidden');

    dom.welcome.classList.add('hidden');
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
    dom.welcome.classList.add('hidden');
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
    const result = await Account.login(name, pin, authMode === 'create');
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
          nombre_ya_existe: 'errNombreYaExiste',
          cuenta_no_existe: 'errCuentaNoExiste',
        }[result.code] || 'errSinConexion';
        dom['login-error'].textContent = I18n.t(key);
      }
      dom['login-error'].classList.remove('hidden');
      return;
    }
    // Nombre CANÓNICO de la cuenta (el que devolvió el servidor), no
    // el tecleado: si la cuenta es "BDuran" y escribes "bduran",
    // entras a la misma cuenta y debes seguir apareciendo como
    // "BDuran" en el juego y en el ranking, no como un jugador nuevo.
    Leaderboard.setPlayer(Account.linkedName() || name);
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
        dom['rank-status'].textContent =
          I18n.t(Account.isLinked() ? 'rankWorld' : 'rankWorldGuest');
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

  // El botón de música es un icono HTML sobre el arte: refleja el
  // estado directamente (🔊/🔇).
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
    dom.welcome.classList.add('hidden');
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

  // Cierra la partida: récord, monedas y envío al ranking. Se ejecuta
  // UNA sola vez (state.settled). Está separado de die() a propósito:
  // con "revivir viendo un anuncio" el choque ya NO es el final de la
  // carrera. Si se cobrara ahí, revivir y volver a morir pagaría dos
  // veces la misma partida (y la segunda vez contando de nuevo desde
  // el metro 0). Ahora se cobra cuando la partida se acaba de verdad.
  //
  // Cobrar al final también es lo correcto para el jugador: la
  // distancia que cuenta es la total, incluida la parte posterior al
  // revivir, y el tope diario de monedas se aplica una sola vez.
  function settleRun() {
    if (!state || state.settled) return;
    state.settled = true;

    const finalMeters = meters();
    if (finalMeters > state.best) {
      state.best = finalMeters;
      state.isRecord = true;
      saveBest(Modes.get().storageKey, finalMeters);
    }
    state.coinResult = Coins.earnFromRun(finalMeters, Modes.get().coinMultiplier);
    Leaderboard.submit(Leaderboard.getPlayer(), finalMeters, Modes.get().key);
    if (state.coinResult.earned > 0) Account.push();
  }

  // Red de seguridad: si el jugador manda la app a segundo plano o la
  // cierra entre el choque y el cierre de la partida, el bucle se
  // detiene y la carrera se quedaría sin cobrar. Solo liquida si ya
  // estaba muerto; en pleno juego no hay nada que cerrar.
  function settleIfDead() {
    if (state && state.mode === MODES.DEAD) settleRun();
  }

  // Choque o caída. NO cierra la partida ni paga: de eso se encarga
  // settleRun() cuando ya no hay vuelta atrás.
  function die(cause) {
    state.mode = MODES.DEAD;
    state.cause = cause;
    state.deathTimer = 0;

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
      // Aquí ya no hay vuelta atrás (cuando exista el botón de revivir,
      // este es el punto donde el jugador habrá dicho que no).
      settleRun();
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
