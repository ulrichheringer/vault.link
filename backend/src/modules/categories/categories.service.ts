import { db } from '../../db';
import { redisClient } from '../../redis';
import { categorias, links } from '../../db/schemas';
import { eq, and } from 'drizzle-orm';
import { handleDatabaseError, NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import type { CreateCategoryData, UpdateCategoryData } from './categories.models';

/**
 * GET - Buscar todas as categorias de um usuário
 */
export async function getCategoriesForUser(userId: number) {
    try {
        // Tentar buscar do cache
        const cacheKey = `categories:user:${userId}`;
        const cached = await redisClient.get(cacheKey);

        if (cached) {
            logger.cache('REDIS', `Cache HIT: ${cacheKey}`, { size: cached.length });
            return JSON.parse(cached);
        }

        logger.cache('REDIS', `Cache MISS: ${cacheKey}`);

        const userCategories = await db
            .select({
                id: categorias.id,
                name: categorias.name,
                userId: categorias.userId,
            })
            .from(categorias)
            .where(eq(categorias.userId, userId))
            .orderBy(categorias.name);

        // Armazenar no cache por 10 minutos
        await redisClient.setEx(cacheKey, 600, JSON.stringify(userCategories));
        logger.cache('REDIS', `Cache SET: ${cacheKey}`, { ttl: 600, count: userCategories.length });

        logger.database('CATEGORIES', `Fetched ${userCategories.length} categories`, { userId });
        return userCategories;
    } catch (error) {
        logger.error('CATEGORIES', 'Failed to fetch categories', { userId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}

/**
 * GET BY ID - Buscar uma categoria específica com seus links
 */
export async function getCategoryById(userId: number, categoryId: number) {
    try {
        // Tentar buscar do cache
        const cacheKey = `category:${categoryId}:user:${userId}`;
        const cached = await redisClient.get(cacheKey);

        if (cached) {
            logger.cache('REDIS', `Cache HIT: ${cacheKey}`, { size: cached.length });
            return JSON.parse(cached);
        }

        logger.cache('REDIS', `Cache MISS: ${cacheKey}`);

        // Buscar a categoria
        const category = await db.query.categorias.findFirst({
            where: and(
                eq(categorias.id, categoryId),
                eq(categorias.userId, userId)
            ),
        });

        if (!category) {
            throw new NotFoundError('Categoria não encontrada ou você não tem permissão para acessá-la');
        }

        // Buscar os links dessa categoria
        const categoryLinks = await db
            .select({
                id: links.id,
                title: links.title,
                url: links.url,
                description: links.description,
            })
            .from(links)
            .where(
                and(
                    eq(links.categoryId, categoryId),
                    eq(links.userId, userId)
                )
            );

        const result = {
            ...category,
            links: categoryLinks,
        };

        // Armazenar no cache por 10 minutos
        await redisClient.setEx(cacheKey, 600, JSON.stringify(result));
        logger.cache('REDIS', `Cache SET: ${cacheKey}`, { ttl: 600, linksCount: categoryLinks.length });

        logger.database('CATEGORIES', `Fetched category #${categoryId} with ${categoryLinks.length} links`, { userId });
        return result;
    } catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('CATEGORIES', 'Failed to fetch category', { userId, categoryId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}

/**
 * POST - Criar uma nova categoria
 */
export async function createCategory(userId: number, data: CreateCategoryData) {
    // Validações
    if (!data.name || data.name.trim() === '') {
        throw new ValidationError('O nome da categoria é obrigatório');
    }

    if (data.name.length > 256) {
        throw new ValidationError('O nome da categoria não pode ter mais de 256 caracteres');
    }

    try {
        // Verificar se já existe uma categoria com esse nome para o usuário
        const existingCategory = await db.query.categorias.findFirst({
            where: and(
                eq(categorias.userId, userId),
                eq(categorias.name, data.name.trim())
            ),
        });

        if (existingCategory) {
            throw new ValidationError('Você já possui uma categoria com esse nome');
        }

        // Criar a categoria
        const newCategory = await db
            .insert(categorias)
            .values({
                name: data.name.trim(),
                userId: userId,
            })
            .returning();

        logger.database('CATEGORIES', `Created category #${newCategory[0].id}`, { userId, name: data.name });

        // Invalidar cache de categorias do usuário
        await redisClient.del(`categories:user:${userId}`);
        logger.cache('REDIS', `Cache invalidated: categories:user:${userId}`, { userId });

        return newCategory[0];
    } catch (error) {
        if (error instanceof ValidationError) {
            throw error;
        }
        logger.error('CATEGORIES', 'Failed to create category', { userId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}

/**
 * PUT - Atualizar uma categoria
 */
export async function updateCategory(userId: number, categoryId: number, data: UpdateCategoryData) {
    // Validações
    if (!data.name || data.name.trim() === '') {
        throw new ValidationError('O nome da categoria é obrigatório');
    }

    if (data.name.length > 256) {
        throw new ValidationError('O nome da categoria não pode ter mais de 256 caracteres');
    }

    try {
        // Verificar se a categoria existe e pertence ao usuário
        const existingCategory = await db.query.categorias.findFirst({
            where: and(
                eq(categorias.id, categoryId),
                eq(categorias.userId, userId)
            ),
        });

        if (!existingCategory) {
            throw new NotFoundError('Categoria não encontrada ou você não tem permissão para editá-la');
        }

        // Verificar se já existe outra categoria com esse nome para o usuário
        const duplicateCategory = await db.query.categorias.findFirst({
            where: and(
                eq(categorias.userId, userId),
                eq(categorias.name, data.name.trim())
            ),
        });

        if (duplicateCategory && duplicateCategory.id !== categoryId) {
            throw new ValidationError('Você já possui outra categoria com esse nome');
        }

        // Atualizar a categoria
        const updatedCategory = await db
            .update(categorias)
            .set({
                name: data.name.trim(),
            })
            .where(
                and(
                    eq(categorias.id, categoryId),
                    eq(categorias.userId, userId)
                )
            )
            .returning();

        if (updatedCategory.length === 0) {
            throw new NotFoundError('Categoria não encontrada');
        }

        // Invalidar caches relacionados
        await redisClient.del(`categories:user:${userId}`);
        await redisClient.del(`category:${categoryId}:user:${userId}`);

        // Invalidar cache de links pois a categoria pode ter mudado
        const linksPattern = `links:user:${userId}:*`;
        const linksKeys = await redisClient.keys(linksPattern);
        if (linksKeys.length > 0) {
            await redisClient.del(linksKeys);
        }

        logger.cache('REDIS', 'Cache invalidated: category + links', { userId, categoryId, linksKeys: linksKeys.length });
        logger.database('CATEGORIES', `Updated category #${categoryId}`, { userId, newName: data.name });

        return updatedCategory[0];
    } catch (error) {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
            throw error;
        }
        logger.error('CATEGORIES', 'Failed to update category', { userId, categoryId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}

/**
 * DELETE - Deletar uma categoria
 */
export async function deleteCategory(userId: number, categoryId: number) {
    try {
        // Verificar se a categoria existe e pertence ao usuário
        const existingCategory = await db.query.categorias.findFirst({
            where: and(
                eq(categorias.id, categoryId),
                eq(categorias.userId, userId)
            ),
        });

        if (!existingCategory) {
            throw new NotFoundError('Categoria não encontrada ou você não tem permissão para deletá-la');
        }

        // Deletar a categoria (os links ficarão com categoryId = null devido ao onDelete: 'set null')
        const deletedCategory = await db
            .delete(categorias)
            .where(
                and(
                    eq(categorias.id, categoryId),
                    eq(categorias.userId, userId)
                )
            )
            .returning();

        if (deletedCategory.length === 0) {
            throw new NotFoundError('Categoria não encontrada');
        }

        // Invalidar caches relacionados
        await redisClient.del(`categories:user:${userId}`);
        await redisClient.del(`category:${categoryId}:user:${userId}`);

        // Invalidar cache de links pois a categoria foi deletada
        const linksPattern = `links:user:${userId}:*`;
        const linksKeys = await redisClient.keys(linksPattern);
        if (linksKeys.length > 0) {
            await redisClient.del(linksKeys);
        }

        logger.cache('REDIS', 'Cache invalidated: category + links', { userId, categoryId, linksKeys: linksKeys.length });
        logger.database('CATEGORIES', `Deleted category #${categoryId}`, { userId });

        return deletedCategory[0];
    } catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('CATEGORIES', 'Failed to delete category', { userId, categoryId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}
