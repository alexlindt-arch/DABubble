import { Injectable } from '@angular/core';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  CollectionReference,
  doc,
  DocumentReference,
  Firestore,
  getFirestore,
  getDocs,
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
    return updateDoc(this.channelRef(channelId), { members: arrayRemove(uid) });
  }

  async removeUserFromChannels(uid: string): Promise<void> {
    const channels = await getDocs(query(this.channelsRef(), where('members', 'array-contains', uid)));
    await Promise.all(channels.docs.map(channel => updateDoc(channel.ref, { members: arrayRemove(uid) })));
  }

  private channelsRef(): CollectionReference {
    return collection(this.firestore, 'channels');
  }

  private channelRef(channelId: string): DocumentReference {
    return doc(this.firestore, 'channels', channelId);
  }
}
