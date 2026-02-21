/**
 * Tiny typed event emitter – zero dependencies.
 *
 * Generic parameter `T` maps event names to their argument tuples,
 * giving full type safety at call sites.
 */
export class EventEmitter<T extends { [K in keyof T]: unknown[] }> {
  private listeners = new Map<keyof T, Set<(...args: any[]) => void>>();

  on<K extends keyof T>(event: K, fn: (...args: T[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => this.off(event, fn);
  }

  once<K extends keyof T>(event: K, fn: (...args: T[K]) => void): () => void {
    const wrapper = (...args: T[K]) => {
      this.off(event, wrapper);
      fn(...args);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof T>(event: K, fn: (...args: T[K]) => void): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    this.listeners.get(event)?.forEach(fn => {
      try { fn(...args); } catch (e) { console.error(`[SpectroViewer] Error in "${String(event)}" handler:`, e); }
    });
  }

  removeAllListeners(event?: keyof T): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
