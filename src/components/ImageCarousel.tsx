'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RoomPhoto } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  photos: RoomPhoto[];
  altText: string;
}

export default function ImageCarousel({ photos, altText }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!photos || photos.length === 0) {
    return (
      <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
        <Image src="https://placehold.co/800x600.png" alt="Sin imagen disponible" width={800} height={600} className="rounded-lg object-cover" data-ai-hint="placeholder interior" />
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? photos.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === photos.length - 1 ? 0 : prevIndex + 1));
  };
  
  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative w-full rounded-lg overflow-hidden shadow-lg">
      <div className="aspect-video relative">
        <Image
          src={photos[currentIndex].url_original || photos[currentIndex].url_medium || "https://placehold.co/800x600.png"}
          alt={`${altText} - Imagen ${currentIndex + 1}`}
          layout="fill"
          objectFit="cover"
          priority={currentIndex === 0}
          className="transition-opacity duration-300 ease-in-out"
          data-ai-hint={altText.substring(0,20)}
        />
      </div>

      {photos.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevious}
            className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"
            aria-label="Imagen anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"
            aria-label="Siguiente imagen"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {photos.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  currentIndex === index ? "bg-primary" : "bg-white/50 hover:bg-white/80"
                )}
                aria-label={`Ir a imagen ${index + 1}`}
              />
            ))}
          </div>
           <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {currentIndex + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
