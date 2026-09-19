import { useEffect, useRef } from 'react';

function isTypingTarget(target) {
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
}

// Shortcuts that still work while a text field has focus.
const WORKS_WHILE_TYPING = new Set(['mod+s', 'escape']);

/**
 * Global keyboard shortcuts. `bindings` maps a key to a handler:
 *   { e: fn, '/': fn, '?': fn, 'mod+s': fn, escape: fn }
 * "mod" is Ctrl on Windows/Linux and Cmd on macOS. Plain keys are ignored
 * while the user is typing in a field, so typing "e" never opens a panel.
 */
export function useHotkeys(bindings) {
  const latest = useRef(bindings);
  latest.current = bindings;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey) return;
      const combo = `${event.ctrlKey || event.metaKey ? 'mod+' : ''}${event.key.toLowerCase()}`;
      const handler = latest.current[combo];
      if (!handler) return;
      if (isTypingTarget(event.target) && !WORKS_WHILE_TYPING.has(combo)) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
