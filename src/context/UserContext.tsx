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

  // Hent profil når session endres
  useEffect(() => {
    if (userId) {
      getProfile(userId)
        .then(setProfile)
        .catch(() => setProfile(null));
    } else {
      setProfile(null);
    }
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
