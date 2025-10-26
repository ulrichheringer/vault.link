# 📚 LinkVault - Documentação da API

## 🌐 Documentação Interativa (Swagger)

**Acesse a documentação interativa completa em:**

```
http://localhost:3000/swagger
```

A interface Swagger oferece:
- ✅ **Teste todos os endpoints** diretamente no navegador
- ✅ **Visualize schemas** de request e response
- ✅ **Autenticação JWT integrada**
- ✅ **Exemplos de uso** para cada endpoint
- ✅ **Exportação OpenAPI 3.0** em JSON

📖 Para mais detalhes sobre como usar o Swagger, consulte: [SWAGGER.md](./backend/SWAGGER.md)

---

## 🛠️ Tecnologias

- **Elysia** - Framework web moderno e rápido
- **Drizzle ORM** - Type-safe SQL ORM
- **PostgreSQL** - Banco de dados relacional
- **Redis** - Cache em memória para melhor performance
- **JWT** - Autenticação segura
- **TypeScript** - Tipagem estática
- **Swagger/OpenAPI** - Documentação interativa da API

## 🔧 Configuração

### Variáveis de Ambiente (.env)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/link-vault-db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
```

### Docker Compose

```bash
docker-compose up -d  # Inicia PostgreSQL e Redis
```

## 📦 Cache Redis

A API utiliza Redis para cache de dados, melhorando significativamente a performance:

### Links Cache
- **Chave**: `links:user:{userId}:page:{page}:limit:{limit}:cat:{categoryId}:search:{search}`
- **TTL**: 5 minutos (300 segundos)
- **Invalidação**: Ao criar, atualizar ou deletar links

### Categorias Cache
- **Chave Lista**: `categories:user:{userId}`
- **Chave Individual**: `category:{categoryId}:user:{userId}`
- **TTL**: 10 minutos (600 segundos)
- **Invalidação**: Ao criar, atualizar ou deletar categorias

### Estratégia de Invalidação
- Cache invalidado em todas as operações de escrita (POST, PUT, DELETE)
- Links também invalidam cache quando categorias são modificadas
- Pattern matching usado para invalidar múltiplas chaves relacionadas

## �🔐 Autenticação

Todas as rotas (exceto `/auth/register` e `/auth/login`) requerem autenticação via Bearer Token.

**Header necessário:**
```
Authorization: Bearer SEU_TOKEN_JWT
```

---

## 🔑 Rotas de Autenticação

### POST `/auth/register`
Registra um novo usuário.

**Payload:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "senha123"
}
```

**Resposta (201):**
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com"
}
```

---

### POST `/auth/login`
Faz login e retorna um token JWT.

**Payload:**
```json
{
  "username": "johndoe",
  "password": "senha123"
}
```

**Resposta (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com"
  }
}
```

---

## 📁 Rotas de Categorias

### GET `/categories`
Busca todas as categorias do usuário logado.

**Query Parameters:** Nenhum

**Resposta (200):**
```json
[
  {
    "id": 1,
    "name": "Trabalho",
    "userId": 1
  },
  {
    "id": 2,
    "name": "Pessoal",
    "userId": 1
  }
]
```

---

### GET `/categories/:id`
Busca uma categoria específica com seus links.

**Path Parameters:**
- `id` (number): ID da categoria

**Resposta (200):**
```json
{
  "id": 1,
  "name": "Trabalho",
  "userId": 1,
  "links": [
    {
      "id": 1,
      "title": "GitHub",
      "url": "https://github.com",
      "description": "Repositórios de código"
    },
    {
      "id": 2,
      "title": "Stack Overflow",
      "url": "https://stackoverflow.com",
      "description": null
    }
  ]
}
```

---

### POST `/categories`
Cria uma nova categoria.

**Payload:**
```json
{
  "name": "Trabalho"
}
```

**Validações:**
- `name`: obrigatório, mínimo 1 caractere, máximo 256 caracteres
- Não pode criar categoria com nome duplicado para o mesmo usuário

**Resposta (201):**
```json
{
  "id": 1,
  "name": "Trabalho",
  "userId": 1
}
```

---

### PUT `/categories/:id`
Atualiza uma categoria existente.

**Path Parameters:**
- `id` (number): ID da categoria

**Payload:**
```json
{
  "name": "Trabalho Novo"
}
```

**Validações:**
- `name`: obrigatório, mínimo 1 caractere, máximo 256 caracteres
- Categoria deve pertencer ao usuário logado

**Resposta (200):**
```json
{
  "id": 1,
  "name": "Trabalho Novo",
  "userId": 1
}
```

---

### DELETE `/categories/:id`
Deleta uma categoria.

**Path Parameters:**
- `id` (number): ID da categoria

**Observação:** Links associados a essa categoria ficarão sem categoria (categoryId = null)

**Resposta (200):**
```json
{
  "message": "Categoria deletada com sucesso."
}
```

---

## 🔗 Rotas de Links

### GET `/links`
Busca todos os links do usuário logado com paginação e filtros.

**Query Parameters:**
- `page` (number, opcional): Número da página (padrão: 1, mínimo: 1)
- `limit` (number, opcional): Itens por página (padrão: 10, mínimo: 1, máximo: 100)
- `categoryId` (number, opcional): Filtrar por categoria específica
- `search` (string, opcional): Buscar por texto no título, URL ou descrição

**Exemplos:**
```
GET /links
GET /links?page=2&limit=20
GET /links?categoryId=1
GET /links?search=github
GET /links?page=1&limit=10&categoryId=1&search=api
```

