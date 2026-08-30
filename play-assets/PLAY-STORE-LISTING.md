# Ficha de Google Play — Mine Cat Adventure

Copia y pega estos textos directamente en Play Console → tu app →
Presencia en la tienda → Ficha principal de la tienda.

> ⚠️ **Actualizado en agosto de 2026 para la versión con anuncios.** La
> versión anterior de este documento afirmaba "Sin publicidad. Sin
> compras dentro de la app", lo cual dejó de ser cierto al integrar
> AdMob. Publicar esa frase con anuncios en la app es una
> tergiversación que Play sanciona, así que **no la reintroduzcas**.

## Nombre de la app (máx. 30 caracteres)

```
Mine Cat Adventure
```

## Descripción breve (máx. 80 caracteres)

```
Runner infinito de vagonetas mineras con gatos sphynx. ¡Salta y sobrevive!
```
(74 caracteres)

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

🐱 Once gatos coleccionables con cuatro niveles de rareza: común,
rara, épica y legendaria. Cada rareza que equipas te da un bonus de
monedas, así que tu gato favorito también acelera tu progreso.

🪙 Gana monedas corriendo y cámbialas en la tienda. Los gatos épicos
—el Dragón y el Mago— se desbloquean viendo anuncios opcionales.

🌍 Ranking mundial: compite por la mejor distancia con jugadores de
todo el mundo, con tabla de posiciones separada por modo. Tu marca es
solo tuya: ninguna ventaja de la tienda te ayuda a llegar más lejos.

☁️ Crea una cuenta para que tus monedas y tus gatos no se pierdan al
cambiar de teléfono. También puedes jugar como invitado, sin registro.

📤 Comparte tu marca: genera una tarjeta con tu distancia, récord y
medalla, y compártela con tus amigos.

🎵 Música chiptune original y efectos de sonido.

📱 Funciona sin conexión una vez instalada.

Los anuncios son siempre opcionales: nunca interrumpen la partida.
Solo aparecen si tú eliges verlos, para volver a la vía tras chocar o
para avanzar hacia un gato épico.

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

## Declaración de anuncios (Play Console → Contenido de la app)

**¿Tu app contiene anuncios?** → **Sí**

Play muestra entonces la etiqueta "Contiene anuncios" en la ficha. Es
obligatorio declararlo: omitirlo con anuncios integrados es motivo de
retirada. Los anuncios de este juego son **recompensados y opcionales**
(el jugador pulsa un botón para verlos); no hay intersticiales ni
banners.

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

### Capturas nuevas (agosto de 2026)

Las cinco `g1`–`g5` son las que hay que subir: 1080x1920, una skin y un
mineral distintos en cada una, con el arte de roca nuevo.

| Archivo | Skin | Profundidad | Mineral |
|---

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
| **Identificadores de publicidad (AAID)** | **Sí** | **Publicidad o marketing** | **Sí: solo si el jugador elige ver un anuncio** |
| **ID del dispositivo u otros identificadores** | **Sí** | **Publicidad o marketing** | **Sí, por el mismo motivo** |

**¿La app comparte datos con terceros?** → **Sí.** Los identificadores
de publicidad se comparten con **Google AdMob** cuando el jugador
decide ver un anuncio recompensado. El resto de datos (apodo,
distancia) no se comparte: Supabase es el proveedor de infraestructura
que aloja la base de datos, no un tercero que los use con fines
propios.

**¿Los datos se cifran en tránsito?** → Sí (HTTPS/TLS)

**¿Los usuarios pueden solicitar que se borren sus datos?** → Sí, desde
la página de eliminación de cuenta del propio juego y escribiendo a
minecatadventure@gmail.com

**Datos NO recopilados** (marcar que NO se recopilan): ubicación,
información de contacto (email/teléfono real), datos financieros,
salud, mensajes, fotos/videos, historial de navegación.

## Permisos que añade el SDK de AdMob

Verificado sobre el manifiesto fusionado del APK de release. El juego
por sí solo solo pedía `INTERNET`; el resto los añade el SDK de
anuncios automáticamente y no hay que declararlos a mano:

```
com.google.android.gms.permission.AD_ID
android.permission.ACCESS_ADSERVICES_AD_ID
android.permission.ACCESS_ADSERVICES_ATTRIBUTION
android.permission.ACCESS_ADSERVICES_TOPICS
android.permission.ACCESS_NETWORK_STATE
android.permission.FOREGROUND_SERVICE
android.permission.WAKE_LOCK
```

Los tres `ACCESS_ADSERVICES_*` son del Privacy Sandbox de Android.
`FOREGROUND_SERVICE` y `WAKE_LOCK` a veces llaman la atención en
revisión: vienen del SDK de anuncios, no de código propio del juego.

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
- **¿La app muestra anuncios? → Sí** (recompensados y opcionales).

Con estas respuestas el resultado esperado sigue siendo **PEGI 3 /
Todos (Everyone)**, con la nota "Interacción entre usuarios no
controlada" por los apodos del ranking. Declarar los anuncios no sube
la clasificación por sí solo.

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

---

# Antes de compilar la versión de producción

- [ ] Sustituir los IDs de PRUEBA de AdMob por los reales:
      `REWARDED_ID` en `js/ads.js` y el `APPLICATION_ID` del
      `AndroidManifest.xml`. Los de prueba no generan ingresos; usar
      los reales durante el desarrollo puede costar la suspensión de
      la cuenta de AdMob por tráfico inválido.
- [ ] Subir `versionCode` en `android/app/build.gradle` (el 4 ya está
      publicado en la prueba cerrada).
- [ ] Declarar "Contiene anuncios" y actualizar Data safety con las
      filas de identificadores de publicidad de arriba.
- [ ] Regenerar las capturas de pantalla.
- [ ] Tras publicar, actualizar `version.json` con el nuevo
      `android.versionCode` y `label`.
