import type { Room } from './types';
import { supabase } from './supabaseClient';

export async function fetchRoomsFromSupabase(): Promise<Room[]> {
  const { data, error } = await supabase.from('rooms').select('*');
  if (error) {
    console.error('Error fetching rooms from Supabase', error.message);
    return [];
  }
  return (data as Room[]) || [];
}

export async function fetchRoomByIdFromSupabase(id: number): Promise<Room | null> {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('Error fetching room from Supabase', error.message);
    return null;
  }
  return data as Room | null;
}
