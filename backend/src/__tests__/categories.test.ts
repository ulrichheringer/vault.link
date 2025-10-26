import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { app } from '../index';
import {
    cleanupDatabase,
    createTestUser,
    createTestCategory,
    createTestLink,
    generateAuthHeader,
    TestUser,
} from './helpers/test-helpers';

describe('Categories Module', () => {
    let testUser: TestUser;
    let authToken: string;

    beforeAll(async () => {
        await cleanupDatabase();
    });

    beforeEach(async () => {
        await cleanupDatabase();
        testUser = await createTestUser();

        const loginResponse = await app.handle(
            new Request('http://localhost/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testUser.email,
                    password: testUser.password,
                }),
            })
        );

        const loginData = await loginResponse.json();
        authToken = loginData.token;
    });

    afterEach(async () => {
        await cleanupDatabase();
    });

    describe('POST /categories', () => {
        it('deve criar uma nova categoria', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ name: 'Development' }),
                })
            );

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('name', 'Development');
            expect(data).toHaveProperty('userId', testUser.id);
        });

        it('deve rejeitar categoria com nome duplicado para o mesmo usuário', async () => {
            await createTestCategory(testUser.id, 'Duplicate');

            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ name: 'Duplicate' }),
                })
            );

            expect(response.status).toBe(400);
        });

        it('deve permitir categoria com mesmo nome para usuários diferentes', async () => {
            await createTestCategory(testUser.id, 'SharedName');

            // Criar outro usuário
            const otherUser = await createTestUser();
            const loginResponse = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: otherUser.email,
                        password: otherUser.password,
                    }),
                })
            );

            const { token } = await loginResponse.json();

            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(token),
                    },
                    body: JSON.stringify({ name: 'SharedName' }),
                })
            );

            expect(response.status).toBe(201);
        });

        it('deve rejeitar categoria sem nome', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({}),
                })
            );

            expect(response.status).toBe(400);
        });

        it('deve rejeitar criação sem autenticação', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test' }),
                })
            );

            expect(response.status).toBe(401);
        });
    });

    describe('GET /categories', () => {
        beforeEach(async () => {
            await createTestCategory(testUser.id, 'Category 1');
            await createTestCategory(testUser.id, 'Category 2');
            await createTestCategory(testUser.id, 'Category 3');
        });

        it('deve listar todas as categorias do usuário', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBe(3);
        });

        it('deve retornar array vazio para usuário sem categorias', async () => {
            await cleanupDatabase();
            const newUser = await createTestUser();

            const loginResponse = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: newUser.email,
                        password: newUser.password,
                    }),
                })
            );

            const { token } = await loginResponse.json();

            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'GET',
                    headers: generateAuthHeader(token),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual([]);
        });

        it('não deve mostrar categorias de outros usuários', async () => {
            const otherUser = await createTestUser();
            await createTestCategory(otherUser.id, 'Other User Category');

            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.every((cat: any) => cat.userId === testUser.id)).toBe(true);
        });

        it('deve rejeitar listagem sem autenticação', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'GET',
                })
            );

            expect(response.status).toBe(401);
        });
    });

    describe('GET /categories/:id', () => {
        it('deve retornar uma categoria específica', async () => {
            const category = await createTestCategory(testUser.id, 'Test Category');

            const response = await app.handle(
                new Request(`http://localhost/categories/${category.id}`, {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('id', category.id);
            expect(data).toHaveProperty('name', 'Test Category');
        });

        it('deve retornar 404 para categoria inexistente', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories/99999', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(404);
        });

        it('não deve permitir acesso a categoria de outro usuário', async () => {
            const otherUser = await createTestUser();
            const otherCategory = await createTestCategory(otherUser.id);

            const response = await app.handle(
                new Request(`http://localhost/categories/${otherCategory.id}`, {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /categories/:id', () => {
        it('deve atualizar uma categoria', async () => {
            const category = await createTestCategory(testUser.id, 'Old Name');

            const response = await app.handle(
                new Request(`http://localhost/categories/${category.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ name: 'New Name' }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('name', 'New Name');
        });

        it('deve rejeitar nome duplicado ao atualizar', async () => {
            await createTestCategory(testUser.id, 'Existing Name');
            const category = await createTestCategory(testUser.id, 'Original Name');

            const response = await app.handle(
                new Request(`http://localhost/categories/${category.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ name: 'Existing Name' }),
                })
            );

            expect(response.status).toBe(400);
        });

        it('não deve permitir atualizar categoria de outro usuário', async () => {
            const otherUser = await createTestUser();
            const otherCategory = await createTestCategory(otherUser.id);

            const response = await app.handle(
                new Request(`http://localhost/categories/${otherCategory.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ name: 'Hacked' }),
                })
            );

            expect(response.status).toBe(404);
        });

        it('deve retornar 404 ao atualizar categoria inexistente', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories/99999', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ name: 'Updated' }),
                })
            );

            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /categories/:id', () => {
        it('deve deletar categoria sem links associados', async () => {
            const category = await createTestCategory(testUser.id);

            const response = await app.handle(
                new Request(`http://localhost/categories/${category.id}`, {
                    method: 'DELETE',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);

            // Verificar que foi deletada
            const getResponse = await app.handle(
                new Request(`http://localhost/categories/${category.id}`, {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );
            expect(getResponse.status).toBe(404);
        });

        it('deve remover categoryId dos links ao deletar categoria', async () => {
            const category = await createTestCategory(testUser.id);
            const link = await createTestLink(testUser.id, {
                categoryId: category.id,
            });

            await app.handle(
                new Request(`http://localhost/categories/${category.id}`, {
                    method: 'DELETE',
                    headers: generateAuthHeader(authToken),
                })
            );

            // Verificar que o link ainda existe mas sem categoria
            // Buscar via GET /links e verificar
            const linksResponse = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            const linksData = await linksResponse.json();
            const updatedLink = linksData.data.find((l: any) => l.id === link.id);
            expect(updatedLink).toBeDefined();
            expect(updatedLink.categoryId).toBeNull();
        });

        it('não deve permitir deletar categoria de outro usuário', async () => {
            const otherUser = await createTestUser();
            const otherCategory = await createTestCategory(otherUser.id);

            const response = await app.handle(
                new Request(`http://localhost/categories/${otherCategory.id}`, {
                    method: 'DELETE',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(404);
        });

        it('deve retornar 404 ao deletar categoria inexistente', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories/99999', {
                    method: 'DELETE',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(404);
        });
    });
});
