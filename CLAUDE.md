# CLAUDE.md

Denne fil er projektets hukommelse på tværs af Claude Code-sessioner. Læs den
først for at forstå hvor vi er. **Opdatér "Log" nederst efter hver session
hvor vi tilføjer/ændrer noget** — kort, dato + hvad + hvorfor.

## Hvad er dette

Fork af Cloudflare "Orange Meets" (WebRTC-mødeapp, Remix + Cloudflare
Workers), tilpasset til Fleksjobbernetværket ("VoresEvents Meet"). Original
feature-dokumentation (env vars, deployment) står i [README.md](README.md) —
den er god og opdateret, dupliker den ikke her.

## Stack

- **Remix** (`@remix-run/cloudflare`) kørende på **Cloudflare Workers**
- **Durable Objects** (`app/durableObjects/ChatRoom.server.ts`) holder
  real-time rum-state (deltagere, chat, lock, mute) — én instans pr. møde
- **D1** (SQLite) til persistent data: brugerkonti, møde-værtspassword,
  chat-historik, admin-audit-log, rum-presets. Skema via **Drizzle**,
  migrationer i `migrations/*.sql`
- **Cloudflare Realtime SFU** (Calls API) til selve video/lyd
- Sessions: to separate cookie-sessions —
  [app/session.ts](app/session.ts) (`__session`, visitor/bruger) og
  [app/adminSession.ts](app/adminSession.ts) (`__admin_session`, admin)

⚠️ Cookie session secrets i begge filer er hardkodede placeholder-strenge
committet til repo — ikke rigtige secrets, men bør udskiftes hvis appen
nogensinde skal være production-hård.

## Datamodel (D1)

- `Users` — konti med `role` (`admin` / `ordstyrer`(moderator) / `user`),
  password hash+salt, invite-token til `/set-password` aktivering
- `Meetings` — pr. møde `hostPasswordHash`, `roomName`
- `Rooms` — pre-konfigurerede rum (locked/chat default, preset password)
- `ChatMessages`, `AdminAuditLog` — historik/logging

Roller: `moderator` er automatisk vært i ethvert møde de joiner. `admin` får
adgang til `/admin`. Alm. `user`/gæst kan kun joine et allerede aktivt møde,
ikke oprette et nyt (seneste commit, 96aee1f).

**Vigtigt**: `wrangler.toml` har pt. **ingen D1-database bundet**
(`[[d1_databases]]` er udkommenteret). Uden den virker appen stadig (video
+ `HOST_PASSWORD`-baseret host), men brugerkonti, chat-historik, admin-log
og rum-presets er inaktive. Husk dette når nye D1-afhængige features
tilføjes — de skal fejle "blødt" (som eksisterende kode gør), ikke crashe.

## Nøglefiler

- `app/routes/admin*.tsx` — admin-panel (login, setup, rum-fjernstyring)
- `app/routes/_room.*` — selve mødeflowet (lobby, room)
- `app/routes/set-username.tsx`, `set-password.tsx` — bruger-onboarding
- `app/utils/hashPassword.server.ts`, `passwordHash.server.ts` — password-hashing
- `app/utils/sendEmail.server.ts` — Resend-invitationsmails

## Dev-kommandoer

```sh
npm run dev            # lokal dev (remix + wrangler)
npm run check           # lint + typecheck + test (kør før commit ved usikkerhed)
npm run db:migrate:local  # kør D1-migrationer lokalt
```

## Kendte åbne tråde

- `.gitignore` har en uncommitted tilføjelse af `.fake` (ikke referenceret
  andre steder i koden) — formål ukendt, spørg brugeren før commit/oprydning.

## Log

- **2026-08-23**: Forsiden (`/`) redirectede altid til
  `/set-username?return-url=...` når man ikke var logget ind — brugeren
  vil altid have hoved-URL'en vist. Fix: `/` er nu undtaget fra
  username-gaten i [app/root.tsx](app/root.tsx), og `_index.tsx` viser
  selv velkomst-UI'et når `username` mangler (ingen redirect, ingen
  URL-ændring). Samtidig redesignet velkomstskærmen: to knapper side om
  side ("Fortsæt som gæst" / "Som admin") i stedet for underline-tabs;
  klik viser hhv. Visningsnavn-felt eller Brugernavn+adgangskode-felt,
  med en fælles "Fortsæt"-knap. UI'et er udtrukket til
  [app/components/AuthChoiceForm.tsx](app/components/AuthChoiceForm.tsx)
  og bruges nu både på `/` og på `/set-username` (sidstnævnte er stadig
  target for dybe links, fx `/mitmøde`, når man ikke er logget ind — den
  rutes gate er uændret). Login-logikken (master-password + DB-bruger)
  er udtrukket til
  [app/utils/loginAction.server.ts](app/utils/loginAction.server.ts) så
  begge routes deler den. NB: dette miljø har ikke Node.js installeret,
  så `npm run typecheck`/`test`/`build` kunne ikke køres lokalt før push —
  GitHub Actions ("Checks" workflow) kører dem på push til `main`, tjek
  status der efter push.
- **2026-08-23**: Oprettede denne fil. Ingen kode ændret. Grund: tidligere
  chat-session var utilgængelig for en ny session; denne fil skal sikre
  kontinuitet i konventioner/status fremover.
