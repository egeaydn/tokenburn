import { createReadStream } from "node:fs";
import { Decompress } from "fzstd";

async function* plainChunks(file: string): AsyncGenerator<Uint8Array> {
  yield* createReadStream(file);
}

/** Streams a zstd file decompressed, without holding the whole file in memory. */
async function* zstdChunks(file: string): AsyncGenerator<Uint8Array> {
  const out: Uint8Array[] = [];
  const decoder = new Decompress((chunk) => {
    out.push(chunk);
  });
  for await (const chunk of createReadStream(file)) {
    decoder.push(chunk);
    while (out.length > 0) yield out.shift() as Uint8Array;
  }
  decoder.push(new Uint8Array(0), true);
  while (out.length > 0) yield out.shift() as Uint8Array;
}

/** Splits a byte stream into UTF-8 lines. Memory use is bounded by the longest line. */
async function* splitLines(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  let pending: Uint8Array[] = [];
  for await (const chunk of chunks) {
    let start = 0;
    while (true) {
      const nl = chunk.indexOf(10, start);
      if (nl === -1) {
        pending.push(chunk.subarray(start));
        break;
      }
      pending.push(chunk.subarray(start, nl));
      yield Buffer.concat(pending).toString("utf8");
      pending = [];
      start = nl + 1;
    }
  }
  if (pending.length > 0) {
    const last = Buffer.concat(pending).toString("utf8");
    if (last.trim() !== "") yield last;
  }
}

/** Reads a `.jsonl` or `.jsonl.zst` file line by line. */
export function readLines(file: string): AsyncGenerator<string> {
  return splitLines(file.endsWith(".zst") ? zstdChunks(file) : plainChunks(file));
}
