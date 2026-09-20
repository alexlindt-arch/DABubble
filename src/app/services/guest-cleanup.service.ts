import { inject, Injectable } from '@angular/core';
import { AppUser, Channel } from '../models';
import { ChannelService } from './channel.service';
import { MessageService } from './message.service';
import { UserService } from './user.service';

/** Räumt weg, was Gäste hinterlassen haben - beim eigenen Ablauf und bei fremden Altlasten. */
@Injectable({ providedIn: 'root' })
export class GuestCleanupService {
  private readonly channelService = inject(ChannelService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);

  /** Jeder angemeldete Client räumt abgelaufene Gast-Sitzungen auf, nicht nur der Gast selbst. */
  async sweepExpiredGuests(ownUid: string): Promise<void> {
    const users = await this.userService.loadUsers();
    const guestUids = users.filter(isExpiredGuest).map(guest => guest.uid);
    await this.tryClear(() => this.messageService.deleteDirectChatsWith(ownUid, guestUids));
    for (const uid of guestUids) await this.removeGuestData(uid);
  }

  /** Die eigene Sitzung schliesst die Direktchats ein; fremde darf niemand abfragen. */
  async removeOwnGuestData(uid: string): Promise<void> {
    await this.tryClear(() => this.messageService.deleteDirectChatsOf(uid));
    await this.removeGuestData(uid);
  }

  /** Das Profil geht zuletzt: Es weist den Rules nach, dass die Daten gelöscht werden dürfen. */
  async removeGuestData(uid: string): Promise<void> {
    const channels = await this.channelService.loadChannels();
    const channelsCleared = await this.clearChannels(channels, uid);
    if (channelsCleared) await this.removeProfile(uid);
  }

  /** War ein anderer Client schneller, ist das Profil schon weg - kein Grund zur Sorge. */
  private removeProfile(uid: string): Promise<void> {
    return this.userService.deleteUserProfile(uid).catch(() => undefined);
  }

  private async clearChannels(channels: Channel[], uid: string): Promise<boolean> {
    let cleared = true;
    for (const channel of channels) {
      cleared = (await this.tryClear(() => this.clearChannel(channel, uid))) && cleared;
    }
    return cleared;
  }

  /** Eigene Channels verschwinden ganz, in fremden bleiben nur die Beiträge der anderen. */
  private async clearChannel(channel: Channel, uid: string): Promise<void> {
    if (channel.createdBy === uid) return this.deleteChannel(channel.id);
    await this.messageService.purgeAuthor(channel.id, uid);
    if (channel.members.includes(uid)) await this.leaveQuietly(channel.id, uid);
  }

  private async deleteChannel(channelId: string): Promise<void> {
    await this.messageService.deleteAllMessages(channelId);
    await this.channelService.deleteChannel(channelId);
  }

  /** Nur Mitglieder dürfen die Mitgliederliste ändern; sonst bleibt die tote UID stehen. */
  private leaveQuietly(channelId: string, uid: string): Promise<void> {
    return this.channelService.leaveChannel(channelId, uid).catch(() => undefined);
  }

  /**
   * Ein blockierter Schritt darf die übrigen nicht stoppen. Fehlende Rechte sind hier normal,
   * etwa wenn ein anderer Client parallel aufräumt - deshalb ohne Eintrag in der Konsole.
   */
  private async tryClear(task: () => Promise<void>): Promise<boolean> {
    try {
      await task();
      return true;
    } catch {
      return false;
    }
  }
}

function isExpiredGuest(user: AppUser): boolean {
  return !!user.guestUntil && user.guestUntil.toMillis() <= Date.now();
}
