# Autoritetsmodellen for klubbbetalinger — beslutningsfrys + faseplan

> **Status: GODKJENT AV BRAGE 2026-08-18 (GO på Del II + faseplanen,
> med B1–B6 avgjort — se Del III).** Del II er LÅST; endringer krever
> eksplisitt omkamp. Fasene i Del V bygges i rekkefølge med stopp for
> review per fase (gate-regelen fra PAYMENTS.md).
>
> Dette dokumentet ERSTATTER den gamle «Klubbdør-skiva»-planen. Kanonisk
> beslutningstekst speiles i `PAYMENTS.md` §«Autoritetsmodellen v2» —
> dette dokumentet bærer i tillegg full faseplan, verifikasjon, dogfood og
> rollback. Grunnlaget er kartleggingen + beslutningsrunden i chat
> 2026-08-18.
>
> **To eksplisitte produksjonskrav (Brage, ved GO):**
> 1. **Dette er produksjonsklar v1 for full lansering** — «MVP» og
>    «pilot» brukes ikke som avgrensning av leveransen. Fasing er lov;
>    midlertidige appskjermer, døde brukerreiser og kastekode er ikke.
> 2. **Rå SQL er aldri normal flyt** for renominasjon, managerreparasjon,
>    duplikathåndtering eller lagflytting — disse skal ha auditerte
>    RPC-er og ops-flater FØR lanseringsporten kan passeres.
>    `hello@heiaapp.no` kan være kontaktkanalen; behandlingen bak er en
>    ordentlig produktflyt.

---

## Del I — Hvorfor (funnene som tvang frem revisjonen)

Kartlagt mot koden 2026-08-18, fullstendig gjennomgang i chatloggen:

1. **Claimant ≡ fullmaktshaver ≡ første betalingsansvarlige** er antakelsen
   i `00048` (approve gir claimanten rollen automatisk, linje 94–99) —
   samtidig som KYC-flyten er designet for at *en annen* fullfører hos
   Stripe. Kassereren er ofte ikke Heia-bruker og kan ikke engang være
   claimant (`submit_club_claim` krever lagadminskap, `00038:89`).
2. **KYC-lenken deles fritt** (Share-arket i SupportSetupScreen) — i strid
   med Stripes føringer for Account Links (autentisert plattformbruker,
   ikke distribusjon via e-post/melding).
3. **Autoritet er scopet til den sosiale klubbraden** (`clubs.id`) mens
   penger/konto er scopet til den juridiske enheten — duplikatrader gir to
   manager-kretser rundt én konto, og en ny duplikatrad kan **arve en
   aktiv konto** ved godkjenning (`00048:84–92`).
4. **Manager-rollen mangler livssyklus**: ingen invitasjon (besluttet, aldri
   bygget), ingen fjerning/suspensjon/historikk utover DELETE.
5. **Lagforespørsel mot managerløs klubb** lykkes stille med null varsel-
   mottakere (`00047:244–260`).
6. Døde statuser (`expired`, `ended`), delfeil ved deaktivering uten
   UI-vei tilbake, runbook-SQL som normal arbeidsflyt (defaults-seeding,
   manager-seeding).

---

## Del II — BESLUTNINGSFRYSEN (låses ved GO)

### II.1 Arkitektur som består (uendret)

Klubb/juridisk enhet er betalingsmottaker · lag er interne destinasjoner ·
tre porter · Stripe eier KYC, bankinfo og utbetalingsstatus · Stripe-status
endres kun av webhooken · checkout, Customer Portal, offering/pris/splitt,
idempotens, immutable transaksjoner, deny-by-default og SECURITY
DEFINER-RPC-er består · app og web deler samme backend, roller og
tilstander (Postgres/RPC = eneste sannhetskilde).

### II.2 Modellen (brukerrettet flyt)

«Claim» er kun teknisk begrep. Brukeren møter **«Aktiver støtte for
[klubb]»**, spørsmålet **«Hvem skal være betalingsansvarlig?»** («Jeg» /
«En annen i klubben»), invitasjonen **«Bli betalingsansvarlig»**, og
port 3-forespørselen «Be om godkjenning» (som i dag).

1. Trener/lagleder/admin starter aktiveringen (dagens gate).
2. Betalingsansvarlig **nomineres** i skjemaet (selv, eller navn + e-post
   for en annen; telefon valgfritt).
3. Heia Ops verifiserer **organisasjonen OG den nominerte personen**
   (claim-notify-beviset utvides: navnematch mot styret gjøres for den
   nominerte).
4. Selvnominasjon → rollen tildeles **eksplisitt** ved godkjenning.
5. Nominasjon av annen → **sikker invitasjon opprettes ved godkjenning**
   (aldri før — claim-behandlingen venter aldri på tredjepart).
