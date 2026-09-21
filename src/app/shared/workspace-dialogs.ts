import { signal } from '@angular/core';
import { Channel } from './models';

/**
 * Which workspace dialog is open, where it is anchored, and how the member
 * dialog is configured. Keeps the layout free of a dozen loose flags.
 */
export class WorkspaceDialogs {
  profileMenu = false;
  profilePopup = false;
  profileEdit = false;
  createChannel = false;
  addPeople = false;
  members = false;
  channelInfo = false;
  memberLabel = 'Erstellen';
  memberForExistingChannel = false;
  readonly memberChannel = signal<Channel | null>(null);
  readonly addPeopleAnchor = signal<DOMRect | null>(null);
  readonly membersAnchor = signal<DOMRect | null>(null);
  readonly channelInfoAnchor = signal<DOMRect | null>(null);

  /** Shows or hides the profile menu in the header. */
  toggleProfileMenu(): void {
    this.profileMenu = !this.profileMenu;
  }

  /** Hides the profile menu. */
  closeProfileMenu(): void {
    this.profileMenu = false;
  }

  /** Opens the profile details dialog. */
  openProfilePopup(): void {
    this.profileMenu = false;
    this.profilePopup = true;
  }

  /** Closes the profile details dialog. */
  closeProfilePopup(): void {
    this.profilePopup = false;
  }

  /** Opens the profile editing dialog. */
  openProfileEdit(): void {
    this.profileEdit = true;
  }

  /** Closes the profile editing dialog. */
  closeProfileEdit(): void {
    this.profileEdit = false;
  }

  /** Opens the channel creation dialog. */
  openCreateChannel(): void {
    this.closeAddPeople();
    this.createChannel = true;
  }

  /** Closes the channel creation dialog. */
  closeCreateChannel(): void {
    this.createChannel = false;
  }

  /** Opens member selection for a channel that was just created. */
  openAddPeopleForNewChannel(channel: Channel): void {
    this.memberLabel = 'Erstellen';
    this.memberForExistingChannel = false;
    this.addPeopleAnchor.set(null);
    this.memberChannel.set(channel);
    this.addPeople = true;
  }

  /** Opens member selection for a channel that already exists. */
  openAddPeopleForChannel(channel: Channel, anchor: DOMRect | null): void {
    this.memberLabel = 'Hinzufügen';
    this.memberForExistingChannel = true;
    this.addPeopleAnchor.set(anchor);
    this.memberChannel.set(channel);
    this.addPeople = true;
  }

  /** Closes member selection and clears its state. */
  closeAddPeople(): void {
    this.addPeople = false;
    this.addPeopleAnchor.set(null);
    this.memberChannel.set(null);
  }

  /** Opens the members list of the selected channel. */
  openMembers(anchor: DOMRect): void {
    this.membersAnchor.set(anchor);
    this.members = true;
  }

  /** Closes the members list. */
  closeMembers(): void {
    this.members = false;
  }

  /** Opens the channel information dialog. */
  openChannelInfo(anchor: DOMRect): void {
    this.channelInfoAnchor.set(anchor);
    this.channelInfo = true;
  }

  /** Closes the channel information dialog. */
  closeChannelInfo(): void {
    this.channelInfo = false;
    this.channelInfoAnchor.set(null);
  }

  /** Closes every dialog that the Escape key should dismiss. */
  closeOnEscape(): void {
    this.closeProfileMenu();
    this.closeProfilePopup();
    this.closeProfileEdit();
    this.closeCreateChannel();
    this.closeAddPeople();
    this.closeMembers();
  }
}
