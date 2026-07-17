// A57: the three left-stack panels (Controls #help, Map overlays, Turn log)
// are MUTUALLY EXCLUSIVE — opening any one collapses whichever other was open,
// so the bottom-left corner never stacks two expanded panels. The reflow half
// of A57 is CSS (#left-stack is a flex column: expansion pushes, never
// covers). Programmatic opens (turnlog's first-combat reveal, main's e2e
// hook) fire the same 'toggle' event, so they participate for free.
// Call AFTER ui/overlays.js has inserted #map-overlays into the stack.
export function initLeftStack() {
  const panels = ['help', 'map-overlays', 'turn-log']
    .map(id => document.getElementById(id))
    .filter(el => el !== null);
  for (const panel of panels) {
    panel.addEventListener('toggle', () => {
      if (!panel.open) return;
      for (const other of panels) {
        if (other !== panel && other.open) other.open = false;
      }
    });
  }
}
