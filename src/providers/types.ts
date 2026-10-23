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
  /** Includes reasoning/thinking tokens. */
  outputTokens: number;
  cacheReadTokens: number;
  /** Cache writes with the default 5 minute TTL. */
  cacheWrite5mTokens: number;
  /** Cache writes with the 1 hour TTL (priced higher). */
  cacheWrite1hTokens: number;
}

export interface Provider {
  name: string;
  /** Streams usage records; must skip malformed lines instead of throwing. */
  read(): AsyncIterable<UsageRecord>;
}
