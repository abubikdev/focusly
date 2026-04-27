import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'focusly-state-v1';
const SESSION_DURATION = 30 * 60; // 30 min
const CREDIT_STEP = 10;

const seedState = {
  credits: 60,
  sessionActive: false,
  startedAt: null,
  endsAt: null,
  awayEvents: 0,
  puzzleSolved: false,
  puzzleAnswer: ''
};

function formatTimeLeft(seconds) {
  const clamped = Math.max(0, seconds);
  const min = Math.floor(clamped / 60).toString().padStart(2, '0');
  const sec = Math.floor(clamped % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function App() {
  const [state, setState] = useState(() => {
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (!persisted) {
      return seedState;
    }

    try {
      const parsed = JSON.parse(persisted);
      return { ...seedState, ...parsed };
    } catch {
      return seedState;
    }
  });
  const [now, setNow] = useState(Date.now());
  const awayHandledRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const completeSession = (wasBroken) => {
    setState((prev) => {
      if (!prev.sessionActive) {
        return prev;
      }

      const delta = wasBroken ? -CREDIT_STEP : CREDIT_STEP;
      const nextCredits = Math.max(0, prev.credits + delta);

      return {
        ...prev,
        credits: nextCredits,
        sessionActive: false,
        startedAt: null,
        endsAt: null,
        awayEvents: wasBroken ? prev.awayEvents + 1 : prev.awayEvents,
        puzzleSolved: nextCredits > 0 ? prev.puzzleSolved : false,
        puzzleAnswer: nextCredits > 0 ? prev.puzzleAnswer : ''
      };
    });
  };

  useEffect(() => {
    if (!state.sessionActive || !state.endsAt) {
      return;
    }

    if (now >= state.endsAt) {
      completeSession(false);
    }
  }, [now, state.sessionActive, state.endsAt]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!state.sessionActive) {
        return;
      }

      if (document.visibilityState === 'hidden' && !awayHandledRef.current) {
        awayHandledRef.current = true;
        completeSession(true);
      }

      if (document.visibilityState === 'visible') {
        awayHandledRef.current = false;
      }
    };

    const onWindowBlur = () => {
      if (!state.sessionActive || awayHandledRef.current) {
        return;
      }
      awayHandledRef.current = true;
      completeSession(true);
    };

    const onWindowFocus = () => {
      awayHandledRef.current = false;
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [state.sessionActive]);

  const remainingSeconds = useMemo(() => {
    if (!state.sessionActive || !state.endsAt) {
      return SESSION_DURATION;
    }

    return Math.floor((state.endsAt - now) / 1000);
  }, [state.sessionActive, state.endsAt, now]);

  const startSession = () => {
    if (state.sessionActive || (state.credits === 0 && !state.puzzleSolved)) {
      return;
    }

    awayHandledRef.current = false;
    const stamp = Date.now();
    setState((prev) => ({
      ...prev,
      sessionActive: true,
      startedAt: stamp,
      endsAt: stamp + SESSION_DURATION * 1000
    }));
  };

  const stopSession = () => {
    completeSession(true);
  };

  const canPlay = state.credits > 0 || state.puzzleSolved;
  const puzzleValid = state.puzzleAnswer.trim().toLowerCase() === 'focus';

  const solvePuzzle = () => {
    if (!puzzleValid) {
      return;
    }

    setState((prev) => ({
      ...prev,
      puzzleSolved: true,
      credits: Math.max(CREDIT_STEP, prev.credits),
      puzzleAnswer: ''
    }));
  };

  return (
    <main className="min-h-screen bg-white px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-6xl rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.25)] md:p-9">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-400">Focusly</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-5xl">Session Credit</h1>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Credits</p>
            <p className="text-6xl font-medium leading-none text-zinc-950">{state.credits}</p>
          </div>
        </header>

        <div className="mt-7 grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:col-span-2 md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Current Session</p>
            <p className="mt-3 text-6xl font-medium tabular-nums text-zinc-950 md:text-7xl">
              {formatTimeLeft(remainingSeconds)}
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Leave app/tab = -{CREDIT_STEP}. Stay focused to the end = +{CREDIT_STEP}.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startSession}
                disabled={!canPlay || state.sessionActive}
                className="rounded-xl border border-zinc-900 bg-zinc-900 px-5 py-3 text-sm font-semibold uppercase tracking-wider text-zinc-100 transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-300 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                Start Session
              </button>
              <button
                type="button"
                onClick={stopSession}
                disabled={!state.sessionActive}
                className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-wider text-zinc-800 transition hover:-translate-y-0.5 hover:border-zinc-500 hover:shadow-sm disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                End & Deduct
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Stats</p>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">Breaks</dt>
                <dd className="text-4xl font-medium text-zinc-900">{state.awayEvents}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">Status</dt>
                <dd className="text-lg text-zinc-700">{state.sessionActive ? 'Locked in' : 'Idle'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">Unlock</dt>
                <dd className="text-lg text-zinc-700">{state.puzzleSolved ? 'Complete' : 'Pending'}</dd>
              </div>
            </dl>
          </article>
        </div>

        <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Commit puzzle</p>
          <p className="mt-2 text-sm text-zinc-700">
            If credits hit zero, solve the puzzle to continue: type the 5-letter word for deep concentration.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={state.puzzleAnswer}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  puzzleAnswer: event.target.value
                }))
              }
              placeholder="enter answer"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={solvePuzzle}
              disabled={!puzzleValid}
              className="rounded-xl border border-zinc-900 bg-zinc-900 px-5 py-3 text-sm font-semibold uppercase tracking-wider text-zinc-100 transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-300 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              Submit
            </button>
          </div>
          {state.credits === 0 && !state.puzzleSolved ? (
            <p className="mt-3 text-sm font-medium text-zinc-900">
              Credits are 0. Solve puzzle before starting a new session.
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
}

export default App;
