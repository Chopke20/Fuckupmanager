# Deploy Quick Checklist

Cel: szybki, powtarzalny flow, żeby zmiany z lokalnego środowiska były widoczne na produkcji.

## Codzienny release (5-7 kroków)

1. Zweryfikuj lokalnie:
   - `npm run build`
   - opcjonalnie smoke (`npm run smoke` lub `npm run smoke:check`, gdy API już działa).
2. Sprawdź zmiany:
   - `git status`
3. Zacommituj:
   - `git add -A`
   - `git commit -m "krótki opis zmiany"`
4. Wypchnij na produkcyjny branch:
   - `git push origin main`
5. Zanotuj wersję:
   - `git rev-parse --short HEAD`
6. Potwierdź deploy:
   - GitHub Actions workflow deploy powinien być zielony
   - w UI wersja `main-<short_sha>` ma odpowiadać pushowi.
7. Gdy deploy nie przejdzie:
   - nie oznaczaj pracy jako zakończonej
   - użyj runbooka: `docs/production-repair-runbook.md`.

## Ręczny deploy (fallback)

```bash
ssh root@204.168.181.239
cd /var/www/lamaapp
git fetch origin main && git reset --hard origin/main
chmod +x deploy.sh
./deploy.sh
```

Po deployu sprawdź `pm2 status` i wersję w UI.
