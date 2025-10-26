import { Elysia } from 'elysia';
import * as AuthController from './auth.controller';
import { CreateUserSchema, LoginUserSchema, LoginResponseSchema } from './auth.models';

// Estas rotas SÃO PÚBLICAS, elas NÃO usam o auth.middleware
export const authRoutes = new Elysia({ prefix: '/auth' })
    .post(
        '/register',
        AuthController.handleRegister,
        {
            body: CreateUserSchema,
            detail: {
                summary: 'Registra um novo usuário',
                description: 'Cria uma nova conta de usuário. O username deve ser único.',
                tags: ['Auth']
            }
        }
    )
    .post(
        '/login',
        AuthController.handleLogin,
        {
            body: LoginUserSchema,
            response: LoginResponseSchema,
            detail: {
                summary: 'Loga um usuário e retorna um Bearer Token',
                description: 'Retorna um token JWT válido por 7 dias para autenticação nas rotas protegidas.',
                tags: ['Auth']
            }
        }
    );