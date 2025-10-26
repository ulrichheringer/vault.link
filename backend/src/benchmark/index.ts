/**
 * 🚀 LinkVault Performance Benchmark
 * 
 * Testa a performance de operações críticas:
 * - Criação de links
 * - Listagem de links
 * - Busca de links
 * - Cache hit/miss ratio
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Carrega o .env do diretório backend
config({ path: resolve(__dirname, '../../.env') });

import { db } from '../db';
import { links, categorias, usuarios } from '../db/schemas';
import { redisClient } from '../redis';
import { eq, and, ilike, or, desc, count } from 'drizzle-orm';

// ===============================
// 🎯 Configurações do Benchmark
// ===============================

const BENCHMARK_CONFIG = {
    // Quantos links criar para testes
    LINKS_TO_CREATE: 5000,

    // Quantas vezes repetir cada teste
    ITERATIONS: 1000,

    // Delay entre iterações (ms)
    DELAY_BETWEEN_ITERATIONS: 5,

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

        return {
            operation,
            iterations: sorted.length,
            totalTime: sum,
            avgTime: sum / sorted.length,
            minTime: sorted[0],
            maxTime: sorted[sorted.length - 1],
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
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
}

// ===============================
// 🧹 Setup e Cleanup
// ===============================

let testUserId: number;
let testCategoryId: number;
let testLinkIds: number[] = [];

async function setupTestData() {
    console.log('\n🔧 Setup: Criando dados de teste...');

    // Criar usuário de teste
    const hashedPassword = await Bun.password.hash('testpassword', {
        algorithm: 'bcrypt',
        cost: 10,
    });

    const [user] = await db.insert(usuarios).values({
        email: `benchmark-${Date.now()}@test.com`,
        hashed_password: hashedPassword,
        username: `bench_${Date.now()}`,
    }).returning();
    testUserId = user.id;
    console.log(`✅ Usuário criado: ID ${testUserId}`);

    // Criar categoria de teste
    const [category] = await db.insert(categorias).values({
        name: 'Benchmark Category',
        userId: testUserId,
    }).returning();
    testCategoryId = category.id;
    console.log(`✅ Categoria criada: ID ${testCategoryId}`);

    console.log(`✅ Setup completo!\n`);
}

async function cleanupTestData() {
    if (!BENCHMARK_CONFIG.CLEANUP_AFTER) {
        console.log('\n⏭️  Pulando cleanup (CLEANUP_AFTER = false)');
        return;
    }

    console.log('\n🧹 Cleanup: Removendo dados de teste...');

    // Deletar links
    if (testLinkIds.length > 0) {
        await db.delete(links).where(eq(links.userId, testUserId));
        console.log(`✅ ${testLinkIds.length} links deletados`);
    }

    // Deletar categoria
    if (testCategoryId) {
        await db.delete(categorias).where(eq(categorias.id, testCategoryId));
        console.log(`✅ Categoria deletada`);
    }

    // Deletar usuário
    if (testUserId) {
        await db.delete(usuarios).where(eq(usuarios.id, testUserId));
        console.log(`✅ Usuário deletado`);
    }

    // Limpar cache Redis
    const keys = await redisClient.keys(`links:user:${testUserId}:*`);
    if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`✅ ${keys.length} chaves Redis deletadas`);
    }

    console.log(`✅ Cleanup completo!\n`);
}

// ===============================
// 🧪 Benchmarks Individuais
// ===============================

async function benchmarkCreateLinks() {
    const timer = new BenchmarkTimer();

    console.log(`\n🧪 Teste 1: Criando ${BENCHMARK_CONFIG.LINKS_TO_CREATE} links...`);

    for (let i = 0; i < BENCHMARK_CONFIG.LINKS_TO_CREATE; i++) {
        await timer.measure(async () => {
            const [link] = await db.insert(links).values({
                url: `https://example.com/link-${i}`,
                title: `Benchmark Link ${i}`,
                description: `Descrição do link de teste ${i} para benchmark de performance`,
                userId: testUserId,
                categoryId: testCategoryId,
            }).returning();

            testLinkIds.push(link.id);
        });

        if (i % 10 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${BENCHMARK_CONFIG.LINKS_TO_CREATE}`);
        }
    }

    console.log(`\r   Progresso: ${BENCHMARK_CONFIG.LINKS_TO_CREATE}/${BENCHMARK_CONFIG.LINKS_TO_CREATE} ✅`);

    const result = timer.getStats('CREATE LINK (INSERT)');
    printResults(result);

    return result;
}

async function benchmarkGetLinksWithoutCache() {
    const timer = new BenchmarkTimer();

    console.log(`\n🧪 Teste 2: Buscando links SEM cache (${BENCHMARK_CONFIG.ITERATIONS}x)...`);

    for (let i = 0; i < BENCHMARK_CONFIG.ITERATIONS; i++) {
        // Limpar cache antes de cada iteração
        await redisClient.del(`links:user:${testUserId}:page:1:limit:20:cat:all:search:none`);

        await timer.measure(async () => {
            await db
                .select({
                    id: links.id,
                    url: links.url,
                    title: links.title,
                    description: links.description,
                    categoryId: links.categoryId,
                    userId: links.userId,
                    categoryName: categorias.name,
                })
                .from(links)
                .leftJoin(categorias, eq(links.categoryId, categorias.id))
                .where(eq(links.userId, testUserId))
                .orderBy(desc(links.id))
                .limit(20)
                .offset(0);
        });

        if (i % 10 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${BENCHMARK_CONFIG.ITERATIONS}`);
        }

        await new Promise(resolve => setTimeout(resolve, BENCHMARK_CONFIG.DELAY_BETWEEN_ITERATIONS));
    }

    console.log(`\r   Progresso: ${BENCHMARK_CONFIG.ITERATIONS}/${BENCHMARK_CONFIG.ITERATIONS} ✅`);

    const result = timer.getStats('GET LINKS (Database Query - NO CACHE)');
    printResults(result);

    return result;
}

async function benchmarkGetLinksWithCache() {
    const timer = new BenchmarkTimer();

    console.log(`\n🧪 Teste 3: Buscando links COM cache (${BENCHMARK_CONFIG.ITERATIONS}x)...`);

    // Pré-popular o cache
    const cacheKey = `links:user:${testUserId}:page:1:limit:20:cat:all:search:none`;
    const data = await db
        .select({
            id: links.id,
            url: links.url,
            title: links.title,
            description: links.description,
            categoryId: links.categoryId,
            userId: links.userId,
            categoryName: categorias.name,
        })
        .from(links)
        .leftJoin(categorias, eq(links.categoryId, categorias.id))
        .where(eq(links.userId, testUserId))
        .orderBy(desc(links.id))
        .limit(20)
        .offset(0);

    await redisClient.setEx(cacheKey, 300, JSON.stringify({ links: data, total: testLinkIds.length }));

    for (let i = 0; i < BENCHMARK_CONFIG.ITERATIONS; i++) {
        await timer.measure(async () => {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                JSON.parse(cached);
            }
        });

        if (i % 10 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${BENCHMARK_CONFIG.ITERATIONS}`);
        }

        await new Promise(resolve => setTimeout(resolve, BENCHMARK_CONFIG.DELAY_BETWEEN_ITERATIONS));
    }

    console.log(`\r   Progresso: ${BENCHMARK_CONFIG.ITERATIONS}/${BENCHMARK_CONFIG.ITERATIONS} ✅`);

    const result = timer.getStats('GET LINKS (Redis Cache HIT)');
    printResults(result);

    return result;
}

async function benchmarkSearchLinksILIKE() {
    const timer = new BenchmarkTimer();

    console.log(`\n🧪 Teste 4: Buscando com ILIKE (${BENCHMARK_CONFIG.ITERATIONS}x)...`);

    const searchTerms = ['link', 'test', 'benchmark', 'example', 'descrição'];

    for (let i = 0; i < BENCHMARK_CONFIG.ITERATIONS; i++) {
        const searchTerm = searchTerms[i % searchTerms.length];

        await timer.measure(async () => {
            await db
                .select({
                    id: links.id,
                    url: links.url,
                    title: links.title,
                    description: links.description,
                    categoryId: links.categoryId,
                    userId: links.userId,
                    categoryName: categorias.name,
                })
                .from(links)
                .leftJoin(categorias, eq(links.categoryId, categorias.id))
                .where(
                    and(
                        eq(links.userId, testUserId),
                        or(
                            ilike(links.title, `%${searchTerm}%`),
                            ilike(links.description, `%${searchTerm}%`)
                        )
                    )
                )
                .orderBy(desc(links.id))
                .limit(100);
        });

        if (i % 10 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${BENCHMARK_CONFIG.ITERATIONS}`);
        }

        await new Promise(resolve => setTimeout(resolve, BENCHMARK_CONFIG.DELAY_BETWEEN_ITERATIONS));
    }

    console.log(`\r   Progresso: ${BENCHMARK_CONFIG.ITERATIONS}/${BENCHMARK_CONFIG.ITERATIONS} ✅`);

    const result = timer.getStats('SEARCH LINKS (ILIKE - case insensitive)');
    printResults(result);

    return result;
}

async function benchmarkCountQuery() {
    const timer = new BenchmarkTimer();

    console.log(`\n🧪 Teste 5: Contando total de links (${BENCHMARK_CONFIG.ITERATIONS}x)...`);

    for (let i = 0; i < BENCHMARK_CONFIG.ITERATIONS; i++) {
        await timer.measure(async () => {
            await db
                .select({ count: count() })
                .from(links)
                .where(eq(links.userId, testUserId));
        });

        if (i % 10 === 0) {
            process.stdout.write(`\r   Progresso: ${i}/${BENCHMARK_CONFIG.ITERATIONS}`);
        }

        await new Promise(resolve => setTimeout(resolve, BENCHMARK_CONFIG.DELAY_BETWEEN_ITERATIONS));
    }

    console.log(`\r   Progresso: ${BENCHMARK_CONFIG.ITERATIONS}/${BENCHMARK_CONFIG.ITERATIONS} ✅`);

    const result = timer.getStats('COUNT QUERY (Total de links)');
    printResults(result);

    return result;
}

// ===============================
// 📈 Comparações e Análise
// ===============================

function printComparison(results: BenchmarkResult[]) {
    console.log('\n' + '='.repeat(60));
    console.log('📈 COMPARAÇÃO DE PERFORMANCE');
    console.log('='.repeat(60));

    const sortedByAvg = [...results].sort((a, b) => a.avgTime - b.avgTime);

    console.log('\n🏆 Ranking (mais rápido → mais lento):\n');
    sortedByAvg.forEach((result, index) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        console.log(`${emoji} ${index + 1}. ${result.operation}`);
        console.log(`      Média: ${formatTime(result.avgTime)}`);
    });

    // Cache Speedup
    const cacheResult = results.find(r => r.operation.includes('Redis Cache'));
    const dbResult = results.find(r => r.operation.includes('NO CACHE'));

    if (cacheResult && dbResult) {
        const speedup = dbResult.avgTime / cacheResult.avgTime;
        console.log('\n🚀 CACHE SPEEDUP:');
        console.log(`   Redis Cache é ${speedup.toFixed(1)}x mais rápido que Database Query`);
        console.log(`   Economia de tempo: ${formatTime(dbResult.avgTime - cacheResult.avgTime)} por request`);
    }

    // Throughput
    console.log('\n📊 THROUGHPUT (requests/segundo):');
    results.forEach(result => {
        const rps = 1000 / result.avgTime;
        console.log(`   ${result.operation}: ${rps.toFixed(0)} req/s`);
    });
}

// ===============================
// 🎬 Main
// ===============================

async function runBenchmark() {
    console.log('\n🚀 LinkVault Performance Benchmark');
    console.log('='.repeat(60));
    console.log(`Links a criar: ${BENCHMARK_CONFIG.LINKS_TO_CREATE}`);
    console.log(`Iterações por teste: ${BENCHMARK_CONFIG.ITERATIONS}`);
    console.log('='.repeat(60));

    const allResults: BenchmarkResult[] = [];

    try {
        // Setup
        await setupTestData();

        // Executar benchmarks
        allResults.push(await benchmarkCreateLinks());
        allResults.push(await benchmarkGetLinksWithoutCache());
        allResults.push(await benchmarkGetLinksWithCache());
        allResults.push(await benchmarkSearchLinksILIKE());
        allResults.push(await benchmarkCountQuery());

        // Análise
        printComparison(allResults);

        console.log('\n✅ Benchmark completo!');

    } catch (error) {
        console.error('\n❌ Erro no benchmark:', error);
    } finally {
        // Cleanup
        await cleanupTestData();

        // Fechar conexões
        await redisClient.quit();
        process.exit(0);
    }
}

// Executar
if (require.main === module) {
    runBenchmark();
}
