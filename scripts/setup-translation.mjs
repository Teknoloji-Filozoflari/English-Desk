import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = join(root, '.runtime');
const env = { ...process.env, UV_PYTHON_INSTALL_DIR: join(runtime, 'python'), UV_CACHE_DIR: join(runtime, 'uv-cache'), PYTHONIOENCODING: 'utf-8' };
function run(command, args) {
  return new Promise((resolve, reject) => { const child = spawn(command, args, { cwd: root, env, windowsHide: true, stdio: 'inherit' }); child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Kurulum adımı başarısız (${code}).`))); });
}
async function download(url, destination, expected) {
  let content;
  if (existsSync(destination)) content = await readFile(destination);
  if (!content || createHash('sha256').update(content).digest('hex') !== expected) {
    const response = await fetch(url, { signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw new Error(`İndirme hatası: ${response.status}`);
    content = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(content).digest('hex') !== expected) throw new Error('İndirme bütünlük kontrolü başarısız.');
    await writeFile(destination, content);
  }
}
try {
  if (!['win32', 'linux'].includes(process.platform) || process.arch !== 'x64') throw new Error('Otomatik kurucu Windows x64 ve Linux x64 içindir.');
  await mkdir(runtime, { recursive: true });
  console.log('Python ve yerel çeviri kuruluyor. İlk kurulum birkaç yüz MB indirebilir.');
  const windows = process.platform === 'win32';
  const asset = windows ? 'uv-x86_64-pc-windows-msvc.zip' : 'uv-x86_64-unknown-linux-gnu.tar.gz';
  const base = 'https://github.com/astral-sh/uv/releases/download/0.12.18/';
  const archive = join(runtime, asset);
  const uv = join(runtime, windows ? 'uv/uv.exe' : 'uv/uv-x86_64-unknown-linux-gnu/uv');
  if (!existsSync(uv)) {
    let checksum = 'cae6a3bc25239f83dffb467a4b180508d9da23986c04639ebfa44e43e6a84bff';
    if (!windows) {
      const response = await fetch(base + asset + '.sha256', { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('uv checksum indirilemedi: ' + response.status);
      checksum = (await response.text()).trim().split(/\s+/)[0];
      if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error('Geçersiz uv checksum');
    }
    await download(base + asset, archive, checksum);
    await mkdir(join(runtime, 'uv'), { recursive: true });
    if (windows) await run('powershell.exe', ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath .runtime/uv-x86_64-pc-windows-msvc.zip -DestinationPath .runtime/uv -Force']);
    else await run('tar', ['-xzf', archive, '-C', join(runtime, 'uv')]);
  }
  const python = join(root, windows ? '.venv/Scripts/python.exe' : '.venv/bin/python');
  if (!existsSync(python)) await run(uv, ['--system-certs', 'venv', '.venv', '--python', '3.11', '--managed-python']);
  await run(uv, ['--system-certs', 'pip', 'install', '--python', python, '-r', 'scripts/translation-requirements.txt']);
  const model = join(runtime, 'translate-en_tr.argosmodel');
  await download('https://argos-net.com/v1/translate-en_tr-1_5.argosmodel', model, '2d553a00880a0c21dea5b1c375535659e6bf18c9bf2ce9847c2a2fd2ff50316a');
  await run(python, ['scripts/translate_worker.py', '--install', model]);
  console.log('Çevrimdışı çeviri kontrol ediliyor…');
  await run(python, ['scripts/translate_worker.py', '--check']);
  await writeFile(join(runtime, 'translation-ready.json'), JSON.stringify({ platform: process.platform, arch: process.arch, requirements: createHash('sha256').update(await readFile(join(root, 'scripts/translation-requirements.txt'))).digest('hex') }));
  console.log(`Kurulum tamamlandı. ${windows ? 'Baslat.cmd' : 'sh Baslat.sh'} ile uygulamayı aç, Kelimelerim > Eksikleri tamamla düğmesine bas.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
