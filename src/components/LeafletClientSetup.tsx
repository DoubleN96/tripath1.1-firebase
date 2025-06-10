
'use client';

import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css'; // CSS de Leaflet
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'; // CSS para los iconos por defecto

export default function LeafletClientSetup() {
  useEffect(() => {
    // Importar dinámicamente el módulo JS para asegurar que solo se ejecute en el cliente
    // y después del montaje inicial.
    import('leaflet-defaulticon-compatibility') // Esto importa la parte JS del parche
      .then(() => {
        // Opcional: console.log('Leaflet Default Icon Compatibility JS loaded client-side.');
      })
      .catch(error => {
        // Opcional: console.error('Error loading Leaflet Default Icon Compatibility JS:', error);
      });
  }, []); // El array de dependencias vacío asegura que esto se ejecute una vez al montar

  return null; // Este componente no renderiza nada visible
}
