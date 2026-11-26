import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import {
  AGE_GROUPS,
  type AgeGroup,
  type AppView,
  type CompletedQuizResult,
  type LeaderboardEntry,
  type Question,
} from './types';
import {
  checkIsAdmin,
  seedStarterQuestions,
  subscribeActiveQuestions,
  subscribeLeaderboardEntries,
} from './services/quizService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { QuizLobby } from './components/QuizLobby';
import { QuizRunner } from './components/QuizRunner';
import { QuizResults } from './components/QuizResults';
import { LeaderboardView } from './components/LeaderboardView';
import { ScoringRulesView } from './components/ScoringRulesView';
import { AdminConsole } from './components/AdminConsole';

function SprintQuizApp() {
  const [activeView, setActiveView] = useState<AppView>('arena');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup>('Beginners');
  const [studentName, setStudentName] = useState('');

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  const [quizSessionKey, setQuizSessionKey] = useState<number | null>(null);
  const [completedResult, setCompletedResult] = useState<CompletedQuizResult | null>(
    null
  );
  const [authError, setAuthError] = useState<string>('');
  const [unauthorizedHost, setUnauthorizedHost] = useState<string | null>(null);
  const [copiedHost, setCopiedHost] = useState(false);
  const autoSeededRef = useRef(false);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        setStudentName((prev) =>
          prev.trim() ? prev : nextUser.displayName || 'Student'
        );
        setIsCheckingAdmin(true);
        try {
          const adminFlag = await checkIsAdmin(nextUser);
          setIsAdmin(adminFlag);
        } catch {
          setIsAdmin(false);
        } finally {
          setIsCheckingAdmin(false);
        }
      } else {
        setIsAdmin(false);
        setIsCheckingAdmin(false);
      }
    });

    return () => unsub();
  }, []);

  // Firestore real-time subscriptions
  useEffect(() => {
    const unsubQuestions = subscribeActiveQuestions(
      (items) => {
        setQuestions(items);
        setIsLoadingQuestions(false);
      },
      () => {
        setIsLoadingQuestions(false);
      }
    );

    const unsubLeaderboard = subscribeLeaderboardEntries(
      (entries) => {
        setLeaderboardEntries(entries);
        setIsLoadingLeaderboard(false);
      },
      () => {
        setIsLoadingLeaderboard(false);
      }
    );

    return () => {
      unsubQuestions();
      unsubLeaderboard();
    };
  }, []);

  // Auto-seed starter questions once when an Admin signs in to an empty database
  useEffect(() => {
    if (
      authReady &&
      user &&
      isAdmin &&
      !isLoadingQuestions &&
      questions.length === 0 &&
      !autoSeededRef.current
    ) {
      const storageKey = 'sprintquiz_initial_seed_done';
      if (!window.localStorage.getItem(storageKey)) {
        autoSeededRef.current = true;
        window.localStorage.setItem(storageKey, '1');
        void seedStarterQuestions(user.uid, []);
      }
    }
  }, [authReady, isAdmin, isLoadingQuestions, questions.length, user]);

  const questionsByGroup = useMemo(() => {
    const grouped: Record<AgeGroup, Question[]> = {
      Beginners: [],
      Primary: [],
      Juniors: [],
      Intermediate: [],
      Seniors: [],
      Open: [],
    };
    AGE_GROUPS.forEach((g) => {
      grouped[g] = [];
    });
    questions.forEach((q) => {
      if (grouped[q.ageGroup]) {
        grouped[q.ageGroup].push(q);
      }
    });
    return grouped;
  }, [questions]);

  const handleSignIn = useCallback(async (): Promise<User | null> => {
    setAuthError('');
    setUnauthorizedHost(null);
    setCopiedHost(false);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      return cred.user;
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      const msg =
        err instanceof Error ? err.message : 'Sign-in was cancelled or failed.';
      if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
        const host = window.location.hostname;
        setUnauthorizedHost(host);
        setAuthError(
          `Domain "${host}" is not authorized in Firebase Authentication for project lesson-plan-generator-502913.`
        );
      } else {
        setAuthError(msg);
      }
      return null;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthError('');
    setUnauthorizedHost(null);
    await signOut(auth);
  }, []);

  const handleStartQuiz = useCallback(() => {
    const bank = questionsByGroup[selectedAgeGroup] || [];
    if (bank.length === 0) return;
    setCompletedResult(null);
    setQuizSessionKey(Date.now());
    setActiveView('arena');
  }, [questionsByGroup, selectedAgeGroup]);

  const handleCompleteQuiz = useCallback((result: CompletedQuizResult) => {
    setQuizSessionKey(null);
    setCompletedResult(result);
  }, []);

  const handleCancelQuiz = useCallback(() => {
    setQuizSessionKey(null);
    setCompletedResult(null);
  }, []);

  const isQuizActive = quizSessionKey !== null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        activeView={activeView}
        onNavigate={(view) => {
          setCompletedResult(null);
          setActiveView(view);
        }}
        user={user}
        isQuizActive={isQuizActive}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {authError && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4">
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium">{authError}</p>
              {unauthorizedHost && (
                <p className="text-red-800">
                  Add <code className="font-mono bg-red-100 px-1.5 py-0.5 rounded">{unauthorizedHost}</code> (hostname only, without https://) under Firebase Console → Authentication → Settings → Authorized domains.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {unauthorizedHost && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(unauthorizedHost);
                    setCopiedHost(true);
                  }}
                  className="px-2.5 py-1 bg-white border border-red-200 rounded font-semibold text-red-800 hover:bg-red-100 cursor-pointer"
                >
                  {copiedHost ? 'Copied' : 'Copy Hostname'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAuthError('');
                  setUnauthorizedHost(null);
                }}
                className="font-semibold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeView === 'arena' && isQuizActive && (
          <QuizRunner
            key={quizSessionKey}
            ageGroup={selectedAgeGroup}
            studentName={studentName.trim() || 'Student'}
            bankQuestions={questionsByGroup[selectedAgeGroup]}
            onComplete={handleCompleteQuiz}
            onCancel={handleCancelQuiz}
          />
        )}

        {activeView === 'arena' && !isQuizActive && completedResult && (
          <QuizResults
            result={completedResult}
            user={user}
            onSignIn={handleSignIn}
            onRetake={() => {
              setCompletedResult(null);
            }}
            onViewLeaderboard={() => {
              setSelectedAgeGroup(completedResult.ageGroup);
              setCompletedResult(null);
              setActiveView('leaderboards');
            }}
          />
        )}

        {activeView === 'arena' && !isQuizActive && !completedResult && (
          <QuizLobby
            selectedAgeGroup={selectedAgeGroup}
            onSelectAgeGroup={setSelectedAgeGroup}
            questionsByGroup={questionsByGroup}
            studentName={studentName}
            onStudentNameChange={setStudentName}
            user={user}
            isAdmin={isAdmin}
            isLoadingQuestions={isLoadingQuestions}
            onStartQuiz={handleStartQuiz}
            onSignIn={handleSignIn}
            onOpenAdmin={() => setActiveView('admin')}
            onOpenLeaderboard={() => setActiveView('leaderboards')}
          />
        )}

        {activeView === 'leaderboards' && (
          <LeaderboardView
            selectedAgeGroup={selectedAgeGroup}
            onSelectAgeGroup={setSelectedAgeGroup}
            entries={leaderboardEntries}
            isLoading={isLoadingLeaderboard}
            isAdmin={isAdmin}
            onStartQuizForGroup={(group) => {
              setSelectedAgeGroup(group);
              setActiveView('arena');
            }}
          />
        )}

        {activeView === 'rules' && (
          <ScoringRulesView onStartPractice={() => setActiveView('arena')} />
        )}

        {activeView === 'admin' && (
          <AdminConsole
            user={user}
            isAdmin={isAdmin}
            isCheckingAdmin={isCheckingAdmin}
            questions={questions}
            onSignIn={handleSignIn}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>SprintQuiz · Timed Speed-Solving Platform</span>
          <span>30-Minute Limit · +1.00 Correct · −0.25 Wrong · 0.00 Skipped</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SprintQuizApp />
    </ErrorBoundary>
  );
}
