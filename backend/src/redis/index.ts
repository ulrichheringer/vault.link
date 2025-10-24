import { createClient } from 'redis';
import 'dotenv/config';

// Cria o cliente
export const redisClient = createClient({
    url: process.env.REDIS_URL
});

// Gerenciamento de conexão
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Inicia a conexão
(async () => {
    await redisClient.connect();
    console.log('Conectado ao Redis!');
})();