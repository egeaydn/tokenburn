import { claudeCodeProvider } from "./claude-code.js";
import { codexProvider } from "./codex.js";
import type { Provider } from "./types.js";

const factories: Record<string, () => Provider> = {
  "claude-code": () => claudeCodeProvider(),
  codex: () => codexProvider(),
};

export const providerNames = Object.keys(factories);

/** Builds the requested providers; throws on an unknown name. No names means all of them. */
export function selectProviders(names?: string[]): Provider[] {
  const wanted = names && names.length > 0 ? names : providerNames;
  return wanted.map((name) => {
    const make = factories[name];
    if (!make)
      throw new Error(`Unknown provider "${name}". Available: ${providerNames.join(", ")}`);
    return make();
  });
}
