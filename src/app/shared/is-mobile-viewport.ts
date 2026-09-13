/** Matches the breakpoint where the workspace shows either the menu or the chat, never both. */
export function isMobileViewport(): boolean {
  return window.matchMedia('(max-width: 767px)').matches;
}
