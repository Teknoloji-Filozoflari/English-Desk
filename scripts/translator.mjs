import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.ENGLISH_DESK_PYTHON || join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
let child, pending, sequence = 0, queue = Promise.resolve();
export function translationReady() { return existsSync(python) && existsSync(join(root, '.runtime/argos/packages')); }
function stop(reason) { const active = pending; pending = null; const old = child; child = null; old?.kill(); active?.reject(new Error(reason)); }
function start() {
  if (child) return;
  if (!existsSync(python)) throw new Error('Türkçe çeviri kurulmamış. Proje klasöründeki npm run setup:translation komutunu çalıştır.');
  child = spawn(python, ['-u', join(root, 'scripts/translate_worker.py')], { cwd: root, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
  const worker = child;
  // Drain diagnostics without including texts or local paths in API responses.
  worker.stderr.on('data', () => {});
  worker.on('error', () => { if (child === worker) stop('Çeviri servisi başlatılamadı. npm run setup:translation komutunu çalıştır.'); });
  worker.on('exit', () => { if (child === worker) stop('Çeviri servisi durdu. npm run setup:translation ile kurulumu kontrol et.'); });
  createInterface({ input: worker.stdout }).on('line', line => {
    try { const reply = JSON.parse(line); if (reply.id !== pending?.id) return; const active = pending; pending = null; reply.error ? active.reject(new Error(reply.error)) : active.resolve(reply.translations); } catch { /* Ignore library diagnostics, never treat them as translations. */ }
  });
}
export function translateTexts(texts) {
  const operation = queue.then(() => new Promise((resolve, reject) => {
    try { start(); } catch (error) { reject(error); return; }
    const timer = setTimeout(() => stop('Çeviri zaman aşımına uğradı. Kart korundu; yeniden deneyebilirsin.'), 120000);
    pending = { id: ++sequence, resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } };
    child.stdin.write(JSON.stringify({ id: sequence, texts }) + '\n', error => { if (error) stop('Çeviri servisine ulaşılamadı.'); });
  }));
  queue = operation.catch(() => {}); return operation;
}
process.on('exit', () => child?.kill());

export function stopTranslation() { stop('Uygulama kapatılıyor.'); }
