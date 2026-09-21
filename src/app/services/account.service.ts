import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ChannelService } from './channel.service';
import { MessageService } from './message.service';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
/** Deletes a user account together with every record that belongs to it. */
export class AccountService {
  private readonly authService = inject(AuthService);
  private readonly channelService = inject(ChannelService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);

  /** Removes the account and returns an error message when it failed. */
  async deleteAccount(uid: string): Promise<string | null> {
    try {
      await this.channelService.removeUserFromChannels(uid);
      await this.messageService.deleteDirectConversationsForUser(uid);
      await this.userService.deleteUserProfile(uid);
      await this.authService.deleteCurrentAccount();
      return null;
    } catch (error) {
      return deletionMessage(error);
    }
  }
}

/** Maps an account deletion failure to a user-facing message. */
function deletionMessage(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (code === 'auth/requires-recent-login') {
    return 'Bitte melde dich erneut an und versuche es dann noch einmal.';
  }
  return 'Das Konto konnte nicht gelöscht werden.';
}
