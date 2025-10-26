import { Elysia } from 'elysia';
import { logger } from '../utils/logger';

// Verifica se o logging está habilitado via variável de ambiente
const ENABLE_LOGGING = process.env.ENABLE_LOGGING !== 'false'; // Default: true

export const loggingMiddleware = new Elysia()
    .onRequest((context) => {
        if (!ENABLE_LOGGING) return;

        const request = context.request;
        const method = request.method;
        const url = new URL(request.url);
        const path = url.pathname;
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // One-liner: apenas registra a requisição com informações essenciais
        logger.http(method, path, { ip, userAgent: userAgent.substring(0, 50) });
    })
    .onAfterHandle((context) => {
        if (!ENABLE_LOGGING) return;

        const status = context.set.status || 200;
        // Removido: log de resposta para reduzir verbosidade
    })
    .onError((context) => {
        if (!ENABLE_LOGGING) return;

        const request = context.request;
        const method = request.method;
        const url = new URL(request.url);
        const path = url.pathname;
        const error = context.error;

        // One-liner: erro com mensagem e código
        logger.error('HTTP_ERROR', `${method} ${path}`, {
            code: context.code,
            message: error instanceof Error ? error.message : String(error)
        });
    });
