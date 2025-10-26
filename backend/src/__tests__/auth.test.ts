import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { app } from '../index';
import { cleanupDatabase, createTestUser } from './helpers/test-helpers';

describe('Auth Module', () => {
    beforeEach(async () => {
        await cleanupDatabase();
    });

    afterEach(async () => {
        await cleanupDatabase();
    });

    describe('POST /auth/register', () => {
        it('deve registrar um novo usuário com sucesso', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'newuser',
                        email: 'newuser@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('email', 'newuser@example.com');
            expect(data).toHaveProperty('username', 'newuser');
            expect(data).not.toHaveProperty('hashed_password');
        });

        it('deve rejeitar registro com email duplicado', async () => {
            await createTestUser({ email: 'duplicate@example.com' });

            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'another',
                        email: 'duplicate@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect([409, 500]).toContain(response.status);
            const data = await response.json();
            expect(data).toHaveProperty('error');
        });

        it('deve rejeitar registro com username duplicado', async () => {
            await createTestUser({ username: 'duplicateuser' });

            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'duplicateuser',
                        email: 'different@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect([409, 500]).toContain(response.status);
            const data = await response.json();
            expect(data).toHaveProperty('error');
        });

        it('deve rejeitar registro com dados inválidos', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'ab', // muito curto
                        email: 'invalid-email',
                        password: '123', // muito curta
                    }),
                })
            );

            expect(response.status).toBe(400);
        });

        it('deve rejeitar registro sem campos obrigatórios', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                })
            );

            expect(response.status).toBe(400);
        });
    });

    describe('POST /auth/login', () => {
        it('deve fazer login com email e retornar token JWT', async () => {
            const user = await createTestUser({
                email: 'login@example.com',
                password: 'senha123',
            });

            const response = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'login@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('token');
            expect(data).toHaveProperty('user');
            expect(data.user).toHaveProperty('id', user.id);
            expect(data.user).toHaveProperty('email', user.email);
        });

        it('deve fazer login com username e retornar token JWT', async () => {
            const user = await createTestUser({
                username: 'testuser',
                password: 'senha123',
            });

            const response = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'testuser',
                        password: 'senha123',
                    }),
                })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toHaveProperty('token');
            expect(typeof data.token).toBe('string');
            expect(data.token.length).toBeGreaterThan(0);
        });

        it('deve rejeitar login com senha incorreta', async () => {
            await createTestUser({
                email: 'test@example.com',
                password: 'senha123',
            });

            const response = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'test@example.com',
                        password: 'senhaerrada',
                    }),
                })
            );

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data).toHaveProperty('error');
        });

        it('deve rejeitar login com usuário inexistente', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'naoexiste@example.com',
                        password: 'senha123',
                    }),
                })
            );

            expect(response.status).toBe(401);
        });

        it('deve rejeitar login sem credenciais', async () => {
            const response = await app.handle(
                new Request('http://localhost/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                })
            );

            expect(response.status).toBe(400);
        });
    });
});
