import { inject, Injectable } from '@angular/core';
import { AppUser, Channel } from '../models';
import { ChannelService } from './channel.service';
import { MessageService } from './message.service';
import { UserService } from './user.service';

/** Cleans up guest data when the own session expires and removes stale remnants. */
@Injectable({ providedIn: 'root' })
/** Provides guestcleanup data and operations. */
export class GuestCleanupService {
  private readonly channelService = inject(ChannelService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);

  /** Allows every signed-in client to clean up expired guest sessions, not only the guest. */
  /** Handles sweepExpiredGuests. */
  async sweepExpiredGuests(ownUid: string): Promise<void> {
    const users = await this.userService.loadUsers();
    const guestUids = users.filter(isExpiredGuest).map(guest => guest.uid);
    await this.tryClear(() => this.messageService.deleteDirectChatsWith(ownUid, guestUids));
    for (const uid of guestUids) await this.removeGuestData(uid);
  }

  /** Includes direct chats for the own session; other users’ chats cannot be queried. */
  /** Handles removeOwnGuestData. */
  async removeOwnGuestData(uid: string): Promise<void> {
    await this.tryClear(() => this.messageService.deleteDirectChatsOf(uid));
    await this.removeGuestData(uid);
  }

  /** Deletes the profile last so Firestore rules can authorize the cleanup. */
  /** Handles removeGuestData. */
  async removeGuestData(uid: string): Promise<void> {
    const channels = await this.channelService.loadChannels();
    const channelsCleared = await this.clearChannels(channels, uid);
    if (channelsCleared) await this.removeProfile(uid);
  }

  /** Treats an already-removed profile as a harmless race with another client. */
  /** Handles removeProfile. */
  private removeProfile(uid: string): Promise<void> {
    return this.userService.deleteUserProfile(uid).catch(() => undefined);
  }

  /** Handles clearChannels. */
  private async clearChannels(channels: Channel[], uid: string): Promise<boolean> {
    let cleared = true;
    for (const channel of channels) {
      cleared = (await this.tryClear(() => this.clearChannel(channel, uid))) && cleared;
    }
    return cleared;
  }

  /** Removes owned channels completely and keeps only other users’ posts in shared channels. */
  /** Handles clearChannel. */
  private async clearChannel(channel: Channel, uid: string): Promise<void> {
    if (channel.createdBy === uid) return this.deleteChannel(channel.id);
    await this.messageService.purgeAuthor(channel.id, uid);
    if (channel.members.includes(uid)) await this.leaveQuietly(channel.id, uid);
  }

  /** Handles deleteChannel. */
  private async deleteChannel(channelId: string): Promise<void> {
    await this.messageService.deleteAllMessages(channelId);
    await this.channelService.deleteChannel(channelId);
  }

  /** Updates channel membership only when authorized, preventing stale user IDs. */
  /** Handles leaveQuietly. */
  private leaveQuietly(channelId: string, uid: string): Promise<void> {
    return this.channelService.leaveChannel(channelId, uid).catch(() => undefined);
  }

  /**
   * Ein blockierter Schritt darf die übrigen nicht stoppen. Fehlende Rechte sind hier normal,
   * etwa wenn ein anderer Client parallel aufräumt - deshalb ohne Eintrag in der Konsole.
   */
  /** Handles tryClear. */
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
