# Module 1 — MSO Foundations: Quiz

Exam-style, scenario-based multiple choice. Answer before scrolling to the key.
Record scores in `/PROGRESS.md` (quiz history table).

---

## Quiz 1 (6 questions)

**Q1.** A chat app sends only short user messages, but you notice the cost per API
call rises steadily as the conversation goes on. What best explains this?
- A. Claude charges more per token the longer a session lasts
- B. The Messages API is stateless, so the full conversation history is resent each turn, growing input tokens
- C. `max_tokens` automatically increases each turn
- D. Output tokens are billed retroactively for the whole session

**Q2.** You must classify 1,000,000 support tickets into 5 categories overnight; latency
does not matter and you want minimum cost. Best combination?
- A. Opus 5.5 with streaming
- B. Sonnet 5.5 with prompt caching, one request per ticket
- C. Haiku 5.5 via the Message Batches API
- D. Fable 5.1 with the Batch API

**Q3.** Across repeated requests that share a large, supposedly-identical system prompt,
`usage.cache_read_input_tokens` is always 0. The most likely cause?
- A. The model doesn't support prompt caching
- B. A volatile value (e.g. `datetime.now()`) sits in the prefix before the cache breakpoint, changing the bytes each request
- C. `max_tokens` is set too low
- D. You must call a separate `/v1/cache` endpoint first

**Q4.** Which statement about tokens and counting is correct?
- A. Use `tiktoken` to count Claude tokens accurately
- B. 1 token is always exactly one word
- C. Token counts are model-specific; use the Token Counting API (`count_tokens`)
- D. Only output tokens are counted toward the context window

**Q5.** A request to Opus 5.5 returns `stop_reason: "max_tokens"`. What happened, and the fix?
- A. The context window was exceeded; switch models
- B. The output hit the `max_tokens` cap and was truncated; raise `max_tokens` (and stream if large)
- C. The input was too long; enable prompt caching
- D. A safety refusal occurred; rephrase the prompt

**Q6.** A task sends a 100,000-token document as input and asks for a 200-token answer.
Which is true about the cost profile?
- A. Output cost dominates because output tokens are ~5× the input rate
- B. Input cost dominates because there are vastly more input tokens, despite the higher output rate
- C. Input and output cost the same per token
- D. The document must be chunked or it will error on any model

---

## Answer key (don't peek first)

<details>
<summary>Reveal answers + rationale</summary>

- **Q1 → B.** The API is stateless; you resend the whole history each turn, so input
  tokens grow. (A/C/D describe billing that doesn't exist.)
- **Q2 → C.** Haiku = cheapest/fastest for trivial classification; Batch API = 50% off and
  fine when latency doesn't matter. B omits the batch discount and uses a pricier model;
  A/D over-spend on capability.
- **Q3 → B.** Caching is a prefix match; any byte change before the breakpoint invalidates
  the cache. A volatile timestamp/UUID in the prefix is the classic silent killer.
- **Q4 → C.** Counts are model-specific; use `count_tokens`. tiktoken is OpenAI's and
  undercounts Claude; a token ≠ a word; context window counts input **and** output.
- **Q5 → B.** `max_tokens` caps output; hitting it truncates. Raise it (stream for large
  outputs to avoid HTTP timeouts). Context-window overflow is a different error. Note that
  Opus 5.5 always thinks, and thinking tokens count toward `max_tokens` — a low cap can be
  consumed before the visible answer is finished.
- **Q6 → B.** 100,000 input × $x vs 200 output × 5$x → input still dominates
  (100,000 ≫ 200×5 = 1,000 token-equivalents). Output rate is higher *per token*, but
  there are far fewer output tokens here.

**Score:** __ / 6  → log in `/PROGRESS.md`.
</details>