6. Aksept skjer **på nettsiden**. Ingen midlertidig appaksept bygges.
   «En annen»-valget i appen aktiveres først når web-landingen er live
   (featureflagg) — ingen død brukerreise i mellomtiden.
7. **Kun aktiv betalingsansvarlig** (eller eksplisitt ops-handling) kan
   starte/fortsette Stripe-onboarding. Share-arket fjernes.
8. Når Stripe-kontoen er aktiv (kanonisk predikat, II.5), kan
   betalingsansvarlig godkjenne lag.
9. Port 3 fortsetter ellers som bygget.

**Ingen får betalingsmyndighet automatisk** — ikke klubb-/lagoppretter,
ikke claimant (uten verifisering), ikke KYC-utfører. Hver tildeling er en
eksplisitt, logget beslutning (ops-godkjenning eller akseptert invitasjon).

### II.3 Autoritetsscope

`betalingsansvarlig` scopes til **`legal_club_entities`** (orgnr), ikke
`clubs.id`. Én myndighetskrets per organisasjon uansett antall klubbrader.
Avdelingsdelegering er en senere utvidelse (Del IV) som enhets-scopet ikke
blokkerer. En ny klubbrad med samme orgnr kan **aldri** skape ny
myndighetskrets, arve aktiv Stripe-konto eller bli betalingsaktiv uten
uttrykkelig behandling (II.8).

### II.4 Tilstandsmodellen (eierskap, ingen duplisering)

| Dimensjon | Eier | Verdier |
|---|---|---|
| Søknad | `club_claims.status` | `submitted → in_review → approved \| rejected`. Info-behov = `in_review` + `info_request_note` (dagens). `needs_information` innføres ikke. Død `expired`-verdi fjernes fra CHECK. |
| Org-verifisering | `legal_club_entities.verification_status` + aktiv link | `unverified → verified` (`revoked` består som ops-nødbrems) |
| Invitasjon | `manager_invitations.status` (ny) | `pending → accepted \| awaiting_review \| declined \| revoked \| expired`; `awaiting_review → accepted \| revoked`. Ny invitasjon = ny rad. |
| Myndighet | `club_payment_managers` + `status` | `active ↔ suspended`; fjerning = DELETE + hendelse i append-only logg |
| Stripe-konto | `club_payment_accounts.status` | uendret, kun webhook-eid |

Brukerens tilstand avledes i `get_support_activation_status`. Ny avledet
verdi: **`awaiting_manager`** = verifisert enhet med aktiv link, men ingen
aktiv betalingsansvarlig for enheten (dekker: invitasjon pending /
awaiting_review / declined / expired, og managerløs klubb).

**Kanonisk «klubben er aktiv»**: kontorad med `status='active'` AND
`charges_enabled` (AND `provider_account_id IS NOT NULL` som
belt-and-braces) — nøyaktig det `get_payment_account_for_team_space`
(00037:509) og checkout-gaten allerede krever. Predikatet trekkes ut i én
intern hjelper `payment_account_ready_for_team_space(ts_id)` (REVOKE-d fra
klienter, uten medlemsgate — betalingsansvarlig er ikke nødvendigvis
lagmedlem). `get_payment_account_for_team_space` beholder sitt utadrettede
medlemsgatede kontrakt og bruker hjelperen internt; `approve_team_support`
bruker **samme hjelper** (ingen svakere parallellsjekk); checkout-Edge-
gatens kriterier dokumenteres som speil av samme predikat.

Kjeden: **Godkjent av Heia → betalingsansvarlig har akseptert → Stripe
aktiv → laget godkjent → innsamling aktiv.** Ops-godkjenning betyr aldri
at støtte er aktiv. `approve_team_support` krever kanonisk aktiv konto
(+ defaults, som i dag); **avslag er alltid mulig**, uavhengig av
kontostatus.

### II.5 Invitasjoner

Dekker: første betalingsansvarlige (nominee ≠ claimant), flere
betalingsansvarlige, erstatning, reparasjon av managerløs klubb, re-utstedelse
etter utløp/feil kontakt. Krav (alle låst):

- 256-bit engangstoken; **kun SHA-256-hash lagres**; token leveres i
  URL-fragment (`#`), aldri query (holder tokenet unna serverlogger).
- 14 dagers levetid; påminnelse dag 7; **utløp håndheves ved innløsning**
  (lat); cron (`pg_cron`, 00055-mønsteret) flipper status og sender
  påminnelse/utløpsvarsler.
- Atomisk engangsbruk (status-flip vinner racet). Revocation + reissue
  (ny rad, nytt token). Alle hendelser OG forsøk (også ugyldige/utløpte)
  logges.
