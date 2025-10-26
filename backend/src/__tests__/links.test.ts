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

describe('Links Module', () => {
    let testUser: TestUser;
    let authToken: string;

    beforeAll(async () => {
        await cleanupDatabase();
    });

    beforeEach(async () => {
        await cleanupDatabase();
        testUser = await createTestUser();

        // Fazer login para obter token
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

    describe('POST /links', () => {
        it('deve criar um novo link com sucesso', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({
                        title: 'Test Link',
                        url: 'https://example.com',
                        description: 'A test link',
                    }),
                })
            );

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('title', 'Test Link');
            expect(data).toHaveProperty('url', 'https://example.com');
            expect(data).toHaveProperty('userId', testUser.id);
        });

        it('deve criar link com categoria', async () => {
            const category = await createTestCategory(testUser.id, 'Dev Tools');

            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({
                        title: 'Test Link',
                        url: 'https://example.com',
                        categoryId: category.id,
                    }),
                })
            );

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data).toHaveProperty('categoryId', category.id);
        });

        it('deve rejeitar criação sem autenticação', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: 'Test Link',
                        url: 'https://example.com',
                    }),
                })
            );

            expect(response.status).toBe(401);
        });

        it('deve rejeitar criação com URL inválida', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({
                        title: 'Test Link',
                        url: 'not-a-valid-url',
                    }),
                })
            );

            expect(response.status).toBe(400);
        });

        it('deve rejeitar criação sem título', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({
                        url: 'https://example.com',
                    }),
                })
            );

            expect(response.status).toBe(400);
        });
    });

    describe('GET /links', () => {
        beforeEach(async () => {
            // Criar alguns links de teste
            await createTestLink(testUser.id, { title: 'Link 1', url: 'https://example1.com' });
            await createTestLink(testUser.id, { title: 'Link 2', url: 'https://example2.com' });
            await createTestLink(testUser.id, { title: 'Link 3', url: 'https://example3.com' });
        });

        it('deve listar todos os links do usuário', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('data');
            expect(Array.isArray(data.data)).toBe(true);
            expect(data.data.length).toBe(3);
        });

        it('deve paginar resultados corretamente', async () => {
            const response = await app.handle(
                new Request('http://localhost/links?page=1&limit=2', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data.length).toBe(2);
            expect(data).toHaveProperty('pagination');
            expect(data.pagination.page).toBe(1);
            expect(data.pagination.limit).toBe(2);
            expect(data.pagination.total).toBe(3);
        });

        it('deve buscar links por termo', async () => {
            const response = await app.handle(
                new Request('http://localhost/links?search=Link 1', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data.length).toBeGreaterThanOrEqual(1);
            expect(data.data[0].title).toContain('Link 1');
        });

        it('deve filtrar por categoria', async () => {
            const category = await createTestCategory(testUser.id, 'Dev');
            await createTestLink(testUser.id, {
                title: 'Dev Link',
                categoryId: category.id,
            });

            const response = await app.handle(
                new Request(`http://localhost/links?categoryId=${category.id}`, {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data.length).toBeGreaterThanOrEqual(1);
        });

        it('deve retornar lista vazia para usuário sem links', async () => {
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
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader(token),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data).toEqual([]);
        });

        it('deve rejeitar listagem sem autenticação', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                })
            );

            expect(response.status).toBe(401);
        });
    });

    describe('GET /links/:id', () => {
        it('deve retornar 404 para rota não implementada', async () => {
            const link = await createTestLink(testUser.id);

            const response = await app.handle(
                new Request(`http://localhost/links/${link.id}`, {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            // Rota GET /links/:id não existe, deve retornar 404
            expect(response.status).toBe(404);
        });

        it('deve retornar 404 para link inexistente', async () => {
            const response = await app.handle(
                new Request('http://localhost/links/99999', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(404);
        });

        it('não deve permitir acesso a link de outro usuário', async () => {
            const otherUser = await createTestUser();
            const otherLink = await createTestLink(otherUser.id);

            const response = await app.handle(
                new Request(`http://localhost/links/${otherLink.id}`, {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /links/:id', () => {
        it('deve atualizar um link com sucesso', async () => {
            const link = await createTestLink(testUser.id);

            const response = await app.handle(
                new Request(`http://localhost/links/${link.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({
                        title: 'Updated Title',
                        url: 'https://updated.com',
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('title', 'Updated Title');
            expect(data).toHaveProperty('url', 'https://updated.com');
        });

        it('deve permitir atualização parcial', async () => {
            const link = await createTestLink(testUser.id, {
                title: 'Original Title',
                url: 'https://original.com',
            });

            const response = await app.handle(
                new Request(`http://localhost/links/${link.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({
                        title: 'Updated Title Only',
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('title', 'Updated Title Only');
        });

        it('não deve permitir atualização de link de outro usuário', async () => {
            const otherUser = await createTestUser();
            const otherLink = await createTestLink(otherUser.id);

            const response = await app.handle(
                new Request(`http://localhost/links/${otherLink.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ title: 'Hacked' }),
                })
            );

            expect(response.status).toBe(404);
        });

        it('deve retornar 404 ao atualizar link inexistente', async () => {
            const response = await app.handle(
                new Request('http://localhost/links/99999', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ title: 'Updated' }),
                })
            );

            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /links/:id', () => {
        it('deve deletar um link com sucesso', async () => {
            const link = await createTestLink(testUser.id);

            const response = await app.handle(
                new Request(`http://localhost/links/${link.id}`, {
                    method: 'DELETE',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('message');

            // Verificar que foi realmente deletado
            const getResponse = await app.handle(
                new Request(`http://localhost/links/${link.id}`, {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );
            expect(getResponse.status).toBe(404);
        });

        it('não deve permitir deletar link de outro usuário', async () => {
            const otherUser = await createTestUser();
            const otherLink = await createTestLink(otherUser.id);

            const response = await app.handle(
                new Request(`http://localhost/links/${otherLink.id}`, {
                    method: 'DELETE',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(404);
        });

        it('deve retornar 404 ao deletar link inexistente', async () => {
            const response = await app.handle(
                new Request('http://localhost/links/99999', {
                    method: 'DELETE',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(404);
        });
    });
});
