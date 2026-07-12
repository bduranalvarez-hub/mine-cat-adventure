'use strict';

// Skins del personaje principal + imagen del enemigo. Cada personaje es
// un PNG recortado (solo el gato, sin carro) que se estampa sobre la
// vagoneta procedural del juego, que sigue inclinándose y girando ruedas.
// La skin activa y las poseídas se guardan en el dispositivo. La compra
// con monedas se resuelve en la tienda (ver leaderboard/coins); aquí solo
// vive el catálogo, la persistencia y la carga de imágenes.
const Skins = (() => {
  const KEY_ACTIVE = 'mca-skin';
  const KEY_OWNED = 'mca-skins-owned';
  const DEFAULT_ID = 'sphynx';

  function load(src) {
    const rec = { img: new Image(), ready: false, w: 0, h: 0 };
    rec.img.onload = () => {
      rec.ready = true;
      rec.w = rec.img.naturalWidth;
      rec.h = rec.img.naturalHeight;
    };
    rec.img.src = src;
    return rec;
  }

  // renderW = ancho del personaje en unidades de mundo (se escala la imagen
  // manteniendo proporción). dy = ajuste vertical fino sobre el borde.
  // front: el personaje se dibuja delante de la vagoneta (sus manos van
  // agarradas al borde); sin front va detrás y el carro le tapa el cuerpo.
  const LIST = [
    { id: 'sphynx', nameKey: 'skinSphynx', src: 'img/char-sphynx.png', price: 0, renderW: 118, dx: 6, dy: 0 },
    { id: 'bebe', nameKey: 'skinBebe', src: 'img/skin-bebe.png', price: 1000, renderW: 112, dx: 0, dy: 0, front: true },
    { id: 'esqueleto', nameKey: 'skinEsqueleto', src: 'img/skin-esqueleto.png', price: 1000, renderW: 112, dx: 0, dy: 0, front: true },
    { id: 'robot', nameKey: 'skinRobot', src: 'img/skin-robot.png', price: 1000, renderW: 126, dx: 0, dy: 0, front: true },
    { id: 'gatoreal', nameKey: 'skinGatoreal', src: 'img/skin-gatoreal.png', price: 1000, renderW: 118, dx: 6, dy: 0 },
  ];
  LIST.forEach((s) => { s.rec = load(s.src); });

  const ENEMY = { rec: load('img/char-enemy.png'), renderW: 92, dx: 0, dy: 0, front: true };

  function readOwned() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_OWNED));
      if (Array.isArray(raw)) return raw.filter((id) => typeof id === 'string');
    } catch (err) {
      // Valor corrupto: se ignora y se usa el conjunto por defecto.
    }
    return [DEFAULT_ID];
  }

  const owned = readOwned();
  if (!owned.includes(DEFAULT_ID)) owned.push(DEFAULT_ID);

  function byId(id) {
    return LIST.find((s) => s.id === id) || LIST[0];
  }

  let active = localStorage.getItem(KEY_ACTIVE) || DEFAULT_ID;
  if (!LIST.some((s) => s.id === active)) active = DEFAULT_ID;

  function persistOwned() {
    try {
      localStorage.setItem(KEY_OWNED, JSON.stringify(owned));
    } catch (err) {
      // Almacenamiento no disponible o lleno: la sesión sigue en memoria.
    }
  }

  return {
    LIST,
    ENEMY,
    DEFAULT_ID,
    getActive() { return byId(active); },
    activeId() { return active; },
    setActive(id) {
      if (!LIST.some((s) => s.id === id)) return;
      active = id;
      try {
        localStorage.setItem(KEY_ACTIVE, id);
      } catch (err) {
        // Sin persistencia: la elección vale solo para esta sesión.
      }
    },
    isOwned(id) { return owned.includes(id); },
    grant(id) {
      if (owned.includes(id) || !LIST.some((s) => s.id === id)) return;
      owned.push(id);
      persistOwned();
    },
  };
})();
