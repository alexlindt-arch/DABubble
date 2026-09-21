import {
  afterNextRender,
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
import { AppUser, Channel, Message } from '../../shared/models';
import { avatarUrl } from '../../shared/avatar-url';
import { EMOJIS } from '../../shared/emojis';
import { MessagePart, mentionTargets, splitMessageParts } from '../../shared/mention';
import { MessageComposer } from '../../shared/message-composer';
import { MessageEditing } from '../../shared/message-editing';
import { MessageReactions } from '../../shared/message-reactions';
import { joinReactionNames } from '../../shared/reactions';
import { AuthService } from '../../services/auth.service';
import { MessageService } from '../../services/message.service';
import { RecentReactionService } from '../../services/recent-reaction.service';
import { MessageTimePipe } from '../../pipes/message-time.pipe';
import { ReplyCountPipe } from '../../pipes/reply-count.pipe';
import { ProfileDialog } from '../profile-dialog/profile-dialog';

@Component({
  imports: [ProfileDialog, MessageTimePipe, ReplyCountPipe],
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
  /** Auf dem Handy erscheinen die Aktionen erst, wenn die Nachricht angetippt wurde. */
  readonly actionsFor = signal<string | null>(null);
  readonly selectedProfile = signal<AppUser | null>(null);
  readonly threadMessages = computed(() => this.collectThreadMessages());
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

  /** Initializes reply watching and keeps the thread scrolled to the latest message. */
  constructor() {
    afterNextRender(() => this.editor()?.nativeElement.focus());
    afterRenderEffect(() => {
      this.replies();
      const history = this.history()?.nativeElement;
      if (history) history.scrollTop = history.scrollHeight;
    });
    effect(onCleanup => this.watchReplies(onCleanup));
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

  /** Returns the names shown in a reaction tooltip. */
  reactionTooltipNames(uids: string[]): string {
    if (uids.length === 1) return this.userById(uids[0])?.name ?? uids[0];
    return joinReactionNames(uids.map(uid => this.shortReactionName(uid)));
  }

  /** Toggles the action bar for a message. */
  toggleActions(message: Message, event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button, a, textarea')) return;
    this.actionsFor.update(id => (id === message.id ? null : message.id));
  }

  /** Opens the reaction picker of a message and closes the edit menu. */
  toggleReactionPicker(messageId: string): void {
    this.reactions.toggle(messageId);
    this.editing.menuFor.set(null);
  }

  /** Opens the edit menu of a message and closes the reaction picker. */
  toggleEditMenu(messageId: string): void {
    this.editing.toggleMenu(messageId);
    this.reactions.close();
  }

  /** Starts editing an eligible message. */
  startEditing(message: Message): void {
    if (!this.isEditable(message)) return;
    this.editing.start(message);
  }

  /** Adds or removes a reaction from a message. */
  toggleReaction(message: Message, emoji: string): void {
    const channelId = this.channelId();
    const uid = this.authService.currentUserId;
    this.reactions.close();
    if (!channelId || !uid) return;
    this.recentReactionService.record(emoji);
    this.messageService
      .toggleReaction(channelId, message, emoji, uid)
      .catch(error => console.error('Reaktion konnte nicht gespeichert werden:', error));
  }

  /** The own opening message and the own last reply can be edited, like in the main chat. */
  isEditable(message: Message): boolean {
    if (!this.isOwnMessage(message)) return false;
    if (!message.parentId) return true;
    const ownReplies = this.replies().filter(item => this.isOwnMessage(item));
    return ownReplies.at(-1)?.id === message.id;
  }

  /** Persists the edited message text. */
  saveEditing(message: Message): void {
    const channelId = this.channelId();
    const text = this.editing.trimmedText();
    if (!channelId || !text || !this.isEditable(message)) return;
    this.messageService
      .editMessage(channelId, message.id, text)
      .catch(error => console.error('Antwort konnte nicht bearbeitet werden:', error));
    this.editing.cancel();
  }

  /** Sends a reply to the current thread. */
  sendReply(event: Event): void {
    event.preventDefault();
    const text = this.composer.text();
    const channelId = this.channelId();
    const parentId = this.parent()?.id;
    const senderId = this.authService.currentUserId;
    if (!text || !channelId || !parentId || !senderId) return;
    this.messageService
      .sendReply(channelId, parentId, text, senderId)
      .catch(error => console.error('Antwort konnte nicht gespeichert werden:', error));
    this.composer.clear();
  }

  /** Handles keyboard shortcuts in the reply editor. */
  onEditorKeydown(event: KeyboardEvent): void {
    if (this.composer.handleKeydown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      this.sendReply(event);
    }
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
    this.composer.emojiPickerOpen.set(false);
    this.reactions.close();
    this.editing.menuFor.set(null);
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
    this.editing.cancel();
    if (!channelId || !parentId) return;
    const stop = this.messageService.watchReplies(channelId, parentId, replies => this.replies.set(replies));
    onCleanup(() => stop());
  }

  /** Returns a compact name for a reaction user. */
  private shortReactionName(uid: string): string {
    if (uid === this.authService.currentUserId) return 'Du';
    return this.userById(uid)?.name.split(' ')[0] ?? uid;
  }

  /** Finds a user by ID in the available user collections. */
  private userById(uid: string): AppUser | undefined {
    return this.messageAuthors().find(user => user.uid === uid)
      ?? this.users().find(user => user.uid === uid);
  }
}
