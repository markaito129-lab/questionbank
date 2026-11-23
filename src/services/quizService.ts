import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  AGE_GROUPS,
  type AgeGroup,
  type LeaderboardEntry,
  type NewQuestionInput,
  type Question,
} from '../types';
import { STARTER_QUESTIONS } from '../data/starterQuestions';
import { computeNetScore } from '../utils/formatters';

function toMillis(val: unknown): number {
  if (val && typeof (val as Timestamp).toMillis === 'function') {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
}

function isAgeGroup(val: unknown): val is AgeGroup {
  return typeof val === 'string' && (AGE_GROUPS as readonly string[]).includes(val);
}

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function subscribeActiveQuestions(
  onData: (questions: Question[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = 'questions';
  const q = query(collection(db, path), where('isActive', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Question[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          isAgeGroup(data.ageGroup) &&
          typeof data.prompt === 'string' &&
          Array.isArray(data.options) &&
          data.options.length === 4 &&
          typeof data.correctIndex === 'number'
        ) {
          items.push({
            id: docSnap.id,
            ageGroup: data.ageGroup,
            prompt: data.prompt,
            options: [
              String(data.options[0]),
              String(data.options[1]),
              String(data.options[2]),
              String(data.options[3]),
            ],
            correctIndex: Math.min(3, Math.max(0, Math.floor(data.correctIndex))) as 0 | 1 | 2 | 3,
            topic: typeof data.topic === 'string' ? data.topic : 'General',
            explanation: typeof data.explanation === 'string' ? data.explanation : '',
            isActive: Boolean(data.isActive),
            createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
            createdAtMs: toMillis(data.createdAt),
            updatedAtMs: toMillis(data.updatedAt),
          });
        }
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeLeaderboardEntries(
  onData: (entries: LeaderboardEntry[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = 'leaderboard_entries';
  const q = query(collection(db, path), where('isPublished', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: LeaderboardEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          isAgeGroup(data.ageGroup) &&
          typeof data.studentName === 'string' &&
          typeof data.score === 'number'
        ) {
          items.push({
            id: docSnap.id,
            userId: typeof data.userId === 'string' ? data.userId : '',
            studentName: data.studentName,
            ageGroup: data.ageGroup,
            score: data.score,
            correctCount: Number(data.correctCount) || 0,
            wrongCount: Number(data.wrongCount) || 0,
            skippedCount: Number(data.skippedCount) || 0,
            totalQuestions: Number(data.totalQuestions) || 1,
            elapsedSeconds: Number(data.elapsedSeconds) || 0,
            isPublished: Boolean(data.isPublished),
            submittedAtMs: toMillis(data.submittedAt),
          });
        }
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function checkIsAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) return true;

  const path = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createQuestion(
  input: NewQuestionInput,
  adminUid: string
): Promise<string> {
  const prompt = input.prompt.trim().slice(0, 1200);
  const topic = (input.topic.trim() || 'General').slice(0, 80);
  const explanation = input.explanation.trim().slice(0, 600);
  const options: [string, string, string, string] = [
    input.options[0].trim().slice(0, 300),
    input.options[1].trim().slice(0, 300),
    input.options[2].trim().slice(0, 300),
    input.options[3].trim().slice(0, 300),
  ];

  if (prompt.length < 3) {
    throw new Error('Question prompt must be at least 3 characters.');
  }
  if (options.some((opt) => opt.length < 1)) {
    throw new Error('All four answer choices must be filled in.');
  }

  const questionId = makeSafeId('q');
  const path = `questions/${questionId}`;
  try {
    await setDoc(doc(db, 'questions', questionId), {
      ageGroup: input.ageGroup,
      prompt,
      options,
      correctIndex: input.correctIndex,
      topic,
      explanation,
      isActive: true,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return questionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const path = `questions/${questionId}`;
  try {
    await deleteDoc(doc(db, 'questions', questionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedStarterQuestions(
  adminUid: string,
  existingQuestions: Question[]
): Promise<number> {
  const existingPrompts = new Set(
    existingQuestions.map((q) => `${q.ageGroup}::${q.prompt.trim().toLowerCase()}`)
  );

  const toInsert = STARTER_QUESTIONS.filter(
    (q) => !existingPrompts.has(`${q.ageGroup}::${q.prompt.trim().toLowerCase()}`)
  );

  if (toInsert.length === 0) return 0;

  const batch = writeBatch(db);
  toInsert.forEach((item, idx) => {
    const id = makeSafeId(`seed_${item.ageGroup.toLowerCase()}_${idx}`);
    batch.set(doc(db, 'questions', id), {
      ageGroup: item.ageGroup,
      prompt: item.prompt.trim().slice(0, 1200),
      options: item.options.map((o) => o.trim().slice(0, 300)),
      correctIndex: item.correctIndex,
      topic: item.topic.trim().slice(0, 80),
      explanation: item.explanation.trim().slice(0, 600),
      isActive: true,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
    return toInsert.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'questions');
  }
}

export async function submitLeaderboardEntry(params: {
  userId: string;
  studentName: string;
  ageGroup: AgeGroup;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  elapsedSeconds: number;
}): Promise<string> {
  const entryId = makeSafeId('lb');
  const path = `leaderboard_entries/${entryId}`;
  const cleanName = (params.studentName.trim() || 'Student').slice(0, 60);
  const correctCount = Math.max(0, Math.floor(params.correctCount));
  const wrongCount = Math.max(0, Math.floor(params.wrongCount));
  const skippedCount = Math.max(0, Math.floor(params.skippedCount));
  const totalQuestions = correctCount + wrongCount + skippedCount;
  const score = computeNetScore(correctCount, wrongCount);
  const elapsedSeconds = Math.min(1800, Math.max(0, Math.round(params.elapsedSeconds)));

  try {
    await setDoc(doc(db, 'leaderboard_entries', entryId), {
      userId: params.userId,
      studentName: cleanName,
      ageGroup: params.ageGroup,
      score,
      correctCount,
      wrongCount,
      skippedCount,
      totalQuestions,
      elapsedSeconds,
      isPublished: true,
      submittedAt: serverTimestamp(),
    });
    return entryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteLeaderboardEntry(entryId: string): Promise<void> {
  const path = `leaderboard_entries/${entryId}`;
  try {
    await deleteDoc(doc(db, 'leaderboard_entries', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
