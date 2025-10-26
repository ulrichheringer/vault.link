import { Elysia } from 'elysia';
import * as LinksController from './links.controller';
import { createLinkSchema, linkParamsSchema, updateLinkSchema, linkQuerySchema, paginatedLinksResponseSchema } from './links.models';
import { db } from '../../db';

export const linksRoutes = new Elysia({ prefix: '/links' })
    // Middleware de autenticação inline
    .derive(async ({ jwt, headers, request }: any) => {
        const authHeader = headers.authorization || headers.Authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { user: null };
        }

        const token = authHeader.substring(7);

        if (!jwt) {
            return { user: null };
        }

        const payload = await jwt.verify(token);

        if (!payload) {
            return { user: null };
        }

        const user = await db.query.usuarios.findFirst({
            where: (usuarios, { eq }) => eq(usuarios.id, payload.userId),
            columns: {
                id: true,
                username: true,
                email: true,
            }
        });

        if (!user) {
            return { user: null };
        }

        return { user };
    })
    .onBeforeHandle(({ set, user }: any) => {
        if (!user) {
            set.status = 401;
            return { error: 'Não autorizado. Token inválido ou ausente.' };
        }
    })

    // GET /links
    .get(
        '/',
        LinksController.handleGetLinks,
        {
            query: linkQuerySchema,
            response: paginatedLinksResponseSchema,
            detail: {
                summary: 'Busca todos os links do usuário logado com paginação',
                description: 'Suporta filtros por categoria, busca por texto e paginação. Resultados são cacheados no Redis por 5 minutos.',
                tags: ['Links'],
                security: [{ bearerAuth: [] }]
            }
        }
    )

    // POST /links
    .post(
        '/',
        LinksController.handleCreateLink,
        {
            body: createLinkSchema,
            detail: {
                summary: 'Cria um novo link',
                description: 'Invalida o cache de links do usuário após a criação.',
                tags: ['Links'],
                security: [{ bearerAuth: [] }]
            }
        }
    )

    // PUT /links/:id
    .put(
        '/:id',
        LinksController.handleUpdateLink,
        {
            params: linkParamsSchema,
            body: updateLinkSchema,
            detail: {
                summary: 'Atualiza um link existente',
                description: 'Invalida o cache de links do usuário após a atualização.',
                tags: ['Links'],
                security: [{ bearerAuth: [] }]
            }
        }
    )

    // DELETE /links/:id
    .delete(
        '/:id',
        LinksController.handleDeleteLink,
        {
            params: linkParamsSchema,
            detail: {
                summary: 'Deleta um link específico',
                description: 'Invalida o cache de links do usuário após a exclusão.',
                tags: ['Links'],
                security: [{ bearerAuth: [] }]
            }
        }
    );