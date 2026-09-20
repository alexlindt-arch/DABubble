import { Component, effect, input, output, signal } from '@angular/core';
import { AppUser, Channel } from '../../models';
import { ProfileDialog } from '../profile-dialog/profile-dialog';

@Component({ selector: 'app-channel-info-dialog', imports: [ProfileDialog], templateUrl: './channel-info-dialog.html', styleUrl: './channel-info-dialog.scss' })
export class ChannelInfoDialog {
  channel = input.required<Channel>();
  creator = input<AppUser | null>(null);
  currentUserId = input<string | null>(null);
  anchor = input<DOMRect | null>(null);
  existingChannels = input<string[]>([]);
  saveError = input('');
  saving = input(false);
  saveVersion = input(0);
  closed = output<void>();
  saved = output<{ name: string; description: string }>();
  left = output<void>();
  messageRequested = output<AppUser>();
  creatorProfileOpen = signal(false);
  editingName = signal(false);
  editingDescription = signal(false);
  nameDraft = signal('');
  descriptionDraft = signal('');
  private lastSaveVersion = 0;

  /** Closes active editors after the parent confirms a successful save. */
  constructor() {
    effect(() => {
      const version = this.saveVersion();
      if (version === this.lastSaveVersion) return;
      this.lastSaveVersion = version;
      this.editingName.set(false);
      this.editingDescription.set(false);
    });
  }

  /** Calculates the dialog's vertical position below its trigger. */
  get offsetTop(): string { return `${Math.round((this.anchor()?.bottom ?? 150) + 8)}px`; }

  /** Calculates the dialog's horizontal position from its trigger. */
  get offsetLeft(): string { return `${Math.round(this.anchor()?.left ?? 24)}px`; }

  /** Indicates whether the edited name is already used by another channel. */
  get duplicateName(): boolean {
    const draft = this.normalizeName(this.nameDraft());
    const current = this.normalizeName(this.channel().name);
    if (!draft || draft === current) return false;
    return this.existingChannels().some(name => this.normalizeName(name) === draft);
  }

  /** Opens the channel name editor with the current name as its draft. */
  editName(): void { this.nameDraft.set(this.channel().name); this.editingName.set(true); }

  /** Opens the description editor with the current description as its draft. */
  editDescription(): void { this.descriptionDraft.set(this.channel().description); this.editingDescription.set(true); }

  /** Requests saving the edited channel name. */
  saveName(): void { this.save(this.nameDraft().trim(), this.channel().description); }

  /** Requests saving the edited channel description. */
  saveDescription(): void { this.save(this.channel().name, this.descriptionDraft().trim()); }

  /** Saves the channel name when Enter is pressed. */
  handleNameKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.saveName();
  }

  /** Saves the description on Enter while preserving Shift+Enter for line breaks. */
  handleDescriptionKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.saveDescription();
  }

  /** Opens the channel creator's profile dialog. */
  openCreatorProfile(): void { this.creatorProfileOpen.set(true); }

  /** Closes the channel creator's profile dialog. */
  closeCreatorProfile(): void { this.creatorProfileOpen.set(false); }

  /** Emits valid channel changes unless a save is already in progress. */
  private save(name: string, description: string): void {
    if (!name || this.duplicateName || this.saving()) return;
    this.saved.emit({ name, description });
  }

  /** Normalizes a channel name for case-insensitive duplicate comparisons. */
  private normalizeName(name: string): string {
    return name.trim().toLocaleLowerCase('de');
  }
}
