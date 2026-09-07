import { Injectable } from '@angular/core';
import {
  addDoc,
  arrayUnion,
  collection,
  CollectionReference,
  doc,
  DocumentReference,
  Firestore,
  getFirestore,
  onSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
  Unsubscribe,
  updateDoc,
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

  private channelsRef(): CollectionReference {
    return collection(this.firestore, 'channels');
  }

  private channelRef(channelId: string): DocumentReference {
    return doc(this.firestore, 'channels', channelId);
  }
}
