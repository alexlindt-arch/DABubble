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
import { EMOJIS } from '../../shared/emojis';
import { AuthService } from '../../services/auth.service';
import { MessageService } from '../../services/message.service';
import { RecentReactionService } from '../../services/recent-reaction.service';
import { ProfileDialog } from '../profile-dialog/profile-dialog';

type MentionKind = 'user' | 'channel';

interface MentionSuggestion {
  kind: MentionKind;
  label: string;
  user?: AppUser;
  channel?: Channel;
}

interface MessagePart extends MentionSuggestion {
  text: string;
}

@Component({
  imports: [ProfileDialog],
  selector: 'app-thread',
  styleUrls: ['./thread.scss', './thread-actions.scss', './thread-pickers.scss', './thread-mobile.scss'],
  templateUrl: './thread.html',
})
/** Manages thread replies, reactions, editing, and mentions. */
export class Thread {
  channelId = input<string | null>(null);
  parent = input<Message | null>(null);
  channelName = input('Entwicklerteam');
  users = input<AppUser[]>([]);
  messageAuthors = input<AppUser[]>([]);
  channels = input<Channel[]>([]);
  userName = input('Gast');
  userAvatarUrl = input('assets/img/avatar/Property 1=Frederik Beck.png');
  closed = output<void>();
  profileRequested = output<void>();
  messageRequested = output<AppUser>();
  channelRequested = output<Channel>();

  readonly replies = signal<Message[]>([]);
  readonly draft = signal('');
  readonly emojiPickerOpen = signal(false);
  readonly reactionPickerFor = signal<string | null>(null);
  /** Auf dem Handy erscheinen die Aktionen erst, wenn die Nachricht angetippt wurde. */
  readonly actionsFor = signal<string | null>(null);
  readonly editMenuFor = signal<string | null>(null);
  readonly editingMessageId = signal<string | null>(null);
  readonly editingText = signal('');
  readonly selectedProfile = signal<AppUser | null>(null);
  readonly mentionOpen = signal(false);
  readonly mentionKind = signal<MentionKind>('user');
  readonly mentionQuery = signal('');
  readonly mentionStart = signal(0);
  readonly mentionIndex = signal(0);
  readonly mentionSuggestions = computed(() => this.filteredMentionSuggestions());
  readonly threadMessages = computed(() => this.collectThreadMessages());
  readonly emojis = EMOJIS;

  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly recentReactionService = inject(RecentReactionService);
  readonly recentReactions = this.recentReactionService.reactions;
  private editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private history = viewChild<ElementRef<HTMLElement>>('history');

  /** Initializes reply watching and keeps the thread scrolled to the latest message. */
  constructor() {
    afterRenderEffect(() => {
      this.replies();
      const history = this.history()?.nativeElement;
      if (history) history.scrollTop = history.scrollHeight;
    });
    effect(onCleanup => this.watchReplies(onCleanup));
  }

  get replyLabel(): string {
    const count = this.replies().length;
    return `${count} ${count === 1 ? 'Antwort' : 'Antworten'}`;
  }

