export type RoomListener<T> = (payload: T) => void;

export class RoomBroadcast<T> {
  private listeners = new Map<string, Set<RoomListener<T>>>();

  subscribe(code: string, listener: RoomListener<T>) {
    const listeners = this.listeners.get(code) ?? new Set<RoomListener<T>>();
    listeners.add(listener);
    this.listeners.set(code, listeners);

    return () => {
      const currentListeners = this.listeners.get(code);
      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);

      if (currentListeners.size === 0) {
        this.listeners.delete(code);
      }
    };
  }

  emit(code: string, payload: T) {
    const listeners = this.listeners.get(code);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      try {
        listener(payload);
      } catch {
        // Keep broadcasting even if one subscriber is stale or broken.
      }
    }
  }
}