- Innløsning krever innlogget, **e-postverifisert** Heia-konto.
  Landingssiden viser juridisk navn, invitert navn og innlogget konto.
- **Avvikskontroll (B1, låst):** automatisk aktivering KUN ved eksakt
  normalisert (trim + case-insensitiv) match mellom kontoens verifiserte
  e-post og invitert e-post → `accepted` + aktiv rolle. **Alt annet
  avvik → `awaiting_review`**: ingen aktiv manager-rad, ingen
  Stripe-tilgang; aksepten registreres med avviksdata (kontoens e-post,
  profilnavn, automatisk navnematch mot invitert navn som
  beslutningsstøtte — aldri alene-grunnlag for automatisk myndighet,
  profilnavn er spoofbart), ops varsles og må godkjenne/avvise gjennom
  auditert RPC/ops-flate. Ops-avvisning → `revoked` med note; innløseren
  varsles. Et ops-varsel i etterkant av aktiv rolle er IKKE tilstrekkelig
  — kontrollen skjer FØR aktivering.
- **Token-håndtering (B3, låst):** rå-tokenet eksisterer aldri i
  databasen eller pg_net-køen — det genereres i `payments-notify` i
  utsendelsesøyeblikket, hashen skrives på invitasjonsraden (betinget,
  engangs), og rå-tokenet lever kun i Edge Function-minnet og e-posten.
  Påminnelsen dag 7 ROTERER tokenet (ny hash, e-posten sier at ny lenke
  erstatter den forrige — halverer levetiden til en lekket lenke).
  Web-akseptsiden: leser tokenet fra fragmentet, fjerner det umiddelbart
  fra adressefeltet med `history.replaceState`, laster INGEN
  tredjepartsskript, og sender tokenet kun i kall til Supabase
  (aldri referrer, aldri logget).

### II.6 Rolleadministrasjon (produksjonsflyter, aldri SQL-runbook)

Ved full lansering finnes UI + RPC for alt av normal drift:

- **Manager-selvbetjening (web + app):** en aktiv betalingsansvarlig kan
  invitere en ny betalingsansvarlig. Auditert (append-only, med
  utsteder); varsler alle øvrige aktive ansvarlige. **Ingen rutinemessig
  ops-e-post per normal invitasjon (B5)** — ops ser hendelsen i
  ops-flaten, og varsles aktivt KUN ved unntak: identitetsavvik,
  managerløs klubb, sikkerhetsavvik (f.eks. forsøk fra suspendert
  utsteder — avvises og varsles) eller andre avvik. Samme
  avvikskontroll som all innløsning. Første betalingsansvarlige og
  ops-utstedte reparasjonsinvitasjoner forblir ops-behandling.
- **Ops-flater (app nå, web i fase B):** utsted/re-utsted/trekk tilbake
  invitasjon · bekreft/avvis `awaiting_review` · suspender/reaktiver
  ansvarlig · fjern ansvarlig · flytt lag til riktig klubbrad (II.8).
- **Siste-aktive-vernet:** administrativ fjerning av siste aktive
  ansvarlige avvises. Ops-suspensjon av siste er LOV (sikkerhet trumfer —
  ops gjør det med åpne øyne og enheten går til `awaiting_manager`).
  **Kontosletting (GDPR) kan aldri nektes** — den utløser umiddelbart
  ops-varsel og riktig avledet tilstand.
- **Append-only logg** (`payment_authority_events`): tildeling, aksept,
  suspensjon, reaktivering, fjerning, alle invitasjonshendelser og
  -forsøk, review-beslutninger, lagflytting. `forbid_mutation`-trigger.
- **Automatisk defaults-seeding (B2, låst — ren kopi-semantikk i tre
  ledd, aldri levende fallback):** global `heia_support_defaults`-rad
  (79/60, det sandbox-verifiserte prispunktet) → kopieres ÉN gang inn i
  enhetens eksplisitte konfig (`club_support_defaults`, **re-scopet til
  legal_club_entity_id** i samme migrasjon — ellers gjenoppstår
  duplikatrad-spriket for pris) ved klubbgodkjenning; gjenbrukt enhet
  beholder alltid sin konfig → lag-godkjenning arver fra enhetens
  konfig og fryser den i immutable, versjonerte offerings (00037-
  invarianten). En global endring når dermed kun NYE aktiveringer —
  aldri eksisterende klubber, lag, offerings eller abonnementer,
  verken direkte eller indirekte. Nytt prispunkt krever fortsatt
  avrundingssjekk i sandbox før den globale raden endres. Runbook-SQL-en
  i PAYMENTS.md utgår som normalflyt.
- `hello@heiaapp.no` forblir kontaktkanal — behandlingen skjer i flatene.

