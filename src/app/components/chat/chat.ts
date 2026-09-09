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
  styleUrls: ['./chat.scss', './chat-channel.scss'],
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
  addPeopleRequested = output<void>();
  membersRequested = output<DOMRect>();
  threadRequested = output<void>();
  messages = signal<Message[]>([]);
  directMessages = signal<Message[]>([]);
  reactionPickerFor = signal<string | null>(null);
  reactionPickerPosition = signal({ top: 0, left: 0 });
  editingMessageId = signal<string | null>(null);
  editingText = signal('');
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
      this.directMessages();
      const history = this.history()?.nativeElement;
      if (history) history.scrollTop = history.scrollHeight;
    });
    effect(onCleanup => this.watchChannelMessages(onCleanup));
    effect(onCleanup => this.watchDirectMessages(onCleanup));
  }

  private watchChannelMessages(onCleanup: (cleanup: () => void) => void): void {
    const channelId = this.channel()?.id;
    this.messages.set([]);
    if (!channelId) return;
    const stop = this.messageService.watchMessages(channelId, messages => this.messages.set(messages));
    onCleanup(() => stop());
  }

  private watchDirectMessages(onCleanup: (cleanup: () => void) => void): void {
    const ownUid = this.authService.currentUserId;
    const otherUid = this.directUser()?.uid;
    this.directMessages.set([]);
    this.editingMessageId.set(null);
    if (!ownUid || !otherUid || ownUid === otherUid) return;
    const stop = this.messageService.watchDirectMessages(ownUid, otherUid, messages => {
      this.directMessages.set(messages);
      if (messages.length) void this.messageService.markDirectConversationRead(ownUid, otherUid);
    });
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

  sendDirectMessage(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    const senderId = this.authService.currentUserId;
    const recipientId = this.directUser()?.uid;
    if (!text || !senderId || !recipientId) return;
    this.messageService
      .sendDirectMessage(senderId, recipientId, text)
      .catch(error => console.error('Direktnachricht konnte nicht gesendet werden:', error));
    this.draft.set('');
    this.emojiPickerOpen.set(false);
  }

  onChannelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendChannelMessage(event);
    }
  }

  onDirectKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendDirectMessage(event);
    }
  }

  authorName(message: Message): string {
    return this.isOwnMessage(message)
      ? `${this.userName()} (Du)`
      : this.userById(message.senderId)?.name ?? message.senderId;
  }

  showDateDivider(index: number): boolean {
    if (index === 0) return true;
    return this.messageDay(this.messages()[index]) !== this.messageDay(this.messages()[index - 1]);
  }

  showDirectDateDivider(index: number): boolean {
    if (index === 0) return true;
    const messages = this.directMessages();
    return this.messageDay(messages[index]) !== this.messageDay(messages[index - 1]);
  }

  dateLabel(message: Message): string {
    const date = message.timestamp?.toDate?.();
    if (!date) return '';
    if (date.toDateString() === new Date().toDateString()) return 'Heute';
    return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  private messageDay(message: Message): string {
    return message.timestamp?.toDate?.()?.toDateString() ?? '';
  }

  authorAvatar(message: Message): string {
    return this.isOwnMessage(message)
      ? this.userAvatarUrl()
      : avatarUrl(this.userById(message.senderId)?.avatar);
  }

  isOwnMessage(message: Message): boolean {
    return message.senderId === this.authService.currentUserId;
  }

  messageTime(message: Message): string {
    const date = message.timestamp?.toDate?.();
    if (!date) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} Uhr`;
  }

  openMembers(event: MouseEvent): void {
    const button = event.currentTarget as HTMLElement;
    this.membersRequested.emit(button.getBoundingClientRect());
  }

  memberAvatar(member: AppUser): string {
    return avatarUrl(member.avatar);
  }

  memberCount(): number {
    return this.channel()?.members.length ?? 0;
  }

  visibleMembers(): AppUser[] {
    const members = this.channel()?.members ?? [];
    return this.users().filter(user => members.includes(user.uid)).slice(0, 3);
  }

  reactionsOf(message: Message): { emoji: string; uids: string[] }[] {
    return Object.entries(message.reactions ?? {})
      .filter(([, uids]) => uids.length > 0)
      .map(([emoji, uids]) => ({ emoji, uids }));
  }

  hasReacted(uids: string[]): boolean {
    const uid = this.authService.currentUserId;
    return !!uid && uids.includes(uid);
  }

  reactionTitle(uids: string[]): string {
    return uids.map(uid => this.userById(uid)?.name ?? uid).join(', ');
  }

  toggleReaction(message: Message, emoji: string): void {
    const channelId = this.channel()?.id;
    const uid = this.authService.currentUserId;
    this.reactionPickerFor.set(null);
    if (!channelId || !uid) return;
    this.messageService
      .toggleReaction(channelId, message, emoji, uid)
      .catch(error => console.error('Reaktion konnte nicht gespeichert werden:', error));
  }

  toggleDirectReaction(message: Message, emoji: string): void {
    const ownUid = this.authService.currentUserId;
    const otherUid = this.directUser()?.uid;
    this.reactionPickerFor.set(null);
    if (!ownUid || !otherUid) return;
    this.messageService
      .toggleDirectReaction(ownUid, otherUid, message, emoji, ownUid)
      .catch(error => console.error('Reaktion konnte nicht gespeichert werden:', error));
  }

  toggleReactionPicker(messageId: string, event: MouseEvent): void {
    if (this.reactionPickerFor() === messageId) return this.reactionPickerFor.set(null);
    this.reactionPickerFor.set(messageId);
    this.setReactionPickerPosition(event.currentTarget as HTMLElement);
  }

  private setReactionPickerPosition(button: HTMLElement): void {
    const rect = button.getBoundingClientRect();
    const left = Math.max(12, Math.min(rect.right - 232, window.innerWidth - 244));
    this.reactionPickerPosition.set({ top: rect.bottom + 8, left });
  }

  replyLabel(count: number): string {
    return `${count} ${count === 1 ? 'Antwort' : 'Antworten'}`;
  }

  isLastOwnDirectMessage(message: Message): boolean {
    const ownUid = this.authService.currentUserId;
    if (!ownUid || message.senderId !== ownUid) return false;
    const ownMessages = this.directMessages().filter(item => item.senderId === ownUid);
    return ownMessages.at(-1)?.id === message.id;
  }

  startEditingDirectMessage(message: Message): void {
    if (!this.isLastOwnDirectMessage(message)) return;
    this.editingMessageId.set(message.id);
    this.editingText.set(message.text);
    this.reactionPickerFor.set(null);
  }

  cancelEditingDirectMessage(): void {
    this.editingMessageId.set(null);
    this.editingText.set('');
  }

  saveDirectMessage(message: Message): void {
    const ownUid = this.authService.currentUserId;
    const otherUid = this.directUser()?.uid;
    const text = this.editingText().trim();
    if (!ownUid || !otherUid || !text || !this.isLastOwnDirectMessage(message)) return;
    this.messageService
      .editDirectMessage(ownUid, otherUid, message.id, text)
      .catch(error => console.error('Direktnachricht konnte nicht bearbeitet werden:', error));
    this.cancelEditingDirectMessage();
  }

  private userById(uid: string): AppUser | undefined {
    return this.users().find(user => user.uid === uid);
  }

  directUserAvatar(): string { return avatarUrl(this.directUser()?.avatar); }
  openDirectProfile(): void { if (this.directUser()) this.profileDialogOpen.set(true); }
  closeDirectProfile(): void { this.profileDialogOpen.set(false); }

  @HostListener('document:keydown.escape')
  closeProfileWithEscape(): void { this.closeDirectProfile(); }

  @HostListener('document:click', ['$event'])
  closeEmojiPickersOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const selector = '.emoji-picker, .channel-reaction-picker, .composer-button, .channel-hover-button';
    if (target.closest(selector)) return;
    this.emojiPickerOpen.set(false);
    this.reactionPickerFor.set(null);
  }
}
