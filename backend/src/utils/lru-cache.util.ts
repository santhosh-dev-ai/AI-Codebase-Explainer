/**
 * Lightweight, generic Least Recently Used (LRU) cache with O(1) operations.
 * Relies on ES2015 Map key iteration order (oldest inserted / least recently refreshed first).
 */
export class LruCache<K, V> {
  private map: Map<K, V> = new Map();
  private maxCapacity: number;
  private onEvict?: (key: K, value: V) => void;

  constructor(maxCapacity: number, onEvict?: (key: K, value: V) => void) {
    this.maxCapacity = Math.max(1, maxCapacity);
    this.onEvict = onEvict;
  }

  get(key: K): V | undefined {
    const item = this.map.get(key);
    if (item !== undefined) {
      // Re-insert to refresh recency (moves to end of iteration order)
      this.map.delete(key);
      this.map.set(key, item);
    }
    return item;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxCapacity) {
      // Evict least recently used (first item in Map iterator)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        const oldestValue = this.map.get(oldestKey);
        this.map.delete(oldestKey);
        if (this.onEvict && oldestValue !== undefined) {
          this.onEvict(oldestKey, oldestValue);
        }
      }
    }
    this.map.set(key, value);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  get capacity(): number {
    return this.maxCapacity;
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }
}
