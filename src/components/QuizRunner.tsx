import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Lock,
  SkipForward,
} from 'lucide-react';
import {
  OPTION_LETTERS,
  QUIZ_DURATION_SECONDS,
  type AgeGroup,
  type CompletedQuizResult,
  type Question,
  type QuizQuestionResult,
} from '../types';
import {
  computeNetScore,
  formatDurationMMSS,
  shuffleArray,
} from '../utils/formatters';

interface QuizRunnerProps {
  ageGroup: AgeGroup;
  studentName: string;
  bankQuestions: Question[];
  onComplete: (result: CompletedQuizResult) => void;
  onCancel: () => void;
}

export function QuizRunner({
  ageGroup,
  studentName,
  bankQuestions,
  onComplete,
  onCancel,
}: QuizRunnerProps) {
  // Shuffle all questions from the age-group bank once on mount
  const shuffledQuestions = useMemo(
    () => shuffleArray(bankQuestions),
    [bankQuestions]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(QUIZ_DURATION_SECONDS);
  const [confirmEndEarly, setConfirmEndEarly] = useState(false);

  const recordsRef = useRef<QuizQuestionResult[]>([]);
  const quizStartRef = useRef<number>(Date.now());
  const questionStartRef = useRef<number>(Date.now());
  const finishedRef = useRef(false);

  const totalQuestions = shuffledQuestions.length;
  const currentQuestion = shuffledQuestions[currentIndex];

  const finalizeQuiz = useCallback(
    (finalRecords: QuizQuestionResult[], timedOut: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      // Pad any remaining unvisited questions as unanswered/skipped (0 penalty)
      const recordedIds = new Set(finalRecords.map((r) => r.question.id));
      const completeRecords = [...finalRecords];
      for (const q of shuffledQuestions) {
        if (!recordedIds.has(q.id)) {
          completeRecords.push({
            question: q,
            selectedIndex: null,
            status: 'skipped',
            timeSpentSeconds: 0,
          });
        }
      }

      const correctCount = completeRecords.filter((r) => r.status === 'correct').length;
      const wrongCount = completeRecords.filter((r) => r.status === 'wrong').length;
      const skippedCount = completeRecords.filter((r) => r.status === 'skipped').length;
      const elapsedSeconds = timedOut
        ? QUIZ_DURATION_SECONDS
        : Math.min(
            QUIZ_DURATION_SECONDS,
            Math.max(1, Math.round((Date.now() - quizStartRef.current) / 1000))
          );

      onComplete({
        ageGroup,
        studentName,
        score: computeNetScore(correctCount, wrongCount),
        correctCount,
        wrongCount,
        skippedCount,
        totalQuestions: shuffledQuestions.length,
        elapsedSeconds,
        timedOut,
        records: completeRecords,
      });
    },
    [ageGroup, onComplete, shuffledQuestions, studentName]
  );

  // 30-minute countdown timer
  useEffect(() => {
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - quizStartRef.current) / 1000);
      const nextRemaining = Math.max(0, QUIZ_DURATION_SECONDS - elapsed);
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0) {
        window.clearInterval(interval);
        finalizeQuiz(recordsRef.current, true);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [finalizeQuiz]);

  const advanceQuestion = useCallback(
    (choice: number | null) => {
      if (!currentQuestion || finishedRef.current) return;

      const spent = Math.max(
        0,
        Math.round((Date.now() - questionStartRef.current) / 1000)
      );

      let status: 'correct' | 'wrong' | 'skipped' = 'skipped';
      if (choice !== null) {
        status = choice === currentQuestion.correctIndex ? 'correct' : 'wrong';
      }

      const updatedRecords: QuizQuestionResult[] = [
        ...recordsRef.current,
        {
          question: currentQuestion,
          selectedIndex: choice,
          status,
          timeSpentSeconds: spent,
        },
      ];
      recordsRef.current = updatedRecords;

      if (currentIndex + 1 >= totalQuestions) {
        finalizeQuiz(updatedRecords, false);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setSelectedIndex(null);
        setConfirmEndEarly(false);
        questionStartRef.current = Date.now();
      }
    },
    [currentIndex, currentQuestion, finalizeQuiz, totalQuestions]
  );

  // Keyboard shortcuts 1-5 / A-E to select an option
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (finishedRef.current || !currentQuestion) return;
      const key = e.key.toUpperCase();
      const maxIdx = currentQuestion.options.length - 1;
      if ((key === '1' || key === 'A') && 0 <= maxIdx) setSelectedIndex(0);
      if ((key === '2' || key === 'B') && 1 <= maxIdx) setSelectedIndex(1);
      if ((key === '3' || key === 'C') && 2 <= maxIdx) setSelectedIndex(2);
      if ((key === '4' || key === 'D') && 3 <= maxIdx) setSelectedIndex(3);
      if ((key === '5' || key === 'E') && 4 <= maxIdx) setSelectedIndex(4);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion]);

  if (!currentQuestion) {
    return null;
  }

  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);
  const isCriticalTime = remainingSeconds <= 60;
  const isWarningTime = remainingSeconds <= 180 && remainingSeconds > 60;
  const isLastQuestion = currentIndex + 1 === totalQuestions;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Exam Header Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{ageGroup} Division</span>
            <span aria-hidden="true">·</span>
            <span>{studentName}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-slate-700">
              <Lock className="w-3 h-3" aria-hidden="true" />
              No Backtracking
            </span>
          </div>
          <p className="text-lg font-semibold text-slate-900 font-mono tabular-nums">
            Question {currentIndex + 1} of {totalQuestions}
          </p>
        </div>

        {/* Countdown Clock */}
        <div
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
            isCriticalTime
              ? 'bg-red-50 border-red-200 text-red-800'
              : isWarningTime
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
          <div className="text-right">
            <p className="text-xl font-semibold font-mono tabular-nums leading-none">
              {formatDurationMMSS(remainingSeconds)}
            </p>
            <p className="text-[11px] font-medium mt-0.5">
              {isCriticalTime
                ? 'Under 1 min left'
                : isWarningTime
                  ? 'Time running low'
                  : 'Time remaining'}
            </p>
          </div>
        </div>
      </div>

      {/* Linear Progress Bar */}
      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full bg-blue-700 transition-transform duration-200 origin-left"
          style={{ transform: `scaleX(${progressPercent / 100})` }}
        />
      </div>

      {/* Active Question Stage */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Topic: {currentQuestion.topic}</span>
          <span className="font-mono tabular-nums">+1.00 correct · −0.25 wrong · 0 skip</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 leading-snug">
          {currentQuestion.prompt}
        </h2>

        {/* Answer Options */}
        <div className="space-y-3" role="radiogroup" aria-label="Answer choices">
          {currentQuestion.options.map((optionText, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedIndex(idx)}
                className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-700 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold font-mono shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {OPTION_LETTERS[idx]}
                </span>
                <span className="text-base leading-relaxed pt-0.5">{optionText}</span>
              </button>
            );
          })}
        </div>

        {/* Forward-only Warning & Action Bar */}
        <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Forward-only rule: you cannot revisit this question once you continue.
          </p>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => advanceQuestion(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <SkipForward className="w-4 h-4" aria-hidden="true" />
              <span>{isLastQuestion ? 'Skip & Finish' : 'Skip (0 pt)'}</span>
            </button>

            <button
              type="button"
              disabled={selectedIndex === null}
              onClick={() => advanceQuestion(selectedIndex)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span>{isLastQuestion ? 'Submit Answer & Finish' : 'Confirm & Next'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Early Finish / Exit Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        {!confirmEndEarly ? (
          <button
            type="button"
            onClick={() => setConfirmEndEarly(true)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            End Quiz Early
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg w-full justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Finish now? Remaining unanswered questions receive 0 penalty.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmEndEarly(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Continue Quiz
              </button>
              <button
                type="button"
                onClick={() => finalizeQuiz(recordsRef.current, false)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                Submit Current Progress
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-xs font-medium text-red-700 hover:underline cursor-pointer"
              >
                Discard Attempt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
