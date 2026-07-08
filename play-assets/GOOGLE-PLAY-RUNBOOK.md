# Guía de publicación en Google Play — Mine Cat Adventure

Todo lo que se podía preparar sin tu intervención ya está hecho y
verificado (ver resumen al final). Esta guía cubre los pasos que
quedan, que requieren tu cuenta o tu propia máquina.

⚠️ **Por qué no compilé el APK/AAB yo mismo:** el entorno donde corro
mis herramientas es un sandbox de Windows que bloquea un socket
interno que Gradle necesita (error documentado:
`WEPollSelectorImpl loopback error`, el mismo bug que afecta a Claude
Code en Windows — no es un problema de tu proyecto). En tu propia
máquina, sin esa restricción, `gradlew.bat assembleDebug` debería
funcionar sin tocar nada.

## 0. Verificar que el proyecto compila en tu máquina

Abre una terminal normal (no la de este asistente) en la carpeta del
proyecto:

```powershell
cd "C:\Users\ASUS ROG STRIX\OneDrive\Escritorio\mine cart carnage"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat assembleDebug
```

Si termina con `BUILD SUCCESSFUL`, todo el empaquetado está bien y
puedes seguir. Si falla, dime el error exacto y lo resolvemos.

También puedes simplemente abrir la carpeta `android/` con Android
Studio (`File → Open`) y darle "Run" — es lo más simple si prefieres
no usar la terminal.

## 1. Crear la cuenta de Google Play Developer

- Entra a https://play.google.com/console/signup
- Costo: **USD $25, pago único** (de por vida, no es anual)
- Verificación de identidad: Google puede pedir tu cédula/pasaporte,
  puede tardar hasta 48 horas

## 2. Guardar el keystore de forma segura — MUY IMPORTANTE

Ya generé el keystore de firma en:
```
keystore\mine-cat-adventure-release.jks
keystore\CREDENCIALES-NO-SUBIR-A-GIT.txt   (contiene la contraseña)
```

**Antes de seguir:**
1. Copia toda la carpeta `keystore\` a un lugar seguro FUERA de este
   proyecto (un gestor de contraseñas, un disco externo, una nube
   privada). Si pierdes este archivo o la contraseña, **nunca más**
   podrás publicar una actualización de la app — tendrías que crear
   una app nueva en Play Console desde cero.
2. Confirma que `keystore\` y `android\keystore.properties` NO estén
   en git (ya están en `.gitignore`, pero verifica con
   `git status` que no aparezcan).

## 3. Generar el AAB firmado (el archivo que subes a Play)

```powershell
cd "C:\Users\ASUS ROG STRIX\OneDrive\Escritorio\mine cart carnage"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npm run android:build-release
```

Esto genera:
```
android\app\build\outputs\bundle\release\app-release.aab
```

Ese es el archivo que subes a Play Console. Ya está firmado con tu
keystore (configurado en `android/app/build.gradle` +
`android/keystore.properties`).

## 4. Crear la app en Play Console

1. Play Console → **Crear app**
2. Nombre: `Mine Cat Adventure`
3. Idioma predeterminado: Español (todo el juego está en español)
4. Tipo: Juego → Gratis

## 5. Completar la ficha de la tienda

Todos los textos ya redactados y los recursos gráficos generados
están en `play-assets/`:

- `PLAY-STORE-LISTING.md` → copia y pega título, descripciones,
  categoría
- `store-icon-512.png` → ícono de la ficha
- `feature-graphic-1024x500.png` → gráfico de funciones
- `screenshots-phone/01-menu.png` a `05-resultado.png` → capturas

## 6. Formulario de seguridad de datos y clasificación de contenido

Están completos en `PLAY-STORE-LISTING.md`, sección "Seguridad de
los datos" y "Clasificación de contenido". Cópialos tal cual al
cuestionario de Play Console.

⚠️ Antes de publicar, **revisa la nota sobre contenido generado por
usuarios** al final de ese documento (apodos del ranking) — ya
agregué un filtro básico en el código (`js/moderation.js`), pero
igual léela.

## 7. Política de privacidad

Ya está publicada y en vivo:
```
https://bduranalvarez-hub.github.io/mine-cat-adventure/privacy.html
```
Pégala en el campo "URL de la política de privacidad".

## 8. Subir el AAB y completar el lanzamiento

1. Producción → Crear nueva versión
2. Sube `app-release.aab`
3. Notas de la versión (puedes usar): *"Primera versión de Mine Cat
   Adventure: runner infinito de vagonetas mineras con gatos sphynx,
   3 modos de dificultad y ranking mundial."*

⚠️ **Cuentas nuevas de Google Play Developer suelen requerir una
prueba cerrada** (closed testing) con al menos 12 testers durante 14
días antes de poder publicar en producción. Si Play Console te pide
esto, usa la pista de "Prueba cerrada", invita a algunos amigos por
correo o con el link de opt-in, y espera el período — es un
requisito de la cuenta, no de la app.

## 9. Después de publicar

- Guarda el AAB y el `mapping` (si алgún día activas minificación)
  de cada versión.
- Para publicar actualizaciones futuras: sube el código, corre
  `npm run android:build-release` de nuevo (sube antes `versionCode`
  y `versionName` en `android/app/build.gradle`), y sube el nuevo AAB.

---

## Resumen de lo que ya está listo (verificado en esta sesión)

- ✅ Proyecto Capacitor + Android generado y estructuralmente
  correcto (`android/`)
- ✅ `targetSdkVersion`/`compileSdkVersion` en 36 (cumple el
  requisito de Google Play vigente desde agosto de 2026)
- ✅ Orientación bloqueada a vertical
- ✅ Iconos adaptativos + splash (claro y oscuro) generados y
  aplicados a todas las densidades (123 archivos)
- ✅ Keystore de firma generado (RSA 2048, validez 30 años) y
  conectado a Gradle vía `keystore.properties` (fuera de git)
- ✅ `.gitignore` verificado: ningún secreto, `node_modules/`, `www/`
  ni artefactos de build se suben al repositorio
- ✅ 5 capturas de pantalla (1080×1920), ícono de tienda, gráfico de
  funciones — todo generado con el propio motor del juego
- ✅ Textos completos de la ficha, formulario de seguridad de datos y
  clasificación de contenido listos para copiar/pegar
- ✅ Filtro básico de apodos ofensivos para el ranking (mitiga el
  requisito de moderación de contenido de usuario)
- ✅ Política de privacidad actualizada y en vivo

## Lo único que falta y requiere tu maquina/cuenta

- ⏳ Compilar (`gradlew.bat assembleDebug`/`bundleRelease`) — el
  sandbox de este asistente no puede, tu máquina sí debería poder
- ⏳ Cuenta de Google Play Developer ($25, verificación de identidad)
- ⏳ Subir el AAB y completar el proceso de revisión de Google
