import { db } from '../../db';
import { usuarios } from '../../db/schemas';
import { eq } from 'drizzle-orm';
import type { CreateUserSchema, LoginUserSchema } from './auth.models';
import { handleDatabaseError, AuthenticationError } from '../../utils/errors';

export async function registerUser(data: typeof CreateUserSchema.static) {
    const hashedPassword = await Bun.password.hash(data.password, {
        algorithm: 'bcrypt',
        cost: 10,
    });

    try {
        const newUser = await db.insert(usuarios)
            .values({
                username: data.username,
                email: data.email,
                hashed_password: hashedPassword,
            })
            .returning({
                id: usuarios.id,
                username: usuarios.username,
                email: usuarios.email,
            });

        return newUser[0];
    } catch (err: any) {
        // Delega o tratamento de erros do banco para o utilitário
        handleDatabaseError(err);
    }
}

export async function loginUser(data: typeof LoginUserSchema.static) {
    const user = await db.query.usuarios.findFirst({
        where: eq(usuarios.email, data.email),
    });

    if (!user) {
        throw new AuthenticationError('E-mail ou senha incorretos');
    }

    const isPasswordValid = await Bun.password.verify(
        data.password,
        user.hashed_password
    );

    if (!isPasswordValid) {
        throw new AuthenticationError('E-mail ou senha incorretos');
    }

    const { hashed_password, ...userWithoutPassword } = user;
    return userWithoutPassword;
}