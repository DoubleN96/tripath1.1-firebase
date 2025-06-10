
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { fetchRoomById, fetchRooms } from '@/lib/api';
import type { Room, RoomAvailability } from '@/lib/types';
import ImageCarousel from '@/components/ImageCarousel';
import ReservationSidebar from '@/components/ReservationSidebar';
import AvailabilityDisplay from '@/components/AvailabilityDisplay';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  MapPin, Home, Maximize, BedDouble, Bath, CheckCircle2, Edit3, Info, AlertCircle, Tag, Youtube, ListCollapse, CalendarDays, UsersRound, Briefcase, GraduationCap, Globe, UserIcon,
  Tv2, Armchair, CookingPot, AppWindow, GalleryVerticalEnd, Users, AirVent, Wind, ThermometerSun, ArrowBigUpDash, ParkingCircle, Refrigerator, LampDesk, Dog, Shirt, Fan as FanIcon
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { parseISO, isBefore, startOfDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

const CardSkeleton = () => (
  <div className="bg-card p-6 rounded-lg shadow-md space-y-4" suppressHydrationWarning={true}>
    <Skeleton className="h-8 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-4 w-1/3" />
    <Separator className="my-6" />
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" suppressHydrationWarning={true}>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
    <Skeleton className="h-20 w-full" />
  </div>
);

// Helper function for sibling room availability text
const getSiblingAvailabilityText = (availability: RoomAvailability): string => {
  if (availability.available_now) {
    return "Disponible Ahora";
  }
  if (availability.available_from) {
    try {
      const parsedDate = parseISO(availability.available_from);
      return `Desde: ${format(parsedDate, 'dd MMM yyyy', { locale: es })}`;
    } catch (e) {
      return "Consultar disponibilidad";
    }
  }
  return "Consultar disponibilidad";
};

interface MockFlatmate {
  id: number;
  name: string; // Only first name
  age: number;
  gender: string;
  nationality: string;
  status: string; // 'Estudiante' o 'Trabajador'
  photoUrl: string;
  photoHint: string;
}

const mockFlatmatesData: MockFlatmate[] = [
  { id: 1, name: "Ana", age: 24, gender: "Femenino", nationality: "Española", status: "Estudiante de Máster", photoUrl: "https://placehold.co/100x100.png", photoHint: "woman portrait" },
  { id: 2, name: "Carlos", age: 27, gender: "Masculino", nationality: "Mexicano", status: "Desarrollador Web", photoUrl: "https://placehold.co/100x100.png", photoHint: "man portrait" },
  { id: 3, name: "Sophie", age: 22, gender: "Femenino", nationality: "Alemana", status: "Erasmus - Marketing", photoUrl: "https://placehold.co/100x100.png", photoHint: "person face" },
];


export default function RoomPage() {
  const routeParams = useParams<{ id: string }>();
  const roomId = Number(routeParams.id);
  const [room, setRoom] = useState<Room | null>(null);
  const [siblingRooms, setSiblingRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCheckInDate, setSelectedCheckInDate] = useState<Date | undefined>(undefined);
  const [selectedCheckOutDate, setSelectedCheckOutDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    async function loadRoomData() {
      if (isNaN(roomId)) {
        setError('ID de habitación inválido.');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const roomData = await fetchRoomById(roomId);
        
        if (roomData) {
          setRoom(roomData);
          if (roomData.availability) {
            const today = startOfDay(new Date());
            let initialDateCandidate = roomData.availability.available_now
              ? today
              : roomData.availability.available_from
              ? startOfDay(parseISO(roomData.availability.available_from))
              : today;

            if (isBefore(initialDateCandidate, today)) {
              initialDateCandidate = today;
            }
            setSelectedCheckInDate(initialDateCandidate);
          }

          const allRoomsData = await fetchRooms();
          if (allRoomsData) {
            const siblings = allRoomsData.filter(
              (r) =>
                r.address_1 && roomData.address_1 && r.address_1.trim().toLowerCase() === roomData.address_1.trim().toLowerCase() &&
                r.city && roomData.city && r.city.trim().toLowerCase() === roomData.city.trim().toLowerCase() &&
                r.id !== roomData.id
            );
            setSiblingRooms(siblings);
          }

        } else {
          setError('Habitación no encontrada.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la habitación.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadRoomData();
  }, [roomId]);

  const handleCheckInDateSelect = (date: Date | undefined) => {
    setSelectedCheckInDate(date);
    if (date && selectedCheckOutDate && isBefore(selectedCheckOutDate, date)) {
      setSelectedCheckOutDate(undefined);
    }
  };

  const handleCheckOutDateSelect = (date: Date | undefined) => {
    setSelectedCheckOutDate(date);
  };
  
  const handleAvailabilityDisplayDateSelect = (date: Date) => {
    const newCheckIn = startOfDay(date);
    const today = startOfDay(new Date());
    let effectiveInitialDate = newCheckIn;

    if (room?.availability) {
        const roomAvailableFrom = room.availability.available_from ? startOfDay(parseISO(room.availability.available_from)) : null;
        
        if (room.availability.available_now) {
            if (isBefore(newCheckIn,today)) effectiveInitialDate = today;

        } else if (roomAvailableFrom) {
            if (isBefore(newCheckIn, roomAvailableFrom)) effectiveInitialDate = roomAvailableFrom;
        } else { 
            if (isBefore(newCheckIn, today)) effectiveInitialDate = today;
        }
    }
    
    setSelectedCheckInDate(effectiveInitialDate);
    if (selectedCheckOutDate && isBefore(selectedCheckOutDate, effectiveInitialDate)) {
      setSelectedCheckOutDate(undefined);
    }
  };


  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto" suppressHydrationWarning={true}>
        <div className="md:flex md:gap-8" suppressHydrationWarning={true}>
          <div className="md:w-2/3 space-y-6" suppressHydrationWarning={true}>
            <Skeleton className="aspect-video w-full rounded-lg" />
            <CardSkeleton />
            <CardSkeleton />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-60 w-full rounded-lg" /> {/* Skeleton for flatmates */}
          </div>
          <div className="md:w-1/3 mt-8 md:mt-0" suppressHydrationWarning={true}>
            <Skeleton className="h-96 w-full rounded-lg sticky top-24" />
          </div>
        </div>
      </div>
    );
  }
  

  if (error) {
    return (
      <div className="text-center py-10 flex flex-col items-center justify-center" suppressHydrationWarning={true}>
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-4">Error</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al Inicio</Link>
        </Button>
      </div>
    );
  }

  if (!room) {
    return (
       <div className="text-center py-10" suppressHydrationWarning={true}>
        <h1 className="text-2xl font-semibold mb-4">Habitación no Encontrada</h1>
        <p className="text-muted-foreground mb-6">Lo sentimos, la habitación que buscas no existe o no está disponible.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al Inicio</Link>
        </Button>
      </div>
    );
  }

  const AmenityItem = ({ amenity }: { amenity: { name: string, icon_name?: string | null } }) => {
    const nameLower = amenity.name.toLowerCase();
    let IconComponent: React.ElementType = CheckCircle2;

    if (nameLower.includes("wifi")) {
      return (
        <li className="flex items-center text-sm bg-muted p-2 rounded-md">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-accent"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
          {amenity.name}
        </li>
      );
    }
    if (nameLower.includes("tv") || nameLower.includes("television")) IconComponent = Tv2;
    else if (nameLower.includes("lavadora") || nameLower.includes("washing machine")) IconComponent = Shirt;
    else if (nameLower.includes("amueblado") || nameLower.includes("furnished")) IconComponent = Armchair;
    else if (nameLower.includes("cocina") || nameLower.includes("kitchen")) IconComponent = CookingPot;
    else if (nameLower.includes("ventana") || nameLower.includes("window")) IconComponent = AppWindow;
    else if (nameLower.includes("balcón") || nameLower.includes("balcony")) IconComponent = GalleryVerticalEnd;
    else if (nameLower.includes("visitas") || nameLower.includes("visits")) IconComponent = Users;
    else if (nameLower.includes("aire acondicionado") || nameLower.includes("air conditioner") || nameLower.includes("a/c")) IconComponent = AirVent;
    else if (nameLower.includes("ventilador") || nameLower.includes("fan")) IconComponent = FanIcon;
    else if (nameLower.includes("armario") || nameLower.includes("wardrobe")) IconComponent = CheckCircle2;
    else if (nameLower.includes("calefacción") || nameLower.includes("heating")) IconComponent = ThermometerSun;
    else if (nameLower.includes("ascensor") || nameLower.includes("elevator") || nameLower.includes("lift")) IconComponent = ArrowBigUpDash;
    else if (nameLower.includes("parking") || nameLower.includes("garage")) IconComponent = ParkingCircle;
    else if (nameLower.includes("secadora") || nameLower.includes("dryer")) IconComponent = Wind;
    else if (nameLower.includes("nevera") || nameLower.includes("frigorífico") || nameLower.includes("refrigerator")) IconComponent = Refrigerator;
    else if (nameLower.includes("escritorio") || nameLower.includes("desk")) IconComponent = LampDesk;
    else if (nameLower.includes("mascotas") || nameLower.includes("pets")) IconComponent = Dog;
    
    return (
      <li className="flex items-center text-sm bg-muted p-2 rounded-md">
        <IconComponent className="mr-2 h-4 w-4 text-accent" />
        {amenity.name}
      </li>
    );
  };

  return (
    <div className="max-w-6xl mx-auto" suppressHydrationWarning={true}>
      <div className="md:flex md:gap-8">
        <div className="md:w-2/3 space-y-6">
          <ImageCarousel photos={room.photos} altText={room.title} />
          
          <div className="bg-card p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-2">{room.title}</h1>
                     <div className="flex items-center text-muted-foreground text-sm mb-1">
                        <MapPin size={16} className="mr-2 text-accent" /> {room.address_1}, {room.city}, {room.country}
                    </div>
                     <div className="flex items-center text-muted-foreground text-sm">
                        <Home size={16} className="mr-2 text-accent" /> {room.room_type_name} en {room.property_type_name}
                    </div>
                </div>
                {room.is_verified && <Badge variant="default" className="bg-green-500 text-white text-sm px-3 py-1"><CheckCircle2 size={14} className="mr-1"/> Verificado</Badge>}
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-6">
              {room.square_meters && (
                <div className="flex items-center bg-secondary/30 p-3 rounded-md">
                  <Maximize size={20} className="mr-2 text-accent" />
                  <div>
                    <p className="font-medium">{room.square_meters} m²</p>
                    <p className="text-xs text-muted-foreground">Tamaño</p>
                  </div>
                </div>
              )}
              {room.bedrooms && (
                <div className="flex items-center bg-secondary/30 p-3 rounded-md">
                  <BedDouble size={20} className="mr-2 text-accent" />
                  <div>
                    <p className="font-medium">{room.bedrooms} Hab.</p>
                    <p className="text-xs text-muted-foreground">Dormitorios (propiedad)</p>
                  </div>
                </div>
              )}
              {room.bathrooms && (
                <div className="flex items-center bg-secondary/30 p-3 rounded-md">
                  <Bath size={20} className="mr-2 text-accent" />
                  <div>
                    <p className="font-medium">{room.bathrooms} Baño(s)</p>
                    <p className="text-xs text-muted-foreground">Baños (propiedad)</p>
                  </div>
                </div>
              )}
            </div>
            
            {room.description && (
              <div>
                <h2 className="text-xl font-semibold mb-2 flex items-center"><Edit3 size={20} className="mr-2 text-accent" /> Descripción</h2>
                <p className="text-foreground/80 whitespace-pre-line leading-relaxed">{room.description}</p>
              </div>
            )}
          </div>

          {room.flat_video && (
            <div className="bg-card p-6 rounded-lg shadow-md mt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Youtube className="mr-2 h-6 w-6 text-accent" />
                Vídeo de la Propiedad
              </h2>
              <div className="aspect-video">
                <iframe
                  className="w-full h-full rounded-lg border border-border"
                  src={room.flat_video}
                  title="Vídeo de la Propiedad"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          )}

          {room.availability && (
            <AvailabilityDisplay 
                availability={room.availability} 
                selectedCheckInDate={selectedCheckInDate}
                onDateSelect={handleAvailabilityDisplayDateSelect} 
            />
          )}


          {room.amenities && room.amenities.length > 0 && (
            <div className="bg-card p-6 rounded-lg shadow-md mt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center"><Tag size={20} className="mr-2 text-accent" /> Comodidades</h2>
              <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {room.amenities.map((amenity) => (
                  <AmenityItem key={amenity.id} amenity={amenity} />
                ))}
              </ul>
            </div>
          )}

          {siblingRooms.length > 0 && (
            <Card className="shadow-lg rounded-lg mt-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary flex items-center">
                  <ListCollapse className="mr-2 h-5 w-5" /> Otras habitaciones en este piso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {siblingRooms.map((sibling) => {
                  const siblingImageUrl = (sibling.photos && sibling.photos.length > 0 && sibling.photos[0].url_thumbnail)
                                       ? sibling.photos[0].url_thumbnail
                                       : "https://placehold.co/80x80.png";
                  const siblingImageHint = (sibling.photos && sibling.photos.length > 0 && sibling.title) ? sibling.title.substring(0,15) : "room thumbnail";
                  return (
                    <Link key={sibling.id} href={`/room/${sibling.id}`} className="block p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors border">
                      <div className="flex items-start gap-3">
                        <div className="relative w-20 h-20 rounded-md overflow-hidden flex-shrink-0">
                           <Image
                            src={siblingImageUrl}
                            alt={`Foto de ${sibling.title}`}
                            layout="fill"
                            objectFit="cover"
                            data-ai-hint={siblingImageHint}
                          />
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-medium text-foreground truncate pr-2">{sibling.title}</h3>
                          <p className="font-semibold text-primary text-sm">
                            {sibling.monthly_price.toLocaleString('es-ES', { style: 'currency', currency: sibling.currency_code || 'EUR' })}
                          </p>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <CalendarDays size={14} className="mr-1.5 text-accent" />
                            <span>{getSiblingAvailabilityText(sibling.availability)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}
          
          <Card className="shadow-lg rounded-lg mt-6">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-primary flex items-center">
                <UsersRound className="mr-2 h-6 w-6" /> Compañeros de Piso Actuales (Ejemplo)
              </CardTitle>
              <CardDescription>
                Esta es una simulación de los perfiles de compañeros. Los datos reales no están disponibles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockFlatmatesData.map((flatmate) => (
                <div key={flatmate.id} className="flex items-start gap-4 p-3 bg-muted/30 rounded-lg border">
                  <Avatar className="h-16 w-16 border-2 border-primary/50">
                    <AvatarImage src={flatmate.photoUrl} alt={flatmate.name} data-ai-hint={flatmate.photoHint}/>
                    <AvatarFallback>{flatmate.name.substring(0,1)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <h4 className="font-semibold text-foreground">{flatmate.name}, {flatmate.age} años</h4>
                    <div className="flex items-center text-muted-foreground mt-0.5">
                       <UserIcon size={14} className="mr-1.5 text-accent" /> {flatmate.gender}
                    </div>
                    <div className="flex items-center text-muted-foreground mt-0.5">
                       <Globe size={14} className="mr-1.5 text-accent" /> {flatmate.nationality}
                    </div>
                    <div className="flex items-center text-muted-foreground mt-0.5">
                      {flatmate.status.toLowerCase().includes('estudiante') || flatmate.status.toLowerCase().includes('erasmus') ? <GraduationCap size={14} className="mr-1.5 text-accent" /> : <Briefcase size={14} className="mr-1.5 text-accent" />}
                       {flatmate.status}
                    </div>
                  </div>
                </div>
              ))}
               <p className="text-xs text-muted-foreground text-center pt-2">
                * La información sobre compañeros de piso es ilustrativa y no representa a inquilinos reales.
              </p>
            </CardContent>
          </Card>

        </div>

        <div className="md:w-1/3 mt-8 md:mt-0">
          <ReservationSidebar 
            room={room} 
            selectedCheckInDate={selectedCheckInDate}
            selectedCheckOutDate={selectedCheckOutDate}
            onCheckInDateSelect={handleCheckInDateSelect}
            onCheckOutDateSelect={handleCheckOutDateSelect}
          />
        </div>
      </div>
    </div>
  );
}
        

    