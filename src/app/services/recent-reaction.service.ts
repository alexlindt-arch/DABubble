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

  /** Reads the stored quick reactions, falling back to the defaults. */
  private load(): string[] {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(stored)) return [...DEFAULT_REACTIONS];
      return padWithDefaults(stored.filter(isEmoji));
    } catch {
      return [...DEFAULT_REACTIONS];
    }
  }
}

/** Checks whether a stored entry is a usable emoji. */
function isEmoji(item: unknown): item is string {
  return typeof item === 'string' && item.length > 0;
}

/** Fills the two quick-reaction slots with defaults where needed. */
function padWithDefaults(stored: string[]): string[] {
  const unique = [...new Set(stored)].slice(0, 2);
  for (const fallback of DEFAULT_REACTIONS) {
    if (unique.length === 2) break;
    if (!unique.includes(fallback)) unique.push(fallback);
  }
  return unique;
}
