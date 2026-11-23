import { useState } from 'react';
import { computeNetScore, formatScore } from '../utils/formatters';

interface ScoringRulesViewProps {
  onStartPractice: () => void;
}

export function ScoringRulesView({ onStartPractice }: ScoringRulesViewProps) {
  const [simCorrect, setSimCorrect] = useState(12);
  const [simWrong, setSimWrong] = useState(4);
  const [simSkipped, setSimSkipped] = useState(4);

  const simTotal = simCorrect + simWrong + simSkipped;
  const simScore = computeNetScore(simCorrect, simWrong);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Competition Rules & Scoring Formula
          </h1>
          <p className="text-sm text-slate-600">
            Designed to reward decisive accuracy and rapid problem-solving while discouraging random guessing.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartPractice}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Go to Quiz Arena
        </button>
      </div>

      {/* 3 Core Rules Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <p className="text-xs font-semibold text-blue-700 font-mono tabular-nums">
            01. Time Limit
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            30 Minutes Per Attempt
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every division—Beginners, Primary, Juniors, Intermediate, Seniors, and Open—receives a strict 30:00 countdown. Faster completion acts as the leaderboard tie-breaker.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <p className="text-xs font-semibold text-blue-700 font-mono tabular-nums">
            02. Navigation
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Randomized & Forward-Only
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            All active questions in your division bank are shuffled randomly and shown one at a time. Once you submit an answer or skip, you cannot return to an earlier question.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <p className="text-xs font-semibold text-blue-700 font-mono tabular-nums">
            03. Negative Marking
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            +1.00 / −0.25 / 0.00
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Earn 1 point for each correct answer. Each wrong answer deducts 0.25 points. Skipped or unanswered items incur zero deduction.
          </p>
        </div>
      </section>

      {/* Interactive Score Simulator */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Interactive Score Simulator
            </h2>
            <p className="text-sm text-slate-600">
              Adjust the sliders to compare strategic skipping against guessing.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-5 py-3 text-right">
            <p className="text-xs text-slate-500">Simulated Net Score</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-blue-700">
              {formatScore(simScore)} pts
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="sim-correct" className="font-medium text-slate-700">
                Correct (+1.00)
              </label>
              <span className="font-mono tabular-nums font-semibold text-emerald-700">
                {simCorrect} (+{formatScore(simCorrect)})
              </span>
            </div>
            <input
              id="sim-correct"
              type="range"
              min={0}
              max={50}
              value={simCorrect}
              onChange={(e) => setSimCorrect(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="sim-wrong" className="font-medium text-slate-700">
                Wrong (−0.25)
              </label>
              <span className="font-mono tabular-nums font-semibold text-red-700">
                {simWrong} (−{formatScore(simWrong * 0.25)})
              </span>
            </div>
            <input
              id="sim-wrong"
              type="range"
              min={0}
              max={50}
              value={simWrong}
              onChange={(e) => setSimWrong(Number(e.target.value))}
              className="w-full accent-red-600 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="sim-skipped" className="font-medium text-slate-700">
                Skipped (0.00)
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-700">
                {simSkipped} (0.00)
              </span>
            </div>
            <input
              id="sim-skipped"
              type="range"
              min={0}
              max={50}
              value={simSkipped}
              onChange={(e) => setSimSkipped(Number(e.target.value))}
              className="w-full accent-slate-600 cursor-pointer"
            />
          </div>
        </div>

        <p className="text-xs text-slate-500 font-mono tabular-nums">
          Formula: ({simCorrect} × 1.00) − ({simWrong} × 0.25) + ({simSkipped} × 0.00) = {formatScore(simScore)} across {simTotal} total questions
        </p>
      </section>
    </div>
  );
}
