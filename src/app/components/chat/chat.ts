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
import { RecentReactionService } from '../../services/recent-reaction.service';
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
  styleUrls: ['./chat.scss', './chat-channel.scss', './chat-channel-reactions.scss', './chat-channel-responsive.scss'],
  templateUrl: './chat.html',
})
/** Manages channel and direct-message chat interactions. */
export class Chat {
  isSelfChat = input(false);
  userName = input('Gast');
  userAvatarUrl = input('assets/img/avatar/Property 1=Frederik Beck.png');
  directUser = input<AppUser | null>(null);
  channel = input<Channel | null>(null);
  users = input<AppUser[]>([]);
  messageAuthors = input<AppUser[]>([]);
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
  readonly isWelcomeChannel = computed(() => this.channel()?.name.trim().toLocaleLowerCase('de') === 'willkommenschannel');
  emojis = [
    '😂', '❤️', '🤣', '👍', '😭',
    '💀', '🔥', '🥰', '😊', '🙏',
    '✨', '🎉', '🫡', '🤔', '👀',
    '✅', '😍', '😅', '💯', '😎',
  ];
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly recentReactionService = inject(RecentReactionService);
  readonly recentReactions = this.recentReactionService.reactions;
  private editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private history = viewChild<ElementRef<HTMLElement>>('history');
  private lastDraftContext = '';
  private lastFocusedContext = '';

  /** Requests the appropriate member dialog for the current viewport. */
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

  /** Initializes chat watchers, draft handling, focus, and scroll behavior. */
  constructor() {
    effect(() => this.resetDraftOnContextChange());
    afterRenderEffect(() => this.focusEditorForContext());
    afterRenderEffect(() => this.scrollHistoryToBottom());
    effect(onCleanup => this.watchChannelMessages(onCleanup));
    effect(onCleanup => this.watchDirectMessages(onCleanup));
  }

  /** Clears draft-related state when the active conversation changes. */
  private resetDraftOnContextChange(): void {
    const context = this.chatContext();
    if (context === this.lastDraftContext) return;
    this.lastDraftContext = context;
    this.draft.set('');
    this.emojiPickerOpen.set(false);
    this.closeMentionSuggestions();
  }

  /** Focuses the editor when a new conversation becomes active. */
  private focusEditorForContext(): void {
    const context = this.chatContext();
    if (!context || context === this.lastFocusedContext) return;
    const editor = this.editor()?.nativeElement;
    if (!editor) return;
    editor.focus();
    this.lastFocusedContext = context;
  }

  /** Keeps the visible message history scrolled to the newest content. */
  private scrollHistoryToBottom(): void {
    this.notes();
    this.messages();
    this.directMessages();
    this.editingMessageId();
    const history = this.history()?.nativeElement;
    if (history) history.scrollTop = history.scrollHeight;
  }

  /** Returns a stable identifier for the active chat context. */
  private chatContext(): string {
    return this.channel()?.id ?? this.directUser()?.uid ?? (this.isSelfChat() ? 'self' : '');
  }

  /** Watches channel messages and excludes thread replies from the main history. */
  private watchChannelMessages(onCleanup: (cleanup: () => void) => void): void {
    const channelId = this.currentChannel()?.id;
    this.messages.set([]);
    if (!channelId) return;
    // Replies carry a parentId and belong into their thread, not into the channel history.
    const stop = this.messageService.watchMessages(channelId, messages =>
      this.messages.set(messages.filter(message => !message.parentId)));
    onCleanup(() => stop());
  }

  /** Checks whether the current user belongs to the selected channel. */
  isChannelMember(): boolean {
    const uid = this.authService.currentUserId;
    return !!uid && !!this.currentChannel()?.members.includes(uid);
  }

  /** Returns the current channel instance from the available channels. */
  private currentChannel(): Channel | null {
    const selected = this.channel();
    return this.channels().find(channel => channel.id === selected?.id) ?? selected;
  }

  /** Watches direct messages and marks the conversation as read. */
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

  /** Adds a local note to the self-chat preview. */
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

  /** Handles keyboard shortcuts in the self-chat editor. */
  onEditorKeydown(event: KeyboardEvent): void {
    if (this.handleMentionKeydown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendNote(event);
    }
  }

  /** Inserts text at the current editor selection. */
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

  /** Updates the draft and mention context from editor input. */
  onDraftInput(editor: HTMLTextAreaElement): void {
    this.draft.set(editor.value);
    this.updateMentionContext(editor);
  }

  /** Sends a message to the selected channel. */
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

  /** Sends a direct message to the selected user. */
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

  /** Handles keyboard shortcuts in the channel editor. */
  onChannelKeydown(event: KeyboardEvent): void {
    if (this.handleMentionKeydown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendChannelMessage(event);
    }
  }

