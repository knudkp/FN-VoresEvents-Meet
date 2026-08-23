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
og `HOST_PASSWORD`-baseret host), men brugerkonti, chat-historik, admin-log
og rum-presets er inaktive. Husk dette når nye D1-afhængige features
tilføjes — de skal fejle "blødt" (som eksisterende kode gør), ikke crashe.

## Nøglefiler

- `app/routes/admin*.tsx` — admin-panel (login, setup, rum-fjernstyring)
- `app/routes/_room.*` — selve mødeflowet (lobby, room)
- `app/routes/set-username.tsx`, `set-password.tsx` — bruger-onboarding
- `app/utils/hashPassword.server.ts`, `passwordHash.server.ts` — password-hashing
- `app/utils/sendEmail.server.ts` — Resend-invitationsmails

## Navn og version

Appen hedder **fleksMeet** til brugerne (titel, brand-panel, webmanifest) —
kilde: [app/utils/appInfo.ts](app/utils/appInfo.ts) (`APP_NAME`,
`APP_VERSION`). Bump `APP_VERSION` når en mærkbar ændring skipper (se Log).
`© 2026 - Vores Events - Fleksjobber Netværket` i footeren er en separat
firma-/ejer-attribution og hedder fortsat "Vores Events" — det er ikke
produktnavnet og skal ikke ændres til fleksMeet.

## Dev-kommandoer

```sh
npm run dev            # lokal dev (remix + wrangler)
npm run check           # lint + typecheck + test (kør ALTID før push — se note nedenfor)
npm run db:migrate:local  # kør D1-migrationer lokalt
```

**Node.js er ikke installeret i dette Windows-miljø som standard**, og
`winget install` hænger på en UAC-prompt der ikke kan besvares
non-interaktivt her. Virkende workaround brugt i denne session: download og
udpak den portable Node-zip direkte (ingen admin nødvendigt):

```sh
curl -sSL -o node.zip https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip
unzip -q node.zip -d <et-sted>
export PATH="<et-sted>/node-v22.14.0-win-x64:$PATH"
```

Dette er kun for sessionen (scratchpad ryddes mellem sessioner) — gør det
igen hver gang `npm`/`npx` mangler. **Kør altid `npm run check` (eller
mindst `lint` + `typecheck`) lokalt før push**, for check.yml stopper ved
første fejlende step og skjuler resten (typecheck/test bliver "skipped"
hvis lint fejler) — se Log-posten fra 2026-08-23 om hvor længe en
typecheck-fejl kan ligge skjult sådan.

## Log

- **2026-08-23**: Polish-runde på velkomstskærmen efter brugerfeedback
  på et screenshot: hjælpe-ikonet (`?` øverst til højre) var teknisk til
  stede i DOM'en men for lavkontrast (grå kant/tekst på hvid) til reelt
  at kunne ses — gjort tydeligt synligt (teal kant/tekst, skygge,
  `z-10`). "Velkommen til fleksMeet" er nu 5% større og `font-black`
  (var `font-bold`). Tilføjede `mx-auto text-center` på
  velkomst-blokken som en ekstra, eksplicit centrerings-garanti (den var
  allerede centreret via flex `justify-center` på forælderen — verificeret
  med et rigtigt Playwright-screenshot ved 1400×900 — men brugerens
  beskårne screenshot så skævt ud, formentlig fordi beskæringen ikke
  viste hele højre-halvdelen).
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
  status der efter push. **Bekræftet live og virkende** samme dag —
  brugerens vedvarende indtryk af den gamle redirect-URL skyldtes en
  gammel browser-fane/cache, ikke en fejl i deployet.
- **2026-08-23**: Oprettede denne fil. Ingen kode ændret. Grund: tidligere
  chat-session var utilgængelig for en ny session; denne fil skal sikre
  kontinuitet i konventioner/status fremover.
- **2026-08-23**: Ryddet op og udvidet velkomstskærmen, samt fikset CI:
  - **Rod-årsag til den fejlende GitHub Actions "Checks"-job fundet og
    rettet**: [.eslintrc.cjs](.eslintrc.cjs) linje 1 havde en fejlagtigt
    indsat terminal-kommando (`npx wrangler login --copy`) foran
    kommentaren — ugyldig JS, fik `prettier --check` til at crashe før
    eslint overhovedet kørte. Efter den rettelse dukkede en **skjult
    typecheck-fejl** op (typecheck bliver "skipped" af check.yml når lint
    fejler, så den havde ligget upåagtet et stykke tid): `LogEvent`-unionen
    i [app/utils/logging.ts](app/utils/logging.ts) manglede tre varianter
    (`roomLockedRejection`, `unauthorizedHostAction`, `hostClaimed`) som
    [ChatRoom.server.ts](app/durableObjects/ChatRoom.server.ts) allerede
    kaldte `log()` med — tilføjet. Plus en `ReactNode`-type-fejl i
    [admin.tsx](app/routes/admin.tsx) (`setPasswordUrl`) rettet med en
    eksplicit cast. 15 filer var desuden aldrig kørt gennem Prettier
    (formentlig skrevet/committet uden om `npm run check`) — reformateret
    uden indholdsændringer (bekræftet med `git diff -w` per fil før
    commit). `npm run check` + `remix build` er nu grønne lokalt.
  - **Branding**: appen hedder nu **fleksMeet** overalt hvor brugeren ser
    navnet (side-titel, brand-panel, webmanifest) — se "Navn og version"
    ovenfor. Gammel titel var "Fleksjobber Netværket Møde"/"Vores Events".
  - **Layout**: `BrandPanel` (venstre, cyangrøn halvdel) er udtrukket til
    [app/components/BrandPanel.tsx](app/components/BrandPanel.tsx) (var
    duplikeret i `_index.tsx` og `set-username.tsx`) — copyright-teksten
    er flyttet herind, hvid og centreret, fastgjort til bunden
    (`flex-col` + `flex-1` om resten af indholdet skubber den nedad), og
    fjernet fra højre-halvdelens formularer alle steder for at undgå
    dublet. Overskriften "Velkommen" er ændret til "Velkommen til
    fleksMeet" på både `/` og `/set-username`.
  - **Hjælp-popup**: lille "?"-ikon øverst til højre i højre halvdel på
    forsiden (`/`, både gæst- og logget-ind-visning) —
    [app/components/HelpDialog.tsx](app/components/HelpDialog.tsx), samme
    Radix Dialog-mønster som `AdminLoginDialog`.
  - `.gitignore`s `.fake`-linje er beholdt/committet (ren lokal
    scratch-ignorering, harmløst — ingen kode refererer til `.fake`).
