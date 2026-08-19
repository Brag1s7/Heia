# «Forlat lag» — dormant-modellen (FROSSET 2026-08-19)

**Status: GODKJENT AV BRAGE 2026-08-19, med presiseringene i §3.
BYGGET OG DEPLOYET 2026-08-19 (migrasjon `00067_forlat_lag.sql` +
`payments-notify`; hele §7-omfanget — se STATUS-HANDOFF for leveransen
og restpunktene: verify-00067.sql i SQL-editoren + telefonrunden).**
Dette dokumentet er beslutningsgrunnlaget og skal ikke relitigeres —
endringer krever Brages uttrykkelige beslutning. Ops-RPC-ene i §3f-5
(gjenåpne/overdra/legge ned via ops-flate) sto ikke i §7 og er BEVISST
ikke bygget ennå — de følger «Legg ned laget»-skiva (§4).

Forhistorien (to forkastede modeller, GPT-runden, auditens funn og
sikkerhetsskiva 00066) står i §6, så en ny samtale slipper å
rekonstruere hvorfor.

---

## 1. Grunnmodellen (godkjent i prinsippet)

Et lag er en selvstendig beholder — omtrent som en WhatsApp-gruppe:

* **Laget består med null medlemmer** («dormant»). Innhold, historikk,
  forfatterskap og støtteavtaler består. Ingenting slettes.
* **Utmelding påvirker BARE medlemskapet** — også for siste medlem.
  Ingen Stripe-kall, ingen kansellering, ingen sletting i leave-flyten.
* **Medlemskap og støtte er separate relasjoner** (modell B).
  Støtteavtaler har egen livssyklus og administreres i «Min støtte» +
  Stripe-portalen — begge er verifisert medlemsuavhengige
  (`get_my_support_overview` er SECURITY DEFINER med user_id som eneste
  vakt, 00040:158; portalen slår kun opp payment_customers).
* **`deleted_at` brukes KUN ved uttrykkelig «Legg ned laget»** — aldri
  som konsekvens av utmelding eller kontosletting.
* **Brukere uten aktive lag er en varig, førsteklasses tilstand** med
  tilgang til Profil, Min støtte, «Bli med i et lag» og «Opprett et
  nytt lag» (hasTeam-porten får en tredje gren, se §4).
* **Betalingsansvarlig får ALDRI automatisk myndighet over laginnhold**
  — autoriteten er scopet til den juridiske enheten (låst i
  autoritetsmodellen). Innsyn og ops-eskalering, ikke overtakelse.

## 2. Utmeldingens semantikk

* Utmelding gjelder **hele personen**: alle rader (personlig + barn) i
  laget flippes `status IN ('active','invited')` → `'removed'` med
  `left_at` — samme settbaserte mønster som `remove_team_member`
  (00041). Fremtidige RSVP-er slettes; historikken består.
* **Innhold slettes aldri ved utmelding**: innlegg, bilder,
  kommentarer, kampbidrag og forfatterskap består. Synlighet
  gjenoppstår automatisk ved gjeninntreden (all gating er live
  `is_team_member`).
* **Gjenopprettes IKKE automatisk** ved gjeninntreden: fremtidige
  RSVP-er, tapte varsler, tidligere trener-/lagleder-/adminrolle.
  Rolle velges på nytt gjennom join-flyten (trener via godkjenning,
  §5) — med unntaket «Gjenåpne laget» (§3f).
* **Siste-admin-vakten**: siste aktive admin (trener/lagleder/admin)
  kan ikke forlate et lag med andre aktive medlemmer — rollen må
  overdras først (`set_member_role`, ny RPC, bruker-scopet fordi
  CHECK-constrainten i 00007 forbyr adminrolle på barne-rader;
  spillere kan ikke promoteres i v1; siste admin kan ikke demotere
  seg selv). Rolleadministrasjonen får synlig meny; blokkerings-
  dialogen deep-linker dit.

## 3. Presiseringene (Brages krav før frys, 2026-08-19)

### a) Dormant-låsen og den kanoniske porten

**Kanonisk port: FRAVÆR AV AKTIV LAGADMIN.** Ingen egen lås-kolonne —
porten er utledet og kan derfor aldri komme i utakt:

* Et lag UTEN aktiv admin er låst for ukjente kodebrukere. Kun
  brukere hvis siste medlemsepisode i laget er en frivillig utmelding
  slipper inn med koden; alle andre avvises med henvisning til Heia.
* Låsen forsvinner IKKE ved at en tidligere vanlig bruker kommer
  tilbake (gjeninntreden skaper ingen admin). Den åpnes først når en
  kvalifisert tidligere admin uttrykkelig gjenåpner laget (§3f) eller
  Heia Ops tildeler admin — selve gjenåpningshandlingen ER opprettelsen
  av en aktiv admin, så port og tilstand kan ikke divergere.
