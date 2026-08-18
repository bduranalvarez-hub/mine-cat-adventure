// Copia los archivos del juego a www/, la carpeta que Capacitor empaqueta
// dentro de la app nativa. Deja fuera lo que no pertenece al runtime del
// juego (repo, docs, script SQL, servidor de desarrollo).
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const wwwDir = path.join(root, 'www');

const ITEMS = [
  'index.html',
  'privacy.html',
  'delete-account.html',
  'manifest.json',
  'sw.js',
  'css',
  'js',
  'icons',
  'img',
];

// El aviso de "hay version nueva" compara el versionCode de ESTE build
// (js/version.js) contra el publicado (version.json). Si js/version.js
// se queda atras respecto a build.gradle, el aviso se vuelve mentira:
// o le insiste a quien ya esta al dia, o no avisa nunca. Como el
// desajuste es SILENCIOSO, se corta el build aqui.
function checkVersionSync() {
  const gradle = readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
  const version = readFileSync(path.join(root, 'js/version.js'), 'utf8');
  const gradleCode = /versionCode\s+(\d+)/.exec(gradle);
  const localCode = /androidVersionCode:\s*(\d+)/.exec(version);
  if (!gradleCode || !localCode) {
    throw new Error(
      'No pude leer el versionCode de android/app/build.gradle o de js/version.js.'
    );
  }
  if (gradleCode[1] !== localCode[1]) {
    throw new Error(
      `versionCode desincronizado: build.gradle=${gradleCode[1]} pero ` +
      `js/version.js androidVersionCode=${localCode[1]}. ` +
      'Ajusta js/version.js (y version.json al publicar en Play).'
    );
  }
  console.log(`versionCode ${gradleCode[1]} sincronizado.`);
}

async function main() {
  checkVersionSync();

  if (existsSync(wwwDir)) {
    await rm(wwwDir, { recursive: true, force: true });
  }
  await mkdir(wwwDir, { recursive: true });

  for (const item of ITEMS) {
    const src = path.join(root, item);
    if (!existsSync(src)) {
      console.warn(`(omitido, no existe) ${item}`);
      continue;
    }
    await cp(src, path.join(wwwDir, item), { recursive: true });
  }

  console.log(`www/ listo con ${ITEMS.length} elementos copiados.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
