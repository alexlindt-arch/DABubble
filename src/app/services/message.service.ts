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
  FieldPath,
  Firestore,
  getDocs,
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

  /** A reply lives in the same collection as the channel messages and points at its parent. */
  async sendReply(channelId: string, parentId: string, text: string, senderId: string): Promise<void> {
    const profile: MessageProfile = {
      text, senderId, timestamp: Timestamp.now(), reactions: {}, threadCount: 0, parentId,
    };
    const batch = writeBatch(this.firestore);
    batch.set(doc(this.messagesRef(channelId)), profile);
    batch.update(this.messageRef(channelId, parentId), { threadCount: increment(1) });
    await batch.commit();
  }

  watchReplies(channelId: string, parentId: string, onChange: (replies: Message[]) => void): Unsubscribe {
    return onSnapshot(
      query(this.messagesRef(channelId), where('parentId', '==', parentId)),
      snapshot => onChange(snapshot.docs
        .map(item => this.toMessage(item))
        .sort((first, second) => first.timestamp.toMillis() - second.timestamp.toMillis())),
      error => console.error('Antworten konnten nicht geladen werden:', error),
    );
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

  editMessage(channelId: string, messageId: string, text: string): Promise<void> {
    return updateDoc(this.messageRef(channelId, messageId), { text, editedAt: Timestamp.now() });
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

  /** Entfernt alle Spuren eines Kontos aus einem Channel: eigene Nachrichten und eigene Reaktionen. */
  async purgeAuthor(channelId: string, uid: string): Promise<void> {
    const messages = await getDocs(this.messagesRef(channelId));
    await Promise.all(messages.docs.map(item => this.purgeMessage(channelId, item, uid)));
  }

  async deleteAllMessages(channelId: string): Promise<void> {
    const messages = await getDocs(this.messagesRef(channelId));
    await Promise.all(messages.docs.map(item => deleteDoc(item.ref)));
  }

  /** Räumt die eigenen Direktchats mit abgelaufenen Gästen; fremde Chats sind nicht lesbar. */
  async deleteDirectChatsWith(ownUid: string, guestUids: string[]): Promise<void> {
    if (!guestUids.length) return;
    const chats = await getDocs(query(this.directChatsRef(), where('members', 'array-contains', ownUid)));
    const withGuests = chats.docs.filter(chat => hasMemberIn(chat, guestUids));
    await Promise.all(withGuests.map(chat => this.deleteDirectChat(chat.ref)));
  }

  async deleteDirectChatsOf(uid: string): Promise<void> {
    const chats = await getDocs(query(this.directChatsRef(), where('members', 'array-contains', uid)));
    await Promise.all(chats.docs.map(chat => this.deleteDirectChat(chat.ref)));
  }

  private purgeMessage(channelId: string, snapshot: QueryDocumentSnapshot, uid: string): Promise<void> {
    const message = this.toMessage(snapshot);
    if (message.senderId === uid) return this.deleteWithThreadCount(channelId, message);
    const reactions = withoutReactionsOf(message.reactions, uid);
    if (!reactions) return Promise.resolve();
    // Reaktionen in fremden Channels darf nicht jeder anfassen; das blockiert den Rest nicht.
    return updateDoc(snapshot.ref, { reactions }).catch(() => undefined);
  }

  /** Die gelöschte Antwort zählt im Elternteil nicht mehr mit; ist er selbst weg, ist nichts zu tun. */
  private async deleteWithThreadCount(channelId: string, message: Message): Promise<void> {
    await deleteDoc(this.messageRef(channelId, message.id));
    if (!message.parentId) return;
    const parent = this.messageRef(channelId, message.parentId);
    await updateDoc(parent, { threadCount: increment(-1) }).catch(() => undefined);
  }

  private async deleteDirectChat(chat: DocumentReference): Promise<void> {
    const messages = await getDocs(collection(chat, 'messages'));
    await Promise.all(messages.docs.map(message => deleteDoc(message.ref)));
    await deleteDoc(chat);
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

/** Liefert die Reaktionen ohne das Konto - oder null, wenn es gar nicht reagiert hat. */
function withoutReactionsOf(reactions: Record<string, string[]>, uid: string): Record<string, string[]> | null {
  const entries = Object.entries(reactions ?? {});
  if (!entries.some(([, uids]) => uids.includes(uid))) return null;
  const cleaned = entries.map(([emoji, uids]) => [emoji, uids.filter(item => item !== uid)] as const);
  return Object.fromEntries(cleaned.filter(([, uids]) => uids.length > 0));
}

function hasMemberIn(chat: QueryDocumentSnapshot, uids: string[]): boolean {
  const members = (chat.data() as DirectConversationProfile).members;
  return members.some(member => uids.includes(member));
}
