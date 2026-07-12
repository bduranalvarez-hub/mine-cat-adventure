'use strict';

// Internacionalización (español / inglés). Detecta el idioma del
// navegador la primera vez y recuerda la elección del jugador. Los
// textos estáticos se traducen vía atributos data-i18n en el HTML;
// los dinámicos, con I18n.t(clave, params).
const I18n = (() => {
  const STORAGE_KEY = 'mca-lang';
  const SUPPORTED = ['es', 'en'];

  const STRINGS = {
    es: {
      subtitle: 'Un sphynx, una vagoneta, una mina infinita',
      loginLabel: '¿Cómo te llamas, minero?',
      nickPlaceholder: 'Tu nombre',
      btnLogin: 'ENTRAR A LA MINA',
      playerPrefix: 'Minero:',
      change: 'cambiar',
      modeEasy: 'FÁCIL',
      modeHard: '🔥 DIFÍCIL',
      modeHardcore: '☠️ HARDCORE',
      ranking: '🏆 RANKING',
      help: 'Toca para saltar: tap corto, salto corto;<br>mantén presionado para el salto máximo.',
      privacy: 'Política de privacidad',
      rankTitle: '🏆 RANKING',
      tabEasy: 'FÁCIL',
      tabHard: 'DIFÍCIL',
      tabHardcore: 'HARDCORE',
      back: 'VOLVER',
      crashTitle: '¡TE ESTRELLASTE!',
      fallTitle: '¡AL POZO!',
      newRecord: '¡NUEVO RÉCORD!',
      retry: 'TOCA PARA REINTENTAR',
      share: '📤 COMPARTIR',
      changeMode: 'CAMBIAR MODO',
      imgSaved: '✓ IMAGEN GUARDADA',
      musicOn: '🔊 Música: sí',
      musicOff: '🔇 Música: no',
      langBtn: '🌐 Idioma: Español',
      recordShort: 'Récord: {m} m',
      noRecord: 'Sin récord',
      recordMode: 'Récord ({mode}): {m} m',
      rankLocal: '📱 Ranking local (este dispositivo)',
      rankLoading: '🌍 Cargando ranking mundial…',
      rankWorld: '🌍 Ranking mundial',
      rankOffline: '📱 Sin conexión: ranking local',
      rankEmpty: 'Aún no hay marcas en este modo. ¡Sé el primero!',
      nameNotAllowed: 'Ese nombre no está permitido',
      modeEasyClean: 'FÁCIL',
      modeHardClean: 'DIFÍCIL',
      modeHardcoreClean: 'HARDCORE',
      cardDistance: 'DISTANCIA',
      cardRecord: 'RÉCORD',
      cardMeters: 'metros',
      cardMedal: 'MEDALLA',
      cardNoMedal1: 'SIN',
      cardNoMedal2: 'MEDALLA',
      cardNewRecord: '¡NUEVO RÉCORD!',
      shareText: '¡Recorrí {m} m en Mine Cat Adventure ({mode})! ¿Puedes superarme? 🐈🛒',
      shop: '🛒 TIENDA',
      shopTitle: '🛒 TIENDA',
      shopCoins: '🪙 {n} monedas',
      shopDaily: 'Ganadas hoy: {e}/{cap} 🪙 (1 cada {m} m)',
      shopEquipped: '✓ EQUIPADA',
      shopEquip: 'EQUIPAR',
      shopBuy: 'COMPRAR 🪙{n}',
      goCoins: '+{n} 🪙',
      goCoinsCapped: '+{n} 🪙 (tope diario alcanzado)',
      skinSphynx: 'Sphynx',
      skinBebe: 'Bebé',
      skinEsqueleto: 'Esqueleto',
      skinRobot: 'Robot',
      skinGatoreal: 'Gato real captado en cámara',
      pinPlaceholder: 'Clave (mín. 4 dígitos)',
      btnGuest: '🎮 Jugar como invitado',
      guestWarning: 'Como invitado, tu progreso (monedas y skins) se guarda solo en este dispositivo y puedes perderlo si borras los datos de la app o cambias de teléfono.\n\n¿Quieres continuar como invitado?',
      guestNotice: '🎮 Invitado: tu progreso puede perderse.',
      btnLinkAccount: '🔗 Vincular cuenta',
      errNombreInvalido: 'Nombre inválido',
      errPinInvalido: 'La clave debe tener 4 a 8 números',
      errPinIncorrecto: 'Clave incorrecta para ese nombre',
      errCuentaBloqueada: 'Demasiados intentos. Intenta de nuevo en {m} min.',
      errSinConexion: 'Sin conexión: intenta jugar como invitado',
      linkOk: '✓ Cuenta vinculada',
    },
    en: {
      subtitle: 'A sphynx, a mine cart, an endless mine',
      loginLabel: "What's your name, miner?",
      nickPlaceholder: 'Your name',
      btnLogin: 'ENTER THE MINE',
      playerPrefix: 'Miner:',
      change: 'change',
      modeEasy: 'EASY',
      modeHard: '🔥 HARD',
      modeHardcore: '☠️ HARDCORE',
      ranking: '🏆 RANKING',
      help: 'Tap to jump: short tap, short jump;<br>hold for the highest jump.',
      privacy: 'Privacy policy',
      rankTitle: '🏆 RANKING',
      tabEasy: 'EASY',
      tabHard: 'HARD',
      tabHardcore: 'HARDCORE',
      back: 'BACK',
      crashTitle: 'YOU CRASHED!',
      fallTitle: 'DOWN THE PIT!',
      newRecord: 'NEW RECORD!',
      retry: 'TAP TO RETRY',
      share: '📤 SHARE',
      changeMode: 'CHANGE MODE',
      imgSaved: '✓ IMAGE SAVED',
      musicOn: '🔊 Music: on',
      musicOff: '🔇 Music: off',
      langBtn: '🌐 Language: English',
      recordShort: 'Best: {m} m',
      noRecord: 'No record',
      recordMode: 'Best ({mode}): {m} m',
      rankLocal: '📱 Local ranking (this device)',
      rankLoading: '🌍 Loading world ranking…',
      rankWorld: '🌍 World ranking',
      rankOffline: '📱 Offline: local ranking',
      rankEmpty: 'No scores yet in this mode. Be the first!',
      nameNotAllowed: 'That name is not allowed',
      modeEasyClean: 'EASY',
      modeHardClean: 'HARD',
      modeHardcoreClean: 'HARDCORE',
      cardDistance: 'DISTANCE',
      cardRecord: 'BEST',
      cardMeters: 'meters',
      cardMedal: 'MEDAL',
      cardNoMedal1: 'NO',
      cardNoMedal2: 'MEDAL',
      cardNewRecord: 'NEW RECORD!',
      shareText: 'I ran {m} m in Mine Cat Adventure ({mode})! Can you beat me? 🐈🛒',
      shop: '🛒 SHOP',
      shopTitle: '🛒 SHOP',
      shopCoins: '🪙 {n} coins',
      shopDaily: 'Earned today: {e}/{cap} 🪙 (1 per {m} m)',
      shopEquipped: '✓ EQUIPPED',
      shopEquip: 'EQUIP',
      shopBuy: 'BUY 🪙{n}',
      goCoins: '+{n} 🪙',
      goCoinsCapped: '+{n} 🪙 (daily cap reached)',
      skinSphynx: 'Sphynx',
      skinBebe: 'Baby',
      skinEsqueleto: 'Skeleton',
      skinRobot: 'Robot',
      skinGatoreal: 'Real cat caught on camera',
      pinPlaceholder: 'PIN (min. 4 digits)',
      btnGuest: '🎮 Play as guest',
      guestWarning: "As a guest, your progress (coins and skins) is saved only on this device and you may lose it if you clear the app's data or switch phones.\n\nContinue as guest?",
      guestNotice: '🎮 Guest: your progress may be lost.',
      btnLinkAccount: '🔗 Link account',
      errNombreInvalido: 'Invalid name',
      errPinInvalido: 'PIN must be 4 to 8 digits',
      errPinIncorrecto: 'Wrong PIN for that name',
      errCuentaBloqueada: 'Too many attempts. Try again in {m} min.',
      errSinConexion: 'No connection: try playing as guest',
      linkOk: '✓ Account linked',
    },
  };

  function detect() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (err) { /* sin almacenamiento */ }
    const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
    return SUPPORTED.includes(nav) ? nav : 'es';
  }

  let lang = detect();
  let onChange = null;

  function t(key, params) {
    const table = STRINGS[lang] || STRINGS.es;
    let str = table[key];
    if (str == null) str = STRINGS.es[key] != null ? STRINGS.es[key] : key;
    if (params) {
      Object.keys(params).forEach((k) => {
        str = str.split(`{${k}}`).join(params[k]);
      });
    }
    return str;
  }

  function getLang() {
    return lang;
  }

  // Traduce todos los elementos marcados en el HTML.
  function apply() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.documentElement.lang = lang;
    if (typeof onChange === 'function') onChange();
  }

  function setLang(next) {
    if (!SUPPORTED.includes(next)) return;
    lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (err) { /* sin almacenamiento */ }
    apply();
  }

  function toggle() {
    setLang(lang === 'es' ? 'en' : 'es');
  }

  // Callback para que el juego refresque textos dinámicos al cambiar
  // de idioma (récords del menú, botón de música, etc.).
  function setOnChange(fn) {
    onChange = fn;
  }

  return { t, getLang, setLang, toggle, apply, setOnChange };
})();
