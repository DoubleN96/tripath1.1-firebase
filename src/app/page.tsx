
'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Room } from '@/lib/types';
import { fetchRooms } from '@/lib/api';
import RoomCard from '@/components/RoomCard';
import RoomFilters, { type Filters } from '@/components/RoomFilters';
import PaginationControls from '@/components/PaginationControls';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, MapPin } from "lucide-react";
import { parseISO, isBefore, isAfter, isEqual, startOfDay, endOfDay } from 'date-fns';

const ITEMS_PER_PAGE = 9;

export default function HomePage() {
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const uniqueCities = useMemo(() => {
    if (!allRooms || allRooms.length === 0) return [];
    return [...new Set(allRooms.map(room => room.city).filter(Boolean) as string[])].sort();
  }, [allRooms]);

  const defaultCityValue = useMemo(() => {
    return uniqueCities.includes('Madrid') ? 'Madrid' : '';
  }, [uniqueCities]);

  const [filters, setFilters] = useState<Filters>({
    city: defaultCityValue,
    checkInDate: undefined,
    checkOutDate: undefined,
    maxPrice: '',
  });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (allRooms.length > 0) {
        const newDefaultCity = uniqueCities.includes('Madrid') ? 'Madrid' : (uniqueCities.length > 0 ? "" : "");
        setFilters(prevFilters => ({
            ...prevFilters,
            city: newDefaultCity
        }));
    }
  }, [allRooms, uniqueCities]);


  const DynamicMap = dynamic(() => import('@/components/InteractiveMap'), {
    ssr: false,
    loading: () => <div className="h-full w-full rounded-md bg-muted flex items-center justify-center text-muted-foreground">Cargando Mapa...</div>,
  });

  useEffect(() => {
    async function loadRooms() {
      try {
        setIsLoading(true);
        const roomsData = await fetchRooms();
        setAllRooms(roomsData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadRooms();
  }, []);

  const filteredRooms = useMemo(() => {
    return allRooms.filter(room => {
      const cityMatch = filters.city ? room.city.toLowerCase().includes(filters.city.toLowerCase()) : true;
      const priceMatch = filters.maxPrice ? room.monthly_price <= parseFloat(filters.maxPrice) : true;

      let availabilityMatch = true;

      if (filters.checkInDate) {
        const checkIn = startOfDay(filters.checkInDate);
        
        let roomIsOpenAtCheckIn = false;
        if (room.availability.available_now) {
          roomIsOpenAtCheckIn = true;
        } else if (room.availability.available_from) {
          const availableFrom = startOfDay(parseISO(room.availability.available_from));
          if (!isBefore(checkIn, availableFrom)) { 
            roomIsOpenAtCheckIn = true;
          }
        }

        if (!roomIsOpenAtCheckIn) {
          availabilityMatch = false;
        } else {
          if (filters.checkOutDate) {
            const checkOut = endOfDay(filters.checkOutDate);
            if (isBefore(checkOut, checkIn)) { 
                availabilityMatch = false;
            } else {
                let periodIsBlockedByUnavailableRange = false;
                if (room.availability.unavailable_dates_range) {
                  const unavailableRanges = Object.values(room.availability.unavailable_dates_range)
                    .filter(range => range && range.length === 2 && range[0] && range[1])
                    .map(rangeStr => [startOfDay(parseISO(rangeStr[0])), endOfDay(parseISO(rangeStr[1]))] as [Date, Date]);

                  for (const [unavailableStart, unavailableEnd] of unavailableRanges) {
                    if (isBefore(checkIn, unavailableEnd) && isAfter(checkOut, unavailableStart)) {
                      periodIsBlockedByUnavailableRange = true;
                      break;
                    }
                  }
                }
                if (periodIsBlockedByUnavailableRange) {
                  availabilityMatch = false;
                }
            }
          } else { 
              let checkInIsBlockedByUnavailableRange = false;
              if (room.availability.unavailable_dates_range) {
                  const unavailableRanges = Object.values(room.availability.unavailable_dates_range)
                    .filter(range => range && range.length === 2 && range[0] && range[1])
                    .map(rangeStr => [startOfDay(parseISO(rangeStr[0])), endOfDay(parseISO(rangeStr[1]))] as [Date, Date]);
                  
                  for (const [unavailableStart, unavailableEnd] of unavailableRanges) {
                      if (!isBefore(checkIn, unavailableStart) && !isAfter(checkIn, unavailableEnd)) { 
                          checkInIsBlockedByUnavailableRange = true;
                          break;
                      }
                  }
              }
              if (checkInIsBlockedByUnavailableRange) {
                  availabilityMatch = false;
              }
          }
        }
      }
      return cityMatch && priceMatch && availabilityMatch;
    });
  }, [allRooms, filters]);

  // Logic for roomsByFlat removed as it's no longer passed to RoomCard

  const paginatedRooms = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredRooms.slice(startIndex, endIndex);
  }, [filteredRooms, currentPage]);

  const totalPages = Math.ceil(filteredRooms.length / ITEMS_PER_PAGE);

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    setCurrentPage(1); 
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Info className="h-4 w-4" />
        <AlertTitle>Error al cargar habitaciones</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8" suppressHydrationWarning={true}> 
      <h1 className="text-3xl font-bold text-center text-primary">Encuentra tu Espacio Ideal</h1>
      
      <RoomFilters
        onFilterChange={handleFilterChange}
        initialFilters={filters}
        availableCities={uniqueCities}
      />

      <div className="h-[400px] w-full bg-card border border-border rounded-lg shadow-md p-1" suppressHydrationWarning={true}>
        {(isLoading && allRooms.length === 0) ? (
           <div key="map-loading-state" className="h-full w-full rounded-md bg-muted flex items-center justify-center text-muted-foreground" suppressHydrationWarning={true}>Cargando datos para el mapa...</div>
        ) : (!isLoading && allRooms.length === 0 && !error) ? (
          <Alert key="map-no-rooms-state" className="h-full flex flex-col items-center justify-center text-center">
            <MapPin className="h-8 w-8 mb-2 text-muted-foreground" />
            <AlertTitle>Mapa no disponible</AlertTitle>
            <AlertDescription>No hay propiedades para mostrar en el mapa en este momento.</AlertDescription>
          </Alert>
        ) : (
          <DynamicMap key="map-active-state" rooms={filteredRooms.length > 0 ? filteredRooms : allRooms} />
        )}
      </div>
      
      {isLoading && allRooms.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <div key={index} className="space-y-3" suppressHydrationWarning={true}>
              <Skeleton className="h-[200px] w-full rounded-xl" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : paginatedRooms.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedRooms.map((room) => (
              // siblingRooms prop removed from RoomCard
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
          {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />
            )}
        </>
      ) : !error ? ( 
        <Alert className="max-w-md mx-auto">
            <Info className="h-4 w-4" />
            <AlertTitle>No se encontraron resultados</AlertTitle>
            <AlertDescription>
            Intenta ajustar tus filtros o revisa más tarde. Continuamente añadimos nuevas propiedades.
            </AlertDescription>
        </Alert>
      ) : null }
    </div>
  );
}