### II.7 Claims og duplikater

- **Maks én åpen aktiveringsprosess per normalisert orgnr** (partiell unik
  index på tvers av klubbrader; dagens per-rad-index består).
- **Håndheves ved `submit`** med brukerrettet stopp: allerede aktivert
  orgnr → «[Juridisk navn] er allerede aktivert for støtte i Heia …
  kontakt hello@heiaapp.no, så kobler vi laget riktig»; åpen prosess →
  «det pågår allerede en aktivering for denne klubben».
- **Forsvar i dybden ved `approve`:** enhet med aktiv link til annen
  klubbrad, eller konto med påbegynt/fullført onboarding → EXCEPTION.
  Stille gjenbruk av aktiv link/kontostatus fjernes. Legitim
  enhet-gjenbruk består kun når ingen aktiv link finnes noe sted
  (re-aktivering etter endt kobling).
- **Lag under feil/duplikat klubbrad** repareres med auditert ops-RPC +
  ops-flate (`ops_move_team_to_club`) — aldri rå SQL. Hovedverktøyet er
  lagflytting til kanonisk rad; linking av ekstra rad reserveres reelle
  tilfeller og skaper uansett aldri ny myndighet (enhets-scopet).

### II.8 Stripe

Account Link genereres fersk ved klikk, lagres aldri, åpnes av autentisert
bruker i app/web, distribueres aldri via e-post/melding. Kun aktiv
betalingsansvarlig (eller eksplisitt ops-rettighet) kan generere. Heia
lagrer ingen KYC-identitet eller bankopplysninger (webhook-utdraget
består uendret). Stripe beholder representant, identitetskontroll og krav.
App/web viser kun status + neste handling.

### II.9 Varsling (komplett matrise ved lansering)

| Hendelse | Mottakere |
|---|---|
| Invitasjon utstedt | invitert e-post (gated: sendes kun når web-landingen er live) |
| Påminnelse dag 7 | invitert e-post |
| Utløpt / avslått | claimant (app-varsel) + ops (e-post) |
| Akseptert | claimant (app) + øvrige aktive ansvarlige (app + e-post) |
| Innløst med avvik (`awaiting_review`) | ops (e-post) — rolle IKKE aktiv |
| Manager-utstedt invitasjon | øvrige aktive ansvarlige (app + e-post). **Ikke ops-e-post (B5)** — synlig i ops-flaten; ops-e-post kun ved unntak (avvik, suspendert utsteder, managerløs) |
| Ny lagforespørsel | alle aktive ansvarlige: inbox/push (dagens) **+ e-post** |
| Lagforespørsel uten aktive ansvarlige | forespørselen opprettes, **ops får e-post som fallback-mottaker**; trenerkortet sier at Heia er varslet. Ingen forespørsel forsvinner til null mottakere. |
| Siste ansvarlige slettet/suspendert → managerløs enhet | ops (e-post) |
| Identitetsavvik ved innløsning | ops (e-post) |

### II.10 App/web-arbeidsdeling

**Web (før full lansering):** invitasjonslanding, innlogging/opprettelse,
aksept/avslag, Stripe-onboarding, Klubbbetalinger, rolleadministrasjon,
Heia Ops, https-retur/deep-links, server-side Brønnøysund-validering.
**Appen:** starte aktivering, selv-/annen-nominasjon, følge hele statusen,
Klubbbetalinger for eksisterende ansvarlige, lagforespørsel/port 3.
Samme RPC-er overalt. Ingen invitasjons-e-post før web-landingen finnes.

### II.11 Eksplisitt erstattede beslutninger (omkamp tatt 2026-08-18)

1. ~~«approve_club_claim gir claimanten rollen automatisk» (00048,
   2026-08-03)~~ → eksplisitt tildeling/invitasjon (II.2).
2. ~~Rolle scopet til `clubs.id` (00047)~~ → juridisk enhet (II.3).
3. ~~«Del lenken med klubben»-Share-arket (fase 3)~~ → fjernes (II.8).
4. ~~KYC-lenke gated på lagadminskap (stripe-onboarding)~~ → aktiv
   betalingsansvarlig (II.8).
5. ~~«Invitasjonsflyt bygges bevisst ikke; ops seeder» (PAYMENTS.md)~~ →
   bygges nå (II.5–II.6).
6. ~~Ops-runbook-SQL for defaults-seeding og manager-seeding~~ →
   produksjonsflyter (II.6).
7. ~~Stille gjenbruk av enhet + kontostatus ved duplikat-claim (00038/48)~~
   → hard stopp (II.7).

---

## Del III — Beslutningspunktene B1–B6: AVGJORT av Brage 2026-08-18

