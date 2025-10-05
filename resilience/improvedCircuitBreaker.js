const EventEmitter = require('events');
const logger = require('../logger');

/**
 * Improved Circuit Breaker with proper state machine
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, all requests fail fast
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */
class ImprovedCircuitBreaker extends EventEmitter {
  constructor(name, options = {}) {
    super();
    
    this.name = name;
    this.options = {
      failureThreshold: options.failureThreshold || 5, // Failures to open circuit
      successThreshold: options.successThreshold || 2, // Successes to close from half-open
      timeout: options.timeout || 5000, // Request timeout (ms)
      resetTimeout: options.resetTimeout || 30000, // Time before trying half-open (ms)
      monitoringPeriod: options.monitoringPeriod || 60000, // Rolling window (ms)
      ...options
    };
    
    // State machine
    this.state = 'CLOSED';
    this.states = {
      CLOSED: {
        onSuccess: () => this.onClosedSuccess(),
        onFailure: () => this.onClosedFailure(),
        onCall: (fn) => this.executeInClosed(fn)
      },
      OPEN: {
        onCall: () => this.executeInOpen(),
        onTimeout: () => this.transition('HALF_OPEN')
      },
      HALF_OPEN: {
        onSuccess: () => this.onHalfOpenSuccess(),
        onFailure: () => this.onHalfOpenFailure(),
        onCall: (fn) => this.executeInHalfOpen(fn)
      }
    };
    
    // Metrics
    this.metrics = {
      failures: 0,
      successes: 0,
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      recentCalls: [], // Rolling window
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      stateTransitions: []
    };
    
    // Timers
    this.resetTimer = null;
    this.nextAttemptTime = null;
    
    logger.info(`🔄 Circuit Breaker '${this.name}' initialized`);
  }

  // Main execution method
  async execute(fn, ...args) {
    this.metrics.totalCalls++;
    this.recordCall();
    
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN' && this.shouldAttemptReset()) {
      this.transition('HALF_OPEN');
    }
    
