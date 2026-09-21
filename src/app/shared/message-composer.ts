import { computed, ElementRef, Signal, signal } from '@angular/core';
import { AppUser, Channel } from './models';
import {
  channelSuggestions,
  filterMentions,
  MentionKind,
  MentionSuggestion,
  mentionToken,
  readMentionContext,
  userSuggestions,
} from './mention';

/**
 * Draft text, emoji picker, and mention handling of a message editor.
 * Chat and thread share one implementation so both editors behave alike.
 */
export class MessageComposer {
  readonly draft = signal('');
  readonly emojiPickerOpen = signal(false);
  readonly mentionOpen = signal(false);
  readonly mentionIndex = signal(0);
  readonly suggestions = computed(() => filterMentions(this.mentionSource(), this.mentionQuery()));
  private readonly mentionKind = signal<MentionKind>('user');
  private readonly mentionQuery = signal('');
  private mentionStart = 0;

  constructor(
    private readonly users: Signal<AppUser[]>,
    private readonly channels: Signal<Channel[]>,
    private readonly editor: Signal<ElementRef<HTMLTextAreaElement> | undefined>,
  ) {}

  /** Returns the draft without surrounding whitespace. */
  text(): string {
    return this.draft().trim();
  }

  /** Clears the draft and closes the emoji picker. */
  clear(): void {
    this.draft.set('');
    this.emojiPickerOpen.set(false);
  }

  /** Clears the draft and closes every editor popup. */
  reset(): void {
    this.clear();
    this.closeMentions();
  }

  /** Moves the caret into the editor. */
  focus(): void {
    this.editorElement()?.focus();
  }

  /** Updates the draft and mention context from editor input. */
  onInput(editor: HTMLTextAreaElement): void {
    this.draft.set(editor.value);
    this.updateMentionContext(editor);
  }

  /** Inserts text at the current editor selection. */
  insert(text: string): void {
    const editor = this.editorElement();
    if (!editor) return;
    const start = editor.selectionStart;
    this.draft.set(this.draft().slice(0, start) + text + this.draft().slice(editor.selectionEnd));
    editor.value = this.draft();
    editor.focus();
    editor.setSelectionRange(start + text.length, start + text.length);
    this.updateMentionContext(editor);
    this.emojiPickerOpen.set(false);
  }

  /** Replaces the typed mention with the selected suggestion. */
  select(suggestion: MentionSuggestion): void {
    const editor = this.editorElement();
    if (!editor) return;
    const token = mentionToken(suggestion);
    this.draft.set(this.draft().slice(0, this.mentionStart) + token + this.draft().slice(editor.selectionStart));
    editor.value = this.draft();
    editor.focus();
    const position = this.mentionStart + token.length;
    editor.setSelectionRange(position, position);
    this.closeMentions();
  }

  /** Handles keyboard navigation in the mention dropdown. */
  handleKeydown(event: KeyboardEvent): boolean {
    const suggestions = this.suggestions();
    if (!this.mentionOpen() || !suggestions.length) return false;
    if (event.key === 'ArrowDown') return this.moveSelection(event, 1);
    if (event.key === 'ArrowUp') return this.moveSelection(event, -1);
    if (event.key === 'Escape') return this.closeFromKeyboard(event);
    if (event.key !== 'Enter') return false;
    event.preventDefault();
    this.select(suggestions[this.mentionIndex()]);
    return true;
  }

  /** Returns the editor element once it is rendered. */
  private editorElement(): HTMLTextAreaElement | undefined {
    return this.editor()?.nativeElement;
  }

  /** Returns the suggestions matching the active mention kind. */
  private mentionSource(): MentionSuggestion[] {
    return this.mentionKind() === 'user'
      ? userSuggestions(this.users())
      : channelSuggestions(this.channels());
  }

  /** Updates mention state from the editor caret position. */
  private updateMentionContext(editor: HTMLTextAreaElement): void {
    const context = readMentionContext(editor);
    if (!context) return this.closeMentions();
    this.mentionKind.set(context.kind);
    this.mentionQuery.set(context.query);
    this.mentionStart = context.start;
    this.mentionIndex.set(0);
    this.mentionOpen.set(true);
  }

  /** Moves the active mention selection. */
  private moveSelection(event: KeyboardEvent, step: number): boolean {
    event.preventDefault();
    const length = this.suggestions().length;
    this.mentionIndex.update(index => (index + step + length) % length);
    return true;
  }

  /** Closes the mention dropdown from the keyboard. */
  private closeFromKeyboard(event: KeyboardEvent): boolean {
    event.preventDefault();
    this.closeMentions();
    return true;
  }

  /** Closes and resets the mention dropdown. */
  private closeMentions(): void {
    this.mentionOpen.set(false);
    this.mentionIndex.set(0);
  }
}
