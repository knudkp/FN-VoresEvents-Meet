# ARCHITECTURE.md

Ultra-teknisk reference for fleksMeet: hvordan en request bevæger sig gennem
systemet, hvor hvert stykke data rent faktisk bliver gemt, og hvordan hver
større feature hænger sammen under motorhjelmen. Målgruppe: udviklere (og
AI-assistenter) der skal lave ikke-trivielle ændringer og har brug for de
fulde detaljer — for et hurtigt overblik, se [README.md](README.md); for
projektets løbende historik/beslutninger, se [CLAUDE.md](CLAUDE.md).

## 1. Overordnet stack

| Lag                           | Teknologi                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Runtime                       | Cloudflare Workers (V8 isolates, ikke Node)                                         |
| Webframework                  | Remix 2 (`@remix-run/cloudflare`), server-renderet, med client-side transitions     |
| Real-time rum-state           | Cloudflare **Durable Objects** — én `ChatRoom`-instans pr. møde                     |
| Persistent data               | Cloudflare **D1** (SQLite), skema via **Drizzle ORM** (`schema.ts`)                 |
| Video/lyd                     | Cloudflare **Realtime SFU** ("Calls API") via `partytracks`                         |
| Signalering (chat/rum-events) | WebSocket via `partyserver`/`partysocket`, proxy'et gennem Remix til Durable Object |
| Styling                       | Tailwind CSS                                                                        |
| E2E-kryptering (valgfri)      | MLS-baseret, kørende i en Rust→Wasm web worker                                      |
| AI i mødet (valgfri)          | OpenAI Realtime API (WebRTC), broet gennem Calls API som "third party"              |
| Mail (invitationer)           | Resend                                                                              |
| CI                            | GitHub Actions (`prettier`+`eslint`+`typecheck`+`vitest`, plus Semgrep)             |
| Deploy                        | Cloudflare Workers Builds (git-integration, se afsnit 10)                           |

Der er **ingen traditionel backend-server** — alt kører som én Cloudflare
Worker (`build/index.js`), inklusive Durable Object-klassen. Der er heller
ingen separat frontend-build/host; Remix serverer både HTML (SSR) og de
statiske JS/CSS-assets fra samme Worker.

## 2. Hvor data rent faktisk gemmes — det store overblik

Det er let at antage én database. Der er faktisk **fire forskellige steder**
data lever, med meget forskellig levetid:

1. **Cookies** (klientens browser) — hvem du er lige nu (username, rolle,
   admin-flag). Ingen server-side session-store; hele session-state ligger
   krypteret/signeret i selve cookien (se §6).
2. **Durable Object storage** (`this.ctx.storage` i `ChatRoom.server.ts`) —
   et lille key-value-lager der er **bundet til det aktuelle møde** og
   forsvinder når mødet slutter (`ctx.storage.deleteAll()`). Dette er
   "arbejdshukommelsen" for et live møde: hvem er forbundet, chatbeskeder
   i selve mødet, hvem er vært, om rummet er låst osv.
3. **D1 (SQLite)** — den eneste **persistente** database, overlever på
   tværs af møder og genstarter. Bruges til brugerkonti, mødehistorik,
   rum-presets, chat-historik (kopi) og admin-audit-log. **Kan mangle helt**
   — hvis ingen D1-database er bundet i `wrangler.toml`, er alt
   D1-afhængigt kode skrevet til at fejle "blødt" (se §4).
4. **In-memory / browser** — WebRTC peer-forbindelser, lokale medie-tracks,
   E2EE-worker-state. Forsvinder ved refresh, gemmes ingen steder.

Vigtig konsekvens: **chatbeskeder findes to steder** — live i Durable
Object-storage (bruges til at vise dem i UI'et, `prefix: 'chat:'`, klippet
til de seneste 200) og som en append-only kopi i D1's `ChatMessages`-tabel
(til historik/audit, aldrig læst tilbage af selve mødet).

## 3. Request-livscyklus (Remix på Cloudflare Workers)

Alle almindelige HTTP-requests (dokumentsider, `loader`/`action`-kald)
rammer `app/root.tsx`'s `loader` først (det er layout-routen, wrapper alle
andre routes via `<Outlet />`):