    // Execute based on current state
    const stateHandler = this.states[this.state];
    return await stateHandler.onCall(() => fn(...args));
  }

  // Execute in CLOSED state (normal operation)
  async executeInClosed(fn) {
    try {
      const result = await this.executeWithTimeout(fn);
      this.states[this.state].onSuccess();
      return result;
    } catch (error) {
      this.states[this.state].onFailure();
      throw error;
    }
  }

  // Execute in OPEN state (fail fast)
  async executeInOpen() {
    const error = new Error(`Circuit breaker '${this.name}' is OPEN`);
    error.code = 'CIRCUIT_BREAKER_OPEN';
    throw error;
  }

  // Execute in HALF_OPEN state (testing recovery)
  async executeInHalfOpen(fn) {
    try {
      const result = await this.executeWithTimeout(fn);
      this.states[this.state].onSuccess();
      return result;
    } catch (error) {
      this.states[this.state].onFailure();
      throw error;
    }
  }

  // Execute function with timeout
  async executeWithTimeout(fn) {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Circuit breaker timeout')), this.options.timeout)
      )
    ]);
  }

  // CLOSED state success handler
  onClosedSuccess() {
    this.metrics.successes++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessTime = Date.now();
    this.emit('success', { state: this.state });
  }

  // CLOSED state failure handler
  onClosedFailure() {
    this.metrics.failures++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = Date.now();
    
    // Check if we should open the circuit
    const recentFailureRate = this.calculateRecentFailureRate();
    
    if (this.metrics.consecutiveFailures >= this.options.failureThreshold || 
        recentFailureRate > 0.5) {
      this.transition('OPEN');
    }
    
    this.emit('failure', { state: this.state });
  }

  // HALF_OPEN state success handler
  onHalfOpenSuccess() {
    this.metrics.successes++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessTime = Date.now();
    
    // Check if we should close the circuit
    if (this.metrics.consecutiveSuccesses >= this.options.successThreshold) {
      this.transition('CLOSED');
    }
    
    this.emit('success', { state: this.state });
  }

  // HALF_OPEN state failure handler
  onHalfOpenFailure() {
    this.metrics.failures++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = Date.now();
    
    // Immediately reopen the circuit
    this.transition('OPEN');
    
    this.emit('failure', { state: this.state });
  }

  // Transition between states
  transition(newState) {
    const oldState = this.state;
    
    if (oldState === newState) return;
    
    this.state = newState;
    this.metrics.stateTransitions.push({
      from: oldState,
      to: newState,
      timestamp: Date.now()
    });
    
    // Keep only recent transitions
    if (this.metrics.stateTransitions.length > 100) {
      this.metrics.stateTransitions = this.metrics.stateTransitions.slice(-100);
    }
    
    logger.info(`🔄 Circuit Breaker '${this.name}': ${oldState} → ${newState}`);
    this.emit('stateChange', { from: oldState, to: newState });
    
    // Handle state-specific actions
    if (newState === 'OPEN') {
      this.onEnterOpen();
    } else if (newState === 'HALF_OPEN') {
      this.onEnterHalfOpen();
    } else if (newState === 'CLOSED') {
      this.onEnterClosed();
    }
  }

  // Actions when entering OPEN state
  onEnterOpen() {
    this.nextAttemptTime = Date.now() + this.options.resetTimeout;
    
    // Set timer to transition to HALF_OPEN
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    
    this.resetTimer = setTimeout(() => {
      if (this.state === 'OPEN') {
        this.transition('HALF_OPEN');
      }
    }, this.options.resetTimeout);
    
    this.emit('open');
  }

  // Actions when entering HALF_OPEN state
  onEnterHalfOpen() {
    // Reset consecutive counters
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.consecutiveFailures = 0;
    
    this.emit('halfOpen');
  }

  // Actions when entering CLOSED state
  onEnterClosed() {
    // Reset metrics
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.consecutiveFailures = 0;
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    
    this.emit('close');
  }

  // Check if we should attempt reset from OPEN
  shouldAttemptReset() {
    return this.nextAttemptTime && Date.now() >= this.nextAttemptTime;
  }

  // Record call in rolling window
  recordCall() {
    const now = Date.now();
    this.metrics.recentCalls.push(now);
    
    // Remove old calls outside monitoring period
    this.metrics.recentCalls = this.metrics.recentCalls.filter(
      time => now - time < this.options.monitoringPeriod
    );
  }

  // Calculate recent failure rate
  calculateRecentFailureRate() {
    const recentPeriod = Date.now() - this.options.monitoringPeriod;
    const recentFailures = this.metrics.recentCalls.filter(
      time => time >= recentPeriod
    ).length;
    
    const recentTotal = this.metrics.recentCalls.length;
    
    return recentTotal > 0 ? recentFailures / recentTotal : 0;
  }

  // Get current state
  getState() {
    return this.state;
  }

  // Check if circuit is open
  isOpen() {
    return this.state === 'OPEN';
  }

  // Check if circuit is closed
  isClosed() {
    return this.state === 'CLOSED';
  }

  // Check if circuit is half-open
  isHalfOpen() {
    return this.state === 'HALF_OPEN';
  }

  // Get statistics
  getStats() {
    const totalCalls = this.metrics.totalCalls;
    const totalFailures = this.metrics.totalFailures;
    const failureRate = totalCalls > 0 ? (totalFailures / totalCalls * 100).toFixed(2) : 0;
    
    return {
      name: this.name,
      state: this.state,
      failures: this.metrics.failures,
      successes: this.metrics.successes,
      consecutiveFailures: this.metrics.consecutiveFailures,
      consecutiveSuccesses: this.metrics.consecutiveSuccesses,
      totalCalls: totalCalls,
      totalFailures: totalFailures,
      totalSuccesses: this.metrics.totalSuccesses,
      failureRate: failureRate + '%',
      lastFailureTime: this.metrics.lastFailureTime,
      lastSuccessTime: this.metrics.lastSuccessTime,
      recentCalls: this.metrics.recentCalls.length,
      nextAttemptTime: this.nextAttemptTime,
      recentTransitions: this.metrics.stateTransitions.slice(-10)
    };
  }

  // Health check
  healthCheck() {
    const stats = this.getStats();
    const healthy = this.state === 'CLOSED' || this.state === 'HALF_OPEN';
    
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      state: this.state,
      stats: stats,
      recommendations: this.getRecommendations()
    };
  }

  // Get recommendations
  getRecommendations() {
    const recommendations = [];
    
    if (this.state === 'OPEN') {
      const timeUntilHalfOpen = this.nextAttemptTime ? 
        Math.max(0, this.nextAttemptTime - Date.now()) : 0;
      recommendations.push(`Circuit will attempt recovery in ${(timeUntilHalfOpen / 1000).toFixed(0)}s`);
    }
    
    if (this.metrics.consecutiveFailures > 3) {
      recommendations.push('High consecutive failures - check service health');
    }
    
    const failureRate = parseFloat(this.getStats().failureRate);
    if (failureRate > 20) {
      recommendations.push(`High failure rate (${failureRate}%) - investigate root cause`);
    }
    
    return recommendations;
  }

  // Manually reset circuit breaker
  reset() {
    logger.warn(`⚠️ Manual reset of circuit breaker '${this.name}'`);
    this.transition('CLOSED');
    this.metrics.consecutiveFailures = 0;
    this.metrics.consecutiveSuccesses = 0;
  }

  // Force open circuit breaker
  forceOpen(reason) {
    logger.warn(`⚠️ Forcing circuit breaker '${this.name}' to OPEN: ${reason}`);
    this.transition('OPEN');
  }

  // Cleanup
  destroy() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.removeAllListeners();
    logger.info(`✅ Circuit Breaker '${this.name}' destroyed`);
  }
}

module.exports = ImprovedCircuitBreaker;

