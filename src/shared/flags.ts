// ---------------------------------------------------------------------------
// Featureflagg — flater som er BYGGET, men som ikke skal være synlige før
// motparten deres finnes. Et flagg her er alltid midlertidig og har en
// eksplisitt PÅ-betingelse; ingen død brukerreise skal kunne oppstå av at et
// flagg står feil vei.
// ---------------------------------------------------------------------------

/**
 * «En annen»-flagget (autoritetsmodellen v2, faseplanens A2/B-1).
 *
 * Alt som ender i en INVITASJON til rollen som betalingsansvarlig henger
 * sammen med web-landingen:
 *  · aksept/avslag skjer KUN på nettsiden — appen bygger aldri en
 *    midlertidig aksept (II.2 pkt 6, låst),
 *  · e-posten med lenken sendes kun når `WEB_INVITE_BASE_URL`-secreten er
 *    satt — `payments-notify` skipper strukturelt ellers, og
 *  · rå-tokenet finnes ALDRI i basen (B3), så ingen — heller ikke ops —
 *    kan formidle lenken manuelt i mellomtiden.
 *
 * En invitasjon utstedt før landingen finnes kan derfor ikke innløses av
 * noen. Derfor skjuler dette flagget begge inngangene til én:
 *  1. «En annen i klubben» i nominasjonsvalget (SupportSetupScreen), og
 *  2. «Inviter ny betalingsansvarlig» i rolleadmin (ClubPaymentsScreen).
 *
 * Ops-flaten er BEVISST ikke flagget: der er utstedelse en behandlet
 * beslutning med begrunnelse, og flaten viser selv at e-posten ikke er sendt
 * (`sentAt = null`).
 *
 * PÅ-betingelse (LÅST): invitasjonslandingen er live OG
 * `WEB_INVITE_BASE_URL` er satt. Da flippes denne til `true` — backend
 * støtter allerede begge veier (00062/00064), så flippen er ren JS.
 */
export const WEB_INVITE_LANDING_LIVE: boolean = false;
