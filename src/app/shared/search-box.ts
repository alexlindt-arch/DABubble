import { signal } from '@angular/core';

/** Query, visibility, and keyboard highlight of the workspace search box. */
export class SearchBox {
  readonly query = signal('');
  readonly open = signal(false);
  readonly index = signal(0);

  /** Takes a newly typed query and shows the result list. */
  type(value: string): void {
    this.query.set(value);
    this.index.set(0);
    this.open.set(true);
  }

  /** Hides the result list. */
  close(): void {
    this.open.set(false);
    this.index.set(0);
  }

  /** Clears the query and hides the result list. */
  clear(): void {
    this.query.set('');
    this.close();
  }

  /** Moves the highlight and reports whether the entry should be opened. */
  handleKeydown(event: KeyboardEvent, count: number): boolean {
    if (event.key === 'ArrowDown') this.index.update(index => (index + 1) % count);
    else if (event.key === 'ArrowUp') this.index.update(index => (index - 1 + count) % count);
    else if (event.key === 'Escape') return this.close(), false;
    else if (event.key !== 'Enter') return false;
    event.preventDefault();
    return true;
  }
}
