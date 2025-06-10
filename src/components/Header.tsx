
import Link from 'next/link';
import { Home, LayoutDashboard, Map } from 'lucide-react'; // Added Map icon
import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="bg-card shadow-md sticky top-0 z-50" suppressHydrationWarning={true}>
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-primary flex items-center">
          <Home className="mr-2 h-7 w-7 text-accent" />
          Tripath.es
        </Link>
        <nav>
          <ul className="flex items-center space-x-2 md:space-x-4">
            <li>
              <Button variant="ghost" asChild>
                <Link href="/" className="flex items-center text-foreground hover:text-primary">
                  <Home className="mr-1 h-5 w-5" />
                  Inicio
                </Link>
              </Button>
            </li>
            <li>
              <Button variant="ghost" asChild>
                <Link href="/dashboard" className="flex items-center text-foreground hover:text-primary">
                  <LayoutDashboard className="mr-1 h-5 w-5" />
                  Dashboard
                </Link>
              </Button>
            </li>
            <li>
              <Button variant="ghost" asChild>
                <Link href="/map" className="flex items-center text-foreground hover:text-primary">
                  <Map className="mr-1 h-5 w-5" />
                  Mapa
                </Link>
              </Button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
