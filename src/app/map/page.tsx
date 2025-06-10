
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { fetchRooms } from '@/lib/api';
import type { Room } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapPinned } from "lucide-react";

// Dynamically import the map component to ensure it's client-side only
const DynamicMap = dynamic(() => import('@/components/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <Skeleton className="h-12 w-1/3 mb-4" />
      <Skeleton className="h-[calc(100vh-250px)] w-full rounded-lg" />
    </div>
  ),
});

export default function MapPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRoomsData() {
      try {
        setIsLoading(true);
        const roomsData = await fetchRooms();
        setRooms(roomsData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido al cargar las habitaciones');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadRoomsData();
  }, []);

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <MapPinned className="h-4 w-4" />
        <AlertTitle>Error al Cargar el Mapa</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!isLoading && rooms.length === 0 && !error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold mb-6 text-primary">Mapa de Habitaciones</h1>
        <Alert className="max-w-2xl mx-auto">
           <MapPinned className="h-4 w-4" />
           <AlertTitle>No hay habitaciones para mostrar</AlertTitle>
           <AlertDescription>
           No se encontraron habitaciones con datos de ubicación para mostrar en el mapa.
           </AlertDescription>
       </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold mb-6 text-primary flex items-center">
        <MapPinned className="mr-3 h-8 w-8 text-accent" /> Mapa de Habitaciones
      </h1>
      {isLoading && rooms.length === 0 ? ( 
         <div className="space-y-4">
            <Skeleton className="h-[calc(100vh-250px)] w-full rounded-lg" />
         </div>
      ): (
        <div className="h-[calc(100vh-250px)] w-full rounded-lg shadow-lg">
          <DynamicMap rooms={rooms} />
        </div>
      )}
    </div>
  );
}