  /** Returns the display name for a message author. */
  authorName(message: Message): string {
    return this.isOwnMessage(message)
      ? `${this.userName()} (Du)`
      : this.userById(message.senderId)?.name ?? 'Gelöschtes Profil';
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

  /** Splits message text into plain text and mention parts. */
  messageParts(message: Message): MessagePart[] {
    return this.createMessageParts(message.text);
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

  /** Returns the reaction tooltip text for a number of users. */
  reactionTooltipText(uids: string[]): string {
    return uids.length === 1 ? 'hat reagiert' : 'haben reagiert';
  }

  /** Returns the names shown in a reaction tooltip. */
  reactionTooltipNames(uids: string[]): string {
    if (uids.length === 1) return this.userById(uids[0])?.name ?? uids[0];
    const names = uids.map(uid => this.shortReactionName(uid));
    if (names.length === 2) return names.join(' und ');
    if (names.length === 3) return `${names[0]}, ${names[1]} und ${names[2]}`;
    return `${names[0]}, ${names[1]} und ${names.length - 2} weitere`;
  }

  /** Toggles the action bar for a message. */
  toggleActions(message: Message, event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button, a, textarea')) return;
    this.actionsFor.update(id => (id === message.id ? null : message.id));
  }


  /** Toggles the reaction picker for a message. */
  toggleReactionPicker(messageId: string): void {
    this.reactionPickerFor.update(openId => openId === messageId ? null : messageId);
    this.editMenuFor.set(null);
  }

  /** Adds or removes a reaction from a message. */
  toggleReaction(message: Message, emoji: string): void {
    const channelId = this.channelId();
    const uid = this.authService.currentUserId;
    this.reactionPickerFor.set(null);
    if (!channelId || !uid) return;
    this.recentReactionService.record(emoji);
    this.messageService
      .toggleReaction(channelId, message, emoji, uid)
      .catch(error => console.error('Reaktion konnte nicht gespeichert werden:', error));
  }

  /** The own opening message and the own last reply can be edited, like in the main chat. */
  /** Checks whether a message can be edited by the current user. */
  isEditable(message: Message): boolean {
    if (!this.isOwnMessage(message)) return false;
    if (!message.parentId) return true;
    const ownReplies = this.replies().filter(item => this.isOwnMessage(item));
    return ownReplies.at(-1)?.id === message.id;
  }

  /** Toggles the edit menu for a message. */
  toggleEditMenu(messageId: string): void {
    this.editMenuFor.update(openId => openId === messageId ? null : messageId);
    this.reactionPickerFor.set(null);
  }

  /** Starts editing an eligible message. */
  startEditing(message: Message): void {
    if (!this.isEditable(message)) return;
    this.editingMessageId.set(message.id);
    this.editingText.set(message.text);
    this.editMenuFor.set(null);
  }

  /** Cancels the active message edit. */
  cancelEditing(): void {
    this.editingMessageId.set(null);
    this.editingText.set('');
  }

  /** Persists the edited message text. */
  saveEditing(message: Message): void {
    const channelId = this.channelId();
    const text = this.editingText().trim();
    if (!channelId || !text || !this.isEditable(message)) return;
    this.messageService
      .editMessage(channelId, message.id, text)
      .catch(error => console.error('Antwort konnte nicht bearbeitet werden:', error));
    this.cancelEditing();
  }

  /** Sends a reply to the current thread. */
  sendReply(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    const channelId = this.channelId();
    const parentId = this.parent()?.id;
    const senderId = this.authService.currentUserId;
    if (!text || !channelId || !parentId || !senderId) return;
    this.messageService
      .sendReply(channelId, parentId, text, senderId)
      .catch(error => console.error('Antwort konnte nicht gespeichert werden:', error));
    this.draft.set('');
    this.emojiPickerOpen.set(false);
  }

  /** Handles keyboard shortcuts in the reply editor. */
  onEditorKeydown(event: KeyboardEvent): void {
    if (this.handleMentionKeydown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendReply(event);
    }
  }

  /** Updates the draft and mention context from editor input. */
  onDraftInput(editor: HTMLTextAreaElement): void {
    this.draft.set(editor.value);
    this.updateMentionContext(editor);
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

  /** Closes the selected profile dialog. */
  closeProfile(): void {
    this.selectedProfile.set(null);
  }

  /** Starts a direct conversation with a profile user. */
  startDirectMessage(profile: AppUser): void {
    this.messageRequested.emit(profile);
    this.closeProfile();
  }

  @HostListener('document:keydown.escape')
  /** Closes the profile dialog when Escape is pressed. */
  closeProfileWithEscape(): void {
    this.closeProfile();
  }

  @HostListener('document:click', ['$event'])
  /** Closes thread popups when clicking outside them. */
  closePopupsOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const selector = '.thread-emoji-picker, .thread-reaction-picker, .thread-edit-menu,'
      + ' .thread-composer-button, .thread-hover-button';
    if (target.closest(selector)) return;
    this.emojiPickerOpen.set(false);
    this.reactionPickerFor.set(null);
    this.editMenuFor.set(null);
  }

  /** Returns the parent message followed by its replies. */
  private collectThreadMessages(): Message[] {
    const parent = this.parent();
    return parent ? [parent, ...this.replies()] : this.replies();
  }

  /** Watches replies for the current thread. */
  private watchReplies(onCleanup: (cleanup: () => void) => void): void {
    const channelId = this.channelId();
    const parentId = this.parent()?.id;
    this.replies.set([]);
    this.cancelEditing();
    if (!channelId || !parentId) return;
    const stop = this.messageService.watchReplies(channelId, parentId, replies => this.replies.set(replies));
    onCleanup(() => stop());
  }

  /** Returns a compact name for a reaction user. */
  private shortReactionName(uid: string): string {
    if (uid === this.authService.currentUserId) return 'Du';
    return this.userById(uid)?.name.split(' ')[0] ?? uid;
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
    let cursor = 0;
    let match = this.findNextMention(text, cursor);
    while (match) {
      if (match.index > cursor) parts.push({ kind: 'user', label: '', text: text.slice(cursor, match.index) });
      parts.push({ ...match, text: `${match.kind === 'user' ? '@' : '#'}${match.label}` });
      cursor = match.index + match.text.length;
      match = this.findNextMention(text, cursor);
    }
    if (cursor < text.length) parts.push({ kind: 'user', label: '', text: text.slice(cursor) });
    return parts;
  }

  /** Finds the next known mention in a message. */
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

  /** Finds a user by ID in the available user collections. */
  private userById(uid: string): AppUser | undefined {
    return this.messageAuthors().find(user => user.uid === uid)
      ?? this.users().find(user => user.uid === uid);
  }
}
