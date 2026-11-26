import { useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AGE_GROUPS,
  AGE_GROUP_META,
  MAX_QUESTION_OPTIONS,
  OPTION_LETTERS,
  type AgeGroup,
  type NewQuestionInput,
  type Question,
} from '../types';
import {
  createQuestion,
  createQuestionsBatch,
  deleteQuestion,
  seedStarterQuestions,
  updateQuestion,
} from '../services/quizService';
import {
  downloadExcelTemplate,
  fileToBase64,
  parseSpreadsheetFile,
} from '../utils/importParsers';
import { hasMathMarkup, MathText } from './MathText';

interface AdminConsoleProps {
  user: User | null;
  isAdmin: boolean;
  isCheckingAdmin: boolean;
  questions: Question[];
  onSignIn: () => void;
}

interface StagedQuestion extends NewQuestionInput {
  tempId: string;
  selected: boolean;
}

export function AdminConsole({
  user,
  isAdmin,
  isCheckingAdmin,
  questions,
  onSignIn,
}: AdminConsoleProps) {
  const [selectedGroup, setSelectedGroup] = useState<AgeGroup>('Beginners');
  const [entryMode, setEntryMode] = useState<'single' | 'import'>('single');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formAgeGroup, setFormAgeGroup] = useState<AgeGroup>('Beginners');
  const [topic, setTopic] = useState('');
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [explanation, setExplanation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [importingBatch, setImportingBatch] = useState(false);
  const [stagedQuestions, setStagedQuestions] = useState<StagedQuestion[]>([]);
  const [importNotes, setImportNotes] = useState<string>('');
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formCardRef = useRef<HTMLDivElement | null>(null);

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

  const showMathPreview = useMemo(
    () =>
      hasMathMarkup(prompt) ||
      options.some((opt) => hasMathMarkup(opt)) ||
      hasMathMarkup(explanation),
    [prompt, options, explanation]
  );

  const handleSelectGroup = (group: AgeGroup) => {
    setSelectedGroup(group);
    if (!editingId) {
      setFormAgeGroup(group);
    }
  };

  const resetForm = (targetGroup?: AgeGroup) => {
    setEditingId(null);
    setFormAgeGroup(targetGroup ?? selectedGroup);
    setTopic('');
    setPrompt('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setExplanation('');
  };

  const handleStartEdit = (q: Question) => {
    setEntryMode('single');
    setEditingId(q.id);
    setFormAgeGroup(q.ageGroup);
    setTopic(q.topic);
    setPrompt(q.prompt);
    setOptions([...q.options]);
    setCorrectIndex(q.correctIndex);
    setExplanation(q.explanation || '');
    setConfirmDeleteId(null);
    setFeedback(null);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleAddOption = () => {
    if (options.length >= MAX_QUESTION_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
    if (correctIndex === index) {
      setCorrectIndex(0);
    } else if (correctIndex > index) {
      setCorrectIndex((correctIndex - 1) as 0 | 1 | 2 | 3 | 4);
    }
  };

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFeedback(null);
    setSubmitting(true);
    const payload: NewQuestionInput = {
      ageGroup: formAgeGroup,
      topic: topic.trim() || 'General',
      prompt,
      options,
      correctIndex,
      explanation,
    };

    try {
      if (editingId) {
        await updateQuestion(editingId, payload);
        setSelectedGroup(formAgeGroup);
        resetForm(formAgeGroup);
        setFeedback({
          type: 'success',
          text: `Question updated in the ${formAgeGroup} question bank.`,
        });
      } else {
        await createQuestion(payload, user.uid);
        resetForm(formAgeGroup);
        setFeedback({
          type: 'success',
          text: `Question added to the ${formAgeGroup} question bank.`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : editingId
              ? 'Failed to update question.'
              : 'Failed to add question.',
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
      if (editingId === questionId) {
        resetForm();
      }
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

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    setFeedback(null);
    setImportNotes('');
    setStagedQuestions([]);
    setSourceFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    const isSpreadsheet = ['xlsx', 'xls', 'csv'].includes(ext);

    if (!isPdf && !isSpreadsheet) {
      setFeedback({
        type: 'error',
        text: 'Unsupported file type. Please upload a .pdf, .xlsx, .xls, or .csv file.',
      });
      return;
    }

    setParsingFile(true);
    try {
      if (isSpreadsheet) {
        const result = await parseSpreadsheetFile(file, selectedGroup);
        if (result.questions.length === 0) {
          setFeedback({
            type: 'error',
            text:
              result.skippedRows[0]?.reason ||
              'No valid multiple-choice questions were found in this spreadsheet.',
          });
          return;
        }
        setStagedQuestions(
          result.questions.map((q, idx) => ({
            ...q,
            tempId: `xlsx_${Date.now()}_${idx}`,
            selected: true,
          }))
        );
        if (result.skippedRows.length > 0) {
          setImportNotes(
            `Skipped ${result.skippedRows.length} row(s): ${result.skippedRows
              .slice(0, 3)
              .map((r) => `Row ${r.rowNumber} (${r.reason})`)
              .join('; ')}`
          );
        }
      } else {
        if (file.size > 15 * 1024 * 1024) {
          throw new Error('PDF exceeds 15 MB. Please upload a smaller PDF file.');
        }
        const pdfBase64 = await fileToBase64(file);
        const res = await fetch('/api/parse-pdf-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfBase64,
            defaultAgeGroup: selectedGroup,
          }),
        });
        const data = (await res.json()) as {
          questions?: NewQuestionInput[];
          skippedCount?: number;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || 'Failed to parse PDF file.');
        }
        const extracted = data.questions || [];
        if (extracted.length === 0) {
          setFeedback({
            type: 'error',
            text: 'No multiple-choice questions (2 to 5 options) could be extracted from this PDF.',
          });
          return;
        }
        setStagedQuestions(
          extracted.map((q, idx) => ({
            ...q,
            tempId: `pdf_${Date.now()}_${idx}`,
            selected: true,
          }))
        );
        if (data.skippedCount && data.skippedCount > 0) {
          setImportNotes(
            `Skipped ${data.skippedCount} incomplete or non-multiple-choice item(s) in the PDF.`
          );
        }
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to parse uploaded file.',
      });
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCommitBatch = async () => {
    if (!user) return;
    const toImport = stagedQuestions.filter((q) => q.selected);
    if (toImport.length === 0) return;
    setImportingBatch(true);
    setFeedback(null);
    try {
      const count = await createQuestionsBatch(toImport, user.uid);
      setStagedQuestions([]);
      setImportNotes('');
      setSourceFileName('');
      setFeedback({
        type: 'success',
        text: `Imported ${count} question${count === 1 ? '' : 's'} into Firestore.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Batch import failed.',
      });
    } finally {
      setImportingBatch(false);
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
            Add, edit, or remove questions anytime. Wrap math expressions in LaTeX ($...$ or $$...$$) for clean equation rendering.
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
              onClick={() => handleSelectGroup(group)}
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
        {/* Left Column: Add / Edit Single Question OR Bulk Import (PDF / Excel) */}
        <div
          ref={formCardRef}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          {/* Entry Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setEntryMode('single')}
              className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                entryMode === 'single'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {editingId ? 'Edit Question' : 'Single Question'}
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('import')}
              className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                entryMode === 'import'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Import PDF / Excel
            </button>
          </div>

          {entryMode === 'single' ? (
            <form onSubmit={handleSubmitSingle} className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingId
                      ? 'Edit Question'
                      : `Add Question to ${formAgeGroup}`}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {AGE_GROUP_META[formAgeGroup].bracket} · {AGE_GROUP_META[formAgeGroup].focus}
                  </p>
                </div>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                    Cancel Edit
                  </button>
                )}
              </div>

              {editingId && (
                <div className="space-y-1.5">
                  <label htmlFor="q-age-group" className="block text-xs font-semibold text-slate-700">
                    Age Group Division
                  </label>
                  <select
                    id="q-age-group"
                    value={formAgeGroup}
                    onChange={(e) => setFormAgeGroup(e.target.value as AgeGroup)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                  >
                    {AGE_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g} ({AGE_GROUP_META[g].bracket})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  placeholder="e.g., Mental Math, Ratios, Algebra"
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
                  placeholder="Write the problem clearly (e.g., Solve $\frac{3x}{2} - 5 = 7$)"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                />
                <p className="text-[11px] text-slate-500">
                  Supports LaTeX: inline <code className="font-mono">$x^2 + \frac&#123;1&#125;&#123;2&#125;$</code> or block <code className="font-mono">$$\sqrt&#123;a^2+b^2&#125;$$</code>
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-semibold text-slate-700">
                    Answer Choices (2 to 5 choices · mark the correct choice)
                  </span>
                  {options.length < MAX_QUESTION_OPTIONS && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      Add Choice {OPTION_LETTERS[options.length]}
                    </button>
                  )}
                </div>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctIndex === idx}
                      onChange={() => setCorrectIndex(idx as 0 | 1 | 2 | 3 | 4)}
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
                      placeholder={`Option ${OPTION_LETTERS[idx]} (plain text or $LaTeX$)`}
                      className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        aria-label={`Remove option ${OPTION_LETTERS[idx]}`}
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
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
                  placeholder="Short explanation for post-quiz review ($...$ supported)"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              {showMathPreview && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Live Math Preview
                  </p>
                  {prompt.trim() && (
                    <div className="text-sm font-medium text-slate-900 leading-relaxed">
                      <MathText text={prompt} />
                    </div>
                  )}
                  {options.some((o) => o.trim().length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                      {options.map((opt, idx) =>
                        opt.trim() ? (
                          <div
                            key={idx}
                            className={`px-2.5 py-1.5 rounded border ${
                              correctIndex === idx
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="font-mono mr-1.5">{OPTION_LETTERS[idx]}.</span>
                            <MathText text={opt} />
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                  {explanation.trim() && (
                    <div className="text-xs text-slate-600 pt-1 border-t border-slate-200/70">
                      Note: <MathText text={explanation} />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 transition-colors cursor-pointer"
                >
                  {editingId ? (
                    <Save className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>
                    {submitting
                      ? 'Saving...'
                      : editingId
                        ? 'Save Changes'
                        : `Add to ${formAgeGroup} Bank`}
                  </span>
                </button>
                {editingId && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => resetForm()}
                    className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Bulk Import Questions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload a PDF worksheet or Excel/CSV spreadsheet. Default division: <strong>{selectedGroup}</strong>.
                </p>
              </div>

              {/* Dropzone / File Selector */}
              <label
                htmlFor="bulk-file-upload"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleFileUpload(e.dataTransfer.files?.[0]);
                }}
                className="block border-2 border-dashed border-slate-300 hover:border-blue-600 rounded-xl p-6 text-center bg-slate-50 hover:bg-blue-50/30 transition-colors cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  id="bulk-file-upload"
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  disabled={parsingFile}
                  onChange={(e) => void handleFileUpload(e.target.files?.[0])}
                  className="sr-only"
                />
                <Upload className="w-7 h-7 text-blue-700 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">
                  {parsingFile
                    ? 'Extracting questions from file...'
                    : 'Choose or drop PDF / Excel file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports .pdf (max 15 MB), .xlsx, .xls, and .csv
                </p>
              </label>

              {/* Format Guide & Template Download */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-slate-800">PDF Upload:</strong> Automatically extracts multiple-choice questions (up to 5 options A–E) and correct answers.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-slate-800">Excel / CSV Columns:</strong> Prompt, OptionA–OptionD, optional OptionE, Correct (A–E), plus optional AgeGroup, Topic, Explanation.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => downloadExcelTemplate(selectedGroup)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline pt-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Download Excel Template (.xlsx)
                </button>
              </div>

              {/* Staged Questions Preview */}
              {stagedQuestions.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-700">
                      <strong>{stagedQuestions.filter((q) => q.selected).length}</strong> of{' '}
                      <strong>{stagedQuestions.length}</strong> extracted from{' '}
                      <span className="font-mono">{sourceFileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStagedQuestions([]);
                        setImportNotes('');
                        setSourceFileName('');
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  {importNotes && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      {importNotes}
                    </p>
                  )}

                  <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
                    {stagedQuestions.map((sq, idx) => (
                      <div
                        key={sq.tempId}
                        className={`p-3 rounded-lg border text-xs space-y-2 ${
                          sq.selected
                            ? 'bg-white border-slate-200'
                            : 'bg-slate-50 border-slate-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex items-start gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={sq.selected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setStagedQuestions((prev) =>
                                  prev.map((item) =>
                                    item.tempId === sq.tempId
                                      ? { ...item, selected: checked }
                                      : item
                                  )
                                );
                              }}
                              className="mt-0.5 accent-blue-700 cursor-pointer"
                            />
                            <span className="font-semibold text-slate-900 leading-snug">
                              {idx + 1}. <MathText text={sq.prompt} />
                            </span>
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pl-5 text-[11px] text-slate-600">
                          {sq.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`px-2 py-1 rounded border truncate ${
                                sq.correctIndex === optIdx
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              {OPTION_LETTERS[optIdx]}. <MathText text={opt} />
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pl-5 pt-1">
                          <select
                            aria-label={`Division for staged question ${idx + 1}`}
                            value={sq.ageGroup}
                            onChange={(e) => {
                              const nextGroup = e.target.value as AgeGroup;
                              setStagedQuestions((prev) =>
                                prev.map((item) =>
                                  item.tempId === sq.tempId
                                    ? { ...item, ageGroup: nextGroup }
                                    : item
                                )
                              );
                            }}
                            className="px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded"
                          >
                            {AGE_GROUPS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>

                          <select
                            aria-label={`Correct option for staged question ${idx + 1}`}
                            value={sq.correctIndex}
                            onChange={(e) => {
                              const nextCorrect = Number(e.target.value) as 0 | 1 | 2 | 3 | 4;
                              setStagedQuestions((prev) =>
                                prev.map((item) =>
                                  item.tempId === sq.tempId
                                    ? { ...item, correctIndex: nextCorrect }
                                    : item
                                )
                              );
                            }}
                            className="px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded"
                          >
                            {sq.options.map((_, optIdx) => (
                              <option key={OPTION_LETTERS[optIdx]} value={optIdx}>
                                Answer: {OPTION_LETTERS[optIdx]}
                              </option>
                            ))}
                          </select>

                          <span className="text-[11px] text-slate-500 truncate">
                            {sq.topic}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={
                      importingBatch ||
                      stagedQuestions.filter((q) => q.selected).length === 0
                    }
                    onClick={() => void handleCommitBatch()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {importingBatch
                        ? 'Importing to Firestore...'
                        : `Import ${stagedQuestions.filter((q) => q.selected).length} Question(s) to Bank`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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
              {filteredQuestions.map((q, index) => {
                const isEditingThis = editingId === q.id;
                return (
                  <div
                    key={q.id}
                    className={`p-5 space-y-3 transition-colors ${
                      isEditingThis ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-600/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500">
                          <span className="font-mono tabular-nums font-semibold text-slate-700">
                            #{index + 1}
                          </span>
                          {' · '}
                          <span>{q.topic}</span>
                          {isEditingThis && (
                            <span className="text-blue-700 font-semibold"> · Editing</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-900 leading-snug">
                          <MathText text={q.prompt} />
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {confirmDeleteId === q.id ? (
                          <>
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
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(q)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(q.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Remove
                            </button>
                          </>
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
                              <MathText text={opt} />
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

                    {q.explanation && (
                      <p className="text-xs text-slate-500 pt-0.5">
                        Note: <MathText text={q.explanation} />
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
