# Ficha de Google Play — Mine Cat Adventure

Copia y pega estos textos directamente en Play Console → tu app →
Presencia en la tienda → Ficha principal de la tienda.

## Nombre de la app (máx. 30 caracteres)

```
Mine Cat Adventure
```

## Descripción breve (máx. 80 caracteres)

```
Runner infinito de vagonetas mineras con gatos sphynx. ¡Salta y sobrevive!
```
(75 caracteres)

## Descripción completa (máx. 4000 caracteres)

```
🐈 ¡Sube a la vagoneta y agárrate fuerte!

Mine Cat Adventure es un runner infinito de vagonetas mineras
protagonizado por gatos sphynx. Toca la pantalla para saltar, esquiva
los huecos en los rieles, los vagones averiados y a los gatos
gruñones que vienen de frente a toda velocidad. ¿Cuán lejos puedes
llegar?

CARACTERÍSTICAS

⛏️ Pista infinita y procedural con colinas, subidas y bajadas: cada
partida es distinta.

🎮 Control de un toque con salto variable: un toque corto da un
salto corto, mantener presionado da el salto máximo. Precisión total
para esquivar cada obstáculo.

🏔️ Tres modos de dificultad:
• FÁCIL — para aprender los controles
• DIFÍCIL — más velocidad y obstáculos
• HARDCORE ☠️ — el doble de vagones y enemigos, velocidad extrema

🌍 Ranking mundial: compite por la mejor distancia con jugadores de
todo el mundo, con tabla de posiciones separada por modo.

📤 Comparte tu marca: genera una tarjeta con tu distancia, récord y
medalla, y compártela con tus amigos.

🎵 Música chiptune original y efectos de sonido.

📱 Funciona sin conexión una vez instalada.

Sin publicidad. Sin compras dentro de la app. Solo tú, tu gato y la
mina infinita.

¿Te atreves a intentar el modo HARDCORE?
```

## Categoría

```
Juegos → Arcade
```
(alternativa razonable: Juegos → Casual)

## Etiquetas / tags sugeridos

```
runner, infinito, arcade, gato, mina, endless runner, plataformas, un toque
```

## Detalles de contacto

- Correo electrónico: minecatadventure@gmail.com
- Sitio web: https://bduranalvarez-hub.github.io/mine-cat-adventure/
- Política de privacidad (URL obligatoria):
  https://bduranalvarez-hub.github.io/mine-cat-adventure/privacy.html

## Recursos gráficos (ya generados en esta carpeta)

| Recurso | Archivo | Medidas |
|---|---|---|
| Ícono de la ficha (32-bit PNG) | `store-icon-512.png` | 512×512 |
| Gráfico de funciones (banner) | `feature-graphic-1024x500.png` | 1024×500 |
| Capturas de teléfono (5) | `screenshots-phone/*.png` | 1080×1920 (2160×3840) |

Sube las 5 capturas en el orden 01→05 (menú, gameplay fácil, gameplay
hardcore, ranking, resultado). Play exige mínimo 2; con 5 ya se
cumple sobradamente.

---

# Formulario "Seguridad de los datos" (Data safety)

Play Console → Presencia en la tienda → Seguridad de los datos. Estas
son las respuestas correctas según lo que la app realmente hace (ver
`privacy.html` para el detalle completo).

**¿Tu app recopila o comparte alguno de los tipos de datos de
usuario requeridos?** → Sí

**Datos recopilados y para qué:**

| Tipo de dato | ¿Se recopila? | Finalidad | ¿Es opcional? |
|---|---|---|---|
| Nombre (apodo elegido por el usuario) | Sí | Funcionalidad de la app (ranking) | Sí, el jugador lo elige libremente |
| Otros datos de la app (distancia recorrida, modo de juego) | Sí | Funcionalidad de la app (ranking) | No, se genera al jugar |

**¿Los datos se cifran en tránsito?** → Sí (HTTPS/TLS, vía Supabase)

**¿Los usuarios pueden solicitar que se borren sus datos?** → Sí,
escribiendo a minecatadventure@gmail.com

**Datos NO recopilados** (marcar que NO se recopilan): ubicación,
información de contacto (email/teléfono real), datos financieros,
salud, mensajes, fotos/videos, información del dispositivo con fines
publicitarios, historial de navegación, identificadores de
publicidad.

**¿La app comparte datos con terceros?** → No (Supabase es el
proveedor de infraestructura que aloja la base de datos, no un
tercero con el que se "comparten" datos con fines propios; se
declara igualmente en la política de privacidad).

---

# Clasificación de contenido (Content rating / IARC)

Al completar el cuestionario IARC en Play Console, las respuestas
correctas para Mine Cat Adventure son:

- Violencia: Ninguna (los "choques" son estilizados, sin sangre ni
  violencia realista; el personaje es un gato en una vagoneta).
- Contenido sexual: Ninguno.
- Lenguaje soez: Ninguno.
- Sustancias controladas: Ninguna.
- Juego de azar simulado: Ninguno.
- Interacción entre usuarios: **Sí** — el ranking mundial muestra
  apodos elegidos por otros jugadores (contenido generado por
  usuarios, texto libre).
- Compartir ubicación: No.
- Compras digitales: No.

Con estas respuestas el resultado esperado es **PEGI 3 / Todos
(Everyone)**, posiblemente con la nota "Interacción entre usuarios
no controlada" por los apodos del ranking.

⚠️ Nota sobre el ranking mundial y contenido generado por usuarios:
Google exige que las apps con contenido generado por usuarios (aquí,
apodos libres) tengan una forma de reportar/moderar contenido
ofensivo. Ya se implementaron dos mitigaciones:
1. **Filtro de apodos** (`js/moderation.js`): bloquea al elegir el
   apodo una lista de palabras ofensivas en español e inglés
   (verificado con casos de prueba). No es infalible —ningún filtro
   lo es—, pero cubre el requisito de "esfuerzo razonable".
2. **Moderación manual de respaldo**: cualquier apodo que se cuele
   puede borrarse desde Supabase (SQL Editor →
   `delete from public.scores where name = '...'`), y los usuarios
   pueden reportarlos a minecatadventure@gmail.com (ya declarado en
   `privacy.html`).
