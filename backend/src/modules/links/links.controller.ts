import { createLinkSchema, linkParamsSchema, updateLinkSchema, linkQuerySchema } from './links.models';
import * as LinksService from './links.service';
import { AppError } from '../../utils/errors';

// GET /links
export async function handleGetLinks({ user, query }: any) {
    try {
        return await LinksService.getLinksForUser(user.id, query);
    } catch (error) {
        // Se for um erro customizado, propaga para o handler global
        if (error instanceof AppError) {
            throw error;
        }

        // Erro inesperado
        console.error('Erro inesperado ao buscar links:', error);
        throw new AppError('Erro ao buscar links', 500);
    }
}

// POST /links
export async function handleCreateLink({ user, body, set }: any) {
    try {
        const newLink = await LinksService.createNewLink(user.id, body);

        set.status = 201;
        return newLink;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        console.error('Erro inesperado ao criar link:', error);
        throw new AppError('Erro ao criar link', 500);
    }
}

// PUT/PATCH /links/:id
export async function handleUpdateLink({ user, params, body, set }: any) {
    try {
        const updatedLink = await LinksService.updateLink(user.id, params.id, body);
        return updatedLink;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        console.error('Erro inesperado ao atualizar link:', error);
        throw new AppError('Erro ao atualizar link', 500);
    }
}

// DELETE /links/:id
export async function handleDeleteLink({ user, params, set }: any) {
    try {
        const deletedLink = await LinksService.deleteLinkForUser(user.id, params.id);
        return { message: 'Link deletado com sucesso.' };
    } catch (error) {
        // Se for um erro customizado, propaga para o handler global
        if (error instanceof AppError) {
            throw error;
        }

        // Erro inesperado
        console.error('Erro inesperado ao deletar link:', error);
        throw new AppError('Erro ao deletar link', 500);
    }
}