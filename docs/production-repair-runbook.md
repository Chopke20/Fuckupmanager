# Procedura naprawy produkcji (Lama Stage)

**Cel:** uporządkowana diagnostyka i naprawa typowych awarii na VPS (Hetzner, `/var/www/lamaapp`).  
**Kontekst:** Ubuntu 24.04, PM2 `lamaapp`, PostgreSQL lokalnie na serwerze, nginx przed API.  
**Codzienny flow release:** `docs/deploy-quick.md` (krótka checklista push/deploy/weryfikacja SHA).

---

## 0. Zanim zaczniesz

- Zaloguj się po SSH jako **root** (standardowy deploy):  
  `ssh root@204.168.181.239`
- Katalog aplikacji: `cd /var/www/lamaapp`
- **Nie udostępniaj** treści `apps/api/.env` ani logów z hasłami osobom trzecim.

---

## 1. Standardowa naprawa (zwykle wystarczy)

Wykonaj w tej kolejności — większość problemów znika po kroku 1–2.

### Krok A — pełny deploy z `main`

```bash
cd /var/www/lamaapp
git fetch origin main && git reset --hard origin/main
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` robi m.in.: `npm install`, build, **`prisma migrate deploy`**, instalację zależności Chromium pod PDF (jeśli root + `apt-get`), restart PM2 z `--update-env`.

### Krok B — jeśli deploy przeszedł, ale coś nadal nie działa

```bash
pm2 restart lamaapp --update-env
pm2 logs lamaapp --lines 120
```

### Krok C — logi tylko błędów (szybki podgląd)

```bash
tail -80 /root/.pm2/logs/lamaapp-error.log
```

---

## 2. Rozpoznawanie błędów po komunikacie w logu

