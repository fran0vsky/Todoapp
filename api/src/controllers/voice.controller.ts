import type { Request, Response } from 'express';
import { appendFile, mkdir } from 'fs/promises';
import path from 'node:path';
import multer from 'multer';
import OpenAI from 'openai';
import { isTaskStatus, parseEstimate } from '../services/validation';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Models known to expose audio input on OpenRouter (gpt-4o-mini often does not — see Models → input modality audio).
 * https://openrouter.ai/models?input_modalities=audio
 */
function openRouterTranscriptionModels(): string[] {
  const fromEnv = process.env['OPENROUTER_TRANSCRIPTION_MODEL']?.trim();
  const defaults = ['openai/gpt-4o', 'google/gemini-2.0-flash-001'];
  if (fromEnv) {
    return [fromEnv, ...defaults.filter((m) => m !== fromEnv)];
  }
  return defaults;
}

function sanitizeUpstreamError(body: string, status: number): string {
  const trimmed = body.trim();
  if (/^<!DOCTYPE html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return `Speech service returned HTTP ${status} (HTML error). OpenRouter’s /audio/transcriptions route is unreliable — this app uses chat + audio instead; if it still fails, add OPENAI_API_KEY for Whisper.`;
  }
  try {
    const j = JSON.parse(trimmed) as { error?: { message?: string } };
    if (typeof j.error?.message === 'string' && j.error.message.trim()) return j.error.message.trim();
  } catch {
    /* not JSON */
  }
  if (trimmed.length > 280) {
    return `Speech service error (HTTP ${status}): ${trimmed.slice(0, 200)}…`;
  }
  return trimmed || `Speech service error (HTTP ${status})`;
}

function clipErrorForClient(message: string, maxLen = 500): string {
  const m = message.trim();
  if (/^<!DOCTYPE html/i.test(m) || (m.includes('<html') && m.length > 400)) {
    return 'Speech recognition failed (the provider returned an error page). Add OPENAI_API_KEY to api/.env for OpenAI Whisper, or try again later.';
  }
  return m.length > maxLen ? `${m.slice(0, maxLen)}…` : m;
}

/** Map browser / multer mimetype to OpenRouter `input_audio.format` (see their audio input docs). */
function mimeToOpenRouterAudioFormat(mimetype: string): string {
  const m = (mimetype || '').toLowerCase();
  if (m.includes('wav')) return 'wav';
  if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('flac')) return 'flac';
  if (m.includes('aac')) return 'aac';
  if (m.includes('aiff')) return 'aiff';
  if (m.includes('ogg')) return 'ogg';
  // Chrome MediaRecorder: webm with opus — providers often accept as ogg/opus family
  if (m.includes('webm')) return 'ogg';
  return 'ogg';
}

function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

/**
 * OpenRouter: audio via POST /v1/chat/completions + base64 `input_audio` (not /audio/transcriptions).
 */
async function transcribeOpenRouterWithModel(
  buffer: Buffer,
  mimetype: string,
  model: string
): Promise<string> {
  const key = getOpenRouterKey();
  const b64 = buffer.toString('base64');
  const format = mimeToOpenRouterAudioFormat(mimetype);

  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:4200',
      'X-Title': 'Todoapp Voice',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe the speech in this audio. Reply with only the spoken words, no preamble or quotes.',
            },
            {
              type: 'input_audio',
              input_audio: {
                data: b64,
                format,
              },
            },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(sanitizeUpstreamError(rawText, res.status));
  }

  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(sanitizeUpstreamError(rawText, res.status));
  }

  const d = data as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  if (d.error?.message) {
    throw new Error(d.error.message);
  }

  const text = extractMessageText(d.choices?.[0]?.message?.content).trim();
  return text;
}

function shouldTryNextOpenRouterModel(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('input audio') ||
    m.includes('no endpoints') ||
    m.includes('does not support') ||
    m.includes('modality')
  );
}

