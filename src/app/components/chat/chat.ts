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
  WritableSignal,
} from '@angular/core';
import { AppUser, Channel, Message } from '../../shared/models';
import { avatarUrl } from '../../shared/avatar-url';
import { EMOJIS } from '../../shared/emojis';
import { isMobileViewport } from '../../shared/is-mobile-viewport';
import { MessageComposer } from '../../shared/message-composer';
import { MessageEditing } from '../../shared/message-editing';
import { MessageReactions } from '../../shared/message-reactions';
import { MessagePart, mentionTargets, splitMessageParts } from '../../shared/mention';
import { joinReactionNames } from '../../shared/reactions';
import { replaceMessageText, startsNewDay } from '../../shared/message-format';
import { AuthService } from '../../services/auth.service';
import { MessageService } from '../../services/message.service';
import { RecentReactionService } from '../../services/recent-reaction.service';
import { AvatarUrlPipe } from '../../pipes/avatar-url.pipe';
import { MessageDatePipe } from '../../pipes/message-date.pipe';
import { MessageTimePipe } from '../../pipes/message-time.pipe';
import { ReplyCountPipe } from '../../pipes/reply-count.pipe';
import { ProfileDialog } from '../profile-dialog/profile-dialog';

@Component({
  imports: [ProfileDialog, AvatarUrlPipe, MessageDatePipe, MessageTimePipe, ReplyCountPipe],
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
  selectedProfile = signal<AppUser | null>(null);
  notes = signal<string[]>([]);
  readonly isWelcomeChannel = computed(() => this.channel()?.name.trim().toLocaleLowerCase('de') === 'willkommenschannel');
  readonly emojis = EMOJIS;
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly recentReactionService = inject(RecentReactionService);
  readonly recentReactions = this.recentReactionService.reactions;
  private editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private history = viewChild<ElementRef<HTMLElement>>('history');
  readonly composer = new MessageComposer(this.users, this.channels, this.editor);
  readonly editing = new MessageEditing();
  readonly reactions = new MessageReactions(() => this.authService.currentUserId);
  private lastDraftContext = '';
  private lastFocusedContext = '';

  /** Initializes chat watchers, draft handling, focus, and scroll behavior. */
  constructor() {
    effect(() => this.resetDraftOnContextChange());
    afterRenderEffect(() => this.focusEditorForContext());
    afterRenderEffect(() => this.scrollHistoryToBottom());
    effect(onCleanup => this.watchChannelMessages(onCleanup));
    effect(onCleanup => this.watchDirectMessages(onCleanup));
  }

  /** Requests the appropriate member dialog for the current viewport. */
  requestAddPeople(event: MouseEvent): void {
    const button = event.currentTarget as HTMLElement;
    const anchor = button.getBoundingClientRect();
    // On mobile the member avatars are hidden, so the plus represents the
    // complete member menu. On wider layouts it remains the add-member action.
    if (isMobileViewport()) return this.membersRequested.emit(anchor);
    this.addPeopleRequested.emit(anchor);
  }

  /** Checks whether the current user belongs to the selected channel. */
  isChannelMember(): boolean {
    const uid = this.authService.currentUserId;
    return !!uid && !!this.currentChannel()?.members.includes(uid);
  }

  /** Sends the current draft into the active conversation. */
  send(event: Event): void {
    event.preventDefault();
    const text = this.composer.text();
    if (!text || !this.deliverDraft(text)) return;
    this.composer.clear();
  }

  /** Handles keyboard shortcuts in the message editor. */
  onEditorKeydown(event: KeyboardEvent): void {
    if (this.composer.handleKeydown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.send(event);
    }
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

  /** Splits message text into plain text, link, and mention parts. */
  messageParts(message: Message): MessagePart[] {
    return splitMessageParts(message.text, mentionTargets(this.users(), this.channels()));
  }

  /** Checks whether a date divider is needed above the given message. */
  showDateDivider(index: number): boolean {
    return startsNewDay(this.activeList()(), index);
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

  /** Returns the number of members in the selected channel. */
  memberCount(): number {
    return this.channel()?.members.length ?? 0;
  }

  /** Returns the first visible members for the channel header. */
  visibleMembers(): AppUser[] {
    const members = this.channel()?.members ?? [];
    return this.users().filter(user => members.includes(user.uid)).slice(0, 3);
  }

  /** Returns the names shown in a reaction tooltip. */
  reactionTooltipNames(uids: string[]): string {
    if (uids.length === 1) return this.reactionName(uids[0]);
    return joinReactionNames(uids.map(uid => this.shortReactionName(uid)));
  }

  /** Adds or removes a reaction on the given message. */
  toggleReaction(message: Message, emoji: string): void {
    const uid = this.authService.currentUserId;
    this.reactions.close();
    if (!uid) return;
    const write = this.reactionWrite(message, emoji, uid);
    if (!write) return;
    this.recentReactionService.record(emoji);
    write.catch(error => console.error('Reaktion konnte nicht gespeichert werden:', error));
  }

  /** Checks whether the given message is the own last message of the conversation. */
  isLastOwnMessage(message: Message): boolean {
    const ownUid = this.authService.currentUserId;
    if (!ownUid || message.senderId !== ownUid) return false;
    return this.activeList()().at(-1)?.id === message.id;
  }

  /** Starts editing the own last message. */
  startEditing(message: Message): void {
    if (!this.isLastOwnMessage(message)) return;
    this.editing.start(message);
    this.reactions.close();
  }

  /** Saves an edited message when Enter is pressed. */
  saveEditedMessageOnEnter(event: KeyboardEvent, message: Message): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void this.saveEditing(message);
  }

  /** Persists the edited text of the given message. */
  async saveEditing(message: Message): Promise<void> {
    const text = this.editing.trimmedText();
    if (!text || !this.isLastOwnMessage(message)) return;
    const write = this.editWrite(message, text);
    if (!write) return;
    try {
      await write;
    } catch (error) {
      return console.error('Nachricht konnte nicht bearbeitet werden:', error);
    }
    this.activeList().update(messages => replaceMessageText(messages, message.id, text));
    this.editing.cancel();
  }

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
    this.composer.emojiPickerOpen.set(false);
    this.reactions.close();
    this.editing.menuFor.set(null);
  }

  /** Returns the message list of the conversation currently on screen. */
  private activeList(): WritableSignal<Message[]> {
    return this.channel() ? this.messages : this.directMessages;
  }

  /** Routes the draft to the matching conversation type. */
  private deliverDraft(text: string): boolean {
    if (this.isSelfChat()) return this.addNote(text);
    const write = this.sendWrite(text);
    if (!write) return false;
    write.catch(error => console.error('Nachricht konnte nicht gesendet werden:', error));
    return true;
  }

  /** Adds a local note to the self-chat preview. */
  private addNote(text: string): boolean {
    // Local UI preview only; connect to the shared messages service later.
    this.notes.update(notes => [...notes, text]);
    this.composer.focus();
    return true;
  }

  /** Returns the pending write that delivers the draft. */
  private sendWrite(text: string): Promise<void> | null {
    const senderId = this.authService.currentUserId;
    if (!senderId) return null;
    const channelId = this.channel()?.id;
    if (channelId) return this.messageService.sendMessage(channelId, text, senderId);
    const recipientId = this.directUser()?.uid;
    if (!recipientId) return null;
    return this.messageService.sendDirectMessage(senderId, recipientId, text);
  }

  /** Returns the pending write that stores an edited message. */
  private editWrite(message: Message, text: string): Promise<void> | null {
    const channelId = this.channel()?.id;
    if (channelId) return this.messageService.editMessage(channelId, message.id, text);
    const ownUid = this.authService.currentUserId;
    const otherUid = this.directUser()?.uid;
    if (!ownUid || !otherUid) return null;
    return this.messageService.editDirectMessage(ownUid, otherUid, message.id, text);
  }

  /** Returns the pending write that stores a toggled reaction. */
  private reactionWrite(message: Message, emoji: string, uid: string): Promise<void> | null {
    const channelId = this.channel()?.id;
    if (channelId) return this.messageService.toggleReaction(channelId, message, emoji, uid);
    const otherUid = this.directUser()?.uid;
    if (!otherUid) return null;
    return this.messageService.toggleDirectReaction(uid, otherUid, message, emoji, uid);
  }

  /** Clears draft-related state when the active conversation changes. */
  private resetDraftOnContextChange(): void {
    const context = this.chatContext();
    if (context === this.lastDraftContext) return;
    this.lastDraftContext = context;
    this.composer.reset();
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
    this.editing.messageId();
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
    this.editing.cancel();
    if (!ownUid || !otherUid || ownUid === otherUid) return;
    const stop = this.messageService.watchDirectMessages(ownUid, otherUid, messages => {
      this.directMessages.set(messages);
      this.directMessagesLoaded.set(true);
      if (messages.length) void this.messageService.markDirectConversationRead(ownUid, otherUid);
    });
    onCleanup(() => stop());
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

  /** Finds a user by ID in the available user collections. */
  private userById(uid: string): AppUser | undefined {
    return this.messageAuthors().find(user => user.uid === uid)
      ?? this.users().find(user => user.uid === uid);
  }
}
