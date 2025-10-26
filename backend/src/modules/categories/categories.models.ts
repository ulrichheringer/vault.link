import { t } from 'elysia';

// Schema para criar uma categoria
export const CreateCategorySchema = t.Object({
    name: t.String({
        minLength: 1,
        maxLength: 256,
        description: 'Nome da categoria'
    }),
});

// Schema para atualizar uma categoria
export const UpdateCategorySchema = t.Object({
    name: t.String({
        minLength: 1,
        maxLength: 256,
        description: 'Novo nome da categoria'
    }),
});

// Schema para validar parâmetros de rota (ID)
export const CategoryParamsSchema = t.Object({
    id: t.Numeric({
        description: 'ID da categoria'
    }),
});

// Schema de resposta de categoria
export const CategoryResponseSchema = t.Object({
    id: t.Number(),
    name: t.String(),
    userId: t.Number(),
});

// Schema de resposta de categoria com links
export const CategoryWithLinksResponseSchema = t.Object({
    id: t.Number(),
    name: t.String(),
    userId: t.Number(),
    links: t.Array(t.Object({
        id: t.Number(),
        title: t.String(),
        url: t.String(),
        description: t.Union([t.String(), t.Null()]),
    })),
});

// Tipos TypeScript para uso interno
export type CreateCategoryData = typeof CreateCategorySchema.static;
export type UpdateCategoryData = typeof UpdateCategorySchema.static;
