#!/bin/bash
set -e

load_env_file() {
  local env_path="$1"
  if [ -f "$env_path" ]; then
    echo "→ Ładowanie env z $env_path"
    set -a
    # shellcheck disable=SC1090
    . "$env_path"
    set +a
    return 0
  fi
  return 1
}

warn_if_missing_env() {
  local var_name="$1"
  if [ -z "${!var_name}" ]; then
    echo "⚠ Brak zmiennej: $var_name"
  fi
}

# Chromium z Puppeteera na minimalnym Ubuntu nie startuje bez libnss3 itd. (błąd w pm2: libnss3.so).
install_chromium_pdf_deps() {
  if [ "${SKIP_APT_PDF_DEPS:-}" = "1" ]; then
    echo '→ Pominięto apt PDF (SKIP_APT_PDF_DEPS=1)'
    return 0
  fi
  if ! command -v apt-get >/dev/null 2>&1; then
    return 0
  fi
  if [ "$(id -u)" != "0" ]; then
    echo '⚠ Nie jesteś rootem — pomijam apt dla PDF. Na serwerze: apt-get install -y libnss3 (patrz deploy.sh / pptr.dev/troubleshooting).'
    return 0
  fi
  local sound_pkg=libasound2
  if apt-cache show libasound2t64 >/dev/null 2>&1; then
    sound_pkg=libasound2t64
  fi
  echo '→ Zależności systemowe Chromium (Puppeteer / eksport PDF)...'
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    wget \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    "${sound_pkg}" \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcursor1 \
    libxi6 \
    libxtst6 \
    libxext6 \
    libxrender1 \
    libfontconfig1 \
    libstdc++6 \
    libdbus-1-3
}

echo '→ Instalacja zależności...'
npm install --include=dev
install_chromium_pdf_deps
echo '→ Build shared-types...'
(cd packages/shared-types && npm run build)
echo '→ Build frontend...'
(cd apps/web && npm run build)
echo '→ Build backend...'
(cd apps/api && npm run build)
echo '→ Prisma migrations...'
cd apps/api
if [ ! -f .env ] && [ ! -f ../../.env ]; then
  echo ''
  echo 'BŁĄD: Brak pliku ze zmiennymi środowiskowymi.'
  echo 'Utwórz /var/www/lamaapp/apps/api/.env (albo /var/www/lamaapp/.env) z poprawnym'
  echo 'DATABASE_URL=postgresql://użytkownik:hasło@localhost:5432/nazwa_bazy'
  echo 'Bez znaku … (wielokropka) — tylko prawdziwy host, np. localhost.'
  echo 'Wzorzec: apps/api/.env.example w repozytorium.'
  echo ''
  exit 1
fi
load_env_file .env || load_env_file ../../.env || true
echo '→ Weryfikacja kluczowych zmiennych środowiskowych...'
warn_if_missing_env DATABASE_URL
warn_if_missing_env OPENROUTER_API_KEY
warn_if_missing_env GOOGLE_MAPS_API_KEY
warn_if_missing_env SMTP_HOST
warn_if_missing_env SMTP_PORT
warn_if_missing_env SMTP_USER
warn_if_missing_env SMTP_PASS
warn_if_missing_env SMTP_FROM
npx prisma migrate deploy
cd ../..
echo '→ Restart PM2...'
pm2 restart lamaapp --update-env || pm2 start /var/www/lamaapp/apps/api/dist/index.js --name lamaapp
echo '→ Gotowe!'
