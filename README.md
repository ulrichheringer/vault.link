# 🔗 LinkVault

> Um gerenciador moderno de links com foco em performance, escalabilidade e experiência do desenvolvedor.

LinkVault é uma aplicação full-stack para salvar, organizar e buscar links de forma eficiente. O projeto foi desenvolvido com tecnologias de ponta do ecossistema JavaScript/TypeScript, priorizando velocidade de desenvolvimento, performance em runtime e boas práticas de arquitetura.

## 🎯 Motivação

Este projeto nasceu da necessidade de explorar e dominar tecnologias emergentes do ecossistema web moderno. Mais do que um simples gerenciador de links, o LinkVault é um laboratório prático para implementar conceitos avançados como:

- **Arquitetura de alta performance** com cache distribuído
- **Type-safety end-to-end** do banco ao frontend
- **Observabilidade** através de logging estruturado
- **Containerização** para facilitar deploy e desenvolvimento
- **Benchmarking** para validação de decisões arquiteturais

## 🚀 Stack Tecnológica

### Backend

- **[Bun](https://bun.sh/)** - Runtime JavaScript/TypeScript ultrarrápido que substitui Node.js, oferecendo performance até 4x superior no startup e execução. Escolhido pela velocidade de execução e built-in testing.

- **[Elysia](https://elysiajs.com/)** - Framework web moderno otimizado para Bun, com foco em ergonomia e performance. Implementa conceitos como:
  - Type-safe routing com inferência automática
  - Middleware composável
  - Documentação Swagger automática via decorators

- **[Drizzle ORM](https://orm.drizzle.team/)** - ORM type-safe e leve que prioriza SQL puro. Diferencial:
  - Zero runtime overhead
  - Type inference automático
  - Migrations declarativas
  - Queries relacionais eficientes

- **[PostgreSQL](https://www.postgresql.org/)** - Banco de dados relacional robusto com:
  - Índices otimizados para buscas case-insensitive (ILIKE)
  - Foreign keys com cascade para integridade referencial
  - JSONB para metadados flexíveis (futuro)

- **[Redis](https://redis.io/)** - Cache em memória implementado estrategicamente para:
  - Cache de listagem de links (TTL: 5 minutos)
  - Invalidação automática em operações de escrita
  - Redução de ~40% no tempo de resposta (validado via benchmark)

### Frontend

- **[Astro](https://astro.build/)** - Framework moderno para conteúdo com:
  - Server-Side Rendering (SSR) padrão
  - Hydration parcial (ship less JavaScript)
  - Integração com TypeScript e Tailwind

- **[Tailwind CSS](https://tailwindcss.com/)** - Framework CSS utility-first para desenvolvimento ágil:
  - Design system consistente
  - Zero CSS customizado
  - Tree-shaking automático

- **[Eden Treaty](https://elysiajs.com/eden/overview.html)** - Client type-safe que sincroniza automaticamente tipos entre backend e frontend, eliminando necessidade de gerar SDKs manualmente.

### DevOps & Tooling

- **[Docker Compose](https://docs.docker.com/compose/)** - Orquestração de containers para PostgreSQL e Redis
- **[Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)** - CLI para migrations e introspection
- **TypeScript** - Tipagem estática em toda a aplicação
- **Sistema de Logging Estruturado** - Logging categorizado (INFO, ERROR, AUTH, DATABASE, CACHE) com rotação de arquivos

## 📐 Arquitetura

```
┌─────────────────┐
│   Astro (SSR)   │  Frontend - Server-Side Rendering
│   + Tailwind    │
└────────┬────────┘
         │ Eden Treaty (Type-safe HTTP)
         ▼
┌─────────────────┐
│  Elysia + Bun   │  API REST + JWT Auth
│   Middleware    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────┐
│ Redis  │ │  PG  │  Cache + Database
│ Cache  │ │      │
└────────┘ └──────┘
```

### Padrões Implementados

**Repository Pattern**: Separação clara entre controllers (HTTP) e services (lógica de negócio)

**Middleware Chain**: 
- Authentication (JWT validation)
- Logging (request/response tracking)
- Error handling (tratamento centralizado)

**Cache-Aside Pattern**:
```typescript
// 1. Check cache
const cached = await redis.get(key);
if (cached) return JSON.parse(cached);

// 2. Query database
const data = await db.query(...);

// 3. Set cache
await redis.setEx(key, TTL, JSON.stringify(data));

return data;
```

**Graceful Degradation**: Redis é opcional - se não conectar, a aplicação continua funcionando consultando apenas o banco.

## 🔐 Segurança

- **JWT** para autenticação stateless
- **Bcrypt** (via Bun.password) para hash de senhas (cost: 10)
- **SQL Injection Protection** via Drizzle ORM (prepared statements)
- **CORS** configurado para produção

## 📊 Performance & Benchmarking

O projeto inclui uma suite completa de benchmarks que valida decisões arquiteturais:

### Database Benchmark
Testa operações diretas no banco:
- INSERT: ~3.3ms (303 req/s)
- SELECT com cache: ~2.7ms (377 req/s)
- SELECT sem cache: ~4.3ms (235 req/s)
- ILIKE search: ~9.3ms (108 req/s)

**Resultado**: Redis proporciona speedup de **1.6x** em queries de leitura.

### HTTP Benchmark
Testa a API completa (rede + middleware + serialização):
- Endpoints testados: login, create link, get links, search
- Mede latência P50, P95, P99
- Valida throughput real sob carga

Execute os benchmarks:
```bash
# Database benchmark
bun backend/src/benchmark/index.ts

# HTTP benchmark (requer servidor rodando)
bun backend/src/benchmark/http-benchmark.ts
```

## 🗃️ Schema do Banco

```sql
-- Usuários
usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL
)

-- Categorias
categorias (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE
)

-- Links
links (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Índices de Performance
CREATE INDEX idx_links_user_id ON links(user_id);
CREATE INDEX idx_links_category_id ON links(category_id);
CREATE INDEX idx_links_title_search ON links USING gin(to_tsvector('english', title));
```

## 🚦 Quick Start

### Pré-requisitos
- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/) & Docker Compose
- PostgreSQL 15+ (ou usar Docker)
- Redis 7+ (ou usar Docker)

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/linkvault.git
cd linkvault
```

### 2. Configure as variáveis de ambiente
```bash
# backend/.env
DATABASE_URL="postgresql://postgres:root@localhost:5432/link-vault-db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="sua-chave-secreta-aqui"
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=root
PG_DATABASE=link-vault-db
```

### 3. Inicie os serviços com Docker
```bash
docker-compose up -d
```

### 4. Instale dependências e rode migrations
```bash
# Instalar dependências do monorepo
bun install

# Setup do banco de dados
cd backend
bun run db:push

# Opcional: seed de dados para desenvolvimento
```

### 5. Inicie a aplicação
```bash
# Na raiz do projeto - inicia backend e frontend simultaneamente
bun run dev

# Ou separadamente:
bun run dev:backend  # http://localhost:3000
bun run dev:frontend # http://localhost:4321
```

### 6. Acesse a aplicação
- **Frontend**: http://localhost:4321
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/swagger

## 📁 Estrutura do Projeto

```
linkvault/
├── backend/
│   ├── src/
│   │   ├── benchmark/          # Suite de benchmarks
│   │   │   ├── index.ts        # Benchmark de database
│   │   │   └── http-benchmark.ts # Benchmark de API
│   │   ├── db/
│   │   │   ├── index.ts        # Conexão Drizzle
│   │   │   └── schemas.ts      # Schemas do banco
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── logging.middleware.ts
│   │   ├── modules/
│   │   │   ├── auth/           # Autenticação JWT
│   │   │   ├── categories/     # CRUD de categorias
│   │   │   └── links/          # CRUD de links + cache
│   │   ├── redis/
│   │   │   └── index.ts        # Cliente Redis
│   │   ├── utils/
│   │   │   ├── errors.ts       # Error handling
│   │   │   └── logger.ts       # Sistema de logging
│   │   └── index.ts            # Entry point
│   ├── logs/                   # Logs estruturados
│   ├── drizzle.config.ts       # Config do Drizzle
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/         # Componentes Astro
│   │   ├── layouts/            # Layouts base
│   │   ├── lib/
│   │   │   ├── api.ts          # Eden Treaty client
│   │   │   └── auth.ts         # Auth helpers
│   │   ├── pages/              # Rotas Astro
│   │   │   ├── index.astro
│   │   │   ├── login.astro
│   │   │   ├── dashboard.astro
│   │   │   └── links/
│   │   └── styles/
│   └── package.json
├── docker-compose.yml
└── package.json                # Monorepo root
```

## 🧪 Testando a API

### Via Swagger UI
Acesse http://localhost:3000/swagger para testar todos os endpoints interativamente.

### Via cURL
```bash
# Registrar usuário
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "pedro", "email": "pedro@example.com", "password": "senha123"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "pedro@example.com", "password": "senha123"}'

# Criar link (com token)
curl -X POST http://localhost:3000/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "title": "Bun.sh",
    "url": "https://bun.sh",
    "description": "Fast JavaScript runtime"
  }'

# Listar links (cache automático no Redis)
curl http://localhost:3000/links \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

## 📈 Melhorias Futuras

- [ ] Testes automatizados (unit + integration) com Bun test
- [ ] CI/CD com GitHub Actions
- [ ] Deploy no Fly.io / Railway
- [ ] WebSockets para atualizações real-time
- [ ] Upload de thumbnails para links
- [ ] Full-text search com PostgreSQL tsvector
- [ ] Rate limiting com Redis
- [ ] Métricas com Prometheus + Grafana
- [ ] Tags para links (many-to-many)

## 🎓 Aprendizados e Decisões Técnicas

### Por que Bun ao invés de Node.js?
- **Performance**: 4x mais rápido no startup
- **DX**: TypeScript nativo, sem transpilação
- **Built-ins**: fetch, password hashing, testing inclusos
- **Compatibilidade**: 99% das libs NPM funcionam

### Por que Elysia ao invés de Express/Fastify?
- **Type-safety**: Rotas totalmente tipadas
- **Performance**: Benchmarks mostram 2-3x mais rápido que Express
- **Swagger automático**: Decorators geram documentação
- **Eden Treaty**: Client type-safe gerado automaticamente

### Por que Drizzle ao invés de Prisma?
- **Performance**: Zero overhead em runtime
- **Controle**: SQL puro quando necessário
- **Bundle size**: 10x menor que Prisma
- **Type inference**: Melhor suporte a queries complexas

### Quando usar Redis Cache?
Implementado apenas em **leituras frequentes** com **dados que toleram stale data**:
- ✅ Listagem de links (TTL: 5min)
- ❌ Autenticação (sempre fresh)
- ❌ Escritas (invalidação automática)

## 📝 Licença

MIT © Pedro Ulrich

---

Se este projeto te ajudou ou inspirou, considere dar uma ⭐!
