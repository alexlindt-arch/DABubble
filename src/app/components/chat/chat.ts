import {
  afterRenderEffect,
  Component,
  computed,
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
import { ProfileDialog } from '../profile-dialog/profile-dialog';

type MentionKind = 'user' | 'channel' | 'url';

interface MentionSuggestion {
  kind: MentionKind;
  label: string;
  user?: AppUser;
  channel?: Channel;
}

interface MessagePart extends MentionSuggestion {
  text: string;
  url?: string;
}

@Component({
  imports: [ProfileDialog],
  selector: 'app-chat',
  styleUrls: ['./chat.scss', './chat-channel.scss'],
  templateUrl: './chat.html',
})
export class Chat {
  isSelfChat = input(false);
  userName = input('Gast');
  userAvatarUrl = input('assets/img/avatar/Property 1=Frederik Beck.png');
  directUser = input<AppUser | null>(null);
  channel = input<Channel | null>(null);
  users = input<AppUser[]>([]);
  channels = input<Channel[]>([]);
  profileRequested = output<void>();
  messageRequested = output<AppUser>();
  channelInfoRequested = output<DOMRect>();
  channelRequested = output<Channel>();
  addPeopleRequested = output<DOMRect>();
  membersRequested = output<DOMRect>();
  threadRequested = output<Message>();
  messages = signal<Message[]>([]);
  directMessages = signal<Message[]>([]);
  directMessagesLoaded = signal(false);
  reactionPickerFor = signal<string | null>(null);
  reactionPickerPosition = signal({ top: 0, left: 0 });
  editingMessageId = signal<string | null>(null);
  editingText = signal('');
  editMenuFor = signal<string | null>(null);
  selectedProfile = signal<AppUser | null>(null);
  draft = signal('');
  notes = signal<string[]>([]);
  emojiPickerOpen = signal(false);
  mentionOpen = signal(false);
  mentionKind = signal<MentionKind>('user');
  mentionQuery = signal('');
  mentionStart = signal(0);
  mentionIndex = signal(0);
  readonly mentionSuggestions = computed(() => this.filteredMentionSuggestions());
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
  private lastDraftContext = '';

  requestAddPeople(event: MouseEvent): void {
    const button = event.currentTarget as HTMLElement;
    const anchor = button.getBoundingClientRect();
    // On mobile the member avatars are hidden, so the plus represents the
    // complete member menu. On wider layouts it remains the add-member action.
    if (window.matchMedia('(max-width: 767px)').matches) {
      this.membersRequested.emit(anchor);
      return;
    }
    this.addPeopleRequested.emit(anchor);
  }

  constructor() {
    effect(() => {
      const context = this.channel()?.id ?? this.directUser()?.uid ?? (this.isSelfChat() ? 'self' : '');
      if (context === this.lastDraftContext) return;
      this.lastDraftContext = context;
      this.draft.set('');
      this.emojiPickerOpen.set(false);
      this.closeMentionSuggestions();
    });
    afterRenderEffect(() => {
      if (this.isSelfChat()) this.editor()?.nativeElement.focus();
    });
    afterRenderEffect(() => {
      this.notes();
      this.messages();
      this.directMessages();
      this.editingMessageId();
      const history = this.history()?.nativeElement;
      if (history) history.scrollTop = history.scrollHeight;
    });
    effect(onCleanup => this.watchChannelMessages(onCleanup));
    effect(onCleanup => this.watchDirectMessages(onCleanup));
  }

  private watchChannelMessages(onCleanup: (cleanup: () => void) => void): void {
    const channelId = this.currentChannel()?.id;
    this.messages.set([]);
    if (!channelId) return;
    // Replies carry a parentId and belong into their thread, not into the channel history.
    const stop = this.messageService.watchMessages(channelId, messages =>
      this.messages.set(messages.filter(message => !message.parentId)));
    onCleanup(() => stop());
  }

  isChannelMember(): boolean {
    const uid = this.authService.currentUserId;
    return !!uid && !!this.currentChannel()?.members.includes(uid);
  }

  private currentChannel(): Channel | null {
    const selected = this.channel();
    return this.channels().find(channel => channel.id === selected?.id) ?? selected;
  }

  private watchDirectMessages(onCleanup: (cleanup: () => void) => void): void {
    const ownUid = this.authService.currentUserId;
    const otherUid = this.directUser()?.uid;
    this.directMessages.set([]);
    this.directMessagesLoaded.set(false);
    this.editingMessageId.set(null);
    if (!ownUid || !otherUid || ownUid === otherUid) return;
    const stop = this.messageService.watchDirectMessages(ownUid, otherUid, messages => {
      this.directMessages.set(messages);
      this.directMessagesLoaded.set(true);
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
    if (this.handleMentionKeydown(event)) return;
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
    this.updateMentionContext(editor);
    this.emojiPickerOpen.set(false);
  }

  onDraftInput(editor: HTMLTextAreaElement): void {
    this.draft.set(editor.value);
    this.updateMentionContext(editor);
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
    if (this.handleMentionKeydown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendChannelMessage(event);
    }
  }

  onDirectKeydown(event: KeyboardEvent): void {
    if (this.handleMentionKeydown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendDirectMessage(event);
    }
  }

  authorName(message: Message): string {
    return this.isOwnMessage(message)
      ? `${this.userName()} (Du)`
      : this.userById(message.senderId)?.name ?? 'Gelöschtes Profil';
  }

  selectMention(suggestion: MentionSuggestion): void {
    const editor = this.editor()?.nativeElement;
    if (!editor) return;
    const token = `${suggestion.kind === 'user' ? '@' : '#'}${suggestion.label} `;
    const next = this.draft().slice(0, this.mentionStart()) + token + this.draft().slice(editor.selectionStart);
    this.draft.set(next);
    editor.value = next;
    editor.focus();
    const position = this.mentionStart() + token.length;
    editor.setSelectionRange(position, position);
    this.closeMentionSuggestions();
  }

  messageParts(message: Message): MessagePart[] {
    return this.createMessageParts(message.text);
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

  private filteredMentionSuggestions(): MentionSuggestion[] {
    const query = this.mentionQuery().toLocaleLowerCase('de');
    const source = this.mentionKind() === 'user' ? this.userSuggestions() : this.channelSuggestions();
    return source.filter(item => item.label.toLocaleLowerCase('de').includes(query)).slice(0, 6);
  }

  private userSuggestions(): MentionSuggestion[] {
    return this.users().map(user => ({ kind: 'user', label: user.name, user }));
  }

  private channelSuggestions(): MentionSuggestion[] {
    return this.channels().map(channel => ({ kind: 'channel', label: channel.name, channel }));
  }

  private updateMentionContext(editor: HTMLTextAreaElement): void {
    const before = editor.value.slice(0, editor.selectionStart);
    const match = before.match(/(^|\s)([@#])([^\s@#]*)$/);
    if (!match) return this.closeMentionSuggestions();
    this.mentionKind.set(match[2] === '@' ? 'user' : 'channel');
    this.mentionQuery.set(match[3]);
    this.mentionStart.set(before.length - match[3].length - 1);
    this.mentionIndex.set(0);
    this.mentionOpen.set(true);
  }

  private handleMentionKeydown(event: KeyboardEvent): boolean {
    const suggestions = this.mentionSuggestions();
    if (!this.mentionOpen() || !suggestions.length) return false;
    if (event.key === 'ArrowDown') return this.moveMentionSelection(event, 1);
    if (event.key === 'ArrowUp') return this.moveMentionSelection(event, -1);
    if (event.key === 'Escape') return this.closeMentionFromKeyboard(event);
    if (event.key !== 'Enter') return false;
    event.preventDefault();
    this.selectMention(suggestions[this.mentionIndex()]);
    return true;
  }

  private moveMentionSelection(event: KeyboardEvent, step: number): boolean {
    event.preventDefault();
    const length = this.mentionSuggestions().length;
    this.mentionIndex.update(index => (index + step + length) % length);
    return true;
  }

  private closeMentionFromKeyboard(event: KeyboardEvent): boolean {
    event.preventDefault();
    this.closeMentionSuggestions();
    return true;
  }

  private closeMentionSuggestions(): void {
    this.mentionOpen.set(false);
    this.mentionIndex.set(0);
  }

  private createMessageParts(text: string): MessagePart[] {
    const parts: MessagePart[] = [];
    let cursor = 0;
    const urls = [...text.matchAll(/https?:\/\/[^\s<]+/gi)].map(match => ({ index: match.index ?? 0, text: match[0].replace(/[),.!?;:]+$/, '') }));
    while (cursor < text.length) {
      const mention = this.findNextMention(text, cursor);
      const url = urls.find(item => item.index >= cursor);
      const next = mention && (!url || mention.index <= url.index)
        ? { index: mention.index, text: `${mention.kind === 'user' ? '@' : '#'}${mention.label}`, part: { ...mention, text: `${mention.kind === 'user' ? '@' : '#'}${mention.label}` } }
        : url ? { index: url.index, text: url.text, part: { kind: 'url' as const, label: url.text, text: url.text, url: url.text } } : undefined;
      if (!next) break;
      if (next.index > cursor) parts.push({ kind: 'user', label: '', text: text.slice(cursor, next.index) });
      parts.push(next.part);
      cursor = next.index + next.text.length;
    }
    if (cursor < text.length) parts.push({ kind: 'user', label: '', text: text.slice(cursor) });
    return parts;
  }

  private findNextMention(text: string, from: number): (MessagePart & { index: number }) | undefined {
    return this.allMentionTargets().map(target => ({ ...target, index: text.indexOf(target.text, from) }))
      .filter(target => target.index >= 0).sort((a, b) => a.index - b.index)[0];
  }

  private allMentionTargets(): MessagePart[] {
    return [...this.userSuggestions(), ...this.channelSuggestions()]
      .map(item => ({ ...item, text: `${item.kind === 'user' ? '@' : '#'}${item.label}` }))
      .sort((a, b) => b.text.length - a.text.length);
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

  openChannelInfo(event: MouseEvent): void {
    const button = event.currentTarget as HTMLElement;
    this.channelInfoRequested.emit(button.getBoundingClientRect());
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
    return uids.map(uid => this.reactionName(uid)).join(', ');
  }

  reactionTooltipText(uids: string[]): string {
    return uids.length === 1 ? 'hat reagiert' : 'haben reagiert';
  }

  reactionTooltipNames(uids: string[]): string {
    if (uids.length === 1) return this.reactionName(uids[0]);
    const names = uids.map(uid => this.shortReactionName(uid));
    if (names.length === 2) return names.join(' und ');
    if (names.length === 3) return `${names[0]}, ${names[1]} und ${names[2]}`;
    return `${names[0]}, ${names[1]} und ${names.length - 2} weitere`;
  }

  private shortReactionName(uid: string): string {
    if (uid === this.authService.currentUserId) return 'Ich';
    return this.userById(uid)?.name.split(' ')[0] ?? uid;
  }

  private reactionName(uid: string): string {
    if (uid === this.authService.currentUserId) return 'Ich';
    return this.userById(uid)?.name ?? uid;
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
    const opensFromRight = button.closest('.channel-message')?.classList.contains('own') ?? false;
    const preferredLeft = opensFromRight ? rect.right - 232 : rect.left;
    // Keep the picker inside the actual chat area (not just inside the browser
    // viewport, which can be wider when DevTools or a side panel is open).
    const chatBounds = button.closest<HTMLElement>('.chat-body, .chat-content')?.getBoundingClientRect();
    const minLeft = (chatBounds?.left ?? 0) + 12;
    const maxLeft = Math.max(minLeft, (chatBounds?.right ?? window.innerWidth) - 232 - 12);
    const left = Math.max(minLeft, Math.min(preferredLeft, maxLeft));
    this.reactionPickerPosition.set({ top: rect.bottom + 8, left });
  }

  replyLabel(count: number): string {
    return `${count} ${count === 1 ? 'Antwort' : 'Antworten'}`;
  }

  isLastOwnDirectMessage(message: Message): boolean {
    const ownUid = this.authService.currentUserId;
    if (!ownUid || message.senderId !== ownUid) return false;
    return this.directMessages().at(-1)?.id === message.id;
  }

  isLastOwnChannelMessage(message: Message): boolean {
    const ownUid = this.authService.currentUserId;
    if (!ownUid || message.senderId !== ownUid) return false;
    return this.messages().at(-1)?.id === message.id;
  }

  startEditingDirectMessage(message: Message): void {
    if (!this.isLastOwnDirectMessage(message)) return;
    this.editingMessageId.set(message.id);
    this.editingText.set(message.text);
    this.editMenuFor.set(null);
    this.reactionPickerFor.set(null);
  }

  startEditingChannelMessage(message: Message): void {
    if (!this.isLastOwnChannelMessage(message)) return;
    this.editingMessageId.set(message.id);
    this.editingText.set(message.text);
    this.editMenuFor.set(null);
  }

  toggleEditMenu(messageId: string): void {
    this.editMenuFor.update(openId => openId === messageId ? null : messageId);
  }

  cancelEditingDirectMessage(): void {
    this.editingMessageId.set(null);
    this.editingText.set('');
  }

  saveEditedMessageOnEnter(event: KeyboardEvent, message: Message, channelMessage: boolean): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (channelMessage) void this.saveChannelMessage(message);
    else void this.saveDirectMessage(message);
  }

  async saveDirectMessage(message: Message): Promise<void> {
    const ownUid = this.authService.currentUserId;
    const otherUid = this.directUser()?.uid;
    const text = this.editingText().trim();
    if (!ownUid || !otherUid || !text || !this.isLastOwnDirectMessage(message)) return;
    try {
      await this.messageService.editDirectMessage(ownUid, otherUid, message.id, text);
      this.directMessages.update(messages => this.replaceMessageText(messages, message.id, text));
    } catch (error) {
      console.error('Direktnachricht konnte nicht bearbeitet werden:', error);
      return;
    }
    this.cancelEditingDirectMessage();
  }

  async saveChannelMessage(message: Message): Promise<void> {
    const channelId = this.channel()?.id;
    const text = this.editingText().trim();
    if (!channelId || !text || !this.isLastOwnChannelMessage(message)) return;
    try {
      await this.messageService.editMessage(channelId, message.id, text);
      this.messages.update(messages => this.replaceMessageText(messages, message.id, text));
    } catch (error) {
      console.error('Channel-Nachricht konnte nicht bearbeitet werden:', error);
      return;
    }
    this.cancelEditingDirectMessage();
  }

  private replaceMessageText(messages: Message[], messageId: string, text: string): Message[] {
    return messages.map(message => message.id === messageId ? { ...message, text } : message);
  }

  private userById(uid: string): AppUser | undefined {
    return this.users().find(user => user.uid === uid);
  }

  directUserAvatar(): string { return avatarUrl(this.directUser()?.avatar); }
  openDirectProfile(): void { this.selectedProfile.set(this.directUser()); }
  closeDirectProfile(): void { this.selectedProfile.set(null); }

  startDirectMessage(profile: AppUser): void {
    this.messageRequested.emit(profile);
    this.closeDirectProfile();
  }

  openMessageProfile(message: Message): void {
    if (this.isOwnMessage(message)) return this.profileRequested.emit();
    this.selectedProfile.set(this.userById(message.senderId) ?? null);
  }

  openMentionProfile(user: AppUser): void {
    if (user.uid === this.authService.currentUserId) return this.profileRequested.emit();
    this.selectedProfile.set(user);
  }

  @HostListener('document:keydown.escape')
  closeProfileWithEscape(): void { this.closeDirectProfile(); }

  @HostListener('document:click', ['$event'])
  closeEmojiPickersOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const selector = '.emoji-picker, .channel-reaction-picker, .edit-message-menu, .composer-button, .channel-hover-button, .reaction-add-button';
    if (target.closest(selector)) return;
    this.emojiPickerOpen.set(false);
    this.reactionPickerFor.set(null);
    this.editMenuFor.set(null);
  }
}
