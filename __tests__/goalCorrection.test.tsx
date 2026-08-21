/**
 * @format
 *
 * KORRIGER MÅL (skive 8) — domenehandlingen, ikke «Rediger/Slett innlegg».
 *
 * Fem ting kan gå galt her uten at noen ser det før på en telefon:
 *
 *   1. Menyen dukker opp på noe annet enn et mål. Rytmemarkørene eier
 *      kampuret (00073), og serveren avviser dem — en knapp der ville vært en
 *      knapp som alltid feiler.
 *   2. Menyen dukker opp for et vanlig medlem. Serveren er vakten, men en
 *      flate som tilbyr en handling brukeren ikke har lov til, lyver.
 *   3. Menyen bindes til den kanoniske POSTEN i stedet for hendelsen. Da er
 *      det NYESTE målet — nettopp det man retter — det ene man ikke kan
 *      rette, fordi posten ikke er lest inn ennå.
 *   4. «Slett innlegget» blir stående på en målpost. Det er halvvei 2 i P3,
 *      og den som gjorde at brukeren TRODDE hun hadde angret.
 *   5. Gaten mot mål imot blir for bred og tar brukerens bilde med seg.
 *      Voktet i `feedHeiaGate.test.tsx`; her voktes den delte regelen.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';

import {GoalCorrectionSheet} from '../src/components/match/GoalCorrectionSheet';

import {MatchEngagementRow} from '../src/components/match/MatchEngagementRow';
import {
  canCorrectGoal,
  feedAllowsHeia,
  isSystemMatchPost,
} from '../src/shared/matchEngagement';
import type {MatchEngagement} from '../src/shared/matchEngagement';

const ENGAGEMENT: MatchEngagement = {
  postId: 'p-goal',
  heiaCount: 3,
  commentCount: 1,
  iReacted: false,
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

function render(node: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(node);
  });
  mounted.push(tree);
  return tree;
}

/** Alle a11y-labels i treet — hva flaten faktisk TILBYR. */
function labels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as {
      props?: {accessibilityLabel?: string};
      children?: unknown;
    };
    if (node.props?.accessibilityLabel) out.push(node.props.accessibilityLabel);
    walk(node.children);
  };
  walk(tree.toJSON());
  return out;
}

function row(extra: Partial<React.ComponentProps<typeof MatchEngagementRow>>) {
  return render(
    <MatchEngagementRow
      engagement={ENGAGEMENT}
      canHeia
      heiaLabel="Heia på målet"
      commentLabel="Åpne samtalen om målet"
      fontCap={1.3}
      onHeia={() => {}}
      onComment={() => {}}
      {...extra}
    />,
  );
}

describe('menyen på øyeblikket', () => {
  it('tegnes IKKE uten `onCorrect` — publikum ser den aldri', () => {
    expect(labels(row({}))).not.toContain('Korriger målet på 34 minutter');
  });

  it('tegnes for den som har lov, med en setning som sier hva den gjør', () => {
    const tree = row({
      onCorrect: () => {},
      correctLabel: 'Korriger målet på 34 minutter',
    });
    expect(labels(tree)).toContain('Korriger målet på 34 minutter');
  });

  it('⭐ er trykkbar UTEN at posten er lest inn ennå', () => {
    // HEIA og kommentarer er disabled til den kanoniske posten finnes — en
    // korrigering trenger bare hendelses-id-en, som kalleren alt har. Var
    // knappen bundet til posten, ville det ferskeste målet vært det ene man
    // ikke kunne rette.
    let pressed = 0;
    const tree = row({
      engagement: undefined,
      onCorrect: () => {
        pressed += 1;
      },
      correctLabel: 'Korriger målet',
    });
    const btn = tree.root.findAll(
      n => n.props?.accessibilityLabel === 'Korriger målet',
    )[0];
    expect(btn.props.disabled).toBeFalsy();
    act(() => btn.props.onPress());
    expect(pressed).toBe(1);
  });

  it('rører ikke HEIA og kommentarer', () => {
    const l = labels(row({onCorrect: () => {}, correctLabel: 'Korriger'}));
    expect(l).toContain('Heia på målet');
    expect(l).toContain('Åpne samtalen om målet');
  });
});

describe('canCorrectGoal — kun mål', () => {
  it('er sann for mål, uansett side', () => {
    expect(canCorrectGoal({type: 'mål', teamSide: 'home'})).toBe(true);
    expect(canCorrectGoal({type: 'mål', teamSide: 'away'})).toBe(true);
  });

  it.each(['avspark', 'pause', 'andre_omgang', 'slutt', 'melding'] as const)(
    '⚠️ er USANN for %s — serveren avviser den også',
    type => {
      expect(canCorrectGoal({type})).toBe(false);
    },
  );
});

