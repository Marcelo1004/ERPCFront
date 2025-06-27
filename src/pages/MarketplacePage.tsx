// src/pages/MarketplacePage.tsx

import React, { useEffect, useState } from 'react';
import apiService from '@/services/api'; // Ajusta esta ruta si es diferente
import { EmpresaMarketplace } from '../types/commercial'; // Asegúrate de que esta ruta sea correcta
import { Link } from 'react-router-dom';


const MarketplacePage: React.FC = () => {
  const [empresas, setEmpresas] = useState<EmpresaMarketplace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        setLoading(true);
        const data = await apiService.getMarketplaceEmpresas();
        setEmpresas(data as EmpresaMarketplace[]); // Aserción de tipo para compatibilidad
      } catch (err) {
        console.error("Error fetching marketplace companies:", err);
        setError("No se pudieron cargar las empresas del marketplace. Intenta de nuevo más tarde.");
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresas();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-blue-100 to-indigo-200">
        <p className="text-2xl font-semibold text-gray-800 animate-pulse">Cargando tiendas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-red-100">
        <p className="text-2xl font-semibold text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen font-sans">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-blue-800 mb-4 drop-shadow-lg">
          Explora Nuestras Tiendas Asociadas
        </h1>
        <p className="text-xl text-gray-700 max-w-3xl mx-auto">
          Descubre las empresas que confían en nuestro sistema ERP para optimizar su gestión y explorar sus productos.
        </p>
      </header>
      
      {empresas.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-lg border border-gray-200">
          <p className="text-2xl text-gray-600">
            Actualmente no hay empresas disponibles en nuestro marketplace. ¡Vuelve pronto!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {empresas.map((empresa) => (
            <div 
              key={empresa.id} 
              className="relative bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center text-center 
                         overflow-hidden transform transition-all duration-500 
                         hover:scale-105 hover:shadow-2xl group border border-blue-100"
            >
              {/* Fondo de gradiente en la tarjeta */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 flex flex-col items-center w-full">
                <h2 className="text-3xl font-extrabold mb-3 text-blue-800 group-hover:text-blue-900 transition-colors duration-300">
                  {empresa.nombre}
                </h2>
                {empresa.descripcion_corta && (
                  <p className="text-gray-700 mb-4 flex-grow text-base leading-relaxed group-hover:text-gray-800 transition-colors duration-300">
                    {empresa.descripcion_corta}
                  </p>
                )}
                {empresa.direccion && (
                  <p className="text-gray-500 text-sm mb-6 group-hover:text-gray-600 transition-colors duration-300">
                    📍 {empresa.direccion}
                  </p>
                )}
                <Link
                  to={`/marketplace/${empresa.id}/productos`}
                  className="mt-auto inline-block bg-blue-700 hover:bg-blue-800 text-white font-semibold 
                           py-3 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 
                           transition-all duration-300 text-lg tracking-wide uppercase"
                >
                  Ver Tienda
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;