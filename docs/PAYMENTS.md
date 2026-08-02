# Betalingsdomenet — beslutningsbok og status (Heia Supporter)

_Godkjent av Brage 2026-08-01 (arkitekturfrys + fase 0-rapport). Dette er
sannhetskilden for alle betalingsbeslutninger. Endringer i låste beslutninger
krever eksplisitt omkamp med Brage — aldri stille drift._

## Hvor vi er (oppdateres per fase)

| Fase | Innhold | Status |
|---|---|---|
| 0 | Sandbox-spike, 16 bevispunkter | ✅ FERDIG + godkjent 2026-08-01 — se `~/Documents/Heia-Stripe-Spike/RAPPORT.md` (utenfor repo, med API-logger) |
| 1 | Datadomenet: 9 tabeller + RLS + invariants (`00037`) | ✅ DEPLOYET + VERIFISERT 2026-08-01 — **28/28 PASS** (se «Fase 1-verifisering» nederst) |
| 2 | `stripe-webhook` Edge Function + idempotent prosessering | ✅ FERDIG + GODKJENT av Brage 2026-08-01 (se «Fase 2» nederst) |
| 3 | Claiming + manuell godkjenning + Stripe-onboarding | ✅ FERDIG + **GODKJENT av Brage 2026-08-01**: DB-verifisert **19/19** + E2E-telefontest bestått **×2** (Ridabu: orgnr-korrigert godkjenning; Stange: avslag → ny søknad → godkjenning → onboarding → AKTIV; Stange-testdata ryddet etterpå). Se «Fase 3» nederst |
| 4 | Checkout-flyten i appen | ✅ FERDIG + **GODKJENT 2026-08-02** — E2E med **Apple Pay** (privat kort i sandbox), pengeveien DB-verifisert (7900/1975/5925), webhooks 4/4. Se «Fase 4» nederst |
| 5 | Selvbetjening (Customer Portal) + lagaggregater | ✅ FERDIG + **GODKJENT 2026-08-02** — telefontest bestått («Alt funker fra fase 5»), DB-verifisert 8/8; to review-justeringer samme dag: «Min støtte» ALLTID synlig på Profil + trykkbar tom-rad → Lagkassa. Universal Links-bunken (heiaapp.no) forberedt: `docs/HEIAAPP-NO.md`. Se «Fase 5» nederst |
| 6 | Produksjon: juridisk enhet, live-nøkler, MVA, policyer, pilotklubb | ⏳ |

**Gate-regel: hver fase stopper for Brages review før neste starter.**

## Produktet

«Støtt laget – 79 kr/mnd»: frivillig månedlig supporterabonnement knyttet til
ETT konkret lag. Ingen kjernefunksjoner bak betalingsmur, og **aldri
supporter-eksklusive digitale funksjoner** (App Store 3.2.2(iv): gratis app +
innsamling eksternt i Safari er den kompatible formen — brytes dette, blir
produktet IAP-pliktig med Apple-kutt). Kun månedlig i v1. Én avtale per lag;
flere lag = flere abonnementer. Trener ser kun aggregater, aldri navn (v1).
Lag uten betalingsaktiv klubb: CTA «Be klubben aktivere støtte». Støtten
overlever at brukeren forlater laget. Lagavvikling: offering pauses, nye
stoppes, eksisterende varsles. Customer Portal er hele selvbetjeningen i v1.

## Arkitektur (teknisk BEKREFTET i fase 0)

Stripe Connect · destination charges · `on_behalf_of` · Express-tilsvarende
controller-konfig (`fees=application, losses=application, express-dashboard,
requirement_collection=stripe`) · Stripe-hosted onboarding · plattformkunde
hos Heia · application fee · **webhooks som ENESTE sannhetskilde** (retur fra
checkout beviser ingenting) · Customer Portal · provider-nøytral DB ·
Stripe-spesifikke Edge Functions · klienten er uvitende om Stripe-objekter.
Klubbandel beregnes av BRUTTO; Heia bærer alle betalingskostnader av sin andel.

## Klubbmodellen

`clubs` er en SOSIAL oppføring (fritekst, brukeropprettet, duplikater
tolereres). Den juridiske organisasjonen er `legal_club_entities` (orgnr,
UNIQUE). Kobling via `club_legal_entity_links`, **N:1**: én klubbrad → maks
én aktiv juridisk enhet; én enhet → mange klubbrader. Samme orgnr = samme
mottaker, ALDRI to Stripe-kontoer. Kapabilitetskjeden:

```
team_space → team → club → (aktiv link) → legal_club_entity
  → club_payment_account (per provider)          [= get_payment_account_for_team_space()]
```

Claiming (MVP): lagadmin sender `club_claim` → **manuell Heia-review**
(orgnr sjekkes mot Brønnøysund manuelt; duplikater kobles; allianselag =
splitt/flytt FØR kobling) → godkjenning skaper enhet + link + konto →
Stripe-onboarding via Account Link, fullført av person med REELL fullmakt
(kasserer/styreleder — lenken kan videresendes). Heias verifisering
(`legal_club_entities.verification_status`) og Stripes KYC
(`club_payment_accounts.status`) er to separate felter med to betydninger.

## Pengekjeden

```
user → payment_customers (én per provider)
  → support_subscriptions (frossen mottaker + offering fra tegning)
    → payment_transactions (frossen økonomi per trekk, append-only)
```

## Pris og split (BESLUTTET av Brage 2026-08-02 — kommunikasjonen er LÅST)

