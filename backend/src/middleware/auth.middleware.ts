import { Elysia } from 'elysia';
import { db } from '../db';

export const authMiddleware = new Elysia({ name: 'auth.middleware' })
    .derive(async ({ jwt, headers, request }: any) => {
        console.log('🔍 [AUTH MIDDLEWARE] Iniciando verificação de autenticação');
        console.log('📋 [AUTH MIDDLEWARE] Request URL:', request.url);
        console.log('📋 [AUTH MIDDLEWARE] Headers disponíveis:', Object.keys(headers));

        // Extrai o token do header Authorization (formato: "Bearer <token>")
        const authHeader = headers.authorization || headers.Authorization;
        console.log('🔑 [AUTH MIDDLEWARE] Authorization header:', authHeader);

        if (!authHeader) {
            console.log('❌ [AUTH MIDDLEWARE] Header Authorization ausente');
            return { user: null };
        }

        if (!authHeader.startsWith('Bearer ')) {
            console.log('❌ [AUTH MIDDLEWARE] Authorization header não começa com "Bearer "');
            console.log('   - Valor recebido:', authHeader);
            return { user: null };
        }

        const token = authHeader.substring(7); // Remove "Bearer " do início
        console.log('🎫 [AUTH MIDDLEWARE] Token extraído (primeiros 20 chars):', token.substring(0, 20) + '...');

        if (!token) {
            console.log('❌ [AUTH MIDDLEWARE] Token vazio após extração');
            return { user: null };
        }

        if (!jwt) {
            console.log('❌ [AUTH MIDDLEWARE] JWT plugin não disponível!');
            return { user: null };
        }

        console.log('🔐 [AUTH MIDDLEWARE] Verificando token JWT...');
        const payload = await jwt.verify(token);
        console.log('📦 [AUTH MIDDLEWARE] Payload do token:', payload);

        if (!payload) {
            console.log('❌ [AUTH MIDDLEWARE] Token inválido ou expirado');
            return { user: null };
        }

        console.log('👤 [AUTH MIDDLEWARE] Buscando usuário no banco de dados (userId:', payload.userId, ')');
        const user = await db.query.usuarios.findFirst({
            where: (usuarios, { eq }) => eq(usuarios.id, payload.userId),
            columns: {
                id: true,
                username: true,
                email: true,
            }
        });

        if (!user) {
            console.log('❌ [AUTH MIDDLEWARE] Usuário não encontrado no banco de dados');
            return { user: null };
        }

        console.log('✅ [AUTH MIDDLEWARE] Autenticação bem-sucedida! Usuário:', user.username);
        return { user };
    })
    .onBeforeHandle(({ set, user }: any) => {
        if (!user) {
            console.log('⛔ [AUTH MIDDLEWARE] Bloqueando acesso - usuário não autenticado');
            set.status = 401; // Unauthorized
            return { error: 'Não autorizado. Token inválido ou ausente.' };
        }
        console.log('✅ [AUTH MIDDLEWARE] Acesso permitido para:', user.username);
    });