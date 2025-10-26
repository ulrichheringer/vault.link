import { Elysia } from 'elysia';
import * as CategoriesController from './categories.controller';
import {
    CreateCategorySchema,
    UpdateCategorySchema,
    CategoryParamsSchema,
    CategoryResponseSchema,
    CategoryWithLinksResponseSchema,
} from './categories.models';
import { db } from '../../db';

export const categoriesRoutes = new Elysia({ prefix: '/categories' })
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

    // GET /categories - Listar todas as categorias do usuário
    .get(
        '/',
        CategoriesController.handleGetCategories,
        {
            detail: {
                summary: 'Lista todas as categorias do usuário logado',
                description: 'Retorna categorias cacheadas no Redis por 10 minutos.',
                tags: ['Categories'],
                security: [{ bearerAuth: [] }]
            }
        }
    )

    // GET /categories/:id - Buscar uma categoria específica com seus links
    .get(
        '/:id',
        CategoriesController.handleGetCategoryById,
        {
            params: CategoryParamsSchema,
            detail: {
                summary: 'Busca uma categoria específica com todos os seus links',
                description: 'Categoria e links são cacheados individualmente no Redis.',
                tags: ['Categories'],
                security: [{ bearerAuth: [] }]
            }
        }
    )

    // POST /categories - Criar nova categoria
    .post(
        '/',
        CategoriesController.handleCreateCategory,
        {
            body: CreateCategorySchema,
            detail: {
                summary: 'Cria uma nova categoria',
                description: 'Invalida o cache de categorias do usuário após a criação.',
                tags: ['Categories'],
                security: [{ bearerAuth: [] }]
            }
        }
    )

    // PUT /categories/:id - Atualizar categoria
    .put(
        '/:id',
        CategoriesController.handleUpdateCategory,
        {
            params: CategoryParamsSchema,
            body: UpdateCategorySchema,
            detail: {
                summary: 'Atualiza o nome de uma categoria',
                description: 'Invalida o cache da categoria após a atualização.',
                tags: ['Categories'],
                security: [{ bearerAuth: [] }]
            }
        }
    )

    // DELETE /categories/:id - Deletar categoria
    .delete(
        '/:id',
        CategoriesController.handleDeleteCategory,
        {
            params: CategoryParamsSchema,
            detail: {
                summary: 'Deleta uma categoria (os links ficam sem categoria)',
                description: 'Invalida o cache de categorias e links relacionados após a exclusão.',
                tags: ['Categories'],
                security: [{ bearerAuth: [] }]
            }
        }
    );
