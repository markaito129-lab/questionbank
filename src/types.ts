export const AGE_GROUPS = [
  'Beginners',
  'Primary',
  'Juniors',
  'Intermediate',
  'Seniors',
  'Open',
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

export interface AgeGroupInfo {
  label: AgeGroup;
  bracket: string;
  focus: string;
}

export const AGE_GROUP_META: Record<AgeGroup, AgeGroupInfo> = {
  Beginners: {
    label: 'Beginners',
    bracket: 'Ages 6–8',
    focus: 'Foundational counting, sums & visual patterns',
  },
  Primary: {
    label: 'Primary',
    bracket: 'Ages 9–10',
    focus: 'Mental arithmetic, fractions & time puzzles',
  },
  Juniors: {
    label: 'Juniors',
    bracket: 'Ages 11–12',
    focus: 'Ratios, percentages & geometric reasoning',
  },
  Intermediate: {
    label: 'Intermediate',
    bracket: 'Ages 13–14',
    focus: 'Linear equations, primes & number logic',
  },
  Seniors: {
    label: 'Seniors',
    bracket: 'Ages 15–17',
    focus: 'Combinatorics, quadratics & rapid deduction',
  },
  Open: {
    label: 'Open',
    bracket: 'Ages 18+',
    focus: 'Competitive Olympiad & speed-logic sprints',
  },
};

export const QUIZ_DURATION_SECONDS = 30 * 60; // 30 minutes = 1800 seconds
export const POINTS_CORRECT = 1;
export const PENALTY_WRONG = 0.25;

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
export const MAX_QUESTION_OPTIONS = 5;

export interface Question {
  id: string;
  ageGroup: AgeGroup;
  prompt: string;
  options: string[];
  correctIndex: 0 | 1 | 2 | 3 | 4;
  topic: string;
  explanation: string;
  isActive: boolean;
  createdBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface NewQuestionInput {
  ageGroup: AgeGroup;
  prompt: string;
  options: string[];
  correctIndex: 0 | 1 | 2 | 3 | 4;
  topic: string;
  explanation: string;
}

export interface LeaderboardEntry {
  id: string;
  userId: string;
  studentName: string;
  ageGroup: AgeGroup;
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  elapsedSeconds: number;
  isPublished: boolean;
  submittedAtMs: number;
}

export interface QuizQuestionResult {
  question: Question;
  selectedIndex: number | null;
  status: 'correct' | 'wrong' | 'skipped';
  timeSpentSeconds: number;
}

export interface CompletedQuizResult {
  ageGroup: AgeGroup;
  studentName: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  elapsedSeconds: number;
  timedOut: boolean;
  records: QuizQuestionResult[];
}

export type AppView = 'arena' | 'leaderboards' | 'rules' | 'admin';