async function transcribeViaOpenRouterChat(buffer: Buffer, mimetype: string): Promise<string> {
  const models = openRouterTranscriptionModels();
  let lastError: Error | null = null;
  for (const model of models) {
    try {
      return await transcribeOpenRouterWithModel(buffer, mimetype, model);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!shouldTryNextOpenRouterModel(lastError.message) || models.indexOf(model) === models.length - 1) {
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error('OpenRouter transcription failed');
}

async function transcribeOpenAIWhisper(
  buffer: Buffer,
  mimetype: string,
  openaiKey: string
): Promise<string> {
  const extension = mimetype.includes('webm')
    ? 'webm'
    : mimetype.includes('mp4') || mimetype.includes('m4a')
      ? 'mp4'
      : mimetype.includes('ogg')
        ? 'ogg'
        : mimetype.includes('wav')
          ? 'wav'
          : 'webm';
  const openai = new OpenAI({ apiKey: openaiKey });
  const file = bufferToFile(buffer, `audio.${extension}`, mimetype || 'audio/webm');
  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });
  return response.text;
}

/** Multer — keep audio in memory (< 25 MB limit for Whisper). */
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are accepted'));
    }
  },
});

function getOpenRouterKey(): string {
  const key = process.env['OPENROUTER_API_KEY'];
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  return key;
}

/** Convert Buffer to a File so the OpenAI SDK attaches it correctly. */
function bufferToFile(buffer: Buffer, filename: string, mimetype: string): File {
  // Slice into a plain ArrayBuffer (avoids SharedArrayBuffer type incompatibility).
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return new File([arrayBuffer], filename, { type: mimetype });
}

async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  const openaiKey = process.env['OPENAI_API_KEY']?.trim();

  // OpenAI Whisper is the most reliable for browser WebM; use first when configured.
  if (openaiKey) {
    try {
      return await transcribeOpenAIWhisper(buffer, mimetype, openaiKey);
    } catch (wErr: unknown) {
      const wMsg = wErr instanceof Error ? wErr.message : String(wErr);
      try {
        return await transcribeViaOpenRouterChat(buffer, mimetype);
      } catch {
        throw new Error(
          `Whisper failed (${wMsg}). OpenRouter audio also failed. Check OPENAI_API_KEY billing and OpenRouter models with audio input.`
        );
      }
    }
  }

  try {
    return await transcribeViaOpenRouterChat(buffer, mimetype);
  } catch (orErr: unknown) {
    const detail = orErr instanceof Error ? orErr.message : 'OpenRouter transcription failed';
    throw new Error(
      `${detail} Add OPENAI_API_KEY to api/.env for OpenAI Whisper (recommended for WebM), or set OPENROUTER_TRANSCRIPTION_MODEL to a model listed under audio input on openrouter.ai/models.`
    );
  }
}

interface ParsedTask {
  title: string;
  status: 'todo' | 'doing' | 'done';
  estimate: number | null;
  description: string;
}

