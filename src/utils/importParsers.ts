import * as XLSX from 'xlsx';
import { AGE_GROUPS, type AgeGroup, type NewQuestionInput } from '../types';

export interface SpreadsheetParseResult {
  questions: NewQuestionInput[];
  skippedRows: { rowNumber: number; reason: string }[];
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeAgeGroup(raw: unknown, fallback: AgeGroup): AgeGroup {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().toLowerCase();
  const match = AGE_GROUPS.find((g) => g.toLowerCase() === cleaned);
  return match || fallback;
}

function resolveCorrectIndex(
  rawAnswer: unknown,
  options: string[],
  headerWasZeroIndexed: boolean
): 0 | 1 | 2 | 3 | 4 | null {
  if (rawAnswer === undefined || rawAnswer === null) return null;
  const str = String(rawAnswer).trim();
  if (!str) return null;

  const upper = str.toUpperCase();
  let idx: number | null = null;

  if (upper === 'A' || upper === 'OPTION A' || upper === 'CHOICE A') idx = 0;
  else if (upper === 'B' || upper === 'OPTION B' || upper === 'CHOICE B') idx = 1;
  else if (upper === 'C' || upper === 'OPTION C' || upper === 'CHOICE C') idx = 2;
  else if (upper === 'D' || upper === 'OPTION D' || upper === 'CHOICE D') idx = 3;
  else if (upper === 'E' || upper === 'OPTION E' || upper === 'CHOICE E') idx = 4;
  else if (/^[0-5]$/.test(str)) {
    const num = Number(str);
    if (headerWasZeroIndexed) {
      if (num >= 0 && num <= 4) idx = num;
    } else {
      if (num === 0) idx = 0;
      else if (num >= 1 && num <= 5) idx = num - 1;
    }
  } else {
    const lower = str.toLowerCase();
    const textIdx = options.findIndex((o) => o.trim().toLowerCase() === lower);
    if (textIdx >= 0 && textIdx <= 4) {
      idx = textIdx;
    }
  }

  if (idx === null || idx < 0 || idx >= options.length) {
    return null;
  }
  return idx as 0 | 1 | 2 | 3 | 4;
}

export async function parseSpreadsheetFile(
  file: File,
  defaultAgeGroup: AgeGroup
): Promise<SpreadsheetParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded spreadsheet contains no sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  });

  if (rawRows.length === 0) {
    throw new Error('The uploaded spreadsheet is empty.');
  }

  const questions: NewQuestionInput[] = [];
  const skippedRows: { rowNumber: number; reason: string }[] = [];

  rawRows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2;
    const byKey = new Map<string, { rawKey: string; val: unknown }>();

    for (const [k, v] of Object.entries(rawRow)) {
      byKey.set(normalizeHeader(k), { rawKey: k, val: v });
    }

    const getField = (candidates: string[]): unknown => {
      for (const c of candidates) {
        const hit = byKey.get(c);
        if (hit && String(hit.val).trim() !== '') return hit.val;
      }
      return '';
    };

    const promptRaw = getField([
      'prompt',
      'question',
      'questiontext',
      'problem',
      'q',
    ]);
    const prompt = String(promptRaw ?? '').trim().slice(0, 1200);

    const optSlots = [
      String(getField(['optiona', 'a', 'choicea', 'option1', 'choice1', 'answera']) ?? '').trim().slice(0, 300),
      String(getField(['optionb', 'b', 'choiceb', 'option2', 'choice2', 'answerb']) ?? '').trim().slice(0, 300),
      String(getField(['optionc', 'c', 'choicec', 'option3', 'choice3', 'answerc']) ?? '').trim().slice(0, 300),
      String(getField(['optiond', 'd', 'choiced', 'option4', 'choice4', 'answerd']) ?? '').trim().slice(0, 300),
      String(getField(['optione', 'e', 'choicee', 'option5', 'choice5', 'answere']) ?? '').trim().slice(0, 300),
    ];

    // Enforce contiguous choices starting from A (no skipped columns before E)
    let hasGap = false;
    let seenEmpty = false;
    for (const slot of optSlots) {
      if (!slot) {
        seenEmpty = true;
      } else if (seenEmpty) {
        hasGap = true;
      }
    }

    const options = optSlots.filter((o) => o.length > 0);

    if (prompt.length < 3) {
      skippedRows.push({ rowNumber, reason: 'Missing or too short question prompt.' });
      return;
    }

    if (hasGap) {
      skippedRows.push({
        rowNumber,
        reason: 'Options have an empty column gap (fill choices sequentially from OptionA).',
      });
      return;
    }

    if (options.length < 2) {
      skippedRows.push({
        rowNumber,
        reason: 'Requires at least 2 answer choices (up to 5 choices A–E).',
      });
      return;
    }

    const zeroIndexedKey = byKey.has('correctindex');
    const correctRaw = getField([
      'correctindex',
      'correct',
      'correctanswer',
      'answer',
      'key',
      'correctoption',
    ]);
    const correctIndex = resolveCorrectIndex(correctRaw, options, zeroIndexedKey);

    if (correctIndex === null) {
      skippedRows.push({
        rowNumber,
        reason: `Could not identify correct answer within choices A–${String.fromCharCode(64 + options.length)}.`,
      });
      return;
    }

    const ageGroupRaw = getField(['agegroup', 'division', 'group', 'level', 'category']);
    const topicRaw = getField(['topic', 'subject', 'skill', 'tag']);
    const explanationRaw = getField(['explanation', 'note', 'solution', 'rationale']);

    questions.push({
      ageGroup: normalizeAgeGroup(ageGroupRaw, defaultAgeGroup),
      prompt,
      options,
      correctIndex,
      topic: (String(topicRaw ?? '').trim() || 'General').slice(0, 80),
      explanation: String(explanationRaw ?? '').trim().slice(0, 600),
    });
  });

  return { questions, skippedRows };
}

export function downloadExcelTemplate(defaultAgeGroup: AgeGroup): void {
  const rows = [
    {
      AgeGroup: defaultAgeGroup,
      Topic: 'Mental Math',
      Prompt: 'What is 18 + 27?',
      OptionA: '43',
      OptionB: '45',
      OptionC: '47',
      OptionD: '49',
      OptionE: '51',
      Correct: 'B',
      Explanation: '18 + 20 = 38, and 38 + 7 = 45.',
    },
    {
      AgeGroup: defaultAgeGroup,
      Topic: 'Geometry',
      Prompt: 'How many sides does a regular pentagon have?',
      OptionA: '4',
      OptionB: '5',
      OptionC: '6',
      OptionD: '8',
      OptionE: '',
      Correct: 'B',
      Explanation: 'A pentagon is a five-sided polygon (OptionE left blank for 4-choice question).',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
  XLSX.writeFile(workbook, `sprintquiz_template_${defaultAgeGroup.toLowerCase()}.xlsx`);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to read the selected file.'));
    reader.readAsDataURL(file);
  });
}
