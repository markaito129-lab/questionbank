import { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  Database,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  AGE_GROUPS,
  AGE_GROUP_META,
  type AgeGroup,
  type Question,
} from '../types';
import {
  createQuestion,
  deleteQuestion,
  seedStarterQuestions,
} from '../services/quizService';

interface AdminConsoleProps {
  user: User | null;
  isAdmin: boolean;
  isCheckingAdmin: boolean;
  questions: Question[];
  onSignIn: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function AdminConsole({
  user,
  isAdmin,
  isCheckingAdmin,
  questions,
  onSignIn,
}: AdminConsoleProps) {
  const [selectedGroup, setSelectedGroup] = useState<AgeGroup>('Beginners');
  const [topic, setTopic] = useState('');
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<[string, string, string, string]>([
    '',
    '',
    '',
    '',
  ]);
  const [correctIndex, setCorrectIndex] = useState<0 | 1 | 2 | 3>(0);
  const [explanation, setExplanation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const countsByGroup = useMemo(() => {
    const counts: Record<AgeGroup, number> = {
      Beginners: 0,
      Primary: 0,
      Juniors: 0,
      Intermediate: 0,
      Seniors: 0,
      Open: 0,
    };
    questions.forEach((q) => {
      counts[q.ageGroup] = (counts[q.ageGroup] || 0) + 1;
    });
    return counts;
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const queryLower = searchTerm.trim().toLowerCase();
    return questions
      .filter((q) => q.ageGroup === selectedGroup)
      .filter((q) => {
        if (!queryLower) return true;
        return (
          q.prompt.toLowerCase().includes(queryLower) ||
          q.topic.toLowerCase().includes(queryLower) ||
          q.options.some((opt) => opt.toLowerCase().includes(queryLower))
        );
      });
  }, [questions, searchTerm, selectedGroup]);

  const handleOptionChange = (index: number, value: string) => {
    const next: [string, string, string, string] = [...options] as [
      string,
      string,
      string,
      string,
    ];
    next[index] = value;
    setOptions(next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      await createQuestion(
        {
          ageGroup: selectedGroup,
          topic: topic.trim() || 'General',
          prompt,
          options,
          correctIndex,
          explanation,
        },
        user.uid
      );
      setTopic('');
      setPrompt('');
      setOptions(['', '', '', '']);
      setCorrectIndex(0);
      setExplanation('');
      setFeedback({
        type: 'success',
        text: `Question added to the ${selectedGroup} question bank.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to add question.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedStarter = async () => {
    if (!user) return;
    setSeeding(true);
    setFeedback(null);
    try {
      const added = await seedStarterQuestions(user.uid, questions);
      setFeedback({
        type: 'success',
        text:
          added > 0
            ? `Added ${added} starter questions across the age-group banks.`
            : 'All starter questions are already present in Firestore.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to populate starter questions.',
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleRemove = async (questionId: string) => {
    setDeletingId(questionId);
    setFeedback(null);
    try {
      await deleteQuestion(questionId);
      setConfirmDeleteId(null);
      setFeedback({
        type: 'success',
        text: 'Question removed from the bank.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to remove question.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <Database className="w-9 h-9 text-blue-700 mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-bold text-slate-900">
            Admin Question Bank Management
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Sign in with your administrator Google account to add or remove questions across all six age-group banks.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
      </div>
    );
  }

  if (isCheckingAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-14 text-center text-sm text-slate-500">
        Verifying administrator permissions...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-amber-800">
            <ShieldAlert className="w-5 h-5 shrink-0" aria-hidden="true" />
            <h1 className="text-lg font-bold text-slate-900">
              Administrator Access Required
            </h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Signed in as <strong>{user.email}</strong>. Only authorized quiz administrators can add or remove questions from the question bank.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Question Bank Administration
          </h1>
          <p className="text-sm text-slate-600">
            Add or remove questions anytime. Changes apply immediately for all upcoming quiz attempts.
          </p>
        </div>

        <button
          type="button"
          disabled={seeding}
          onClick={handleSeedStarter}
          className="px-4 py-2 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {seeding ? 'Populating Starter Bank...' : 'Load Starter Bank (36 Qs)'}
        </button>
      </div>

      {/* Age Group Filter Tabs */}
      <div
        role="tablist"
        aria-label="Admin age group banks"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-1.5 bg-slate-100 rounded-xl"
      >
        {AGE_GROUPS.map((group) => {
          const active = group === selectedGroup;
          return (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedGroup(group)}
              className={`px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold truncate">{group}</span>
                <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                  {countsByGroup[group]}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-lg border text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Add Question Form */}
        <form
          onSubmit={handleCreate}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Add Question to {selectedGroup}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {AGE_GROUP_META[selectedGroup].bracket} · {AGE_GROUP_META[selectedGroup].focus}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="q-topic" className="block text-xs font-semibold text-slate-700">
              Topic / Skill Area
            </label>
            <input
              id="q-topic"
              type="text"
              maxLength={80}
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Mental Math, Ratios, Logic"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="q-prompt" className="block text-xs font-semibold text-slate-700">
              Question Prompt
            </label>
            <textarea
              id="q-prompt"
              rows={3}
              minLength={3}
              maxLength={1200}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Write the problem clearly..."
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <div className="space-y-2.5">
            <span className="block text-xs font-semibold text-slate-700">
              Answer Choices (mark the correct choice)
            </span>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="correctOption"
                  checked={correctIndex === idx}
                  onChange={() => setCorrectIndex(idx as 0 | 1 | 2 | 3)}
                  aria-label={`Mark option ${OPTION_LETTERS[idx]} as correct`}
                  className="w-4 h-4 accent-blue-700 cursor-pointer shrink-0"
                />
                <span className="text-xs font-mono font-semibold text-slate-500 w-4 shrink-0">
                  {OPTION_LETTERS[idx]}
                </span>
                <input
                  type="text"
                  maxLength={300}
                  required
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${OPTION_LETTERS[idx]}`}
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="q-explanation" className="block text-xs font-semibold text-slate-700">
              Brief Solution Note (optional, shown after quiz ends)
            </label>
            <input
              id="q-explanation"
              type="text"
              maxLength={600}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Short explanation for post-quiz review"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{submitting ? 'Saving Question...' : `Add to ${selectedGroup} Bank`}</span>
          </button>
        </form>

        {/* Question Bank List */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">
              {selectedGroup} Bank ({filteredQuestions.length})
            </h2>

            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter questions..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No questions found in {selectedGroup}. Add a new question using the form or load the starter bank.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredQuestions.map((q, index) => (
                <div key={q.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500">
                        <span className="font-mono tabular-nums font-semibold text-slate-700">
                          #{index + 1}
                        </span>
                        {' · '}
                        <span>{q.topic}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                        {q.prompt}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {confirmDeleteId === q.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={deletingId === q.id}
                            onClick={() => handleRemove(q.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 rounded hover:bg-red-700 cursor-pointer"
                          >
                            {deletingId === q.id ? 'Removing...' : 'Confirm Remove'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(q.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correctIndex;
                      return (
                        <div
                          key={optIdx}
                          className={`px-3 py-1.5 rounded-md border flex items-center justify-between gap-2 ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <span>
                            <span className="font-mono mr-1.5">
                              {OPTION_LETTERS[optIdx]}.
                            </span>
                            {opt}
                          </span>
                          {isCorrect && (
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-emerald-700 shrink-0"
                              aria-label="Correct answer"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