- **B1 — identitetsavvik:** ✅ auto-aktivering kun ved eksakt normalisert
  e-postmatch mot innlogget, e-postverifisert konto. Ved avvik: ingen
  aktiv rolle/Stripe-tilgang; `awaiting_review`; ops godkjenner/avviser
  via auditert RPC/ops-flate; navnematch er beslutningsstøtte, aldri
  alene-grunnlag. (Innarbeidet i II.5.)
- **B2 — globale standarder:** ✅ `heia_support_defaults` (79/60) med
  ren kopi-semantikk: global → enhetens eksplisitte konfig ved
  aktivering → immutable versjonerte offerings ved lag-godkjenning.
  Global endring påvirker kun nye aktiveringer — aldri retroaktivt.
  Konfliktsjekken Brage ba om er gjort: modellen har INGEN levende
  global fallback. Konsekvensjustering: `club_support_defaults`
  re-scopes til enheten i 00062. Erstatter manuell seeding.
  (Innarbeidet i II.6.)
- **B3 — token i URL-fragment:** ✅ med kravene: aldri logget/referrer,
  `history.replaceState` etter lesing, ingen tredjepartsskript på
  akseptsiden, engangs/hashet/tidsbegrenset/atomisk. Design-konsekvens:
  rå-token genereres i `payments-notify` (aldri i DB/pg_net-kø);
  påminnelsen roterer tokenet. (Innarbeidet i II.5.)
- **B4 — web-stack:** ⏳ HOLDES ÅPEN gjennom A1–A3; avgjøres og
  dokumenteres FØR første produksjonskode i fase B, vurdert mot
  eksisterende repo, Supabase Auth, https-retur, sikker tokeninnløsning,
  drift og delte typer/forretningsregler app/web. Blokkerer ikke A1.
- **B5 — ops-kopi på managerinvitasjoner:** ✅ NEI til rutinemessig
  ops-e-post (støy, skalerer dårlig). Øvrige aktive ansvarlige varsles;
  invitasjon+utsteder logges append-only; ops ser hendelsen i flaten;
  ops varsles aktivt kun ved unntak (avvik, managerløs, sikkerhetsavvik,
  suspendert utsteder). Første ansvarlige + reparasjonsinvitasjoner
  forblir ops-behandling. (Innarbeidet i II.6/II.9.)
- **B6 — profilrydding:** ✅ tas ETTER A2 (når nye appflater/innganger
  er stabile), men FØR samlet lanserings-QA. Blokkerer ikke A1/
  datamodellen.

## Del IV — Senere produktutvidelser (bevisste, ikke gjeld)

Avdelingsdelegering under enheten · selvbetjent koblingsgodkjenning av
duplikatrad hos eksisterende ansvarlig · selvbetjent renominasjon fra
trener («foreslå en annen») · overføringsveiviser (i dag: inviter ny +
fjern gammel) · step-up-friksjon før deaktivering (skriv klubbnavnet) ·
auto-expiry på claims (ops-avslag er ryddemekanismen nå) · klubbmerge-
verktøy · Vipps/engangsbetalinger m.m. (uendret fra PAYMENTS.md).

---

## Del V — FASEPLAN

Gate-regelen gjelder: hver fase stopper for Brages review. Alt i Stripe
**testmodus**; live-bytte er fortsatt aller siste steg i hele
betalingssporet.

### Fase A1 — backend-autoritetsmodellen

**Migrasjon `00062_autoritetsmodell.sql`** (én transaksjon):

1. `club_payment_managers`: ny `legal_club_entity_id` (FK, NOT NULL etter
   backfill) + `status` ('active','suspended', default 'active');
   UNIQUE (legal_club_entity_id, user_id); backfill via klubbradens
   aktive link (deterministisk — N:1); **rader uten aktiv link slettes**
   (= Stange-dogfood-rester; listes i verify-output); DROP `club_id`;
   nye indekser.
2. Ny `manager_invitations`: entity-FK, invited_name, invited_email,
   invited_phone, token_hash (UNIQUE), status-CHECK (II.4), source
   ('claim','ops','manager'), claim_id (nullable FK), created_by,
   expires_at, reminded_at, accepted_by/at, decided_by/at, note,
   mismatch jsonb. Deny-all RLS.
3. Ny `payment_authority_events` (append-only, `forbid_mutation`):
   entity-FK, subject_user_id, invitation_id, event-CHECK (granted,
   accepted, suspended, reactivated, removed, invite_issued,
   invite_reminder, invite_revoked, invite_declined, invite_expired,
   invite_redeemed_review, review_confirmed, review_rejected,
   invite_attempt_invalid, team_moved), actor_user_id, note, metadata
   jsonb. Deny-all RLS.
