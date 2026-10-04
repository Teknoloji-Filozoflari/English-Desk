#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
version=24.21.0
platform=node-v${version}-linux-x64
bundled=".runtime/node/${platform}/bin/node"
if command -v node >/dev/null 2>&1 && [ "$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)" -ge 24 ] 2>/dev/null; then
  exec node --use-system-ca scripts/start.mjs
fi
if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  echo 'Otomatik Node.js kurulumu Linux x64 içindir. Bu sistemde Node.js 24+ kurup yeniden başlat.'
  exit 1
fi
if [ ! -x "$bundled" ]; then
  for tool in curl sha256sum tar mktemp; do
    if ! command -v "$tool" >/dev/null 2>&1; then echo "$tool gerekli; kurup yeniden başlat."; exit 1; fi
  done
  mkdir -p .runtime/node
  temporary=$(mktemp -d .runtime/node-install.XXXXXX)
  trap 'rm -rf "$temporary"' EXIT HUP INT TERM
  base="https://nodejs.org/dist/v${version}"
  archive="${platform}.tar.xz"
  echo 'Node.js 24 ilk kullanım için indiriliyor ve doğrulanıyor…'
  curl --fail --location --retry 2 --silent --show-error "$base/SHASUMS256.txt" -o "$temporary/SHASUMS256.txt"
  curl --fail --location --retry 2 --silent --show-error "$base/$archive" -o "$temporary/$archive"
  expected=$(awk -v file="$archive" '$2 == file { print $1 }' "$temporary/SHASUMS256.txt")
  if [ -z "$expected" ]; then echo 'Node.js doğrulama değeri bulunamadı.'; exit 1; fi
  printf '%s  %s\n' "$expected" "$temporary/$archive" | sha256sum --check --status
  tar -xJf "$temporary/$archive" -C .runtime/node
  rm -rf "$temporary"
  trap - EXIT HUP INT TERM
fi
PATH="$(pwd)/.runtime/node/${platform}/bin:$PATH"
export PATH
exec "$bundled" --use-system-ca scripts/start.mjs
