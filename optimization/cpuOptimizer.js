const { exec, spawn } = require('child_process');
const os = require('os');
const logger = require('../logger');

class CPUOptimizer {
  constructor() {
    this.cpuInfo = this.getCPUInfo();
    this.numaNodes = this.getNUMANodes();
    this.coreMapping = this.getCoreMapping();
    this.optimizationApplied = false;
    
    logger.info('🚀 CPU Optimizer initialized');
  }

  // Get CPU information
  getCPUInfo() {
    const cpus = os.cpus();
    const cpuInfo = {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      speed: cpus[0]?.speed || 0,
      architecture: os.arch(),
      platform: os.platform()
    };
    
    logger.info(`CPU Info: ${cpuInfo.model}, ${cpuInfo.cores} cores, ${cpuInfo.speed}MHz`);
    return cpuInfo;
  }

  // Get NUMA node information
  getNUMANodes() {
    try {
      // Try to detect NUMA nodes (Linux only)
      if (process.platform === 'linux') {
        const result = exec('numactl --show', (error, stdout, stderr) => {
          if (!error) {
            const lines = stdout.split('\n');
            const nodeInfo = {};
            
            lines.forEach(line => {
              if (line.includes('nodebind:')) {
                nodeInfo.nodebind = line.split(':')[1].trim();
              }
              if (line.includes('membind:')) {
                nodeInfo.membind = line.split(':')[1].trim();
              }
            });
            
            logger.info(`NUMA nodes detected: ${JSON.stringify(nodeInfo)}`);
            return nodeInfo;
          }
        });
        
        return { detected: true, nodes: 1 }; // Simplified for now
      }
      
      return { detected: false, nodes: 1 };
    } catch (error) {
      logger.warn('Could not detect NUMA nodes:', error.message);
      return { detected: false, nodes: 1 };
    }
  }

  // Get core mapping for optimal thread distribution
  getCoreMapping() {
    const cores = this.cpuInfo.cores;
    const mapping = {
      critical: [],    // For critical trading threads
      normal: [],      // For normal processing threads
      background: []   // For background tasks
    };
    
    if (cores >= 8) {
      // High-end system: dedicate cores for critical tasks
      mapping.critical = [0, 1];           // Cores 0-1 for critical
      mapping.normal = [2, 3, 4, 5];       // Cores 2-5 for normal
      mapping.background = [6, 7];         // Cores 6-7 for background
    } else if (cores >= 4) {
      // Medium system: share cores efficiently
      mapping.critical = [0];              // Core 0 for critical
      mapping.normal = [1, 2];             // Cores 1-2 for normal
      mapping.background = [3];            // Core 3 for background
    } else {
      // Low-end system: use all cores for all tasks
      mapping.critical = [0];
      mapping.normal = [0, 1];
      mapping.background = [0, 1];
    }
    
    logger.info(`Core mapping: Critical=${mapping.critical}, Normal=${mapping.normal}, Background=${mapping.background}`);
    return mapping;
  }

  // Set process priority and CPU affinity
  async setPriorityAndAffinity(priority = 'high', cores = null) {
    try {
      const pid = process.pid;
      
      if (process.platform === 'linux') {
        // Set real-time priority (requires sudo)
        const niceLevel = priority === 'critical' ? -20 : priority === 'high' ? -10 : priority === 'normal' ? 0 : 10;
        
        try {
          await this.execCommand(`sudo renice ${niceLevel} ${pid}`);
          logger.info(`✅ Set process priority to ${priority} (nice ${niceLevel})`);
        } catch (error) {
          logger.warn('Could not set process priority (requires sudo):', error.message);
        }
        
        // Set CPU affinity
        if (cores && cores.length > 0) {
          const coreList = cores.join(',');
          try {
            await this.execCommand(`sudo taskset -cp ${coreList} ${pid}`);
            logger.info(`✅ Set CPU affinity to cores: ${coreList}`);
          } catch (error) {
            logger.warn('Could not set CPU affinity (requires sudo):', error.message);
          }
        }
        
      } else if (process.platform === 'darwin') {
        // macOS optimization
        try {
          const niceLevel = priority === 'critical' ? -20 : priority === 'high' ? -10 : 0;
          await this.execCommand(`sudo renice ${niceLevel} ${pid}`);
          logger.info(`✅ Set process priority to ${priority} on macOS`);
        } catch (error) {
          logger.warn('Could not set process priority on macOS:', error.message);
        }
        
      } else {
        logger.warn(`CPU optimization not supported on ${process.platform}`);
      }
      
    } catch (error) {
      logger.error('Error setting priority and affinity:', error);
    }
  }

