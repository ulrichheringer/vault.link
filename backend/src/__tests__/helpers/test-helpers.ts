import { db } from '../../db';
import { usuarios, categorias, links } from '../../db/schemas';
import { eq } from 'drizzle-orm';
import { redisClient } from '../../redis';

export interface TestUser {
    id: number;
    email: string;
    username: string;
    password: string;
}

export interface TestCategory {
    id: number;
    name: string;
    userId: number;
}

export interface TestLink {
    id: number;
    title: string;
    url: string;
    userId: number;
    categoryId?: number | null;
}

/**
 * Cria um usuário de teste no banco
 */
export async function createTestUser(
    overrides?: Partial<{ email: string; username: string; password: string }>
): Promise<TestUser> {
    const timestamp = Date.now();
    const email = overrides?.email || `test-${timestamp}@example.com`;
    const username = overrides?.username || `testuser_${timestamp}`;
    const password = overrides?.password || 'testpassword123';

    const hashedPassword = await Bun.password.hash(password, {
        algorithm: 'bcrypt',
        cost: 10,
    });

    const [user] = await db
        .insert(usuarios)
        .values({
            email,
            username,
            hashed_password: hashedPassword,
        })
        .returning();

    return {
        id: user.id,
        email: user.email,
        username: user.username,
        password, // Retorna a senha não-hasheada para uso nos testes
    };
}

/**
 * Cria uma categoria de teste
 */
export async function createTestCategory(
    userId: number,
    name?: string
): Promise<TestCategory> {
    const timestamp = Date.now();
    const categoryName = name || `Test Category ${timestamp}`;

    const [category] = await db
        .insert(categorias)
        .values({
            name: categoryName,
            userId,
        })
        .returning();

    return {
        id: category.id,
        name: category.name,
        userId: category.userId,
    };
}

/**
 * Cria um link de teste
 */
export async function createTestLink(
    userId: number,
    overrides?: Partial<{ title: string; url: string; description: string | null; categoryId: number | null }>
): Promise<TestLink> {
    const timestamp = Date.now();

    const [link] = await db
        .insert(links)
        .values({
            title: overrides?.title || `Test Link ${timestamp}`,
            url: overrides?.url || `https://example.com/${timestamp}`,
            description: overrides?.description !== undefined ? overrides.description : null,
            userId,
            categoryId: overrides?.categoryId !== undefined ? overrides.categoryId : null,
        })
        .returning();

    return {
        id: link.id,
        title: link.title,
        url: link.url,
        userId: link.userId,
        categoryId: link.categoryId,
    };
}

/**
 * Limpa todos os dados de teste do banco
 */
export async function cleanupDatabase() {
    // Deleta na ordem correta (respeita foreign keys)
    await db.delete(links);
    await db.delete(categorias);
    await db.delete(usuarios);

    // Limpa cache do Redis
    try {
        await redisClient.flushDb();
    } catch (error) {
        console.warn('Erro ao limpar Redis:', error);
    }
}

/**
 * Deleta um usuário e todos os seus dados relacionados
 */
export async function deleteTestUser(userId: number) {
    await db.delete(links).where(eq(links.userId, userId));
    await db.delete(categorias).where(eq(categorias.userId, userId));
    await db.delete(usuarios).where(eq(usuarios.id, userId));
}

/**
 * Gera um header de autorização para testes
 */
export function generateAuthHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
}
