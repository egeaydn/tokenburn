/** Common record every provider adapter emits. One record = one billed model response. */
export interface UsageRecord {
  timestamp: Date;
  provider: string;
  model: string;
  /** Absolute project path (cwd of the session). */
  project: string;
  sessionId: string;
  /** Uncached input tokens. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface Provider {
  name: string;
  /** Streams usage records; must skip malformed lines instead of throwing. */
  read(): AsyncIterable<UsageRecord>;
}
