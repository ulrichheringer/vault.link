import type { RedisClientType } from 'redis';
import { db } from '../../db';
import { redisClient } from '../../redis';
import { links, categorias, usuarios } from '../../db/schemas';
import { eq, and, like, or, count, desc, ilike } from 'drizzle-orm';
import { handleDatabaseError, NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';

type CreateLinkData = {
    title: string;
    url: string;
    description?: string;
    categoryId?: number;
};

type UpdateLinkData = {
    title?: string;
    url?: string;
    description?: string;
    categoryId?: number;
};

type GetLinksQuery = {
    page?: number;
    limit?: number;
    categoryId?: number;
    search?: string;
};

// Helper para garantir que o usuário existe
async function ensureUserExists(userId: number, username: string) {
    try {
        const existingUser = await db.select().from(usuarios).where(eq(usuarios.id, userId)).limit(1);

        if (existingUser.length === 0) {
            logger.info('USER', `Creating user ${username}`, { userId });
            await db.insert(usuarios).values({
                id: userId,
                username: username,
                email: `${username}@example.com`,
                hashed_password: 'fake-hash-password'
            });
        }
    } catch (error) {
        logger.error('USER', 'Failed to ensure user exists', { userId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}

// GET
export async function getLinksForUser(userId: number, query: GetLinksQuery = {}) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    try {
        // Se houver busca, não usar paginação e buscar TODOS os resultados
        const isSearchMode = query.search && query.search.trim() !== '';

        // Gerar chave de cache
        const cacheKey = isSearchMode
            ? `links:user:${userId}:search:${query.search}:cat:${query.categoryId || 'all'}`
            : `links:user:${userId}:page:${page}:limit:${limit}:cat:${query.categoryId || 'all'}:search:none`;

        // Tentar buscar do cache
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            logger.cache('REDIS', `Cache HIT: ${cacheKey}`, { size: cached.length });
            return JSON.parse(cached);
        }

        logger.cache('REDIS', `Cache MISS: ${cacheKey}`);

        // Construir condições de busca
        const conditions = [eq(links.userId, userId)];

        if (query.categoryId) {
            conditions.push(eq(links.categoryId, query.categoryId));
        }

        // Busca case-insensitive em título E descrição (busca em qualquer parte do texto)
        if (isSearchMode) {
            const searchTerm = `%${query.search}%`;
            conditions.push(
                or(
                    ilike(links.title, searchTerm),
                    ilike(links.description, searchTerm)
                )!
            );
        }

        // Buscar total de registros
        const [{ total }] = await db
            .select({ total: count() })
            .from(links)
            .where(and(...conditions));

        // Se estiver em modo de busca, retorna TODOS os resultados (sem paginação)
        // Caso contrário, usa paginação normal
        const queryBuilder = db
            .select({
                id: links.id,
                title: links.title,
                url: links.url,
                description: links.description,
                userId: links.userId,
                categoryId: links.categoryId,
                categoria: categorias.name
            })
            .from(links)
            .leftJoin(categorias, eq(links.categoryId, categorias.id))
            .where(and(...conditions))
            .orderBy(desc(links.id));

        // Aplicar paginação apenas se NÃO estiver em modo de busca
        const dbLinks = isSearchMode
            ? await queryBuilder
            : await queryBuilder.limit(limit).offset(offset);

        const result = {
            data: dbLinks,
            pagination: {
                page: isSearchMode ? 1 : page,
                limit: isSearchMode ? total : limit,
                total,
                totalPages: isSearchMode ? 1 : Math.ceil(total / limit)
            }
        };

        // Armazenar no cache por 5 minutos
        await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
        logger.cache('REDIS', `Cache SET: ${cacheKey}`, { ttl: 300, count: dbLinks.length });

        logger.database('LINKS', `Fetched ${dbLinks.length}/${total} links`, { userId, page, searchMode: isSearchMode });
        return result;
    } catch (error) {
        logger.error('LINKS', 'Failed to fetch links', { userId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}// POST
export async function createNewLink(userId: number, data: CreateLinkData) {
    // Validações básicas
    if (!data.title || data.title.trim() === '') {
        throw new ValidationError('O título do link é obrigatório');
    }

    if (!data.url || data.url.trim() === '') {
        throw new ValidationError('A URL do link é obrigatória');
    }

    // Validação básica de URL
    try {
        new URL(data.url);
    } catch {
        throw new ValidationError('A URL fornecida é inválida');
    }

    // Garante que o usuário existe antes de inserir o link
    await ensureUserExists(userId, 'diego');

    const valuesToInsert: any = {
        title: data.title,
        url: data.url,
        userId: userId,
    };

    // Só adiciona description se existir
    if (data.description) {
        valuesToInsert.description = data.description;
    }

    // Só adiciona categoryId se existir
    if (data.categoryId) {
        // Verifica se a categoria existe e pertence ao usuário
        const category = await db
            .select()
            .from(categorias)
            .where(
                and(
                    eq(categorias.id, data.categoryId),
                    eq(categorias.userId, userId)
                )
            )
            .limit(1);

        if (category.length === 0) {
            throw new ValidationError('Categoria não encontrada ou não pertence ao usuário');
        }

        valuesToInsert.categoryId = data.categoryId;
    }

    try {
        const result = await db.insert(links)
            .values(valuesToInsert)
            .returning();

        const newLink = result[0];

        // Invalidar cache de links do usuário
        const pattern = `links:user:${userId}:*`;
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
            logger.cache('REDIS', `Cache invalidated: ${keys.length} keys deleted`, { userId });
        }

        logger.database('LINKS', `Created link #${newLink.id}`, { userId, title: data.title });
        return newLink;
    } catch (error) {
        logger.error('LINKS', 'Failed to create link', { userId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}

// PUT/PATCH
export async function updateLink(userId: number, linkId: number, data: UpdateLinkData) {
    // Verificar se o link existe e pertence ao usuário
    const existingLink = await db
        .select()
        .from(links)
        .where(
            and(
                eq(links.id, linkId),
                eq(links.userId, userId)
            )
        )
        .limit(1);

    if (existingLink.length === 0) {
        throw new NotFoundError('Link não encontrado ou você não tem permissão para editá-lo');
    }

    // Validações
    if (data.title !== undefined && data.title.trim() === '') {
        throw new ValidationError('O título do link não pode ser vazio');
    }

    if (data.url !== undefined) {
        if (data.url.trim() === '') {
            throw new ValidationError('A URL do link não pode ser vazia');
        }
        // Validação básica de URL
        try {
            new URL(data.url);
        } catch {
            throw new ValidationError('A URL fornecida é inválida');
        }
    }

    // Se categoryId for fornecido, verificar se existe e pertence ao usuário
    if (data.categoryId !== undefined && data.categoryId !== null) {
        const category = await db
            .select()
            .from(categorias)
            .where(
                and(
                    eq(categorias.id, data.categoryId),
                    eq(categorias.userId, userId)
                )
            )
            .limit(1);

        if (category.length === 0) {
            throw new ValidationError('Categoria não encontrada ou não pertence ao usuário');
        }
    }

    const updateValues: any = {};
    if (data.title !== undefined) updateValues.title = data.title.trim();
    if (data.url !== undefined) updateValues.url = data.url.trim();
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.categoryId !== undefined) updateValues.categoryId = data.categoryId;

    try {
        const updatedLink = await db
            .update(links)
            .set(updateValues)
            .where(
                and(
                    eq(links.id, linkId),
                    eq(links.userId, userId)
                )
            )
            .returning();

        // Invalidar cache de links do usuário
        const pattern = `links:user:${userId}:*`;
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
            logger.cache('REDIS', `Cache invalidated: ${keys.length} keys deleted`, { userId });
        }

        logger.database('LINKS', `Updated link #${linkId}`, { userId });
        return updatedLink[0];
    } catch (error) {
        logger.error('LINKS', 'Failed to update link', { userId, linkId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}

// DELETE
export async function deleteLinkForUser(userId: number, linkId: number) {
    try {
        const deletedLink = await db.delete(links)
            .where(and(
                eq(links.userId, userId),
                eq(links.id, linkId)
            ))
            .returning();

        if (deletedLink.length === 0) {
            throw new NotFoundError('Link não encontrado ou você não tem permissão');
        }

        // Invalidar cache de links do usuário
        const pattern = `links:user:${userId}:*`;
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
            logger.cache('REDIS', `Cache invalidated: ${keys.length} keys deleted`, { userId });
        }

        logger.database('LINKS', `Deleted link #${linkId}`, { userId });
        return deletedLink[0];
    } catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('LINKS', 'Failed to delete link', { userId, linkId, error: error instanceof Error ? error.message : String(error) });
        handleDatabaseError(error);
    }
}