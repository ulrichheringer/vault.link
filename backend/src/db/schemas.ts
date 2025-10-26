import { pgTable, serial, text, integer, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Tabela 1: usuarios
 * Armazena as informações de login e perfil do usuário.
 */
export const usuarios = pgTable('usuarios', {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 256 }).notNull().unique(),
    email: varchar('email', { length: 256 }).notNull().unique(),
    hashed_password: text('hashed_password').notNull(),
});

/**
 * Tabela 2: categorias
 * Armazena as categorias que um usuário cria para organizar seus links.
 */
export const categorias = pgTable('categorias', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 256 }).notNull(),

    // Chave estrangeira (FK) que conecta a categoria ao usuário
    userId: integer('user_id').notNull().references(() => usuarios.id, {
        onDelete: 'cascade' // Se o usuário for deletado, suas categorias também são.
    }),
});

/**
 * Tabela 3: links
 * Armazena os links salvos por um usuário.
 */
export const links = pgTable('links', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 256 }).notNull(), // O "título alternativo"
    url: text('url').notNull(),                         // O link real
    description: text('description'),                   // Descrição opcional

    // Chave estrangeira (FK) que conecta o link ao usuário
    userId: integer('user_id').notNull().references(() => usuarios.id, {
        onDelete: 'cascade' // Se o usuário for deletado, seus links também são.
    }),

    // Chave estrangeira (FK) opcional que conecta o link a uma categoria
    categoryId: integer('category_id').references(() => categorias.id, {
        onDelete: 'set null' // Se a categoria for deletada, o link fica "sem categoria" (null).
    }),
});

// --- DEFINIÇÃO DAS RELAÇÕES (Para Joins fáceis) ---

/**
 * Relação para 'usuarios':
 * - Um usuário pode ter 'muitas' categorias.
 * - Um usuário pode ter 'muitos' links.
 */
export const usuariosRelations = relations(usuarios, ({ many }) => ({
    categorias: many(categorias),
    links: many(links),
}));

/**
 * Relação para 'categorias':
 * - Uma categoria pertence a 'um' usuário.
 * - Uma categoria pode ter 'muitos' links.
 */
export const categoriasRelations = relations(categorias, ({ one, many }) => ({
    usuario: one(usuarios, {
        fields: [categorias.userId],
        references: [usuarios.id],
    }),
    links: many(links),
}));

/**
 * Relação para 'links':
 * - Um link pertence a 'um' usuário.
 * - Um link pertence a 'uma' categoria (opcionalmente).
 */
export const linksRelations = relations(links, ({ one }) => ({
    usuario: one(usuarios, {
        fields: [links.userId],
        references: [usuarios.id],
    }),
    categoria: one(categorias, {
        fields: [links.categoryId],
        references: [categorias.id],
    }),
}));