79 kr/mnd, **fast 60 kr til laget** (`fixed_club_amount`, 2405 bps —
fase 0-verifisert avrunding for akkurat dette prispunktet: 1899,95 →
Stripe runder OPP til 1900 → klubb NØYAKTIG 6000 øre).
**Fordelingen er OFFENTLIG og brukes som positivt tillits- og
markedsføringspoeng (LÅST):**
- «79 kr i måneden — 60 kr går direkte til laget»
- «Mer enn 3 av 4 kroner går tilbake til laget»
- De resterende 19 kronene dekker Heia, betalingsbehandling og drift.
- **Aldri presentert primært som prosent-splitt** — alltid kronebeløpet.
- Hovedtall på lagflater = det LAGET får/mottar, ALDRI brutto volum.

Tallene er fortsatt DATA (aldri hardkodet): klientflater viser
`club_amount_minor` avledet fra offeringen (`support_offering_club_minor`,
00040); «mer enn 3 av 4»-linjen rendres kun når dataene faktisk sier det.
Datamodellen bærer fortsatt begge modeller; nye prispunkter krever ny
avrundingssjekk i sandbox FØR offering opprettes. MVA/endelig økonomi på
Heia-andelen verifiseres fortsatt i fase 6 (regnskapsfører) — men
supporterkommunikasjonen over ligger fast.

**Offerings er VERSJONERTE og økonomisk immutable (LÅST + trigger-håndhevet):**
endring = ny versjon; nye abonnementer får nyeste versjon; eksisterende
beholder sin økonomi og røres ALDRI stille. Eksplisitt migrering er teknisk
mulig (P16: gjelder fra neste faktura) og reserveres varslede kampanjer.

## Fase 0-funn som binder implementasjonen

1. **Webhook-rekkefølgen er ikke intuitiv:** `checkout.session.completed`
   ankommer SIST (etter charge/invoice/subscription-events). Prosesseringen
   må være rekkefølge-agnostisk og idempotent per (provider, event_id).
2. **Refund-policy:** ALLTID `reverse_transfer=true` +
   `refund_application_fee=true` — ellers beholder klubben sin andel og Heia
   tar hele tapet (observert: −79 kr på plattformen per refund uten).
3. **Dispute:** −329 kr på plattformen per stk (79 + 250 gebyr); klubbens
   transfer reverseres IKKE automatisk → policy: reverser ved TAPT dispute.
4. **Nyere Stripe-API:** `invoice.charge`/`invoice.payment_intent` finnes
   ikke — charge slås opp via charges-listen. Fase 2 må pinne API-versjon.
5. **Kansellering ved periodeslutt = `cancel_at`-timestamp** —
   `cancel_at_period_end`-boolean forblir false ved portal-kansellering.
6. **Account Links/portal-sessions er kortlevde** — generer i
   klikkøyeblikket, lagres aldri.
7. **Test clocks virker ikke med Checkout** — fornyelseslogikk testes via
   API-abonnement.
8. **Økonomi observert (sandbox):** klubb 59,25 (75 %) / 60,00 (2405 bps);
   Stripe-gebyr 5,71 (inkl. MVA på gebyret) belastet plattformen; Heia netto
   ~14,04/13,29 per betaling FØR Billing-/Connect-kostnader og MVA.
9. **Portalens kanselleringsskjema gir `cancellation_details`** (feedback +
   fritekst) — ingesteres som churn-innsikt i fase 5.

## Datamodellen (migrasjon `00037_payments_domain.sql`)

| Tabell | Ansvar | Klient-RLS |
|---|---|---|
| `legal_club_entities` | Organisasjonen (orgnr UNIQUE, Heia-verifisering) | ingen |
| `club_claims` | Aktiveringsforespørsel + manuell review + spor | SELECT egne |
| `club_legal_entity_links` | N:1 klubb→enhet (partiell unik på aktiv) | ingen |
| `club_payment_accounts` | Konto per (enhet, provider); status fra webhooks | ingen (requirements skal aldri leses rått) |
| `support_offerings` | Versjonert pris/split; immutable (trigger); maks én aktiv per lag | ingen (bærer ulåst split — fase 4-RPC gir kun pris) |
| `payment_customers` | Plattformkunde per (bruker, provider); uten status-felt | ingen |
| `support_subscriptions` | Avtalen; frossen mottaker; én levende per (bruker, lag) | SELECT egne |
| `payment_transactions` | Frossen økonomi per trekk; append-only; `origin` åpner for engangsbetalinger | ingen |
| `webhook_events` | Idempotens (UNIQUE event_id) + reprosessering | ingen |

Droppet i samme migrasjon (kontrollert ubrukt 2026-08-01: null referanser i
src/, functions/, migrasjoner): `profiles.stripe_customer_id`,
`team_spaces.stripe_account_id`.

Statusmaskiner, roller/tilgang, invariants og «bygger bevisst ikke»-listen:
se beslutningsboken i chat 2026-08-01 (speilet i migrasjonens kommentarer og
denne filen). Kjernen: klienten kan ALDRI aktivere betaling eller bekrefte
en transaksjon; alle hemmeligheter server-side (vault-mønsteret fra 00022);
transaksjoner/offerings/webhook-events slettes aldri.

## Bygger bevisst IKKE nå

Wallet · intern ledger · payout-tabell · klubbadmin-rolle · automatisk
Brønnøysund · årsplan · navngitte supporterlister · Vipps (via Stripe i dag =
kun engangs, private preview — verifisert) · automatisert klubbmerge · egen
selvbetjeningsflate · web-checkout for ikke-medlemmer · prisendringsflyt for
løpende abonnementer · staging-miljø (vurderes før prod).

## Åpne beslutninger

**Avgjort 2026-08-02 (Brage):** splitten = FAST 60 kr til laget, offentlig
kommunisert (se «Pris og split») · lagaggregatet er synlig for ALLE
lagmedlemmer, hovedtall = det laget får · «Min støtte» bor på Profil
(liste, flerlags-klar); klubbens onboarding/økonomi bor i Laginnstillinger
(«Lagkasse-admin»), ALDRI på personlig profil · domenet er **heiaapp.no**
(Brage eier det — bunken i `docs/HEIAAPP-NO.md`).

