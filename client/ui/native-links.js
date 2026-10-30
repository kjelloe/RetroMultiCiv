// fe-R6: the native client's download line on the setup screen, mirroring
// CarrierDominion's client/native.js. The server says what is on offer at
// /native.json (server/native.js); with nothing configured, or a static host
// that has no such endpoint, the line never appears. Hidden on touch screens
// by CSS: the builds are Windows and Linux.

export function describeSize(bytes) {
  const mb = bytes / 1048576;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${Math.max(0.1, Math.round(mb * 10) / 10)} MB`;
}

const TARGETS = [
  { suffix: /-win64\.zip$/i, platform: 'Windows' },
  { suffix: /-linux64\.zip$/i, platform: 'Linux' }
];

// PURE: [{ label, href, external }] for a /native.json listing; [] for none
export function nativeLinks(listing) {
  if (listing === null || typeof listing !== 'object') return [];
  if (listing.kind === 'url') return [{ label: 'Download the native client ↗', href: listing.url, external: true }];
  if (listing.kind !== 'folder' || !Array.isArray(listing.files)) return [];
  return listing.files.map(file => {
    const target = TARGETS.find(t => t.suffix.test(file.name));
    const size = `${file.name} (${describeSize(file.size)})`;
    return { label: target ? `${target.platform} · ${size}` : size, href: file.url, external: false };
  });
}

export async function loadNativeLinks(box) {
  let listing = null;
  try {
    const r = await fetch('/native.json', { cache: 'no-cache' });
    if (r.ok) listing = await r.json();
  } catch (e) { /* no endpoint: no line */ }
  const links = nativeLinks(listing);
  box.textContent = '';
  box.hidden = links.length === 0;
  if (links.length === 0) return;
  const caption = document.createElement('div');
  caption.textContent = '⬇ Native client (desktop):';
  box.append(caption);
  for (const link of links) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    if (link.external) { a.target = '_blank'; a.rel = 'noopener'; } else a.setAttribute('download', '');
    const row = document.createElement('div');
    row.append(a);
    box.append(row);
  }
}
