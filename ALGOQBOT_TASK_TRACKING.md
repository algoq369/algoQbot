# AlgoQBot Task Tracking - Last Active Task Feature

## Overview

AlgoQBot now includes comprehensive task tracking capabilities, allowing you to see what your autonomous trading agent is currently doing and what it did previously. This feature is essential for monitoring agent activity and understanding task execution patterns.

## Features

### 1. **Last Active Task**
View the most recently executed or currently active task.

- **Current Status**: Whether the task is running, completed, or failed
- **Task Details**: Name, type, timestamps, duration
- **Results**: Outcome of the task if completed or error message if failed
- **Metadata**: Additional context about the task

### 2. **Active Tasks**
Monitor all tasks currently running in parallel.

- **Count**: Number of active tasks
- **Task List**: Details of each running task
- **Real-time Updates**: Get current status of ongoing operations

### 3. **Task History**
Review past tasks with full execution history.

- **Chronological Order**: Most recent tasks first
- **Performance Metrics**: Duration, results, metadata
- **Status Tracking**: Track successes, failures, and completions
- **Customizable Limit**: Request last N tasks (default: 20)

### 4. **Full Agent Status**
Comprehensive view of AlgoQBot status including tasks.

- **Agent Identity**: Name, version, creation date
- **Performance Metrics**: Conversation count, trades discussed
- **Learning Progress**: Lessons learned, improvements proposed
- **Task Overview**: Active count, last task, recent tasks

## API Endpoints

### Get Last Active Task
```
GET /api/algoqbot/last-active-task
```

Returns the most recently executed or active task.

**Response:**
```json
{
  "success": true,
  "lastActiveTask": {
    "id": "task_1764317064320_c4zucut2i",
    "name": "Market Analysis",
    "type": "analysis",
    "status": "completed",
    "startTime": "2025-11-28T08:04:23.318Z",
    "endTime": "2025-11-28T08:04:24.319Z",
    "duration": 1001,
    "metadata": {
      "pair": "BNB/USDT",
      "timeframe": "4h"
    },
    "result": {
      "trend": "bullish",
      "strength": 0.75
    }
  },
  "timestamp": "2025-11-28T08:04:25.000Z"
}
```

### Get All Active Tasks
```
GET /api/algoqbot/active-tasks
```

Returns all currently running tasks.

**Response:**
```json
{
  "success": true,
  "activeCount": 2,
  "activeTasks": [
    {
      "id": "task_1764317064823_9fnib0iyq",
      "name": "Portfolio Rebalancing",
      "type": "execution",
      "status": "running",
      "startTime": "2025-11-28T08:04:24.823Z",
      "endTime": null,
      "duration": null,
      "metadata": {
        "allocation": "equal"
      },
      "result": null
    },
    {
      "id": "task_1764317064320_kqa0yy4p5",
      "name": "Price Monitoring",
      "type": "monitoring",
      "status": "running",
      "startTime": "2025-11-28T08:04:24.320Z",
      "endTime": null,
      "duration": null,
      "metadata": {
        "pair": "BNB/USDT"
      },
      "result": null
    }
  ],
  "timestamp": "2025-11-28T08:04:25.000Z"
}
```

### Get Task History
```
GET /api/algoqbot/task-history?limit=20
```

Returns historical tasks. Use `limit` query parameter to specify number of tasks (default: 20, max: 100).

