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

  constructor() {
    effect(() => {
      const version = this.saveVersion();
      if (version === this.lastSaveVersion) return;
      this.lastSaveVersion = version;
      this.editingName.set(false);
      this.editingDescription.set(false);
    });
  }

  get offsetTop(): string { return `${Math.round((this.anchor()?.bottom ?? 150) + 8)}px`; }
  get offsetLeft(): string { return `${Math.round(this.anchor()?.left ?? 24)}px`; }
  get duplicateName(): boolean {
    const draft = this.normalizeName(this.nameDraft());
    const current = this.normalizeName(this.channel().name);
    if (!draft || draft === current) return false;
    return this.existingChannels().some(name => this.normalizeName(name) === draft);
  }
  editName(): void { this.nameDraft.set(this.channel().name); this.editingName.set(true); }
  editDescription(): void { this.descriptionDraft.set(this.channel().description); this.editingDescription.set(true); }
  saveName(): void { this.save(this.nameDraft().trim(), this.channel().description); }
  saveDescription(): void { this.save(this.channel().name, this.descriptionDraft().trim()); }
  handleNameKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.saveName();
  }
  handleDescriptionKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.saveDescription();
  }
  openCreatorProfile(): void { this.creatorProfileOpen.set(true); }
  closeCreatorProfile(): void { this.creatorProfileOpen.set(false); }
  private save(name: string, description: string): void {
    if (!name || this.duplicateName || this.saving()) return;
    this.saved.emit({ name, description });
  }

  private normalizeName(name: string): string {
    return name.trim().toLocaleLowerCase('de');
  }
}
