# Module 1 — MSO Foundations (Model Selection & Optimisation)

**Exam domain:** Model Selection & Optimisation — **16.8%** of the exam.
**Why it matters:** technical bedrock for the 33.1% Applications & Integration domain.
Understand tokens, context, and model trade-offs → cost questions become arithmetic.

---

## Part 1 — LLM & Technical Fundamentals

Claude is an **autoregressive next-token predictor**: it takes a sequence of tokens
and generates output tokens one at a time, each conditioned on everything before it.
It generates — it does not "look up" from a database. Consequences:

- **Stateless API.** No memory between calls. Every request must resend the *entire*
  conversation history (system prompt + all prior turns). Remembering turn 1 at turn 5
  means resending turns 1–4. This is why conversation cost grows each turn.
- **Non-deterministic.** Same prompt can yield different output. On current Claude models
  (Opus 4.8, Sonnet 5, Fable 5) `temperature`/`top_p`/`top_k` are **not accepted** — steer
  with prompting and the `effort` parameter instead.

### Tokens — the atomic unit
- Everything is measured and priced in tokens.
- Rule of thumb: **1 token ≈ 4 characters ≈ 0.75 words** (English). Code and
  non-English tokenize less efficiently (more tokens per word).
- **Never use `tiktoken`** for Claude — it's OpenAI's tokenizer, undercounts by ~15–20%.
  Use the **Token Counting API**: `client.messages.count_tokens(...)`
  (`POST /v1/messages/count_tokens`), which is model-specific.
- `max_tokens` caps **output** tokens. Hitting it truncates mid-response →
  `stop_reason == "max_tokens"`.

### Context window = max total tokens (input + output) considered at once

| Model | Context window | Max output |
|---|---|---|
| Claude Opus 4.8 | 1M | 128K |
| Claude Sonnet 5 | 1M | 128K |
| Claude Haiku 4.5 | 200K | 64K |
| Claude Fable 5 | 1M | 128K |

Exceeding the context window is an **error**, not silent truncation. Managing what goes
in is the developer's job (RAG, compaction, context editing — later modules).

---

## Part 2 — Model Trade-offs (Opus / Sonnet / Haiku / Fable)

The model line is a **capability ↔ speed ↔ cost** triangle. Pricing is per **million** tokens:

| Model | Input $/1M | Output $/1M | Pick it when… |
|---|---|---|---|
| **Opus 4.8** | $5.00 | $25.00 | Hardest reasoning, long-horizon agents, complex coding. Highest capability (Opus tier). |
| **Sonnet 5** | $3.00 | $15.00 | High-volume production; near-Opus quality on coding/agentic at lower cost. The workhorse. |
| **Haiku 4.5** | $1.00 | $5.00 | Simple, high-throughput, latency-sensitive tasks (classification, routing, extraction). Fastest/cheapest. |
| **Fable 5** | $10.00 | $50.00 | Most capable widely-released model; most demanding work. Premium — NOT the default upgrade. |

Two exam-favorite points:
1. **Output tokens cost ~5× input tokens** across the whole line. Short input + long
   output can be surprisingly expensive; huge input + one-word answer is cheap.
2. **Match the model to the task; don't default to the biggest.** A classifier on Opus is
   wasteful — Haiku does it faster and ~5× cheaper. Reserve Opus/Fable for genuine reasoning.

---

## Part 3 — Tokens & Cost Management

Three big levers, in order of impact:

1. **Right-size the model** (above). Biggest single lever.
2. **Prompt caching** — cache a large, stable prefix (system prompt, big document, tool
   definitions). Repeated requests re-read it at **~0.1× (cache read)** vs full price.
   - Cache **write** ≈ 1.25× (5-min TTL) or 2× (1-hour TTL). Break-even ≈ 2 requests (5-min).
   - **Caching is a PREFIX MATCH** — any byte change *anywhere before* the cache breakpoint
     invalidates everything after it. A `datetime.now()` or UUID in the system prompt
     silently kills the cache.
   - Verify with `usage.cache_read_input_tokens` — if it's 0 across identical requests,
     a silent invalidator is at work.
   - Render order: `tools` → `system` → `messages`. Keep stable content first, volatile last.
3. **Batch API** — non-latency-sensitive work (overnight/bulk): **50% off** all tokens.
   Results usually within ~1h, max 24h. Key results by `custom_id` (any order).

Supporting levers: `count_tokens` before sending to estimate cost; set `max_tokens`
appropriately; use `effort` (low/medium/high/xhigh/max) to control how much the model thinks.

### Cost formula (do it in your head)
```
cost = (input_tokens × input_rate) + (output_tokens × output_rate)
```
Example — Sonnet 5, 10,000 input + 1,000 output:
`(10,000 × $3/1M) + (1,000 × $15/1M) = $0.03 + $0.015 = $0.045`

---

## Key takeaways
- Stateless API → resend full history → per-turn cost grows.
- Tokens are the unit of everything; count with the API, not tiktoken.
- Context window = input + output combined; exceeding it errors.
- Output ≈ 5× input cost; pick the smallest model that does the job.
- Cost levers (impact order): model choice → prompt caching → batch API.
- Prompt caching is prefix-match; volatile content before the breakpoint kills it.
