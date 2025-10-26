// Gerenciamento de autenticação no frontend

const TOKEN_KEY = 'linkvault_token';
const USER_KEY = 'linkvault_user';

export interface User {
    id: number;
    username: string;
    email: string;
}

export function saveAuth(token: string, user: User) {
    if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
}

export function getToken(): string | null {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(TOKEN_KEY);
    }
    return null;
}

export function getUser(): User | null {
    if (typeof window !== 'undefined') {
        const userStr = localStorage.getItem(USER_KEY);
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                return null;
            }
        }
    }
    return null;
}

export function clearAuth() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }
}

export function isAuthenticated(): boolean {
    return getToken() !== null;
}

export function logout() {
    clearAuth();
    window.location.href = '/login';
}

// Retorna headers com Authorization
export function getAuthHeaders() {
    const token = getToken();
    if (!token) return {};

    return {
        Authorization: `Bearer ${token}`
    };
}