  /** Handles keyboard shortcuts in the direct-message editor. */
  onDirectKeydown(event: KeyboardEvent): void {
    if (this.handleMentionKeydown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendDirectMessage(event);
    }
  }

  /** Returns the display name for a message author. */
  authorName(message: Message): string {
    return this.isOwnMessage(message)
      ? `${this.userName()} (Du)`
      : this.userById(message.senderId)?.name ?? 'Gelöschtes Profil';
  }

  /** Inserts a selected mention into the draft. */
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

  /** Splits message text into renderable parts. */
  messageParts(message: Message): MessagePart[] {
    return this.createMessageParts(message.text);
  }

  /** Checks whether a date divider is needed in channel history. */
  showDateDivider(index: number): boolean {
    if (index === 0) return true;
    return this.messageDay(this.messages()[index]) !== this.messageDay(this.messages()[index - 1]);
  }

  /** Checks whether a date divider is needed in direct history. */
  showDirectDateDivider(index: number): boolean {
    if (index === 0) return true;
    const messages = this.directMessages();
    return this.messageDay(messages[index]) !== this.messageDay(messages[index - 1]);
  }

  /** Formats a message date for display. */
  dateLabel(message: Message): string {
    const date = message.timestamp?.toDate?.();
    if (!date) return '';
    if (date.toDateString() === new Date().toDateString()) return 'Heute';
    return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /** Returns the calendar day for a message. */
  private messageDay(message: Message): string {
    return message.timestamp?.toDate?.()?.toDateString() ?? '';
  }

  /** Returns mention suggestions matching the query. */
  private filteredMentionSuggestions(): MentionSuggestion[] {
    const query = this.mentionQuery().toLocaleLowerCase('de');
    const source = this.mentionKind() === 'user' ? this.userSuggestions() : this.channelSuggestions();
    return source.filter(item => item.label.toLocaleLowerCase('de').includes(query)).slice(0, 6);
  }

  /** Builds mention suggestions from users. */
  private userSuggestions(): MentionSuggestion[] {
    return this.users().map(user => ({ kind: 'user', label: user.name, user }));
  }

  /** Builds mention suggestions from channels. */
  private channelSuggestions(): MentionSuggestion[] {
    return this.channels().map(channel => ({ kind: 'channel', label: channel.name, channel }));
  }

  /** Updates mention state from the editor caret position. */
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

  /** Handles keyboard navigation for mention suggestions. */
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

  /** Moves the active mention selection. */
  private moveMentionSelection(event: KeyboardEvent, step: number): boolean {
    event.preventDefault();
    const length = this.mentionSuggestions().length;
    this.mentionIndex.update(index => (index + step + length) % length);
    return true;
  }

  /** Closes mention suggestions from the keyboard. */
  private closeMentionFromKeyboard(event: KeyboardEvent): boolean {
    event.preventDefault();
    this.closeMentionSuggestions();
    return true;
  }

  /** Closes and resets mention suggestions. */
  private closeMentionSuggestions(): void {
    this.mentionOpen.set(false);
    this.mentionIndex.set(0);
  }

  /** Creates renderable parts from message text. */
  private createMessageParts(text: string): MessagePart[] {
    const parts: MessagePart[] = [];
    const urls = this.extractUrls(text);
    let cursor = 0;
    while (cursor < text.length) {
      const next = this.nextMessagePart(text, cursor, urls);
      if (!next) break;
      if (next.index > cursor) parts.push({ kind: 'user', label: '', text: text.slice(cursor, next.index) });
      parts.push(next.part);
      cursor = next.index + next.text.length;
    }
    if (cursor < text.length) parts.push({ kind: 'user', label: '', text: text.slice(cursor) });
    return parts;
  }

  /** Extracts URLs from message text. */
  private extractUrls(text: string): { index: number; text: string }[] {
    return [...text.matchAll(/https?:\/\/[^\s<]+/gi)]
      .map(match => ({ index: match.index ?? 0, text: match[0].replace(/[),.!?;:]+$/, '') }));
  }

  /** Finds the next mention or URL in message text. */
  private nextMessagePart(text: string, cursor: number, urls: { index: number; text: string }[]) {
    const mention = this.findNextMention(text, cursor);
    const url = urls.find(item => item.index >= cursor);
    if (mention && (!url || mention.index <= url.index)) {
      const value = `${mention.kind === 'user' ? '@' : '#'}${mention.label}`;
      return { index: mention.index, text: value, part: { ...mention, text: value } };
    }
    if (url) return { index: url.index, text: url.text, part: { kind: 'url' as const, label: url.text, text: url.text, url: url.text } };
    return undefined;
  }

