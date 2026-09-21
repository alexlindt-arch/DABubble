import { signal } from '@angular/core';
import { Message } from './models';
import { hasReacted, MessageReaction, reactionsOf, reactionVerb } from './reactions';

/** Width of the reaction picker, used to keep it inside the chat area. */
const PICKER_WIDTH = 232;
/** Distance the picker keeps to the chat edges and to its trigger. */
const EDGE_GAP = 12;

export interface PickerPosition {
  top: number;
  left: number;
}

/**
 * Reaction state of a message list: which picker is open, where it sits, and
 * the read helpers that the chat and thread templates need. Both panels share
 * it so reactions behave the same everywhere.
 */
export class MessageReactions {
  readonly openFor = signal<string | null>(null);
  readonly position = signal<PickerPosition>({ top: 0, left: 0 });

  constructor(private readonly currentUid: () => string | null) {}

  /** Returns the reactions of a message that still have at least one user. */
  of(message: Message): MessageReaction[] {
    return reactionsOf(message);
  }

  /** Checks whether the current user is among the reacting users. */
  has(uids: string[]): boolean {
    return hasReacted(uids, this.currentUid());
  }

  /** Returns the verb matching the number of reacting users. */
  verb(uids: string[]): string {
    return reactionVerb(uids);
  }

  /** Reports whether the picker of the given message is open. */
  isOpen(messageId: string): boolean {
    return this.openFor() === messageId;
  }

  /** Closes the picker. */
  close(): void {
    this.openFor.set(null);
  }

  /** Opens or closes the picker of a message without moving it. */
  toggle(messageId: string): void {
    this.openFor.update(openId => openId === messageId ? null : messageId);
  }

  /** Opens or closes the picker of a message and places it below its trigger. */
  toggleAt(messageId: string, trigger: HTMLElement): void {
    if (this.isOpen(messageId)) return this.close();
    this.openFor.set(messageId);
    this.position.set(this.positionBelow(trigger));
  }

  /** Places the picker below its trigger and inside the surrounding chat area. */
  private positionBelow(button: HTMLElement): PickerPosition {
    const rect = button.getBoundingClientRect();
    const opensFromRight = button.closest('.channel-message')?.classList.contains('own') ?? false;
    const preferred = opensFromRight ? rect.right - PICKER_WIDTH : rect.left;
    // Keep the picker inside the actual chat area (not just inside the browser
    // viewport, which can be wider when DevTools or a side panel is open).
    const bounds = button.closest<HTMLElement>('.chat-body, .chat-content')?.getBoundingClientRect();
    const minLeft = (bounds?.left ?? 0) + EDGE_GAP;
    const maxLeft = Math.max(minLeft, (bounds?.right ?? window.innerWidth) - PICKER_WIDTH - EDGE_GAP);
    return { top: rect.bottom + 8, left: Math.max(minLeft, Math.min(preferred, maxLeft)) };
  }
}
