// Konfigurerbare lenker og opplysninger for nettsiden.
// Tomme verdier = flaten faller tilbake til kontaktknappen. Ingen verdi her
// er funnet på: alt som mangler, mangler fordi det ikke er bekreftet.

/** Offentlig TestFlight-lenke (App Store Connect → TestFlight → gruppe →
 *  Enable Public Link). Tom til Brage bekrefter at den skal være offentlig. */
export const TESTFLIGHT_URL = '';

/** App Store-lenke. Tom til appen er live i App Store. */
export const APP_STORE_URL = '';

/** App Store-ID for Smart App Banner (kun når appen er live). */
export const APP_STORE_ID = '';

export const CONTACT_EMAIL = 'hello@heiaapp.no';

/** Juridisk enhet. null = ikke bekreftet ennå — vises som «kommer», aldri
 *  som oppdiktet verdi. Fylles inn når Heia AS er registrert. */
export const LEGAL = {
  companyName: null as string | null,
  orgNumber: null as string | null,
  address: null as string | null,
};

/** Betalingsfordelingen — verifisert mot heia_support_defaults (migrasjon
 *  00062): 7900 øre, fee_model fixed_club_amount, club_fixed_minor 6000. */
export const SUPPORT = {
  priceNok: 79,
  clubNok: 60,
  heiaNok: 19,
};

/** Primær-CTA: TestFlight hvis den finnes, ellers App Store, ellers kontakt. */
export function primaryCta(): {href: string; label: string; note: string} {
  if (APP_STORE_URL) {
    return {href: APP_STORE_URL, label: 'Last ned i App Store', note: ''};
  }
  if (TESTFLIGHT_URL) {
    return {
      href: TESTFLIGHT_URL,
      label: 'Bli med i testen',
      note: 'Krever TestFlight-appen på iPhone.',
    };
  }
  return {
    href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Vi vil prøve Heia med laget vårt')}`,
    label: 'Ta kontakt for å prøve Heia',
    note: 'Heia er i pilot på iPhone. Send oss en e-post, så tar vi laget ditt med.',
  };
}
