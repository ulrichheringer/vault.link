import * as CategoriesService from './categories.service';
import type { CreateCategoryData, UpdateCategoryData } from './categories.models';
import { AppError } from '../../utils/errors';

/**
 * GET /categories
 * Buscar todas as categorias do usuário logado
 */
export async function handleGetCategories({ user }: any) {
    try {
        console.log('[CATEGORIES CONTROLLER] GET /categories - User:', user.username);
        const categories = await CategoriesService.getCategoriesForUser(user.id);
        return categories;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        console.error('[CATEGORIES CONTROLLER] Erro inesperado:', error);
        throw new AppError('Erro ao buscar categorias', 500);
    }
}

/**
 * GET /categories/:id
 * Buscar uma categoria específica com seus links
 */
export async function handleGetCategoryById({ user, params }: any) {
    try {
        console.log('[CATEGORIES CONTROLLER] GET /categories/:id - User:', user.username, 'ID:', params.id);
        const category = await CategoriesService.getCategoryById(user.id, params.id);
        return category;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        console.error('[CATEGORIES CONTROLLER] Erro inesperado:', error);
        throw new AppError('Erro ao buscar categoria', 500);
    }
}

/**
 * POST /categories
 * Criar uma nova categoria
 */
export async function handleCreateCategory({ user, body, set }: any) {
    try {
        console.log('[CATEGORIES CONTROLLER] POST /categories - User:', user.username);
        console.log('[CATEGORIES CONTROLLER] Body:', body);

        const newCategory = await CategoriesService.createCategory(
            user.id,
            body as CreateCategoryData
        );

        set.status = 201;
        return newCategory;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        console.error('[CATEGORIES CONTROLLER] Erro inesperado:', error);
        throw new AppError('Erro ao criar categoria', 500);
    }
}

/**
 * PUT /categories/:id
 * Atualizar uma categoria
 */
export async function handleUpdateCategory({ user, params, body }: any) {
    try {
        console.log('[CATEGORIES CONTROLLER] PUT /categories/:id - User:', user.username, 'ID:', params.id);
        console.log('[CATEGORIES CONTROLLER] Body:', body);

        const updatedCategory = await CategoriesService.updateCategory(
            user.id,
            params.id,
            body as UpdateCategoryData
        );

        return updatedCategory;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        console.error('[CATEGORIES CONTROLLER] Erro inesperado:', error);
        throw new AppError('Erro ao atualizar categoria', 500);
    }
}

/**
 * DELETE /categories/:id
 * Deletar uma categoria
 */
export async function handleDeleteCategory({ user, params, set }: any) {
    try {
        console.log('[CATEGORIES CONTROLLER] DELETE /categories/:id - User:', user.username, 'ID:', params.id);

        await CategoriesService.deleteCategory(user.id, params.id);

        return {
            message: 'Categoria deletada com sucesso',
            note: 'Os links que pertenciam a esta categoria agora estão sem categoria'
        };
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        console.error('[CATEGORIES CONTROLLER] Erro inesperado:', error);
        throw new AppError('Erro ao deletar categoria', 500);
    }
}
