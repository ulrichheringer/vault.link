import { pgTable, serial, text, integer, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Tabela 1: usuarios
export const usuarios = pgTable('usuarios', {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 256 }).notNull().unique(),
    email: varchar('email', { length: 256 }).notNull().unique(),
    hashed_password: text('hashed_password').notNull(),
});

// Tabela 2: categorias
export const categorias = pgTable('categorias', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 256 }).notNull(),
    userId: integer('user_id').notNull().references(() => usuarios.id, {
        onDelete: 'cascade'
    }),
});

// Tabela 3: links
export const links = pgTable('links', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 256 }).notNull(),
    url: text('url').notNull(),
    description: text('description'),
    userId: integer('user_id').notNull().references(() => usuarios.id, {
        onDelete: 'cascade'
    }),
    categoryId: integer('category_id').references(() => categorias.id, {
        onDelete: 'set null'
    }),
});

// --- Relações (permanecem iguais) ---
export const usuariosRelations = relations(usuarios, ({ many }) => ({
    categorias: many(categorias),
    links: many(links),
}));

export const categoriasRelations = relations(categorias, ({ one, many }) => ({
    usuario: one(usuarios, {
        fields: [categorias.userId],
        references: [usuarios.id],
    }),
    links: many(links),
}));

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