'use strict';

// Monedas del juego: se ganan por distancia recorrida (1 cada
// CONFIG.COINS.METERS_PER_COIN metros) con un tope diario
// (CONFIG.COINS.DAILY_CAP). El saldo y el progreso del día viven en
// localStorage; si el almacenamiento falla, la sesión sigue en memoria.
const Coins = (() => {
  const KEY_BALANCE = 'mca-coins';
  const KEY_DAILY = 'mca-coins-daily';

  function todayStamp() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function readBalance() {
    try {
      const value = parseInt(localStorage.getItem(KEY_BALANCE), 10);
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function readDaily() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_DAILY));
      if (raw && raw.date === todayStamp() && Number.isFinite(raw.earned) && raw.earned >= 0) {
        return { date: raw.date, earned: Math.floor(raw.earned) };
      }
    } catch (err) {
      // Valor corrupto o sin almacenamiento: se arranca el día de cero.
    }
    return { date: todayStamp(), earned: 0 };
  }

  let balance = readBalance();
  let daily = readDaily();

  function persist() {
    try {
      localStorage.setItem(KEY_BALANCE, String(balance));
      localStorage.setItem(KEY_DAILY, JSON.stringify(daily));
    } catch (err) {
      // Sin persistencia: el saldo vale solo para esta sesión.
    }
  }

  // Si el jugador cruza la medianoche con el juego abierto, el tope
  // diario se reinicia en la siguiente consulta.
  function rollDay() {
    if (daily.date !== todayStamp()) {
      daily = { date: todayStamp(), earned: 0 };
    }
  }

  function getBalance() {
    return balance;
  }

  function earnedToday() {
    rollDay();
    return daily.earned;
  }

  function dailyCap() {
    return CONFIG.COINS.DAILY_CAP;
  }

  // Convierte los metros de una partida en monedas, respetando el tope
  // diario. multiplier depende del modo (Modes.get().coinMultiplier):
  // fácil paga x1, difícil x2, hardcore x3 por los mismos metros.
  // Devuelve cuántas se acreditaron y si el tope recortó algo.
  function earnFromRun(meters, multiplier) {
    rollDay();
    const mult = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    const raw = Math.floor(Math.max(0, meters) / CONFIG.COINS.METERS_PER_COIN) * mult;
    const room = Math.max(0, CONFIG.COINS.DAILY_CAP - daily.earned);
    const earned = Math.min(raw, room);
    if (earned > 0) {
      balance += earned;
      daily = { date: daily.date, earned: daily.earned + earned };
      persist();
    }
    return { earned, capped: raw > earned };
  }

  // Acredita monedas fuera del ciclo de partida (recompensas, anuncios).
  // No cuenta para el tope diario de distancia.
  function add(amount) {
    const value = Math.floor(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    balance += value;
    persist();
  }

  function spend(amount) {
    const value = Math.floor(amount);
    if (!Number.isFinite(value) || value < 0 || value > balance) return false;
    balance -= value;
    persist();
    return true;
  }

  // Adopta un saldo fusionado con el servidor (ver Account.sync). Solo
  // sube el saldo local, nunca lo baja: jugar offline no debe perder
  // monedas ya ganadas en este dispositivo.
  function setBalance(amount) {
    const value = Math.floor(amount);
    if (!Number.isFinite(value) || value <= balance) return;
    balance = value;
    persist();
  }

  return { getBalance, earnedToday, dailyCap, earnFromRun, add, spend, setBalance };
})();
