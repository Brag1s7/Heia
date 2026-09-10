/**
 * @format
 *
 * DEN FROSNE RAPPORTEN SKAL VITE HVEM SOM RAPPORTERTE (Brage 2026-09-10:
 * «etter kampen er slutt står det bare "medlem" rapporterte»).
 *
 * Rosteret (`get_team_members`) hentes MED VILJE ikke for en ferdig kamp —
 * det er bare reporter-UI-et som trenger det. Navnet må derfor komme fra
 * `get_team_authors`, som hentes for hver kamp, ikke har statusfilter, og
 * også kjenner en reporter som siden har forlatt laget.
 *
 * Kildevakt: regelen er en DATAKILDE-beslutning, ikke noe som er synlig i
 * en render uten hele skjermen montert.
 */
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'screens', 'EventDetailScreen.tsx'),
  'utf8',
);
const block = src.slice(
  src.indexOf('const reporterAuthor'),
  src.indexOf('const canStartMatch'),
);

describe('reporterens navn i en ferdigspilt kamp', () => {
  it('leser fra forfatterne når rosteret ikke er hentet', () => {
    expect(block).toContain('authorFor(reporterId)');
    expect(block).toContain('name: reporterAuthor.name');
  });

  it('bruker rosteret først — det bærer rollen for reporter-UI-et', () => {
    expect(block.indexOf('teamMembers.find')).toBeLessThan(
      block.indexOf('reporterAuthor\n'),
    );
  });

  it('«Medlem» er siste utvei, ikke andrevalget', () => {
    expect(block.indexOf('name: reporterAuthor.name')).toBeLessThan(
      block.indexOf("name: 'Medlem'"),
    );
  });

  it('⚠️ rosteret hentes fortsatt IKKE for en ferdig kamp', () => {
    expect(src).toContain("event?.matchStatus !== 'finished'");
  });
});
