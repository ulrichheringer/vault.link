import { t } from 'elysia';

export const CreateUserSchema = t.Object({
    username: t.String({ minLength: 3 }),
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 6 }),
});

export const LoginUserSchema = t.Object({
    email: t.Optional(t.String()),
    username: t.Optional(t.String()),
    password: t.String(),
});

export const LoginResponseSchema = t.Object({
    message: t.String(),
    token: t.String(),
    user: t.Object({
        id: t.Number(),
        username: t.String(),
        email: t.String(),
    }),
});