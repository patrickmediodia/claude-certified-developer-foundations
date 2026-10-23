import Anthropic from '@anthropic-ai/sdk';

export const COACH_MODEL = 'claude-opus-5-5';

const SYSTEM_PROMPT = `You are a concise exam coach for the Claude Certified Developer – Foundations (CCDV-F) exam.
The learner is a working software engineer studying in a terminal app. You are given the lesson
chunk they are reading and their question.

- Answer the question directly first, then add only what helps them pass the exam.
- If they ask you to "explain differently", re-teach the chunk with a new angle: an analogy,
  a concrete scenario, or a tiny worked example. Don't repeat the chunk's wording.
- Point out the exam trap when there is one (e.g. a tempting-but-wrong option).
- Stay consistent with the lesson content; if you believe the lesson is wrong or outdated, say so plainly.
- Keep it short: usually under 200 words. Use markdown (bold, bullets, short code blocks, small tables).`;

export interface CoachTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type CoachResult =
  | { ok: true; text: string; stopReason: string | null }
  | { ok: false; message: string; partial: string };

/** Explain an SDK failure in one short line, using the typed error classes. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIUserAbortError) return 'Cancelled.';
  if (err instanceof Anthropic.AuthenticationError)
    return 'Claude rejected the credentials (401). Check ANTHROPIC_API_KEY or run `ant auth login`.';
  if (err instanceof Anthropic.PermissionDeniedError)
    return `Your key doesn't have access to ${COACH_MODEL} (403).`;
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited (429). Wait a moment and try again.';
  if (err instanceof Anthropic.BadRequestError) return `Bad request (400): ${err.message}`;
  if (err instanceof Anthropic.NotFoundError) return `Model ${COACH_MODEL} not found (404).`;
  if (err instanceof Anthropic.APIConnectionError)
    return 'Could not reach the Claude API (network error). You can keep studying offline.';
  if (err instanceof Anthropic.InternalServerError)
    return err.status === 529
      ? 'Claude is overloaded right now (529). Try again shortly.'
      : `Claude API server error (${err.status}). Try again shortly.`;
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ''}: ${err.message}`;
  // The SDK throws a plain Error when no credentials can be resolved at all.
  const detail = err instanceof Error ? (err.message.split(/\.\s|\n/)[0] ?? '') : String(err);
  return `Claude is unavailable (${detail}). Set ANTHROPIC_API_KEY or run \`ant auth login\`; everything else works offline.`;
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  // Zero-arg constructor resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile.
  client ??= new Anthropic();
  return client;
}

export interface AskOptions {
  breadcrumb: string[];
  chunkMarkdown: string;
  /** Prior turns of this side conversation (the first user turn already includes the chunk). */
  history: CoachTurn[];
  question: string;
  onText: (delta: string) => void;
  signal?: AbortSignal;
}

/** Build the user turn that carries the lesson chunk plus the learner's question. */
export function buildFirstTurn(breadcrumb: string[], chunkMarkdown: string, question: string): string {
  return [
    `<lesson_chunk location="${breadcrumb.join(' › ')}">`,
    chunkMarkdown,
    '</lesson_chunk>',
    '',
    question.trim() || "Explain this chunk differently — I didn't fully get it.",
  ].join('\n');
}

/** Stream an answer from Claude. Never throws: failures come back as `{ ok: false }`. */
export async function askCoach(opts: AskOptions): Promise<CoachResult> {
  if (process.env.TUTUI_OFFLINE === '1') {
    return { ok: false, message: 'Claude is disabled (TUTUI_OFFLINE=1).', partial: '' };
  }
  let partial = '';
  try {
    const messages: Anthropic.MessageParam[] = opts.history.length
      ? [...opts.history, { role: 'user', content: opts.question }]
      : [{ role: 'user', content: buildFirstTurn(opts.breadcrumb, opts.chunkMarkdown, opts.question) }];

    // No temperature/top_p/top_k/budget_tokens: Opus 5.5 rejects them (thinking is always on;
    // depth is controlled by output_config.effort, left at its default here).
    const stream = getClient().messages.stream(
      { model: COACH_MODEL, max_tokens: 16000, system: SYSTEM_PROMPT, messages },
      { signal: opts.signal },
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        partial += event.delta.text;
        opts.onText(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (final.stop_reason === 'refusal') {
      return { ok: false, message: 'Claude declined to answer that.', partial: text };
    }
    return { ok: true, text, stopReason: final.stop_reason };
  } catch (err) {
    return { ok: false, message: describeError(err), partial };
  }
}
