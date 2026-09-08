import { Injectable } from '@angular/core';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  CollectionReference,
  doc,
  DocumentReference,
  FieldPath,
  Firestore,
  getFirestore,
  increment,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  WriteBatch,
  writeBatch,
} from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import { DirectConversation, DirectConversationProfile, Message, MessageProfile } from '../models';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly firestore: Firestore = getFirestore(firebaseApp);

  async sendMessage(channelId: string, text: string, senderId: string): Promise<void> {
    const profile: MessageProfile = {
      text,
      senderId,
      timestamp: Timestamp.now(),
      reactions: {},
      threadCount: 0,
    };
    await addDoc(this.messagesRef(channelId), profile);
  }

  watchMessages(channelId: string, onChange: (messages: Message[]) => void): Unsubscribe {
    return onSnapshot(
      query(this.messagesRef(channelId), orderBy('timestamp')),
      snapshot => onChange(snapshot.docs.map(item => this.toMessage(item))),
      error => console.error('Nachrichten konnten nicht geladen werden:', error),
    );
  }

  toggleReaction(channelId: string, message: Message, emoji: string, uid: string): Promise<void> {
    const reacted = message.reactions?.[emoji]?.includes(uid) ?? false;
    return updateDoc(this.messageRef(channelId, message.id), {
      [`reactions.${emoji}`]: reacted ? arrayRemove(uid) : arrayUnion(uid),
    });
  }

  /** Ein direkter Chat hat immer dieselbe ID – egal, wer ihn öffnet. */
  directConversationId(firstUid: string, secondUid: string): string {
    return [firstUid, secondUid].sort().join('_');
  }

  async sendDirectMessage(senderId: string, recipientId: string, text: string): Promise<void> {
    const conversationId = this.directConversationId(senderId, recipientId);
    const timestamp = Timestamp.now();
    const message = doc(this.directMessagesRef(conversationId));
    const batch = writeBatch(this.firestore);
    this.stageConversation(batch, conversationId, senderId, recipientId, text, timestamp, message.id);
    this.stageDirectMessage(batch, message, senderId, text, timestamp);
    await batch.commit();
  }

  watchDirectMessages(firstUid: string, secondUid: string, onChange: (messages: Message[]) => void): Unsubscribe {
    const conversationId = this.directConversationId(firstUid, secondUid);
    return onSnapshot(
      query(this.directMessagesRef(conversationId), orderBy('timestamp')),
      snapshot => onChange(snapshot.docs.map(item => this.toMessage(item))),
      error => console.error('Direktnachrichten konnten nicht geladen werden:', error),
    );
  }

  watchDirectConversations(uid: string, onChange: (conversations: DirectConversation[]) => void): Unsubscribe {
    return onSnapshot(
      query(this.directChatsRef(), where('members', 'array-contains', uid)),
      snapshot => onChange(snapshot.docs
        .map(item => ({ id: item.id, ...(item.data() as DirectConversationProfile) }))
        .sort((first, second) => second.lastMessageAt.toMillis() - first.lastMessageAt.toMillis())),
      error => console.error('Direktnachrichten-Übersicht konnte nicht geladen werden:', error),
    );
  }

  async toggleDirectReaction(firstUid: string, secondUid: string, message: Message, emoji: string, uid: string): Promise<void> {
    const reacted = message.reactions?.[emoji]?.includes(uid) ?? false;
    const conversationId = this.directConversationId(firstUid, secondUid);
    const batch = writeBatch(this.firestore);
    batch.update(this.directMessageRef(conversationId, message.id), { [`reactions.${emoji}`]: reacted ? arrayRemove(uid) : arrayUnion(uid) });
    if (!reacted) this.stageReactionActivity(batch, conversationId, uid);
    await batch.commit();
  }

  editDirectMessage(firstUid: string, secondUid: string, messageId: string, text: string): Promise<void> {
    return updateDoc(this.directMessageRef(this.directConversationId(firstUid, secondUid), messageId), {
      text,
      editedAt: Timestamp.now(),
    });
  }

  markDirectConversationRead(readerId: string, otherUserId: string): Promise<void> {
    const conversationId = this.directConversationId(readerId, otherUserId);
    return updateDoc(this.directConversationRef(conversationId), new FieldPath('lastReadAt', readerId), Timestamp.now());
  }

  private stageConversation(batch: WriteBatch, conversationId: string, senderId: string, recipientId: string, text: string, timestamp: Timestamp, messageId: string): void {
    batch.set(this.directConversationRef(conversationId), {
      members: [senderId, recipientId].sort(), createdAt: timestamp, lastMessageAt: timestamp,
      lastMessage: text, lastMessageId: messageId, lastSenderId: senderId, lastActivityAt: timestamp,
      lastActivityBy: senderId, messageCount: increment(1),
    }, { merge: true });
  }

  private stageDirectMessage(batch: WriteBatch, message: DocumentReference, senderId: string, text: string, timestamp: Timestamp): void {
    batch.set(message, { text, senderId, timestamp, reactions: {}, threadCount: 0 } satisfies MessageProfile);
  }

  private stageReactionActivity(batch: WriteBatch, conversationId: string, uid: string): void {
    batch.update(this.directConversationRef(conversationId), { lastActivityAt: Timestamp.now(), lastActivityBy: uid });
  }

  private messageRef(channelId: string, messageId: string): DocumentReference {
    return doc(this.firestore, 'channels', channelId, 'messages', messageId);
  }

  private toMessage(document: QueryDocumentSnapshot): Message {
    return { id: document.id, ...(document.data() as MessageProfile) };
  }

  private messagesRef(channelId: string): CollectionReference {
    return collection(this.firestore, 'channels', channelId, 'messages');
  }

  private directChatsRef(): CollectionReference {
    return collection(this.firestore, 'directChats');
  }

  private directConversationRef(conversationId: string): DocumentReference {
    return doc(this.firestore, 'directChats', conversationId);
  }

  private directMessagesRef(conversationId: string): CollectionReference {
    return collection(this.firestore, 'directChats', conversationId, 'messages');
  }

  private directMessageRef(conversationId: string, messageId: string): DocumentReference {
    return doc(this.firestore, 'directChats', conversationId, 'messages', messageId);
  }
}
