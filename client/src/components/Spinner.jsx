import { Loader2 } from 'lucide-react';

export default function Spinner({ className = 'w-4 h-4', label = 'Loading' }) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
