/**
 * @format
 *
 * KANONISK KOBLING OG HEIA-REGLENE (skive 4).
 *
 * Alt i denne fila er PRODUKTBESLUTNINGER som tilfeldigvis er kode:
 *
 *   · Hvilken feed-post et øyeblikk henger på. Koblingen
 *     `feed_posts.match_event_id` er 1:N MED VILJE (00071) — kampbilder bærer
 *     samme peker — så valget må være deterministisk. Er det ikke det, kan to
 *     telefoner heie på hver sin post for det samme målet, og tellerne blir
 *     uenige for alltid uten at noen får en feilmelding.
 *   · At det ikke finnes HEIA på mål imot (P1, låst av Brage 2026-08-20).
 *
 * Ingen av dem kan testes gjennom en skjerm uten å teste alt annet samtidig.
 */
import {
  allowsHeia,
  buildMatchEngagement,
  pickCanonicalPost,
  showsEngagement,
  type MatchFeedPost,
} from '../src/shared/matchEngagement';
import {
  matchCommentA11yLabel,
  matchHeiaA11yLabel,
} from '../src/shared/matchCopy';

function post(
  postId: string,
  postType: string,
  seconds: number,
  matchEventId?: string,
): MatchFeedPost {
  return {
    postId,
    matchEventId,
    postType,
    createdAt: new Date(2026, 7, 20, 18, 0, seconds),
    heiaCount: 0,
    commentCount: 0,
    iReacted: false,
  };
}

describe('den kanoniske posten for ett øyeblikk', () => {
  it('velger hendelsens egen post, ikke bildet som ble festet på den', () => {
    // Rekkefølgen i praksis: `report_match_event` skriver målposten i samme
    // transaksjon som målet, bildet kommer sekunder senere.
    const chosen = pickCanonicalPost([
      post('p-goal', 'match_event', 0, 'me-1'),
      post('p-photo', 'bilde', 40, 'me-1'),
    ]);
    expect(chosen?.postId).toBe('p-goal');
  });

  it('velger hendelsens egen post selv når bildet kom FØRST', () => {
    // Rekkefølge er ikke regelen — typen er. Et bilde kan i prinsippet ha en
    // tidligere `created_at` (klokkeskjevhet, eller en post som skrives om).
    const chosen = pickCanonicalPost([
      post('p-photo', 'bilde', 0, 'me-1'),
      post('p-goal', 'match_event', 40, 'me-1'),
    ]);
    expect(chosen?.postId).toBe('p-goal');
  });

  it('velger ELDSTE ikke-bilde når det finnes flere', () => {
    const chosen = pickCanonicalPost([
      post('p-late', 'match_event', 90, 'me-1'),
      post('p-first', 'match_event', 10, 'me-1'),
    ]);
    expect(chosen?.postId).toBe('p-first');
  });

  it('er deterministisk når to poster deler tidsstempel', () => {
    // Uten tie-break avgjør array-rekkefølgen, og den kan komme ulikt ut av
    // to klienter. Da ville to telefoner heiet på hver sin post.
    const a = post('p-aaa', 'match_event', 5, 'me-1');
    const b = post('p-bbb', 'match_event', 5, 'me-1');
    expect(pickCanonicalPost([a, b])?.postId).toBe('p-aaa');
    expect(pickCanonicalPost([b, a])?.postId).toBe('p-aaa');
  });

  it('faller tilbake til bildeposten når den er alt som er igjen', () => {
    // ⚠️ IKKE TEORI. «Slett innlegget» i feeden treffer i dag målposter (P3s
    // andre halvvei, som står ÅPEN i prod til skive 8). Sletter reporteren
    // målposten sin, står hendelsen igjen i forløpet med bare bildet sitt —
    // og uten denne fallbacken ville raden tilbudt HEIA uten å ha noe å
    // henge det på.
    const chosen = pickCanonicalPost([
      post('p-photo-2', 'bilde', 40, 'me-1'),
      post('p-photo-1', 'bilde', 10, 'me-1'),
    ]);
    expect(chosen?.postId).toBe('p-photo-1');
  });

  it('gir ingenting når øyeblikket ikke har noen post i det hele tatt', () => {
    expect(pickCanonicalPost([])).toBeUndefined();
  });
});

