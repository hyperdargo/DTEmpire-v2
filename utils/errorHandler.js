const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ErrorHandler {
    constructor() {
        this.logDir = path.join(__dirname, '../data/logs');
        this.crashLogFile = path.join(this.logDir, 'crash.log');
        this.errorLogFile = path.join(this.logDir, 'error.log');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Log a critical error that caused a crash
     */
    logCrash(error, context = '') {
        const timestamp = new Date().toISOString();
        const errorEntry = `
╔════════════════════════════════════════════════════════════╗
║ CRITICAL ERROR - ${timestamp}
║ Context: ${context || 'Unknown'}
╚════════════════════════════════════════════════════════════╝
Message: ${error.message}
Type: ${error.name}
Stack:
${error.stack}
═════════════════════════════════════════════════════════════

`;
        
        // Write to crash log
        fs.appendFileSync(this.crashLogFile, errorEntry, 'utf8');
        
        // Also log to console and logger
        console.error('🔴 CRITICAL ERROR:', error.message);
        logger.error(`CRITICAL ERROR [${context}]: ${error.message}`, error);
    }

    /**
     * Log a general error
     */
    logError(error, context = '') {
        const timestamp = new Date().toISOString();
        const errorEntry = `[${timestamp}] [${context || 'ERROR'}] ${error.message}\nStack: ${error.stack}\n`;
        
        // Write to error log
        fs.appendFileSync(this.errorLogFile, errorEntry, 'utf8');
        
        // Also log to logger
        logger.error(`${context}: ${error.message}`, error);
    }

    /**
     * Log an error that occurred in a command
     */
    logCommandError(error, commandName, userId, guildId) {
        const context = `Command: ${commandName} | User: ${userId} | Guild: ${guildId}`;
        this.logError(error, `COMMAND_ERROR: ${context}`);
    }

    /**
     * Log an error that occurred in an event
     */
    logEventError(error, eventName, data = {}) {
        const context = `Event: ${eventName} | Data: ${JSON.stringify(data)}`;
        this.logError(error, `EVENT_ERROR: ${context}`);
    }

    /**
     * Get recent errors from the log files
     */
    getRecentErrors(lines = 50) {
        try {
            if (!fs.existsSync(this.errorLogFile)) {
                return 'No errors logged yet.';
            }

            const content = fs.readFileSync(this.errorLogFile, 'utf8');
            const errorLines = content.split('\n');
            return errorLines.slice(-lines).join('\n');
        } catch (error) {
            return `Failed to read error log: ${error.message}`;
        }
    }

    /**
     * Get recent crashes from the crash log
     */
    getRecentCrashes(lines = 50) {
        try {
            if (!fs.existsSync(this.crashLogFile)) {
                return 'No crashes logged yet.';
            }

            const content = fs.readFileSync(this.crashLogFile, 'utf8');
            const crashLines = content.split('\n');
            return crashLines.slice(-lines).join('\n');
        } catch (error) {
            return `Failed to read crash log: ${error.message}`;
        }
    }

    /**
     * Clear error logs
     */
    clearErrorLogs() {
        try {
            if (fs.existsSync(this.errorLogFile)) {
                fs.unlinkSync(this.errorLogFile);
            }
            logger.info('Error logs cleared');
        } catch (error) {
            logger.error('Failed to clear error logs', error);
        }
    }

    /**
     * Clear crash logs
     */
    clearCrashLogs() {
        try {
            if (fs.existsSync(this.crashLogFile)) {
                fs.unlinkSync(this.crashLogFile);
            }
            logger.info('Crash logs cleared');
        } catch (error) {
            logger.error('Failed to clear crash logs', error);
        }
    }

    /**
     * Get log file paths
     */
    getLogPaths() {
        return {
            errorLog: this.errorLogFile,
            crashLog: this.crashLogFile,
            logDir: this.logDir
        };
    }
}

module.exports = new ErrorHandler();
