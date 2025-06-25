import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { AuthState, User, LoginCredentials, AuthResponse, UserRegistrationData } from '../types/auth'; // Usando ruta relativa
import api from '../services/api'; // Usando ruta relativa
import { toast } from '../components/ui/use-toast'; // Usando ruta relativa

// Define la interfaz para el contexto de autenticación
interface AuthContextType extends AuthState {
    login: (credentials: LoginCredentials) => Promise<boolean>;
    logout: () => void;
    register: (userData: UserRegistrationData) => Promise<User>; // Añadido el método register
    // Cambiado de 'updateUser' a 'setUser' y ajustado el tipo de parámetro
    setUser: (user: User | null) => void; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Definición de las acciones del reducer
type AuthAction =
    | { type: 'LOGIN_START' }
    | { type: 'LOGIN_SUCCESS'; payload: { user: User; accessToken: string; refreshToken: string } } 
    | { type: 'LOGIN_FAILURE'; payload: string }
    | { type: 'LOGOUT' }
    // Cambiado de 'UPDATE_USER' a 'SET_USER' y ajustado el tipo de payload
    | { type: 'SET_USER'; payload: User | null } 
    | { type: 'RESTORE_SESSION'; payload: { user: User; accessToken: string; refreshToken: string } } 
    | { type: 'REGISTER_START' } 
    | { type: 'REGISTER_SUCCESS' } 
    | { type: 'REGISTER_FAILURE'; payload: string }; 


// Estado inicial del reducer
const initialState: AuthState = {
    user: null,
    accessToken: null, 
    refreshToken: null, 
    isAuthenticated: false,
    isLoading: false,
    error: null,
};

// Reducer de autenticación
function authReducer(state: AuthState, action: AuthAction): AuthState {
    switch (action.type) {
        case 'LOGIN_START':
        case 'REGISTER_START': 
            return { ...state, isLoading: true, error: null };
        case 'LOGIN_SUCCESS':
            return {
                ...state,
                user: action.payload.user,
                accessToken: action.payload.accessToken, 
                refreshToken: action.payload.refreshToken, 
                isAuthenticated: true,
                isLoading: false,
                error: null,
            };
        case 'LOGIN_FAILURE':
        case 'REGISTER_FAILURE': 
            return {
                ...state,
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false,
                isLoading: false,
                error: action.payload,
            };
        case 'LOGOUT':
            return initialState;
        // Manejador para la acción SET_USER (reemplaza completamente el objeto user)
        case 'SET_USER': 
            return { ...state, user: action.payload };
        case 'RESTORE_SESSION':
            return {
                ...state,
                user: action.payload.user,
                accessToken: action.payload.accessToken,
                refreshToken: action.payload.refreshToken,
                isAuthenticated: true,
                isLoading: false, 
            };
        case 'REGISTER_SUCCESS': 
            return { ...state, isLoading: false, error: null };
        default:
            return state;
    }
}

// Componente proveedor de autenticación
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    // Efecto para restaurar la sesión desde localStorage al cargar la aplicación
    useEffect(() => {
        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        const userData = localStorage.getItem('user');

        if (accessToken && refreshToken && userData) {
            try {
                const user: User = JSON.parse(userData);
                dispatch({ type: 'RESTORE_SESSION', payload: { user, accessToken, refreshToken } });
            } catch (error) {
                console.error("Error al parsear datos de usuario de localStorage:", error);
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                dispatch({ type: 'LOGOUT' }); 
            }
        }
    }, []);

    // Función para iniciar sesión
    const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
        dispatch({ type: 'LOGIN_START' });

        try {
            const response: AuthResponse = await api.login(credentials);

            if (!response.access || !response.refresh || !response.user) {
                throw new Error('La respuesta del servidor no contiene los tokens o la información del usuario.');
            }

            const user: User = response.user;

            // Guardar en localStorage
            localStorage.setItem('accessToken', response.access);
            localStorage.setItem('refreshToken', response.refresh);
            localStorage.setItem('user', JSON.stringify(user));

            dispatch({
                type: 'LOGIN_SUCCESS',
                payload: { user, accessToken: response.access, refreshToken: response.refresh },
            });

            toast({
                title: "Inicio de sesión exitoso",
                description: `Bienvenido/a ${user.first_name}`,
            });

            return true;
        } catch (error: any) {
            let errorMessage = 'Error al iniciar sesión';

            if (error.code === 'ECONNABORTED') {
                errorMessage = 'El servidor está tardando demasiado en responder. Por favor, inténtelo de nuevo más tarde.';
            } else if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = 'Credenciales incorrectas. Verifique su usuario y contraseña.';
                } else if (error.response.data?.detail) {
                    errorMessage = error.response.data.detail;
                } else if (typeof error.response.data === 'string') {
                    errorMessage = error.response.data;
                } else if (error.response.status >= 500) {
                    errorMessage = 'Error en el servidor. Por favor, inténtelo más tarde.';
                }
            } else if (error.request) {
                errorMessage = 'No se pudo conectar con el servidor. Verifique su conexión a internet.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });

            toast({
                title: "Error de autenticación",
                description: errorMessage,
                variant: "destructive",
            });

            return false;
        }
    }, []);

    // Función para registrar un nuevo usuario
    const register = useCallback(async (userData: UserRegistrationData): Promise<User> => {
        dispatch({ type: 'REGISTER_START' });
        try {
            const newUser: User = await api.createUsuario(userData);
            dispatch({ type: 'REGISTER_SUCCESS' });
            toast({
                title: "Registro exitoso",
                description: "Su cuenta ha sido creada. Ahora puede iniciar sesión.",
            });
            return newUser;
        } catch (error: any) {
            let errorMessage = 'Error al registrar usuario';
            if (error.response) {
                if (error.response.data) {
                    // Intenta parsear errores de validación de Django REST Framework
                    errorMessage = JSON.stringify(error.response.data); 
                    if (error.response.data.detail) {
                      errorMessage = error.response.data.detail;
                    } else if (error.response.data.username) {
                        errorMessage = `Nombre de usuario: ${error.response.data.username.join(', ')}`;
                    } else if (error.response.data.email) {
                        errorMessage = `Email: ${error.response.data.email.join(', ')}`;
                    } else if (error.response.data.password) {
                        errorMessage = `Contraseña: ${error.response.data.password.join(', ')}`;
                    } else if (error.response.data.empresa_nombre) {
                        errorMessage = `Nombre de empresa: ${error.response.data.empresa_nombre.join(', ')}`;
                    }
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            console.error('Registration failed:', errorMessage);
            dispatch({ type: 'REGISTER_FAILURE', payload: errorMessage });
            toast({
                title: "Error de registro",
                description: errorMessage,
                variant: "destructive",
            });
            throw error; 
        }
    }, []);

    // Función para cerrar sesión
    const logout = useCallback(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        dispatch({ type: 'LOGOUT' });

        toast({
            title: "Sesión cerrada",
            description: "Has cerrado sesión correctamente",
        });
    }, []);

    // Función para actualizar los datos del usuario en el contexto (anteriormente 'updateUser')
    const setUser = useCallback((user: User | null) => { // Acepta User o null para reemplazar completamente
        // Asegúrate de que el user en localStorage también se actualice
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
        dispatch({ type: 'SET_USER', payload: user });
    }, []);

    // Provee el estado y las funciones a los componentes hijos
    const authContextValue = {
        ...state,
        login,
        logout,
        register, 
        setUser, // Ahora se llama setUser
    };

    return (
        <AuthContext.Provider value={authContextValue}>
            {children}
        </AuthContext.Provider>
    );
}

// Hook personalizado para usar el contexto de autenticación
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}