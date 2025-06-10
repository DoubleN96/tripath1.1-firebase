import { fetchRoomById } from '@/lib/api';
import ReservationForm from '@/components/ReservationForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ReservationPageParams {
  params: {
    roomId: string;
  };
}

export async function generateMetadata({ params }: ReservationPageParams) {
  const room = await fetchRoomById(Number(params.roomId));
  if (!room) {
    return { title: 'Habitación no encontrada para reservar' };
  }
  return {
    title: `Reservar: ${room.title} - ChattyRental`,
  };
}

export default async function ReservationPage({ params }: ReservationPageParams) {
  const roomId = Number(params.roomId);
  const room = await fetchRoomById(roomId);

  if (!room) {
    return (
      <div className="text-center py-10">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-4">Habitación no Encontrada</h1>
        <p className="text-muted-foreground mb-6">No pudimos encontrar los detalles de esta habitación para la reserva.</p>
        <Button asChild variant="outline">
          <Link href="/">Volver al Inicio</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="py-8">
      <ReservationForm room={room} />
    </div>
  );
}
