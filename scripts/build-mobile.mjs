// Copia los archivos del juego a www/, la carpeta que Capacitor empaqueta
// dentro de la app nativa. Deja fuera lo que no pertenece al runtime del
// juego (repo, docs, script SQL, servidor de desarrollo).
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

async function main() {
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
