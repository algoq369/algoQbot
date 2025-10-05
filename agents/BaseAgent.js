const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');
const { AgentActivity } = require('../database/models');

class BaseAgent {
  constructor(name, description) {
    this.id = uuidv4();
    this.name = name;
    this.description = description;
    this.isActive = false;
    this.lastActivity = null;
    this.performance = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0
    };
  }

  async execute(input, metadata = {}) {
    const startTime = Date.now();
    const executionId = uuidv4();
    
    try {
      logger.info(`🤖 Agent ${this.name} executing action`, { 
        executionId, 
        input: typeof input === 'string' ? input.substring(0, 100) : input 
      });

      this.isActive = true;
      this.lastActivity = new Date();
      
      // Execute the specific agent logic
      const result = await this.performAction(input, metadata);
      
      const executionTime = Date.now() - startTime;
      
      // Update performance metrics
      this.performance.totalExecutions++;
      this.performance.successfulExecutions++;
      this.performance.averageExecutionTime = 
        (this.performance.averageExecutionTime * (this.performance.totalExecutions - 1) + executionTime) / 
        this.performance.totalExecutions;

      // Log activity to database
      await this.logActivity({
        agent_name: this.name,
        action: metadata.action || 'execute',
        input: typeof input === 'string' ? input : JSON.stringify(input),
        output: typeof result === 'string' ? result : JSON.stringify(result),
        execution_time_ms: executionTime,
        success: true,
        metadata: { executionId, ...metadata }
      });

      logger.info(`✅ Agent ${this.name} completed successfully`, { 
        executionId, 
        executionTime: `${executionTime}ms` 
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Update performance metrics
      this.performance.totalExecutions++;
      this.performance.failedExecutions++;

      // Log error activity to database
      await this.logActivity({
        agent_name: this.name,
        action: metadata.action || 'execute',
        input: typeof input === 'string' ? input : JSON.stringify(input),
        output: null,
        execution_time_ms: executionTime,
        success: false,
        error_message: error.message,
        metadata: { executionId, ...metadata }
      });

      logger.error(`❌ Agent ${this.name} failed`, { 
        executionId, 
        error: error.message,
        executionTime: `${executionTime}ms` 
      });

      throw error;
    } finally {
      this.isActive = false;
    }
  }

  async performAction(input, metadata) {
    throw new Error('performAction must be implemented by subclass');
  }

  async logActivity(activityData) {
    try {
      await AgentActivity.create(activityData);
    } catch (error) {
      logger.error('Failed to log agent activity:', error);
    }
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      performance: this.performance,
      uptime: this.lastActivity ? Date.now() - this.lastActivity.getTime() : 0
    };
  }

  async healthCheck() {
    try {
      // Override in subclasses for specific health checks
      return {
        status: 'healthy',
        timestamp: new Date(),
        performance: this.performance
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }
}

module.exports = BaseAgent;
