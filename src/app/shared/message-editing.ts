import { signal } from '@angular/core';
import { Message } from './models';

/**
 * Tracks which message is currently edited and which edit menu is open.
 * Chat and thread share it so both editors keep the same state handling.
 */
export class MessageEditing {
  readonly messageId = signal<string | null>(null);
  readonly text = signal('');
  readonly menuFor = signal<string | null>(null);

  /** Returns the edited text without surrounding whitespace. */
  trimmedText(): string {
    return this.text().trim();
  }

  /** Opens or closes the edit menu of a message. */
  toggleMenu(messageId: string): void {
    this.menuFor.update(openId => openId === messageId ? null : messageId);
  }

  /** Loads a message into the edit buffer. */
  start(message: Message): void {
    this.messageId.set(message.id);
    this.text.set(message.text);
    this.menuFor.set(null);
  }

  /** Leaves the edit mode and clears the buffer. */
  cancel(): void {
    this.messageId.set(null);
    this.text.set('');
  }
}
