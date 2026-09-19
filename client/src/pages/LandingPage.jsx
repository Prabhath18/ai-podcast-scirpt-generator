import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Wordmark from '../components/Wordmark.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import AuthModal from '../components/AuthModal.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { demoOutlines } from '../services/demoData.js';
import { segmentTimings } from '../utils/durationMath.js';

const DEMO_ID = 'tech';

const STEPS = [
  {
    title: 'Enter a topic and a tone',
    body: 'Say what the episode is about, how long it runs, and whether it is solo, a duo or a group. Add a guest if there is one.',
  },
  {
    title: 'Get a timed outline',
    body: 'In seconds you have 5 to 8 segments with talking points, a transition after each, and durations that add up to your length.',
  },
  {
    title: 'Edit it, then export',
    body: 'Click any line to change it, drag segments into a new order, and download the script when it reads right.',
  },
];

const FEATURES = [
  { title: 'Outline generation', body: 'Every segment has 3 to 5 specific talking points and a spoken transition. Durations always add up to the length you asked for.' },
  { title: 'Deep Dive notes', body: 'Ask for research notes and follow-up prompts on any one segment. They stay put until you choose to rewrite them.' },
  { title: 'Guest questions', body: 'Interview questions written around your guest’s background, in an order that warms up. Edit them, or regenerate them on their own.' },
  { title: 'Inline editing', body: 'Click a title, a point or a duration to change it. Drag to reorder. The timeline and the running clock follow.' },
  { title: 'Export', body: 'Download Markdown or plain text, or open a print-ready production script with a timing column and save it as a PDF.' },
  { title: 'Saved projects and share links', body: 'Save to an account, share a read-only link, and let signed-in collaborators comment on a segment.' },
];

const cta = 'btn h-10 px-5 text-base';

