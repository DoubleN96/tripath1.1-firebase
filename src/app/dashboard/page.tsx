
'use client';

import { useEffect, useState, useMemo } from 'react';
import type { Room, GeneralContractSettings, ReservationDetailsType, SimulatedPaymentAttempt } from '@/lib/types';
import { fetchRooms } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  DollarSign, Home, CheckCircle2, ListTree, MapPin, TrendingUp, ShieldAlert, Settings, Save, Users, CreditCard, CalendarDays, BadgeEuro, Send, Trash2,
  Briefcase, GraduationCap, HelpCircle as HelpCircleIcon // Added Briefcase, GraduationCap, HelpCircleIcon
} from "lucide-react";
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { getFromLocalStorage, setToLocalStorage } from '@/lib/localStorageUtils';
import { 
  LOCAL_STORAGE_SAVED_RESERVATIONS_KEY, getSavedReservations, saveReservations, simulateRedsysMITPayment, formatExpiryDateForDisplay 
} from '@/lib/redsysUtils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


interface CitySummary {
  [city: string]: number;
}

const generalContractSettingsSchema = z.object({
  companyName: z.string().min(1, "El nombre de la empresa es obligatorio."),
  companyCif: z.string().min(1, "El CIF de la empresa es obligatorio."),
  representativeName: z.string().min(1, "El nombre del representante es obligatorio."),
  representativeDni: z.string().min(1, "El DNI del representante es obligatorio."),
  contactEmail: z.string().email("Email de contacto inválido."),
  supplyCostsClause: z.string().min(10, "La cláusula de gastos debe tener al menos 10 caracteres."),
  lateRentPenaltyClause: z.string().min(10, "La cláusula de penalización por retraso de alquiler debe tener al menos 10 caracteres."),
  lateCheckoutPenaltyClause: z.string().min(10, "La cláusula de penalización por desalojo tardío debe tener al menos 10 caracteres."),
  inventoryDamagePolicy: z.string().min(10, "La política de daños de inventario debe tener al menos 10 caracteres."),
  noisePolicyGuestLimit: z.coerce.number().min(0, "El límite de invitados debe ser 0 o más."),
  depositReturnTimeframe: z.string().min(3, "El plazo de devolución de fianza debe tener al menos 3 caracteres."),
  serviceFeePercentage: z.coerce.number().min(0).max(100).optional().default(100), // Default to 100 as in ReservationSidebar
});

const LOCAL_STORAGE_CONTRACT_SETTINGS_KEY = 'chattyRentalContractSettings';

const defaultContractSettings: GeneralContractSettings = {
  companyName: "Tripath Coliving SL",
  companyCif: "B00000000",
  representativeName: "Marcelino Ribón Parada",
  representativeDni: "15417100-Q",
  contactEmail: "no-reply@tripath.site",
  supplyCostsClause: "El ARRENDATARIO/A abonará un importe de CINCUENTA (50) EUROS mensuales derivado de los suministros del Inmueble...",
  lateRentPenaltyClause: "El retraso en el pago de la renta facultará a la parte representante para reclamar... veinte euros (20 €) por cada día de retraso...",
  lateCheckoutPenaltyClause: "En caso contrario, por cada día de retraso, devengará a favor de la parte representante una indemnización por importe de treinta euros (30 €)...",
  inventoryDamagePolicy: "Extraordinariamente, a la finalización del contrato, [NAME_COMPANY] podrá descontar de la garantía del inquilino el importe necesario...",
  noisePolicyGuestLimit: 5,
  depositReturnTimeframe: "dos meses",
  serviceFeePercentage: 100, // Matches ReservationSidebar default for consistency
};

