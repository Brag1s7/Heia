# Referansebilder — hva vi henter (kun intern designreferanse)

Bildene i denne mappa er inspirasjon fra andre apper. De skal ALDRI inn i
app-bundelen (ingen import fra `src/`), og de er ikke fasit — Heias
komponenter, ikoner, typografi og språk gjelder (autoritetsregelen).
Filnavnene under er avtalt med Brage 2026-09-03; legg bildene inn med
nøyaktig disse navnene.

## tab-bar-ambient-blur.png (mørk finans-app, «Home / Statistic / Profile»)
Hentes: tab-baren som flytende kapsel der uklarheten strekker seg UTENFOR
selve glasset — en bred, myk og lavmælt haze rundt kapselen pluss en svak
grunnskygge, så kapselen glir inn i skjermen i stedet for å ligge oppå den.
Ikke hentes: hvit glød, uklar tekst, mørk kapsel på lys skjerm.
Status: haze (boxShadow-par) bygget 2026-09-03; diffusjonsfeltet under/
utenfor kapselen bygget som JS-frostgradient (fallback) — ekte maskert
backdrop-blur krever native (HeiaFrostField, Cmd+R), avventer Brage.

## background-vertical-fade.png (oransje energi-app, «5.36 kW»)
Hentes: én stor, sammenhengende VERTIKAL fargereise over hele skjermen —
lys/mettet øverst, gradvis dypere mot bunnen, med innholdet liggende oppå
uten egne bokser der det ikke trengs. For Heia: lys/neon mint øverst og i
midten → aqua-overgang → gradvis dypere teal/smaragd mot bunnen.
Ikke hentes: oransje, svart bunn.
Status: LÅST 2026-09-03 som SENERE designretning for `DaylightGround` (én
stor vertikal fargereise: lys/neon mint øverst og i midten, via aqua, til
gradvis dypere og dempet teal/smaragd nederst) — ikke bygget.

## dark-glass-depth.png (mørk portefølje-app, gul/lime aksent)
Hentes: mørkt glass med tonal DYBDE — kortene er ikke én flat mørk farge,
men har lysreise (lysere refleks der lyset kommer fra, dypere tonalitet
bort fra lyset) og en kontrollert aksentfarge som får lov å lyse.
For Heia (LÅST 2026-09-03 som senere retning): mørke kampkort beholder
mørkt Heia-/stadionglass, men får tilsvarende kontrollert retningslys og
tonal dybde; aksent = #02FFAB/coral.
Ikke hentes: gul/lime, sort bunn, glød under tekst.
Status: SENERE — ikke bygget.

## directional-glass-fade.png (reise-app, «How do you want to feel today?»)
Hentes (LÅST 2026-09-03 som senere retning): vanlige FeedCard skal få
nøytralt perlegrått Liquid Glass med en subtil INTERN retningsfade — litt
lysere og tettere øverst til venstre, litt mer transparent og røykgrått
nederst til høyre. Ikke ensfarget mintglass.
Ikke hentes: bildefylte kort, mørk chrome.
Status: SENERE designretning for vanlige glasskort (`GLASS.card`) — ikke
bygget.
