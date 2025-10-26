import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schemas';
import 'dotenv/config'; // Carrega as variáveis do .env

// Cria o pool de conexões
const pool = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT),
    user: process.env.PG_USER,
    password: String(process.env.PG_PASSWORD || ''),
    database: process.env.PG_DATABASE,
    // max: 20, // Opcional: número máximo de clientes no pool
});

// Conecta o Drizzle ao pool
export const db = drizzle(pool, { schema });