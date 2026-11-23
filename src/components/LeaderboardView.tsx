import { useMemo, useState } from 'react';
import { Trash2, Trophy } from 'lucide-react';
import {
  AGE_GROUPS,
  AGE_GROUP_META,
  type AgeGroup,
  type LeaderboardEntry,
} from '../types';
import { deleteLeaderboardEntry } from '../services/quizService';
import {
  formatDurationMMSS,
  formatScore,
  formatTimestampDate,
} from '../utils/formatters';

interface LeaderboardViewProps {
  selectedAgeGroup: AgeGroup;
  onSelectAgeGroup: (group: AgeGroup) => void;
  entries: LeaderboardEntry[];
  isLoading: boolean;
  isAdmin: boolean;
  onStartQuizForGroup: (group: AgeGroup) => void;
}

export function LeaderboardView({
  selectedAgeGroup,
  onSelectAgeGroup,
  entries,
  isLoading,
  isAdmin,
  onStartQuizForGroup,
}: LeaderboardViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const countsByGroup = useMemo(() => {
    const map: Record<AgeGroup, number> = {
      Beginners: 0,
      Primary: 0,
      Juniors: 0,
      Intermediate: 0,
      Seniors: 0,
      Open: 0,
    };
    entries.forEach((e) => {
      map[e.ageGroup] = (map[e.ageGroup] || 0) + 1;
    });
    return map;
  }, [entries]);

  const rankedEntries = useMemo(() => {
    return entries
      .filter((e) => e.ageGroup === selectedAgeGroup)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.elapsedSeconds !== b.elapsedSeconds) {
          return a.elapsedSeconds - b.elapsedSeconds;
        }
        return a.submittedAtMs - b.submittedAtMs;
      });
  }, [entries, selectedAgeGroup]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteLeaderboardEntry(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const meta = AGE_GROUP_META[selectedAgeGroup];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Division Leaderboards
          </h1>
          <p className="text-sm text-slate-600">
            Ranked by net score (+1 correct, −0.25 wrong, 0 skipped), with fastest solve time breaking ties.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onStartQuizForGroup(selectedAgeGroup)}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Compete in {selectedAgeGroup}
        </button>
      </div>

      {/* 6 Age Group Tabs */}
      <div
        role="tablist"
        aria-label="Leaderboard age groups"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-1.5 bg-slate-100 rounded-xl"
      >
        {AGE_GROUPS.map((group) => {
          const active = group === selectedAgeGroup;
          return (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectAgeGroup(group)}
              className={`px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
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

      {/* Leaderboard Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">
            {selectedAgeGroup} Standings
          </div>
          <div className="text-xs text-slate-500">
            {meta.bracket} · {meta.focus}
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading {selectedAgeGroup} standings...
          </div>
        ) : rankedEntries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Trophy className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800">
              No scores recorded yet for {selectedAgeGroup}.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Be the first student to complete the 30-minute sprint for this age division and set the pace.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-6 w-20">Rank</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4 text-right">Net Score</th>
                  <th className="py-3 px-4 text-right">Correct / Wrong / Skip</th>
                  <th className="py-3 px-4 text-right">Solve Time</th>
                  <th className="py-3 px-6 text-right">Submitted</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rankedEntries.map((entry, idx) => {
                  const rank = idx + 1;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-mono tabular-nums font-semibold text-slate-900">
                        #{rank}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {entry.studentName}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-blue-700">
                        {formatScore(entry.score)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                        <span className="text-emerald-700 font-medium">{entry.correctCount}</span>
                        {' / '}
                        <span className="text-red-700 font-medium">{entry.wrongCount}</span>
                        {' / '}
                        <span>{entry.skippedCount}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800">
                        {formatDurationMMSS(entry.elapsedSeconds)}
                      </td>
                      <td className="py-3.5 px-6 text-right text-xs text-slate-500 whitespace-nowrap">
                        {formatTimestampDate(entry.submittedAtMs)}
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {confirmDeleteId === entry.id ? (
                            <span className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={deletingId === entry.id}
                                onClick={() => handleDelete(entry.id)}
                                className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                              >
                                {deletingId === entry.id ? 'Removing...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(entry.id)}
                              aria-label={`Remove ${entry.studentName} entry`}
                              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
