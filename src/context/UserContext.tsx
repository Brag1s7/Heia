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
import {stopPush} from '../lib/push';
import type {Profile} from '../lib/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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
      getProfile()
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
      const {error} = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {display_name: displayName},
        },
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
    setSession(null);
    setProfile(null);
    await supabase.auth.signOut().catch(() => {});
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    try {
      setProfile(await getProfile());
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
