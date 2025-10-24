import { Elysia } from 'elysia';
import { db } from './db';
import { redisClient } from './redis'; // Importe o cliente

const app = new Elysia()
  .decorate('db', db)
  .decorate('redis', redisClient)

  .get('/', () => 'Hello from Link-Vault Backend!')
  .listen(3000);

console.log(`Backend rodando em http://localhost:3000`);