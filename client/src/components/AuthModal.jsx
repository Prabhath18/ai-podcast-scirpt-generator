import { useState } from 'react';
import Modal from './Modal.jsx';
import FormField, { Segmented } from './FormField.jsx';
import Spinner from './Spinner.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { ApiError } from '../services/api.js';

const MODES = [
  { value: 'login', label: 'Log in' },
  { value: 'signup', label: 'Create account' },
];

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  const validate = () => {
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
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
      setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Try again in a moment.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={mode === 'login' ? 'Log in' : 'Create an account'} onClose={onClose}>
      <p className="mb-4 text-sm text-ink-muted">An account lets you save projects, share them, and comment. Everything else works without one.</p>
      <div className="mb-5">
        <Segmented label="Log in or create an account" options={MODES} value={mode} onChange={setMode} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField id="auth-email" label="Email" required error={errors.email}>
          <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" aria-invalid={Boolean(errors.email)} data-autofocus />
        </FormField>

        <FormField id="auth-password" label="Password" required error={errors.password} hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
          <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="field" aria-invalid={Boolean(errors.password)} />
        </FormField>

        {errors.form && (
          <p className="text-sm text-danger" role="alert">
            {errors.form}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary h-9 w-full">
          {loading && <Spinner className="h-3.5 w-3.5" label="Submitting" />}
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </Modal>
  );
}