  // Optimize Node.js for trading performance
  optimizeNodeJS() {
    try {
      // Optimize V8 flags for trading
      const optimizedFlags = [
        '--max-old-space-size=4096',        // 4GB heap
        '--max-semi-space-size=128',        // Larger young generation
        '--noconcurrent_sweeping',          // Reduce GC pauses
        '--noconcurrent_marking',           
        '--expose-gc',                      // Manual GC control
        '--trace-gc-verbose',              // GC monitoring
        '--turbo-inline-js',               // Aggressive inlining
        '--turbo-escape',                  // Escape analysis
        '--predictable',                   // Predictable performance
        '--optimize-for-size=false',       // Optimize for speed
        '--gc-interval=100',               // GC interval
        '--gc-global',                     // Global GC
        '--always-opt',                    // Always optimize
        '--max-opt-count=1000'             // Max optimization count
      ];
      
      // Add flags to process
      process.execArgv.push(...optimizedFlags);
      
      logger.info('✅ Node.js V8 optimization flags applied');
      
    } catch (error) {
      logger.error('Error optimizing Node.js:', error);
    }
  }

  // Optimize system for low latency
  async optimizeSystem() {
    try {
      if (process.platform === 'linux') {
        // Disable CPU frequency scaling for consistent performance
        try {
          await this.execCommand('sudo cpupower frequency-set -g performance');
          logger.info('✅ Set CPU governor to performance mode');
        } catch (error) {
          logger.warn('Could not set CPU governor:', error.message);
        }
        
        // Set CPU isolation for critical cores
        try {
          const criticalCores = this.coreMapping.critical.join(',');
          await this.execCommand(`echo "${criticalCores}" | sudo tee /sys/devices/system/cpu/isolated`);
          logger.info(`✅ Isolated critical cores: ${criticalCores}`);
        } catch (error) {
          logger.warn('Could not isolate CPU cores:', error.message);
        }
        
        // Optimize kernel parameters for low latency
        try {
          await this.execCommand('sudo sysctl -w kernel.sched_rt_runtime_us=-1');
          await this.execCommand('sudo sysctl -w kernel.sched_rt_period_us=1000000');
          logger.info('✅ Optimized kernel scheduler parameters');
        } catch (error) {
          logger.warn('Could not optimize kernel parameters:', error.message);
        }
        
        // Set network optimizations
        try {
          await this.execCommand('sudo sysctl -w net.core.rmem_max=16777216');
          await this.execCommand('sudo sysctl -w net.core.wmem_max=16777216');
          await this.execCommand('sudo sysctl -w net.ipv4.tcp_rmem="4096 65536 16777216"');
          await this.execCommand('sudo sysctl -w net.ipv4.tcp_wmem="4096 65536 16777216"');
          logger.info('✅ Optimized network buffer sizes');
        } catch (error) {
          logger.warn('Could not optimize network parameters:', error.message);
        }
        
      } else {
        logger.warn(`System optimization not supported on ${process.platform}`);
      }
      
    } catch (error) {
      logger.error('Error optimizing system:', error);
    }
  }

