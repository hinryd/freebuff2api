# freebuff2api Deno Adapter

This is a Deno-based OpenAI-compatible adapter for Codebuff/Freebuff. It is a lightweight mimic of the Freebuff client flow: it obtains/reuses a Freebuff session, starts Codebuff agent-run bookkeeping, forwards an OpenAI-style chat completion request upstream, and converts the upstream SSE response back into OpenAI-compatible output.

## What it mimics

For each chat workflow, the adapter mimics the parts of the Freebuff/Codebuff client that the upstream API expects:

- Freebuff session creation/reuse via `/api/v1/freebuff/session`
- session-level ad/streak unlock calls during session creation only
- Codebuff agent-run `START`, step recording, and `FINISH`
- `codebuff_metadata` in chat payloads, including `freebuff_instance_id`, `run_id`, `client_id`, and `cost_mode: free`
- OpenAI-compatible streaming and non-streaming `/v1/chat/completions`

It does **not** run Codebuff's real local agent runtime, file tools, terminal tools, or browser tools. OpenAI tool calls are simply forwarded/accumulated as model output for your client to execute.

## Current workaround behavior

The upstream Freebuff flow has several moving pieces. This adapter intentionally keeps only the parts needed for private OpenAI-compatible usage:

- Ads are called only when creating/recovering a Freebuff session.
- Session ad calls are message-free; user messages are not sent to the ad endpoint.
- No ad call is made before every chat turn.
- Context-pruner child runs are disabled to reduce pre-chat overhead.
- A Freebuff session is kept warm for tool-call continuation turns, then deleted after 5 minutes idle.
- Abort/error deletes the upstream session immediately.

## Agent-run lifecycle

The adapter keeps one Codebuff agent run across an OpenAI tool-call loop:

1. First assistant turn starts an agent run and sends chat with that `run_id`.
2. If the model returns `tool_calls`, the run stays open.
3. Tool-result turns reuse the pending run instead of starting a new one.
4. When the model returns a final answer, the run step is recorded and the run is finished.
5. If the loop is abandoned, idle cleanup finalizes the pending run best-effort before deleting the session.

This reduces `/api/v1/agent-runs` churn for tool-heavy clients while still providing the upstream chat endpoint with a real `run_id`.

## Endpoints

- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`

If `FREEBUFF_API_KEY` is set, all endpoints require:

```http
Authorization: Bearer <FREEBUFF_API_KEY>
```

## Environment variables

Required:

```env
FREEBUFF_TOKEN=your-codebuff-or-freebuff-bearer-token
FREEBUFF_API_KEY=your-local-openai-compatible-api-key
```

Common optional settings:

```env
FREEBUFF_PORT=4528
FREEBUFF_HOST=0.0.0.0
FREEBUFF_API_BASE_URL=https://www.codebuff.com
ZEROCLICK_BASE_URL=https://zeroclick.dev
FREEBUFF_AD_PROVIDERS=gravity,carbon
FREEBUFF_TIMEOUT=60
FREEBUFF_DEBUG=false
FREEBUFF_LOG_BODY_CHARS=2000
FREEBUFF_TIMEZONE=Asia/Shanghai
FREEBUFF_LOCALE=zh-CN
FREEBUFF_OS=windows
```

Multiple upstream accounts can be configured with comma-separated tokens:

```env
FREEBUFF_TOKEN=token-a,token-b,token-c
```

Concurrency is effectively one active chat per token. Extra requests wait for a token/account to become free.

## Run locally with Deno

```bash
deno run --allow-env --allow-net freebuff2api.deno.ts
```

## Run with Docker Compose

Create a `.env` containing at least:

```env
FREEBUFF_TOKEN=...
FREEBUFF_API_KEY=...
```

Then run:

```bash
docker compose up -d --build
```

Example request:

```bash
curl http://127.0.0.1:4528/v1/chat/completions \
  -H "Authorization: Bearer $FREEBUFF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-v4-flash",
    "messages": [{"role": "user", "content": "hello"}],
    "stream": false
  }'
```

## Notes and risks

This adapter depends on private/undocumented Codebuff/Freebuff API behavior and may break when upstream changes. It is intended for private experimentation only. Keep your upstream token and local API key secret, do not expose the service without authentication, and expect regional/session limits to apply.
