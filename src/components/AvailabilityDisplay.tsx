
'use client';

import type { RoomAvailability } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format, getMonth, getYear, isWithinInterval, parseISO, startOfMonth, endOfMonth, addMonths, isBefore, isEqual, startOfDay, isSameMonth, isSameYear, max, min, isAfter, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Info, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvailabilityDisplayProps {
  availability: RoomAvailability;
  selectedCheckInDate: Date | undefined;
  onDateSelect: (date: Date) => void;
}

const MONTH_NAMES_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const isMonthGenerallyAvailable = (year: number, monthIndex: number, unavailableRanges: Array<[Date, Date]>, firstOverallAvailableDate: Date | null): boolean => {
  const monthStart = startOfMonth(new Date(year, monthIndex, 1));
  const monthEnd = endOfMonth(monthStart);

  if (firstOverallAvailableDate && isBefore(monthEnd, startOfDay(firstOverallAvailableDate))) {
    return false; // Month is entirely before the room is ever available
  }

  for (const [unavailableStart, unavailableEnd] of unavailableRanges) {
    // Check if the month significantly overlaps with an unavailable range
    // Overlap condition: (StartA < EndB) and (EndA > StartB)
    if (isBefore(monthStart, unavailableEnd) && isAfter(monthEnd, unavailableStart)) {
      // More precise: if the unavailable range covers the entire month
      if (!isAfter(monthStart, unavailableEnd) && !isBefore(monthEnd, unavailableStart)) return false;
      // Or if unavailable starts before/at month start AND ends after/at month end
      if (isBefore(unavailableStart, monthStart) && isAfter(unavailableEnd, monthEnd)) return false;
      if (isEqual(unavailableStart, monthStart) && isEqual(unavailableEnd, monthEnd)) return false;
      // If it's a partial overlap, we might still mark it as "partially available" or handle day-level,
      // but for a simple month status, any conflict marks it unavailable here.
      // For this UI, we want to show it as "available" if any part of it is available.
      // So, we return true if it's NOT fully covered by an unavailable block.
      // Let's refine: a month is unavailable if *no part of it* is available.

      // If the unavailable range *starts* within this month OR *ends* within this month
      // OR *spans across* this month, then it's affected.
      // A month is occupied if unavailableStart <= monthEnd and unavailableEnd >= monthStart.
       if (!isAfter(unavailableStart, monthEnd) && !isBefore(unavailableEnd, monthStart)) {
         // Check if the entire month is within an unavailable range
         if ((isBefore(unavailableStart, monthStart) || isEqual(unavailableStart, monthStart)) && 
             (isAfter(unavailableEnd, monthEnd) || isEqual(unavailableEnd, monthEnd))) {
           return false; 
         }
       }
    }
  }
  return true; // No full blockage found or only partial blockage
};


