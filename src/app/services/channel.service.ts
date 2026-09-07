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
    return onSnapshot(this.channelsRef(), (snapshot) => {
      const channels = snapshot.docs.map(item => ({ id: item.id, ...(item.data() as ChannelProfile) }));
      onChange(channels);
    });
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
