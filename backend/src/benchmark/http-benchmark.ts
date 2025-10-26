/**
 * 🚀 LinkVault HTTP API Performance Benchmark
 * 
 * Testa a performance real da API HTTP:
 * - POST /auth/register
 * - POST /auth/login
 * - POST /categories
 * - POST /links
 * - GET /links (sem cache)
 * - GET /links (com cache)
 * - GET /links (com busca/filtros)
 * - PUT /links/:id
 * - DELETE /links/:id
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Carrega o .env do diretório backend
config({ path: resolve(__dirname, '../../.env') });

// ===============================
// 🎯 Configurações do Benchmark
// ===============================

const BENCHMARK_CONFIG = {
    // Base URL da API
    API_URL: 'http://localhost:3000',

    // Quantos links criar para testes
    LINKS_TO_CREATE: 1000,

    // Quantas vezes repetir cada teste de leitura
    READ_ITERATIONS: 500,

    // Limpar dados após teste
    CLEANUP_AFTER: true,
};

// ===============================
// 📊 Utilitários
// ===============================

interface BenchmarkResult {
    operation: string;
    iterations: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    p50: number;
    p95: number;
    p99: number;
    throughput: number; // requests/segundo
}

class BenchmarkTimer {
    private results: number[] = [];

    async measure(fn: () => Promise<any>): Promise<void> {
        const start = performance.now();
        await fn();
        const end = performance.now();
        this.results.push(end - start);
    }

    getStats(operation: string): BenchmarkResult {
        const sorted = [...this.results].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const avgTime = sum / sorted.length;

        return {
            operation,
            iterations: sorted.length,
            totalTime: sum,
            avgTime,
            minTime: sorted[0],
            maxTime: sorted[sorted.length - 1],
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            throughput: 1000 / avgTime, // converte ms para req/s
        };
    }
}

function formatTime(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function printResults(result: BenchmarkResult) {
    console.log('\n' + '='.repeat(60));
    console.log(`📊 ${result.operation}`);
    console.log('='.repeat(60));
    console.log(`Iterações:     ${result.iterations}`);
    console.log(`Tempo Total:   ${formatTime(result.totalTime)}`);
    console.log(`Média:         ${formatTime(result.avgTime)}`);
    console.log(`Mínimo:        ${formatTime(result.minTime)}`);
    console.log(`Máximo:        ${formatTime(result.maxTime)}`);
    console.log(`P50 (mediana): ${formatTime(result.p50)}`);
    console.log(`P95:           ${formatTime(result.p95)}`);
    console.log(`P99:           ${formatTime(result.p99)}`);
    console.log(`Throughput:    ${Math.round(result.throughput)} req/s`);
}

// ===============================
// 🔧 Setup e Cleanup
// ===============================

let authToken: string;
let userId: number;
let testCategoryId: number;
let testLinkIds: number[] = [];

async function checkServerHealth() {
    console.log('\n🔍 Verificando se o servidor está rodando...');

    try {
        const response = await fetch(`${BENCHMARK_CONFIG.API_URL}/swagger`);
        if (response.ok) {
            console.log('✅ Servidor está rodando!');
            return true;
        }
    } catch (error) {
        console.error('❌ Servidor não está respondendo!');
        console.error('   Execute: bun run dev');
        return false;
    }
    return false;
}

async function setupTestUser() {
    console.log('\n🔧 Setup: Criando usuário de teste...');

    const timestamp = Date.now();

    // Registrar usuário
    const registerResponse = await fetch(`${BENCHMARK_CONFIG.API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: `bench_${timestamp}`,
            email: `benchmark-${timestamp}@test.com`,
            password: 'testpassword123',
        }),
    });

    if (!registerResponse.ok) {
        const error = await registerResponse.text();
        throw new Error(`Falha ao registrar usuário: ${error}`);
    }

    const user = await registerResponse.json();
    userId = user.id;
    console.log(`✅ Usuário criado: ID ${userId}`);

    // Fazer login
    const loginResponse = await fetch(`${BENCHMARK_CONFIG.API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: `benchmark-${timestamp}@test.com`,
            password: 'testpassword123',
        }),
    });

    if (!loginResponse.ok) {
        throw new Error('Falha ao fazer login');
    }

    const loginData = await loginResponse.json();
    authToken = loginData.token;
    console.log(`✅ Token JWT obtido`);
}

async function setupTestCategory() {
    console.log('🔧 Criando categoria de teste...');

    const response = await fetch(`${BENCHMARK_CONFIG.API_URL}/categories`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            name: 'Benchmark Category',
        }),
    });

    if (!response.ok) {
        throw new Error('Falha ao criar categoria');
    }

    const category = await response.json();
    testCategoryId = category.id;
    console.log(`✅ Categoria criada: ID ${testCategoryId}`);
}

async function cleanupTestData() {
    if (!BENCHMARK_CONFIG.CLEANUP_AFTER) {
        console.log('\n⏭️  Pulando cleanup (CLEANUP_AFTER = false)');
        return;
    }

    console.log('\n🧹 Cleanup: Removendo dados de teste...');

    // Deletar links
    let deletedLinks = 0;
    for (const linkId of testLinkIds) {
        const response = await fetch(`${BENCHMARK_CONFIG.API_URL}/links/${linkId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (response.ok) deletedLinks++;
    }
    console.log(`✅ ${deletedLinks} links deletados`);

    // Deletar categoria
    if (testCategoryId) {
        await fetch(`${BENCHMARK_CONFIG.API_URL}/categories/${testCategoryId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` },
        });
        console.log(`✅ Categoria deletada`);
    }

    console.log(`✅ Cleanup completo!\n`);
}

// ===============================
// 🧪 Benchmarks HTTP
// ===============================

async function benchmarkCreateLinks() {
    const timer = new BenchmarkTimer();

    console.log(`\n🧪 Teste 1: POST /links - Criando ${BENCHMARK_CONFIG.LINKS_TO_CREATE} links...`);

    for (let i = 0; i < BENCHMARK_CONFIG.LINKS_TO_CREATE; i++) {
        await timer.measure(async () => {
            const response = await fetch(`${BENCHMARK_CONFIG.API_URL}/links`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    url: `https://example.com/link-${i}`,
                    title: `Benchmark Link ${i}`,
                    description: `Descrição do link de teste ${i}`,
                    categoryId: testCategoryId,
                }),
            });

            if (response.ok) {
                const link = await response.json();
                testLinkIds.push(link.id);
            }
        });

        if (i % 100 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${BENCHMARK_CONFIG.LINKS_TO_CREATE}`);
        }
    }

    console.log(`\r   Progresso: ${BENCHMARK_CONFIG.LINKS_TO_CREATE}/${BENCHMARK_CONFIG.LINKS_TO_CREATE} ✅`);

    const result = timer.getStats('POST /links (Create)');
    printResults(result);
    return result;
}

async function benchmarkGetLinksWithoutCache() {
    const timer = new BenchmarkTimer();

    console.log(`\n🧪 Teste 2: GET /links - SEM cache (${BENCHMARK_CONFIG.READ_ITERATIONS}x)...`);

    for (let i = 0; i < BENCHMARK_CONFIG.READ_ITERATIONS; i++) {
        await timer.measure(async () => {
            // Adiciona timestamp para evitar cache HTTP
            const response = await fetch(
                `${BENCHMARK_CONFIG.API_URL}/links?page=1&limit=50&_t=${Date.now()}`,
                {
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    cache: 'no-store',
                }
            );

            if (response.ok) {
                await response.json();
            }
        });

        if (i % 50 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${BENCHMARK_CONFIG.READ_ITERATIONS}`);
        }
    }

    console.log(`\r   Progresso: ${BENCHMARK_CONFIG.READ_ITERATIONS}/${BENCHMARK_CONFIG.READ_ITERATIONS} ✅`);

    const result = timer.getStats('GET /links (First Request - Cache Miss)');
    printResults(result);
    return result;
}

async function benchmarkGetLinksWithCache() {
    const timer = new BenchmarkTimer();

    console.log(`\n🧪 Teste 3: GET /links - COM cache Redis (${BENCHMARK_CONFIG.READ_ITERATIONS}x)...`);

    // Primeira request para popular o cache
    await fetch(`${BENCHMARK_CONFIG.API_URL}/links?page=1&limit=50`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
    });

    // Aguardar um pouco para garantir que o cache foi salvo
    await new Promise(resolve => setTimeout(resolve, 100));

    for (let i = 0; i < BENCHMARK_CONFIG.READ_ITERATIONS; i++) {
        await timer.measure(async () => {
            const response = await fetch(`${BENCHMARK_CONFIG.API_URL}/links?page=1&limit=50`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });

            if (response.ok) {
                await response.json();
            }
        });

        if (i % 50 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${BENCHMARK_CONFIG.READ_ITERATIONS}`);
        }
    }

    console.log(`\r   Progresso: ${BENCHMARK_CONFIG.READ_ITERATIONS}/${BENCHMARK_CONFIG.READ_ITERATIONS} ✅`);

    const result = timer.getStats('GET /links (Cache Hit)');
    printResults(result);
    return result;
}

async function benchmarkSearchLinks() {
    const timer = new BenchmarkTimer();

    console.log(`\n🧪 Teste 4: GET /links?search=... (${BENCHMARK_CONFIG.READ_ITERATIONS}x)...`);

    for (let i = 0; i < BENCHMARK_CONFIG.READ_ITERATIONS; i++) {
        await timer.measure(async () => {
            const searchTerm = `link-${Math.floor(Math.random() * 100)}`;
            const response = await fetch(
                `${BENCHMARK_CONFIG.API_URL}/links?search=${searchTerm}`,
                {
                    headers: { 'Authorization': `Bearer ${authToken}` },
                }
            );

            if (response.ok) {
                await response.json();
            }
        });

        if (i % 50 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${BENCHMARK_CONFIG.READ_ITERATIONS}`);
        }
    }

    console.log(`\r   Progresso: ${BENCHMARK_CONFIG.READ_ITERATIONS}/${BENCHMARK_CONFIG.READ_ITERATIONS} ✅`);

    const result = timer.getStats('GET /links?search=... (Search)');
    printResults(result);
    return result;
}

async function benchmarkUpdateLinks() {
    const timer = new BenchmarkTimer();
    const iterations = Math.min(100, testLinkIds.length);

    console.log(`\n🧪 Teste 5: PUT /links/:id (${iterations}x)...`);

    for (let i = 0; i < iterations; i++) {
        const linkId = testLinkIds[i % testLinkIds.length];

        await timer.measure(async () => {
            const response = await fetch(`${BENCHMARK_CONFIG.API_URL}/links/${linkId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    title: `Updated Link ${i}`,
                    description: `Updated description ${i}`,
                }),
            });

            if (response.ok) {
                await response.json();
            }
        });

        if (i % 10 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${iterations}`);
        }
    }

    console.log(`\r   Progresso: ${iterations}/${iterations} ✅`);

    const result = timer.getStats('PUT /links/:id (Update)');
    printResults(result);
    return result;
}

// ===============================
// 🏃 Main
// ===============================

async function main() {
    console.log('\n🚀 LinkVault HTTP API Performance Benchmark');
    console.log('='.repeat(60));
    console.log(`API URL: ${BENCHMARK_CONFIG.API_URL}`);
    console.log(`Links a criar: ${BENCHMARK_CONFIG.LINKS_TO_CREATE}`);
    console.log(`Iterações de leitura: ${BENCHMARK_CONFIG.READ_ITERATIONS}`);
    console.log('='.repeat(60));

    const results: BenchmarkResult[] = [];

    try {
        // Verificar se o servidor está rodando
        const serverRunning = await checkServerHealth();
        if (!serverRunning) {
            process.exit(1);
        }

        // Setup
        await setupTestUser();
        await setupTestCategory();

        // Executar benchmarks
        results.push(await benchmarkCreateLinks());
        results.push(await benchmarkGetLinksWithoutCache());
        results.push(await benchmarkGetLinksWithCache());
        results.push(await benchmarkSearchLinks());
        results.push(await benchmarkUpdateLinks());

        // Comparação final
        console.log('\n' + '='.repeat(60));
        console.log('📈 COMPARAÇÃO DE PERFORMANCE');
        console.log('='.repeat(60));

        // Ordenar por velocidade (menor tempo = mais rápido)
        const sorted = [...results].sort((a, b) => a.avgTime - b.avgTime);

        console.log('\n🏆 Ranking (mais rápido → mais lento):\n');
        const medals = ['🥇', '🥈', '🥉'];
        sorted.forEach((result, index) => {
            const medal = medals[index] || '  ';
            console.log(`${medal} ${index + 1}. ${result.operation}`);
            console.log(`      Média: ${formatTime(result.avgTime)} | Throughput: ${Math.round(result.throughput)} req/s`);
        });

        // Cache speedup
        const withoutCache = results.find(r => r.operation.includes('Cache Miss'));
        const withCache = results.find(r => r.operation.includes('Cache Hit'));

        if (withoutCache && withCache) {
            const speedup = withoutCache.avgTime / withCache.avgTime;
            console.log(`\n🚀 CACHE SPEEDUP:`);
            console.log(`   Redis Cache é ${speedup.toFixed(1)}x mais rápido`);
            console.log(`   Economia de tempo: ${formatTime(withoutCache.avgTime - withCache.avgTime)} por request`);
        }

        console.log('\n✅ Benchmark completo!');

    } catch (error) {
        console.error('\n❌ Erro no benchmark:', error);
    } finally {
        // Cleanup
        await cleanupTestData();
    }
}

// Executar
main().catch(console.error);
