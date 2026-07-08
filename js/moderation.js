'use strict';

// Filtro basico de apodos para el ranking mundial (contenido publico
// generado por el usuario). No es infalible -no existe un filtro que
// lo sea-, pero cubre el requisito de moderacion razonable de las
// tiendas de apps. Revisa periodicamente la tabla `scores` en
// Supabase para retirar apodos que se cuelen.
const Moderation = (() => {
  // Lista corta e intencionalmente conservadora: palabras claramente
  // ofensivas en español e inglés. Coincide sobre el texto normalizado
  // (sin acentos, minúsculas, sin espacios/símbolos) para dificultar
  // evasiones triviales tipo "p.u.t.o" o "put0".
  const BLOCKLIST = [
    'puta', 'puto', 'mierda', 'pendejo', 'gilipollas', 'cabron', 'zorra',
    'maricon', 'negro de mierda', 'violador', 'nazi', 'hitler',
    'fuck', 'shit', 'bitch', 'asshole', 'nigger', 'faggot', 'rape', 'cunt',
  ];

  function normalize(text) {
    return text
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''); // solo letras/numeros, sin espacios/simbolos
  }

  function isAllowed(name) {
    const norm = normalize(name);
    if (!norm) return false;
    return !BLOCKLIST.some((word) => norm.includes(normalize(word)));
  }

  return { isAllowed };
})();