**Avgjort 2026-08-02 (Brage): Heia juridisk enhet = AS.** Stiftes nå
(regnskapsfører velges først og svarer på MVA-spørsmålet i samme løp).
**TestFlight-veien (samme dag):** Apple Developer-medlemskap som
PRIVATPERSON nå (TestFlight venter ikke på AS-et) → konverteres til
Heia AS (krever D-U-N-S) FØR offentlig App Store-lansering — apper og
TestFlight-historikk overlever konverteringen; selger-navnet er det
eneste som bytter.

**Avgjøres før prod (fase 6):** MVA på Heia-andelen (regnskapsfører — kan
i teorien justere 19-kroners-økonomien, ikke kommunikasjonen) ·
refund-/disputepolicy som tekst · vilkår + personvern ·
statement descriptor-standard · varslingsflyt ved lagavvikling · endelig
bundle-ID (placeholder i dag — se HEIAAPP-NO.md steg 0; MÅ byttes før
første TestFlight-opplasting, bundle-ID er permanent per app-oppføring).

**Utsatt:** klubbadmin-domene · klubbmerge-verktøy · Vipps · engangs-
betalinger · flere land · payout-rapportering.

## Fase 1-verifisering (2026-08-01) — 28/28 PASS

Migrasjon `00037` pushet (transaksjonelt, uten feil; `migration list` viser
lokal = remote = applied). Deretter kjørt `verify-00037.sql` (selvforsynt
testscript, egne testdata, ender i ROLLBACK — ingenting består) i
dashboardets SQL-editor. Første kjøring avdekket en feil i selve
test-harnesset (manglende GRANT på temp-resultattabellen ved rollebytte —
ikke en skjemafeil); fikset og kjørt på nytt. Fullt resultat:

| # | Test | | # | Test |
|---|---|---|---|---|
| 1 | orgnr UNIQUE ✅ | | 15 | provider_fee write-once ✅ |
| 2 | én aktiv juridisk enhet per klubb ✅ | | 16 | webhook event_id UNIQUE ✅ |
| 3 | flere klubber → samme enhet ✅ | | 17 | webhook no-delete ✅ |
| 4 | én konto per (enhet, provider) ✅ | | 18 | oppslag: service role → konto ✅ |
| 5 | maks én aktiv offering per lag ✅ | | 19 | oppslag: medlem → konto ✅ |
| 6 | offering immutable (fee_bps) ✅ | | 20 | oppslag: ikke-medlem → NULL ✅ |
| 7 | pause + ny versjon (fixed-modell) ✅ | | 21 | oppslag: charges av → NULL ✅ |
| 8 | modellhygiene-CHECK på offering ✅ | | 22 | RLS: ser EGET abonnement ✅ |
| 9 | provider-ID write-once på offering ✅ | | 23 | RLS: ser EGEN claim ✅ |
| 10 | offering no-delete ✅ | | 24 | RLS: offerings stengt (split-lekkasje) ✅ |
| 11 | én levende avtale per (bruker, lag) ✅ | | 25 | RLS: transaksjoner stengt ✅ |
| 12 | club+fee=gross CHECK ✅ | | 26 | RLS: webhook_events stengt ✅ |
| 13 | transaksjon frossen økonomi ✅ | | 27 | RLS: klient-INSERT avvises ✅ |
| 14 | lovlige felter oppdaterbare ✅ | | 28 | døde Stripe-felter droppet ✅ |

Scriptet ligger i `~/Documents/Heia-Stripe-Spike/verify-00037.sql` og kan
kjøres på nytt når som helst (idempotent — ruller alltid tilbake).

## Fase 2 — `stripe-webhook` (2026-08-01) — deployet + sandbox-verifisert

**Filene:** `supabase/functions/stripe-webhook/index.ts` +
`supabase/functions/_shared/stripe.ts` (håndrullet klient, samme mønster som
`apns.ts` — bevisst uten npm:stripe; API-versjonen er PINNET til
`2026-07-29.dahlia` både i klienten og på webhook-endepunktene).
`verify_jwt = false` i config.toml — autentisering ER signaturverifiseringen
(WebCrypto HMAC, konstant-tid-sammenligning, 5 min replay-toleranse).

**Prinsippene (implementert som fase 0 krevde):**
- **Idempotent:** `webhook_events`-upsert med `ignoreDuplicates` er
  duplikatvernet; ferdigbehandlede events kvitteres uten reprosessering,
  `failed`/`received` reprosesseres trygt.
- **Rekkefølge-agnostisk:** hendelsen er kun en TRIGGER — sannheten hentes
  alltid fresh fra Stripe-API-et (GET), så prosesseringen konvergerer uansett
  leveranserekkefølge og tåler dobbeltkjøring.
- **Rent observerende:** kun GET mot Stripe. Refusjoner/transfer-reverseringer
  (policyene fra fase 0) er bevisste ops-handlinger, aldri webhook-bivirkninger.
- **Feilet trekk ≠ transaksjon:** `payment_transactions` er penger som faktisk
  flyttet seg; purreløpet eies av Stripe (abonnementet går `past_due` via synk).
- Handler-feil → 500 → Stripe reprøver → `failed`-raden reprosesseres.
  `error`-kolonnen bærer også skip-/prosesseringsnotater (driftssporet).

**Hendelsene (to endepunkter i sandbox, samme URL):**
- Platform (`we_1TzdPh2Y2NeXDnHBcZJtlnBS`): checkout.session.completed/expired,
  customer.subscription.created/updated/deleted, invoice.paid,
  invoice.payment_failed, charge.refunded, charge.dispute.created/closed.
- Connect (`we_1TzdPi2Y2NeXDnHBnP5Tjo94`): account.updated (leveres KUN på
  connect-endepunkt — derfor to secrets: `STRIPE_WEBHOOK_SECRET` +
  `STRIPE_CONNECT_WEBHOOK_SECRET`, begge satt som Edge Function-secrets og
  speilet i spike-`.env`).