4. `club_claims`: + `nominee_is_self` (bool, backfill true),
   `nominee_name`, `nominee_email`, `nominee_phone`; CHECK-en mister
   `expired` (aldri satt — verifiseres i migrasjonen); ny partiell unik
   index på `claimed_org_number WHERE status IN ('submitted','in_review')`.
5. Ny `heia_support_defaults` (singleton-rad, B2) + seed 7900/
   fixed_club_amount/2405/6000; `club_support_defaults` RE-SCOPES til
   `legal_club_entity_id` (ny kolonne, backfill via aktiv link, ny PK,
   DROP club_id — kun Ridabu-raden finnes).
6. `submit_club_claim` v2: nominee-parametre + orgnr-vaktene fra II.7
   (aktivert enhet / åpen prosess) med brukerrettede meldinger.
7. `approve_club_claim` v3: hard-stoppene (II.7); selv-nominasjon →
   manager-rad (enhets-scopet) + `granted`-event; annen-nominasjon →
   invitasjonsrad + `invite_issued`-event (e-post via trigger, gated);
   auto-seed av `club_support_defaults` fra `heia_support_defaults`;
   auto-manager-INSERT-en fra 00048 FJERNES.
8. Invitasjons-RPC-er: `redeem_manager_invitation(token)` (authenticated;
   hash-oppslag, lat utløp, atomisk flip; e-postmatch → accepted + rolle;
   ellers awaiting_review + mismatch-data), `decline_manager_invitation`,
   `issue_manager_invitation` (aktiv manager for enheten; source
   'manager'), ops-settet: `ops_issue_manager_invitation`,
   `ops_revoke_manager_invitation`, `ops_confirm_invitation_review`,
   `ops_reject_invitation_review`, `ops_suspend_manager`,
   `ops_reactivate_manager`, `ops_remove_manager` (siste-aktive-vern),
   `ops_move_team_to_club` (auditert; `team_moved`-event),
   `ops_list_payment_entities` (ops-oversikten: enheter, managere,
   invitasjoner, review-kø). Alle self-gated, alle logger events.
9. Kanonisk predikat: intern `payment_account_ready_for_team_space(ts_id)`
   (REVOKE-d fra klienter); `get_payment_account_for_team_space`
   refaktoreres oppå (uendret kontrakt); `approve_team_support` bruker
   den (+ defaults-krav som før; reject uendret alltid-lov).
10. `is_club_payment_manager` → `is_entity_payment_manager` +
    team-space-basert wrapper for eksisterende kallsteder (aktiv status
    kreves); `is_payment_manager_anywhere` filtrerer på status='active'.
11. `get_club_payments_overview` v2: enhets-gruppert (lag via alle aktivt
    lenkede klubbrader); + manager-/invitasjonsliste (rolleadmin-data);
    + `unresolved_cancellations` per lag (levende abonnementer uten
    cancel_at der siste dørhandling er deactivate) — **delfeil-fiksen**.
12. `get_support_activation_status` v4: `awaiting_manager` +
    nominee-/invitasjonsstatus i grovkorn for trenerkortet; KYC-flagg
    (`can_onboard`) kun for aktiv manager.
13. `request_team_support_approval` v2: varsler via enhetens aktive
    managere; 0 aktive → ops-fallback-flagg (e-post via trigger).
14. `delete_account_data`: manager-DELETE → `removed`-event + managerløs-
    deteksjon → ops-varsel-trigger.
15. Grants-hygiene (GRANT authenticated + REVOKE PUBLIC/anon på alt nytt;
    service-role-only der det hører hjemme).

**Migrasjon `00064_redeem_outcomes.sql`** (funnet av verify-00062
test 21): PL/pgSQL ruller tilbake ALT arbeid i en funksjon som
avslutter med `RAISE EXCEPTION` — også hendelsesloggingen og
statusflippen. Tre låste krav var derfor ikke oppfylt i praksis
(«alle forsøk logges», «utløp håndheves ved innløsning»,
sikkerhetsvarsel ved suspendert utsteder). Sikkerheten var aldri
svekket — ingen fikk rolle — men sporet forsvant. **Fiks:** forventede
utfall RETURNERES som outcome i stedet for exception, så sideeffektene
committer. **Kontrakt (bindende for A2 + web):**
`redeem_manager_invitation` → `accepted | awaiting_review | invalid |
expired | suspended`; `decline_manager_invitation` → `declined |
invalid`; `issue_manager_invitation` → `issued (+invitation_id) |
suspended`. Exceptions beholdes kun der ingen sideeffekt skal bevares
(ikke innlogget, uverifisert e-post, ugyldig input, duplikat, manglende
rolle). `invalid` skiller bevisst ikke ukjent/brukt/trukket token —
ops ser forskjellen i hendelsesloggen.

