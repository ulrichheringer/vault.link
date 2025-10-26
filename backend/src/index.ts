import { Elysia } from 'elysia';
import { db } from './db';
import { redisClient } from './redis';

import { jwt } from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

import { linksRoutes } from './modules/links/links.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { categoriesRoutes } from './modules/categories/categories.routes';
import { AppError } from './utils/errors';
import { loggingMiddleware } from './middleware/logging.middleware';
import { logger } from './utils/logger';

// Carrega o segredo do .env
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET não está definido no .env!');
}

logger.info('SERVER', 'Iniciando servidor LinkVault', { port: 3000 });

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'LinkVault API',
        version: '1.0.0',
        description: 'API para gerenciamento de links favoritos com categorias, autenticação JWT, cache Redis e sistema de logging completo.'
      },
      tags: [
        { name: 'Auth', description: 'Autenticação e registro de usuários' },
        { name: 'Links', description: 'Gerenciamento de links' },
        { name: 'Categories', description: 'Gerenciamento de categorias' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Token JWT obtido no login'
          }
        }
      }
    }
  }))
  .use(loggingMiddleware)
  .use(cors({
    origin: 'http://localhost:4321',
    credentials: true,
  }))
  .decorate('db', db)
  .decorate('redis', redisClient)
  .onError(({ code, error, set }) => {
    // Loga o erro com o logger
    logger.error('SERVER', 'Unhandled error', {
      code,
      error: error instanceof Error ? error.message : String(error)
    });

    // Se for um erro customizado (AppError ou suas subclasses)
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
      };
    }

    // Erros de validação do Elysia (schema validation)
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        error: 'Dados inválidos fornecidos',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: 'message' in error ? error.message : undefined,
      };
    }

    // Erro de Not Found (rota não existe)
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return {
        error: 'Rota não encontrada',
        code: 'NOT_FOUND',
        statusCode: 404,
      };
    }

    // Erros inesperados ou não tratados
    set.status = 500;
    return {
      error: 'Ocorreu um erro interno no servidor',
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
      // Em produção, você pode querer remover o message detalhado
      ...(process.env.NODE_ENV !== 'production' && 'message' in error && { details: error.message }),
    };
  })

  .use(
    jwt({
      name: 'jwt',
      secret: jwtSecret,
      exp: '7d',
    })
  )

  .use(authRoutes)       // Rotas públicas (/auth/login, /auth/register)
  .use(linksRoutes)      // Rotas privadas (/links)
  .use(categoriesRoutes) // Rotas privadas (/categories)

  .get('/', () => {
    logger.info('SERVER', 'Requisição à rota raiz', {});
    return 'Bem-vindo ao Link-Vault API!';
  })
  .listen(3000);

logger.info('SERVER', 'Servidor iniciado com sucesso', {
  port: 3000,
  url: 'http://localhost:3000',
  env: process.env.NODE_ENV || 'development'
});

// Exporta o tipo da aplicação para uso com Eden Treaty
export type App = typeof app;
