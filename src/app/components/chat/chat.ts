import {
  afterRenderEffect,
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AppUser, Channel, Message } from '../../models';
import { avatarUrl } from '../../shared/avatar-url';
import { AuthService } from '../../services/auth.service';
import { MessageService } from '../../services/message.service';

@Component({
  imports: [],
  selector: 'app-chat',
  styleUrl: './chat.scss',
  templateUrl: './chat.html',
})
export class Chat {
  isSelfChat = input(false);
  userName = input('Gast');
  userAvatarUrl = input('/assets/img/avatar/Property 1=Frederik Beck.png');
  directUser = input<AppUser | null>(null);
  channel = input<Channel | null>(null);
  users = input<AppUser[]>([]);
  profileRequested = output<void>();
  messages = signal<Message[]>([]);
  profileDialogOpen = signal(false);
  draft = signal('');
  notes = signal<string[]>([]);
  emojiPickerOpen = signal(false);
  emojis = [
    '😂', '❤️', '🤣', '👍', '😭',
    '💀', '🔥', '🥰', '😊', '🙏',
    '✨', '🎉', '🫡', '🤔', '👀',
    '✅', '😍', '😅', '💯', '😎',
  ];
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private history = viewChild<ElementRef<HTMLElement>>('history');

  constructor() {
    afterRenderEffect(() => {
      if (this.isSelfChat()) this.editor()?.nativeElement.focus();
    });
    afterRenderEffect(() => {
      this.notes();
      this.messages();
      const history = this.history()?.nativeElement;
      if (history) history.scrollTop = history.scrollHeight;
    });
    effect(onCleanup => this.watchChannelMessages(onCleanup));
  }

  private watchChannelMessages(onCleanup: (cleanup: () => void) => void): void {
    const channelId = this.channel()?.id;
    this.messages.set([]);
    if (!channelId) return;
    const stop = this.messageService.watchMessages(channelId, messages => this.messages.set(messages));
    onCleanup(() => stop());
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

  sendChannelMessage(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    const channelId = this.channel()?.id;
    const senderId = this.authService.currentUserId;
    if (!text || !channelId || !senderId) return;
    this.messageService
      .sendMessage(channelId, text, senderId)
      .catch(error => console.error('Nachricht konnte nicht gesendet werden:', error));
    this.draft.set('');
    this.emojiPickerOpen.set(false);
  }

  onChannelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendChannelMessage(event);
    }
  }

  authorName(message: Message): string {
    return this.userById(message.senderId)?.name ?? 'Unbekannt';
  }

  authorAvatar(message: Message): string {
    return avatarUrl(this.userById(message.senderId)?.avatar);
  }

  isOwnMessage(message: Message): boolean {
    return message.senderId === this.authService.currentUserId;
  }

  messageTime(message: Message): string {
    const date = message.timestamp?.toDate?.();
    if (!date) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} Uhr`;
  }

  private userById(uid: string): AppUser | undefined {
    return this.users().find(user => user.uid === uid);
  }

  directUserAvatar(): string { return avatarUrl(this.directUser()?.avatar); }
  openDirectProfile(): void { if (this.directUser()) this.profileDialogOpen.set(true); }
  closeDirectProfile(): void { this.profileDialogOpen.set(false); }

  @HostListener('document:keydown.escape')
  closeProfileWithEscape(): void { this.closeDirectProfile(); }
}
