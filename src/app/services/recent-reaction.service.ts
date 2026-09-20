import { Injectable, signal } from '@angular/core';

const DEFAULT_REACTIONS = ['✅', '👍'];
const STORAGE_KEY = 'dabubble-recent-reactions';

@Injectable({ providedIn: 'root' })
/** Provides recentreaction data and operations. */
export class RecentReactionService {
  readonly reactions = signal<string[]>(this.load());

  /** Handles record. */
  record(emoji: string): void {
    const next = [emoji, ...this.reactions().filter(item => item !== emoji)].slice(0, 2);
    for (const fallback of DEFAULT_REACTIONS) {
      if (next.length === 2) break;
      if (!next.includes(fallback)) next.push(fallback);
    }
    this.reactions.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The quick reactions still work when browser storage is unavailable.
    }
  }

  /** Handles load. */
  private load(): string[] {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(stored)) return [...DEFAULT_REACTIONS];
      const valid = stored.filter((item): item is string => typeof item === 'string' && item.length > 0);
      const unique = [...new Set(valid)].slice(0, 2);
      for (const fallback of DEFAULT_REACTIONS) {
        if (unique.length === 2) break;
        if (!unique.includes(fallback)) unique.push(fallback);
      }
      return unique;
    } catch {
      return [...DEFAULT_REACTIONS];
    }
  }
}
