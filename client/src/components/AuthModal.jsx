import { useState } from 'react';
import Modal from './Modal.jsx';
import FormField, { inputClasses } from './FormField.jsx';
import Spinner from './Spinner.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { ApiError } from '../services/api.js';

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  const validate = () => {
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const user = mode === 'login' ? await login(email.trim(), password) : await signup(email.trim(), password);
      onSuccess(user);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ form: err.message });
      } else {
        setErrors({ form: 'Something went wrong. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={mode === 'login' ? 'Log in' : 'Create an account'} onClose={onClose}>
      <div className="flex rounded-lg border border-border p-1 bg-surface-sunken mb-5">
        {['login', 'signup'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === m ? 'bg-surface-raised text-ink shadow-card' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {m === 'login' ? 'Log in' : 'Sign up'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField id="auth-email" label="Email" required error={errors.email}>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>

        <FormField
          id="auth-password"
          label="Password"
          required
          error={errors.password}
          hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
        >
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses}
            aria-invalid={Boolean(errors.password)}
          />
        </FormField>

        {errors.form && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errors.form}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-medium py-2.5 transition-colors"
        >
          {loading && <Spinner className="w-4 h-4 text-white" label="Submitting" />}
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </Modal>
  );
}
