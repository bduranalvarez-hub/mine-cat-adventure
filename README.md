# Mine Cat Adventure 🐈🛒

Runner infinito para móviles de vagonetas mineras, protagonizado por
gatos sphynx. Toca la pantalla para saltar, esquiva los huecos en los
rieles y a los gatos gruñones, y llega lo más lejos que puedas. La
distancia recorrida es tu puntuación y el récord se guarda en el
dispositivo.

## Cómo jugar

- Al entrar eliges tu **nombre de minero** (se guarda en el dispositivo).
- Elige dificultad en el menú: **FÁCIL**, **🔥 DIFÍCIL** o
  **☠️ HARDCORE** (el doble de vagones y carros que Difícil, velocidad
  extrema, colinas salvajes y rieles cortísimos de 300-600 unidades:
  casi todo es salto; la cámara se aleja para que puedas ver lo que
  viene). Cada modo guarda su propio récord.
- **🏆 RANKING**: tabla de mejores marcas por modo (mejor marca de
  cada jugador), mundial vía Supabase (`js/remote.js`), con respaldo
  local si no hay conexión.
- **Música** chiptune generada por código (WebAudio), más rápida
  cuanto más difícil el modo. Se puede silenciar desde el menú.
- **📤 COMPARTIR**: al morir, genera una tarjeta-imagen con tu marca,
  medalla y modo, y la comparte por el menú nativo del móvil (WhatsApp,
  Instagram, etc.). En escritorio descarga la imagen y copia el texto.
- **La mina cambia de mineral** al alcanzar cada medalla: bronce a los
  100 m, plata a los 300, oro a los 700 y platino a los 1500. La roca
  se recolorea con un fundido y, desde la plata, aparecen destellos que
  titilan (cada vez más, hasta el platino). Los umbrales viven en
  `CONFIG.MEDAL_METERS` y los comparten el fondo y la tarjeta.
- **Tocar la pantalla** (o `Espacio` / `↑` en PC): saltar.
- La pista sube y baja como una montaña rusa: cuesta abajo la vagoneta
  acelera y cuesta arriba se frena. Además los tramos están **a
  desnivel**: el siguiente riel puede estar en un saliente más bajo
  (caída libre) o más alto (salto exigente).
- Tres peligros terminan la partida:
  - **Huecos** en los rieles (caes al pozo).
  - **Vagones averiados** volcados sobre la vía (se saltan). Tocar su
    mitad superior rebota como un trampolín; solo el choque frontal
    a ras de riel es letal.
  - **Vagonetas enemigas que vienen de frente** a toda velocidad; si
    llegan a un hueco antes que tú, se caen ellas solas al pozo.
- La velocidad aumenta poco a poco: cuanto más lejos, más difícil.

## Ejecutar en local

Es una web app estática, solo necesita un servidor HTTP:

```bash
python server.py
# luego abre http://localhost:8321
```

(`server.py` es `http.server` sin caché, para que siempre cargue la
última versión mientras desarrollas.)

## Jugar en el teléfono

1. Arranca el servidor en tu PC (comando de arriba).
2. Averigua la IP local de tu PC (`ipconfig` → IPv4, p. ej. `192.168.1.50`).
3. En el teléfono (misma red WiFi) abre `http://192.168.1.50:8321`.
4. Opcional: "Añadir a pantalla de inicio" para jugar a pantalla completa.

El juego ya está publicado en:
https://bduranalvarez-hub.github.io/mine-cat-adventure/

## Publicación

- **Web (GitHub Pages)**: ya en vivo, se actualiza con cada `git push`
  a `main`.
- **Google Play**: el proyecto Android (Capacitor) está listo en
  `android/`. Ver `play-assets/GOOGLE-PLAY-RUNBOOK.md` para los pasos
  de compilación, firma y publicación, y `play-assets/PLAY-STORE-LISTING.md`
  para los textos de la ficha ya redactados.
- **App Store (iOS)**: pendiente, requiere una Mac con Xcode.

```bash
npm install              # instala Capacitor
npm run cap:sync         # copia el juego a www/ y sincroniza con android/
npm run android:open     # abre el proyecto en Android Studio
```

## Estructura

```
index.html            Página y overlays (login, menú, ranking, HUD, game over)
privacy.html           Política de privacidad
manifest.json           Manifiesto PWA
sw.js                    Service worker (juego offline)
css/style.css           Estilos de la interfaz
server.py               Servidor de desarrollo sin caché
js/config.js            Constantes de juego (física, generación)
js/modes.js              Modos de dificultad (FÁCIL / DIFÍCIL / HARDCORE)
js/music.js              Música de fondo chiptune (WebAudio, sin archivos)
js/remote.js             Ranking mundial vía Supabase (API REST)
js/moderation.js         Filtro de apodos ofensivos
js/leaderboard.js        Jugador y ranking (local + mundial)
js/share.js              Tarjeta-imagen para compartir puntuación
js/audio.js              Efectos de sonido con WebAudio (sin archivos)
js/input.js              Entrada táctil, ratón y teclado
js/sprites.js            Dibujo vectorial de gatos y vagonetas
js/background.js         Fondo de mina con parallax, polvo y mineral por medalla
js/track.js              Generación infinita de rieles y huecos
js/obstacles.js          Vagonetas enemigas (aparición y colisiones)
js/player.js             Física del jugador (salto, gravedad, aterrizaje)
js/game.js               Bucle principal, estados, puntuación y HUD
js/main.js               Arranque y bucle de animación
supabase-setup.sql      Script SQL del ranking mundial
package.json             Dependencias de Capacitor
capacitor.config.json   Configuración de la app nativa
scripts/build-mobile.mjs Copia el juego a www/ para empaquetar
resources/               Fuentes de icono/splash para @capacitor/assets
android/                 Proyecto nativo Android (generado)
play-assets/             Metadata y capturas para la ficha de Play Store
```

## Ajustar la dificultad

Los valores por modo (velocidad, huecos, rocas, carros de frente)
están en `js/modes.js`; los compartidos, en `js/config.js`:

- `modes.js` → `baseSpeed` / `maxSpeed` / `speedRamp`: velocidad.
- `modes.js` → `gapMax*`: tamaño de los huecos.
- `modes.js` → `heightRange` / `maxSlope`: intensidad de las colinas.
- `modes.js` → `wreckSpacingFactor`: frecuencia de vagones averiados.
- `modes.js` → `oncoming.*`: vagonetas de frente.
- `track.js` → `MAX_RISE` / `MAX_DROP`: desniveles entre tramos.
- `config.js` → `SLOPE_BOOST`: aceleración cuesta abajo.
- `config.js` → `JUMP_VELOCITY` / `GRAVITY`: sensación del salto.
