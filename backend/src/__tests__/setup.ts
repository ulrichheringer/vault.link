import { afterAll, jest } from 'bun:test';
import { config } from 'dotenv';
import { resolve } from 'path';

// Carrega variáveis de ambiente de teste
config({ path: resolve(__dirname, '../../.env.test') });

// Timeout global para testes assíncronos
jest.setTimeout(30000);

// Cleanup após todos os testes
afterAll(async () => {
    // Aguarda um pouco para garantir que todas as conexões foram fechadas
    await new Promise(resolve => setTimeout(resolve, 500));
});