function SamplePreview() {
  const demo = demoOutlines.find((d) => d.id === DEMO_ID);
  const { outline } = demo;
  const timings = segmentTimings(outline.segments);
  const shown = outline.segments.slice(0, 3);

  return (
    <figure aria-labelledby="sample-caption" className="card">
      <figcaption id="sample-caption" className="label border-b border-line px-5 py-3">
        Sample outline, as it looks in the app
      </figcaption>
      <div className="px-5 py-5 sm:px-6">
        <p className="label">Episode outline</p>
        <p className="mt-1 font-serif text-xl font-semibold sm:text-2xl">{outline.episode_title}</p>
        <p className="tabular mt-2 flex flex-wrap gap-x-4 font-mono text-xs text-ink-muted">
          <span>{outline.tone}</span>
          <span>{outline.total_duration_mins} min</span>
          <span>{outline.segments.length} segments</span>
        </p>

        <ol className="mt-5">
          {shown.map((segment, index) => (
            <li key={segment.id} className="grid grid-cols-[2.25rem_1fr] gap-x-3 border-t border-line py-4 sm:grid-cols-[3.25rem_1fr]">
              <span className="tabular font-mono text-sm font-medium text-ink-muted" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-lg font-semibold">{segment.title}</h3>
                  <span className="tabular shrink-0 font-mono text-sm text-ink-muted">{segment.duration_mins} min</span>
                </div>
                <p className="tabular font-mono text-xs text-ink-faint">
                  {timings[index].start} to {timings[index].end}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {segment.talking_points.slice(0, 2).map((point) => (
                    <li key={point} className="flex gap-2.5 text-base">
                      <span className="mt-[0.8em] h-px w-2.5 shrink-0 bg-ink-faint" aria-hidden="true" />
                      <span className="max-w-measure">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
        <p className="border-t border-line pt-4 text-sm text-ink-muted">
          and {outline.segments.length - shown.length} more segments, guest questions and an outro.
        </p>
      </div>
    </figure>
  );
}

export default function LandingPage() {
  const { user, isAuthenticated, checking, logout } = useAuth();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(null); // null | 'login' | 'signup'

  // Signed-in visitors are offered the app itself; everyone else starts it. Both go to /app.
  const primaryLabel = isAuthenticated ? 'Open app' : 'Get started';
  const tryDemo = () => navigate('/app', { state: { demo: DEMO_ID } });

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only rounded bg-page px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
        Skip to the content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-2 sm:gap-x-6 sm:px-6">
          <Link to="/" aria-label="Podcast Outline AI, home" className="rounded-sm">
            <Wordmark />
          </Link>

          <nav aria-label="Primary" className="order-3 flex w-full gap-5 pb-1 text-sm sm:order-2 sm:w-auto sm:flex-1 sm:pb-0">
            <a href="#features" className="rounded-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">Features</a>
            <a href="#how-it-works" className="rounded-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">How it works</a>
          </nav>

          <div className="order-2 flex min-h-8 items-center gap-1 sm:order-3">
            {!checking &&
              (isAuthenticated ? (
                <>
                  <Link to="/app" className="btn btn-primary px-2.5 sm:px-3">Open app</Link>
                  <button type="button" className="btn btn-quiet px-2.5 sm:px-3" onClick={logout}>Log out</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-quiet px-2.5 sm:px-3" onClick={() => setAuthMode('login')}>Log in</button>
                  <button type="button" className="btn btn-primary px-2.5 sm:px-3" onClick={() => setAuthMode('signup')}>Sign up</button>
                </>
              ))}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        <section aria-labelledby="hero-heading" className="mx-auto max-w-[1180px] px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
          <p className="label">For podcast hosts and producers</p>
          <h1 id="hero-heading" className="mt-3 max-w-[16ch] font-serif text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-[3.5rem]">
            Plan the episode before you hit record.
          </h1>
          <p className="mt-5 max-w-[34rem] text-prose text-ink-muted">
            Describe the topic and the tone. Get a timed outline with talking points, transitions and guest questions, then edit it like a script.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/app" className={`${cta} btn-primary`}>{primaryLabel}</Link>
            <button type="button" className={cta} onClick={tryDemo}>Try a demo</button>
          </div>
          <p className="mt-4 text-sm text-ink-faint">The demo needs no account and no API key.</p>
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
            <h2 id="how-heading" className="font-serif text-xl font-semibold sm:text-2xl">How it works</h2>
            <ol className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="border-t-2 border-ink pt-4">
                  <p className="tabular font-mono text-sm text-ink-muted">{String(index + 1).padStart(2, '0')}</p>
                  <h3 className="mt-1 font-serif text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-base text-ink-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
            <h2 id="features-heading" className="font-serif text-xl font-semibold sm:text-2xl">What you get</h2>
            <ul className="mt-8 grid gap-x-10 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="border-t border-line py-5">
                  <h3 className="font-serif text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-base text-ink-muted">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="sample-heading" className="border-t border-line">
          <div className="mx-auto grid max-w-[1180px] gap-x-12 gap-y-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div>
              <h2 id="sample-heading" className="font-serif text-xl font-semibold sm:text-2xl">A finished outline reads like a script</h2>
              <p className="mt-2 text-base text-ink-muted">
                Numbered segments, a running clock in the margin, and talking points specific enough to record from. This one is a bundled demo.
              </p>
              <button type="button" className="btn mt-5" onClick={tryDemo}>Open this demo</button>
            </div>
            <SamplePreview />
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="border-t border-line">
          <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 sm:py-20">
            <h2 id="cta-heading" className="max-w-[20ch] font-serif text-2xl font-semibold sm:text-[2.5rem] sm:leading-tight">
              Your next episode starts with a topic.
            </h2>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/app" className={`${cta} btn-primary`}>{primaryLabel}</Link>
              <button type="button" className={cta} onClick={tryDemo}>Try a demo</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark />
          <p className="max-w-[34rem] text-sm text-ink-muted">
            Outlines are written by an AI model. Check facts before you publish.
            {user ? '' : ' Your draft stays in this browser unless you create an account.'}
          </p>
        </div>
      </footer>

      {authMode && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={() => {
            setAuthMode(null);
            navigate('/app');
          }}
        />
      )}
    </div>
  );
}
