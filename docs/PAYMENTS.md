# Betalingsdomenet — beslutningsbok og status (Heia Supporter)

_Godkjent av Brage 2026-08-01 (arkitekturfrys + fase 0-rapport). Dette er
sannhetskilden for alle betalingsbeslutninger. Endringer i låste beslutninger
krever eksplisitt omkamp med Brage — aldri stille drift._

## Hvor vi er (oppdateres per fase)

| Fase | Innhold | Status |
|---|---|---|
| 0 | Sandbox-spike, 16 bevispunkter | ✅ FERDIG + godkjent 2026-08-01 — se `~/Documents/Heia-Stripe-Spike/RAPPORT.md` (utenfor repo, med API-logger) |
| 1 | Datadomenet: 9 tabeller + RLS + invariants (`00037`) | ✅ DEPLOYET + VERIFISERT 2026-08-01 — **28/28 PASS** (se «Fase 1-verifisering» nederst) |
| 2 | `stripe-webhook` Edge Function + idempotent prosessering | ⏳ NESTE — venter på Brages GO |
| 3 | Claiming + manuell godkjenning + Stripe-onboarding | ⏳ |
| 4 | Checkout-flyten i appen + Universal Links | ⏳ |
| 5 | Selvbetjening (Customer Portal) + lagaggregater | ⏳ |
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

## Pris og split (ULÅST kommersiell beslutning)

79 kr/mnd er produktretningen. **75/25 vs. fast 60 kr til klubben er IKKE
besluttet** — avgjøres når Stripes reelle Norge-priser + MVA er avklart
(fase 6-input). Aldri hardkodet, aldri offentlig kommunisert ennå.
Datamodellen bærer begge: `fee_model` (`bps`/`fixed_club_amount`),
`fee_bps` (ALLTID satt — det som sendes til Stripe), `club_fixed_minor`
(intensjonen ved fast beløp). Fase 0-fakta: 2405 bps × 7900 øre = 1899,95
→ Stripe rundet OPP til 1900 (klubb nøyaktig 60,00) — verifisert KUN for
dette prispunktet; nye prispunkter krever ny avrundingssjekk i sandbox.

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

**Avgjøres før prod (fase 6):** endelig split (etter Norge-priser + MVA) ·
MVA på Heia-andelen (regnskapsfører) · Heia juridisk enhet · domene
(Universal Links/Apple Pay/redirect — uavklart om Heia har et; trengs senest
fase 4) · refund-/disputepolicy som tekst · vilkår + personvern ·
statement descriptor-standard · varslingsflyt ved lagavvikling · om vanlige
medlemmer ser lagaggregatet (sosialt bevis) eller kun lagadmin.

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

## Miljøer og sikkerhet

Sandbox-spiken bor i `~/Documents/Heia-Stripe-Spike/` (UTENFOR repo):
RUNBOOK.md (kjørelogg), RAPPORT.md (fase 0-leveransen), logs/ (28 rå
API-responser), .env (sandbox-nøkkel — ALDRI i chat/repo). Produksjonsnøkler
kommer aldri i repo; Edge Functions leser secrets fra miljø/vault
(00022-mønsteret). Webhooks: signaturverifisert, idempotent, reprosesserbar.
