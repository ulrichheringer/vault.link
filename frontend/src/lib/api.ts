import { edenTreaty } from '@elysiajs/eden';

// Cliente Eden Treaty para comunicação type-safe com o backend
// Nota: Usando 'any' devido a incompatibilidades de versão entre frontend/backend
export const api = edenTreaty<any>('http://localhost:3000');

export type ApiClient = typeof api;