describe('isSystemMatchPost — skillet «Slett innlegget» henger på', () => {
  it.each(['match_event', 'match_start', 'match_end'])(
    '%s er systemets egen post',
    t => expect(isSystemMatchPost(t)).toBe(true),
  );

  it.each(['bilde', 'melding', 'resultat', 'paaminnelse'])(
    '⭐ %s er BRUKERENS innhold og skal fortsatt kunne slettes',
    t => expect(isSystemMatchPost(t)).toBe(false),
  );

  it('⚠️ et kampBILDE er brukerens, selv om det henger på et mål', () => {
    // Bildet bærer samme match_event_id som øyeblikket (00028). Ble skillet
    // tatt på `match_event_id` i stedet for posttypen, mistet brukeren
    // muligheten til å slette sitt eget bilde — og `soft_delete_post` (00075)
    // ville avvist det.
    expect(isSystemMatchPost('bilde')).toBe(false);
    expect(
      feedAllowsHeia({
        postType: 'bilde',
        matchEvent: {type: 'mål', teamSide: 'away'},
      }),
    ).toBe(true);
  });
});

describe('korrigeringsarket', () => {
  const GOAL = {
    id: 'me-1',
    matchId: 'ms-1',
    type: 'mål' as const,
    minute: 34,
    player: 'Ada',
    note: 'Fra corner',
    description: 'Mål for oss',
    teamSide: 'home' as const,
  };

  function sheet(props: Partial<Record<string, unknown>> = {}) {
    return render(
      <GoalCorrectionSheet
        visible
        event={GOAL}
        opponent="Lyn"
        onSave={() => {}}
        onCancelGoal={() => {}}
        onClose={() => {}}
        {...props}
      />,
    );
  }

  /** All synlig tekst i treet. */
  function texts(tree: ReactTestRenderer.ReactTestRenderer): string {
    const out: string[] = [];
    const walk = (n: unknown) => {
      if (typeof n === 'string') {
        out.push(n);
        return;
      }
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      walk((n as {children?: unknown}).children);
    };
    walk(tree.toJSON());
    // `Button` og `ListRow` bærer teksten som prop, ikke som barn.
    for (const n of tree.root.findAll(
      x => typeof x.props?.title === 'string',
      {deep: true},
    )) {
      out.push(n.props.title as string);
      if (typeof n.props.subtitle === 'string') out.push(n.props.subtitle);
    }
    return out.join(' | ');
  }

  /** Elementet som bærer denne `title`-propen — Button eller ListRow. */
  function byTitle(
    tree: ReactTestRenderer.ReactTestRenderer,
    title: string,
  ): ReactTestRenderer.ReactTestInstance {
    return tree.root.findAll(n => n.props?.title === title, {deep: true})[0];
  }

  it('⭐ snakker om MÅLET, ikke om et innlegg', () => {
    // P3s andre halvvei var at «Slett innlegget» løy på en målpost. Språket
    // her er hele forskjellen: dette er en domenehandling.
    const t = texts(sheet());
    expect(t).toContain('Korriger mål');
    expect(t).toContain('Annuller målet');
    expect(t).not.toContain('Slett innlegget');
    expect(t).not.toContain('Rediger innlegget');
  });

  it('viser hvilket mål man står i, og begge sidene ved navn', () => {
    const t = texts(sheet());
    // Teksten er delt over to noder ({minute}′ i kampen), så begge delene
    // sjekkes hver for seg — ikke som én streng.
    expect(t).toContain('34');
    expect(t).toContain('′ i kampen');
    expect(t).toContain('Mål for oss');
    expect(t).toContain('Mål for Lyn');
  });

  it('⚠️ annullering går ALDRI rett gjennom — den spør først', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let cancelled = 0;
    const tree = sheet({
      onCancelGoal: () => {
        cancelled += 1;
      },
    });
    // Finn raden via teksten, ikke via rekkefølge.
    act(() => byTitle(tree, 'Annuller målet').props.onPress());
    expect(cancelled).toBe(0); // bekreftelsen står imellom
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sender de tre feltene videre, trimmet', () => {
    let got: unknown;
    const tree = sheet({
      onSave: (input: unknown) => {
        got = input;
      },
    });
    act(() => byTitle(tree, 'Lagre rettelsen').props.onPress());
    expect(got).toEqual({
      teamSide: 'home',
      playerName: 'Ada',
      description: 'Fra corner',
    });
  });
});
