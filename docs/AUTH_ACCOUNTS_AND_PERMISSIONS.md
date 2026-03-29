# Auth / Konta / Role / Uprawnienia — konstrukcja i instrukcje rozwoju

Ten dokument opisuje jak jest zbudowany system kont w Lama Stage (v0.2.x) oraz jak go rozszerzać w kolejnych iteracjach.

## Założenia v1

- **Model onboardingu**: invite-only (konta zakłada Admin przez zaproszenie).
- **Logowanie**: **email + hasło**.
- **Sesja**: cookie `httpOnly` (`lama_session`).
- **Role i uprawnienia**: permissiony per moduł, role mogą być **dynamiczne** (edytowalne w DB przez panel Admin).
- **Audit log**: akcje administracyjne zapisują się w tabeli `audit_logs`.

## Punkty wejścia (frontend)

- `/login` — logowanie
- `/forgot-password` — prośba o reset hasła
- `/reset-password?token=...` — ustawienie nowego hasła
- `/accept-invite?token=...` — aktywacja konta z zaproszenia
- `/admin` — panel Admin (widoczny tylko z permissionami `admin.*`)

Guardy UI:
- `apps/web/src/modules/auth/RequireAuth.tsx`:
  - `RequireAuth` blokuje całą aplikację bez sesji.
  - `RequirePermission` blokuje widoki po permissionie.

## Punkty wejścia (backend)

### Publiczne endpointy

- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/accept-invite`
- `GET /health`

### Chronione endpointy

W `apps/api/src/app.ts` wszystkie `/api/*` poza `/api/auth/*` są chronione przez `requireAuth`, a dodatkowo mają warstwę modułową:

- `requireModuleAccess('clients'|'orders'|'equipment'|'documents'|'blocks'|'calendar'|'finance')`
- `requirePermission('integrations.ai.use')`, `requirePermission('integrations.places.use')`

Auth admin:
- `GET /api/auth/admin/users` (`admin.users.read`)
- `PATCH /api/auth/admin/users/:id/role` (`admin.users.write`)
- `DELETE /api/auth/admin/users/:id` (`admin.users.write`) — dezaktywacja
- `POST /api/auth/admin/users/:id/reset-password` (`admin.users.write`)
- `GET /api/auth/admin/audit-logs` (`admin.audit.read`)
- `GET/POST/PUT/DELETE /api/auth/admin/roles...` (`admin.roles.read/write`)
- `GET /api/auth/admin/backup` (`admin.backup`) — pobiera pełną kopię bazy SQLite do pliku (backup)

## Modele danych (Prisma)

Plik: `apps/api/prisma/schema.prisma`

### `User`
Użytkownik aplikacji.

Najważniejsze pola:
- `email` (unikalne; login)
- `username` (unikalne; pomocnicze)
- `passwordHash` (scrypt; format `salt:hash`)
- `role` (string — klucz roli, np. `ADMIN`, `OPERATOR_FULL`, `MANAGER`)
- `isActive` (soft-delete konta)
- `emailVerifiedAt` (aktywacja konta po zaproszeniu)
- `mustChangePassword` (flaga na przyszłość)

### `Session`
Sesje cookie:
- w bazie trzymamy `sessionTokenHash` (SHA-256), **nie** surowy token
- `expiresAt`, `revokedAt`, `lastUsedAt`

Cookie:
- nazwa: `lama_session`
- ustawiane w `apps/api/src/modules/auth/auth.service.ts`

### `InvitationToken`
Zaproszenia invite-only:
- `tokenHash` (SHA-256), `email`, `role`, `expiresAt`, `usedAt`
- po akceptacji tworzy/aktualizuje `User` i ustawia `emailVerifiedAt`

### `PasswordResetToken`
Reset hasła:
- `tokenHash` (SHA-256), `expiresAt`, `usedAt`
- po resecie: hasło zmienione, sesje unieważnione

### `RoleDefinition`
Dynamiczne role (edytowalne z panelu Admin):
- `roleKey` (unikalny klucz roli, np. `MANAGER`)
- `permissionsJson` (JSON array stringów permissionów)
- `isSystem` (role systemowe są tylko do odczytu)

Role systemowe są seedowane jako `isSystem=true`:
- `ADMIN`
- `OPERATOR_FULL`

### `AuditLog`
Audit log akcji administracyjnych:
- `actorUserId`, `actorEmail`
- `module`, `action`
- `targetType`, `targetId`
- `result` (`SUCCESS|FAILURE`)
- `details`, `requestId`, `ipAddress`, `userAgent`

## Permissiony — jak to działa

Źródło prawdy permissionów:
- `packages/shared-types/src/schemas/permission.schema.ts`
  - `PERMISSIONS` (lista)
  - schematy Zod ról i payloadów CRUD ról
  - fallback `ROLE_PERMISSION_MAP` dla ról systemowych

Backend:
- middleware `requirePermission` oraz `requireModuleAccess` w `apps/api/src/shared/middleware/auth.middleware.ts`
- rozwiązywanie roli:
  - najpierw DB (`RoleDefinition.permissionsJson`)
  - jeśli brak roli w DB lub JSON uszkodzony: fallback do `ROLE_PERMISSION_MAP`

Frontend:
- `AuthProvider` trzyma `user.permissions` zwracane z backendu (`/api/auth/me` i `/api/auth/login`).
- jeśli backend nie zwróci `permissions`, frontend ma fallback do statycznego `resolvePermissionsForRole`.

## SMTP i linki e-mail

Konfiguracja: `apps/api/.env`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `APP_BASE_URL` (DEV), `APP_BASE_URL_PROD` (PROD)

Wysyłka:
- `apps/api/src/modules/auth/smtp.mailer.ts` — prosty klient SMTP (STARTTLS/465)
- `apps/api/src/modules/auth/auth.mail.ts` — buduje linki zaproszeń/resetu

## Konta startowe (seed)

Seed: `apps/api/src/prisma/seed.ts`

Zmienne env:
- `SEED_ADMIN_EMAIL="biuro@lamastage.pl"`
- `SEED_ADMIN_PASSWORD="admin1234"`
- (opcjonalnie) `SEED_ADMIN_USERNAME`, `SEED_ADMIN_FULL_NAME`

Uwaga:
- seed aktualizuje konto admina **po email lub username**, żeby uniknąć konfliktów unique przy zmianie e-maila.

## Jak dodać nowy moduł w przyszłości (np. “warehouse”, “reports”)

1. **Dodaj permissiony** w `packages/shared-types/src/schemas/permission.schema.ts`:
   - `warehouse.read`, `warehouse.write` (albo podobnie)
2. **Zbuduj shared-types**:
   - `npm run build -w packages/shared-types`
3. **Owiń router** w `apps/api/src/app.ts`:
   - `app.use('/api/warehouse', requireModuleAccess('warehouse'), warehouseRouter)`
4. **(Opcjonalnie)** dodaj w UI nowe checkboxy roli — UI i tak mapuje z `PERMISSIONS`, więc pojawią się automatycznie.

## Jak dodać nową rolę bez kodu

W UI `Admin -> Role i uprawnienia`:
- utwórz rolę np. `MANAGER`
- wybierz permissiony
- przypisz rolę użytkownikom w tabeli użytkowników

## Jak dodać nowy typ akcji do audit logów

1. W miejscu akcji (controller/service) dodaj wywołanie:
   - `writeAuditLog(...)` lub użyj helpera `auditAdminAction` (w `auth.controller.ts`)
2. Ustal:
   - `module` (np. `admin.roles`, `orders`, `finance`)
   - `action` (np. `role.create`, `order.update`)
   - `targetType/targetId`
3. Jeśli log ma obejmować nie-admin akcje, rozważ osobne endpointy do przeglądania logów i osobny permission (np. `audit.read`).

## Zasady stabilności (must-pass)

Przed uznaniem pracy nad kontami za zakończoną:
- `npm run build`
- `npm run smoke`

Smoke po auth loguje się automatycznie kontem seed (patrz `scripts/smoke-check.mjs`).

