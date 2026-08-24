# CLAUDE.md

Denne fil er projektets hukommelse på tværs af Claude Code-sessioner. Læs den
først for at forstå hvor vi er. **Opdatér "Log" nederst efter hver session
hvor vi tilføjer/ændrer noget** — kort, dato + hvad + hvorfor.

## Hvad er dette

Fork af Cloudflare "Orange Meets" (WebRTC-mødeapp, Remix + Cloudflare
Workers), tilpasset til Fleksjobbernetværket som **fleksMeet**.
Feature-/deployment-dokumentation står i [README.md](README.md); en fuld
teknisk gennemgang (datamodel, Durable Object-protokol, auth, deploy-
pipeline, "hele molevitten") står i
[ARCHITECTURE.md](ARCHITECTURE.md) — begge er opdaterede, dupliker dem
ikke her. Hold begge ajour når noget af det de beskriver ændrer sig.

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
- `BannedIps`, `BannedUsernames` — globalt/permanent moderations-ban
  (håndhævet i `ChatRoom.server.ts`'s `onConnect`, se 2026-08-24-log)

Roller: `moderator` er automatisk vært i ethvert møde de joiner. `admin` får
adgang til `/admin`. Alm. `user`/gæst kan kun joine et allerede aktivt møde,
ikke oprette et nyt (seneste commit, 96aee1f).

**D1 er nu bundet** (`wrangler.toml`'s `[[d1_databases]]`, `binding = "DB"`,
database `fn-voresevents-meet-db`, id `5d79df48-5696-4fb0-84cc-a1f724816e99`)
— se Log-posten fra 2026-08-23 (admin-lockout) for hvordan det blev opdaget
at den *ikke* var bundet, selvom databasen og alle migrationer allerede
fandtes i Cloudflare-kontoen. Uanset om D1 er bundet, skal ny D1-afhængig
kode stadig fejle "blødt" (som eksisterende kode gør, via `getDb()` der
returnerer `null`), ikke crashe — så appen ikke går i stykker hvis nogen
binding igen forsvinder ved et uheld.

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

- **2026-08-23**: Opdaterede README.md (fleksMeet-branding, velkomstskærm,
  navngivning/versionering, delingsbillede, henvisning til
  ARCHITECTURE.md) og oprettede
  [ARCHITECTURE.md](ARCHITECTURE.md) — en ultra-teknisk gennemgang af
  hele systemet (data-lag, D1-skema, Durable Object-lagringsnøgler og
  WebSocket-protokol, de to password-hash-ordninger, invite-token-flow,
  Calls API-integration, E2EE/AI-features, rute-kort, env-variabler, og
  en advarsel om at `wrangler.{development,staging,production,public,e2ee}.toml`
  er efterladte upstream-configs der IKKE bruges af denne deployment
  (kun base `wrangler.toml` er reel). Skrevet ved at læse kildekoden
  direkte (ChatRoom.server.ts, schema.ts, alle auth/session/hash-filer,
  routes) — ikke gættet.
- **2026-08-23**: Tilføjede Open Graph/Twitter-metatags (delingsbillede),
  da brugeren delte URL'en på LinkedIn og savnede et billede. Nyt
  [public/og-image.png](public/og-image.png) (1200×630, samme
  gradient/logo/tags som BrandPanel — genereret som HTML og
  Playwright-screenshottet, ikke håndtegnet). `og:url`/`og:image` bruger
  det faktiske request-domæne (`url.origin` fra
  [app/root.tsx](app/root.tsx)'s loader, sendt til `meta` via
  loaderData) — virker automatisk på alle domæner/miljøer uden
  hardkodning. Husk at regenerere `og-image.png` hvis BrandPanel's
  visuelle stil (farver/logo/navn) ændres igen.
- **2026-08-23**: Tilføjede validering af gæste-visningsnavne
  ([app/utils/validateDisplayName.ts](app/utils/validateDisplayName.ts),
  med enhedstests): max 10 tegn, kun bogstaver (inkl. æøå) efterfulgt af
  valgfrie afsluttende cifre (fx "Knud99"), og et lille forbogstav
  rettes automatisk til stort i stedet for at blive afvist — kun en
  reel fejl (forkert tegn, cifre først/midt i, for langt) giver en
  fejlmeddelelse. Gælder kun gæstenavne (`/` og `/set-username`'s
  "Fortsæt som gæst"), ikke rigtige brugerkontis displayName (sat via
  `/set-password`). Testet end-to-end med Playwright mod en lokal
  wrangler dev-server (både success- og fejl-stien).
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
- **2026-08-23**: Bruger mistede admin-adgang (`admin`-kontoen, login på
  `/admin/login` og forsidens "Som admin"-fane). Undersøgt og løst:
  - **Root cause fundet**: `wrangler.toml`'s `[[d1_databases]]` var
    udkommenteret (som denne fils tidligere tekst her advarede om), men
    D1-databasen `fn-voresevents-meet-db` **fandtes allerede** i Cloudflare-
    kontoen med alle migrationer kørt (`Users`, `Meetings`, `Rooms`,
    `ChatMessages`, `AdminAuditLog` m.fl.) — inklusiv en rigtig, aktiveret
    `admin`-bruger. Den var bare aldrig koblet til selve worker'en (dashboardets
    Settings → Bindings viste kun Durable Object `rooms` og KV
    `__STATIC_CONTENT`, ingen D1). Derfor virkede D1-afhængig login
    ikke, og `/set-password?token=...` viste "Linket er ugyldigt eller
    udløbet" uanset et gyldigt token — `getDb()` returnerer `null` når
    bindingen mangler, hvilket ser identisk ud udefra som et reelt
    ugyldigt/udløbet token (se [set-password.tsx:25-26](app/routes/set-password.tsx#L25-L26)).
  - **Fix**: `wrangler.toml`'s D1-blok er nu udkommenteret ind igen med det
    rigtige `database_id` (`5d79df48-5696-4fb0-84cc-a1f724816e99`) — se
    "Datamodel (D1)" ovenfor. Et push til `main` trigger et Cloudflare
    Workers Build-redeploy der binder den.
  - **Nyt værktøj**: [scripts/reset-admin-access.mjs](scripts/reset-admin-access.mjs)
    — et lille "break-glass"-script (kræver kun `wrangler login`, ingen
    bagdør i selve appen) til fremtidige lockouts:
    `node scripts/reset-admin-access.mjs user <brugernavn>` genererer et
    nyt engangs `/set-password`-link direkte i D1 (samme mekanisme som
    "Gensend invite" i `/admin`, men uden at skulle være logget ind
    først); `node scripts/reset-admin-access.mjs master` roterer
    `HOST_PASSWORD` interaktivt via `wrangler secret put`.
  - Node/wrangler var ikke installeret i dette Windows-miljø — samme
    portable-zip-workaround som beskrevet i "Dev-kommandoer" ovenfor blev
    brugt for denne session; `wrangler login` kørte som en baggrundskommando
    mens brugeren godkendte OAuth-flowet i sin browser.
  - **Endnu en bug fundet efter D1-fixen**: efter D1 var bundet virkede
    `/set-password`-linket og login via forsiden, men admin-login crashede
    med `Uncaught TypeError: e.createCookieSessionStorage is not a
    function` i browseren, og at klikke sig videre til `/admin` efter
    login endte tilbage på "Klar til møde". Årsag: `app/session.ts` og
    `app/adminSession.ts` manglede Remix' `.server.ts`-navnekonvention,
    så byggeren ikke vidste de skulle udelukkes fra client-bundlet — hele
    modulet (inklusiv det øjeblikkelige `createCookieSessionStorage(...)`-
    kald, en Cloudflare-only funktion) endte i en delt client-chunk og
    crashede så snart den blev indlæst i browseren. Bekræftet lokalt ved
    at bygge (`npx remix build`) og grep'e `public/build/` for
    `createCookieSessionStorage` — fandt den i to chunks. Fix: omdøbt
    begge filer til `session.server.ts`/`adminSession.server.ts` og
    opdateret alle 9 importsteder; efter omdøbningen er strengen væk fra
    `public/build/`. `npm run check` + `remix build` + `vitest` grønne
    lokalt før push.
- **2026-08-24**: Rettede det sidste åbne punkt fra 2026-08-23's
  admin-lockout-session: "Admin"-linket nederst på "Klar til møde"-
  skærmen ([_index.tsx](app/routes/_index.tsx)) åbnede altid
  `AdminLoginDialog`, som poster til `/admin/login` og kun accepterer
  `ADMIN_USERNAME`+`HOST_PASSWORD` (secrets der aldrig er sat i denne
  deployment) — virkede derfor aldrig, heller ikke for en besøgende der
  allerede var logget ind som en rigtig admin-konto via forsidens "Som
  admin"-fane (`handleLoginIntent` i
  [loginAction.server.ts](app/utils/loginAction.server.ts) sætter allerede
  både site-sessionen og `__admin_session` ved rolle `admin`). Fix:
  loaderen sender nu `isAdmin` (fra `getUserRole`) med, og Dashboard viser
  et almindeligt link direkte til `/admin` når `isAdmin` er sandt, ellers
  stadig login-popup'en. `npm run typecheck` + `test:ci` + `remix build`
  grønne lokalt (eslint kørt målrettet på den ændrede fil; hele repoets
  `prettier --check` fejler bredt uafhængigt af denne ændring pga.
  `core.autocrlf=true` på denne Windows-maskine — pre-eksisterende
  miljøstøj, ikke noget nyt introduceret her). Pushet til main.
- **2026-08-24**: Admin-panelet åbnes nu som **modal** i stedet for at
  navigere til /admin i samme fane, efter brugerønske. Detaljer og
  filliste i [ADMIN-ADGANG-STATUS.txt](ADMIN-ADGANG-STATUS.txt)'s
  "NÆSTE OPGAVE"-afsnit. Kort opsummeret: delt `AdminNav`/
  `AdminPanelSections` i
  [app/components/AdminPanel.tsx](app/components/AdminPanel.tsx) bruges
  af både den fulde /admin-side og den nye
  [app/components/AdminPanelDialog.tsx](app/components/AdminPanelDialog.tsx)
  (Radix Dialog med X-luk, "Luk"- og "Gem indstillinger"-knapper,
  data hentet via `useFetcher`). Venstremenuen er grupperet
  ("Administration": Brugere/Rum, "Overblik": Møder/System log) med
  lysegul baggrund (`bg-yellow-50`/`dark:bg-yellow-950/30`). Nyt
  "System log"-menupunkt viser `AdminAuditLog`-tabellen (fandtes
  allerede i skemaet); admin.tsx's action logger nu til den ved
  opret/slet bruger, slet rum, gensend invite, gem rum-indstillinger.
  `npm run check`/`typecheck`/`test:ci`/`remix build` grønne lokalt
  (prettier-støjen er stadig pre-eksisterende Windows-CRLF-støj, se
  ovenstående logpost).
- **2026-08-24**: Udvidede admin-panelet efter et opfølgende
  brugerønske (se [ADMIN-ADGANG-STATUS.txt](ADMIN-ADGANG-STATUS.txt)
  for fuld detalje) — rediger-bruger, møde-visninger og en ny globalt
  håndhævet ban-funktion:
  - **Rediger bruger**: ny inline "Rediger"-formular (e-mail + rolle)
    pr. bruger i `AdminPanel.tsx`'s `UserListItem`, ny `updateUser`-
    intent. Lukker sig selv efter gem (var en bug under test: blev
    ellers stående åben efter en vellykket gemning).
  - **Møde-visninger**: Agenda/Dag/Arbejdsuge/Måned/År-vælger i
    Møder-fanen — ren klient-side filtrering af den eksisterende
    mødehistorik på `created`-tidsstemplet, ingen ny
    planlægningsfunktion (afklaret med brugeren først: der findes
    ingen "fremtidige" møder i datamodellen). Plus en "Slet møde"-
    knap (`deleteMeeting`-intent).
  - **Ban-funktion** (ægte ny funktionalitet): to nye D1-tabeller
    `BannedIps`/`BannedUsernames` (migration
    `0005_giant_annihilus.sql`, kørt lokalt OG på produktions-D1).
    `ChatRoom.server.ts`'s `onConnect` fanger nu `CF-Connecting-IP`
    pr. forbindelse og afviser joins der matcher en ban, før noget
    andet sker. Nye `performBanIp`/`performBanUsername` (samme mønster
    som eksisterende `performKick`) + HTTP-endpoints
    `/admin/ban-ip`/`/admin/ban-username`. "Ban bruger"/"Ban IP"-knapper
    tilføjet på "Styr live"-siden
    ([admin_.rooms.$roomName.tsx](app/routes/admin_.rooms.$roomName.tsx))
    ved siden af den eksisterende "Fjern"; ny "Bannede"-fane i
    admin-panelet til at se/ophæve aktive bans. En bandlyst bruger ser
    en bevidst vag "Du har ikke adgang til dette møde."-besked (ny
    `banned`-fejlkode). **End-to-end-testet lokalt** med en rigtig
    Playwright-styret gæste-browser (fake kamera/mikrofon): join →
    admin bander → bekræftet i Bannede-fanen → gen-join afvist korrekt.
  - **Marineblå menu** (erstatter den lysegule fra samme dags
    tidligere session): `AdminNav`'s baggrund er nu fast
    `bg-[#0b1d3a]` med lyseblå tekst.
  - **Migrations-fælde på produktions-D1**: `wrangler d1 migrations
    apply --remote` fejlede først på migration 0000 ("table already
    exists") — samme root cause-mønster som 2026-08-23's admin-
    lockout: databasens `d1_migrations`-bogføringstabel var tom selvom
    tabellerne fra 0000-0004 allerede fandtes. Rettet ved manuelt at
    indsætte de 5 manglende bogførings-rækker (kun den tabel, ingen
    rigtige data rørt), hvorefter 0005 anvendtes normalt.
  - **Opdaget, IKKE rettet (uden for scope)**: `package.json`'s
    `db:migrate:local`-script bruger `wrangler.development.toml`
    (en efterladt config, se ARCHITECTURE.md), men `npm run dev`
    bruger faktisk base `wrangler.toml` — de to migrerer altså
    to forskellige lokale D1'er. Brug i stedet
    `npx wrangler d1 migrations apply fn-voresevents-meet-db -c wrangler.toml --local`
    for at ramme den database `npm run dev` rent faktisk bruger.
  - Testet ved at køre en rigtig lokal `wrangler dev`-server (den
    dokumenterede `npm run dev` fejlede i denne session pga.
    `${WRANGLER_ARGS:-}` bash-parameter-expansion i `package.json`'s
    `start`-script, som npm's cmd.exe-shell på Windows ikke forstår —
    kørte `npx wrangler dev ./build/index.js` direkte i stedet som
    workaround, ingen kodeændring nødvendig). `npm run check`
    (typecheck/eslint/test:ci)/`remix build` grønne lokalt før push.
- **2026-08-24**: Rettet admin-panelets layout efter brugerfeedback
  ("voldsomt grimt") — se
  [ADMIN-ADGANG-STATUS.txt](ADMIN-ADGANG-STATUS.txt)'s tredje
  "NÆSTE OPGAVE"-afsnit for fuld detalje. Rod-årsag: content-panelet
  (`flex-1 overflow-y-auto`) manglede `min-h-0`, det klassiske Tailwind-
  flex-fælde hvor et flex-barn vokser med sit indhold i stedet for at
  respektere sin beregnede højde — med nok indhold voksede hele
  modalen/siden i stedet for at scrolle internt, og trak navy-menuen
  med. Rettet i både
  [AdminPanelDialog.tsx](app/components/AdminPanelDialog.tsx) og
  [admin.tsx](app/routes/admin.tsx). `AdminNav` (i
  [AdminPanel.tsx](app/components/AdminPanel.tsx)) er nu selv-forsynende
  (`h-full` + `border-r` bagt ind i komponenten) så den fylder fuld
  højde konsistent begge steder. Felt-baggrund
  (`bg-zinc-50` → `bg-zinc-100` i [Input.tsx](app/components/Input.tsx)
  og admin-panelets rolle-selects) for lidt mere kontrast. Liste-
  elementer og "opret"-formularer fik delte kort-baggrunde
  (`cardClassName`/`formPanelClassName`) i stedet for at flyde
  kantløst på hvid baggrund. Verificeret visuelt med Playwright ved at
  seede 25 fiktive brugere lokalt for at fremtvinge reel overflow —
  bekræftede header/navy-menu/footer står stille, kun content-panelet
  scroller (i modalen og på den fulde /admin-side). `npm run check`/
  `remix build` grønne lokalt før push.
