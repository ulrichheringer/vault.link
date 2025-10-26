import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG',
    HTTP = 'HTTP',
    DATABASE = 'DATABASE',
    CACHE = 'CACHE'
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: string;
    message: string;
    metadata?: Record<string, any>;
}

class Logger {
    private logsDir = join(process.cwd(), 'logs');
    private currentDate = new Date().toISOString().split('T')[0];
    private loggingEnabled = process.env.ENABLE_LOGGING !== 'false'; // Default: true

    constructor() {
        this.ensureLogsDirectory();
        if (this.loggingEnabled) {
            console.log(`🔍 Sistema de logging: ATIVADO`);
        } else {
            console.log(`🔇 Sistema de logging: DESATIVADO`);
        }
    }

    private async ensureLogsDirectory() {
        if (!existsSync(this.logsDir)) {
            await mkdir(this.logsDir, { recursive: true });
        }
    }

    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
        if (!metadata) return undefined;

        const sanitized = { ...metadata };

        // Remove dados sensíveis
        const sensitiveKeys = ['password', 'token', 'authorization', 'hashed_password', 'jwt', 'secret'];

        for (const key in sanitized) {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
                sanitized[key] = '***REDACTED***';
            }
        }

        return sanitized;
    }

    private formatLogEntry(entry: LogEntry): string {
        // Formato one-liner: converte metadata para string inline
        const metadataStr = entry.metadata
            ? ` | ${JSON.stringify(entry.metadata)}`
            : '';

        return `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}${metadataStr}\n`;
    }

    private async writeToFile(filename: string, content: string) {
        const filepath = join(this.logsDir, filename);

        try {
            await appendFile(filepath, content);
        } catch (error) {
            console.error('Failed to write log:', error);
        }
    }

    private async log(level: LogLevel, category: string, message: string, metadata?: Record<string, any>) {
        // Se logging estiver desabilitado, não faz nada
        if (!this.loggingEnabled) return;

        const entry: LogEntry = {
            timestamp: this.formatTimestamp(),
            level,
            category,
            message,
            metadata: this.sanitizeMetadata(metadata)
        };

        const formattedLog = this.formatLogEntry(entry);

        // Console output com cores
        const colors = {
            [LogLevel.INFO]: '\x1b[36m',      // Cyan
            [LogLevel.WARN]: '\x1b[33m',      // Yellow
            [LogLevel.ERROR]: '\x1b[31m',     // Red
            [LogLevel.DEBUG]: '\x1b[35m',     // Magenta
            [LogLevel.HTTP]: '\x1b[32m',      // Green
            [LogLevel.DATABASE]: '\x1b[34m',  // Blue
            [LogLevel.CACHE]: '\x1b[36m'      // Cyan
        };
        const reset = '\x1b[0m';

        console.log(`${colors[level]}${formattedLog.trim()}${reset}`);

        // Write to files
        await this.writeToFile(`${this.currentDate}-all.log`, formattedLog);

        if (level === LogLevel.ERROR) {
            await this.writeToFile(`${this.currentDate}-error.log`, formattedLog);
        }

        if (level === LogLevel.HTTP) {
            await this.writeToFile(`${this.currentDate}-http.log`, formattedLog);
        }

        if (level === LogLevel.DATABASE) {
            await this.writeToFile(`${this.currentDate}-database.log`, formattedLog);
        }

        if (level === LogLevel.CACHE) {
            await this.writeToFile(`${this.currentDate}-cache.log`, formattedLog);
        }
    }

    // Public methods
    info(category: string, message: string, metadata?: Record<string, any>) {
        this.log(LogLevel.INFO, category, message, metadata);
    }

    warn(category: string, message: string, metadata?: Record<string, any>) {
        this.log(LogLevel.WARN, category, message, metadata);
    }

    error(category: string, message: string, metadata?: Record<string, any>) {
        this.log(LogLevel.ERROR, category, message, metadata);
    }

    debug(category: string, message: string, metadata?: Record<string, any>) {
        this.log(LogLevel.DEBUG, category, message, metadata);
    }

    http(method: string, path: string, metadata?: Record<string, any>) {
        this.log(LogLevel.HTTP, 'HTTP', `${method} ${path}`, metadata);
    }

    database(operation: string, message: string, metadata?: Record<string, any>) {
        this.log(LogLevel.DATABASE, operation, message, metadata);
    }

    cache(operation: string, message: string, metadata?: Record<string, any>) {
        this.log(LogLevel.CACHE, operation, message, metadata);
    }
}

// Export singleton instance
export const logger = new Logger();
