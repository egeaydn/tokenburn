/**
 * Shortest trailing part of each path that is still unique among all of them:
 * `/a/web` and `/b/web` stay apart, while a lone `/a/api` is just `api`.
 */
export function shortenPaths(paths: string[]): Map<string, string> {
  const parts = new Map(paths.map((p) => [p, p.split("/").filter(Boolean)]));
  const out = new Map<string, string>();
  for (const [path, segs] of parts) {
    let n = 1;
    const suffix = (s: string[], k: number) => s.slice(-k).join("/");
    while (
      n < segs.length &&
      [...parts].some(([other, o]) => other !== path && suffix(o, n) === suffix(segs, n))
    ) {
      n++;
    }
    out.set(path, suffix(segs, n) || path);
  }
  return out;
}
