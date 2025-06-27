// src/contexts/AuthContext.tsx

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
// Asegúrate de que User, LoginCredentials, AuthResponse, UserRegistrationData estén correctos en auth.ts
import { AuthState, User, LoginCredentials, AuthResponse, UserCreationData } from '../types/auth'; 
import api from '../services/api'; 
import { toast } from '../components/ui/use-toast'; 
import { Permission, Role } from '../types/rbac'; // Asegúrate de importar Role y Permission

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean; // Indica si se está cargando el estado inicial de autenticación
  login: (credentials: LoginCredentials) => Promise<void>; // Cambiado a Promise<void> para consistencia
  logout: () => void;
  register: (userData: UserCreationData) => Promise<User>; // Cambiado a UserCreationData
  // Función para actualizar el objeto user en el estado del contexto (útil para perfil)
  setUser: (user: User | null) => void; 
  hasPermission: (permissionName: string) => boolean; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Definición de las acciones del reducer
type AuthAction =
    | { type: 'LOGIN_START' }
    | { type: 'LOGIN_SUCCESS'; payload: { user: User; accessToken: string; refreshToken: string } } 
    | { type: 'LOGIN_FAILURE'; payload: string }
    | { type: 'LOGOUT' }
    | { type: 'SET_USER'; payload: User | null } // Para actualizar el objeto user directamente
    | { type: 'RESTORE_SESSION'; payload: { user: User; accessToken: string; refreshToken: string } } 
    | { type: 'REGISTER_START' } 
    | { type: 'REGISTER_SUCCESS' } 
    | { type: 'REGISTER_FAILURE'; payload: string }
    | { type: 'SET_LOADING'; payload: boolean }; // Nueva acción para controlar isLoading

// Estado inicial del reducer
const initialState: AuthState = {
    user: null,
    accessToken: null, 
    refreshToken: null, 
    isAuthenticated: false,
    isLoading: true, // Inicialmente true para indicar que estamos cargando la sesión
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
            // Asegúrate de resetear isLoading a false en logout también.
            return { ...initialState, isLoading: false }; 
        case 'SET_USER': 
            // Cuando actualizamos el usuario directamente (ej. desde el perfil)
            // Asegúrate de que isAuthenticated refleje si user es null o no.
            return { 
                ...state, 
                user: action.payload, 
                isAuthenticated: !!action.payload,
                isLoading: false, // La actualización directa significa que no estamos "cargando" la autenticación
            };
        case 'RESTORE_SESSION':
            return {
                ...state,
                user: action.payload.user,
                accessToken: action.payload.accessToken,
                refreshToken: action.payload.refreshToken,
                isAuthenticated: true,
                isLoading: false, // Sesión restaurada, la carga ha terminado
            };
        case 'REGISTER_SUCCESS': 
            return { ...state, isLoading: false, error: null };
        case 'SET_LOADING': // Maneja el estado de carga
            return { ...state, isLoading: action.payload };
        default:
            return state;
    }
}

// Componente proveedor de autenticación
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    // Función para obtener el perfil del usuario actual desde la API
    const fetchAndSetUser = useCallback(async (token: string) => {
        dispatch({ type: 'SET_LOADING', payload: true }); // Indicar que estamos cargando
        try {
            const userProfile = await api.fetchUserProfile();
            dispatch({ type: 'SET_USER', payload: userProfile });
            // Asegúrate de que el user en localStorage también esté actualizado con los datos del perfil
            localStorage.setItem('user', JSON.stringify(userProfile));
        } catch (error) {
            console.error('Failed to fetch user profile on session restore:', error);
            // Si el token es inválido o el perfil no se carga, forzar logout
            dispatch({ type: 'LOGOUT' }); 
            toast({
                title: 'Sesión Expirada',
                description: 'Tu sesión ha expirado o es inválida. Por favor, inicia sesión de nuevo.',
                variant: 'destructive',
            });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false }); // La carga ha terminado
        }
    }, []);


    // Efecto para restaurar la sesión o cargar el perfil al montar la aplicación
    useEffect(() => {
        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        const storedUserData = localStorage.getItem('user');

        if (accessToken && refreshToken && storedUserData) {
            try {
                const user: User = JSON.parse(storedUserData);
                // Restauramos la sesión inmediatamente con los datos de localStorage
                // Pero luego, intentamos refrescar los datos del usuario desde el API
                dispatch({ type: 'RESTORE_SESSION', payload: { user, accessToken, refreshToken } });
                fetchAndSetUser(accessToken); // Intenta obtener el perfil más reciente
            } catch (error) {
                console.error("Error al parsear datos de usuario de localStorage:", error);
                // Si hay un error al parsear, limpiar y forzar logout
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                dispatch({ type: 'LOGOUT' }); 
            }
        } else {
            // No hay tokens en localStorage, no hay sesión para restaurar.
            dispatch({ type: 'SET_LOADING', payload: false }); // La carga inicial ha terminado
        }
    }, [fetchAndSetUser]); // Dependencia de useCallback


    // Función para iniciar sesión
    const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
        dispatch({ type: 'LOGIN_START' });

        try {
            const response: AuthResponse = await api.login(credentials);

            if (!response.access || !response.refresh || !response.user) {
                throw new Error('La respuesta del servidor no contiene los tokens o la información del usuario.');
            }

            // El backend ya debería enviar el objeto User con el role y permissions anidados
            const user: User = response.user;

            localStorage.setItem('accessToken', response.access);
            localStorage.setItem('refreshToken', response.refresh);
            localStorage.setItem('user', JSON.stringify(user)); // Guardar el objeto user completo

            dispatch({
                type: 'LOGIN_SUCCESS',
                payload: { user, accessToken: response.access, refreshToken: response.refresh },
            });

            toast({
                title: "Inicio de sesión exitoso",
                description: `Bienvenido/a ${user.first_name}`,
            });
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
            throw error; 
        }
    }, []);

    // Función para registrar un nuevo usuario
    const register = useCallback(async (userData: UserCreationData): Promise<User> => {
        dispatch({ type: 'REGISTER_START' });
        try {
            // Asumo que tu API para registrar ahora se llama `register`
            const newUser: User = await api.register(userData); 
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
        localStorage.removeItem('user'); // Asegúrate de limpiar también el user
        dispatch({ type: 'LOGOUT' });
        toast({
            title: "Sesión cerrada",
            description: "Has cerrado sesión correctamente",
        });
        window.location.href = '/login'; // Redirigir siempre después del logout
    }, []);

    // Función para actualizar el objeto user en el estado del contexto (anteriormente 'updateUser')
    const setUser = useCallback((user: User | null) => { 
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
        dispatch({ type: 'SET_USER', payload: user });
    }, []);

   
    const hasPermission = useCallback((permissionName: string): boolean => {
  
      const currentUser = state.user; 

      if (!currentUser || !currentUser.role || !currentUser.role.permissions) {
        return false; 
      }
      
      if (currentUser.is_superuser) {
        return true;
      }
      
      return currentUser.role.permissions.some(
        (p) => p.codename === permissionName || p.name === permissionName
      );
    }, [state.user]); 

    // Provee el estado y las funciones a los componentes hijos
    const authContextValue = {
        ...state,
        login,
        logout,
        register, 
        setUser, 
        hasPermission,
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