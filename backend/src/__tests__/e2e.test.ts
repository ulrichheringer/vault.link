import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { app } from '../index';
import { cleanupDatabase, generateAuthHeader } from './helpers/test-helpers';

describe('E2E Integration Tests', () => {
    beforeAll(async () => {
        await cleanupDatabase();
    });

    afterAll(async () => {
        await cleanupDatabase();
    });

    describe('Fluxo completo: Registro → Login → Criar Categoria → Criar Link → Atualizar → Deletar', () => {
        let userId: number;
        let authToken: string;
        let categoryId: number;
        let linkId: number;

        it('1. deve registrar um novo usuário', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'e2euser',
                        email: 'e2e@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data).toHaveProperty('id');
            userId = data.id;
            expect(data.email).toBe('e2e@example.com');
        });

        it('2. deve fazer login e receber token', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'e2e@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('token');
            authToken = data.token;
            expect(data.user.id).toBe(userId);
        });

        it('3. deve criar uma categoria', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ name: 'Desenvolvimento' }),
                })
            );

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data).toHaveProperty('id');
            categoryId = data.id;
            expect(data.name).toBe('Desenvolvimento');
        });

        it('4. deve listar a categoria criada', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBe(1);
            expect(data[0].name).toBe('Desenvolvimento');
        });

        it('5. deve criar um link associado à categoria', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({
                        title: 'GitHub',
                        url: 'https://github.com',
                        description: 'Plataforma de desenvolvimento',
                        categoryId: categoryId,
                    }),
                })
            );

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data).toHaveProperty('id');
            linkId = data.id;
            expect(data.title).toBe('GitHub');
            expect(data.categoryId).toBe(categoryId);
        });

        it('6. deve listar o link criado', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('data');
            expect(data.data.length).toBe(1);
            expect(data.data[0].title).toBe('GitHub');
        });

        it('7. deve verificar que o link foi criado corretamente', async () => {
            // Como não existe GET /links/:id, vamos verificar via listagem
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            const createdLink = data.data.find((l: any) => l.id === linkId);
            expect(createdLink).toBeDefined();
            expect(createdLink.title).toBe('GitHub');
        });

        it('8. deve atualizar o link', async () => {
            const response = await app.handle(
                new Request(`http://localhost/links/${linkId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({
                        title: 'GitHub - Atualizado',
                        description: 'Plataforma de desenvolvimento atualizada',
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.title).toBe('GitHub - Atualizado');
            expect(data.description).toBe('Plataforma de desenvolvimento atualizada');
        });

        it('9. deve buscar links por termo de pesquisa', async () => {
            const response = await app.handle(
                new Request('http://localhost/links?search=Atualizado', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data.length).toBeGreaterThanOrEqual(1);
        });

        it('10. deve filtrar links por categoria', async () => {
            const response = await app.handle(
                new Request(`http://localhost/links?categoryId=${categoryId}`, {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data.length).toBe(1);
            expect(data.data.every((l: any) => l.categoryId === categoryId)).toBe(true);
        });

        it('11. deve atualizar o nome da categoria', async () => {
            const response = await app.handle(
                new Request(`http://localhost/categories/${categoryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({ name: 'Dev Tools' }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.name).toBe('Dev Tools');
        });

        it('12. deve criar mais um link sem categoria', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(authToken),
                    },
                    body: JSON.stringify({
                        title: 'Stack Overflow',
                        url: 'https://stackoverflow.com',
                    }),
                })
            );

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.categoryId).toBeNull();
        });

        it('13. deve listar 2 links agora', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data.length).toBe(2);
        });

        it('14. deve deletar o primeiro link', async () => {
            const response = await app.handle(
                new Request(`http://localhost/links/${linkId}`, {
                    method: 'DELETE',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
        });

        it('15. deve ter apenas 1 link após deletar', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.data.length).toBe(1);
            expect(data.data[0].title).toBe('Stack Overflow');
        });

        it('16. deve deletar a categoria', async () => {
            const response = await app.handle(
                new Request(`http://localhost/categories/${categoryId}`, {
                    method: 'DELETE',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
        });

        it('17. deve ter 0 categorias após deletar', async () => {
            const response = await app.handle(
                new Request('http://localhost/categories', {
                    method: 'GET',
                    headers: generateAuthHeader(authToken),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.length).toBe(0);
        });

        it('18. deve rejeitar acesso com token inválido', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader('token-invalido'),
                })
            );

            expect(response.status).toBe(401);
        });

        it('19. deve rejeitar acesso sem token', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                })
            );

            expect(response.status).toBe(401);
        });
    });

    describe('Teste de isolamento entre usuários', () => {
        it('deve garantir que usuários não acessem dados uns dos outros', async () => {
            // Criar primeiro usuário
            const user1Response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'user1',
                        email: 'user1@example.com',
                        password: 'senha123',
                    }),
                })
            );
            expect(user1Response.status).toBe(201);

            const login1Response = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'user1@example.com',
                        password: 'senha123',
                    }),
                })
            );
            const { token: token1 } = await login1Response.json();

            // Criar link do usuário 1
            const link1Response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(token1),
                    },
                    body: JSON.stringify({
                        title: 'Link do User 1',
                        url: 'https://user1.com',
                    }),
                })
            );
            const link1Data = await link1Response.json();
            const link1Id = link1Data.id;

            // Criar segundo usuário
            const user2Response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'user2',
                        email: 'user2@example.com',
                        password: 'senha123',
                    }),
                })
            );
            expect(user2Response.status).toBe(201);

            const login2Response = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'user2@example.com',
                        password: 'senha123',
                    }),
                })
            );
            const { token: token2 } = await login2Response.json();

            // User 2 não deve ver links do User 1
            const listResponse = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader(token2),
                })
            );
            const listData = await listResponse.json();
            expect(listData.data.length).toBe(0);

            // User 2 não deve acessar link do User 1
            const getResponse = await app.handle(
                new Request(`http://localhost/links/${link1Id}`, {
                    method: 'GET',
                    headers: generateAuthHeader(token2),
                })
            );
            expect(getResponse.status).toBe(404);

            // User 2 não deve poder atualizar link do User 1
            const updateResponse = await app.handle(
                new Request(`http://localhost/links/${link1Id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(token2),
                    },
                    body: JSON.stringify({ title: 'Tentativa de hack' }),
                })
            );
            expect(updateResponse.status).toBe(404);

            // User 2 não deve poder deletar link do User 1
            const deleteResponse = await app.handle(
                new Request(`http://localhost/links/${link1Id}`, {
                    method: 'DELETE',
                    headers: generateAuthHeader(token2),
                })
            );
            expect(deleteResponse.status).toBe(404);
        });
    });
});
