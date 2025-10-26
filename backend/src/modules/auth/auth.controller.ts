import * as AuthService from './auth.service';
import type { CreateUserSchema, LoginUserSchema } from './auth.models';
import { AppError } from '../../utils/errors';

// POST /auth/register
export async function handleRegister({ body, set }: any) {
    try {
        const user = await AuthService.registerUser(body as typeof CreateUserSchema.static);

        set.status = 201; // Created
        return user;
    } catch (error) {
        // Se for um erro customizado, propaga para o handler global
        if (error instanceof AppError) {
            throw error;
        }

        // Erro inesperado
        console.error('Erro inesperado no registro:', error);
        throw new AppError('Erro ao criar usuário', 500);
    }
}

// POST /auth/login
export async function handleLogin({ body, set, jwt }: any) {
    try {
        console.log('🔐 [LOGIN] Tentativa de login para:', body.email);
        const user = await AuthService.loginUser(body as typeof LoginUserSchema.static);
        console.log('✅ [LOGIN] Usuário autenticado:', user.username, '(ID:', user.id, ')');

        // Criar o JWT (Bearer Token)
        const token = await jwt.sign({
            userId: user.id,
        });
        console.log('🎫 [LOGIN] Token gerado (primeiros 20 chars):', token.substring(0, 20) + '...');
        console.log('📦 [LOGIN] Payload do token:', { userId: user.id });

        return {
            message: 'Login bem-sucedido!',
            token,
            user
        };
    } catch (error) {
        // Se for um erro customizado, propaga para o handler global
        if (error instanceof AppError) {
            throw error;
        }

        // Erro inesperado
        console.error('Erro inesperado no login:', error);
        throw new AppError('Erro ao fazer login', 500);
    }
}