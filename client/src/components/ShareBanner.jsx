import { Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ShareBanner() {
  return (
    <div className="bg-accent-subtle border-b border-accent/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 text-sm text-accent">
        <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>You&apos;re viewing a shared, read-only episode outline.</span>
        <Link to="/" className="ml-auto font-medium underline underline-offset-2 hover:no-underline shrink-0">
          Create your own
        </Link>
      </div>
    </div>
  );
}