**Resposta (200):**
```json
{
  "data": [
    {
      "id": 1,
      "title": "GitHub",
      "url": "https://github.com",
      "description": "Repositórios de código",
      "userId": 1,
      "categoryId": 1,
      "categoria": "Trabalho"
    },
    {
      "id": 2,
      "title": "Netflix",
      "url": "https://netflix.com",
      "description": null,
      "userId": 1,
      "categoryId": 2,
      "categoria": "Entretenimento"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

### POST `/links`
Cria um novo link.

**Payload:**
```json
{
  "title": "GitHub",
  "url": "https://github.com",
  "description": "Repositórios de código",
  "categoryId": 1
}
```

**Campos:**
- `title` (string, obrigatório): Título do link
- `url` (string, obrigatório): URL válida (formato URI)
- `description` (string, opcional): Descrição do link
- `categoryId` (number, opcional): ID da categoria (deve pertencer ao usuário)

**Validações:**
- `url` deve ser uma URL válida
- Se `categoryId` for fornecido, a categoria deve existir e pertencer ao usuário

**Resposta (201):**
```json
{
  "id": 1,
  "title": "GitHub",
  "url": "https://github.com",
  "description": "Repositórios de código",
  "userId": 1,
  "categoryId": 1
}
```

---

### PUT `/links/:id`
Atualiza um link existente.

**Path Parameters:**
- `id` (number): ID do link

**Payload:**
```json
{
  "title": "GitHub - Novo Título",
  "url": "https://github.com/newacc",
  "description": "Nova descrição",
  "categoryId": 2
}
```

**Campos:**
- Todos os campos são opcionais
- `title` (string, opcional): Novo título
- `url` (string, opcional): Nova URL válida
- `description` (string, opcional): Nova descrição
- `categoryId` (number, opcional): Novo ID da categoria

**Validações:**
- Link deve pertencer ao usuário logado
- Se `url` for fornecida, deve ser válida
- Se `categoryId` for fornecido, deve existir e pertencer ao usuário

**Resposta (200):**
```json
{
  "id": 1,
  "title": "GitHub - Novo Título",
  "url": "https://github.com/newacc",
  "description": "Nova descrição",
  "userId": 1,
  "categoryId": 2
}
```

---

### DELETE `/links/:id`
Deleta um link específico.

**Path Parameters:**
- `id` (number): ID do link

**Validações:**
- Link deve pertencer ao usuário logado

**Resposta (200):**
```json
{
  "message": "Link deletado com sucesso."
}
```

---

## ❌ Códigos de Erro

### 400 - Bad Request
Erro de validação nos dados enviados.

```json
{
  "error": "O título do link é obrigatório"
}
```

### 401 - Unauthorized
Token inválido ou ausente.

```json
{
  "error": "Não autorizado. Token inválido ou ausente."
}
```

### 404 - Not Found
Recurso não encontrado.

```json
{
  "error": "Link não encontrado ou você não tem permissão"
}
```

### 500 - Internal Server Error
Erro interno do servidor.

```json
{
  "error": "Erro ao criar link"
}
```

---

## 📝 Exemplos de Uso

### Fluxo Completo

```javascript
// 1. Registrar usuário
const register = await fetch('http://localhost:3000/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johndoe',
    email: 'john@example.com',
    password: 'senha123'
  })
});

// 2. Fazer login
const login = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johndoe',
    password: 'senha123'
  })
});
const { token } = await login.json();

// 3. Criar categoria
const category = await fetch('http://localhost:3000/categories', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Trabalho'
  })
});
const { id: categoryId } = await category.json();

// 4. Criar link
const link = await fetch('http://localhost:3000/links', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: 'GitHub',
    url: 'https://github.com',
    description: 'Repositórios',
    categoryId: categoryId
  })
});

// 5. Buscar links com paginação
const links = await fetch('http://localhost:3000/links?page=1&limit=10', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { data, pagination } = await links.json();

// 6. Buscar links por categoria
const categoryLinks = await fetch(`http://localhost:3000/links?categoryId=${categoryId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 7. Buscar links com pesquisa
const searchLinks = await fetch('http://localhost:3000/links?search=github', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## ✅ Checklist para o Frontend

### Funcionalidades Prontas

✅ **Autenticação**
- Registro de usuários
- Login com JWT
- Sistema de tokens Bearer

✅ **Categorias**
- Listar todas as categorias
- Buscar categoria por ID (com links)
- Criar nova categoria
- Atualizar categoria
- Deletar categoria

✅ **Links**
- Listar links com paginação
- Filtrar por categoria
- Buscar por texto
- Criar novo link
- Atualizar link existente
- Deletar link

### Recursos Úteis Implementados

✅ **Paginação**
- Suporte a page e limit
- Retorna total de registros e páginas

✅ **Busca/Filtros**
- Busca textual em título, URL e descrição
- Filtro por categoria

✅ **Validações**
- Validação de URLs
- Validação de campos obrigatórios
- Verificação de permissões (usuário só acessa seus próprios dados)
- Prevenção de categorias duplicadas

✅ **Tratamento de Erros**
- Erros customizados (ValidationError, NotFoundError)
- Mensagens de erro claras
- Códigos HTTP apropriados

---

## 🎯 Recomendações para o Frontend

### Estado Global
Considere usar Zustand ou Context API para:
- Gerenciar token JWT
- Armazenar dados do usuário
- Cache de categorias

### Componentes Sugeridos
- `LoginForm` / `RegisterForm`
- `CategoryList` / `CategoryForm`
- `LinkList` / `LinkCard`
- `LinkForm` (criar/editar)
- `SearchBar`
- `Pagination`
- `CategoryFilter`

### Features Adicionais
- Debounce na busca
- Infinite scroll ou paginação tradicional
- Toast notifications para sucesso/erro
- Loading states
- Empty states

---

**Base URL:** `http://localhost:3000`

**Desenvolvido com Elysia + Bun + Drizzle ORM + PostgreSQL + Redis**