export default function AvailabilityDisplay({ availability, selectedCheckInDate, onDateSelect }: AvailabilityDisplayProps) {
  const {
    available_now,
    available_from,
    minimum_stay_months,
    maximum_stay_months,
    unavailable_dates_range,
  } = availability;

  const today = startOfDay(new Date());
  
  let effectiveAvailableFrom = available_now ? today : (available_from ? startOfDay(parseISO(available_from)) : today);
  if (!available_now && available_from && isBefore(effectiveAvailableFrom, today)) {
    effectiveAvailableFrom = today;
  }


  const firstOverallAvailableDate = available_now
    ? today
    : available_from
    ? max([today, startOfDay(parseISO(available_from))]) // Must be at least today or future available_from
    : today; // Fallback to today if no info

  let startYear = getYear(firstOverallAvailableDate);

  const yearsToDisplay = [startYear, startYear + 1];

  const parsedUnavailableRanges: Array<[Date, Date]> = [];
  if (unavailable_dates_range) {
    Object.values(unavailable_dates_range).forEach(range => {
      if (range && range.length === 2 && range[0] && range[1]) {
        parsedUnavailableRanges.push([startOfDay(parseISO(range[0])), endOfDay(parseISO(range[1]))]);
      }
    });
  }
  
  const handleMonthClick = (year: number, monthIndex: number) => {
    const clickedMonthStart = startOfDay(new Date(year, monthIndex, 1));
    let potentialCheckInDate = clickedMonthStart;

    if (isBefore(potentialCheckInDate, firstOverallAvailableDate)) {
        potentialCheckInDate = firstOverallAvailableDate;
    }
    
    // Check if the *specific potentialCheckInDate* is within any unavailable range.
    // This is more precise than only relying on isMonthGenerallyAvailable for the click action.
    let dateIsActuallyAvailable = true;
    for (const [unavailableStart, unavailableEnd] of parsedUnavailableRanges) {
        if (isWithinInterval(potentialCheckInDate, { start: unavailableStart, end: unavailableEnd })) {
            dateIsActuallyAvailable = false;
            break;
        }
    }

    if (isMonthGenerallyAvailable(year, monthIndex, parsedUnavailableRanges, firstOverallAvailableDate) && dateIsActuallyAvailable) {
      onDateSelect(potentialCheckInDate);
    }
  };

  return (
    <Card className="shadow-lg rounded-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-primary flex items-center">
          <CalendarDays className="mr-2 h-6 w-6" /> Disponibilidad
        </CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4 text-sm">
          <div>
            <p className="font-medium text-muted-foreground">Disponible desde</p>
            <p className="text-foreground font-medium">
              {available_now
                ? <span className="text-green-600">¡Disponible Ahora!</span>
                : available_from
                ? format(startOfDay(parseISO(available_from)), 'dd LLLL yyyy', { locale: es })
                : 'Consultar'}
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-muted-foreground">Estancia Mínima</p>
            <p className="text-foreground">
              {minimum_stay_months ? `${minimum_stay_months} mes(es)` : 'No especificada'}
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-muted-foreground">Estancia Máxima</p>
            <p className="text-foreground">
              {maximum_stay_months ? `${maximum_stay_months} mes(es)` : 'Sin estancia máxima'}
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-muted-foreground">Calendario Actualizado</p>
            <p className="text-foreground italic">(Calendario actualizado hace aprox. 8 horas)</p>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          {yearsToDisplay.map(year => (
            <div key={year}>
              <h4 className="text-lg font-semibold mb-2 text-center text-muted-foreground">{year}</h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                {MONTH_NAMES_SHORT.map((monthName, monthIndex) => {
                  const monthDate = startOfDay(new Date(year, monthIndex, 1));
                  const isGenerallyAvailable = isMonthGenerallyAvailable(year, monthIndex, parsedUnavailableRanges, firstOverallAvailableDate);
                  
                  const isSelectedMonth = selectedCheckInDate && 
                                          isSameMonth(monthDate, selectedCheckInDate) && 
                                          isSameYear(monthDate, selectedCheckInDate);

                  return (
                    <button
                      key={`${year}-${monthIndex}`}
                      onClick={() => handleMonthClick(year, monthIndex)}
                      disabled={!isGenerallyAvailable}
                      className={cn(`p-2 text-xs font-medium rounded text-center border transition-all
                        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1`,
                        isGenerallyAvailable 
                          ? 'cursor-pointer hover:bg-primary/20' 
                          : 'bg-muted text-muted-foreground cursor-not-allowed opacity-70 border-border',
                        isGenerallyAvailable && !isSelectedMonth && 'bg-green-100 text-green-700 border-green-200 hover:border-green-400',
                        isGenerallyAvailable && isSelectedMonth && 'bg-primary text-primary-foreground border-primary ring-2 ring-primary ring-offset-2',
                        !isGenerallyAvailable && 'bg-red-100 text-red-700 border-red-200'
                      )}
                    >
                      {monthName}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-4 flex items-center space-x-4 text-xs">
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-200 mr-1.5"></span> Disponible
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-200 mr-1.5"></span> Ocupado
            </div>
             <div className="flex items-center">
              <span className="w-3 h-3 rounded-sm bg-primary border border-primary-foreground mr-1.5"></span> Seleccionado
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
