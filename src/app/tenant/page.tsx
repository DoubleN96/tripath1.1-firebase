'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Room } from '@/lib/types';
import { fetchRoomsFromSupabase } from '@/lib/supabaseRooms';

export default function TenantPage() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    fetchRoomsFromSupabase().then(setRooms);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Habitaciones Disponibles</h1>
      <ul className="space-y-2">
        {rooms.map(room => (
          <li key={room.id} className="border p-2 rounded">
            <Link href={`/room/${room.id}`}>{room.title ?? `Habitación ${room.id}`}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
