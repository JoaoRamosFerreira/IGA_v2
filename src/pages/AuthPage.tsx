import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === 'login') {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) setError(loginError.message);
      return;
    }

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signupError) {
      setError(signupError.message);
      return;
    }

    if (data.user) {
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        email: email.toLowerCase(),
        full_name: fullName || null,
        role: 'user',
        status: 'pending',
      });
    }

    setMessage('Signup complete. An admin must approve your account before access is granted.');
  }

  return (
    <section className="mx-auto mt-16 max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{mode === 'login' ? 'Login' : 'Sign Up'}</h1>
      <p className="mt-1 text-sm text-slate-600">Email authentication with admin approval workflow.</p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        {mode === 'signup' ? (
          <label className="block text-sm">
            <span className="mb-1 block">Full Name</span>
            <input className="w-full rounded border px-3 py-2" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block">Email</span>
          <input type="email" required className="w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Password</span>
          <input type="password" required className="w-full rounded border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <button className="w-full rounded bg-indigo-600 py-2 text-white">
          {mode === 'login' ? 'Login' : 'Create Account'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))}
        className="mt-4 text-sm text-indigo-700"
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
      </button>
    </section>
  );
}
