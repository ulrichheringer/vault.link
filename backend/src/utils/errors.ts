/**
 * Classe base para erros customizados
 */
export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public code?: string
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Erro para recursos não encontrados
 */
export class NotFoundError extends AppError {
    constructor(message: string = 'Recurso não encontrado') {
        super(message, 404, 'NOT_FOUND');
    }
}

/**
 * Erro para conflitos (ex: unique constraint)
 */
export class ConflictError extends AppError {
    constructor(message: string = 'Conflito de dados') {
        super(message, 409, 'CONFLICT');
    }
}

/**
 * Erro para validação de dados
 */
export class ValidationError extends AppError {
    constructor(message: string = 'Dados inválidos') {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

/**
 * Erro para autenticação
 */
export class AuthenticationError extends AppError {
    constructor(message: string = 'Credenciais inválidas') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

/**
 * Erro para autorização
 */
export class AuthorizationError extends AppError {
    constructor(message: string = 'Sem permissão para acessar este recurso') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

/**
 * Utilitário para tratar erros do banco de dados PostgreSQL
 */
export function handleDatabaseError(error: any): never {
    // Log completo do erro para debugging
    console.error('==== ERRO DO BANCO DE DADOS ====');
    console.error('Tipo do erro:', typeof error);
    console.error('Error.code:', error.code);
    console.error('Error.message:', error.message);
    console.error('Error.detail:', error.detail);
    console.error('Error.constraint:', error.constraint);
    console.error('Error.column:', error.column);
    console.error('Error completo:', JSON.stringify(error, null, 2));
    console.error('================================');

    // Verifica se é um erro de constraint do PostgreSQL
    const errorCode = error.code || error.errno || '';
    const errorMessage = error.message || '';
    const errorDetail = error.detail || '';

    // Erro de unique constraint violation (23505)
    if (errorCode === '23505' ||
        errorMessage.includes('unique constraint') ||
        errorMessage.includes('duplicate key') ||
        errorDetail.includes('already exists')) {

        // Tenta extrair o nome da constraint
        let constraintName = error.constraint || '';

        // Tenta extrair o campo do detail
        const detailMatch = errorDetail.match(/Key \(([^)]+)\)/);
        const field = detailMatch ? detailMatch[1] : '';

        // Tenta extrair o campo da mensagem
        const messageMatch = errorMessage.match(/constraint "([^"]+)"/);
        if (!constraintName && messageMatch) {
            constraintName = messageMatch[1];
        }

        // Monta mensagem descritiva
        let message = 'Violação de unique constraint: ';

        if (field) {
            message += `o campo "${field}" já existe`;
        } else if (constraintName) {
            // Tenta humanizar o nome da constraint
            const fieldFromConstraint = constraintName.replace(/_/g, ' ').replace('usuarios', '').replace('unique', '').trim();
            message += `${fieldFromConstraint || constraintName} já existe`;
        } else {
            message += 'este registro já existe no banco de dados';
        }

        throw new ConflictError(message);
    }

    // Erro de foreign key violation (23503)
    if (errorCode === '23503' || errorMessage.includes('foreign key')) {
        const match = errorDetail.match(/Key \(([^)]+)\)/);
        const field = match ? match[1] : 'referência';

        throw new ValidationError(
            `Referência inválida: o valor para "${field}" não existe.`
        );
    }

    // Erro de not null violation (23502)
    if (errorCode === '23502' || errorMessage.includes('null value')) {
        const column = error.column || 'desconhecido';
        throw new ValidationError(
            `O campo "${column}" é obrigatório e não pode ser nulo.`
        );
    }

    // Erro de check constraint violation (23514)
    if (errorCode === '23514' || errorMessage.includes('check constraint')) {
        throw new ValidationError(
            'Os dados não atendem aos requisitos de validação.'
        );
    }

    // Outros erros do banco
    throw new AppError(
        `Erro ao processar operação no banco de dados: ${errorMessage || 'Erro desconhecido'}`,
        500,
        'DATABASE_ERROR'
    );
}
