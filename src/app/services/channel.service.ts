import { Injectable } from '@angular/core';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentReference,
  Firestore,
  getFirestore,
  getDocs,
  getDoc,
  onSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
  Unsubscribe,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import { Channel, ChannelProfile } from '../models';

@Injectable({ providedIn: 'root' })
/** Provides channel data and operations. */
export class ChannelService {
  private readonly firestore: Firestore = getFirestore(firebaseApp);

  /** Handles createChannel. */
  async createChannel(name: string, description: string, creatorUid: string): Promise<Channel> {
    const profile: ChannelProfile = {
      name,
      description,
      createdBy: creatorUid,
      members: [creatorUid],
      createdAt: Timestamp.now(),
    };
    const reference = await addDoc(this.channelsRef(), profile);
    return { id: reference.id, ...profile };
  }

  /** Handles watchChannels. */
  watchChannels(onChange: (channels: Channel[]) => void): Unsubscribe {
    return onSnapshot(
      this.channelsRef(),
      snapshot => onChange(snapshot.docs.map(item => this.toChannel(item))),
      error => console.error('Channels konnten nicht geladen werden:', error),
    );
  }

  /** Handles toChannel. */
  private toChannel(document: QueryDocumentSnapshot): Channel {
    return { id: document.id, ...(document.data() as ChannelProfile) };
  }

  /** Handles addMembers. */
  addMembers(channelId: string, uids: string[]): Promise<void> {
    return updateDoc(this.channelRef(channelId), { members: arrayUnion(...uids) });
  }

  /** Handles updateChannel. */
  updateChannel(channelId: string, name: string, description: string): Promise<void> {
    return updateDoc(this.channelRef(channelId), { name, description });
  }

  /** Handles leaveChannel. */
  leaveChannel(channelId: string, uid: string): Promise<void> {
    return this.removeMemberAndDeleteIfEmpty(channelId, uid);
  }

  /** Handles loadChannels. */
  async loadChannels(): Promise<Channel[]> {
    const channels = await getDocs(this.channelsRef());
    return channels.docs.map(channel => this.toChannel(channel));
  }

  /** Creates the protected welcome channel when it does not exist yet. */
  async ensureWelcomeChannel(creatorUid: string, channels: Channel[]): Promise<void> {
    const exists = channels.some(channel => channel.name.trim().toLocaleLowerCase('de') === 'willkommenschannel');
    if (exists || !channels.length) return;
    await this.createChannel('Willkommenschannel', 'Willkommen und wichtige Verhaltensregeln für alle Mitglieder.', creatorUid);
  }

  /** Handles deleteChannel. */
  deleteChannel(channelId: string): Promise<void> {
    return deleteDoc(this.channelRef(channelId));
  }

  /** Handles removeUserFromChannels. */
  async removeUserFromChannels(uid: string): Promise<void> {
    const channels = await getDocs(query(this.channelsRef(), where('members', 'array-contains', uid)));
    // Account deletion must not remove channels or their messages. Keep the
    // conversation history and only remove the deleted account from members.
    await Promise.all(channels.docs.map(channel => updateDoc(channel.ref, { members: arrayRemove(uid) })));
  }

  /** Handles removeMemberAndDeleteIfEmpty. */
  private async removeMemberAndDeleteIfEmpty(channelId: string, uid: string): Promise<void> {
    const reference = this.channelRef(channelId);
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) return;
    const members = (snapshot.data() as ChannelProfile).members ?? [];
    const remaining = members.filter(member => member !== uid);
    if (remaining.length === 0) {
      const messages = await getDocs(collection(this.firestore, 'channels', channelId, 'messages'));
      await Promise.all(messages.docs.map(message => deleteDoc(message.ref)));
      await deleteDoc(reference);
      return;
    }
    await updateDoc(reference, { members: arrayRemove(uid) });
  }

  /** Handles channelsRef. */
  private channelsRef(): CollectionReference {
    return collection(this.firestore, 'channels');
  }

  /** Handles channelRef. */
  private channelRef(channelId: string): DocumentReference {
    return doc(this.firestore, 'channels', channelId);
  }
}
