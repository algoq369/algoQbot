/**
 * Write Queue - Debounced file writes with batching
 * Reduces I/O operations by batching multiple writes
 */
const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

class WriteQueue {
  constructor(debounceMs = 5000, maxBatchSize = 100) {
    this.queue = new Map(); // filePath -> { data, resolve, reject }
    this.debounceMs = debounceMs;
    this.maxBatchSize = maxBatchSize;
    this.timer = null;
    this.isProcessing = false;
  }

  /**
   * Queue a write operation
   */
  async queueWrite(filePath, data, options = {}) {
    return new Promise((resolve, reject) => {
      // Store write request
      this.queue.set(filePath, {
        data,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Reset timer
      if (this.timer) {
        clearTimeout(this.timer);
      }

      // Process immediately if queue is full
      if (this.queue.size >= this.maxBatchSize) {
        this.processQueue();
      } else {
        // Otherwise debounce
        this.timer = setTimeout(() => {
          this.processQueue();
        }, this.debounceMs);
      }
    });
  }

  /**
   * Process queued writes
   */
  async processQueue() {
    if (this.isProcessing || this.queue.size === 0) {
      return;
    }

    this.isProcessing = true;
    clearTimeout(this.timer);

    const writes = Array.from(this.queue.entries());
    this.queue.clear();

    // Process writes in parallel
    const results = await Promise.allSettled(
      writes.map(async ([filePath, { data, options, resolve, reject }]) => {
        try {
          // Ensure directory exists
          const dir = path.dirname(filePath);
          await fs.mkdir(dir, { recursive: true });

          // Write file
          const tempPath = filePath + '.tmp';
          await fs.writeFile(tempPath, typeof data === 'string' ? data : JSON.stringify(data, null, 2), options);
          await fs.rename(tempPath, filePath);
          resolve();
        } catch (error) {
          logger.error(`Write queue error for ${filePath}:`, error);
          reject(error);
        }
      })
    );

    // Log results
    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      logger.warn(`Write queue: ${success} succeeded, ${failed} failed`);
    }

    this.isProcessing = false;

    // Process any new writes that came in during processing
    if (this.queue.size > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Force immediate processing
   */
  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    await this.processQueue();
  }

  /**
   * Clear queue
   */
  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.queue.forEach(({ reject }) => {
      reject(new Error('Write queue cleared'));
    });
    this.queue.clear();
  }
}

// Singleton instance
const writeQueue = new WriteQueue();

module.exports = writeQueue;

