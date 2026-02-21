/**
 * Injects a minimal base stylesheet the first time it's called.
 * All visual customisation happens via inline styles and theme tokens,
 * so this sheet only covers structural resets and scrollbar styling
 * that cannot be done with inline styles.
 */

const CSS = /* css */ `
/* ---- SpectroViewer base ---- */
.sv-root {
  box-sizing: border-box;
  line-height: 1.4;
}
.sv-root *, .sv-root *::before, .sv-root *::after {
  box-sizing: border-box;
}
.sv-root img {
  -webkit-user-drag: none;
}

/* Scrollbar – WebKit */
.sv-scroll-viewport::-webkit-scrollbar {
  height: 12px;
}
.sv-scroll-viewport::-webkit-scrollbar-track {
  background: var(--sv-scrollbar-track, #2d2d4a);
  border-radius: 6px;
}
.sv-scroll-viewport::-webkit-scrollbar-thumb {
  background: var(--sv-scrollbar-thumb, #6366f1);
  border-radius: 6px;
  min-width: 40px;
}
.sv-scroll-viewport::-webkit-scrollbar-thumb:hover {
  background: var(--sv-scrollbar-thumb-hover, #818cf8);
}

/* Region handles highlight on hover */
.sv-region:hover .sv-region-handle {
  background: rgba(255, 255, 255, 0.15) !important;
}
`;

let injected = false;

export function injectStyles(): void {
  if (injected) return;
  injected = true;

  const style = document.createElement('style');
  style.setAttribute('data-spectro-viewer', '');
  style.textContent = CSS;
  document.head.appendChild(style);
}
