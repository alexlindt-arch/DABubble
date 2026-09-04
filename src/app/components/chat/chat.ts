import { afterRenderEffect, Component, ElementRef, input, signal, viewChild } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-chat',
  styleUrl: './chat.scss',
  templateUrl: './chat.html',
})
export class Chat {
  isSelfChat = input(false);
  draft = signal('');
  notes = signal<string[]>([]);
  emojiPickerOpen = signal(false);
  emojis = ['😀', '😊', '👍', '❤️', '🎉', '✅'];
  private editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private history = viewChild<ElementRef<HTMLElement>>('history');

  constructor() {
    afterRenderEffect(() => {
      if (this.isSelfChat()) this.editor()?.nativeElement.focus();
    });
    afterRenderEffect(() => {
      this.notes();
      const history = this.history()?.nativeElement;
      if (history) history.scrollTop = history.scrollHeight;
    });
  }

  sendNote(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    if (!text) return;
    // Local UI preview only; connect to the shared messages service later.
    this.notes.update(notes => [...notes, text]);
    this.draft.set('');
    this.emojiPickerOpen.set(false);
    this.editor()?.nativeElement.focus();
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendNote(event);
    }
  }

  insertText(text: string): void {
    const editor = this.editor()?.nativeElement;
    if (!editor) return;
    const start = editor.selectionStart;
    this.draft.set(this.draft().slice(0, start) + text + this.draft().slice(editor.selectionEnd));
    editor.value = this.draft();
    editor.focus();
    editor.setSelectionRange(start + text.length, start + text.length);
    this.emojiPickerOpen.set(false);
  }
}