**Migrasjon `00063_autoritet_varsling.sql`:** cron-jobb
`heia-manager-invitations` (daglig: reminder dag 7, expiry dag 14 med
status-flip, claimant-varsler og managerløs-sjekk; `cron.unschedule`-
guard som 00055). NB: selve pg_net-hjelperen
(`notify_payments_event(type, payload)`, 00044-vault-idiomet) bor i
00062 fordi RPC-ene der kaller den — 00063 er kun tidsstyringen.

**Edge Functions:**
- NY `payments-notify` (service-key-autentisert som claim-notify; Resend;
  én funksjon, `type`-felt for alle II.9-e-postene). **Token-eierskap
  (B3):** for `invitation`/`reminder` genererer funksjonen selv 256-bit
  token, skriver SHA-256-hashen betinget på invitasjonsraden (engangs;
  reminder ROTERER hashen) og setter `sent_at`/`reminded_at` etter
  Resend-OK — rå-tokenet finnes aldri i DB eller pg_net-kø.
  Invitasjonslenke bygges kun når `WEB_INVITE_BASE_URL`-secret er satt —
  ellers logges skip og `sent_at` forblir NULL (synlig i ops-flaten).
  E-post til inviterte er DERMED strukturelt gated på web-landingen.
- `stripe-onboarding`: gate byttes fra lagadmin-i-laget til aktiv
  betalingsansvarlig for enheten (+ ops-admin-unntak); ellers uendret.
- NY `submit-club-claim`: tynn wrap som gjør server-side
  Brønnøysund-validering (404/inaktiv → 4xx med samme meldinger som
  klienten; nedetid → fail-open, dagens prinsipp) og kaller RPC-en.
  Appen (og senere web) bytter til denne; klientens brreg-oppslag
  beholdes kun som UX (navne-prefill).
- `club-support-deactivate`: manager-oppslag via enhet (ellers uendret).
- `claim-notify`: nominee-bevis (navnematch mot styret for nominee;
  nominee-info i e-posten).

**Verifikasjon `verify-00062.sql`** (spike-mappe-mønsteret, selvforsynt,
ruller alltid tilbake; dekker 00062+00063+00064, 38 tester) — minimum: backfill-korrekthet (Ridabu → enhet;
foreldreløse slettet) · orgnr-unik åpen claim (race) · submit-stopp mot
aktivert enhet og åpen prosess · approve-hardstopp mot aktiv link/påbegynt
konto · selv-nominasjon → rolle + event, ingen rolle ved annen-nominasjon ·
redeem: match → rolle; avvik → awaiting_review UTEN rolle; token engangs;
utløp lat; revoke/reissue · ops-review-beslutningene · siste-aktive-vernet
(remove avvises; suspend tillates) · kontosletting → event + managerløs ·
`approve_team_support` krever kanonisk aktiv + defaults; reject uten ·
delfeil-telleren · enhets-scopet overview · lagflytting auditert ·
forbid_mutation på events · at forsøkslogg, utløpsflipp og
sikkerhetsvarsel OVERLEVER (00064) · decline-flyten · anon=false på ALT
nytt (PUBLIC-revoke verifisert i prod, 00046-lærdommen).

**Backfill-/migreringssikkerhet:** dump av `club_payment_managers` og
`club_claims` til spike-mappen FØR push (service-nøkkel; kommandoen i
PR-beskrivelsen); migrasjonen er transaksjonell; backfillen er
deterministisk og verifiserbar i samme transaksjon (RAISE ved uventet
radtall). **Rollback:** git-revert + ny migrasjon som gjenoppretter
forrige funksjonsdefinisjoner (alle CREATE OR REPLACE-versjoner ligger i
git-historikken); tabelltilleggene er additive utenom DROP `club_id` —
derfor dumpen; Edge Functions re-deployes fra forrige commit; e-post-kill-
switch = fjern Resend-/URL-secret; cron fjernes med `cron.unschedule`.

**Exit A1:** migrasjonene pushet · verify-scriptet grønt mot prod ·
røyktest: nye RPC-er svarer riktig gated (anon/feil rolle → nekt) ·
claim-notify-e-post med nominee-bevis mottatt · ingen appregresjon
(eksisterende suite grønn — 164).

### Fase A2 — appen (ren JS, Metro; ingen native)

- `SupportSetupScreen`: nominasjonsvalget («Jeg» / «En annen» + felter;
  «En annen» bak featureflagg til web-landing er live) · nye statuskort
  for `awaiting_manager`-variantene (invitert/avslått/utløpt →
  kontaktvei) · KYC-kortet viser CTA kun ved `can_onboard`; ellers
  «venter på at [navn] fullfører hos Stripe» · **Share-arket fjernes**.
