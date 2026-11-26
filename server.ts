import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_AGE_GROUPS = [
  'Beginners',
  'Primary',
  'Juniors',
  'Intermediate',
  'Seniors',
  'Open',
] as const;

type AgeGroup = (typeof VALID_AGE_GROUPS)[number];

interface ExtractedQuestion {
  ageGroup: AgeGroup;
  topic: string;
  prompt: string;
  options: string[];
  correctIndex: 0 | 1 | 2 | 3 | 4;
  explanation: string;
}

function normalizeAgeGroup(raw: unknown, fallback: AgeGroup): AgeGroup {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().toLowerCase();
  const match = VALID_AGE_GROUPS.find((g) => g.toLowerCase() === cleaned);
  return match || fallback;
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '20mb' }));

  app.post('/api/parse-pdf-questions', async (req, res) => {
    try {
      const body = req.body as {
        pdfBase64?: unknown;
        defaultAgeGroup?: unknown;
      };

      if (typeof body?.pdfBase64 !== 'string' || body.pdfBase64.trim().length === 0) {
        res.status(400).json({ error: 'Missing PDF file payload.' });
        return;
      }

      const defaultAgeGroup = normalizeAgeGroup(body.defaultAgeGroup, 'Beginners');

      // Strip optional data URL prefix if present
      const base64Data = body.pdfBase64.includes(',')
        ? body.pdfBase64.split(',')[1]
        : body.pdfBase64;

      const estimatedBytes = Math.floor((base64Data.length * 3) / 4);
      if (estimatedBytes > 15 * 1024 * 1024) {
        res.status(400).json({
          error: 'PDF file exceeds the 15 MB upload limit. Please split it into smaller files.',
        });
        return;
      }

      const ai = createGeminiClient();

      const promptText = [
        'Extract all multiple-choice quiz questions from the attached PDF document.',
        'For each question:',
        '- Preserve the exact mathematical symbols, numbers, and wording in "prompt".',
        '- Provide between 2 and 5 answer options in "options" (matching the choices in the PDF, e.g., A-D or A-E). If a question is open-ended without multiple-choice options, skip it.',
        '- Determine "correctIndex" (0 for A/first, 1 for B/second, 2 for C/third, 3 for D/fourth, 4 for E/fifth). Use the document answer key if present; otherwise solve carefully to identify the mathematically/factually correct option.',
        '- Assign a short "topic" (1 to 3 words, e.g. "Algebra", "Arithmetic", "Logic").',
        '- Provide a concise "explanation" (1 sentence max) showing how to solve it.',
        `- Set "ageGroup" to one of: ${VALID_AGE_GROUPS.join(', ')}. Use "${defaultAgeGroup}" unless the document explicitly labels a different division.`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ageGroup: {
                  type: Type.STRING,
                  description:
                    'One of: Beginners, Primary, Juniors, Intermediate, Seniors, Open',
                },
                topic: {
                  type: Type.STRING,
                  description: 'Short subject or skill label, max 80 chars.',
                },
                prompt: {
                  type: Type.STRING,
                  description: 'Complete question stem.',
                },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 to 5 answer choices (A through E).',
                },
                correctIndex: {
                  type: Type.INTEGER,
                  description: 'Zero-based index (0 to 4) of the correct option.',
                },
                explanation: {
                  type: Type.STRING,
                  description: 'Concise solution explanation.',
                },
              },
              required: ['topic', 'prompt', 'options', 'correctIndex'],
            },
          },
        },
      });

      const rawText = (response.text ?? '[]').trim();
      const parsed = JSON.parse(rawText) as unknown;

      if (!Array.isArray(parsed)) {
        res.status(422).json({
          error: 'Could not extract a structured question list from this PDF.',
        });
        return;
      }

      const validQuestions: ExtractedQuestion[] = [];
      let skippedCount = 0;

      for (const item of parsed) {
        if (!item || typeof item !== 'object') {
          skippedCount++;
          continue;
        }
        const record = item as Record<string, unknown>;
        const prompt =
          typeof record.prompt === 'string' ? record.prompt.trim().slice(0, 1200) : '';
        const rawOpts = Array.isArray(record.options) ? record.options : [];
        const cleanOpts = rawOpts
          .slice(0, 5)
          .map((o) => String(o ?? '').trim().slice(0, 300))
          .filter((o) => o.length > 0);

        const rawIdx =
          typeof record.correctIndex === 'number'
            ? Math.round(record.correctIndex)
            : -1;

        if (
          prompt.length < 3 ||
          cleanOpts.length < 2 ||
          cleanOpts.length > 5 ||
          rawIdx < 0 ||
          rawIdx >= cleanOpts.length
        ) {
          skippedCount++;
          continue;
        }

        const topic =
          typeof record.topic === 'string' && record.topic.trim().length > 0
            ? record.topic.trim().slice(0, 80)
            : 'General';
        const explanation =
          typeof record.explanation === 'string'
            ? record.explanation.trim().slice(0, 600)
            : '';

        validQuestions.push({
          ageGroup: normalizeAgeGroup(record.ageGroup, defaultAgeGroup),
          topic,
          prompt,
          options: cleanOpts,
          correctIndex: rawIdx as 0 | 1 | 2 | 3 | 4,
          explanation,
        });
      }

      res.json({
        questions: validQuestions,
        skippedCount,
      });
    } catch (err) {
      console.error('PDF question extraction failed:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to parse PDF questions.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SprintQuiz server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
