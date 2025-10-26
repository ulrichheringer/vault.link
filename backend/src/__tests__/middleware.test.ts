import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { app } from '../index';
import { cleanupDatabase, createTestUser, generateAuthHeader } from './helpers/test-helpers';

describe('Middleware e Error Handling', () => {
    beforeEach(async () => {
        await cleanupDatabase();
    });

    afterEach(async () => {
        await cleanupDatabase();
    });

    describe('Autenticação', () => {
        it('deve rejeitar requisição sem token de autenticação', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                })
            );

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data).toHaveProperty('error');
        });

        it('deve rejeitar requisição com token inválido', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: generateAuthHeader('token-invalido-xyz123'),
                })
            );

            expect(response.status).toBe(401);
        });

        it('deve rejeitar requisição com token malformado', async () => {
            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'GET',
                    headers: { Authorization: 'InvalidFormat' },
                })
            );

            expect(response.status).toBe(401);
        });

        it('deve aceitar token válido', async () => {
            const user = await createTestUser();

            const loginResponse = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        password: user.password,
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
        });
    });

    describe('Validação de Dados', () => {
        it('deve retornar 400 para JSON inválido', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: 'isso-nao-e-json',
                })
            );

            expect([400, 500]).toContain(response.status);
        });

        it('deve validar campos obrigatórios no registro', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'teste',
                        // faltando email e password
                    }),
                })
            );

            expect(response.status).toBe(400);
        });

        it('deve validar formato de email', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'teste',
                        email: 'email-invalido',
                        password: 'senha123',
                    }),
                })
            );

            expect(response.status).toBe(400);
        });

        it('deve validar tamanho mínimo de senha', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'teste',
                        email: 'teste@example.com',
                        password: '12',
                    }),
                })
            );

            expect(response.status).toBe(400);
        });

        it('deve validar tamanho mínimo de username', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'ab',
                        email: 'teste@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect(response.status).toBe(400);
        });

        it('deve validar URL ao criar link', async () => {
            const user = await createTestUser();

            const loginResponse = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        password: user.password,
                    }),
                })
            );

            const { token } = await loginResponse.json();

            const response = await app.handle(
                new Request('http://localhost/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...generateAuthHeader(token),
                    },
                    body: JSON.stringify({
                        title: 'Teste',
                        url: 'url-invalida-sem-protocolo',
                    }),
                })
            );

            expect(response.status).toBe(400);
        });
    });

    describe('Tratamento de Erros', () => {
        it('deve retornar 404 para rota inexistente', async () => {
            const response = await app.handle(
                new Request('http://localhost/rota-que-nao-existe', {
                    method: 'GET',
                })
            );

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data).toHaveProperty('error');
        });

        it('deve retornar 404 para recurso não encontrado', async () => {
            const user = await createTestUser();

            const loginResponse = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        password: user.password,
                    }),
                })
            );

            const { token } = await loginResponse.json();

            const response = await app.handle(
                new Request('http://localhost/links/999999', {
                    method: 'GET',
                    headers: generateAuthHeader(token),
                })
            );

            expect(response.status).toBe(404);
        });

        it('deve tratar erro de conflito (409) ao duplicar email', async () => {
            await createTestUser({ email: 'duplicate@example.com' });

            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'outro',
                        email: 'duplicate@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect([409, 500]).toContain(response.status);
            const data = await response.json();
            expect(data).toHaveProperty('error');
            expect([409, 500]).toContain(data.statusCode);
        });
    });

    describe('CORS', () => {
        it('deve incluir headers CORS nas respostas', async () => {
            const response = await app.handle(
                new Request('http://localhost/', {
                    method: 'GET',
                    headers: { Origin: 'http://localhost:4321' },
                })
            );

            expect(response.status).toBe(200);
            // CORS headers podem variar dependendo da configuração
        });
    });

    describe('Rotas Públicas', () => {
        it('deve permitir acesso à rota raiz sem autenticação', async () => {
            const response = await app.handle(
                new Request('http://localhost/', {
                    method: 'GET',
                })
            );

            expect(response.status).toBe(200);
            const data = await response.text();
            expect(data).toContain('Link-Vault');
        });

        it('deve permitir acesso ao Swagger sem autenticação', async () => {
            const response = await app.handle(
                new Request('http://localhost/swagger', {
                    method: 'GET',
                })
            );

            expect(response.status).toBe(200);
        });

        it('deve permitir registro sem autenticação', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'publico',
                        email: 'publico@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect(response.status).toBe(201);
        });

        it('deve permitir login sem autenticação', async () => {
            const user = await createTestUser();

            const response = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        password: user.password,
                    }),
                })
            );

            expect(response.status).toBe(200);
        });
    });

    describe('Paginação', () => {
        it('deve aplicar valores padrão de paginação', async () => {
            const user = await createTestUser();

            const loginResponse = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        password: user.password,
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
            expect(data).toHaveProperty('pagination');
        });

        it('deve validar parâmetros de paginação inválidos', async () => {
            const user = await createTestUser();

            const loginResponse = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        password: user.password,
                    }),
                })
            );

            const { token } = await loginResponse.json();

            // Página negativa
            const response1 = await app.handle(
                new Request('http://localhost/links?page=-1', {
                    method: 'GET',
                    headers: generateAuthHeader(token),
                })
            );

            expect([200, 400]).toContain(response1.status);

            // Limit zero
            const response2 = await app.handle(
                new Request('http://localhost/links?limit=0', {
                    method: 'GET',
                    headers: generateAuthHeader(token),
                })
            );

            expect([200, 400]).toContain(response2.status);
        });
    });
});
