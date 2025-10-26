import { t } from 'elysia';

export const createLinkSchema = t.Object({
    title: t.String({ minLength: 1 }),
    url: t.String({ format: 'uri' }),
    description: t.Optional(t.String()),
    categoryId: t.Optional(t.Number())
});

export const updateLinkSchema = t.Object({
    title: t.Optional(t.String({ minLength: 1 })),
    url: t.Optional(t.String({ format: 'uri' })),
    description: t.Optional(t.String()),
    categoryId: t.Optional(t.Number())
});

export const linkParamsSchema = t.Object({
    id: t.Numeric()
});

export const linkQuerySchema = t.Object({
    page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
    categoryId: t.Optional(t.Numeric()),
    search: t.Optional(t.String())
});

export const paginatedLinksResponseSchema = t.Object({
    data: t.Array(t.Object({
        id: t.Number(),
        title: t.String(),
        url: t.String(),
        description: t.Union([t.String(), t.Null()]),
        userId: t.Number(),
        categoryId: t.Union([t.Number(), t.Null()]),
        categoria: t.Union([t.String(), t.Null()])
    })),
    pagination: t.Object({
        page: t.Number(),
        limit: t.Number(),
        total: t.Number(),
        totalPages: t.Number()
    })
});