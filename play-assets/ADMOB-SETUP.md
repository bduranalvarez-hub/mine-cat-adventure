# Configurar AdMob para Mine Cat Adventure

Guía para obtener los dos IDs reales que faltan y dejar los anuncios
generando ingresos. Escrita en agosto de 2026.

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
2. *"¿Tu app está publicada en una tienda compatible?"* → **No**.
   Aunque esté en prueba cerrada, ahí todavía no es localizable.
   Podrás enlazarla más adelante sin perder los IDs.
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

1. Formato: **Recompensado** (*Rewarded*). **No** elijas
   intersticial ni banner: el juego solo usa recompensados y son
   siempre opcionales.
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

## Opcional: `app-ads.txt`

Es un archivo que declara quién está autorizado a vender tu inventario
publicitario. No es obligatorio, pero sin él pierdes acceso a parte de
la demanda programática.

El problema en nuestro caso: Google lo busca en la **raíz del dominio**
del sitio web del desarrollador, es decir
`https://bduranalvarez-hub.github.io/app-ads.txt`, no dentro de
`/mine-cat-adventure/`. Como el sitio actual es una *project page* de
GitHub Pages, haría falta crear un repositorio llamado
`bduranalvarez-hub.github.io` para servir la raíz del dominio.

Es un extra que puede esperar. Cuando quieras hacerlo, AdMob te da la
línea exacta a poner en **Apps → Ver todas las apps → app-ads.txt**.
