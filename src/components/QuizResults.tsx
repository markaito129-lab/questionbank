import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  MinusCircle,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { CompletedQuizResult } from '../types';
import { submitLeaderboardEntry } from '../services/quizService';
import { formatDurationMMSS, formatScore } from '../utils/formatters';

interface QuizResultsProps {
  result: CompletedQuizResult;
  user: User | null;
  onSignIn: () => Promise<User | null>;
  onRetake: () => void;
  onViewLeaderboard: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function QuizResults({
  result,
  user,
  onSignIn,
  onRetake,
  onViewLeaderboard,
}: QuizResultsProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string>('');
  const submittedRef = useRef(false);

  const attemptSave = async (activeUser: User) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSaveStatus('saving');
    setSaveError('');
    try {
      await submitLeaderboardEntry({
        userId: activeUser.uid,
        studentName: result.studentName,
        ageGroup: result.ageGroup,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        skippedCount: result.skippedCount,
        totalQuestions: result.totalQuestions,
        elapsedSeconds: result.elapsedSeconds,
      });
      setSaveStatus('saved');
    } catch (err) {
      submittedRef.current = false;
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Unable to save score.');
    }
  };

  useEffect(() => {
    if (user && user.emailVerified && !submittedRef.current) {
      void attemptSave(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSignInAndSave = async () => {
    const signedInUser = await onSignIn();
    if (signedInUser && signedInUser.emailVerified) {
      await attemptSave(signedInUser);
    }
  };

  const accuracy =
    result.correctCount + result.wrongCount > 0
      ? Math.round(
          (result.correctCount / (result.correctCount + result.wrongCount)) * 100
        )
      : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Score Summary Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>{result.ageGroup} Division</span>
              <span aria-hidden="true">·</span>
              <span>{result.studentName}</span>
              {result.timedOut && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 font-semibold">Time Expired</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Attempt Complete
            </h1>
            <p className="text-sm text-slate-600">
              Net score calculated at +1.00 per correct answer, −0.25 per wrong answer, and 0 for unanswered items.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-left md:text-right shrink-0">
            <p className="text-xs font-medium text-slate-500">Final Net Score</p>
            <p className="text-4xl font-bold font-mono tabular-nums text-blue-700 mt-1">
              {formatScore(result.score)}
            </p>
            <p className="text-xs text-slate-500 font-mono tabular-nums mt-1">
              out of {result.totalQuestions.toFixed(2)} max
            </p>
          </div>
        </div>

        {/* 4 Metric Breakdown */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/70">
            <p className="text-xs text-slate-500">Correct (+1.00)</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-emerald-700 mt-1">
              {result.correctCount}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/70">
            <p className="text-xs text-slate-500">Wrong (−0.25)</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-red-700 mt-1">
              {result.wrongCount}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/70">
            <p className="text-xs text-slate-500">Skipped (0.00)</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-slate-700 mt-1">
              {result.skippedCount}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/70">
            <p className="text-xs text-slate-500">Solve Time · Accuracy</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
              {formatDurationMMSS(result.elapsedSeconds)} · {accuracy}%
            </p>
          </div>
        </div>

        {/* Leaderboard Publication Status */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="text-sm">
            {saveStatus === 'saving' && (
              <span className="text-slate-600">Recording result to {result.ageGroup} leaderboard...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-2 text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                Recorded on the {result.ageGroup} leaderboard
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-700 text-xs">{saveError}</span>
            )}
            {!user && saveStatus === 'idle' && (
              <span className="text-slate-600">
                Sign in with Google to publish this score to the official {result.ageGroup} leaderboard.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!user && (
              <button
                type="button"
                onClick={handleSignInAndSave}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
              >
                Sign In & Save to Leaderboard
              </button>
            )}
            <button
              type="button"
              onClick={onViewLeaderboard}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4" aria-hidden="true" />
              <span>View {result.ageGroup} Leaderboard</span>
            </button>
            <button
              type="button"
              onClick={onRetake}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>New Quiz</span>
            </button>
          </div>
        </div>
      </section>

      {/* Post-Quiz Answer Review */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Question-by-Question Review
        </h2>
        <div className="space-y-3">
          {result.records.map((record, index) => {
            const { question, selectedIndex, status } = record;
            return (
              <div
                key={question.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono tabular-nums font-semibold text-slate-700">
                      Q{index + 1}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{question.topic}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{record.timeSpentSeconds}s</span>
                  </div>

                  {status === 'correct' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      Correct (+1.00)
                    </span>
                  )}
                  {status === 'wrong' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                      Wrong (−0.25)
                    </span>
                  )}
                  {status === 'skipped' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <MinusCircle className="w-4 h-4" aria-hidden="true" />
                      Skipped (0.00)
                    </span>
                  )}
                </div>

                <p className="text-base font-medium text-slate-900">{question.prompt}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {question.options.map((opt, optIdx) => {
                    const isAnswer = optIdx === question.correctIndex;
                    const isUserPick = optIdx === selectedIndex;
                    let style = 'bg-slate-50 border-slate-200 text-slate-700';
                    if (isAnswer) {
                      style = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium';
                    } else if (isUserPick && !isAnswer) {
                      style = 'bg-red-50 border-red-300 text-red-900';
                    }
                    return (
                      <div
                        key={optIdx}
                        className={`px-3.5 py-2 rounded-lg border flex items-center justify-between gap-2 ${style}`}
                      >
                        <span>
                          <span className="font-mono text-xs mr-2">{OPTION_LETTERS[optIdx]}.</span>
                          {opt}
                        </span>
                        {isAnswer && (
                          <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                            Answer
                          </span>
                        )}
                        {isUserPick && !isAnswer && (
                          <span className="text-[11px] font-semibold text-red-700 shrink-0">
                            Your Pick
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {question.explanation && (
                  <p className="text-xs text-slate-600 pt-1">
                    Note: {question.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
