#!/bin/bash
set -e
echo '→ Instalacja zależności...'
npm install
echo '→ Build shared-types...'
cd packages/shared-types && npm run build && cd ../..
echo '→ Build frontend...'
cd apps/web && npm run build && cd ../..
echo '→ Build backend...'
cd apps/api && npm run build && cd ../..
echo '→ Prisma migrations...'
cd apps/api && npx prisma migrate deploy && cd ../..
echo '→ Restart PM2...'
pm2 restart lamaapp || pm2 start apps/api/dist/index.js --name lamaapp
echo '→ Gotowe!'