* Konsekvens: også et bebodd lag som mistet alle admins via
  kontosletting er låst for fremmede — riktig, for uten admin finnes
  ingen som kan gå god for nykommere. (Siste-admin-vakten gjør at
  tilstanden aldri oppstår via utmelding.)

### b) Siste episode avgjør — deterministisk

* **Gjeninntredens-porten** leses av brukerens NYESTE rad i laget
  (høyeste `joined_at`, id som tiebreak): er den `left_reason='removed'`
  → avvist (må godkjennes/inviteres på nytt), er den `'left'` → inn.
  En eldre frivillig utmelding gir ALDRI adgang etter en senere
  admin-fjerning.
* **Gjenåpningsmyndighet** (§3f) krever i tillegg at brukerens nyeste
  PERSONLIGE rad (`managed_child_id IS NULL`) hadde adminrolle og
  `left_reason='left'`. Barne-/tilknytningsrader gir aldri
  gjenåpningsmyndighet (de kan uansett aldri bære adminrolle —
  CHECK-constrainten er belte og bukse).

### c) Revisjonsspor

To nye kolonner på memberships (radene er de-facto append-only per
episode — gjeninntreden skaper ny rad):

* `left_reason text` ∈ `('left','removed')` — frivillig vs. fjernet.
* `ended_by uuid` — hvem som avsluttet: brukeren selv ved frivillig
  utmelding, administratoren ved fjerning (`remove_team_member` v2
  setter `auth.uid()`).
* **Backfill er entydig**: ALLE eksisterende removed-rader kom fra
  `remove_team_member` (frivillig utmelding har aldri eksistert) →
  `left_reason='removed'`, `ended_by=NULL` (ukjent, dokumentert).
  Dermed kan legacy-fjernede ikke bruke koden — som besluttet.

### d) Den lagløse grenen og `onboarding_completed_at`

* **BESLUTTET: eksplisitt `profiles.onboarding_completed_at`**
  (timestamptz) fremfor utledning fra medlems-/støtterader — mer
  skalerbart, særlig mot nettsiden. Settes ved første fullførte
  join/create; backfilles for alle med en medlemsrad (uansett status).
* Navigator-porten blir: innlogget + `onboarding_completed_at` →
  hovedappen (Profil-rotet stack når null aktive lag — JoinTeamCode
  og CreateTeam er allerede registrert i ProfilNav, AppNavigator:227);
  ellers den LÅSTE onboardingen (urørt førstegangsløp).
* Feltet påvirker ALDRI støtteavtalens livssyklus.

### e) Dormant lag slettes ALDRI automatisk

* `team_spaces.dormant_at timestamptz NULL` — REGISTRERES (kan ikke
  utledes: kontosletting hard-sletter radene). Vedlikeholdes kun av
  de tre eneste skrivedørene (leave-RPC, `delete_account_data`,
  `join_team_space`/gjenåpning nuller den) — trygt fordi 00066
  fjernet all klient-skriving på memberships.
* Synlig i Ops (dormant-markering i Klubbetalinger-oversikten) +
  informasjonsvarsel via payments-notify-kanalen når et lag MED
  innhold eller avtaler blir dormant.
* En eventuell fremtidig retensjonspolicy skal være uttrykkelig og
  varslet — aldri en skjult konsekvens av utmelding. Ingen purge
  bygges nå.

### f) Gjenåpnings- og overtakelsesmatrisen

1. **Frivillig utmeldt tidligere medlem**: inn med koden, alltid —
   som vanlig medlem (§3b-porten).
2. **Frivillig utmeldt tidligere admin**: «Gjenåpne laget» som
   UTTRYKKELIG valg i join-flyten — gjeninnsetter gammel adminrolle i
   samme bevisste handling. Historikkbasert vakt (§3b). Innenfor
   «ikke automatisk»-invarianten: rollen gjenvinnes gjennom en
   eksplisitt, vaktet handling.
3. **Frivillig utmeldt ikke-admin som vil bli trener i låst lag**:
   inn som vanlig; trenerforespørselen blir stående → ops er
   fallback-godkjenner.
4. **Klubbens betalingsansvarlige**: ingen direkte overtakelse —
   innsyn (dormant-markering) og ops-eskalering.
5. **Heia Ops**: full myndighet — gjenåpne, overdra til navngitt
   bruker, eller legge ned — via ops-RPC-er med hendelseslogg
   (`log_authority_event`-mønsteret).
6. **Ukjent bruker med gammel kode**: avvises alltid i låst lag,
   henvises til Heia. I LEVENDE lag (aktiv admin finnes) gjelder
   normalmodellen (§5).

## 4. «Legg ned laget» (egen, autorisert flyt — IKKE i leave-skiva v1)

