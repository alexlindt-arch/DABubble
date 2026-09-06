import { afterRenderEffect, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { avatarUrl } from '../../shared/avatar-url';
import { EMOJIS } from '../../shared/emojis';

export interface ThreadReaction {
  emoji: string;
  count: number;
  active: boolean;
}

export interface ThreadMessage {
  author: string;
  avatar: string;
  time: string;
  text: string;
  own: boolean;
  reactions: ThreadReaction[];
}

/** Seeded conversation from the design; replace once the message service exists. */
const SEED_MESSAGES: ThreadMessage[] = [
  {
    author: 'Noah Braun',
    avatar: 'Property 1=Noah Braun.png',
    time: '14:25 Uhr',
    text: 'Welche Version ist aktuell von Angular?',
    own: false,
    reactions: [],
  },
  {
    author: 'Sofia Müller',
    avatar: 'Property 1=Sofia Müller.png',
    time: '14:30 Uhr',
    text:
      'Ich habe die gleiche Frage. Ich habe gegoogelt und es scheint, dass die aktuelle Version ' +
      'Angular 13 ist. Vielleicht weiß Frederik, ob es wahr ist.',
    own: false,
    reactions: [{ emoji: '🤔', count: 1, active: false }],
  },
  {
    author: 'Frederik Beck',
    avatar: 'Property 1=Frederik Beck.png',
    time: '15:06 Uhr',
    text: 'Ja das ist es.',
    own: true,
    reactions: [{ emoji: '👍', count: 1, active: false }],
  },
];

@Component({
  imports: [],
  selector: 'app-thread',
  styleUrl: './thread.scss',
  templateUrl: './thread.html',
})
export class Thread {
  channelName = input('Entwicklerteam');
  userName = input('Gast');
  userAvatar = input('Property 1=Frederik Beck.png');
  closed = output<void>();

  readonly messages = signal<ThreadMessage[]>(SEED_MESSAGES.map(message => ({ ...message })));
  readonly draft = signal('');
  readonly emojiPickerOpen = signal(false);
  readonly reactionPickerFor = signal<number | null>(null);
  readonly emojis = EMOJIS;

  private editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private history = viewChild<ElementRef<HTMLElement>>('history');

  constructor() {
    afterRenderEffect(() => {
      this.messages();
      const history = this.history()?.nativeElement;
      if (history) history.scrollTop = history.scrollHeight;
    });
  }

  get replyLabel(): string {
    const replies = this.messages().length - 1;
    return `${replies} ${replies === 1 ? 'Antwort' : 'Antworten'}`;
  }

  avatarSrc(avatar: string): string {
    return avatarUrl(avatar);
  }

  toggleReactionPicker(index: number): void {
    this.reactionPickerFor.set(this.reactionPickerFor() === index ? null : index);
  }

  toggleReaction(message: ThreadMessage, emoji: string): void {
    const existing = message.reactions.find(reaction => reaction.emoji === emoji);
    if (existing) this.flipReaction(message, existing);
    else message.reactions = [...message.reactions, { emoji, count: 1, active: true }];
    this.reactionPickerFor.set(null);
    this.messages.update(messages => [...messages]);
  }

  sendReply(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    if (!text) return;
    this.messages.update(messages => [...messages, this.buildReply(text)]);
    this.draft.set('');
    this.emojiPickerOpen.set(false);
    this.editor()?.nativeElement.focus();
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendReply(event);
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

  private flipReaction(message: ThreadMessage, reaction: ThreadReaction): void {
    reaction.active = !reaction.active;
    reaction.count += reaction.active ? 1 : -1;
    if (reaction.count === 0) {
      message.reactions = message.reactions.filter(entry => entry !== reaction);
    }
  }

  private buildReply(text: string): ThreadMessage {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return {
      author: this.userName(),
      avatar: this.userAvatar(),
      time: `${hours}:${minutes} Uhr`,
      text,
      own: true,
      reactions: [],
    };
  }
}
