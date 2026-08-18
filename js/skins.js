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

  // Rareza de las skins: define el precio y el color de la etiqueta. El
  // precio de cada skin sale de su rareza (una sola fuente de verdad).
  // Orden de menor a mayor para ordenar la tienda.
  const RARITY = Object.freeze({
    comun: { key: 'comun', nameKey: 'rarityComun', order: 1, price: 1000, color: '#aeb9c2' },
    rara: { key: 'rara', nameKey: 'rarityRara', order: 2, price: 1500, color: '#4aa3ff' },
    epica: { key: 'epica', nameKey: 'rarityEpica', order: 3, price: 3000, color: '#c56bff' },
    legendaria: { key: 'legendaria', nameKey: 'rarityLegendaria', order: 4, price: 5000, color: '#ffb020' },
  });

  // renderW = ancho del personaje en unidades de mundo (se escala la imagen
  // manteniendo proporción). dy = ajuste vertical fino sobre el borde.
  // front: el personaje se dibuja delante de la vagoneta (sus manos van
  // agarradas al borde); sin front va detrás y el carro le tapa el cuerpo.
  // rarity: clave de RARITY; sphynx es la inicial (gratis, sin rareza).
  const LIST = [
    { id: 'sphynx', nameKey: 'skinSphynx', src: 'img/char-sphynx.png', price: 0, rarity: null, renderW: 118, dx: 6, dy: 0 },
    // Común
    { id: 'pirata', nameKey: 'skinPirata', src: 'img/skin-pirata.png', rarity: 'comun', renderW: 120, dx: 4, dy: 0 },
    // Doctor: se muestra la bata COMPLETA (V, solapas, estetoscopio, cruz)
    // apoyada sobre el borde del vagón. dy negativo lo sube apenas para que
    // el borde caiga en la base de la bata, no cortando el escote a media
    // altura (bajarlo dejaba ver solo la punta de la V, se veía mal).
    { id: 'doctor', nameKey: 'skinDoctor', src: 'img/skin-doctor.png', rarity: 'comun', renderW: 120, dx: 2, dy: -2 },
    { id: 'bebe', nameKey: 'skinBebe', src: 'img/skin-bebe.png', rarity: 'comun', renderW: 112, dx: 0, dy: 0, front: true },
    { id: 'siames', nameKey: 'skinSiames', src: 'img/skin-siames.png', rarity: 'comun', renderW: 120, dx: 4, dy: 0 },
    { id: 'naranja', nameKey: 'skinNaranja', src: 'img/skin-naranja.png', rarity: 'comun', renderW: 120, dx: 4, dy: 0 },
    // Rara
    { id: 'esqueleto', nameKey: 'skinEsqueleto', src: 'img/skin-esqueleto.png', rarity: 'rara', renderW: 112, dx: 0, dy: 0, front: true },
    { id: 'robot', nameKey: 'skinRobot', src: 'img/skin-robot.png', rarity: 'rara', renderW: 126, dx: 0, dy: 0, front: true },
    // Épica — NO se compra con monedas: se desbloquea viendo anuncios.
    // El id es el que otorga el servidor en record_ad_watch al llegar a
    // las 100 vistas (ver supabase-ad-tracking.sql); si se cambia aquí,
    // el desbloqueo deja de reconocerse. renderW mayor que el resto
    // porque el recorte incluye alas y cola, no solo la cabeza; 135 es
    // el punto donde el vagon se sigue leyendo como vagon sin que el
    // dragon pierda la silueta que justifica su rareza.
    // unlockAt = vistas de anuncio necesarias. Va POR SKIN (no una
    // constante global) para poder escalonarlas: el Dragón llega
    // pronto y engancha, el Mago sostiene el objetivo a largo plazo.
    // Estos números DEBEN coincidir con los del servidor
    // (record_ad_watch en supabase-ad-tracking.sql), que es quien
    // realmente otorga; aquí solo se pinta el avance.
    { id: 'ads_epica', nameKey: 'skinDragon', src: 'img/skin-dragon.png', rarity: 'epica', unlockBy: 'ads', unlockAt: 100, renderW: 135, dx: 0, dy: 0, front: true },
    { id: 'ads_epica2', nameKey: 'skinMago', src: 'img/skin-mago.png', rarity: 'epica', unlockBy: 'ads', unlockAt: 250, renderW: 140, dx: 0, dy: 0, front: true },
    // Legendaria
    { id: 'gatoreal', nameKey: 'skinGatoreal', src: 'img/skin-gatoreal.png', rarity: 'legendaria', renderW: 118, dx: 6, dy: 0 },
  ];
  // El precio sale de la rareza (sphynx conserva su price: 0).
  LIST.forEach((s) => {
    if (s.rarity && RARITY[s.rarity]) s.price = RARITY[s.rarity].price;
    s.rec = load(s.src);
  });

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

  function setActive(id) {
    if (!LIST.some((s) => s.id === id)) return;
    active = id;
    try {
      localStorage.setItem(KEY_ACTIVE, id);
    } catch (err) {
      // Sin persistencia: la elección vale solo para esta sesión.
    }
  }

  return {
    LIST,
    RARITY,
    ENEMY,
    DEFAULT_ID,
    getActive() { return byId(active); },
    activeId() { return active; },
    setActive,
    isOwned(id) { return owned.includes(id); },
    ownedList() { return owned.slice(); },
    grant(id) {
      if (owned.includes(id) || !LIST.some((s) => s.id === id)) return;
      owned.push(id);
      persistOwned();
    },
    // Reemplaza las skins poseídas y la activa (puede quitar). Solo
    // para el cambio de cuenta en el mismo dispositivo: el progreso
    // local pertenecía a otro usuario y se descarta a favor del de la
    // cuenta que entra.
    replaceOwned(ids, activeId) {
      const valid = (Array.isArray(ids) ? ids : [])
        .filter((id) => LIST.some((s) => s.id === id));
      owned.length = 0;
      owned.push(...valid);
      if (!owned.includes(DEFAULT_ID)) owned.push(DEFAULT_ID);
      persistOwned();
      setActive(owned.includes(activeId) ? activeId : DEFAULT_ID);
    },
  };
})();
