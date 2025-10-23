const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Ensure logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  console.log('✅ Created logs directory');
}

// Try to load winston-daily-rotate-file with fallback
let DailyRotateFile;
let useDailyRotate = false;
try {
  DailyRotateFile = require('winston-daily-rotate-file');
  useDailyRotate = true;
  console.log('✅ winston-daily-rotate-file loaded successfully');
} catch (err) {
  console.log('⚠️  winston-daily-rotate-file not available, using simple file transport');
  useDailyRotate = false;
}

// Custom format for better readability
const customFormat = winston.format.printf(({ level, message, timestamp, service, ...metadata }) => {
  let msg = `${timestamp} [${level}] ${message}`;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

// Build transports array
const transports = [];

// Combined logs transport (with fallback)
if (useDailyRotate) {
  try {
    transports.push(new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '100m',
      maxFiles: '14d',
      level: 'info'
    }));
    console.log('✅ DailyRotate combined transport initialized');
  } catch (err) {
    console.log('⚠️  DailyRotate combined failed, using fallback:', err.message);
    useDailyRotate = false;
  }
}

if (!useDailyRotate) {
  // Fallback to simple file transport
  transports.push(new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 104857600, // 100MB
    maxFiles: 5,
    tailable: true,
    level: 'info'
  }));
  console.log('✅ Simple File combined transport initialized (fallback)');
}

// Error logs transport (with fallback)
if (useDailyRotate) {
  try {
    transports.push(new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '30d',
      level: 'error'
    }));
  } catch (err) {
    console.log('⚠️  DailyRotate error failed, using fallback');
  }
} else {
  transports.push(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    maxsize: 52428800, // 50MB
    maxFiles: 5,
    level: 'error'
  }));
}

// Trade logs transport (filtered, with fallback)
if (useDailyRotate) {
  try {
    transports.push(new DailyRotateFile({
      filename: path.join(logDir, 'trades-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '90d',
      level: 'info',
      filter: (info) => {
        const msg = info.message?.toLowerCase() || '';
        return msg.includes('trade') || msg.includes('position') ||
               msg.includes('entry') || msg.includes('exit') ||
               msg.includes('buy') || msg.includes('sell');
      }
    }));
  } catch (err) {
    console.log('⚠️  DailyRotate trades failed, skipping');
  }
}

// Exception handlers (with fallback)
let exceptionHandlers = [];
if (useDailyRotate) {
  try {
    exceptionHandlers.push(new DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d'
    }));
  } catch (err) {
    exceptionHandlers.push(new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 52428800
    }));
  }
} else {
  exceptionHandlers.push(new winston.transports.File({
    filename: path.join(logDir, 'exceptions.log'),
    maxsize: 52428800
  }));
}

// Rejection handlers (with fallback)
let rejectionHandlers = [];
if (useDailyRotate) {
  try {
    rejectionHandlers.push(new DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d'
    }));
  } catch (err) {
    rejectionHandlers.push(new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 52428800
    }));
  }
} else {
  rejectionHandlers.push(new winston.transports.File({
    filename: path.join(logDir, 'rejections.log'),
    maxsize: 52428800
  }));
}

// Create the logger
const logger = winston.createLogger({
  level: config.logging?.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'bsc-ranging-bot' },
  transports,
  exceptionHandlers,
  rejectionHandlers
});

// Add console transport for development/testing
if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      customFormat
    ),
    level: process.env.LOG_CONSOLE_LEVEL || 'debug'
  }));
}

// Log rotation events (only if using DailyRotate)
if (useDailyRotate && transports[0] && transports[0].on) {
  transports[0].on('rotate', (oldFilename, newFilename) => {
    logger.info(`Log rotated: ${oldFilename} -> ${newFilename}`);
  });
}

// Verify file transports are working
setTimeout(() => {
  const testLogPath = path.join(logDir, useDailyRotate ? `combined-${new Date().toISOString().split('T')[0]}.log` : 'combined.log');
  if (fs.existsSync(testLogPath)) {
    console.log(`✅ Log file confirmed: ${testLogPath}`);
  } else {
    console.log(`⚠️  Warning: Log file not found at ${testLogPath}`);
  }
}, 1000);

// Add convenience methods for structured logging
logger.trade = (action, details) => {
  logger.info(`TRADE: ${action}`, { category: 'trade', ...details });
};

logger.position = (action, details) => {
  logger.info(`POSITION: ${action}`, { category: 'position', ...details });
};

logger.performance = (metric, value, details = {}) => {
  logger.info(`PERFORMANCE: ${metric} = ${value}`, { category: 'performance', metric, value, ...details });
};

logger.risk = (level, message, details = {}) => {
  const logLevel = level === 'critical' ? 'error' : level === 'high' ? 'warn' : 'info';
  logger[logLevel](`RISK [${level.toUpperCase()}]: ${message}`, { category: 'risk', riskLevel: level, ...details });
};

module.exports = logger;