**Response:**
```json
{
  "success": true,
  "historyCount": 3,
  "taskHistory": [
    {
      "id": "task_1764317064320_c4zucut2i",
      "name": "Signal Detection",
      "type": "strategy",
      "status": "failed",
      "startTime": "2025-11-28T08:04:24.320Z",
      "endTime": "2025-11-28T08:04:24.822Z",
      "duration": 502,
      "metadata": {
        "indicator": "RSI",
        "retry_count": 3
      },
      "result": {
        "error": "Connection timeout"
      }
    },
    {
      "id": "task_1764317064320_7kr28rxos",
      "name": "Price Monitoring",
      "type": "monitoring",
      "status": "completed",
      "startTime": "2025-11-28T08:04:24.320Z",
      "endTime": "2025-11-28T08:04:24.821Z",
      "duration": 501,
      "metadata": {
        "pair": "BNB/USDT"
      },
      "result": {
        "price": 625.5
      }
    },
    {
      "id": "task_1764317063318_kqa0yy4p5",
      "name": "Market Analysis",
      "type": "analysis",
      "status": "completed",
      "startTime": "2025-11-28T08:04:23.318Z",
      "endTime": "2025-11-28T08:04:24.319Z",
      "duration": 1001,
      "metadata": {
        "pair": "BNB/USDT",
        "timeframe": "4h",
        "analysis_time": "1000ms"
      },
      "result": {
        "trend": "bullish",
        "strength": 0.75
      }
    }
  ],
  "timestamp": "2025-11-28T08:04:25.000Z"
}
```

### Get Full Agent Status
```
GET /api/algoqbot/status
```

Returns comprehensive status including all task information.

**Response:**
```json
{
  "success": true,
  "algoqbotStatus": {
    "identity": {
      "name": "AlgoQBot #1",
      "version": "1.0.0",
      "birth_date": "2025-11-28T08:04:23.000Z",
      "creator": "Initiateur (Sheirraza)",
      "purpose": "Autonomous trading agent learning from creator",
      "instance_number": 1,
      "status": "learning"
    },
    "performance": {
      "conversations": 5,
      "trades_discussed": 2,
      "improvements_implemented": 1,
      "profitability_change": 0
    },
    "learning": {
      "total_lessons": 3,
      "recent_lessons": [
        {
          "timestamp": "2025-11-28T08:04:20.000Z",
          "category": "risk_management",
          "teaching": "Always use proper stop loss"
        }
      ],
      "improvement_proposals": 2
    },
    "trading": {
      "decisions_made": 4,
      "last_decision": {
        "action": "BUY",
        "confidence": 85
      }
    },
    "tasks": {
      "active_count": 0,
      "last_active_task": {
        "id": "task_1764317064823_9fnib0iyq",
        "name": "Portfolio Rebalancing",
        "type": "execution",
        "status": "completed",
        "startTime": "2025-11-28T08:04:24.823Z",
        "endTime": "2025-11-28T08:04:24.825Z",
        "duration": 2,
        "metadata": {
          "allocation": "equal"
        },
        "result": {
          "success": true
        }
      },
      "recent_tasks": [
        {
          "id": "task_1764317064823_9fnib0iyq",
          "name": "Portfolio Rebalancing",
          "type": "execution",
          "status": "completed",
          "startTime": "2025-11-28T08:04:24.823Z",
          "endTime": "2025-11-28T08:04:24.825Z",
          "duration": 2,
          "metadata": {
            "allocation": "equal"
          },
          "result": {
            "success": true
          }
        }
      ]
    }
  },
  "timestamp": "2025-11-28T08:04:25.000Z"
}
```

## Task Object Structure

Each task contains the following properties:

```javascript
{
  id: string,              // Unique task identifier (task_${timestamp}_${random})
  name: string,            // Human-readable task name
  type: string,            // Task type/category (e.g., 'analysis', 'monitoring', 'execution')
  status: string,          // 'running' | 'completed' | 'failed'
  startTime: string,       // ISO 8601 timestamp when task started
  endTime: string|null,    // ISO 8601 timestamp when task ended (null if running)
  duration: number|null,   // Duration in milliseconds (null if running)
  metadata: object,        // Custom metadata passed when task was created/ended
  result: any|null         // Task result or error object
}
```

## Task Types

Common task types used by AlgoQBot:

