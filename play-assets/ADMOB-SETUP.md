# Configurar AdMob para Mine Cat Adventure

> ## Estado al 2026-09-09 — LOS PASOS 1 A 5 YA ESTÁN HECHOS
>
> - Cuenta de AdMob creada y app registrada (2026-08-25).
> - Bloque **bonificado** creado; los IDs reales ya están en `js/ads.js`
>   y en `AndroidManifest.xml`, y verificados dentro del AAB.
> - Juego **publicado en producción** el 2026-08-30 (versionCode 5 / 1.3).
> - App **enlazada con Google Play** en AdMob el 2026-09-09.
> - `app-ads.txt` publicado y verificado (ver el final del documento).
>
> Queda solo esperar la **revisión de preparación** de AdMob, que es
> automática. Lo que sigue se conserva como referencia de cómo se hizo
> y para la próxima app; algunas frases describen el estado de agosto
> (p. ej. "está hoy en prueba cerrada") y ya no son actuales.

Guía para obtener los dos IDs reales y dejar los anuncios generando
ingresos. Escrita en agosto de 2026.

Datos que vas a necesitar a mano:

| Dato | Valor |
|---|---|
| Nombre de la app | Mine Cat Adventure |
| Nombre del paquete | `com.minecatadventure.app` |
| Plataforma | Android (no hay versión de iOS) |
| Tienda | Google Play |

---

## Antes de empezar: el orden importa

AdMob da **publicación limitada de anuncios** a las apps que no están
listadas y enlazadas a una tienda soportada. Mine Cat Adventure está
hoy en **prueba cerrada**, no en producción, y las apps de prueba
cerrada no aparecen en el buscador de AdMob.

Por eso el orden correcto es:

1. Crear la cuenta de AdMob y registrar la app como **no publicada**.
2. Crear el bloque de anuncios recompensado y copiar los dos IDs.
3. Compilar con los IDs reales y publicar en producción.
4. **Volver a AdMob y enlazar la app con Google Play**, ahora que ya
   está listada públicamente.
5. Esperar la *revisión de preparación* (app readiness review) que
   Google hace a toda app nueva.

Hasta el paso 4 los anuncios se muestran pero con inventario reducido y
prácticamente sin ingresos. Es normal y no significa que esté mal
configurado.

---

## Paso 1 — Crear la cuenta

Ve a **https://admob.google.com** e inicia sesión.

**Con qué cuenta de Google:** conviene usar la misma con la que
gestionas Play Console, para no acabar con dos identidades separadas.
Si prefieres separar el proyecto de tu cuenta personal, usa
`minecatadventure@gmail.com`, que ya es el correo de contacto de la
ficha — pero decídelo ahora, porque **una cuenta de AdMob no se puede
transferir a otro correo después**.

En el alta te va a pedir:

- País de residencia fiscal y zona horaria (**no se pueden cambiar
  después**).
- Verificación por teléfono (SMS).
- Aceptar los términos.
- Datos de pago: dirección postal real, información fiscal y método de
  cobro.

> Esta parte la tienes que completar tú personalmente: son tus datos
> fiscales y bancarios. Yo no los introduzco.

Ten en cuenta que Google no paga hasta acumular el **umbral de 100 USD**
(o el equivalente en tu moneda), y que la verificación de dirección por
carta postal puede tardar semanas. Nada de esto bloquea que los
anuncios funcionen: solo bloquea el cobro.

---

## Paso 2 — Registrar la app

En la barra lateral: **Apps → Añadir app** (*Add app*).

1. Plataforma: **Android**.
2. *"¿La aplicación está publicada en alguna tienda admitida?"*
   **Prueba primero "Sí"** y busca `com.minecatadventure.app`:
   - **Si aparece**, selecciónala. Es lo mejor: arranca la revisión de
     preparación desde ya y evita la publicación limitada.
   - **Si no aparece** (lo esperable mientras solo esté en prueba
     cerrada, porque el buscador de AdMob usa el catálogo público de
     Play), vuelve atrás y marca **No**. Podrás enlazarla más adelante
     **sin perder los IDs**.
3. Nombre de la app: `Mine Cat Adventure`.
4. Métricas de usuario: opcional, puedes dejarlo desactivado.

