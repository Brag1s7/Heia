import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../lib/supabase';
import {getProfile} from '../lib/api/profile';
import {refreshSessionContext} from '../lib/queries/sessionContext';
import {
  readBootSeed,
  writeBootSeedProfile,
} from '../lib/queries/persistedCache';
import {clearLocalCaches} from '../lib/account';
import {stopPush} from '../lib/push';
import type {Profile} from '../lib/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /**
   * `needsConfirmation`: e-postbekreftelse er PÅ og brukeren må taste
   * koden fra e-posten før kontoen virker (VerifyEmailScreen).
   */
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{needsConfirmation: boolean}>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Bekreft ny konto med 6-sifret kode fra e-posten. Gir session. */
  confirmSignup: (email: string, code: string) => Promise<void>;
  /** Send ny bekreftelseskode (registrering). */
  resendSignupCode: (email: string) => Promise<void>;
  /** Send passord-reset-kode til e-posten. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Verifiser reset-koden og sett nytt passord. Gir session. */
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<void>;
  /**
   * Bytter passord for den innloggede brukeren.
   *
   * ⚠️ `current_password` sendes MED, og valideres av GoTrue i SAMME
   * forespørsel — ikke av oss. Se `changePassword` under for hvorfor det
   * skillet er hele poenget.
   */
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  /** Leser profilen på nytt — etter at du har endret navn eller telefon. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({children}: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Bruker-ID-en, ikke hele user-objektet: identiteten på `session.user` endres
  // ved hver token-refresh, og effekter som avhenger av den ville kjørt om
  // igjen uten at brukeren faktisk er en annen.
  const userId = session?.user?.id;

  // Hent profil når session endres. S2: profilen ligger i kontekst-svaret,
  // så vi DELER TeamContexts kall i stedet for å eie et eget getProfile —
  // maxAgeMs + single-flight i orkestratoren gjør at den av de to som
  // kommer først starter kallet og den andre blir med, uansett
  // effektrekkefølge. Fallback (RPC mangler/feiler, eller svaret er en
  // annen brukers): nøyaktig dagens getProfile-vei.
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    // S7b: bootfrøets minimale profil slipper navigatoren forbi
    // `session && !profile`-porten uten å vente på nett. `prev ??` gjør
    // frøet til en no-op når nettsvaret alt har landet (krav 7) — ferskt
    // vinner alltid, og frøet leses kun for nøyaktig denne userId-en.
    readBootSeed(userId)
      .then(seed => {
        const seedProfile = seed?.profile;
        if (!cancelled && seedProfile && seedProfile.id === userId) {
          setProfile(prev => prev ?? seedProfile);
        }
      })
      .catch(() => {});
    refreshSessionContext(undefined, {maxAgeMs: 60_000}).then(ctx => {
      if (cancelled) {
        return;
      }
      if (ctx?.profile && ctx.profile.id === userId) {
        setProfile(ctx.profile);
        // S7b: frøet speiler siste ferske profil (telefon/husholdning
        // nulles i skriveren) — neste kaldstart booter på den.
        writeBootSeedProfile(userId, ctx.profile);
        return;
      }
      getProfile(userId)
        .then(p => {
          if (!cancelled) {
            setProfile(p);
            writeBootSeedProfile(userId, p);
          }
        })
        .catch(() => {
          if (!cancelled) {
            // S7b: en frø-satt profil skal OVERLEVE et feilet nettkall
            // (offline kaldstart, krav 10) — null kun når ingenting står.
            setProfile(prev => prev ?? null);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Initial session check + auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({data: {session: s}}) => {
      setSession(s);
      setLoading(false);
    });

    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const {data, error} = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {display_name: displayName},
        },
      });
      if (error) {
        throw error;
      }
      // Med e-postbekreftelse PÅ kommer ingen session før koden er
      // tastet. (NB: finnes e-posten fra før, «lykkes» kallet også —
      // uten at noen kode sendes. Anti-enumerering fra Supabase;
      // VerifyEmailScreen har hintet «prøv å logge inn».)
      return {needsConfirmation: data.session == null};
    },
    [],
  );

  const confirmSignup = useCallback(async (email: string, code: string) => {
    const {error} = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    });
    if (error) {
      throw error;
    }
  }, []);

  const resendSignupCode = useCallback(async (email: string) => {
    const {error} = await supabase.auth.resend({type: 'signup', email});
    if (error) {
      throw error;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    // Ingen redirectTo: malen sender en 6-sifret kode ({{ .Token }}),
    // ikke en lenke — appen har ingen deep links før native-runden.
    const {error} = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      throw error;
    }
  }, []);

  const confirmPasswordReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      const {error} = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });
      if (error) {
        throw error;
      }
      // verifyOtp ga session — skjermen under oss byttes til appen, men
      // denne kjeden fullfører uansett. Feiler passordbyttet, er brukeren
      // likevel innlogget og kan prøve på nytt fra Profil senere.
      const {error: pwError} = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (pwError) {
        throw pwError;
      }
    },
    [],
  );

  /**
   * Passordbytte fra Profil → «Passord og sikkerhet».
   *
   * SIKKERHETSGRENSEN LIGGER PÅ SERVEREN, ikke her. Dashboard-bryteren
   * «Require current password when updating» (Auth → Email) er PÅ, og da
   * kjører GoTrue denne grenen i internal/api/user.go:
   *
   *     if config.Security.UpdatePasswordRequireCurrentPassword {
   *       if !session.IsRecovery() {
   *         ... krev current_password, og user.Authenticate(...) mot den
   *
   * Derfor sendes `current_password` med i selve oppdateringen. Vi verifiserer
   * det IKKE selv først: en `signInWithPassword`-sjekk i appflyten ville vært
   * en sjekk, ikke en grense — den kan hoppes over av alt som ikke er denne
   * skjermen, og den ville i tillegg brent innloggings-rate-limiten
   * (`sign_in_sign_ups`, 30 per 5 min per IP), slik at et helt lag på samme
   * klubb-wifi kunne blitt sperret ute fordi én forelder gjettet feil.
   * Server-veien bruker `password_verification_attempt` i stedet.
   *
   * ⚠️ Bryteren er DASHBOARD-ONLY: supabase-CLI-en har ingen config.toml-nøkkel
   * for den (kun `secure_password_change`, som er reautentisering — en annen,
   * svakere mekanisme med et 24-timers hull). `supabase config push` sender
   * derfor ikke feltet og lar den stå. Se kommentaren i supabase/config.toml.
   *
   * Glemt-passord-flyten er UBERØRT: den går via en recovery-session, og
   * GoTrue unntar den eksplisitt (`!session.IsRecovery()`).
   */
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const {error} = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) {
        throw error;
      }
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const {error} = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    // Avregistrer enhets-token FØR session-en tømmes: RPC-en sletter kun
    // token som tilhører auth.uid(), og etter signOut er den null.
    await stopPush().catch(() => {});
    // Delt enhet skal være ren (P1): modul-cacher og signerte medie-URL-er
    // ryddes HER — det eneste punktet begge utloggingsinngangene passerer.
    await clearLocalCaches().catch(() => {});
    setSession(null);
    setProfile(null);
    await supabase.auth.signOut().catch(() => {});
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    try {
      setProfile(await getProfile(userId));
    } catch {
      // Profilen på skjermen er fortsatt gyldig — la den stå.
    }
  }, [userId]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        confirmSignup,
        resendSignupCode,
        requestPasswordReset,
        confirmPasswordReset,
        changePassword,
        refreshProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