1. Læs `username` fra `__session`-cookien (`getUsername`, se §6).
2. **Gate**: hvis intet username, og stien ikke er `/`, `/set-username`,
   `/set-password` eller starter med `/admin` → redirect til
   `/set-username?return-url=<oprindelig-url>`. `/` er bevidst undtaget her
   ([app/routes/\_index.tsx](app/routes/_index.tsx) håndterer selv
   gate'en ved at rendere velkomstskærmen direkte, uden redirect, så
   adresselinjen aldrig skifter væk fra hoved-URL'en).
3. Hvis en Cloudflare Access-cookie (`CF_Authorization`) findes og er ved
   at udløbe (mindre end 1 dag), ryddes den og der redirectes til samme URL
   (kun relevant hvis Cloudflare Access er sat op foran appen — ikke
   brugt i denne deployment).
4. Loaderen returnerer `{ userDirectoryUrl, origin }` — `origin` bruges af
   `meta()` til at bygge absolutte Open Graph-billede-URLs (se §8.6).

Derefter kører den matchede child-routes egen `loader`/`action`. Remix'
fil-baserede routing (flat routes) betyder: `app/routes/_index.tsx` = `/`,
`app/routes/admin_.login.tsx` = `/admin/login`, `app/routes/_room.$roomName.room.tsx`
= `/<mødenavn>/room`, osv. `_room.tsx` er en pathless layout-route der
wrapper alle møde-relaterede routes (se §9 for den fulde rute-liste).

## 4. D1-databaseskema

Defineret i [schema.ts](schema.ts) (Drizzle) og opbygget trinvist af
migrationerne i `migrations/*.sql`. Alle tabeller deler disse fire
metadata-kolonner: `id` (autoincrement, undtagen hvor `id` er `text` — se
note), `created`, `modified` (begge `CURRENT_TIMESTAMP`), `deleted` (soft
delete, **ikke faktisk brugt af noget forespørgsel i kodebasen i dag** —
alle sletninger er hårde `db.delete(...)`).

### `Users`

| Kolonne                        | Type                               | Noter                                            |
| ------------------------------ | ---------------------------------- | ------------------------------------------------ |
| `username`                     | text, unique                       | login-navn                                       |
| `email`                        | text                               |                                                  |
| `displayName`                  | text, nullable                     | sat af brugeren selv via `/set-password`         |
| `role`                         | enum: `admin`\|`moderator`\|`user` | default `user`                                   |
| `passwordHash`, `passwordSalt` | text, nullable                     | PBKDF2 (§6.3) — null indtil kontoen er aktiveret |
| `inviteTokenHash`              | text, nullable                     | SHA-256 af invite-tokenet (§6.4)                 |
| `inviteTokenExpires`           | integer (unix ms), nullable        | 7 dage fra oprettelse/gensendelse                |

### `Meetings`

| Kolonne            | Type                                    | Noter                                                          |
| ------------------ | --------------------------------------- | -------------------------------------------------------------- |
| `id`               | text (PK)                               | `crypto.randomUUID()`, genereret af `ChatRoom.createMeeting()` |
| `peakUserCount`    | integer (kolonnenavn i DB: `userCount`) | højeste samtidige deltagerantal, opdateres løbende             |
| `ended`            | text, nullable                          | timestamp — sættes når sidste deltager forlader mødet          |
| `hostPasswordHash` | text, nullable                          | SHA-256 (§6.3), sat af første der "claimer host"               |
| `roomName`         | text, nullable                          | mødets URL-slug (samme som Durable Object'ets navn)            |

Én række pr. **møde-instans**, ikke pr. rum — samme `roomName` får en ny
`Meetings`-række hver gang rummet går fra tomt til besat igen.

### `Rooms`

Pre-konfiguration af et rum-navn, oprettet fra `/admin`, læst af
`ChatRoom.createMeeting()` når et nyt møde starter i det rumnavn.
| Kolonne | Type | Noter |
|---|---|---|
| `id` | text (PK) | rum-navnet selv |
| `lockedByDefault`, `chatEnabledByDefault` | boolean | anvendes kun ved mødets _start_ |
| `presetHostPasswordHash` | text, nullable | SHA-256, kopieres til `Meetings.hostPasswordHash` ved mødestart |
| `reservedBy` | text | altid `'admin'` i dag |

### `ChatMessages`

Append-only kopi af chatbeskeder til historik (se §2). `meetingId` refererer
`Meetings.id`. `fromId` er forbindelses-id'et (ikke en stabil bruger-id).

### `AdminAuditLog`

Én række pr. værts-/admin-handling: `lockRoom`/`unlockRoom`,
`enableChat`/`disableChat`, `muteAll`, `kickUser`, `hostClaimed`. `actorId`
er `'admin'` når handlingen kom fra `/admin`-dashboardet (fjernstyring uden
selv at være i mødet), ellers forbindelses-id'et for personen i mødet.

### `AnalyticsRefreshes` / `AnalyticsSimpleCallFeedback`

Efterladt fra upstream-projektet, stadig aktivt: `AnalyticsRefreshes` logger
hver gang en klient genindlæser lobby-siden (`api.reportRefresh.tsx`, bruges
til at opdage unormalt mange refreshes = muligt problem).
`AnalyticsSimpleCallFeedback` logger et ja/nej-svar på "oplevede du
problemer?" fra `/call-quality-feedback`. Ingen UI læser disse tabeller i
dag — rene skrive-only analytics.

### Adgang til D1

`getDb(context)` (`schema.ts`) returnerer `null` hvis `context.env.DB`
ikke er sat (ingen `[[d1_databases]]`-binding i `wrangler.toml`). **Alt**
kode der bruger D1 tjekker eksplicit for `null` og degraderer i stedet for
at crashe — appen virker stadig uden D1, bare uden konti/historik/presets.
Se CLAUDE.md for status på om D1 er bundet i den aktuelle deployment.

## 5. Durable Object: `ChatRoom`

[app/durableObjects/ChatRoom.server.ts](app/durableObjects/ChatRoom.server.ts)
— hjertet af selve mødet. Én instans pr. rum-navn (`env.rooms.idFromName(roomName)`),
adresseret enten via WebSocket (deltagere) eller direkte HTTP-fetch til
stub'en (admin-fjernstyring, se §5.5). Instansen lever så længe der er
mindst én aktiv forbindelse eller et planlagt alarm; Cloudflare kan til
enhver tid hibernere/genstarte den mellem beskeder — al state der skal
overleve det ligger derfor i `ctx.storage`, ikke i almindelige
klasse-felter (bortset fra `db`, som er billigt at genskabe).

### 5.1 Storage-nøgler (alt er `ctx.storage`, ikke D1)

| Nøgle                                                                                                                                | Indhold                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `meetingId`                                                                                                                          | det aktuelle mødes UUID (matcher en `Meetings`-række hvis D1 findes)                             |
| `session-<connectionId>`                                                                                                             | `User`-objekt (navn, tracks, håndsoprækning, osv.) — én pr. forbundet deltager                   |
| `heartbeat-<connectionId>`                                                                                                           | `Date.now()` for sidste modtagne `heartbeat`-besked, bruges til at opdage døde forbindelser      |
| `hostConnectionIds`                                                                                                                  | `string[]` — kan være flere samtidig (én der har "claimet" host + evt. auto-hostede moderatorer) |
| `roomLocked`                                                                                                                         | boolean                                                                                          |
| `chatEnabled`                                                                                                                        | boolean, default `true` hvis ikke sat                                                            |
| `chat:<sentAt>-<id>`                                                                                                                 | én chatbesked (in-mødet historik, klippes til de seneste 200 ved broadcast)                      |
| `ai:enabled`, `ai:sessionId`, `ai:trackName`, `ai:userControlling`, `ai:userControlling:pending`, `ai:connectionPending`, `ai:error` | AI-i-mødet state (§5.4)                                                                          |

### 5.2 Livscyklus for en deltager

1. Klienten åbner en WebSocket til `/parties/rooms/<roomName>` (routet af
   `app/routes/parties.rooms.$roomName.$.tsx` via `partyserver`s
   `routePartykitRequest`, som finder frem til Durable Object'et).
2. `onConnect`: starter en 15-sekunders alarm hvis ingen kører, tjekker om
   rummet er låst (afviser med `room-locked` medmindre du allerede var
   vært — så du kan genoprette forbindelse), gemmer/genbruger dit
   `User`-objekt, opdaterer `peakUserCount` i D1, gør dig automatisk til
   vært hvis din D1-konto har `role = 'moderator'`, og broadcaster
   opdateret rum-state til alle.
3. `onMessage`: se protokol-tabellen i §5.3.
4. Hvert 15. sekund (`alarm()`): kører `cleanupOldConnections` — enhver
   forbindelse uden et heartbeat inden for det seneste interval fjernes
   (bruger har mistet forbindelsen uden en pæn `userLeft`); hvis ingen
   deltagere er tilbage, kaldes `endMeeting` (stempler `Meetings.ended` i
   D1, og **sletter al Durable Object-storage** for rummet —
   `ctx.storage.deleteAll()`).
5. `onClose`/`userLeft`-besked: rydder forbindelsens storage-nøgler og
   broadcaster.

### 5.3 WebSocket-beskedprotokol

Typer defineret i [app/types/Messages.ts](app/types/Messages.ts).

**Client → Server** (`ClientMessage`): `userUpdate`, `directMessage`,
`muteUser`, `muteAll`\*, `kickUser`\*, `claimHost`, `lockRoom`\*,
`toggleChat`\*, `chatMessage`, `userLeft`, `heartbeat`, `enableAi`,
`disableAi`, `requestAiControl`, `relenquishAiControl`,
`callsApiHistoryEntry` (kun logging), `e2eeMlsMessage` (videresendes råt).
(\* kræver værtsrettigheder — håndhæves server-side af `requireHost()`,
aldrig kun klient-side.)

**Server → Client** (`ServerMessage`): `roomState` (hele rummets state,
broadcastes efter enhver ændring — ingen delta-opdateringer), `error`
(med en kendt fejlkode, se `KnownErrorCode`, eller en rå stack trace i
udviklingsøjeblikke), `directMessage`, `muteMic` (tvinger klienten til at
slukke sin mikrofon), `kicked`, `userLeftNotification`, `e2eeMlsMessage`.

Der findes ingen "diff"-protokol: enhver statusændring sender hele
`roomState` (deltagere, chat, lock, AI) til alle forbundne klienter igen.

### 5.4 Vært/admin-handlinger — delt logik

`performLock`, `performToggleChat`, `performMuteAll`, `performKick` er
**delt** mellem to indgange:

- WebSocket `onMessage`-cases, brugt af en vært der selv er i mødet.
- `onRequest` (`/admin/lock`, `/admin/toggle-chat`, `/admin/mute-all`,
  `/admin/kick`) — et rent HTTP-endpoint på Durable Object'et, kaldt via en
  direkte `stub.fetch(...)` fra
  [app/routes/admin\_.rooms.$roomName.tsx](app/routes/admin_.rooms.$roomName.tsx).
  Dette endpoint **stoler blindt på kalderen** (ingen egen auth-tjek) —
  sikkerheden ligger i at kun den Remix-route (som selv kræver
  `requireAdmin(request)` først) kan konstruere et gyldigt stub-kald; det
  er ikke eksponeret på det offentlige internet.

Alle admin-handlinger logges til `AdminAuditLog` (D1) via `logAdminAction`.

### 5.5 "Claim host"-flowet (`claimHost`-besked)

1. Kræver `ADMIN_USERNAME` sat i miljøet, ellers afvist.
2. Brugernavnet skal matche `ADMIN_USERNAME` (case-insensitive, trimmet).
3. To måder at blive godkendt på:
   - **Master-password**: matcher `HOST_PASSWORD` env-secret → altid host,
     i ethvert rum.
   - **Møde-password**: SHA-256-hash af det indtastede password
     sammenlignes med `Meetings.hostPasswordHash`. **Hvis feltet er tomt**
     (første gang nogen claimer host i dette møde), sættes det til hashen
     af det du lige indtastede — dvs. den første person, der prøver med
     `ADMIN_USERNAME` + et vilkårligt password (min. 4 tegn), _definerer_
     mødets password for resten af mødet.
4. Ved succes tilføjes din connection-id til `hostConnectionIds`.

Bemærk: dette er en **anden** godkendelsesvej end de rigtige
brugerkonti/`/set-username`'s "Som admin"-login (§6) — `claimHost` sker
inde i selve mødets WebSocket-forbindelse og påvirker kun
værtsstatus i det ene møde, ikke din session/cookie.

### 5.6 AI i mødet (OpenAI Realtime)

`enableAi` opretter en Calls-session markeret `thirdparty: true`
([app/utils/openai.server.ts](app/utils/openai.server.ts)), beder Calls om
et nyt lyd-track uden selv at sende et SDP-offer (Calls genererer et), sender
det offer til OpenAI's Realtime WebRTC-endpoint (`OPENAI_MODEL_ENDPOINT`,
med `Authorization: Bearer OPENAI_API_TOKEN`), og fuldfører forhandlingen
ved at give OpenAI's svar tilbage til Calls (`Renegotiate`). Resultatet:
Calls SFU'en har nu et lyd-track der rent faktisk kommer fra OpenAI, som
alle deltagere kan aftage som et helt almindeligt deltager-track (vist som
en "AI"-bruger i `roomState.users`). `requestAiControl`/
`relenquishAiControl` lader én deltager "styre" AI'en (skifte hvem der kan
sende instruktioner) via endnu en Calls track-udveksling. Kun én
kontrol-anmodning ad gangen (`ai:userControlling:pending`-lås).

### 5.7 E2E-kryptering (valgfri, `E2EE_ENABLED`)

MLS-protokol-implementering kørende i en **Rust-til-WebAssembly** web
worker (`public/e2ee/worker.js`, bygget separat via
`rust-mls-worker/build.sh`, ikke af den almindelige Remix-build). Al
nøglehåndtering/kryptering sker **client-side**; serveren/Durable
Object'et ser kun ugennemsigtige `e2eeMlsMessage`-payloads, som den blot
videresender uændret til alle andre i rummet (`broadcastMessage(data,
connection)` — ingen server-side involvering i selve kryptografien).
Bruger `RTCRtpScriptTransform` (Firefox) eller
`RTCRtpSender/Receiver.createEncodedStreams()` (Chrome) til at
kryptere/dekryptere de faktiske medie-frames før de sendes over WebRTC.
Deaktiveret i denne deployment medmindre `E2EE_ENABLED=true` er sat.

## 6. Autentificering, sessions og adgangskoder

### 6.1 To adskilte cookie-sessions

| Cookie            | Fil                                        | Indhold            | Bruges til                                           |
| ----------------- | ------------------------------------------ | ------------------ | ---------------------------------------------------- |
| `__session`       | [app/session.ts](app/session.ts)           | `username`, `role` | "hvem er du" — vises overalt, tjekkes af rum-gaten   |
| `__admin_session` | [app/adminSession.ts](app/adminSession.ts) | `isAdmin: true`    | portvagt for `/admin/*`, tjekket af `requireAdmin()` |

Begge er Remix `createCookieSessionStorage` med et hardkodet
placeholder-secret direkte i koden (**ikke** et rigtigt secret — se
CLAUDE.md's advarsel om dette). En bruger kan sagtens have `role: 'admin'`
i `__session` uden at have `isAdmin` sat i `__admin_session` — de to
sættes altid sammen af koden i praksis (login-flowene sætter begge når
rollen er `admin`), men det er teknisk to uafhængige cookies.

### 6.2 Roller og hvad de giver adgang til

| Rolle               | Kilde                                                          | Rettigheder                                                                                                         |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Gæst (intet `role`) | indtastet visningsnavn, ingen konto                            | kan kun _joine_ et allerede aktivt møde (ikke oprette et nyt ved at gætte et rumnavn); ingen automatisk værtsstatus |
| `user`              | D1 `Users`-konto                                               | samme som gæst, men logget ind med brugernavn/password; kan oprette nye møder                                       |
| `moderator`         | D1 `Users`-konto                                               | automatisk vært (`hostConnectionIds`) i ethvert møde de joiner, ingen manuel "claim host" nødvendig                 |
| `admin`             | D1 `Users`-konto ELLER `ADMIN_USERNAME`+`HOST_PASSWORD`-parret | alt en `user` kan, plus `/admin`-dashboard-adgang                                                                   |

`getUserRole()` ([app/utils/getUsername.server.ts](app/utils/getUsername.server.ts))
læser `role` fra `__session`; `null` betyder gæst (selv hvis et
visningsnavn er sat).

### 6.3 To forskellige password-hash-ordninger — bevidst, ikke en fejl

| Ordning                                      | Fil                                                                  | Bruges til                                                                                                        | Detaljer                                                                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usaltet SHA-256                              | [app/utils/hashPassword.server.ts](app/utils/hashPassword.server.ts) | møde-/rum-host-passwords (`Meetings.hostPasswordHash`, `Rooms.presetHostPasswordHash`), samt invite-token-hashing | ét `crypto.subtle.digest('SHA-256', ...)`-kald, hex-encoded. Lav sikkerhedsmargin er acceptabelt her — det er et delt, kortlivet møde-password, ikke en konto-adgangskode.                                                                                          |
| Saltet PBKDF2 (100.000 iterationer, SHA-256) | [app/utils/passwordHash.server.ts](app/utils/passwordHash.server.ts) | rigtige brugerkontis `Users.passwordHash`/`passwordSalt`                                                          | `hashUserPassword()` genererer 16 tilfældige salt-bytes og afleder 256 bit; `verifyUserPassword()` sammenligner. Krav til selve adgangskoden (mindst 8 tegn, ét stort bogstav, ét tal) håndhæves af [app/utils/validatePassword.ts](app/utils/validatePassword.ts). |

### 6.4 Invite-token-flowet (nye brugerkonti)

1. Admin opretter en konto fra `/admin` (brugernavn, e-mail, rolle) —
   `passwordHash`/`passwordSalt` er `null` indtil aktivering.
2. Et tilfældigt 32-byte token genereres (`generateInviteToken()` i
   `admin.tsx`), **hashes med SHA-256** og gemmes som
   `Users.inviteTokenHash`, med `inviteTokenExpires` sat 7 dage frem. Det
   **rå** token (ikke hashen) indgår i linket der mailes ud.
3. `/set-password?token=<rå-token>` slår tokenet op ved at hashe det
   indkomne token og matche mod `inviteTokenHash`
   (`findUserByToken()`) — udløbne eller ikke-matchende tokens afvises.
4. Ved succesfuld indsendelse: sætter `displayName` + ny
   `passwordHash`/`passwordSalt`, **nulstiller** `inviteTokenHash`/
   `inviteTokenExpires` (tokenet kan ikke genbruges), logger brugeren ind
   (sætter `__session`, og `__admin_session` hvis rollen er `admin`), og
   redirecter til `/`.
5. `resendInvite`-handlingen i `/admin` genererer blot et nyt token og
   overskriver det gamle (det gamle bliver dermed automatisk ugyldigt).

E-mailen sendes via Resend (`RESEND_API_KEY`); uden en nøgle, eller hvis
sendingen fejler, viser `/admin`-dashboardet linket direkte i UI'et til
manuel distribution i stedet.

### 6.5 Gæste-visningsnavne — validering

[app/utils/validateDisplayName.ts](app/utils/validateDisplayName.ts):
maks 10 tegn, kun bogstaver (`A-Za-z` + danske `æøå`), med valgfrie
afsluttende cifre (`^[A-Za-zÆØÅæøå]+[0-9]*$`). Et lille forbogstav rettes
automatisk til stort (`value[0].toUpperCase() + value.slice(1)`) i stedet
for at blive afvist — kun regex-brud, tom streng eller for langt navn
giver en fejl. Gælder **kun** gæste-flowet (`/` og `/set-username`'s
"Fortsæt som gæst") — rigtige brugerkontis `displayName` (sat via
`/set-password`) er ikke underlagt disse regler.

## 7. Video/lyd-kaldet (Cloudflare Realtime SFU)

Selve mødet (`app/routes/_room.tsx` → `_room.$roomName._index.tsx` (lobby)
→ `_room.$roomName.room.tsx` (selve kaldet)) bruger `partytracks`
(`usePeerConnection.tsx`) til at wrappe én `RTCPeerConnection` og forhandle
tracks med Calls API'et gennem
[app/routes/partytracks.$.tsx](app/routes/partytracks.$.tsx) — en tynd
proxy (`routePartyTracksRequest`) der videresender til
`https://rtc.live.cloudflare.com` med `CALLS_APP_ID`/`CALLS_APP_SECRET`,
så den hemmelige nøgle aldrig eksponeres til klienten. ICE-servere (STUN
altid, TURN valgfrit via `getIceServers.server.ts` hvis
`TURN_SERVICE_ID`/`TURN_SERVICE_TOKEN` er sat) leveres af `_room.tsx`'s
loader. Video-encoding-parametre (bitrate, framerate, opløsning,
simulcast on/off) styres af `MAX_WEBCAM_*`/`EXPERIMENTAL_SIMULCAST_ENABLED`
env-variabler. Selve mødedeltager-listen/chat/lock-status kommer **ikke**
fra Calls API'et — det er en helt separat kanal, WebSocket'en til
Durable Object'et (§5).

## 8. Rute-kort (`app/routes/*`)

| Rute                                                                       | Formål                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/`                                                                        | `_index.tsx` — velkomstskærm (gæst/admin-valg) hvis ikke logget ind, ellers dashboard ("Klar til møde") |
| `/set-username`                                                            | Identisk velkomstskærm, target for `return-url`-gaten på beskyttede stier                               |
| `/set-password`                                                            | Aktivering af en admin-oprettet konto via invite-token                                                  |
| `/logout`, `/admin/logout`                                                 | Rydder hhv. `__session` og `__admin_session`                                                            |
| `/new`                                                                     | No-JS-fallback: genererer et tilfældigt rumnavn og redirecter dertil                                    |
| `/<roomName>`                                                              | `_room.$roomName._index.tsx` — lobby (kamera/mik-tjek før join)                                         |
| `/<roomName>/room`                                                         | selve mødet                                                                                             |
| `/admin`                                                                   | dashboard: brugere, rum-presets, seneste møder (`requireAdmin`)                                         |
| `/admin/login`                                                             | admin-login (env-secrets eller D1-konto)                                                                |
| `/admin/setup`                                                             | opretter den _første_ admin uden env-secrets — låser sig selv når én admin findes                       |
| `/admin/rooms/<roomName>`                                                  | fjernstyring af et specifikt aktivt møde (lock/chat/mute/kick) uden selv at joine                       |
| `/parties/rooms/<roomName>/*`                                              | WebSocket-indgang til `ChatRoom`-Durable-Object'et                                                      |
| `/partytracks/*`                                                           | proxy til Cloudflare Calls API                                                                          |
| `/api/bugReport`, `/api/deadTrack`, `/api/debugInfo`, `/api/reportRefresh` | fejlrapportering/telemetri (Sentry-lignende, se `RELEASE`)                                              |
| `/call-quality-feedback`                                                   | simpelt ja/nej-feedback efter et opkald                                                                 |
| `/site.webmanifest`                                                        | PWA-manifest, navn afledt af `APP_NAME`                                                                 |

## 9. Miljøvariabler / secrets (`app/types/Env.ts`)

| Navn                                                                        | Påkrævet?                               | Formål                                                                                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `CALLS_APP_ID`, `CALLS_APP_SECRET`                                          | Ja                                      | Cloudflare Realtime SFU-adgang                                                                                                         |
| `CALLS_API_URL`                                                             | Nej                                     | override af Calls API-base-URL                                                                                                         |
| `DB` (D1-binding)                                                           | Nej                                     | se §4 — uden den er konti/historik/presets inaktive                                                                                    |
| `ADMIN_USERNAME`, `HOST_PASSWORD`                                           | Nej (men nødvendig for værtsfunktioner) | delt admin-login + master-host-password                                                                                                |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                       | Nej                                     | invite-mails; uden nøgle vises linket manuelt i stedet                                                                                 |
| `TURN_SERVICE_ID`, `TURN_SERVICE_TOKEN`                                     | Nej                                     | Cloudflare TURN-tjeneste til NAT-traversal                                                                                             |
| `MAX_WEBCAM_BITRATE`, `MAX_WEBCAM_FRAMERATE`, `MAX_WEBCAM_QUALITY_LEVEL`    | Nej                                     | video-encoding-lofter                                                                                                                  |
| `EXPERIMENTAL_SIMULCAST_ENABLED`                                            | Nej                                     | slår simulcast-encoding til                                                                                                            |
| `E2EE_ENABLED`                                                              | Nej                                     | slår MLS-baseret ende-til-ende-kryptering til                                                                                          |
| `OPENAI_API_TOKEN`, `OPENAI_MODEL_ENDPOINT`, `OPENAI_MODEL_ID`              | Nej                                     | AI-i-mødet (§5.6)                                                                                                                      |
| `USER_DIRECTORY_URL`                                                        | Nej                                     | ekstern brugerdirectory-opslag til display-navn/foto (bruges kun hvis sat — upstream-feature, ikke aktiv i denne deployment)           |
| `FEEDBACK_URL`, `FEEDBACK_QUEUE`, `FEEDBACK_STORAGE`                        | Nej                                     | ekstra feedback-pipeline fra upstream — **ikke bundet** i denne deployments `wrangler.toml`, så `feedbackEnabled` er altid `false` her |
| `DISABLE_LOBBY_ENFORCEMENT`                                                 | Nej                                     | upstream-flag, ikke brugt af nogen kode i denne fork                                                                                   |
| `API_EXTRA_PARAMS`, `MAX_API_HISTORY`, `TRACE_LINK`, `DASHBOARD_WORKER_URL` | Nej                                     | debugging/observability-detaljer til Calls API-kald                                                                                    |

## 10. Deployment-pipeline

Vigtigt at forstå: **to uafhængige systemer** reagerer på et push til
`main`, og de blokerer ikke hinanden:

1. **GitHub Actions** (`.github/workflows/check.yml`) kører
   `npm ci && npm run build && npm run lint && npm run typecheck && npm run test:ci`
   som separate, sekventielle steps — fejler ét step, springes resten
   over (typecheck/test vises som "skipped", ikke "failed", hvilket kan
   skjule fejl i lang tid, se CLAUDE.md's log-post om `.eslintrc.cjs`-
   hændelsen). Der er også en Semgrep-workflow. **Ingen af disse deployer
   noget** — de er rene kvalitetstjek.
2. **Cloudflare Workers Builds** — Cloudflares egen git-integration, sat op
   direkte i Cloudflare-dashboardet til at bygge og deploye
   `fn-voresevents-meet-2026`-worker'en (den faktiske `wrangler.toml`)
   ved hvert push til `main`, helt uafhængigt af GitHub Actions' resultat.
   Dette er den reelle deploy-mekanisme for tjekind.voresevents.com.

**Fælde at kende til**: repoet indeholder også
`wrangler.development.toml`, `wrangler.staging.toml`,
`wrangler.production.toml`, `wrangler.public.toml` og `wrangler.e2ee.toml`
— disse er **efterladt fra det oprindelige Cloudflare-template**
("orange-meets-development" osv., med deres egne separate Calls-app-id'er
og D1-databaser) og bruges **ikke** af denne deployment eller af
`npm run deploy`/Cloudflare Workers Builds (som begge bruger den
navnløse, base `wrangler.toml`). De optræder kun i `package.json`'s
`db:migrate:development/staging/production`-scripts. Rør dem ikke uden at
forstå at de peger på en helt anden Cloudflare-konfiguration end den der
rent faktisk kører.

## 11. Kendte skarpe kanter / ting der overrasker

- Cookie-session-secrets er hardkodede placeholder-strenge i
  `session.ts`/`adminSession.ts`, committet til repoet — ikke rigtige
  hemmeligheder.
- `Meetings.peakUserCount`'s faktiske DB-kolonnenavn er `userCount`
  (Drizzle-feltnavnet blev omdøbt uden en tilsvarende kolonne-rename).
- `deleted`-kolonnen på alle tabeller er soft-delete-forberedelse, men
  intet i kodebasen sætter eller filtrerer på den i dag.
- To adskilte "bliv vært"-veje findes side om side: `claimHost` (inde i et
  møde, password-baseret, §5.5) og rigtige `moderator`/`admin`-konti
  (automatisk/via login, §6.2) — de påvirker ikke hinanden.
- `RoomState`-broadcasts er altid "hele state", ikke deltas — hold det for
  øje ved performance-arbejde med mange deltagere.
