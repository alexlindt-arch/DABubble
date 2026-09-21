import { inject, Injectable, signal } from '@angular/core';
import { AppUser, Channel, Message } from '../shared/models';
import { MessageService } from './message.service';

export type SearchResult =
  | { kind: 'channel'; id: string; label: string; channel: Channel }
  | { kind: 'user'; id: string; label: string; user: AppUser }
  | { kind: 'channel-message'; id: string; label: string; context: string; channel: Channel; message: Message; parent?: Message }
  | { kind: 'direct-message'; id: string; label: string; context: string; user: AppUser; message: Message };

/** Workspace data the search reads; the layout passes its current state. */
export interface SearchSources {
  ownUid: string | null;
  channels: Channel[];
  authors: AppUser[];
  directUserIds: string[];
}

type ChannelLoad = PromiseSettledResult<{ channel: Channel; messages: Message[] }>;
type DirectLoad = PromiseSettledResult<{ user: AppUser; messages: Message[] }>;

/** Delay before a typed query reaches Firestore, so typing stays responsive. */
const SEARCH_DELAY = 250;
/** Characters kept before and after a match in the result snippet. */
const CONTEXT_BEFORE = 38;
const CONTEXT_AFTER = 58;

@Injectable({ providedIn: 'root' })
/** Searches channel names, user names, and the text of all readable messages. */
export class MessageSearchService {
  readonly messageResults = signal<SearchResult[]>([]);
  readonly loading = signal(false);
  private readonly messageService = inject(MessageService);
  private timer?: ReturnType<typeof setTimeout>;
  private request = 0;

  /** Returns the channel and user results matching the typed query. */
  nameResults(raw: string, channels: Channel[], users: AppUser[]): SearchResult[] {
    const term = raw.trim();
    const kind = term.startsWith('#') ? 'channel' : term.startsWith('@') ? 'user' : 'all';
    const query = term.replace(/^[@#]/, '').toLocaleLowerCase('de');
    if (!query) return [];
    return [
      ...(kind === 'user' ? [] : this.channelNameResults(channels, query)),
      ...(kind === 'channel' ? [] : this.userNameResults(users, query)),
    ];
  }

  /** Schedules a debounced full-text search over all messages. */
  schedule(raw: string, sources: SearchSources): void {
    this.cancelPending();
    const term = raw.trim();
    const request = ++this.request;
    this.messageResults.set([]);
    this.loading.set(false);
    // "#" and "@" address channels and people, which nameResults already covers.
    if (!term || term.startsWith('#') || term.startsWith('@')) return;
    this.loading.set(true);
    this.timer = setTimeout(() => void this.searchMessages(term, request, sources), SEARCH_DELAY);
  }

  /** Drops all results and stops a pending search. */
  reset(): void {
    this.cancelPending();
    this.request++;
    this.messageResults.set([]);
    this.loading.set(false);
  }

  /** Stops a pending search without clearing the results. */
  cancelPending(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Returns the channels whose name matches the query. */
  private channelNameResults(channels: Channel[], query: string): SearchResult[] {
    return channels
      .filter(channel => matches(channel.name, query))
      .map(channel => ({ kind: 'channel' as const, id: `channel-${channel.id}`, label: channel.name, channel }));
  }

  /** Returns the users whose name matches the query. */
  private userNameResults(users: AppUser[], query: string): SearchResult[] {
    return users
      .filter(user => matches(user.name, query))
      .map(user => ({ kind: 'user' as const, id: `user-${user.uid}`, label: user.name, user }));
  }

  /** Loads all readable messages and publishes the matching ones. */
  private async searchMessages(term: string, request: number, sources: SearchSources): Promise<void> {
    const ownUid = sources.ownUid;
    if (!ownUid) return this.publish(request, []);
    const query = term.toLocaleLowerCase('de');
    const authorsById = new Map(sources.authors.map(user => [user.uid, user]));
    const [channelLoads, directLoads] = await this.loadMessages(ownUid, sources, authorsById);
    const results = [
      ...channelLoads.flatMap(load => this.channelResults(load, query, authorsById, ownUid)),
      ...directLoads.flatMap(load => this.directResults(load, query, ownUid)),
    ].sort((a, b) => sortKey(b) - sortKey(a));
    this.publish(request, results);
  }

  /** Loads the messages of every channel and direct conversation. */
  private loadMessages(ownUid: string, sources: SearchSources, authorsById: Map<string, AppUser>) {
    const directUsers = sources.directUserIds
      .map(userId => authorsById.get(userId))
      .filter((user): user is AppUser => !!user);
    return Promise.all([
      Promise.allSettled(sources.channels.map(async channel =>
        ({ channel, messages: await this.messageService.loadChannelMessages(channel.id) }))),
      Promise.allSettled(directUsers.map(async user =>
        ({ user, messages: await this.messageService.loadDirectMessages(ownUid, user.uid) }))),
    ]);
  }

  /** Builds the results of one loaded channel. */
  private channelResults(load: ChannelLoad, query: string, authorsById: Map<string, AppUser>, ownUid: string): SearchResult[] {
    if (load.status === 'rejected') return [];
    const { channel, messages } = load.value;
    const byId = new Map(messages.map(message => [message.id, message]));
    return messages.filter(message => matches(message.text, query)).map(message => ({
      kind: 'channel-message' as const,
      id: `channel-message-${channel.id}-${message.id}`,
      label: `#${channel.name} · ${authorLabel(message, ownUid, authorsById.get(message.senderId)?.name)}`,
      context: snippet(message.text, query),
      channel,
      message,
      parent: message.parentId ? byId.get(message.parentId) : undefined,
    }));
  }

  /** Builds the results of one loaded direct conversation. */
  private directResults(load: DirectLoad, query: string, ownUid: string): SearchResult[] {
    if (load.status === 'rejected') return [];
    const { user, messages } = load.value;
    return messages.filter(message => matches(message.text, query)).map(message => ({
      kind: 'direct-message' as const,
      id: `direct-message-${user.uid}-${message.id}`,
      label: `@${user.name} · ${authorLabel(message, ownUid, user.name)}`,
      context: snippet(message.text, query),
      user,
      message,
    }));
  }

  /** Publishes the results of the most recent request only. */
  private publish(request: number, results: SearchResult[]): void {
    if (request !== this.request) return;
    this.messageResults.set(results);
    this.loading.set(false);
  }
}

/** Checks whether a value contains the search query. */
function matches(value: string, query: string): boolean {
  return value.toLocaleLowerCase('de').includes(query);
}

/** Returns the author label of a message result. */
function authorLabel(message: Message, ownUid: string, name: string | undefined): string {
  if (message.senderId === ownUid) return 'Du';
  return name ?? 'Gelöschtes Profil';
}

/** Returns the sort key that puts the newest message first. */
function sortKey(result: SearchResult): number {
  return 'message' in result ? result.message.timestamp.toMillis() : 0;
}

/** Creates a shortened context snippet around a match. */
function snippet(text: string, query: string): string {
  const position = text.toLocaleLowerCase('de').indexOf(query);
  const start = Math.max(0, position - CONTEXT_BEFORE);
  const end = Math.min(text.length, position + query.length + CONTEXT_AFTER);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