* Eneste bruk av `deleted_at`. Autorisasjon: aktiv lagadmin i appen
  (eksplisitt bekreftelse som lister konsekvensene); for dormant lag:
  ops. Betalingsansvarlig kan be ops.
* Koden dør automatisk (join krever `deleted_at IS NULL` — finnes
  allerede), ALLE lagets avtaler avsluttes ved periodeslutt
  (`club-support-deactivate`-mønsteret er presedensen) og
  støttespillerne varsles.
* Kontosletting er URØRT: `delete-account` kansellerer brukerens EGNE
  avtaler og sletter kunden (GDPR) som i dag; laget blir dormant, ikke
  nedlagt.

## 5. Innløserflaten (fra tidligere runder, står)

* `lagleder`/`admin` avvises som innløserrolle (appen sender dem aldri).
* «Jeg er trener» → aktivt medlemskap som `supporter` +
  `requested_role='trener'` + varsel til alle aktive admins; godkjenn =
  `set_member_role`, avslå = nulle feltet. Koden gir ALDRI
  administrative rettigheter direkte. Onboardingens tre valg består.
* Duplikatabonnement ved gjeninntreden er allerede umulig: avtaler
  skapes kun i `stripe-checkout`, som har `findLiveRow`-vakten.

## 6. Forhistorie og forkastede alternativer (ikke relitiger)

* **Modell A («intet medlemskap ⇒ ingen levende avtale»)** — FORKASTET:
  la hele Stripe-maskineriet (preflight → kanseller/expire → execute,
  streng 4xx-allowlist, webhook-race-håndtering) i en hverdagsflyt, og
  var en blindvei mot nettsiden (støtte fra ikke-medlemmer). Én persons
  utmelding skulle aldri kunne kansellere andres avtaler.
* **Automatisk soft-delete ved siste utmelding** — FORKASTET: implisitt
  destruktiv handling, krevde restore-maskineri, og kansellerte andres
  løpende støtte som bivirkning. Nedleggelse skal være uttrykkelig.
* **Auditen (2026-08-19, 38 spørresteder, 17 funn)** fant bl.a.
  privilegie-eskaleringshullet i 00014-policyene → tettet i
  **sikkerhetsskiva 00066** (pushet 2026-08-19): memberships har nå
  nøyaktig to policyer (begge SELECT, andres rader kun `active`), all
  skriving via RPC. Flerbarnsforelder-403-en i stripe-checkout er
  fikset og deployet. Determinismen (primærrad-regelen) ligger i
  `src/shared/activeMembership.ts`.
* **Kjente restanser som IKKE er denne skiva**: medlemstall teller
  rader, ikke personer (lookup_invite_code 00050:36,
  get_club_payments_overview 00065:68, getTeamMemberCount);
  `author_role` blir NULL på historiske innlegg mens forfatter er ute
  (get_team_feed 00029:96, kosmetisk); kommentarfeltet mister navn/
  avatar for utmeldte forfattere (comments.ts slår opp via
  get_team_members) — SKAL fikses i leave-skiva; first-wins-dedup i
  members.ts.

## 7. Byggeomfanget for leave-skiva (ny samtale)

Migrasjon (00067+, kan bære de utestående payload-fiksene fra A3 i
samme fil — «Klubbetalinger»-teksten i RPC-varselet, nominee-feltene,
manager-navnet):

1. Kolonner: `memberships.left_reason` + `ended_by` (+ backfill),
   `memberships.requested_role`, `team_spaces.dormant_at`,
   `profiles.onboarding_completed_at` (+ backfill).
2. RPC-er: `leave_team` (vakter + settbasert flip + RSVP-sletting +
   dormant_at) · `set_member_role` (+ avslå-vei) ·
   `join_team_space` v4 (rolleavvisning, §3a/b-portene,
   requested_role, admin-varsel, nuller dormant_at) ·
   `remove_team_member` v2 (`left_reason`/`ended_by`) ·
   `delete_account_data` v4 (dormant_at + informasjonsvarsel).
3. Edge: `payments-notify` (den ventende rettelsen + nye
   hendelsestyper) — deploy samlet.
4. App: «Forlat laget»-flyt med bekreftelse som navngir alle berørte
   (barn) og, når brukeren forlater sitt SISTE lag med levende avtale,
   sier tydelig at støtten fortsetter og tilbyr «Administrer støtte» ·
   tredje navigator-gren + Profil-rotet lagløs tilstand · rollemeny ·
   «Gjenåpne laget»-valget · trenergodkjenning i Inbox ·
   kommentar-forfatter-fiksen.
5. Verifisering: skiller-tester for portene (§3a/b er ren logikk) +
   verify-skript i huset sjanger + telefonrunde.

«Legg ned laget» (§4) er EGEN skive etter leave-skiva.
