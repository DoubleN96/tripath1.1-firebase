
import type { Room, RoomPhoto, Amenity, RoomAvailability } from './types';
import { parseISO } from 'date-fns';


const API_BASE_URL = 'https://tripath.colivingsoft.site/api/version/2.0/default/rooms/feed';

// Helper to get a currency symbol (simplified)
function getCurrencySymbol(currencyCode: string): string {
  switch (currencyCode?.toUpperCase()) {
    case 'EUR':
      return '€';
    case 'USD':
      return '$';
    case 'GBP':
      return '£';
    default:
      return currencyCode || '';
  }
}

export async function fetchRooms(): Promise<Room[]> {
  try {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (textError) {
        // Ignore if can't read body
      }
      console.error(`API request failed to fetch rooms: ${response.status} ${response.statusText}. Response body: ${errorBody}`);
      throw new Error(`Error fetching rooms: ${response.status} ${response.statusText}`);
    }
    const apiResult = await response.json();

    let roomsData: any[] = [];

    // Try to find the rooms array in common locations
    if (Array.isArray(apiResult)) {
      roomsData = apiResult;
    } else if (typeof apiResult === 'object' && apiResult !== null) {
      const commonRootKeys = ['data', 'results', 'items', 'rooms', 'feed', 'response'];
      const commonNestedKeys = ['rooms', 'items', 'results', 'list', 'entities', 'records'];

      for (const key of commonRootKeys) {
        if (Array.isArray(apiResult[key])) {
          roomsData = apiResult[key];
          break;
        } else if (typeof apiResult[key] === 'object' && apiResult[key] !== null) {
           for (const subKey of commonNestedKeys) {
             if (Array.isArray(apiResult[key][subKey])) {
               roomsData = apiResult[key][subKey];
               break;
             }
           }
        }
        if (roomsData.length > 0) break;
      }
    }

    if (roomsData.length === 0 && !Array.isArray(apiResult)) {
       console.warn(
        'Rooms API response is not an array and common nested array keys were not found. '+
        'Assuming the root object is the data or check for other possible structures. Root keys:', 
        Object.keys(apiResult || {}), 
        'Full response snippet:', JSON.stringify(apiResult)?.substring(0, 500)
      );
      return [];
    }
    if (roomsData.length === 0 && Array.isArray(apiResult) && apiResult.length === 0) {
      // It's an empty array, which is valid.
      console.log('Rooms API returned an empty array.');
    }


    return roomsData.map((item: any, index: number): Room => {
      const photos: RoomPhoto[] = Array.isArray(item.photos) && item.photos.length > 0
        ? item.photos.map((url: string, photoIndex: number) => ({
            id: (parseInt(item.id, 10) * 1000) + photoIndex + 1000, // Create a more unique ID for photos
            url_thumbnail: url || "https://placehold.co/300x200.png",
            url_medium: url || "https://placehold.co/600x400.png",
            url_original: url || "https://placehold.co/800x600.png",
            caption: item.room_descriptions?.es_ES?.room_title || `Imagen ${photoIndex + 1}`,
            order: photoIndex,
          }))
        : (item.preview_image ? [{ // Fallback to preview_image if photos array is empty/missing
            id: parseInt(item.id, 10) * 1000,
            url_thumbnail: item.preview_image,
            url_medium: item.preview_image,
            url_original: item.preview_image,
            caption: item.room_descriptions?.es_ES?.room_title || `Imagen principal`,
            order: 0,
        }] : []);

      const amenities: Amenity[] = [];
      if (Array.isArray(item.flat_services)) {
        item.flat_services.forEach((serviceName: string) => {
          amenities.push({
            id: amenities.length + 1 + (parseInt(item.id, 10) * 100), // Ensure unique IDs
            name: serviceName,
            key: serviceName.toLowerCase().replace(/\s+/g, '-'),
            icon_name: serviceName.toLowerCase().includes('wifi') ? 'wifi' : null, // Basic icon mapping
            category_id: 1, 
            category_name: 'Servicios del Piso'
          });
        });
      }
      if (Array.isArray(item.room_services)) {
        item.room_services.forEach((serviceName: string) => {
          amenities.push({
            id: amenities.length + 1 + (parseInt(item.id, 10) * 200), // Ensure unique IDs
            name: serviceName,
            key: serviceName.toLowerCase().replace(/\s+/g, '-'),
            icon_name: null, 
            category_id: 2, 
            category_name: 'Servicios de la Habitación'
          });
        });
      }
      
      const availability: RoomAvailability = {
        available_now: !!item.available_now,
        available_from: item.available_date_for_sys || null, // "YYYY-MM-DD"
        minimum_stay_months: typeof item.minimum_stay_months === 'number' ? item.minimum_stay_months : (item.type === "room" ? 1 : null),
        maximum_stay_months: typeof item.maximum_stay_months === 'number' ? item.maximum_stay_months : null,
        unavailable_dates_range: item.unavailable_dates_range || null,
      };
      
      const roomTitle = item.room_descriptions?.es_ES?.room_title || item.name || item.code || `Habitación ${item.id}`;
      const roomDescription = item.room_descriptions?.es_ES?.room_description || item.flat_descriptions?.es_ES?.flat_description || null;

      return {
        id: parseInt(item.id, 10),
        code: item.code || `ID-${item.id}`,
        title: roomTitle,
        description: roomDescription,
        monthly_price: typeof item.price_rental === 'number' ? item.price_rental : (typeof item.price_rental === 'string' ? parseFloat(item.price_rental) : 0),
        currency_symbol: getCurrencySymbol(item.currency),
        currency_code: item.currency || 'EUR',
        city: item.flat_area || 'Ciudad no especificada',
        address_1: item.flat_address || 'Dirección no disponible',
        address_2: null, 
        postcode: item.flat_postcode || null,
        country: item.flat_country || 'España', 
        lat: item.flat_lat ? parseFloat(item.flat_lat) : null,
        lng: item.flat_lon ? parseFloat(item.flat_lon) : null,
        photos,
        availability,
        property_type_name: item.flat_type_name || (item.type === 'room' ? 'Piso Compartido' : 'Propiedad Completa'),
        room_type_name: item.type === 'room' ? `Habitación en ${item.flat_type_name || 'Piso'}` : (item.room_type_name || 'Estudio/Apartamento'),
        bedrooms: item.rooms_in_flat ? parseInt(item.rooms_in_flat, 10) : null, 
        bathrooms: item.flat_bathrooms ? parseInt(item.flat_bathrooms, 10) : null,
        square_meters: item.square_meters || item.room_area ? parseFloat(item.square_meters || item.room_area) : null,
        amenities,
        is_verified: !!item.is_verified,
        flat_video: item.flat_video || null,
      };
    });

  } catch (error) {
    console.error('Failed to fetch or parse rooms due to an exception:', error);
    if (error instanceof Error && error.message.toLowerCase().includes('failed to fetch')) {
        console.error("This 'Failed to fetch' error (client-side) might be due to CORS policy or network connectivity issues. Please check the browser's developer console (Network and Console tabs) for more specific error messages from the browser, especially regarding CORS.");
    }
    return []; 
  }
}

export async function fetchRoomById(id: number): Promise<Room | undefined> {
  const rooms = await fetchRooms();
  return rooms.find(room => room.id === id);
}