Al terminar te da el **ID de la aplicación**, con este formato:

```
ca-app-pub-0000000000000000~0000000000
```

Fíjate en la **virgulilla `~`**: es lo que distingue el ID de la app del
ID de un bloque de anuncios.

---

## Paso 3 — Crear el bloque recompensado

Con la app seleccionada: **Bloques de anuncios → Añadir bloque de
anuncios** (*Ad units → Add ad unit*).

1. Formato: **Bonificado**. Así es como la interfaz en español
   traduce *Rewarded*.

   > ⚠️ **No lo confundas con "Intersticial bonificado"**, que es la
   > tarjeta de al lado y es un formato distinto: aparece solo en las
   > pausas, sin que el usuario elija. El bonificado a secas es el que
   > "permite a los usuarios elegir si quieren verlos", que es nuestro
   > caso. Además el código llama a `prepareRewardVideoAd` y
   > `showRewardVideoAd`, que son las API del bonificado: con un ID de
   > intersticial bonificado los anuncios no cargarían.

   Tampoco elijas banner, nativo ni carga de aplicación: el juego no
   los usa.
2. Nombre del bloque: algo reconocible, por ejemplo
   `mca-recompensado`.
3. Recompensa: te pedirá un *tipo* y una *cantidad* (por ejemplo,
   `revivir` y `1`).

> La recompensa que pongas aquí **es solo etiqueta**: el juego la
> ignora. Quien decide de verdad qué se otorga es nuestro servidor
> (`record_ad_watch`), precisamente para que un APK modificado no pueda
> mentir. Pon cualquier valor coherente y sigue.

Al terminar te da el **ID del bloque**, con este formato:

```
ca-app-pub-0000000000000000/0000000000
```

Aquí el separador es una **barra `/`**.

---

## Paso 4 — Pásame los dos IDs

Con eso yo hago el resto:

- Sustituyo `REWARDED_ID` en `js/ads.js`.
- Sustituyo el `APPLICATION_ID` en
  `android/app/src/main/AndroidManifest.xml`.
- Subo el `versionCode` y compilo el AAB de producción.

**No pruebes la app con los IDs reales en tu propio teléfono.** Pulsar
tus propios anuncios, aunque sea sin querer, cuenta como *tráfico
inválido* y Google suspende cuentas de AdMob por eso. Para probar en tu
dispositivo usa el APK con IDs de prueba que ya te pasé, o registra tu
teléfono como dispositivo de prueba en AdMob.

---

## Paso 5 — Después de publicar en producción

1. En AdMob: **Apps → Mine Cat Adventure → Configuración de la app →
   Enlazar con la tienda** y busca `com.minecatadventure.app`.
2. Espera la revisión de preparación. Suele tardar unos días.
3. Comprueba en el panel de AdMob que empiezan a contarse
   impresiones. Si a las 48 h siguen en cero con la app ya pública,
   algo está mal enlazado.

---

## `app-ads.txt` — RESUELTO (2026-09-09)

Al enlazar la app, AdMob intentó verificarla y falló: buscaba
`app-ads.txt` en la **raíz del dominio** del sitio del desarrollador
(`https://bduranalvarez-hub.github.io/app-ads.txt`) y ahí no había nada,
porque el juego se sirve desde una *project page* en
`/mine-cat-adventure/`.

**Ojo:** ese fallo NO impide el enlace. AdMob confirmó que la
información de las tiendas se actualizó correctamente; lo único que
quedó sin verificar fue el archivo, que es opcional.

La solución fue crear un repositorio llamado exactamente
`bduranalvarez-hub.github.io` (GitHub solo sirve la raíz del dominio
desde un repo con el nombre del dominio), con Pages apuntando a `main`
/ `(root)` y un único archivo `app-ads.txt`:

```
google.com, pub-6167652699679734, DIRECT, f08c47fec0942fa0
```

El `pub-` coincide con el ID de editor de los IDs de AdMob del juego.
Crear ese repo NO afecta al sitio del juego: las project pages
conservan su ruta aunque exista una user page.

Verificado servido: HTTP 200, `text/plain; charset=utf-8`, 59 bytes,
final de línea LF y sin BOM. Un BOM o un CRLF son las dos causas
habituales de que Google rastree el archivo y aun así lo invalide.
