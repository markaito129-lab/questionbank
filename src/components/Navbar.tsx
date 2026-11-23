import type { User } from 'firebase/auth';
import type { AppView } from '../types';

interface NavbarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  user: User | null;
  isQuizActive: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: 'arena', label: 'Quiz Arena' },
  { id: 'leaderboards', label: 'Leaderboards' },
  { id: 'rules', label: 'Scoring Rules' },
  { id: 'admin', label: 'Question Bank' },
];

export function Navbar({
  activeView,
  onNavigate,
  user,
  isQuizActive,
  onSignIn,
  onSignOut,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            if (!isQuizActive) onNavigate('arena');
          }}
          disabled={isQuizActive}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          SprintQuiz
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isQuizActive}
                onClick={() => onNavigate(item.id)}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'border-blue-700 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary auth action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              disabled={isQuizActive}
              onClick={onSignOut}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              disabled={isQuizActive}
              onClick={onSignIn}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      {!isQuizActive && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden flex items-center gap-4 px-4 py-2 border-t border-slate-100 overflow-x-auto text-xs font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-1 whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'border-blue-700 text-slate-900'
                    : 'border-transparent text-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
