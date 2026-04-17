import type { Request, Response } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { isTaskStatus } from '../services/validation';

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

  const systemPrompt = `You receive a voice transcript of someone describing a task. 
Extract the following fields and respond ONLY with valid JSON, no explanation:
- title: short imperative sentence summarising the task (required, max 80 chars)
- status: one of "todo", "doing", "done" — default "todo" unless the speaker clearly says the task is in progress or already done
- estimate: a Fibonacci number (1, 2, 3, 5, or 8) representing story points, or null if not mentioned
- description: any remaining detail as plain text; empty string if none

Example output:
{"title":"Set up CI pipeline","status":"todo","estimate":3,"description":"Use GitHub Actions with Node 20 and run tests on every pull request."}`;

  const response = await client.chat.completions.create({
    model: 'anthropic/claude-sonnet-4-5',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: transcript },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
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
  const estimate =
    typeof rawEst === 'number' && validEstimates.includes(rawEst) ? rawEst : null;
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