  /** Finds the next known mention in message text. */
  private findNextMention(text: string, from: number): (MessagePart & { index: number }) | undefined {
    return this.allMentionTargets().map(target => ({ ...target, index: text.indexOf(target.text, from) }))
      .filter(target => target.index >= 0).sort((a, b) => a.index - b.index)[0];
  }

  /** Returns all known user and channel mention targets. */
  private allMentionTargets(): MessagePart[] {
    return [...this.userSuggestions(), ...this.channelSuggestions()]
      .map(item => ({ ...item, text: `${item.kind === 'user' ? '@' : '#'}${item.label}` }))
      .sort((a, b) => b.text.length - a.text.length);
  }

  /** Returns the avatar URL for a message author. */
  authorAvatar(message: Message): string {
    return this.isOwnMessage(message)
      ? this.userAvatarUrl()
      : avatarUrl(this.userById(message.senderId)?.avatar);
  }

  /** Checks whether a message was sent by the current user. */
  isOwnMessage(message: Message): boolean {
    return message.senderId === this.authService.currentUserId;
  }

  /** Formats a message timestamp for display. */
  messageTime(message: Message): string {
    const date = message.timestamp?.toDate?.();
    if (!date) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} Uhr`;
  }

  /** Requests the channel members dialog. */
  openMembers(event: MouseEvent): void {
    const button = event.currentTarget as HTMLElement;
    this.membersRequested.emit(button.getBoundingClientRect());
  }

  /** Requests the channel information dialog. */
  openChannelInfo(event: MouseEvent): void {
    const button = event.currentTarget as HTMLElement;
    this.channelInfoRequested.emit(button.getBoundingClientRect());
  }

  /** Returns the avatar URL for a channel member. */
  memberAvatar(member: AppUser): string {
    return avatarUrl(member.avatar);
  }

  /** Returns the number of members in the selected channel. */
  memberCount(): number {
    return this.channel()?.members.length ?? 0;
  }

  /** Returns the first visible members for the channel header. */
  visibleMembers(): AppUser[] {
    const members = this.channel()?.members ?? [];
    return this.users().filter(user => members.includes(user.uid)).slice(0, 3);
  }

  /** Returns the non-empty reactions attached to a message. */
  reactionsOf(message: Message): { emoji: string; uids: string[] }[] {
    return Object.entries(message.reactions ?? {})
      .filter(([, uids]) => uids.length > 0)
      .map(([emoji, uids]) => ({ emoji, uids }));
  }

  /** Checks whether the current user reacted with a reaction. */
  hasReacted(uids: string[]): boolean {
    const uid = this.authService.currentUserId;
    return !!uid && uids.includes(uid);
  }

  /** Returns the names shown in a reaction title. */
  reactionTitle(uids: string[]): string {
    return uids.map(uid => this.reactionName(uid)).join(', ');
  }

  /** Returns the reaction tooltip text for a number of users. */
  reactionTooltipText(uids: string[]): string {
    return uids.length === 1 ? 'hat reagiert' : 'haben reagiert';
  }

  /** Returns the names shown in a reaction tooltip. */
  reactionTooltipNames(uids: string[]): string {
    if (uids.length === 1) return this.reactionName(uids[0]);
    const names = uids.map(uid => this.shortReactionName(uid));
    if (names.length === 2) return names.join(' und ');
    if (names.length === 3) return `${names[0]}, ${names[1]} und ${names[2]}`;
    return `${names[0]}, ${names[1]} und ${names.length - 2} weitere`;
  }

  /** Returns a compact name for a reaction user. */
  private shortReactionName(uid: string): string {
    if (uid === this.authService.currentUserId) return 'Ich';
    return this.userById(uid)?.name.split(' ')[0] ?? uid;
  }

  /** Returns a display name for a reaction user. */
  private reactionName(uid: string): string {
    if (uid === this.authService.currentUserId) return 'Ich';
    return this.userById(uid)?.name ?? uid;
  }

  /** Adds or removes a reaction from a channel message. */
  toggleReaction(message: Message, emoji: string): void {
    const channelId = this.channel()?.id;
    const uid = this.authService.currentUserId;
    this.reactionPickerFor.set(null);
    if (!channelId || !uid) return;
    this.recentReactionService.record(emoji);
    this.messageService
      .toggleReaction(channelId, message, emoji, uid)
      .catch(error => console.error('Reaktion konnte nicht gespeichert werden:', error));
  }

  /** Adds or removes a reaction from a direct message. */
  toggleDirectReaction(message: Message, emoji: string): void {
    const ownUid = this.authService.currentUserId;
    const otherUid = this.directUser()?.uid;
    this.reactionPickerFor.set(null);
    if (!ownUid || !otherUid) return;
    this.recentReactionService.record(emoji);
    this.messageService
      .toggleDirectReaction(ownUid, otherUid, message, emoji, ownUid)
      .catch(error => console.error('Reaktion konnte nicht gespeichert werden:', error));
  }

  /** Toggles the reaction picker and positions it. */
  toggleReactionPicker(messageId: string, event: MouseEvent): void {
    if (this.reactionPickerFor() === messageId) return this.reactionPickerFor.set(null);
    this.reactionPickerFor.set(messageId);
    this.setReactionPickerPosition(event.currentTarget as HTMLElement);
  }

  /** Positions the reaction picker near its trigger. */
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

  /** Returns the localized reply count label. */
  replyLabel(count: number): string {
    return `${count} ${count === 1 ? 'Antwort' : 'Antworten'}`;
  }

  /** Checks whether a direct message is the last own message. */
  isLastOwnDirectMessage(message: Message): boolean {
    const ownUid = this.authService.currentUserId;
    if (!ownUid || message.senderId !== ownUid) return false;
    return this.directMessages().at(-1)?.id === message.id;
  }

  /** Checks whether a channel message is the last own message. */
  isLastOwnChannelMessage(message: Message): boolean {
    const ownUid = this.authService.currentUserId;
    if (!ownUid || message.senderId !== ownUid) return false;
    return this.messages().at(-1)?.id === message.id;
  }

  /** Starts editing an eligible direct message. */
  startEditingDirectMessage(message: Message): void {
    if (!this.isLastOwnDirectMessage(message)) return;
    this.editingMessageId.set(message.id);
    this.editingText.set(message.text);
    this.editMenuFor.set(null);
    this.reactionPickerFor.set(null);
  }

  /** Starts editing an eligible channel message. */
  startEditingChannelMessage(message: Message): void {
    if (!this.isLastOwnChannelMessage(message)) return;
    this.editingMessageId.set(message.id);
    this.editingText.set(message.text);
    this.editMenuFor.set(null);
  }

  /** Toggles the edit menu for a message. */
  toggleEditMenu(messageId: string): void {
    this.editMenuFor.update(openId => openId === messageId ? null : messageId);
  }

  /** Cancels the active direct-message edit. */
  cancelEditingDirectMessage(): void {
    this.editingMessageId.set(null);
    this.editingText.set('');
  }

  /** Saves an edited message when Enter is pressed. */
  saveEditedMessageOnEnter(event: KeyboardEvent, message: Message, channelMessage: boolean): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (channelMessage) void this.saveChannelMessage(message);
    else void this.saveDirectMessage(message);
  }

  /** Persists an edited direct message. */
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

  /** Persists an edited channel message. */
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

  /** Replaces one message in a message collection. */
  private replaceMessageText(messages: Message[], messageId: string, text: string): Message[] {
    return messages.map(message => message.id === messageId ? { ...message, text } : message);
  }

  /** Finds a user by ID in the available user collections. */
  private userById(uid: string): AppUser | undefined {
    return this.messageAuthors().find(user => user.uid === uid)
      ?? this.users().find(user => user.uid === uid);
  }

  /** Returns the selected direct user avatar URL. */
  directUserAvatar(): string { return avatarUrl(this.directUser()?.avatar); }
  /** Opens the selected direct user profile. */
  openDirectProfile(): void { this.selectedProfile.set(this.directUser()); }
  /** Closes the selected direct user profile. */
  closeDirectProfile(): void { this.selectedProfile.set(null); }

  /** Requests a direct conversation with a profile user. */
  startDirectMessage(profile: AppUser): void {
    this.messageRequested.emit(profile);
    this.closeDirectProfile();
  }

  /** Opens the profile associated with a message. */
  openMessageProfile(message: Message): void {
    if (this.isOwnMessage(message)) return this.profileRequested.emit();
    this.selectedProfile.set(this.userById(message.senderId) ?? null);
  }

  /** Opens the profile associated with a mention. */
  openMentionProfile(user: AppUser): void {
    if (user.uid === this.authService.currentUserId) return this.profileRequested.emit();
    this.selectedProfile.set(user);
  }

  @HostListener('document:keydown.escape')
  /** Closes the profile dialog when Escape is pressed. */
  closeProfileWithEscape(): void { this.closeDirectProfile(); }

  @HostListener('document:click', ['$event'])
  /** Closes chat popups when clicking outside them. */
  closeEmojiPickersOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const selector = '.emoji-picker, .channel-reaction-picker, .edit-message-menu, .composer-button, .channel-hover-button, .reaction-add-button';
    if (target.closest(selector)) return;
    this.emojiPickerOpen.set(false);
    this.reactionPickerFor.set(null);
    this.editMenuFor.set(null);
  }
}