describe('oppslagene forløpet bruker', () => {
  const ROWS: MatchFeedPost[] = [
    {
      ...post('p-goal', 'match_event', 0, 'me-1'),
      heiaCount: 12,
      iReacted: true,
    },
    {...post('p-shot', 'bilde', 40, 'me-1'), heiaCount: 3},
    {...post('p-free', 'bilde', 80), commentCount: 5},
  ];

  it('gir øyeblikket sin kanoniske post, ikke bildets tall', () => {
    const {byMatchEvent} = buildMatchEngagement(ROWS);
    expect(byMatchEvent.get('me-1')).toEqual({
      postId: 'p-goal',
      heiaCount: 12,
      commentCount: 0,
      iReacted: true,
    });
  });

  it('slår opp et frittstående kampbilde på sin EGEN post', () => {
    // `MatchPhoto.id` ER post-id-en (get_match_photos), så bilderaden i
    // forløpet trenger aldri det kanoniske valget.
    const {byPost} = buildMatchEngagement(ROWS);
    expect(byPost.get('p-free')?.commentCount).toBe(5);
    // Også bildet som HENGER på målet er sin egen post i dette oppslaget —
    // det er bare ikke det raden for målet bruker.
    expect(byPost.get('p-shot')?.heiaCount).toBe(3);
  });
});

describe('P1 — HEIA-reglene, låst', () => {
  it('gir HEIA på mål for oss', () => {
    expect(allowsHeia({type: 'mål', teamSide: 'home'})).toBe(true);
  });

  it('gir ALDRI HEIA på mål imot', () => {
    expect(allowsHeia({type: 'mål', teamSide: 'away'})).toBe(false);
  });

  it('behandler mål uten side som mål imot', () => {
    // Skal ikke skje etter 00020, men å feire motstanderens mål er verre enn
    // å underfeire vårt eget — samme forsiktighetsregel som `nodeKindFor`.
    expect(allowsHeia({type: 'mål'})).toBe(false);
  });

  it('gir HEIA på reporterens oppdatering', () => {
    expect(allowsHeia({type: 'melding'})).toBe(true);
  });

  it('gir mål imot en kommentarhandling likevel', () => {
    // Selve poenget i P1: ingen HEIA, men samtalen er tillatt.
    expect(showsEngagement({type: 'mål', teamSide: 'away'})).toBe(true);
    expect(allowsHeia({type: 'mål', teamSide: 'away'})).toBe(false);
  });

  it('gir rytmemarkørene INGEN engasjementslinje', () => {
    // De HAR feed-poster — `start_match`/`report_match_event` skriver dem som
    // alt annet — men de er kampens gater, ikke øyeblikk man reagerer på.
    for (const type of ['avspark', 'pause', 'andre_omgang', 'slutt'] as const) {
      expect(showsEngagement({type})).toBe(false);
      expect(allowsHeia({type})).toBe(false);
    }
  });

  it('gir historiske bytter og kort ingen linje', () => {
    expect(showsEngagement({type: 'bytte'})).toBe(false);
    expect(showsEngagement({type: 'kort'})).toBe(false);
  });
});

describe('handlingene som tale', () => {
  // «En teller alene («34») er ikke en label» — tilgjengelighetskravet.
  it('sier hva trykket gjør, hvilket øyeblikk, og hvor mange', () => {
    expect(
      matchHeiaA11yLabel({
        subject: {type: 'mål', minute: 34, teamSide: 'home'},
        minute: 34,
        count: 12,
      }),
    ).toBe('Heia på målet på 34 minutter. 12 heier.');
  });

  it('bøyer entall', () => {
    expect(
      matchHeiaA11yLabel({
        subject: {type: 'melding', minute: 1},
        minute: 1,
        count: 1,
      }),
    ).toBe('Heia på oppdateringen på 1 minutt. 1 heia.');
  });

  it('navngir motstanderens mål i kommentar-labelen', () => {
    expect(
      matchCommentA11yLabel({
        subject: {type: 'mål', minute: 23, teamSide: 'away'},
        minute: 23,
        count: 0,
      }),
    ).toBe(
      'Åpne samtalen om målet til motstanderen på 23 minutter. 0 kommentarer.',
    );
  });

  it('klarer seg uten minutt på et bilde med ukjent kampstart', () => {
    expect(matchCommentA11yLabel({subject: 'photo', count: 2})).toBe(
      'Åpne samtalen om bildet. 2 kommentarer.',
    );
  });
});
