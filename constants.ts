import type { FreebuffModel } from "#types";

export const CODEBUFF_ACCEPT_ENCODING = "gzip, deflate";
export const CODEBUFF_JSON_USER_AGENT = "Bun/1.3.11";
export const FREEBUFF_CLI_USER_AGENT = "Freebuff-CLI/0.0.105";
export const CHAT_COMPLETIONS_USER_AGENT =
  "ai-sdk/openai-compatible/0.0.0-test/codebuff ai-sdk/provider-utils/3.0.20 runtime/browser";
export const HAR_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const GEMINI_THINKER_AGENT_ID = "thinker-with-files-gemini";
export const GEMINI_THINKER_PARENT_AGENT_ID = "base2-free-kimi";
export const GEMINI_THINKER_PARENT_MODEL_ID = "moonshotai/kimi-k2.6";

export const FREEBUFF_MODELS: FreebuffModel[] = [
  {
    id: "deepseek/deepseek-v4-flash",
    agentId: "base2-free-deepseek-flash",
    ownedBy: "freebuff",
  },
  {
    id: "deepseek/deepseek-v4-pro",
    agentId: "base2-free-deepseek",
    ownedBy: "freebuff",
  },
  {
    id: "moonshotai/kimi-k2.6",
    agentId: "base2-free-kimi",
    ownedBy: "freebuff",
  },
  { id: "minimax/minimax-m2.7", agentId: "base2-free", ownedBy: "freebuff" },
  {
    id: "minimax/minimax-m3",
    agentId: "base2-free-minimax-m3",
    ownedBy: "freebuff",
  },
  { id: "mimo/mimo-v2.5", agentId: "base2-free-mimo", ownedBy: "freebuff" },
  {
    id: "mimo/mimo-v2.5-pro",
    agentId: "base2-free-mimo-pro",
    ownedBy: "freebuff",
  },
];

export const DEFAULT_MODEL = FREEBUFF_MODELS[0];
export const GEMINI_FLASH_LITE_SESSION_MODEL_ID = DEFAULT_MODEL.id;

export const GEMINI_FREE_MODELS: FreebuffModel[] = [
  {
    id: "google/gemini-2.5-flash-lite",
    agentId: "file-picker",
    ownedBy: "google",
    sessionModelId: GEMINI_FLASH_LITE_SESSION_MODEL_ID,
    parentAgentId: DEFAULT_MODEL.agentId,
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    agentId: "file-picker-max",
    ownedBy: "google",
    sessionModelId: GEMINI_FLASH_LITE_SESSION_MODEL_ID,
    parentAgentId: DEFAULT_MODEL.agentId,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    agentId: GEMINI_THINKER_AGENT_ID,
    ownedBy: "google",
    sessionModelId: GEMINI_THINKER_PARENT_MODEL_ID,
    parentAgentId: GEMINI_THINKER_PARENT_AGENT_ID,
  },
];

export const ALL_MODELS = [...FREEBUFF_MODELS, ...GEMINI_FREE_MODELS];

export const UPSTREAM_CHAT_KEYS = new Set([
  "frequency_penalty",
  "logit_bias",
  "logprobs",
  "max_completion_tokens",
  "max_tokens",
  "metadata",
  "modalities",
  "parallel_tool_calls",
  "presence_penalty",
  "reasoning_effort",
  "response_format",
  "seed",
  "service_tier",
  "stop",
  "store",
  "stream_options",
  "temperature",
  "tool_choice",
  "tools",
  "top_logprobs",
  "top_p",
  "user",
]);