| Objaw w logu | Prawdopodobna przyczyna | Co zrobić |
|----------------|-------------------------|-----------|
| `The table public.… does not exist` / błędy Prisma o braku tabeli | Migracje nie zastosowane na tej bazie albo **zły `DATABASE_URL`** (inna baza niż myślisz) | [§3 Baza i Prisma](#3-baza-i-prisma) |
| `Brak konfiguracji SMTP` / `SMTP_CONFIG_MISSING` | Brak `SMTP_*` w `apps/api/.env` lub PM2 bez świeżego env | [§4 Env, integracje, SMTP](#4-env-integracje-smtp) |
| `SMTP: brak odpowiedzi serwera` / timeout SMTP | Zły host/port, firewall, blokada egress, problem u dostawcy | [§4 Env, integracje, SMTP](#4-env-integracje-smtp) |
| **504** na wywołaniach API (np. zaproszenia), a w logu API timeout SMTP | nginx (`proxy_read_timeout`) kończy żądanie wcześniej niż backend; ewentualnie stary build API | [§4 Env, integracje, SMTP](#4-env-integracje-smtp) + [§6 Nginx i port](#6-nginx-i-port) |
| `550` „Pole od różni się od uwierzytelnionego użytkownika” (Hostido) | `SMTP_FROM` ≠ `SMTP_USER` (albo inny adres w `<>`) | Ustaw ten sam adres co login; opcjonalnie włącz w panelu hostingu zmianę nagłówka From |
| `Brak konfiguracji AI (OPENROUTER_API_KEY)` / 503 na `/api/ai/*` | Brak klucza w `.env` | [§4 Env, integracje, SMTP](#4-env-integracje-smtp) |
| Puste miejsca / brak km (Google) | Brak `GOOGLE_MAPS_API_KEY` lub wyłączone API w GCP | [§4 Env, integracje, SMTP](#4-env-integracje-smtp) |
| `Failed to launch the browser` / `libnss3.so` / `cannot open shared object file` | Brak bibliotek systemowych dla Chromium (Puppeteer / PDF) | [§5 Eksport PDF (Puppeteer)](#5-eksport-pdf-puppeteer) |
| `Brak sesji` / 401 na `/api/*` (poza auth) | Normalne przy niezalogowanym żądaniu; **skanery** czasem wołają `/api/.env` — to nie jest luka w routingu, tylko brak sesji | Ignoruj skan; użytkownik: wyczyść cookies, zaloguj ponownie |
| Błędy nginx / 502 | API nie działa lub zły upstream | [§6 Nginx i port](#6-nginx-i-port) |

---

## 3. Baza i Prisma

### 3.1 Upewnij się, że API widzi właściwą bazę

```bash
cd /var/www/lamaapp/apps/api
grep -E '^DATABASE_URL=' .env | sed 's/:[^:@]*@/:***@/' 
```

(sprawdź host, nazwę bazy, użytkownika — **nie wklejaj pełnego URL z hasłem nikomu**)

### 3.2 Ręczne migracje (gdy deploy nie dobiegł do końca)

```bash
cd /var/www/lamaapp/apps/api
set -a && source .env && set +a
npx prisma migrate deploy
npx prisma generate
cd /var/www/lamaapp
pm2 restart lamaapp --update-env
```

### 3.3 Stan migracji (czy schema jest na tej bazie)

```bash
cd /var/www/lamaapp/apps/api
set -a && source .env && set +a
npx prisma migrate status
```

Status **„Database schema is up to date”** + brak pending — OK. Jeśli migracje wiszą jako niezastosowane, uruchom ponownie `npx prisma migrate deploy`. Gdy status OK, a w logach nadal „table does not exist”, **API łączy się z inną bazą** niż ta, na której patrzysz (inny `DATABASE_URL`).

### 3.4 Seed / pierwszy admin (tylko świadomie)

Seed nadpisuje domyślne konta testowe — uruchamiaj tylko wtedy, gdy wiesz, po co.  
W razie potrzeby: `npm run db:seed -w apps/api` **na serwerze** z odpowiednim `.env` (patrz `apps/api/.env.example` i dokumentacja seeda).

### 3.5 Migracja starych kodów (SPR/ZAS, stare numery PDF)

Jednorazowo po wdrożeniu nowych formatów (`EQP-`/`RES-`, `OFR-…-v#` itd.): z katalogu `apps/api`, z poprawnym `DATABASE_URL`, najpierw **podgląd bez zapisu** (`MIGRATE_DRY_RUN=1`), potem właściwy run:

```bash
cd /var/www/lamaapp/apps/api
MIGRATE_DRY_RUN=1 npm run db:migrate-legacy-codes
npm run db:migrate-legacy-codes
```

Skrypt: `scripts/migrate-legacy-codes.ts` — aktualizuje `equipment.internalCode`, `order_document_exports` (+ pole `documentNumber` w JSON snapshotu oferty, jeśli występuje) oraz `orders.offerNumber` / `offerVersion`.

---

## 4. Env, integracje, SMTP

Plik: **`/var/www/lamaapp/apps/api/.env`** (czasem duplikat w root `.env` — źródłem prawdy dla API jest kolejność ładowania w `load-env.ts`; trzymaj spójność).

### Minimalny zestaw produkcyjny (merytorycznie)

- `DATABASE_URL` — PostgreSQL (nie `file:./…` z dev)
- `NODE_ENV=production`
- `FRONTEND_ORIGIN=https://fuckupmanager.lamastage.pl`
- `APP_BASE_URL_PROD=https://fuckupmanager.lamastage.pl`
- `OPENROUTER_API_KEY` — AI
- `GOOGLE_MAPS_API_KEY` — miejsca i dystans
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — zaproszenia / reset hasła
- Opcjonalnie: `SMTP_EHLO_DOMAIN=fuckupmanager.lamastage.pl` przy problemach z niektórymi serwerami SMTP

Po każdej zmianie `.env`:

```bash
cd /var/www/lamaapp
./deploy.sh
```

albo przynajmniej:

```bash
pm2 restart lamaapp --update-env
```

### SMTP — szybki test z serwera (TCP)

```bash
# Zamień na swój host i port z .env
nc -vz host820313.hostido.net.pl 587
```

Jeśli timeout — problem sieci/firewall/u dostawcy, nie aplikacji.

### SMTP a 504 z przeglądarki

Jeśli w `pm2` widać błąd SMTP po ~60 s, a w przeglądarce **504**, nginx może mieć domyślny `proxy_read_timeout` (często 60 s). Dla lokalizacji proxy do API warto ustawić np. `proxy_read_timeout 120s;` (i ewentualnie `proxy_connect_timeout`), potem `nginx -t` i `systemctl reload nginx`.

---

## 5. Eksport PDF (Puppeteer)

### 5.1 Objaw

`libnss3.so: cannot open shared object file` lub inne `error while loading shared libraries` przy starcie Chrome z cache Puppeteera.

### 5.2 Naprawa

**Preferowane:** pełny `./deploy.sh` z aktualnego `main` — skrypt instaluje pakiety apt pod Chromium (sekcja „Zależności systemowe Chromium”).

**Ręcznie (minimalnie):**

```bash
apt-get update
apt-get install -y libnss3 libnspr4 libgbm1
pm2 restart lamaapp --update-env
```

Jeśli pojawi się kolejny brakujący `.so` — doinstaluj resztę (lista w `deploy.sh`, funkcja `install_chromium_pdf_deps`) albo ponów `./deploy.sh`.

### 5.3 Opcjonalnie: systemowy Chromium

W `apps/api/.env`:

```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

(ścieżka zależy od pakietu: `which chromium` / `which chromium-browser`)

---

## 6. Nginx i port

- API nasłuchuje domyślnie na **3000** (localhost na serwerze).
- Health: `curl -sS http://127.0.0.1:3000/health`

Jeśli `curl` z serwera działa, a z przeglądarki nie — problem w nginx / DNS / SSL:

```bash
nginx -t && systemctl reload nginx
tail -40 /var/log/nginx/error.log
```

---

## 7. Pominięcie apt podczas deployu (wyjątek)

Jeśli z jakiegoś powodu nie chcesz, żeby `deploy.sh` wywoływał `apt-get` (np. test na obrazie bez pełnego roota):

```bash
SKIP_APT_PDF_DEPS=1 ./deploy.sh
```

PDF może wtedy wymagać ręcznej instalacji bibliotek (§5).

---

## 8. Powiązane pliki w repo

- Deploy: `deploy.sh`, `.github/workflows/deploy.yml`
- Wzorzec env: `apps/api/.env.example`
- Reguła środowiska (skrót): `.cursor/rules/lama-production-deploy.mdc`

---

*Ostatnia aktualizacja runbooka: 2026-04 — pokrywa znane awarie: migracje, env/SMTP/API, PDF/Chromium, PM2.*

---

## 9. Codzienny backup baz (bez Hetzner Backups)

Jeśli nie korzystasz z płatnych backupów Hetznera, ustaw codzienny `pg_dump` na serwerze.

### 9.1 Skrypt

W repo jest skrypt:

- `scripts/backup-databases.sh`

Robi backup dla wszystkich firm z `COMPANY_DATABASES_JSON` (lub fallback do `DATABASE_URL`), sprawdza rozmiar dumpa (żeby nie było 0B) i trzyma retencję (domyślnie 14 dni).

### 9.2 Konfiguracja (serwer)

Zmienna `COMPANY_DATABASES_JSON` jest w `/var/www/lamaapp/apps/api/.env`.

Opcjonalnie możesz ustawić:
- `BACKUP_DIR` (domyślnie `/var/backups/lamaapp`)
- `BACKUP_RETENTION_DAYS` (domyślnie `14`)
- `PG_DUMP_PATH` (domyślnie `pg_dump`)

### 9.3 Uruchomienie ręczne (test)

```bash
sudo bash /var/www/lamaapp/scripts/backup-databases.sh
ls -lh /var/backups/lamaapp | tail -n 20
```

### 9.4 Cron (codziennie 02:10)

Edytuj crontab roota:

```bash
crontab -e
```

Dodaj:

```bash
10 2 * * * APP_ROOT=/var/www/lamaapp BACKUP_ENV_FILE=/var/www/lamaapp/apps/api/.env BACKUP_DIR=/var/backups/lamaapp BACKUP_RETENTION_DAYS=14 /bin/bash /var/www/lamaapp/scripts/backup-databases.sh >> /var/log/lamaapp-backup.log 2>&1
```

Sprawdź log:

```bash
tail -120 /var/log/lamaapp-backup.log
```
