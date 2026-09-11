import React, {useCallback, useEffect, useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from './supabase';
import {Button, Field, Notice} from '../app/ui';

// ---------------------------------------------------------------------------
// Samme kontoer og samme auth-flyt som appen (UserContext.tsx): e-post +
// passord, 6-sifret kode for bekreftelse (type 'signup') og passordreset
// (type 'recovery'). Ingen lenker, ingen redirect-URL-er.
// ---------------------------------------------------------------------------

export function useSession(): {session: Session | null; loading: boolean} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({data}) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const {data: sub} = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return {session, loading};
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

type Mode = 'login' | 'signup' | 'verify' | 'reset' | 'reset-confirm';

interface AuthPanelProps {
  /** Hvorfor brukeren må logge inn — vises over skjemaet. */
  reason?: string;
  /** Forhåndsutfylt e-post (f.eks. fra invitasjonen). */
  presetEmail?: string;
  compact?: boolean;
}

function messageFor(err: unknown): string {
  const m = (err as {message?: string})?.message ?? '';
  if (/invalid login credentials/i.test(m)) return 'Feil e-post eller passord.';
  if (/email not confirmed/i.test(m)) return 'E-posten er ikke bekreftet ennå. Skriv inn koden fra e-posten.';
  if (/token has expired|otp_expired/i.test(m)) return 'Koden er utløpt. Be om en ny.';
  if (/invalid|incorrect/i.test(m) && /token|otp|code/i.test(m)) return 'Feil kode. Prøv igjen.';
  if (/password should be at least/i.test(m)) return 'Passordet må ha minst 6 tegn.';
  if (/rate limit|too many/i.test(m)) return 'For mange forsøk — vent litt og prøv igjen.';
  if (/user already registered/i.test(m)) return 'Det finnes alt en konto med denne e-posten. Logg inn i stedet.';
  return m || 'Noe gikk galt — prøv igjen.';
}

export function AuthPanel({reason, presetEmail = '', compact}: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const login = () =>
    run(async () => {
      const {error} = await supabase.auth.signInWithPassword({email: email.trim(), password});
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          setMode('verify');
          setInfo('E-posten er ikke bekreftet. Skriv inn koden fra e-posten, eller be om en ny.');
          return;
        }
        throw error;
      }
    });

  const signup = () =>
    run(async () => {
      if (name.trim().length < 2) throw new Error('Skriv inn navnet ditt.');
      const {data, error} = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {data: {display_name: name.trim()}},
      });
      if (error) throw error;
      if (data.session == null) {
        setMode('verify');
        setInfo('Vi har sendt en 6-sifret kode til e-posten din. Finnes e-posten fra før, kommer ingen kode — prøv å logge inn i stedet.');
      }
    });

  const verify = () =>
    run(async () => {
      const {error} = await supabase.auth.verifyOtp({email: email.trim(), token: code.trim(), type: 'signup'});
      if (error) throw error;
    });

  const resend = () =>
    run(async () => {
      const {error} = await supabase.auth.resend({type: 'signup', email: email.trim()});
      if (error) throw error;
      setInfo('Ny kode er sendt.');
    });

  const requestReset = () =>
    run(async () => {
      const {error} = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setMode('reset-confirm');
      setInfo('Vi har sendt en 6-sifret kode til e-posten din.');
    });

  const confirmReset = () =>
    run(async () => {
      const {error} = await supabase.auth.verifyOtp({email: email.trim(), token: code.trim(), type: 'recovery'});
      if (error) throw error;
      const {error: pwError} = await supabase.auth.updateUser({password});
      if (pwError) throw pwError;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (mode === 'login') login();
    else if (mode === 'signup') signup();
    else if (mode === 'verify') verify();
    else if (mode === 'reset') requestReset();
    else confirmReset();
  };

  const title =
    mode === 'login' ? 'Logg inn' :
    mode === 'signup' ? 'Opprett konto' :
    mode === 'verify' ? 'Bekreft e-posten' :
    mode === 'reset' ? 'Glemt passord' : 'Nytt passord';

  return (
    <form className={`auth ${compact ? 'auth-compact' : ''}`} onSubmit={submit} noValidate>
      <h2 className="auth-title">{title}</h2>
      {reason && mode === 'login' && <p className="auth-reason">{reason}</p>}
      {info && <Notice tone="info">{info}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
        <Field label="E-post" type="email" value={email} onChange={setEmail} autoComplete="email" required />
      )}
      {mode === 'signup' && (
        <Field label="Navn" value={name} onChange={setName} autoComplete="name" required hint="Slik laget ser deg — samme navn som i appen." />
      )}
      {(mode === 'login' || mode === 'signup') && (
        <Field label="Passord" type="password" value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
      )}
      {(mode === 'verify' || mode === 'reset-confirm') && (
        <>
          <p className="muted small">Koden er sendt til <b>{email}</b>.</p>
          <Field label="6-sifret kode" value={code} onChange={setCode} inputMode="numeric" autoComplete="one-time-code" required />
        </>
      )}
      {mode === 'reset-confirm' && (
        <Field label="Nytt passord" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
      )}

      <div className="auth-actions">
        <Button type="submit" busy={busy} primary>
          {mode === 'login' ? 'Logg inn' : mode === 'signup' ? 'Opprett konto' : mode === 'verify' ? 'Bekreft' : mode === 'reset' ? 'Send kode' : 'Lagre passord'}
        </Button>
        {mode === 'verify' && <Button type="button" onClick={resend} disabled={busy}>Send ny kode</Button>}
      </div>

      <div className="auth-links">
        {mode === 'login' && (
          <>
            <button type="button" onClick={() => setMode('signup')}>Ny i Heia? Opprett konto</button>
            <button type="button" onClick={() => setMode('reset')}>Glemt passord</button>
          </>
        )}
        {mode !== 'login' && <button type="button" onClick={() => { setMode('login'); setError(null); setInfo(null); }}>Tilbake til innlogging</button>}
      </div>
    </form>
  );
}