export default function DashboardPage() {
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [savedReservations, setSavedReservations] = useState<ReservationDetailsType[]>([]);
  const [isProcessingMIT, setIsProcessingMIT] = useState<Record<string, boolean>>({});


  const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<GeneralContractSettings>({
    resolver: zodResolver(generalContractSettingsSchema),
    defaultValues: getFromLocalStorage<GeneralContractSettings>(LOCAL_STORAGE_CONTRACT_SETTINGS_KEY, defaultContractSettings),
  });

  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        const roomsData = await fetchRooms();
        setAllRooms(roomsData);
        const currentReservations = getSavedReservations();
        setSavedReservations(currentReservations);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido al cargar los datos del dashboard');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);
  
  useEffect(() => {
    const savedSettings = getFromLocalStorage<GeneralContractSettings>(LOCAL_STORAGE_CONTRACT_SETTINGS_KEY, defaultContractSettings);
    reset(savedSettings);
  }, [reset]);

  const handleSaveContractSettings: SubmitHandler<GeneralContractSettings> = (data) => {
    setToLocalStorage(LOCAL_STORAGE_CONTRACT_SETTINGS_KEY, data);
    toast({ title: "Configuración Guardada", description: "La configuración general del contrato se ha guardado localmente." });
    reset(data); 
  };

  const handleSimulateMonthlyCharge = async (reservation: ReservationDetailsType) => {
    if (!reservation.reservationId || !reservation.redsysMerchantIdentifier || !reservation.redsysCofTxnid || !reservation.bookedRoomPrice) {
      toast({ variant: "destructive", title: "Error", description: "Faltan datos de tokenización para esta reserva." });
      return;
    }
    setIsProcessingMIT(prev => ({ ...prev, [reservation.reservationId!]: true }));
    
    const amountCents = Math.round(reservation.bookedRoomPrice * 100);

    try {
      const response = await simulateRedsysMITPayment(amountCents, "978", reservation.redsysMerchantIdentifier, reservation.redsysCofTxnid);
      const paymentAttempt: SimulatedPaymentAttempt = {
        date: new Date().toISOString(),
        status: response.Ds_Response === "0000" ? 'success' : 'failed',
        message: response.Ds_Response === "0000" ? `Cobro mensual simulado exitoso (Autorización: ${response.Ds_AuthorisationCode})` : `Fallo en cobro simulado (Respuesta Redsys: ${response.Ds_Response})`,
        amount: reservation.bookedRoomPrice,
        currency: reservation.bookedRoomCurrency || "EUR",
      };

      const updatedReservations = savedReservations.map(r => 
        r.reservationId === reservation.reservationId 
          ? { ...r, simulatedPaymentAttempts: [...(r.simulatedPaymentAttempts || []), paymentAttempt] }
          : r
      );
      setSavedReservations(updatedReservations);
      saveReservations(updatedReservations);

      toast({
        title: paymentAttempt.status === 'success' ? "Cobro Mensual Simulado Exitoso" : "Fallo en Cobro Mensual Simulado",
        description: paymentAttempt.message,
        variant: paymentAttempt.status === 'success' ? "default" : "destructive",
      });

    } catch (e) {
      toast({ variant: "destructive", title: "Error de Simulación", description: "No se pudo procesar el cobro simulado." });
    } finally {
      setIsProcessingMIT(prev => ({ ...prev, [reservation.reservationId!]: false }));
    }
  };

  const handleDeleteReservation = (reservationId: string) => {
    const updatedReservations = savedReservations.filter(r => r.reservationId !== reservationId);
    setSavedReservations(updatedReservations);
    saveReservations(updatedReservations);
    toast({title: "Reserva Eliminada", description: "La reserva simulada ha sido eliminada del dashboard."});
  };

  const getStudyWorkStatusInfo = (statusKey?: string): { text: string; icon: JSX.Element | null } => {
    switch (statusKey) {
      case 'study':
        return { text: 'Estudiante', icon: <GraduationCap className="mr-2 h-4 w-4 text-accent" /> };
      case 'work':
        return { text: 'Trabajador', icon: <Briefcase className="mr-2 h-4 w-4 text-accent" /> };
      case 'both':
        return { text: 'Estudia y Trabaja', icon: <><GraduationCap className="mr-1 h-4 w-4 text-accent" /><Briefcase className="ml-1 mr-2 h-4 w-4 text-accent" /></> };
      case 'neither':
        return { text: 'Otro', icon: <HelpCircleIcon className="mr-2 h-4 w-4 text-accent" /> };
      default:
        return { text: 'No especificado', icon: null };
    }
  };


  const totalRooms = useMemo(() => allRooms.length, [allRooms]);
  const verifiedRooms = useMemo(() => allRooms.filter(room => room.is_verified).length, [allRooms]);
  const averagePrice = useMemo(() => {
    if (totalRooms === 0) return 0;
    const validPriceRooms = allRooms.filter(room => typeof room.monthly_price === 'number');
    if (validPriceRooms.length === 0) return 0;
    const sumPrices = validPriceRooms.reduce((acc, room) => acc + (room.monthly_price || 0), 0);
    return sumPrices / validPriceRooms.length;
  }, [allRooms, totalRooms]);
  const roomsAvailableNow = useMemo(() => allRooms.filter(room => room.availability && room.availability.available_now).length, [allRooms]);
  const citiesSummary: CitySummary = useMemo(() => {
    return allRooms.reduce((acc: CitySummary, room) => { if (room.city) { acc[room.city] = (acc[room.city] || 0) + 1; } return acc; }, {});
  }, [allRooms]);
  const sortedCities = useMemo(() => Object.entries(citiesSummary).sort((a, b) => b[1] - a[1]), [citiesSummary]);

  if (isLoading && totalRooms === 0 && savedReservations.length === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-8 text-primary">Dashboard de Habitaciones</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (<Card key={i}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-6 w-6 rounded-full" /></CardHeader><CardContent><Skeleton className="h-10 w-3/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardContent></Card>))}
        </div>
        <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</CardContent></Card>
        <Card><CardHeader><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-3/4 mt-1" /></CardHeader><CardContent className="space-y-4">{[...Array(3)].map((_, i) => (<div key={i} className="space-y-1"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-8 w-full" /></div>))}</CardContent><CardFooter><Skeleton className="h-10 w-24" /></CardFooter></Card>
        <Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent className="space-y-4">{[...Array(2)].map((_, i) => (<div key={i} className="space-y-1"><Skeleton className="h-20 w-full" /></div>))}</CardContent></Card>
      </div>
    );
  }
  if (error) { return (<Alert variant="destructive" className="max-w-2xl mx-auto"><ShieldAlert className="h-4 w-4" /><AlertTitle>Error al Cargar el Dashboard</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>); }
  
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-primary">Dashboard de Habitaciones</h1>
      
      {/* Room Statistics Cards */}
      {(isLoading && totalRooms === 0) ? (
         <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">{[...Array(4)].map((_, i) => (<Card key={i}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-6 w-6 rounded-full" /></CardHeader><CardContent><Skeleton className="h-10 w-3/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardContent></Card>))}</div>
      ) : totalRooms === 0 && !error ? (
         <Alert className="max-w-2xl mx-auto"><MapPin className="h-4 w-4" /><AlertTitle>No hay datos de habitaciones</AlertTitle><AlertDescription>No se encontraron habitaciones en la fuente de datos.</AlertDescription></Alert>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total de Habitaciones</CardTitle><Home className="h-5 w-5 text-accent" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalRooms}</div><p className="text-xs text-muted-foreground">Número total de propiedades</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Habitaciones Verificadas</CardTitle><CheckCircle2 className="h-5 w-5 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{verifiedRooms}</div><p className="text-xs text-muted-foreground">{totalRooms > 0 ? ((verifiedRooms / totalRooms) * 100).toFixed(1) : 0}% del total</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Precio Promedio Mensual</CardTitle><DollarSign className="h-5 w-5 text-accent" /></CardHeader><CardContent><div className="text-2xl font-bold">{averagePrice > 0 ? averagePrice.toFixed(2) : '0.00'} {allRooms.find(room => room.currency_symbol)?.currency_symbol || '€'}</div><p className="text-xs text-muted-foreground">Media de precios</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Disponibles Ahora</CardTitle><TrendingUp className="h-5 w-5 text-accent" /></CardHeader><CardContent><div className="text-2xl font-bold">{roomsAvailableNow}</div><p className="text-xs text-muted-foreground">{totalRooms > 0 ? ((roomsAvailableNow / totalRooms) * 100).toFixed(1) : 0}% listas para ocupar</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="flex items-center"><ListTree className="mr-2 h-5 w-5 text-accent" /> Habitaciones por Ciudad</CardTitle><CardDescription>Distribución de propiedades.</CardDescription></CardHeader>
            <CardContent>{sortedCities.length > 0 ? (<ul className="space-y-2 max-h-96 overflow-y-auto">{sortedCities.map(([city, count]) => (<li key={city} className="flex justify-between items-center p-3 bg-muted/50 rounded-md hover:bg-muted transition-colors"><span className="font-medium text-foreground flex items-center"><MapPin size={16} className="mr-2 text-primary" /> {city}</span><span className="text-sm text-primary font-semibold py-1 px-3 rounded-full bg-primary/10">{count} hab.</span></li>))}</ul>) : (isLoading ? <Skeleton className="h-20 w-full" /> : <p className="text-muted-foreground">No hay datos de ciudades.</p>)}</CardContent>
          </Card>
        </>
      )}

      {/* Saved Reservations and MIT Payments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><Users className="mr-2 h-6 w-6 text-accent" /> Gestión de Reservas y Cobros (Simulación)</CardTitle>
          <CardDescription>Visualiza las reservas simuladas y gestiona los cobros mensuales.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && savedReservations.length === 0 ? (
            <Skeleton className="h-32 w-full" />
          ) : savedReservations.length === 0 ? (
            <Alert>
              <BadgeEuro className="h-4 w-4" />
              <AlertTitle>No hay reservas guardadas</AlertTitle>
              <AlertDescription>Completa el proceso de reserva para que aparezcan aquí las simulaciones.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {savedReservations.map((reservation) => {
                const statusInfo = getStudyWorkStatusInfo(reservation.studyOrWork);
                return (
                <Card key={reservation.reservationId} className="bg-background/50 shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">{reservation.bookedRoom || 'Habitación Desconocida'}</CardTitle>
                            <CardDescription className="text-xs">ID Reserva: {reservation.reservationId}</CardDescription>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar Reserva?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará la reserva simulada ({reservation.reservationId}) de esta lista.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteReservation(reservation.reservationId!)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3 pt-0">
                    <p><strong>Inquilino:</strong> {reservation.firstName} {reservation.lastName} ({reservation.email})</p>
                    <p className="flex items-center">
                       {statusInfo.icon}
                       <strong>Estado:</strong> {statusInfo.text}
                    </p>
                    <p className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-accent" /> 
                      <strong>Entrada:</strong> {reservation.checkInDate ? format(parseISO(reservation.checkInDate as unknown as string), "PPP", {locale: es}) : 'N/A'} - 
                      <strong>Salida:</strong> {reservation.checkOutDate ? format(parseISO(reservation.checkOutDate as unknown as string), "PPP", {locale: es}) : 'N/A'}
                      ({reservation.duration || '?'} meses)
                    </p>
                    {reservation.redsysMerchantIdentifier ? (
                      <div className="bg-muted p-3 rounded-md">
                        <p className="font-medium flex items-center"><CreditCard className="mr-2 h-4 w-4 text-primary"/> Método de Pago Guardado (Simulado)</p>
                        <p><strong>Tarjeta:</strong> {reservation.redsysCardNumberMasked || '**** **** **** ****'} (Exp: {formatExpiryDateForDisplay(reservation.redsysCardExpiry)})</p>
                        <p className="text-xs"><strong>Token Redsys:</strong> {reservation.redsysMerchantIdentifier.substring(0, 20)}...</p>
                        <p className="text-xs"><strong>COF Txn ID:</strong> {reservation.redsysCofTxnid?.substring(0,15)}...</p>
                      </div>
                    ) : (
                      <p className="text-orange-600">Token de pago no obtenido en la reserva inicial.</p>
                    )}

                    <div className="mt-2">
                      <h4 className="font-medium mb-1">Historial de Cobros Simulados:</h4>
                      {reservation.simulatedPaymentAttempts && reservation.simulatedPaymentAttempts.length > 0 ? (
                        <ul className="list-disc list-inside text-xs max-h-24 overflow-y-auto bg-slate-50 p-2 rounded">
                          {reservation.simulatedPaymentAttempts.slice().reverse().map((attempt, idx) => (
                            <li key={idx} className={attempt.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                              {format(parseISO(attempt.date), "dd/MM/yy HH:mm")}: {attempt.message} ({attempt.amount.toLocaleString('es-ES', {style:'currency', currency: attempt.currency})})
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">No se han realizado cobros mensuales simulados.</p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={() => handleSimulateMonthlyCharge(reservation)} 
                      disabled={!reservation.redsysMerchantIdentifier || isProcessingMIT[reservation.reservationId!]}
                      className="w-full"
                    >
                       {isProcessingMIT[reservation.reservationId!] ? <TrendingUp className="mr-2 h-4 w-4 animate-pulse" /> : <Send className="mr-2 h-4 w-4" />}
                       Emitir Cobro Mensual (Simulación {reservation.bookedRoomPrice?.toLocaleString('es-ES', {style:'currency', currency: reservation.bookedRoomCurrency || 'EUR'})})
                    </Button>
                  </CardFooter>
                </Card>
              )})}
            </div>
          )}
        </CardContent>
      </Card>


      {/* General Contract Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><Settings className="mr-2 h-6 w-6 text-accent" /> Configuración General de Contratos</CardTitle>
          <CardDescription>Define los datos y cláusulas generales que se usarán en los contratos. Los cambios se guardan localmente.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(handleSaveContractSettings)}>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div><Label htmlFor="companyName">Nombre de la Empresa Representante</Label><Controller name="companyName" control={control} render={({ field }) => <Input id="companyName" {...field} />} />{errors.companyName && <p className="text-sm text-destructive mt-1">{errors.companyName.message}</p>}</div>
              <div><Label htmlFor="companyCif">CIF de la Empresa</Label><Controller name="companyCif" control={control} render={({ field }) => <Input id="companyCif" {...field} />} />{errors.companyCif && <p className="text-sm text-destructive mt-1">{errors.companyCif.message}</p>}</div>
              <div><Label htmlFor="representativeName">Nombre del Representante Legal</Label><Controller name="representativeName" control={control} render={({ field }) => <Input id="representativeName" {...field} />} />{errors.representativeName && <p className="text-sm text-destructive mt-1">{errors.representativeName.message}</p>}</div>
              <div><Label htmlFor="representativeDni">DNI del Representante Legal</Label><Controller name="representativeDni" control={control} render={({ field }) => <Input id="representativeDni" {...field} />} />{errors.representativeDni && <p className="text-sm text-destructive mt-1">{errors.representativeDni.message}</p>}</div>
            </div>
            <div><Label htmlFor="contactEmail">Email de Contacto General</Label><Controller name="contactEmail" control={control} render={({ field }) => <Input id="contactEmail" type="email" {...field} />} />{errors.contactEmail && <p className="text-sm text-destructive mt-1">{errors.contactEmail.message}</p>}</div>
            <div><Label htmlFor="supplyCostsClause">Cláusula de Gastos de Suministros</Label><Controller name="supplyCostsClause" control={control} render={({ field }) => <Textarea id="supplyCostsClause" {...field} rows={3} />} />{errors.supplyCostsClause && <p className="text-sm text-destructive mt-1">{errors.supplyCostsClause.message}</p>}</div>
            <div><Label htmlFor="lateRentPenaltyClause">Cláusula Penalización por Retraso de Alquiler</Label><Controller name="lateRentPenaltyClause" control={control} render={({ field }) => <Textarea id="lateRentPenaltyClause" {...field} rows={3} />} />{errors.lateRentPenaltyClause && <p className="text-sm text-destructive mt-1">{errors.lateRentPenaltyClause.message}</p>}</div>
            <div><Label htmlFor="lateCheckoutPenaltyClause">Cláusula Penalización por Desalojo Tardío</Label><Controller name="lateCheckoutPenaltyClause" control={control} render={({ field }) => <Textarea id="lateCheckoutPenaltyClause" {...field} rows={3} />} />{errors.lateCheckoutPenaltyClause && <p className="text-sm text-destructive mt-1">{errors.lateCheckoutPenaltyClause.message}</p>}</div>
            <div><Label htmlFor="inventoryDamagePolicy">Política de Daños al Inventario</Label><Controller name="inventoryDamagePolicy" control={control} render={({ field }) => <Textarea id="inventoryDamagePolicy" {...field} rows={3} />} />{errors.inventoryDamagePolicy && <p className="text-sm text-destructive mt-1">{errors.inventoryDamagePolicy.message}</p>}</div>
            <div className="grid md:grid-cols-2 gap-6">
              <div><Label htmlFor="noisePolicyGuestLimit">Límite de Invitados (Política de Ruidos)</Label><Controller name="noisePolicyGuestLimit" control={control} render={({ field }) => <Input id="noisePolicyGuestLimit" type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))}/>} />{errors.noisePolicyGuestLimit && <p className="text-sm text-destructive mt-1">{errors.noisePolicyGuestLimit.message}</p>}</div>
              <div><Label htmlFor="depositReturnTimeframe">Plazo Devolución de Fianza</Label><Controller name="depositReturnTimeframe" control={control} render={({ field }) => <Input id="depositReturnTimeframe" {...field} placeholder="Ej: dos meses"/>} />{errors.depositReturnTimeframe && <p className="text-sm text-destructive mt-1">{errors.depositReturnTimeframe.message}</p>}</div>
              <div><Label htmlFor="serviceFeePercentage">Tarifa de Servicio (valor fijo, ej: 100€)</Label><Controller name="serviceFeePercentage" control={control} render={({ field }) => <Input id="serviceFeePercentage" type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />} />{errors.serviceFeePercentage && <p className="text-sm text-destructive mt-1">{errors.serviceFeePercentage.message}</p>}</div>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-6"><Button type="submit" disabled={!isDirty}><Save className="mr-2 h-4 w-4" /> Guardar Configuración</Button></CardFooter>
        </form>
      </Card>
    </div>
  );
}


    