const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const logger = require('../logger');

class ParallelTechnicalAnalysis {
  constructor() {
    this.workerPool = [];
    this.numWorkers = Math.min(os.cpus().length, 8); // Max 8 workers
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.taskCounter = 0;
    this.workerPath = path.join(__dirname, 'taWorker.js');
    
    this.initializeWorkers();
    logger.info(`🚀 Parallel Technical Analysis initialized with ${this.numWorkers} workers`);
  }

  // Initialize worker pool
  initializeWorkers() {
    for (let i = 0; i < this.numWorkers; i++) {
      const worker = new Worker(this.workerPath, {
        workerData: { workerId: i }
      });
      
      worker.on('message', (result) => {
        this.handleWorkerResult(result);
      });
      
      worker.on('error', (error) => {
        logger.error(`Worker ${i} error:`, error);
        this.restartWorker(i);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          logger.warn(`Worker ${i} exited with code ${code}`);
          this.restartWorker(i);
        }
      });
      
      this.workerPool.push({
        worker: worker,
        busy: false,
        id: i
      });
    }
  }

  // Restart failed worker
  restartWorker(workerId) {
    try {
      const workerInfo = this.workerPool[workerId];
      if (workerInfo.worker) {
        workerInfo.worker.terminate();
      }
      
      const newWorker = new Worker(this.workerPath, {
        workerData: { workerId: workerId }
      });
      
      newWorker.on('message', (result) => {
        this.handleWorkerResult(result);
      });
      
      newWorker.on('error', (error) => {
        logger.error(`Restarted worker ${workerId} error:`, error);
      });
      
      newWorker.on('exit', (code) => {
        if (code !== 0) {
          logger.warn(`Restarted worker ${workerId} exited with code ${code}`);
        }
      });
      
      this.workerPool[workerId] = {
        worker: newWorker,
        busy: false,
        id: workerId
      };
      
      logger.info(`✅ Worker ${workerId} restarted`);
      
    } catch (error) {
      logger.error(`Failed to restart worker ${workerId}:`, error);
    }
  }

  // Handle worker result
  handleWorkerResult(result) {
    const task = this.activeTasks.get(result.taskId);
    if (task) {
      task.resolve(result);
      this.activeTasks.delete(result.taskId);
      
      // Mark worker as available
      const workerInfo = this.workerPool[result.workerId];
      if (workerInfo) {
        workerInfo.busy = false;
      }
      
      // Process next task in queue
      this.processNextTask();
    }
  }

  // Process next task in queue
  processNextTask() {
    if (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      this.executeTask(task);
    }
  }

  // Execute task on available worker
  executeTask(task) {
    const availableWorker = this.workerPool.find(w => !w.busy);
    
    if (availableWorker) {
      availableWorker.busy = true;
      availableWorker.worker.postMessage({
        taskId: task.taskId,
        data: task.data,
        indicators: task.indicators,
        workerId: availableWorker.id
      });
    } else {
      // No available workers, add to queue
      this.taskQueue.push(task);
    }
  }

  // Calculate indicators in parallel
  async calculateIndicators(priceData, indicators = ['rsi', 'macd', 'bb', 'ema', 'sma']) {
    const startTime = performance.now();
    const taskId = ++this.taskCounter;
    
    return new Promise((resolve, reject) => {
      const task = {
        taskId: taskId,
        data: priceData,
        indicators: indicators,
        resolve: resolve,
        reject: reject,
        startTime: startTime
      };
      
      this.activeTasks.set(taskId, task);
      this.executeTask(task);
      
      // Set timeout for task
      setTimeout(() => {
        if (this.activeTasks.has(taskId)) {
          this.activeTasks.delete(taskId);
          reject(new Error('Technical analysis timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }

  // Calculate multiple indicators for multiple pairs
  async calculateMultiplePairs(pairsData, indicators = ['rsi', 'macd', 'bb']) {
    const startTime = performance.now();
    const tasks = [];
    
    // Create tasks for each pair
    for (const [pair, data] of Object.entries(pairsData)) {
      const taskId = ++this.taskCounter;
      
      tasks.push(new Promise((resolve, reject) => {
        const task = {
          taskId: taskId,
          data: data,
          indicators: indicators,
          pair: pair,
          resolve: resolve,
          reject: reject,
          startTime: startTime
        };
        
        this.activeTasks.set(taskId, task);
        this.executeTask(task);
        
        // Set timeout
        setTimeout(() => {
          if (this.activeTasks.has(taskId)) {
            this.activeTasks.delete(taskId);
            reject(new Error(`Technical analysis timeout for ${pair}`));
          }
        }, 15000); // 15 second timeout for multiple pairs
      }));
    }
    
    try {
      const results = await Promise.allSettled(tasks);
      const processedResults = {};
      
      results.forEach((result, index) => {
        const pair = Object.keys(pairsData)[index];
        if (result.status === 'fulfilled') {
          processedResults[pair] = result.value;
        } else {
          logger.error(`Technical analysis failed for ${pair}:`, result.reason);
          processedResults[pair] = { error: result.reason.message };
        }
      });
      
      const latency = performance.now() - startTime;
      logger.debug(`✅ Calculated indicators for ${Object.keys(pairsData).length} pairs in ${latency.toFixed(2)}ms`);
      
      return processedResults;
      
    } catch (error) {
      logger.error('❌ Multiple pairs technical analysis failed:', error);
      throw error;
    }
  }

  // Get available workers count
  getAvailableWorkers() {
    return this.workerPool.filter(w => !w.busy).length;
  }

  // Get worker statistics
  getWorkerStats() {
    const busy = this.workerPool.filter(w => w.busy).length;
    const available = this.workerPool.length - busy;
    
    return {
      total: this.workerPool.length,
      busy: busy,
      available: available,
      queueSize: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      utilizationPercent: ((busy / this.workerPool.length) * 100).toFixed(2)
    };
  }

  // Health check
  healthCheck() {
    const stats = this.getWorkerStats();
    const healthy = stats.available > 0 && stats.activeTasks < stats.total * 2;
    
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      stats: stats,
      timestamp: Date.now()
    };
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('🔄 Shutting down parallel technical analysis...');
    
    // Wait for active tasks to complete
    const activeTaskIds = Array.from(this.activeTasks.keys());
    if (activeTaskIds.length > 0) {
      logger.info(`Waiting for ${activeTaskIds.length} active tasks to complete...`);
      
      await Promise.allSettled(
        activeTaskIds.map(taskId => 
          new Promise(resolve => {
            const task = this.activeTasks.get(taskId);
            if (task) {
              task.resolve({ error: 'Shutdown' });
              this.activeTasks.delete(taskId);
            }
            resolve();
          })
        )
      );
    }
    
    // Terminate all workers
    await Promise.all(
      this.workerPool.map(async (workerInfo) => {
        try {
          await workerInfo.worker.terminate();
        } catch (error) {
          logger.error(`Error terminating worker ${workerInfo.id}:`, error);
        }
      })
    );
    
    logger.info('✅ Parallel technical analysis shutdown completed');
  }
}

module.exports = ParallelTechnicalAnalysis;