**Statusavledninger (én plass, alltid fra fresh API-tilstand):**
- Konto: `rejected*` → disabled; charges+payouts uten disabled_reason →
  active; details_submitted/charges → restricted; ellers onboarding_started.
  `requirements` lagres som SMALT utdrag (disabled_reason, currently_due,
  past_due, pending_verification, current_deadline) — aldri hele payloaden.
- Abonnement: incomplete_expired → abandoned; trialing→active og
  paused→past_due er defensive mappinger (vi skaper dem aldri selv).
  `cancel_at`/`current_period_end` leses slik fase 0 fant dem (timestamp;
  på abonnements-ITEMET).
- Transaksjon: charge slås opp via `invoice_payments` → payment_intent →
  charges-listen (fase 0-funn #4); charge-id er idempotensnøkkelen;
  status går kun FREMOVER (rank-vakt — refund nedgraderer aldri en dispute);
  split fryses fra abonnementets offering, aldri «dagens».

**KONTRAKT MOT FASE 4 (bindende):** checkout-flyten oppretter
`support_subscriptions`-raden FØR redirect (status `checkout_pending`, med
`provider_checkout_session_id`) og setter `metadata.support_subscription_id`
på BÅDE checkout-sesjonen og `subscription_data` — da kan hver webhook-
hendelse stå alene selv når den ankommer før `checkout.session.completed`.

**Verifisert i sandbox 2026-08-01 (ekte events, testrader ryddet):**

| Test | Resultat |
|---|---|
| POST uten/med ugyldig signatur | ✅ 400 (GET → 405) |
| Ekte `account.updated` (connect-secret) ende-til-ende | ✅ processed; konto-rad `pending_onboarding` → `active`, charges/payouts true, requirements-utdrag lagret |
| Duplikatleveranse av ferdigbehandlet event (gyldig signatur) | ✅ 200 `{duplicate:true}`, attempts forble 1 |
| Event for ukjent konto | ✅ `skipped` med notat («ukjent konto …») |

**Restanse (BESLUTTET i reviewen 2026-08-01):** pengeveien (checkout →
invoice.paid → `payment_transactions`-rad) er kodegjennomgått mot fase 0-
loggenes eksakte objektformer, men ikke kjørt live. **Brage valgte: live-
testes som del av fase 4s første sandbox-checkout** (unngår permanente
testrader i append-only-tabellene). Fase 4s definisjonsliste MÅ inkludere
denne verifiseringen: transaksjonsrad med korrekt frossen splitt, gebyr fra
balance transaction, og abonnement → active.

**Fase 2-review (Brage, 2026-08-01): GODKJENT uten justeringer.** Eksplisitt
bekreftet i reviewen: (1) webhooken er passiv bokfører — refusjoner/
reverseringer forblir ops-handlinger; (2) feilet trekk gir ingen
transaksjonsrad; (3) fresh-GET-prinsippet; (4) fase 4-kontrakten er
bindende; (5) Stripes purring (~3 døgn) er retry-mekanismen i v1 —
reprosesseringsverktøy for `failed` bygges ved behov. **GO for fase 3 gitt
samme dag.**

## Fase 3 — claiming + manuell godkjenning + Stripe-onboarding (2026-08-01) — deployet + DB-verifisert

**Migrasjon `00038_club_claiming.sql` (✅ deployet):**
- `submit_club_claim(club_id, orgnr, juridisk navn, rolle, e-post, telefon)` —
  klient-RPC, SECURITY DEFINER, gatet på `is_club_team_admin` (00034).
  Normaliserer orgnr og validerer mod 11-kontrollsifferet (Brønnøysund-
  standarden — fanger tastefeil, erstatter IKKE reviewen). Krever e-post
  (Heia må kunne nå innsenderen). Avviser klubb med aktiv link og klubb med
  åpen claim. Ny partiell unik index `idx_club_claims_one_open` vinner racet
  når to admins sender samtidig.
- `approve_club_claim(claim_id, reviewer, note, orgnr-override, navn-override)`
  — **KUN service role/SQL-editor** (REVOKE fra authenticated/anon; verifisert
  i test 18–19). I én transaksjon: juridisk enhet (GJENBRUKES ved samme orgnr —
  samme orgnr = samme mottaker, aldri to Stripe-kontoer; verifisert i test 8)
  + aktiv link + kontorad (`pending_onboarding`) + claim → approved.
  Navn-overriden finnes fordi Brønnøysund er autoritativ for juridisk navn —
  bruk registerets navn ved godkjenning. Enheten opprettes `verified`
  (reviewen ER Heias verifisering); revoked enhet stopper godkjenning.
- `reject_club_claim(claim_id, note, reviewer)` — begrunnelse er PÅKREVD
  (innsenderen ser den i appen og kan sende ny søknad).
- `get_support_activation_status(ts_id)` — hele aktiveringstilstanden for
  admin-skjermen i ett kall. Gatet på LAGADMIN (ikke-admin → NULL, probe-
  vernet fra 00037). Lekker bevisst ikke requirements-payload (kun avledet
  `action_needed`-boolean) eller noe om split/offerings.
  States: `none → claim_submitted/claim_in_review → claim_rejected` eller
  `pending_onboarding → onboarding_started → restricted → active / disabled`
  (kontostatusene eies fortsatt av fase 2-webhooken).

**Edge Function `stripe-onboarding` (✅ deployet, `verify_jwt = true`):**
- Gatet på lagadminskap (memberships-sjekk) + hele kapabilitetskjeden
  (aktiv link + verifisert enhet + kontorad). Kontorad finnes kun etter
  godkjent claim — det er selve gaten.
- Oppretter Stripe-kontoen LAT ved første klikk med fase 0-spikens eksakte
  controller-konfig (RUNBOOK steg 3: NO, non_profit, fees/losses=application,
  express-dashboard, requirement_collection=stripe, card_payments+transfers,
  business_profile.name = enhetens juridiske navn).
  **Idempotency-Key = kontorad-id** → dobbeltklikk/kappløp kan aldri gi to
  Stripe-kontoer. `provider_account_id` skrives write-once; status røres IKKE
  (den eies av account.updated-webhooken).
  **statement_descriptor settes bevisst ikke** (standarden er en åpen fase 6-
  beslutning; Stripes onboarding avleder fra business_profile.name — mangler
  noe, sier requirements fra via webhooken).
- Genererer Account Link i klikkøyeblikket (fase 0-funn #6) og returnerer
  URL-en. `_shared/stripe.ts` fikk `stripePost` (form-enkodet, med
  Idempotency-Key-støtte) — fortsatt uten npm:stripe, samme pinnede API-versjon.

**Edge Function `stripe-onboarding-return` (✅ deployet, `verify_jwt = false`):**
landingsside for Stripes return/refresh-redirect (Stripe krever HTTPS; Heia
mangler domene — åpen fase 4/6-beslutning, denne er broen).
**PLATTFORMFUNN (telefontesten):** Supabase omskriver text/html-svar fra
`*.supabase.co`-funksjonsdomenet til `text/plain` + CSP `sandbox` + `nosniff`
(anti-phishing) — Brage fikk rå kildekode med tegnrot i Safari (omskrivingen
dropper også charset). HEAD berøres ikke av omskrivingen, så curl-røyktesten
så riktig ut. **Fiks: siden er nå REN TEKST med eksplisitt
`text/plain; charset=utf-8`** (verifisert at charset overlever) — HTML-versjonen
kommer først når Heia har eget domene. Dette VEKTER domenebeslutningen opp:
domenet trengs til Universal Links (fase 4), Apple Pay OG en ordentlig
landingsside. Retur BEVISER ingenting (fase 2-prinsippet) — siden sier kun
«gå tilbake til appen»; refresh-flowen forklarer at lenken er kortlevd.

**Appen (fase 3-UI, kun admin):**
- Nytt kort «Støtte fra supportere» i Laginnstillinger → ny
  `SupportSetupScreen` (ProfilStack): intro + søknadsskjema (orgnr/juridisk
  navn/rolle/e-post/telefon, e-post prefylt fra kontoen, klubbnavn prefylt) →
  «til vurdering»-kort → avslagskort med begrunnelse + «Send ny søknad» →
  godkjent-kort med «Fortsett hos Stripe» (åpner kortlevd lenke i Safari) og
  «Del lenken med klubben» (Share-arket — kasserer/styreleder med REELL
  fullmakt kan fullføre; lenken er kortlevd og hentes fersk per klikk) →
  «AKTIV»-kort. AppState-lytter refetcher status når appen kommer tilbake
  fra Safari; pull-to-refresh finnes også.
- `src/lib/api/payments.ts` (`getSupportActivationStatus`, `submitClubClaim`,
  `startStripeOnboarding` via `functions.invoke`). SupportScreen-mockupen
  (49/399 kr) er fortsatt BEVISST urørt — den er fase 4.

**Ops-runbook (manuell review — dashboardets SQL-editor):**
```sql
-- åpne søknader (sjekk orgnr manuelt mot Brønnøysund):
select id, claimed_org_number, claimed_legal_name, claimed_role,
       contact_email, contact_phone, created_at
from club_claims where status in ('submitted','in_review')
order by created_at;

-- godkjenn (bruk REGISTERETS navn som siste argument):
select approve_club_claim('<claim-id>', null, 'Sjekket mot Brønnøysund',
                          null, 'KLUBBENS REGISTRERTE NAVN');

-- avslå (begrunnelsen vises til innsenderen i appen):
select reject_club_claim('<claim-id>', 'Begrunnelsen her');
```
Ingen automatisk varsling til Heia om nye claims i MVP — sjekk spørringen
over (backlog: e-postvarsel). Allianseidrettslag: splitt/flytt klubbrader
FØR godkjenning (låst operasjonell regel).

**DB-verifisering (2026-08-01): 19/19 PASS** — `verify-00038.sql` i
`~/Documents/Heia-Stripe-Spike/` (selvforsynt, ruller alltid tilbake; kjørt
mot prod-DB-en via management-API-ets query-endepunkt). Dekker: mod 11-
validatoren, alle submit-vaktene (forelder/ikke-medlem/duplikat/aktivert
klubb), godkjenningens atomikk, enhet+konto-gjenbruk ved samme orgnr,
avslagsflyten, alle status-states inkl. admin-gaten, race-indexen og
grants-vaktene (authenticated kan ikke godkjenne/avslå).
Røyktest utenfra: landingssiden svarer på begge flows; `stripe-onboarding`
uten JWT → 401.

**E2E-telefontest (2026-08-01 kveld): BESTÅTT.** Hele løpet kjørt live i
sandbox: claim sendt fra appen (Ridabu IL) → manuell review fant at innsendt
orgnr `000000000` ikke finnes i Brønnøysund (repdigits består mod 11 — derfor
finnes reviewen) → godkjent med registerets verdier via overriden
(**875661582 / RIDABU IDRETTSLAG**, begrunnelse i review_note) → «Fortsett
hos Stripe» opprettet sandbox-kontoen lat → onboarding fullført med Stripes
testdata → `account.updated` flippet kontoen → **appen viser AKTIV**.
Reviewen ble gjort med Brønnøysunds åpne API
(`data.brreg.no/enhetsregisteret/api/enheter/{orgnr}` — oppslag + navnesøk);
det er den praktiske runbook-kanalen. Underveis ble landingsside-buggen
(HTML-omskrivingen over) funnet og fikset. Den juridiske enheten bærer nå
Ridabu ILs EKTE orgnr i prod-DB (bevisst valg — pilotklubben; Stripe-kontoen
er sandbox, re-verifiseres uansett i fase 6).

**E2E runde 2 (samme kveld): Stange Sportsklubb** — testklubb opprettet av
Brage for å teste avslagsgrenen: søknad med falskt orgnr `111111111` →
avslått med begrunnelse (appen viste «IKKE GODKJENT»-kortet + «Send ny
søknad») → ny søknad med ekte orgnr `982764742` (STANGE SPORTSKLUBB finnes
faktisk — bekreftet i Brønnøysund) → godkjent → full onboarding runde 2 →
webhook → **AKTIV**. Retursiden vist i sin nye tekstform. **Alle
Stange-testdata er RYDDET etterpå** (claims, link, enhet, konto, lagrom,
klubb — i avhengighetsrekkefølge; webhook_events-radene består, append-only
by design; sandbox-kontoen ligger ubrukt hos Stripe, harmløs).

**Fase 3-review (Brage, 2026-08-01): GODKJENT — GO for fase 4 gitt samme
kveld.** Design-notat fra testen: retur-landingssiden oppleves kjedelig →
eskalert til fase 4-inngangen (domene + ev. in-app-browser for onboarding,
se under). Brage bekreftet også at «egen UI etter innsending» er ønsket
retning — nivåene er dokumentert: (1) appens AKTIV-tilstand finnes alt,
(2) in-app-browser m/ URL-scheme (krever native rebuild — fase 4-bunken),
(3) Universal Links med eget domene (fase 4). NB: kun onboardingen kan
flyttes inn i appen — SELVE BETALINGEN skal forbli ekstern Safari
(Apple 3.2.2(iv), låst).

## Fase 4 — checkout i appen (2026-08-02) — deployet + DB-verifisert 11/11

**Migrasjon `00039_support_checkout.sql` (✅ deployet):**
- `create_support_offering(team_space_id, amount_minor, fee_model, fee_bps,
  club_fixed_minor, created_by)` — **KUN service role/SQL-editor** (REVOKE-
  regimet fra approve_club_claim; verifisert i test 11). Eneste vei til en
  offering: arkiverer aktiv versjon + setter inn neste versjon atomisk
  (advisory-lås per lag vinner versjonsracet). Eksisterende abonnementer
  beholder sin offering — aldri stille migrering (låst invariant).
- `get_support_offering_for_team_space(ts_id)` — klient-RPC for
  SupportScreen, gatet på LAGMEDLEMSKAP (alle medlemmer — foreldrene ER
  supporterne; ikke-medlem/uinnlogget → NULL, probe-vernet). Returnerer
  KUN pris/valuta/intervall + mottakerens juridiske navn (offentlig
  registerinfo — tillitssignal). **Splitten lekker aldri** (test 5 sjekker
  eksplisitt at fee_*-feltene ikke finnes i svaret). `available=false` med
  `reason` skiller «klubben ikke aktivert» fra «Heia har ikke priset laget»
  (ops-restanse) — samme CTA i appen, skilt i data for feilsøking.

**Edge Function `stripe-checkout` (✅ deployet, `verify_jwt = true`):**
- Gatet på aktivt LAGMEDLEMSKAP (ingen rollegate — alle kan støtte laget
  sitt) + hele kapabilitetskjeden (aktiv link + verifisert enhet + AKTIV
  konto med charges_enabled + provider_account_id). Hard vakt: ingen
  checkout uten entydig aktiv mottaker.
- **Fase 2-kontrakten implementert:** `support_subscriptions`-raden
  opprettes FØR redirect (checkout_pending), `metadata.support_subscription_id`
  settes på BÅDE sesjonen og `subscription_data`, sesjons-id-en skrives på
  raden før URL-en returneres.
- Stripe-objekter provisjoneres LAT med Idempotency-Keys bundet til våre
  rader (aldri doble objekter): product+price per offering (write-once på
  offering-raden, `heia-offprod-/heia-offprice-<offering_id>`), én
  plattformkunde per bruker (`heia-cust-<user_id>`, upsert + reselect).
- Checkout-sesjonen bruker fase 0-spikens eksakte `subscription_data`
  (on_behalf_of + transfer_data.destination + application_fee_percent =
  fee_bps/100) — splitten hentes fra AKTIV offering server-side; klienten
  kan aldri velge pris.
- **«Prøv igjen»-flyten:** en checkout_pending-rad GJENBRUKES — gammel
  sesjon utløpes best-effort, ny sesjon skrives BETINGET (fortsatt
  checkout_pending + uten provider_subscription_id); har den gamle
  sesjonen rukket å fullføre, utløpes den NYE og brukeren får «du støtter
  allerede» (aldri dobbel tegning). `incomplete` blokkerer ny checkout
  (409) til Stripe har konkludert — to levende Stripe-abonnementer skal
  ikke kunne oppstå.
- **Webhook-patch (fase 4):** `checkout.session.expired` abandonerer nå
  KUN når den utløpte sesjonen er radens GJELDENDE sesjon — den gamle
  sesjonens expiry (funnet via metadata) kan ikke lenger feilmerke en rad
  som har fått ny sesjon. Redeployet sammen med checkout-funksjonen.

**Edge Function `stripe-checkout-return` (✅ deployet, `verify_jwt = false`):**
tekst-landingsside for success/cancel (fase 3-funnet: HTML omskrives på
funksjonsdomenet). Success sier «behandles», aldri «bekreftet» — retur
beviser ingenting; webhookene flytter status. Røyktestet utenfra med GET
(charset overlever); checkout uten JWT → 401.

**Appen:**
- `SupportScreen` er skrevet om fra mockup til ekte data: pris fra
  offering-RPC-en (49/399-mockupen og «80 % til laget»-baren er FJERNET —
  splitten er ulåst og aldri offentlig), én månedlig plan, mottakerens
  juridiske navn under CTA-en. Tilstander: skeleton → «ikke helt klart
  ennå» (uaktivert klubb) → tegneflate med CTA (kortlevd checkout-URL
  hentes i klikkøyeblikket, åpnes i EKSTERN Safari — 3.2.2(iv), låst) →
  «Fullfør betalingen» (påbegynt tegning) → «DU STØTTER LAGET 💚»
  (active/past_due; past_due forklarer at Stripe prøver igjen).
  AppState-refetch når appen våkner fra Safari + pull-to-refresh.
- `payments.ts`: `getSupportOffering`, `getMySupportSubscription` (RLS:
  egne rader), `startSupportCheckout` (felles invokeForUrl-hjelper med
  onboarding).

**Pilot-offering (ops, 2026-08-02):** Ridabu G10
(`43968783-1c03-456d-8de0-7a90913eab93`) har offering v1: 7900 øre/mnd,
`bps`/2500 (75/25 — spike-rapportens robuste mekanikk). **PLASSHOLDER:
endelig split er fortsatt ULÅST (fase 6) — endring = ny versjon via
`create_support_offering`, aldri redigering.**

**Ops-runbook (prising av lag — SQL-editor/service role):**
```sql
-- ny/endret pris eller split for et lag (arkiverer aktiv versjon):
select create_support_offering('<team_space_id>', 7900, 'bps', 2500);
-- fast klubbandel-modellen (dokumenterer intensjonen):
select create_support_offering('<team_space_id>', 7900, 'fixed_club_amount', 2405, 6000);
```
NB: nytt PRISPUNKT krever ny avrundingssjekk i sandbox først (fase 0-funn:
2405 bps × 7900 rundet OPP — kun verifisert for 79 kr).

**DB-verifisering (2026-08-02): 11/11 PASS** — `verify-00039.sql` i
`~/Documents/Heia-Stripe-Spike/` (selvforsynt, ruller alltid tilbake; kjørt
mot prod-DB via management-API-ets query-endepunkt). Dekker: versjonering
(v2 arkiverer v1, maks én aktiv), pris-oppslagets alle grener (medlem/
ikke-medlem/uinnlogget/uaktivert/charges av/uten offering), split-lekkasje-
sjekken og grants-vakten.

**✅ PENGEVEIEN VERIFISERT 2026-08-02 (fase 2-restansen LUKKET):** Brage
betalte i sandbox med PRIVAT KORT via **Apple Pay** i Safari-checkouten
(bekrefter funnet: Apple Pay virker på hosted checkout uten eget domene;
sandbox belaster aldri ekte kort — walleten tokeniserer, test-charge).
DB-verifisert: abonnement `active` (provider_status active, sub-id +
sesjons-id satt, periode → 2026-09-02); transaksjonsrad `succeeded` med
KORREKT FROSSEN SPLITT **7900 gross / 1975 fee / 5925 klubb** (bps 2500),
`provider_fee_minor` 488 fra balance transaction (NB: lavere enn fase 0s
571 — gebyret varierer med betalingsmiddel; feltet er observert data),
charge + transfer-id satt. Webhook-løpet: 4 events, alle `processed`
med attempts=1 — inkl. et `checkout.session.expired` for en FORLATT
førstesesjon som traff raden via metadata UTEN å skade den (fase 4-
sesjonsvakten virket i første reelle kjøring). Rekkefølgen ankom
u-intuitivt (subscription.created SIST) — konvergent prosessering holdt.

**GJENSTÅR i fase 4 (før review):**
1. **Brages bekreftelse fra telefonen:** at SupportScreen flippet til
   «DU STØTTER LAGET 💚» + resten av testlisten i STATUS-HANDOFF
   (avbryt-grenen). Deretter fase 4-review + ev. GO for fase 5.
2. **Domenet (Brages beslutning/kjøp — eneste eksterne blokkering):** trengs
   for Universal Links + ordentlige landingssider. **Funn: Apple Pay krever
   IKKE eget domene på Stripes hostede checkout** (domeneverifisering
   gjelder kun innbygging på egen side) — domenet er dermed UX/lenke-sak,
   ikke betalingsblokkering.
3. **In-app-browser for onboarding (vurdering):** krever native rebuild
   (ny dependency) — anbefaling: VENT til neste native-runde; ekstern
   Safari fungerer og betalingen SKAL uansett være ekstern (låst).

## Fase 5 — del 1: Lagkassa + «Min støtte» + portal (2026-08-02) — deployet + DB-verifisert 8/8

**Fase 4 ble GODKJENT samme dag** (Brage bekreftet «DU STØTTER LAGET»-
flippen på telefonen; pengeveien var alt DB-verifisert). Brages
fase 5-bestilling (og beslutningene den låste) kom i samme melding —
se «Pris og split» og «Åpne beslutninger».

**Migrasjon `00040_lagkassa.sql` (✅ deployet):**
- `support_offering_club_minor()` — ÉN avledning av kommunisert
  klubbandel (fixed → intensjonen; bps → brutto minus avrundet fee).
- `get_support_offering_for_team_space` utvidet med `club_amount_minor`
  (fordelingen er offentlig nå) — fee-mekanikken (bps/modell) lekker
  fortsatt aldri (test 3).
- `get_team_support_summary(ts_id)` — lagkassa for ALLE medlemmer:
  `monthly_to_club_minor` (sum av hver levende avtales EGEN offerings
  klubbandel — aldri «dagens pris × antall», test 4),
  `supporters` (active + past_due), `total_to_club_minor` (kun stående
  penger: refunded/dispute_lost ekskludert; delrefusjon regnes fullt i
  v1 — dokumentert forenkling), `since`.
- `get_my_support_overview()` — «Min støtte» som LISTE (flerlags-klar):
  lagnavn, status, neste betaling, cancel_at, pris + klubbandel per
  avtalens egen offering.

**Edge Function `stripe-portal` (✅ deployet, `verify_jwt = true`):**
Customer Portal-sesjon i klikkøyeblikket, alltid mot brukerens EGEN
payment_customers-rad. Portalen ER selvbetjeningen i v1 (låst):
betalingsmåte, kvitteringer, oppsigelse. Kanselleringer bokføres av
fase 2-webhooken. Portal-konfigen i sandbox står fra fase 0 (steg 10).
`stripe-checkout-return` fikk `flow=portal`-tekst.

**Ops (2026-08-02):** Ridabu G10 offering **v2**: 7900 øre,
`fixed_club_amount`, club 6000, 2405 bps (v1 bps/2500 arkivert).
**Brages levende sandbox-abonnement ble EKSPLISITT P16-migrert** (bevisst
ops-handling, aldri stille): Stripe `application_fee_percent` 25 → 24,05
(gjelder fra NESTE faktura; logs/p16-fee-2405.json i spiken) + raden
repekt til v2. Historikken urørt — første transaksjon står frosset på
75/25 (5925), derfor viser lagkassa i dag 5925 samlet / 6000 per måned.

**Appen (kun Metro-reload):**
- **Ny `LagkassaScreen`** (HomeStack): hero-flaten med hovedtallet
  «X kr til laget hver måned», støttespillere, totalt samlet (alltid
  klubb-perspektiv), fordelingskortet («79 kr — 60 kr direkte til
  laget» + 3-av-4-linjen, datadrevet), varm «hva støtten betyr»-tekst,
  CTA → SupportScreen. Supportere ser «Du er en av dem 💚».
- **Inngangene (Brages valg):** lagkassa-KORT som egen side i
  hero-karusellen på Hjem (den emosjonelle inngangen; vises også uten
  kommende hendelser) + kort nederst på Sesong-siden (den permanente,
  ved lagets stolthet). **Bunnkortet på Hjem-feeden er FJERNET.**
  Ingen inngang på Profil (bevisst).
- **SupportScreen:** priskortet bærer nå «60 kr går direkte til laget» +
  3-av-4-linjen; 19-kroners-forklaringen diskret under CTA-en.
- **Profil → «MIN STØTTE»:** listekort (HandHeart-ikon) per avtale med
  pris, klubbandel og statuslinje («Aktiv · fornyes 2. september» /
  «Avsluttes …» ved cancel_at / purreforklaring ved past_due). Trykk →
  fersk portal-lenke i Safari; AppState-refetch når appen våkner.
  **Review-fiksene (Brage 2026-08-02): seksjonen står ALLTID på Profil** —
  skeleton-rad under første last, og modul-cache av siste svar så
  supporterens rad aldri popper inn ved remount (cachen nulles ved
  utlogging). **Tom-raden («Du støtter ingen lag ennå») er TRYKKBAR →
  Lagkassa** (Brages beslutning: veien til å støtte skal være lett å
  finne). Den peker bevisst på Lagkassa og ikke rett på betalingssiden —
  «hvorfor» før «betal», og Lagkassa eier alt av tilstander (uaktivert
  klubb osv.). Uten aktivt lag er raden ren informasjon. Med det er
  «ingen inngang på Profil»-beslutningen PRESISERT, ikke veltet: aldri
  salgs-/kampanjekort på Profil — tom-raden er veiviser.
  **Samme runde: LagkassaScreen fikk full skeleton-dekning** (før hadde
  kun heroen skeleton — fordelingskortet og CTA-en poppet inn etter
  fetch) + modul-cache per (bruker, lag): gjenbesøk rendrer tallene
  umiddelbart, første besøk laster uten layout-hopp.

**DB-verifisering: 8/8 PASS** — `verify-00040.sql` i spike-mappen
(avledningen begge modeller, aktiv-versjon-oppslag, lekkasjevakt,
per-avtale-månedssum, refundert ekskludert, probe-vern, oversiktens
innhold + fremmed bruker tom). Røyktest: portal uten JWT → 401.
NB testdata-læring: invite_code-CHECK-en avviser tegnet «0».

**heiaapp.no-bunken (forberedt — `docs/HEIAAPP-NO.md`):** AASA-fil +
landingsside (`web/`) ligger i repo; sjekklisten dekker hosting/DNS,
native-runden (bundle-ID-bytte FØRST — dagens er RN-placeholder;
Associated Domains; `heia://`-skjema; ev. in-app-browser for KYC-
onboardingen) og retur-URL-byttet i Edge Functions. Forventning: ved
server-redirect viser Safari ofte «Åpne i Heia»-banner/knapp fremfor
auto-hopp — landingssiden er opplevelsen. **Delbar lagkassa-lenke:
v1-scoping = åpne appen / App Store-side UTEN lagets tall på web**
(aggregat på åpen web er en egen personvernbeslutning; web-checkout
står fortsatt på «bygger bevisst ikke»-listen).

**FASE 5 LUKKET 2026-08-02:** telefontesten bestått («Alt funker fra
fase 5») + review med to justeringer (over). Restene er omfordelt:
heiaapp.no steg 1–3 → fase 6 · delbar lagkassa-lenke → web-delen til
nettside-prosjektet, app-/deep-link-delen til native-runden i fase 6 ·
churn-innsikt fra portalens kanselleringsskjema (fase 0-funn #9) →
backlog.

## Miljøer og sikkerhet

Sandbox-spiken bor i `~/Documents/Heia-Stripe-Spike/` (UTENFOR repo):
RUNBOOK.md (kjørelogg), RAPPORT.md (fase 0-leveransen), logs/ (28 rå
API-responser), .env (sandbox-nøkkel — ALDRI i chat/repo). Produksjonsnøkler
kommer aldri i repo; Edge Functions leser secrets fra miljø/vault
(00022-mønsteret). Webhooks: signaturverifisert, idempotent, reprosesserbar.
