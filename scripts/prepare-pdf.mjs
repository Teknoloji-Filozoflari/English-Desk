import { mkdir, copyFile, cp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const output = new URL('../public/pdf/', import.meta.url);
await mkdir(output, { recursive: true });
await Promise.all([
  copyFile(new URL('legacy/build/pdf.mjs', source), new URL('pdf.js', output)),
  copyFile(new URL('legacy/build/pdf.worker.mjs', source), new URL('pdf.worker.js', output)),
  copyFile(new URL('LICENSE', source), new URL('LICENSE.txt', output)),
  cp(fileURLToPath(new URL('cmaps/', source)), fileURLToPath(new URL('cmaps/', output)), { recursive: true }),
  cp(fileURLToPath(new URL('standard_fonts/', source)), fileURLToPath(new URL('standard_fonts/', output)), { recursive: true }),
]);
await writeFile(new URL('loader.js', output), `import * as pdfjs from './pdf.js';\npdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.js', import.meta.url).href;\nwindow.EnglishDeskPdf = pdfjs;\n`);
console.log('Yerel PDF okuyucu dosyalari hazir.');