  // Pin thread to specific CPU core
  async pinThreadToCore(threadId, coreId) {
    try {
      if (process.platform === 'linux') {
        await this.execCommand(`sudo taskset -cp ${coreId} ${threadId}`);
        logger.debug(`✅ Pinned thread ${threadId} to core ${coreId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.warn(`Could not pin thread ${threadId} to core ${coreId}:`, error.message);
      return false;
    }
  }

  // Get optimal core for thread type
  getOptimalCore(threadType = 'normal') {
    const cores = this.coreMapping[threadType] || this.coreMapping.normal;
    return cores[Math.floor(Math.random() * cores.length)];
  }

  // Monitor CPU usage and performance
  startCPUMonitoring() {
    setInterval(() => {
      const loadAvg = os.loadavg();
      const freemem = os.freemem();
      const totalmem = os.totalmem();
      
      // Check for high CPU usage
      if (loadAvg[0] > this.cpuInfo.cores * 0.8) {
        logger.warn(`⚠️ High CPU load detected: ${loadAvg[0].toFixed(2)} (${this.cpuInfo.cores} cores)`);
      }
      
      // Check for memory pressure
      const memUsage = ((totalmem - freemem) / totalmem) * 100;
      if (memUsage > 90) {
        logger.warn(`⚠️ High memory usage: ${memUsage.toFixed(2)}%`);
      }
      
      logger.debug(`CPU Load: ${loadAvg[0].toFixed(2)}, Memory: ${memUsage.toFixed(2)}%`);
      
    }, 5000); // Monitor every 5 seconds
  }

  // Apply all optimizations
  async applyOptimizations() {
    if (this.optimizationApplied) {
      logger.warn('⚠️ Optimizations already applied');
      return;
    }
    
    try {
      logger.info('🚀 Applying CPU optimizations...');
      
      // Optimize Node.js
      this.optimizeNodeJS();
      
      // Set process priority and affinity
      await this.setPriorityAndAffinity('high', this.coreMapping.critical);
      
      // Optimize system (requires sudo)
      await this.optimizeSystem();
      
      // Start CPU monitoring
      this.startCPUMonitoring();
      
      this.optimizationApplied = true;
      logger.info('✅ CPU optimizations applied successfully');
      
    } catch (error) {
      logger.error('Error applying CPU optimizations:', error);
      throw error;
    }
  }

  // Execute shell command
  execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  // Get optimization status
  getOptimizationStatus() {
    return {
      applied: this.optimizationApplied,
      cpuInfo: this.cpuInfo,
      numaNodes: this.numaNodes,
      coreMapping: this.coreMapping,
      platform: process.platform,
      nodeVersion: process.version,
      execArgv: process.execArgv
    };
  }

  // Reset optimizations
  async resetOptimizations() {
    try {
      if (process.platform === 'linux') {
        // Reset CPU governor
        try {
          await this.execCommand('sudo cpupower frequency-set -g ondemand');
          logger.info('✅ Reset CPU governor to ondemand');
        } catch (error) {
          logger.warn('Could not reset CPU governor:', error.message);
        }
        
        // Reset process priority
        try {
          await this.execCommand(`sudo renice 0 ${process.pid}`);
          logger.info('✅ Reset process priority');
        } catch (error) {
          logger.warn('Could not reset process priority:', error.message);
        }
      }
      
      this.optimizationApplied = false;
      logger.info('✅ CPU optimizations reset');
      
    } catch (error) {
      logger.error('Error resetting optimizations:', error);
      throw error;
    }
  }

  // Health check
  healthCheck() {
    const loadAvg = os.loadavg();
    const freemem = os.freemem();
    const totalmem = os.totalmem();
    const memUsage = ((totalmem - freemem) / totalmem) * 100;
    
    const healthy = loadAvg[0] < this.cpuInfo.cores * 0.9 && memUsage < 95;
    
    return {
      status: healthy ? 'healthy' : 'warning',
      cpuLoad: loadAvg[0],
      memoryUsage: memUsage,
      optimizationsApplied: this.optimizationApplied,
      cpuInfo: this.cpuInfo,
      timestamp: Date.now()
    };
  }

  // Get performance recommendations
  getPerformanceRecommendations() {
    const recommendations = [];
    const loadAvg = os.loadavg();
    const freemem = os.freemem();
    const totalmem = os.totalmem();
    const memUsage = ((totalmem - freemem) / totalmem) * 100;
    
    if (loadAvg[0] > this.cpuInfo.cores * 0.8) {
      recommendations.push('Consider reducing concurrent operations or upgrading CPU');
    }
    
    if (memUsage > 85) {
      recommendations.push('Consider increasing memory or optimizing memory usage');
    }
    
    if (this.cpuInfo.cores < 4) {
      recommendations.push('Consider upgrading to a system with more CPU cores for better performance');
    }
    
    if (!this.optimizationApplied) {
      recommendations.push('Apply CPU optimizations for better trading performance');
    }
    
    return recommendations;
  }
}

module.exports = CPUOptimizer;

