'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function PaginationControls({ currentPage, totalPages, onPageChange }: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center items-center space-x-4 mt-8">
      <Button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        variant="outline"
        size="icon"
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="text-sm text-foreground">
        Página {currentPage} de {totalPages}
      </span>
      <Button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        variant="outline"
        size="icon"
        aria-label="Siguiente página"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
