// Play-on-Roblox entry point (user-ruled). The setup screen links to the Roblox
// experience ONLY once this URL is recorded — empty ships as NO button; the
// publish session sets it in one line. PUBLISHED 2026-08-05.
export const ROBLOX_EXPERIENCE_URL = 'https://www.roblox.com/games/78821734305285/A-World-Begun';
export const ROBLOX_LINK_LABEL = '🎮 Play on Roblox';

// Pure: the setup-screen anchor HTML, or '' when unconfigured. Only a plain
// https URL is accepted — anything else (empty, http, javascript:, data:) yields
// '' so a mis-set constant can never reach an href. New tab, noopener.
export function robloxLinkHtml(url = ROBLOX_EXPERIENCE_URL, label = ROBLOX_LINK_LABEL) {
  if (!/^https:\/\/[^\s"'<>]+$/.test(url)) return '';
  return `<a id="setup-roblox" class="setup-lan-btn" href="${url}" target="_blank" rel="noopener">${label}</a>`;
}
