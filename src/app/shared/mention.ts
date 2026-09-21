import { AppUser, Channel } from './models';

export type MentionKind = 'user' | 'channel' | 'url';

export interface MentionSuggestion {
  kind: MentionKind;
  label: string;
  user?: AppUser;
  channel?: Channel;
}

export interface MessagePart extends MentionSuggestion {
  text: string;
  url?: string;
}

export interface MentionContext {
  kind: MentionKind;
  query: string;
  start: number;
}

interface FoundUrl {
  index: number;
  text: string;
}

const MENTION_PATTERN = /(^|\s)([@#])([^\s@#]*)$/;
const URL_PATTERN = /https?:\/\/[^\s<]+/gi;
const MAX_SUGGESTIONS = 6;


/** Builds mention suggestions from users. */
export function userSuggestions(users: AppUser[]): MentionSuggestion[] {
  return users.map(user => ({ kind: 'user', label: user.name, user }));
}


/** Builds mention suggestions from channels. */
export function channelSuggestions(channels: Channel[]): MentionSuggestion[] {
  return channels.map(channel => ({ kind: 'channel', label: channel.name, channel }));
}


/** Filters mention suggestions by the typed query. */
export function filterMentions(source: MentionSuggestion[], query: string): MentionSuggestion[] {
  const needle = query.toLocaleLowerCase('de');
  return source
    .filter(item => item.label.toLocaleLowerCase('de').includes(needle))
    .slice(0, MAX_SUGGESTIONS);
}


/** Reads the mention being typed at the editor caret, if any. */
export function readMentionContext(editor: HTMLTextAreaElement): MentionContext | null {
  const before = editor.value.slice(0, editor.selectionStart);
  const match = before.match(MENTION_PATTERN);
  if (!match) return null;
  return {
    kind: match[2] === '@' ? 'user' : 'channel',
    query: match[3],
    start: before.length - match[3].length - 1,
  };
}


/** Returns the text inserted when a suggestion is picked. */
export function mentionToken(suggestion: MentionSuggestion): string {
  return `${mentionPrefix(suggestion.kind)}${suggestion.label} `;
}


/** Returns all known mention targets, longest label first. */
export function mentionTargets(users: AppUser[], channels: Channel[]): MessagePart[] {
  return [...userSuggestions(users), ...channelSuggestions(channels)]
    .map(item => ({ ...item, text: `${mentionPrefix(item.kind)}${item.label}` }))
    .sort((a, b) => b.text.length - a.text.length);
}


/** Splits message text into mention, link, and plain-text parts. */
export function splitMessageParts(text: string, targets: MessagePart[]): MessagePart[] {
  const parts: MessagePart[] = [];
  const urls = extractUrls(text);
  let cursor = 0;
  while (cursor < text.length) {
    const next = nextMessagePart(text, cursor, targets, urls);
    if (!next) break;
    if (next.index > cursor) parts.push(plainPart(text.slice(cursor, next.index)));
    parts.push(next.part);
    cursor = next.index + next.part.text.length;
  }
  if (cursor < text.length) parts.push(plainPart(text.slice(cursor)));
  return parts;
}


/** Returns the character that introduces a mention kind. */
function mentionPrefix(kind: MentionKind): string {
  return kind === 'user' ? '@' : '#';
}


/** Wraps unformatted text in a message part. */
function plainPart(text: string): MessagePart {
  return { kind: 'user', label: '', text };
}


/** Collects the links contained in message text. */
function extractUrls(text: string): FoundUrl[] {
  return [...text.matchAll(URL_PATTERN)]
    .map(match => ({ index: match.index ?? 0, text: match[0].replace(/[),.!?;:]+$/, '') }));
}


/** Returns the next mention or link at or after the cursor. */
function nextMessagePart(text: string, cursor: number, targets: MessagePart[], urls: FoundUrl[]) {
  const mention = findNextMention(text, cursor, targets);
  const url = urls.find(item => item.index >= cursor);
  if (mention && (!url || mention.index <= url.index)) {
    return { index: mention.index, part: { ...mention } as MessagePart };
  }
  if (!url) return undefined;
  return { index: url.index, part: { kind: 'url' as const, label: url.text, text: url.text, url: url.text } };
}


/** Returns the known mention that appears next in the text. */
function findNextMention(text: string, from: number, targets: MessagePart[]) {
  return targets
    .map(target => ({ ...target, index: text.indexOf(target.text, from) }))
    .filter(target => target.index >= 0)
    .sort((a, b) => a.index - b.index)[0];
}
