
'use client';

import { useState, useEffect } from 'react'; // Added useEffect
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, DollarSign, Filter, MapPin as MapPinIcon, ChevronDown } from 'lucide-react'; // Added ChevronDown
import { format, addDays, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils'; // For placeholder styling

export interface Filters {
  city: string;
  checkInDate: Date | undefined;
  checkOutDate: Date | undefined;
  maxPrice: string;
}

interface RoomFiltersProps {
  onFilterChange: (newFilters: Filters) => void;
  initialFilters: Filters;
  availableCities: string[];
}

const ALL_CITIES_SELECT_VALUE = "_ALL_CITIES_"; 

export default function RoomFilters({ onFilterChange, initialFilters, availableCities }: RoomFiltersProps) {
  const [city, setCity] = useState(initialFilters.city);
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(initialFilters.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(initialFilters.checkOutDate);
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setCity(initialFilters.city);
  }, [initialFilters.city]);


  const handleApplyFilters = () => {
    onFilterChange({ city, checkInDate, checkOutDate, maxPrice });
  };

  const handleClearFilters = () => {
    setCity(initialFilters.city); 
    setCheckInDate(undefined);
    setCheckOutDate(undefined);
    setMaxPrice('');
    onFilterChange({ city: initialFilters.city, checkInDate: undefined, checkOutDate: undefined, maxPrice: '' });
  };

  const handleCheckInDateChange = (date: Date | undefined) => {
    setCheckInDate(date);
    if (date && checkOutDate && isBefore(checkOutDate, date)) {
      setCheckOutDate(undefined);
    }
  };
  
  const handleCitySelectChange = (selectedValue: string) => {
    setCity(selectedValue === ALL_CITIES_SELECT_VALUE ? "" : selectedValue);
  };

  const CitySelectPlaceholder = () => (
    <div className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground",
      "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      "cursor-not-allowed opacity-50" 
    )} suppressHydrationWarning={true}>
      <div className="flex items-center" suppressHydrationWarning={true}>
        <MapPinIcon className="h-5 w-5 mr-2 flex-shrink-0" />
        <span>Selecciona ciudad</span>
      </div>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </div>
  );

  return (
    <div className="p-6 mb-8 bg-card rounded-xl shadow-lg space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-5 md:gap-4 md:items-end" suppressHydrationWarning={true}>
      <div className="lg:col-span-1" suppressHydrationWarning={true}>
        <label htmlFor="city-filter" className="block text-sm font-medium text-foreground mb-1">Ciudad</label>
        {isClient ? (
          <Select 
            value={city === "" ? ALL_CITIES_SELECT_VALUE : city} 
            onValueChange={handleCitySelectChange}
          >
            <SelectTrigger className="w-full" id="city-filter">
              <div className="flex items-center">
                <MapPinIcon className="h-5 w-5 text-muted-foreground mr-2 flex-shrink-0" />
                <SelectValue placeholder="Selecciona ciudad" />
              </div>
            </SelectTrigger>
            <SelectContent className="z-[1000]"> {/* Added z-index for city dropdown */}
              <SelectItem value={ALL_CITIES_SELECT_VALUE}>Todas las ciudades</SelectItem>
              {availableCities.map((cityName) => (
                <SelectItem key={cityName} value={cityName}>
                  {cityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <CitySelectPlaceholder />
        )}
      </div>

      <div className="lg:col-span-1" suppressHydrationWarning={true}>
        <label htmlFor="checkInDate" className="block text-sm font-medium text-foreground mb-1">Fecha de Entrada</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className="w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {checkInDate ? format(checkInDate, "PPP", { locale: es }) : <span>Selecciona entrada</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[1000]"> {/* Increased z-index */}
            <Calendar
              mode="single"
              selected={checkInDate}
              onSelect={handleCheckInDateChange}
              initialFocus
              locale={es}
              disabled={{ before: new Date(new Date().setDate(new Date().getDate() -1)) }} 
            />
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="lg:col-span-1" suppressHydrationWarning={true}>
        <label htmlFor="checkOutDate" className="block text-sm font-medium text-foreground mb-1">Fecha de Salida</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className="w-full justify-start text-left font-normal"
              disabled={!checkInDate}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {checkOutDate ? format(checkOutDate, "PPP", { locale: es }) : <span>Selecciona salida</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[1000]"> {/* Increased z-index */}
            <Calendar
              mode="single"
              selected={checkOutDate}
              onSelect={setCheckOutDate}
              initialFocus
              locale={es}
              disabled={ (date) => checkInDate ? isBefore(date, addDays(checkInDate, 0)) : true } 
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="lg:col-span-1" suppressHydrationWarning={true}>
        <label htmlFor="maxPrice" className="block text-sm font-medium text-foreground mb-1">Presupuesto Máx. (€/mes)</label>
        <div className="relative" suppressHydrationWarning={true}>
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="maxPrice"
            type="number"
            placeholder="Ej. 500"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="pl-10"
            suppressHydrationWarning={true}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-5 lg:col-span-1 lg:pt-0 self-end" suppressHydrationWarning={true}>
        <Button onClick={handleApplyFilters} className="w-full md:w-auto">
          <Filter className="mr-2 h-4 w-4" /> Aplicar
        </Button>
        <Button onClick={handleClearFilters} variant="outline" className="w-full md:w-auto">
          Limpiar
        </Button>
      </div>
    </div>
  );
}

