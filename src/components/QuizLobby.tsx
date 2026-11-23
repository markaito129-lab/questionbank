import { useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowRight, Clock, ShieldCheck } from 'lucide-react';
import {
  AGE_GROUPS,
  AGE_GROUP_META,
  type AgeGroup,
  type Question,
} from '../types';

interface QuizLobbyProps {
  selectedAgeGroup: AgeGroup;
  onSelectAgeGroup: (group: AgeGroup) => void;
  questionsByGroup: Record<AgeGroup, Question[]>;
  studentName: string;
  onStudentNameChange: (name: string) => void;
  user: User | null;
  isAdmin: boolean;
  isLoadingQuestions: boolean;
  onStartQuiz: () => void;
  onSignIn: () => void;
  onOpenAdmin: () => void;
  onOpenLeaderboard: () => void;
}

export function QuizLobby({
  selectedAgeGroup,
  onSelectAgeGroup,
  questionsByGroup,
  studentName,
  onStudentNameChange,
  user,
  isAdmin,
  isLoadingQuestions,
  onStartQuiz,
  onSignIn,
  onOpenAdmin,
  onOpenLeaderboard,
}: QuizLobbyProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const activeQuestions = questionsByGroup[selectedAgeGroup] || [];
  const questionCount = activeQuestions.length;
  const meta = AGE_GROUP_META[selectedAgeGroup];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (questionCount > 0) {
      onStartQuiz();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-10">
      {/* Main Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Column: Setup & Launch */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <span>Timed Speed Assessment</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">30:00 Limit</span>
                <span aria-hidden="true">·</span>
                <span>Six Age Divisions</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance leading-tight">
                Test how fast and accurately you solve under pressure.
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                Questions appear one at a time in randomized order from your division bank. Choose an answer or skip before moving on—once you advance, you cannot return to previous questions.
              </p>
            </div>

            {/* Age Group Segmented Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-900">
                  Select Age Group
                </label>
                <span className="text-xs text-slate-500">
                  {meta.bracket} · {meta.focus}
                </span>
              </div>

              <div
                role="tablist"
                aria-label="Age group selection"
                className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-lg"
              >
                {AGE_GROUPS.map((group) => {
                  const isSelected = group === selectedAgeGroup;
                  const count = (questionsByGroup[group] || []).length;
                  return (
                    <button
                      key={group}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => onSelectAgeGroup(group)}
                      className={`px-3 py-2.5 rounded-md text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        isSelected
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold whitespace-nowrap truncate">
                          {group}
                        </span>
                        <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                          {count} Qs
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Competitor Name & Launch Form */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                <div className="sm:col-span-7 space-y-1.5">
                  <label
                    htmlFor="competitor-name"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Participant Display Name
                  </label>
                  <input
                    id="competitor-name"
                    type="text"
                    maxLength={60}
                    required
                    value={studentName}
                    onChange={(e) => onStudentNameChange(e.target.value)}
                    placeholder="Enter your name for the leaderboard"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div className="sm:col-span-5">
                  <button
                    type="submit"
                    disabled={isLoadingQuestions || questionCount === 0}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <span>Start 30-Min Quiz</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Clean inline status / guidance */}
              {isLoadingQuestions ? (
                <p className="text-xs text-slate-500">
                  Loading question banks from Firestore...
                </p>
              ) : questionCount === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <span>
                    No questions are currently in the <strong>{selectedAgeGroup}</strong> bank.
                  </span>
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="font-semibold text-amber-950 underline hover:no-underline cursor-pointer"
                  >
                    {isAdmin ? 'Add Questions in Admin Console' : 'Admin Question Bank'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    Bank ready: <strong className="text-slate-700 font-mono tabular-nums">{questionCount}</strong> randomized questions for {selectedAgeGroup}
                  </span>
                  {!user ? (
                    <button
                      type="button"
                      onClick={onSignIn}
                      className="text-blue-700 font-medium hover:underline cursor-pointer"
                    >
                      Sign in with Google to post official scores
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      Signed in as {user.displayName || user.email}
                    </span>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: Editorial Hero Media */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="relative flex-1 min-h-[260px] bg-slate-100">
            {!imageFailed ? (
              <img
                src="/src/assets/images/hero_speed_olympiad_1795401662958.jpg"
                alt="Precision brass stopwatch beside geometric solids and grid notebook in a sunlit studio"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="w-full h-full lg:absolute lg:inset-0 object-cover"
              />
            ) : (
              <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-8 bg-slate-100 text-slate-500">
                <Clock className="w-10 h-10 mb-3 text-blue-700" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-700">30-Minute Speed Olympiad</p>
              </div>
            )}
          </div>
          <div className="p-5 border-t border-slate-200 flex items-center justify-between gap-4 bg-white">
            <div className="text-xs text-slate-600">
              Tie-breaker: Faster completion time ranks higher on equal scores.
            </div>
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              View Rankings
            </button>
          </div>
        </div>
      </section>

      {/* 4-Column Format & Scoring Strip */}
      <section aria-label="Scoring and Quiz Format Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-1">Time Allowance</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
            30:00
          </p>
          <p className="text-xs text-slate-600 mt-1.5">
            Fixed 30-minute countdown across all six age groups.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-1">Correct Answer</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-emerald-700">
            +1.00 pt
          </p>
          <p className="text-xs text-slate-600 mt-1.5">
            Full point awarded for each accurately solved question.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-1">Wrong Answer</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-red-700">
            −0.25 pt
          </p>
          <p className="text-xs text-slate-600 mt-1.5">
            Quarter-point deduction discourages blind guessing.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-1">Skipped / Unanswered</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-700">
            0.00 pt
          </p>
          <p className="text-xs text-slate-600 mt-1.5">
            Zero penalty when skipping; no returning to prior items.
          </p>
        </div>
      </section>
    </div>
  );
}
