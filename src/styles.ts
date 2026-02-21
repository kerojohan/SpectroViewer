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

/* ---- Scrollbar: thin, auto-hiding, overlay ---- */
.sv-scroll-viewport {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s;
}
.sv-scroll-viewport:hover {
  scrollbar-color: var(--sv-scrollbar-thumb, rgba(99, 102, 241, 0.5)) transparent;
}

/* WebKit (Chrome, Edge, Safari) */
.sv-scroll-viewport::-webkit-scrollbar {
  height: 6px;
  background: transparent;
}
.sv-scroll-viewport::-webkit-scrollbar-track {
  background: transparent;
}
.sv-scroll-viewport::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s;
}
.sv-scroll-viewport:hover::-webkit-scrollbar-thumb {
  background: var(--sv-scrollbar-thumb, rgba(99, 102, 241, 0.45));
}
.sv-scroll-viewport::-webkit-scrollbar-thumb:hover {
  background: var(--sv-scrollbar-thumb-hover, rgba(99, 102, 241, 0.7));
}

/* ---- Fade edges on viewport ---- */
.sv-wrapper {
  --sv-fade-width: 12px;
}
.sv-wrapper::before,
.sv-wrapper::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: var(--sv-fade-width);
  pointer-events: none;
  z-index: 40;
  opacity: 0.7;
}
.sv-wrapper::before {
  left: 0;
  background: linear-gradient(to right, var(--sv-bg, #0f0f1a), transparent);
}
.sv-wrapper::after {
  right: 0;
  background: linear-gradient(to left, var(--sv-bg, #0f0f1a), transparent);
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
