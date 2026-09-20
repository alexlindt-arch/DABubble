import { Injectable } from '@angular/core';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  CollectionReference,
  doc,
  deleteDoc,
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
export class ChannelService {
  private readonly firestore: Firestore = getFirestore(firebaseApp);

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

  watchChannels(onChange: (channels: Channel[]) => void): Unsubscribe {
    return onSnapshot(
      this.channelsRef(),
      snapshot => onChange(snapshot.docs.map(item => this.toChannel(item))),
      error => console.error('Channels konnten nicht geladen werden:', error),
    );
  }

  private toChannel(document: QueryDocumentSnapshot): Channel {
    return { id: document.id, ...(document.data() as ChannelProfile) };
  }

  addMembers(channelId: string, uids: string[]): Promise<void> {
    return updateDoc(this.channelRef(channelId), { members: arrayUnion(...uids) });
  }

  updateChannel(channelId: string, name: string, description: string): Promise<void> {
    return updateDoc(this.channelRef(channelId), { name, description });
  }

  leaveChannel(channelId: string, uid: string): Promise<void> {
    return this.removeMemberAndDeleteIfEmpty(channelId, uid);
  }

  async removeUserFromChannels(uid: string): Promise<void> {
    const channels = await getDocs(query(this.channelsRef(), where('members', 'array-contains', uid)));
    // Account deletion must not remove channels or their messages. Keep the
    // conversation history and only remove the deleted account from members.
    await Promise.all(channels.docs.map(channel => updateDoc(channel.ref, { members: arrayRemove(uid) })));
  }

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

  private channelsRef(): CollectionReference {
    return collection(this.firestore, 'channels');
  }

  private channelRef(channelId: string): DocumentReference {
    return doc(this.firestore, 'channels', channelId);
  }
}
