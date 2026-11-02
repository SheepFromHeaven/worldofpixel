export class Events<E> {
  private readonly listeners = new Set<(event: E) => void>();

  subscribe(listener: (event: E) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: E): void {
    for (const listener of this.listeners) listener(event);
  }
}
