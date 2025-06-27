// src/pages/DemandPredictionPage.tsx

import React, { useEffect, useState } from 'react';
import apiService from '@/services/api'; // Asegúrate de que la ruta sea correcta
import { Producto } from '../types/productos'; // Tu interfaz Producto completa
import { Empresa } from '../types/empresas'; // Interfaz de Empresa para el selector de Super Usuario (asumiendo que existe)
import { DemandaPredictivaResponse } from '../types/commercial'; // Interfaz de DemandaPredictiva
import { useAuth } from '@/contexts/AuthContext'; // Para obtener el usuario y sus permisos
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Shadcn UI Select
import { Input } from "@/components/ui/input"; // Shadcn UI Input para búsqueda
import { Search } from 'lucide-react'; // Icono de búsqueda
import { Navigate } from 'react-router-dom';

const DemandPredictionPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]); // Para Super Usuarios
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(''); // Estado para el término de búsqueda
  const [demandaPredictiva, setDemandaPredictiva] = useState<Record<number, DemandaPredictivaResponse>>({});
  const [fetchingDemanda, setFetchingDemanda] = useState<Record<number, boolean>>({});

  const isSuperUser = user?.role?.name === 'Super Usuario';
  const isAdminOrSuperUser = isSuperUser || user?.role?.name === 'Administrador';

  // --- Efecto para cargar empresas (solo para Super Usuarios) ---
  useEffect(() => {
    if (isSuperUser) {
      const fetchEmpresas = async () => {
        try {
          // Asumiendo que apiService.fetchEmpresas existe y devuelve PaginatedResponse<Empresa>
          // O ajusta para que use un endpoint que liste todas las empresas sin paginación si lo tienes
          const response = await apiService.fetchEmpresas({ page_size: 1000 }); // Ajusta el page_size según necesites
          setEmpresas(response.results);
          // Si el superusuario no tiene una empresa asociada por defecto, selecciona la primera
          if (!user.empresa && response.results.length > 0) {
            setSelectedEmpresaId(response.results[0].id);
          }
        } catch (err) {
          console.error("Error fetching companies for superuser:", err);
          setError("No se pudieron cargar las empresas para el selector.");
        }
      };
      fetchEmpresas();
    }
  }, [isSuperUser, user?.empresa]); // Depende del rol de usuario y si ya tiene empresa

  // --- Efecto para cargar productos ---
  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true);
      setError(null);
      let empresaIdToFetch = user?.empresa || selectedEmpresaId;

      if (!empresaIdToFetch && !isSuperUser) {
        setError("No tienes una empresa asignada o seleccionada para ver productos.");
        setLoading(false);
        return;
      }
      
      // Si es Super Usuario y no ha seleccionado empresa (y hay empresas disponibles), esperamos a la selección
      if (isSuperUser && !empresaIdToFetch && empresas.length > 0) {
        setLoading(false);
        return;
      }

      try {
        // apiService.fetchProductos llama al ProductoViewSet del admin, que filtra por usuario.empresa
        // Si el usuario es superuser y ha seleccionado una empresa, podríamos pasar un filtro,
        // PERO el get_queryset del ProductoViewSet YA MANEJA ESTO de forma inteligente:
        // Superuser ve TODO. Otros roles ven SU empresa.
        // Si necesitamos filtrar por empresa seleccionada para superuser, el ProductoViewSet necesitaría un parámetro GET para `empresa_id`.
        // Por ahora, asumiremos que ProductoViewSet.get_queryset ya gestiona esto.
        // Si el ProductoViewSet no lo hace, y quieres filtrar por `selectedEmpresaId` para superuser:
        // Deberías añadir un filtro en tu ProductoViewSet o crear un endpoint específico.
        // Para esta implementación, asumiremos que el `ProductoViewSet` (llamado por `apiService.fetchProductos`)
        // devolverá los productos correctos según el usuario logueado.

        const params: Record<string, any> = {};
        if (searchTerm) {
          params.search = searchTerm; // Aplicar filtro de búsqueda
        }
        
        // Si el ProductoViewSet tiene un filtro por empresa_id (query param) y eres superuser y has seleccionado:
        // if (isSuperUser && selectedEmpresaId) {
        //   params.empresa_id = selectedEmpresaId;
        // }

        const response = await apiService.fetchProductos(params); // Llama al endpoint /api/productos/
        
        // Si es superuser y se ha seleccionado una empresa, filtrar en frontend si el backend no lo hace por `empresa_id` param
        let filteredProducts = response.results;
        if (isSuperUser && selectedEmpresaId) {
            filteredProducts = response.results.filter(p => p.empresa === selectedEmpresaId);
        } else if (!isSuperUser && user?.empresa) {
            // Asegurarse que solo ve los de su empresa si no es superuser (aunque el backend ya lo debería hacer)
            filteredProducts = response.results.filter(p => p.empresa === user.empresa);
        }

        setProductos(filteredProducts);
      } catch (err) {
        console.error("Error fetching products:", err);
        setError("No se pudieron cargar los productos.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductos();
  }, [user, selectedEmpresaId, searchTerm, empresas]); // Depende del usuario, empresa seleccionada y término de búsqueda

  const handleEmpresaChange = (value: string) => {
    setSelectedEmpresaId(parseInt(value));
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const fetchDemanda = async (productoId: number) => {
    if (fetchingDemanda[productoId] || demandaPredictiva[productoId]) {
      return;
    }

    if (!isAdminOrSuperUser) { // Verificación de permisos más robusta
        alert("No tienes permiso para ver la predicción de demanda.");
        return;
    }

    setFetchingDemanda(prev => ({ ...prev, [productoId]: true }));
    try {
      const data = await apiService.getDemandaPredictiva(productoId);
      setDemandaPredictiva(prev => ({ ...prev, [productoId]: data }));
    } catch (err) {
      console.error(`Error fetching demand for product ${productoId}:`, err);
      alert(`Error al obtener la predicción de demanda para el producto con ID ${productoId}.`);
    } finally {
      setFetchingDemanda(prev => ({ ...prev, [productoId]: false }));
    }
  };

  if (!user) { // Redireccionar si no hay usuario (aunque ya ProtectedRoute debería manejarlo)
    return <Navigate to="/login" />;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700 animate-pulse">Cargando productos para predicción...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <h2 className="text-2xl font-bold mb-4">Error al cargar datos</h2>
        <p>{error}</p>
      </div>
    );
  }

  // Si es Super Usuario y no hay empresa seleccionada, y ya se cargaron las empresas
  if (isSuperUser && !selectedEmpresaId && empresas.length > 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Predicción de Demanda de Productos</h1>
        <div className="flex items-center space-x-4 mb-6 bg-white p-4 rounded-lg shadow-sm">
            <label htmlFor="company-select" className="font-medium text-gray-700">Seleccionar Empresa:</label>
            <Select onValueChange={handleEmpresaChange} defaultValue={empresas.length > 0 ? empresas[0].id.toString() : ""}>
                <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Selecciona una empresa" />
                </SelectTrigger>
                <SelectContent>
                    {empresas.map(emp => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>{emp.nombre}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-red-500">Por favor, selecciona una empresa para ver sus productos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 bg-gray-50 min-h-screen font-sans">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">Predicción de Demanda de Productos</h1>

      {isSuperUser && (
        <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <label htmlFor="company-select" className="font-medium text-gray-700">Ver productos de:</label>
          <Select onValueChange={handleEmpresaChange} value={selectedEmpresaId?.toString() || ""}>
              <SelectTrigger className="w-full md:w-[280px]">
                  <SelectValue placeholder="Selecciona una empresa" />
              </SelectTrigger>
              <SelectContent>
                  {empresas.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.nombre}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="mb-8 flex justify-center">
        <div className="relative w-full max-w-md">
          <Input
            type="text"
            placeholder="Buscar productos por nombre o descripción..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border rounded-full shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
        </div>
      </div>

      {productos.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-lg border border-gray-200">
          <p className="text-2xl text-gray-600">
            No hay productos disponibles para la empresa seleccionada o que coincidan con la búsqueda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"> {/* Ajusta el grid aquí */}
          {productos.map((producto) => (
            <div 
              key={producto.id} 
              className="bg-white rounded-xl shadow-md p-5 flex flex-col border border-gray-200 
                         hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
            >
              {producto.imagen ? (
                <img 
                  src={producto.imagen as string}
                  alt={producto.nombre} 
                  className="w-full h-32 object-contain rounded-md mb-3 border border-gray-100" 
                />
              ) : (
                <div className="w-full h-32 bg-gray-100 rounded-md flex items-center justify-center mb-3 border border-gray-200">
                  <span className="text-gray-400 text-sm">Sin imagen</span>
                </div>
              )}
              
              <h2 className="text-lg font-bold text-gray-800 mb-1 truncate">{producto.nombre}</h2>
              
              {/* Más información del producto para admin */}
              {producto.categoria_detail && (
                  <p className="text-gray-600 text-sm">Categoría: <span className="font-medium">{producto.categoria_detail.nombre}</span></p>
              )}
              {producto.almacen_detail && (
                  <p className="text-gray-600 text-sm">Almacén: <span className="font-medium">{producto.almacen_detail.nombre}</span></p>
              )}
              {producto.descripcion && (
                  <p className="text-gray-700 text-sm mt-2 mb-3 line-clamp-3">{producto.descripcion}</p>
              )}
              
              <p className="text-gray-800 text-xl font-bold mb-2">Precio: ${parseFloat(producto.precio).toFixed(2)}</p>
              <p className="text-gray-600 text-sm mb-3">Stock: <span className="font-medium">{producto.stock} unidades</span></p>
              
              {producto.descuento && parseFloat(producto.descuento) > 0 ? (
                <p className="text-green-600 font-bold text-base mb-4 animate-pulse">
                  ¡{parseFloat(producto.descuento) * 100}% de descuento!
                </p>
              ) : null}

              {/* === BOTÓN PREDECIR DEMANDA === */}
              <button
                onClick={() => fetchDemanda(producto.id)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg 
                           transition-all duration-300 mt-auto w-full text-sm shadow-md hover:shadow-lg"
                disabled={fetchingDemanda[producto.id]}
              >
                {fetchingDemanda[producto.id] ? 'Calculando...' : 'Predecir Demanda'}
              </button>

              {/* Mostrar Demanda Predictiva si está disponible */}
              {demandaPredictiva[producto.id] && (
                <div className="mt-4 bg-purple-50 p-4 rounded-md border border-purple-200 w-full text-left shadow-inner">
                  <h3 className="text-md font-bold text-purple-800 mb-1">Predicción:</h3>
                  <p className="text-purple-700 text-sm">Próximos días: 
                    <span className="font-extrabold ml-1">{demandaPredictiva[producto.id].prediccion_demanda_proximos_dias} unidades</span>
                  </p>
                  <p className="text-purple-700 text-xs mt-0.5">Confianza: 
                    <span className="font-semibold ml-0.5">{demandaPredictiva[producto.id].confianza_prediccion}%</span>
                  </p>
                  <p className="text-purple-600 text-xs italic mt-2">
                    {demandaPredictiva[producto.id].explicacion_simplificada}
                  </p>
                  {/* Se podría ocultar el beneficio_erp si es redundante para esta vista */}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DemandPredictionPage;