async function parseTranscriptToTask(transcript: string): Promise<ParsedTask> {
  const key = getOpenRouterKey();

  const client = new OpenAI({
    apiKey: key,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:4200',
      'X-Title': 'Todoapp Voice',
    },
  });

  const systemPrompt = `You are a software project manager receiving a voice note from a developer.
Your job is NOT to transcribe — it IS to produce a well-formed task card from what they said.

Respond ONLY with valid JSON, no markdown, no explanation. Shape:
{"title":"...","status":"todo"|"doing"|"done","estimate":1|2|3|5|8|null,"description":"..."}

Rules:
- title: imperative phrase, max 60 characters, no filler ("so I need to", "basically", "um"). Name the outcome, not the ramble.
- description: 1–3 short sentences: context, scope, and acceptance-style detail. Write what must be done in clear technical language — not a verbatim quote of the voice note. Use empty string "" only if there is truly nothing beyond the title.
- status: "todo" | "doing" | "done" — infer carefully from how the speaker frames the work:
  Use "doing" when they signal active work on this item, including phrases like: "I'm working on", "I'm currently working on", "currently developing", "I'm building", "already started", "already working on this", "in progress", "actively developing", "halfway through", "midway", "started on", "deep into", "still implementing" — even if they also describe what the thing is (e.g. "create a task for the weather app I'm currently working on" → status "doing" because they are actively on it).
  Use "done" when the work is finished or they treat it as complete — not only past tense but also "already": "finished", "done with", "completed", "shipped", "wrapped up", "merged", "landed", "it's live", "already done", "already complete", "already finished", "already created", "already built", "already implemented", "that's done", "this is complete", "nothing left to do", "checked in", "deployed", "released". If they ask to log or record something they already finished, use "done" so it belongs in the Done column.
  If both "still working" and "done" cues appear, prefer the clearest recent intent; when unclear, default "todo".
  Default "todo" only when it sounds like a new/backlog item with no active-work or completion language.
- estimate: Fibonacci story points 1, 2, 3, 5, or 8 from apparent complexity (always pick one number; avoid null unless the transcript is empty of substance):
  1 = trivial (rename, toggle, copy-paste)
  2 = small (single file, obvious fix)
  3 = medium (several files, some thinking) — default when unclear
  5 = large (cross-cutting, integration, unclear edges)
  8 = very large (multi-day, migration, heavy unknowns)
  Use cues: "quick/simple/trivial" → lower; "refactor/migrate/investigate/architecture" → higher.

Examples:
{"title":"Add GitHub Actions CI for PR tests","status":"todo","estimate":3,"description":"Wire Node 20 in Actions. Run the test suite on every pull request. Fail the job on test or lint errors."}
{"title":"Build weather app MVP","status":"doing","estimate":5,"description":"User is actively developing the weather app. Capture remaining feature work and polish before release."}
{"title":"Document login API in README","status":"done","estimate":2,"description":"Speaker reports this is already written and merged. Task records completed documentation work for the login endpoints."}`;

  const response = await client.chat.completions.create({
    model: 'anthropic/claude-sonnet-4-5',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: transcript },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  let raw = response.choices[0]?.message?.content ?? '{}';
  raw = raw.trim();
  const jsonBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock?.[1]) raw = jsonBlock[1].trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('AI returned invalid JSON for task fields');
  }

  const title = typeof parsed['title'] === 'string' ? parsed['title'].trim() : '';
  const rawStatus = parsed['status'];
  const status = isTaskStatus(rawStatus) ? rawStatus : 'todo';
  const rawEst = parsed['estimate'];
  const validEstimates = [1, 2, 3, 5, 8];
  let estimate =
    typeof rawEst === 'number' && validEstimates.includes(rawEst) ? rawEst : null;
  if (estimate === null && title) {
    estimate = 3;
  }
  const description =
    typeof parsed['description'] === 'string' ? parsed['description'].trim() : '';

  return { title, status, estimate, description };
}

export async function postVoiceProcess(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'audio file is required' });
    return;
  }

  try {
    const transcript = await transcribeAudio(file.buffer, file.mimetype);

    if (!transcript.trim()) {
      res.status(422).json({ error: 'No speech detected in the audio' });
      return;
    }

    const parsed = await parseTranscriptToTask(transcript);

    if (!parsed.title) {
      res.status(422).json({ error: 'Could not extract a task title from the transcript' });
      return;
    }

    res.json({ transcript, ...parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Voice processing failed';
    res.status(500).json({ error: clipErrorForClient(message) });
  }
}

export async function postVoiceLog(req: Request, res: Response): Promise<void> {
  const logPath = process.env['VOICE_DATA_LOG_PATH']?.trim();
  if (!logPath) {
    res.status(204).send();
    return;
  }

  const raw = req.body;
  if (!raw || typeof raw !== 'object') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const task = (raw as { task?: unknown }).task;
  if (typeof task !== 'string' || !task.trim()) {
    res.status(400).json({ error: 'task is required' });
    return;
  }

  const expectedRaw = (raw as { expected?: unknown }).expected;
  if (!expectedRaw || typeof expectedRaw !== 'object') {
    res.status(400).json({ error: 'expected is required' });
    return;
  }

  const exp = expectedRaw as Record<string, unknown>;
  const title = typeof exp['title'] === 'string' ? exp['title'].trim() : '';
  if (!title) {
    res.status(400).json({ error: 'expected.title is required' });
    return;
  }

  const description = typeof exp['description'] === 'string' ? exp['description'] : '';
  if (!isTaskStatus(exp['status'])) {
    res.status(400).json({ error: 'expected.status must be todo, doing, or done' });
    return;
  }

  const estParsed = parseEstimate(exp['estimate']);
  if (estParsed.ok === false) {
    res.status(400).json({ error: estParsed.error });
    return;
  }

  const line =
    JSON.stringify({
      task: task.trim(),
      expected: {
        title,
        description,
        status: exp['status'],
        estimate: estParsed.value,
      },
    }) + '\n';

  try {
    const resolved = path.resolve(logPath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await appendFile(resolved, line, 'utf8');
    res.status(204).send();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to write voice log';
    res.status(500).json({ error: message });
  }
}