- **analysis**: Market/portfolio analysis tasks
- **monitoring**: Real-time monitoring tasks
- **strategy**: Strategy execution and signal detection
- **execution**: Trade execution and position management
- **chat**: Chat/conversation tasks
- **learning**: Learning and improvement tasks
- **general**: Generic tasks (default)

## Task Statuses

- **running**: Task is currently executing
- **completed**: Task finished successfully
- **failed**: Task encountered an error

## JavaScript API

### Starting a Task
```javascript
const taskId = agent.startTask(
  'Task Name',           // Task name
  'analysis',            // Task type
  { pair: 'BNB/USDT' }   // Metadata
);
```

### Completing a Task
```javascript
const completed = agent.endTask(
  taskId,                    // Task ID returned from startTask
  { trend: 'bullish' },      // Result
  { analysis_time: '1000ms' }// Additional metadata
);
```

### Failing a Task
```javascript
const failed = agent.failTask(
  taskId,                    // Task ID
  new Error('Timeout'),      // Error
  { retry_count: 3 }         // Metadata
);
```

### Getting Task Information
```javascript
// Get last active task
const lastTask = agent.getLastActiveTask();

// Get count of active tasks
const count = agent.getActiveTasksCount();

// Get all active tasks
const activeTasks = agent.getAllActiveTasks();

// Get task history (last 20 by default)
const history = agent.getTaskHistory(20);

// Get full status
const status = agent.getStatus();
```

## Memory Persistence

Task data is automatically persisted to:
```
/data/algoqbot-agent/agent-memory.json
```

This includes:
- Last active task
- Task history (last 100 tasks)
- Full agent state

Task information survives bot restarts and is restored from memory on initialization.

## Monitoring Examples

### Real-time Task Monitoring
```javascript
setInterval(async () => {
  const response = await fetch('http://localhost:3000/api/algoqbot/last-active-task');
  const data = await response.json();
  console.log('Last task:', data.lastActiveTask);
}, 5000); // Check every 5 seconds
```

### Check for Failed Tasks
```javascript
const response = await fetch('http://localhost:3000/api/algoqbot/task-history?limit=10');
const data = await response.json();
const failedTasks = data.taskHistory.filter(t => t.status === 'failed');
console.log('Failed tasks:', failedTasks);
```

### Monitor Active Task Count
```javascript
const response = await fetch('http://localhost:3000/api/algoqbot/active-tasks');
const data = await response.json();
if (data.activeCount > 5) {
  console.warn('High task load:', data.activeCount);
}
```

## Performance Considerations

- **Task History**: Limited to last 100 tasks to manage memory
- **Active Tasks**: Typically small number (rarely more than 5-10 concurrent tasks)
- **Memory Persistence**: Async save operation, non-blocking
- **API Response Time**: Minimal overhead, returns pre-computed data

## Best Practices

1. **Use Descriptive Task Names**: Help identify what the task does
2. **Set Appropriate Types**: Use consistent types for categorization
3. **Add Relevant Metadata**: Include information needed for debugging/analysis
4. **Check Status Regularly**: Monitor active tasks for long-running operations
5. **Handle Errors Gracefully**: Use failTask to properly record failures

## Integration with Trading Bot

AlgoQBot task tracking integrates seamlessly with the trading bot's operations:

```javascript
// In trading strategy
const taskId = this.algoqbot.startTask('Trade Execution', 'execution', {
  pair: 'BNB/USDT',
  action: 'BUY',
  amount: 1.5
});

try {
  const result = await executeTrade(...);
  this.algoqbot.endTask(taskId, result, { gas_used: result.gasUsed });
} catch (error) {
  this.algoqbot.failTask(taskId, error);
}
```

## Testing

Test the task tracking feature:
```bash
node scripts/test-algoqbot-tasks.js
```

This will run comprehensive tests covering:
- Task creation and completion
- Concurrent task handling
- Task failure scenarios
- Memory persistence
- Status retrieval