- `ClubPaymentsScreen`: enhets-gruppering · rolleadmin-seksjon (aktive
  ansvarlige, åpne invitasjoner, «Inviter ny betalingsansvarlig» —
  manager-utstedt) · «Fullfør deaktiveringen»-knapp ved
  `unresolved_cancellations > 0` · designavstemming (ikoner for
  emoji-loggen, tokens for hardkodet gult — fra gamle K2).
- Ops-flatene: `OpsClaimDetailScreen` viser nominee + tildelingsutfall ·
  NY `OpsEntitiesScreen` (enheter, managere, invitasjoner, review-kø,
  suspender/fjern/utsted/revoke/bekreft, flytt lag) i Profil-stacken.
- API-laget (`payments.ts`, `clubPayments.ts`, `ops.ts`): nye
  typer/kall; `submitClubClaim` → Edge-funksjonen (dev-bygg beholder
  direkte-RPC som «Send likevel (testdata)»-vei).
- Profilryddingen (B6): egen liten commit-serie ETTER A2 (når nye
  flater/innganger er stabile), FØR samlet lanserings-QA.

**Exit A2:** suite grønn + lint ren · alle nye flater navigerbare i
dev-bygg · «En annen»-flagget AV · ingen døde CTA-er.

### Fase A3 — dogfood selvnominasjon (telefon, sandbox)

Scenariene (Ridabu + Stange som testrigg; **Stange ryddes IKKE før
fase B-dogfooden er ferdig** — den er motpart):

(a) J2019-porten ende til ende: «Be om godkjenning» → manager-e-post +
push → godkjenn (krever aktiv konto — verifiser sperren mot en klubb uten)
→ arv 79/60 → sandbox-checkout → pause → re-godkjenning → deaktiver →
delfeil-knappens tilstand. (b) Nytt claim med «Jeg»-nominasjon (testklubb)
→ ops-godkjenning i appen → rolle + auto-defaults → KYC-gate (kun manager
ser CTA) → sandbox-KYC → aktiv. (c) Rolleadmin i ops-flaten: suspender/
reaktiver, fjern-vern for siste aktive, utsted/trekk invitasjon (e-post
skal IKKE gå ut — flagget av). (d) Slett dogfood-manager → ops-e-post om
managerløs enhet + `awaiting_manager` i SupportSetup. (e) Lagforespørsel
mot managerløs enhet → ops-fallback-e-post. (f) Duplikat-testen: ny
klubbrad + claim med aktivert orgnr → brukerrettet stopp ved submit.

**Exit A3:** alle seks grønne på telefon; STATUS-HANDOFF oppdatert.

### Fase B — web (første del av nettsideskiva)

B4-stackbeslutningen tas ved fasestart. Rekkefølge: **B-1**
invitasjonslanding (auth, redeem/decline, avviksskjermen «bekreftes av
Heia») → `WEB_INVITE_BASE_URL` settes → «En annen»-flagget PÅ i appen.
**B-2** Klubbbetalinger + rolleadmin på web (samme RPC-er). **B-3** Heia
Ops på web (claims, review-kø, entities, flytt-lag); e-postene bytter
`heia://` → https. **B-4** full dogfood: nominasjon av annen person
(Benjamin-kontoen som «kasserer»): invitasjon → aksept med e-postmatch →
rolle; innløsning med AVVIK → awaiting_review → ops-bekreft/avvis;
manager-utstedt invitasjon; KYC fra web. Deretter: Stange- og
dogfood-rester ryddes (via ops-flatene der det går — resten dokumentert
éngangs-SQL i PR-en, ikke runbook).

**Exit B / lanseringsporten (alt må være sant før full lansering):**
ingen SQL-runbook i normal drift (defaults auto, roller/invitasjoner/
flytting i flater) · alle II.9-varsler observert i test · avvikskontroll
verifisert begge veier · siste-aktive-vern + GDPR-slettevarsel verifisert ·
Share-arket borte, KYC-gate verifisert · duplikatsperrene verifisert ·
web-flyten fullført av testperson uten app · verify-scriptene grønne ·
STATUS-HANDOFF + PAYMENTS.md ajour.

### Avhengigheter (kritisk sti)

A1 → A2 → A3 (app-sporet, uavhengig av web) · A1 → B-1 → «En annen»-
flagget → B-4 · B-2/B-3 kan bygges parallelt med B-1 · profilryddingen
(B6) etter A2, før lanserings-QA · B4-stackvalget dokumenteres før
første produksjonskode i fase B · Universal Links/AASA-finpuss
(app-åpning av https-lenker) hører til native-runden i fase 6 og
blokkerer ingenting her (web-lenkene fungerer i nettleser uansett).
