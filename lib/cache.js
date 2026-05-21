/**
 * Simple in-memory cache with TTL support
 * For iPmartGit - no external dependencies needed
 */

class Cache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  /**
   * Get value from cache
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expires && Date.now() > item.expires) {
      this.del(key);
      return null;
    }
    return item.value;
  }

  /**
   * Set value in cache
   * @param {string} key
   * @param {any} value
   * @param {number} ttl - Time to live in seconds (default: 60)
   */
  set(key, value, ttl = 60) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.store.set(key, {
      value,
      expires: Date.now() + (ttl * 1000)
    });

    // Auto-cleanup
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, ttl * 1000);

    this.timers.set(key, timer);
  }

  /**
   * Delete from cache
   * @param {string} key
   */
  del(key) {
    this.store.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * Invalidate all keys matching a pattern
   * @param {string} pattern - prefix to match
   */
  invalidate(pattern) {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.del(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.store.clear();
    this.timers.clear();
  }

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: this.store.size,
      keys: [...this.store.keys()]
    };
  }
}

// Singleton instance
const cache = new Cache();

module.exports = cache;
