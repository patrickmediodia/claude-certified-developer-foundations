# Module 1 — MSO Foundations: Worked Examples

Concrete, exam-relevant examples. All use current models/API (Opus 5.5, Sonnet 5.5,
Haiku 5.5, Fable 5.1; adaptive thinking; `effort`; `output_config.format`).

---

## 1. Statelessness — why you resend history every turn

```python
import anthropic
client = anthropic.Anthropic()

# The API keeps NO memory. To continue a conversation you resend everything.
messages = [
    {"role": "user", "content": "My name is Pat."},
    {"role": "assistant", "content": "Nice to meet you, Pat."},
    {"role": "user", "content": "What's my name?"},   # only works because turns 1-2 are resent
]
resp = client.messages.create(
    model="claude-sonnet-5-5", max_tokens=1024, messages=messages,
)
```
At turn 10 you resend turns 1–9 → input tokens (and cost) grow every turn.

---

## 2. Cost arithmetic

```
cost = input_tokens × input_rate + output_tokens × output_rate   (rates per 1M)
```

| Scenario | Model | Input | Output | Cost |
|---|---|---|---|---|
| Summarize 50k-token doc, 500-token summary | Sonnet 5.5 | 50,000 | 500 | 50k×$2/1M + 500×$10/1M = **$0.105** |
| Same, but on Opus 5.5 | Opus 5.5 | 50,000 | 500 | 50k×$4/1M + 500×$20/1M = **$0.21** |
| Classify 1 ticket (one word out) | Haiku 5.5 | 300 | 5 | 300×$0.10/1M + 5×$0.50/1M ≈ **$0.0000325** |

Note how **output rate dominates** when output is long, and how model choice swings cost.

---

## 3. Count tokens before sending (estimate cost)

```python
# Model-specific. Do NOT use tiktoken for Claude.
count = client.messages.count_tokens(
    model="claude-opus-5-5",
    messages=[{"role": "user", "content": open("CLAUDE.md").read()}],
)
print(count.input_tokens)
est_input_cost = count.input_tokens * 4 / 1_000_000   # $4/1M for Opus 5.5 input
```

---

## 4. Prompt caching — cache a large stable prefix

```python
resp = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    system=[{
        "type": "text",
        "text": LARGE_STABLE_DOCUMENT,          # same bytes every request
        "cache_control": {"type": "ephemeral"},  # 5-min TTL
    }],
    messages=[{"role": "user", "content": "Question that varies per request"}],
)
print(resp.usage.cache_creation_input_tokens)  # >0 on first call (cache write ~1.25x)
print(resp.usage.cache_read_input_tokens)      # >0 on repeats (cache read ~0.1x; 0.05x on Sonnet 5.5 / Opus 5.5)
```

**Silent cache-killer (exam trap):**
```python
# BAD — datetime.now() changes the prefix every request → cache_read_input_tokens is ALWAYS 0
system = [{"type": "text",
           "text": f"Today is {datetime.now()}.\n\n{LARGE_STABLE_DOCUMENT}",
           "cache_control": {"type": "ephemeral"}}]
# FIX: move volatile content AFTER the cache breakpoint (into messages), keep prefix frozen.
```

---

## 5. Batch API — 50% off for non-latency-sensitive bulk work

```python
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

batch = client.messages.batches.create(requests=[
    Request(custom_id=f"ticket-{i}",
            params=MessageCreateParamsNonStreaming(
                model="claude-haiku-5-5", max_tokens=256,
                thinking={"type": "disabled"},  # Haiku 5.5 thinks by default; thinking tokens count toward max_tokens
                messages=[{"role": "user",
                           "content": f"Classify into [billing|bug|feature|praise|other]: {t}"}]))
    for i, t in enumerate(tickets)
])
# Poll batches.retrieve(batch.id) until processing_status == "ended";
# read results via batches.results(batch.id) — key by custom_id (any order), 50% cheaper.
```

---

## 6. Right-sizing — same task, three models

| Task | Right model | Why |
|---|---|---|
| Sentiment of a tweet | Haiku 5.5 | Trivial; speed + cost win |
| Draft + refactor a service in a large codebase | Opus 5.5 | Needs deep reasoning / long horizon |
| High-volume production summarization | Sonnet 5.5 | Strong quality at half Opus cost |
| Hardest multi-hour autonomous agent run | Fable 5.1 | Most capable; justify the premium |
