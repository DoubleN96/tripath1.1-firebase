
'use client';

import { useState, type ChangeEvent, useEffect, useMemo } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Room, ReservationDetailsType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from "@/hooks/use-toast";
import { format, addMonths, parseISO, startOfDay, isValid, isBefore, getDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  CalendarIcon, User, Mail, Phone, UploadCloud, CreditCard, FileText, ArrowLeft, ArrowRight, 
  Briefcase, GraduationCap, HomeIcon, Landmark, ShieldQuestion, UsersIcon, BookUser, Globe, Building, AlertTriangle, CheckCircle, RefreshCw
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { simulateRedsysInitialTokenization, formatExpiryDateForDisplay, addReservation } from '@/lib/redsysUtils'; // Import Redsys utils
import { calculateDurationInDecimalMonths } from '../ReservationSidebar'; // Import the helper

// Schema for Original Step 1 (Dates and Contact Info)
const originalStep1Schema = z.object({
  startDate: z.date({ required_error: "La fecha de entrada es obligatoria." }),
  duration: z.number({invalid_type_error: "La duración debe ser un número.", required_error: "La duración es obligatoria."}).min(0.5, "La duración mínima es de 0.5 meses (quincena)."),
  firstName: z.string().min(1, "El nombre es obligatorio."),
  lastName: z.string().min(1, "Los apellidos son obligatorios."),
  email: z.string().email("Correo electrónico inválido."),
  phone: z.string().min(9, "El teléfono debe tener al menos 9 caracteres."),
});

// Schema for Original Step 2 (Simulated Payment)
const originalStep2Schema = z.object({
  cardHolderName: z.string().min(3, "El nombre del titular es obligatorio."),
});

// Schema for Original Step 3 (Additional Info)
const originalStep3Schema = z.object({
  birthDate: z.date({ required_error: "La fecha de nacimiento es obligatoria." }),
  gender: z.string().min(1, "El género es obligatorio."),
  studyOrWork: z.string().min(1, "Debes indicar si estudias o trabajas."),
  currentAddress: z.string().min(1, "La dirección actual es obligatoria. Formato: Calle Número, CP Ciudad, País."),
  passportIdNumber: z.string().min(1, "El número de pasaporte/ID es obligatorio."),
  originCountry: z.string().min(1, "El país de origen es obligatorio."),
  iban: z.string().min(1, "El IBAN es obligatorio (para devolución de fianza)."),
  bic: z.string().optional(),
  emergencyContact: z.string().min(1, "El contacto de emergencia es obligatorio. Formato: Nombre, Email, Teléfono."),
  universityWorkCenter: z.string().optional(),
});

// Combined schema for the new Step 1
const combinedStep1Schema = originalStep1Schema.merge(originalStep2Schema);

// Combined type for all form data across steps
type ReservationFormData = z.infer<typeof combinedStep1Schema> & Partial<z.infer<typeof originalStep3Schema>>;

interface ReservationFormProps {
  room: Room;
}

const STEPS = [
  { id: 1, title: 'Fechas, Contacto y Pago Inicial (Simulación)', schema: combinedStep1Schema },
  { id: 2, title: 'Información Adicional del Inquilino', schema: originalStep3Schema },
  { id: 3, title: 'Confirmación y Contrato (Simulación)' }, // No specific schema for the final confirmation display
];

export default function ReservationForm({ room }: ReservationFormProps) {
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const getInitialStartDate = () => {
    const urlCheckIn = searchParams.get('checkIn');
    if (urlCheckIn) {
      const parsedUrlDate = startOfDay(parseISO(urlCheckIn));
      if (isValid(parsedUrlDate)) return parsedUrlDate;
    }
    if (room.availability?.available_now) return startOfDay(new Date());
    return room.availability?.available_from ? startOfDay(parseISO(room.availability.available_from)) : startOfDay(new Date());
  };

  const getInitialDuration = () => {
    const urlCheckIn = searchParams.get('checkIn');
    const urlCheckOut = searchParams.get('checkOut');
    if (urlCheckIn && urlCheckOut) {
        const startDate = startOfDay(parseISO(urlCheckIn));
        const endDate = startOfDay(parseISO(urlCheckOut));
        if (isValid(startDate) && isValid(endDate) && !isBefore(endDate,startDate)) {
            return calculateDurationInDecimalMonths(startDate, endDate, room.availability.minimum_stay_months);
        }
    }
    return room.availability?.minimum_stay_months || 1;
  };

  const [reservationDetails, setReservationDetails] = useState<ReservationDetailsType>({
    reservationId: `res_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    duration: getInitialDuration(),
    startDate: getInitialStartDate(),
    bookedRoom: room.title || room.code,
    bookedRoomId: room.id,
    bookedRoomPrice: room.monthly_price,
    bookedRoomCurrency: room.currency_code,
    initialPaymentStatus: 'pending',
    simulatedPaymentAttempts: [],
  });

  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const { toast } = useToast();

  const currentValidationSchema = STEPS[currentStep - 1]?.schema || z.object({});

  const { control, handleSubmit, trigger, getValues, setValue, watch, formState: { errors } } = useForm<ReservationFormData>({
    resolver: zodResolver(currentValidationSchema),
    defaultValues: {
      startDate: reservationDetails.startDate,
      duration: reservationDetails.duration,
      firstName: '', lastName: '', email: '', phone: '',
      cardHolderName: '', 
      birthDate: undefined, gender: undefined, studyOrWork: undefined, currentAddress: '',
      passportIdNumber: '', originCountry: '', iban: '', bic: '', emergencyContact: '', universityWorkCenter: '',
    },
    shouldFocusError: true,
    mode: "onChange",
  });

  const watchedStartDate = watch("startDate");
  const watchedDuration = watch("duration");

  useEffect(() => {
    let newCheckOutDate: Date | undefined = undefined;
    if (watchedStartDate && typeof watchedDuration === 'number' && !isNaN(watchedDuration) && watchedDuration > 0) {
      // For decimal durations, calculate checkout date based on days
      // E.g., 1.5 months ~ 45 days.
      const totalDays = Math.round(watchedDuration * 30.4375); // Average days in month
      newCheckOutDate = addMonths(watchedStartDate, Math.floor(watchedDuration));
      newCheckOutDate = addMonths(newCheckOutDate, (watchedDuration % 1) * 30.4375 / 30.4375); // this isn't quite right
      // More direct:
      if (watchedDuration % 1 === 0.5) { // X.5 months
          newCheckOutDate = addMonths(watchedStartDate, Math.floor(watchedDuration));
          newCheckOutDate = new Date(newCheckOutDate.setDate(getDate(newCheckOutDate) + 14)); // Add 14 days for a total of 15 for the .5 part
      } else { // Whole months
          newCheckOutDate = addMonths(watchedStartDate, Math.round(watchedDuration));
      }

    }
    setReservationDetails(prev => ({
      ...prev,
      startDate: watchedStartDate,
      duration: typeof watchedDuration === 'number' ? watchedDuration : undefined,
      checkInDate: watchedStartDate,
      checkOutDate: newCheckOutDate,
    }));
  }, [watchedStartDate, watchedDuration]);
  
  useEffect(() => {
    const urlCheckIn = searchParams.get('checkIn');
    const urlCheckOut = searchParams.get('checkOut');
    let initialStartDate = room.availability?.available_now 
        ? startOfDay(new Date()) 
        : (room.availability?.available_from ? startOfDay(parseISO(room.availability.available_from)) : startOfDay(new Date()));
    let initialDuration = room.availability?.minimum_stay_months || 1;

    if (urlCheckIn) {
        const parsedUrlCheckIn = startOfDay(parseISO(urlCheckIn));
        if (isValid(parsedUrlCheckIn)) {
            initialStartDate = parsedUrlCheckIn;
             if (urlCheckOut) {
                const parsedUrlCheckOut = startOfDay(parseISO(urlCheckOut));
                if (isValid(parsedUrlCheckOut) && !isBefore(parsedUrlCheckOut, parsedUrlCheckIn)) {
                     initialDuration = calculateDurationInDecimalMonths(parsedUrlCheckIn, parsedUrlCheckOut, room.availability.minimum_stay_months);
                }
            }
        }
    }
    setValue('startDate', initialStartDate, { shouldValidate: true });
    setValue('duration', initialDuration, { shouldValidate: true });

    // Calculate checkout date based on initialDuration for reservationDetails
    let initialCheckOutDate: Date | undefined;
    if (initialStartDate && initialDuration > 0) {
        if (initialDuration % 1 === 0.5) { // X.5 months
            const fullMonthsPart = Math.floor(initialDuration);
            initialCheckOutDate = addMonths(initialStartDate, fullMonthsPart);
            initialCheckOutDate = new Date(initialCheckOutDate.setDate(getDate(initialCheckOutDate) + 14)); 
        } else { // Whole months
            initialCheckOutDate = addMonths(initialStartDate, Math.round(initialDuration));
        }
    }


    setReservationDetails(prev => ({ 
      ...prev, 
      bookedRoom: room.title || room.code,
      bookedRoomId: room.id,
      bookedRoomPrice: room.monthly_price,
      bookedRoomCurrency: room.currency_code,
      startDate: initialStartDate,
      duration: initialDuration,
      checkInDate: initialStartDate,
      checkOutDate: initialCheckOutDate,
    }));
  }, [searchParams, setValue, room]);


  const proceedToNextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));

  const handlePaymentSimulation: SubmitHandler<ReservationFormData> = async (data) => {
    setIsProcessingPayment(true);
    toast({ title: "Procesando Pago Simulado...", description: "Obteniendo token de Redsys (simulación)." });
    const depositAmount = Math.round(room.monthly_price * 0.25 * 100); 

    try {
      const redsysResponse = await simulateRedsysInitialTokenization(depositAmount);
      if (redsysResponse.Ds_Response === "0000") { 
        setReservationDetails(prev => ({
          ...prev,
          redsysMerchantIdentifier: redsysResponse.Ds_Merchant_Identifier,
          redsysCofTxnid: redsysResponse.Ds_Merchant_Cof_Txnid,
          redsysCardExpiry: redsysResponse.Ds_ExpiryDate,
          redsysCardLast4: redsysResponse.Ds_Card_Last4,
          redsysCardNumberMasked: redsysResponse.Ds_CardNumber,
          redsysCardBrand: redsysResponse.Ds_Card_Brand,
          initialPaymentStatus: 'success',
        }));
        toast({
          title: "Pago Simulado Exitoso y Token Obtenido",
          description: `Tarjeta ${redsysResponse.Ds_CardNumber} guardada (Exp: ${formatExpiryDateForDisplay(redsysResponse.Ds_ExpiryDate)}).`,
          variant: "default",
        });
        proceedToNextStep();
      } else {
        setReservationDetails(prev => ({ ...prev, initialPaymentStatus: 'failed' }));
        toast({ variant: "destructive", title: "Error en Pago Simulado", description: `Redsys respondió con error: ${redsysResponse.Ds_Response}` });
      }
    } catch (error) {
      setReservationDetails(prev => ({ ...prev, initialPaymentStatus: 'failed' }));
      toast({ variant: "destructive", title: "Error de Red", description: "No se pudo completar la simulación de pago." });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const onSubmit: SubmitHandler<ReservationFormData> = async (data) => {
    // Recalculate checkout date here based on final form values for startDate and duration
    let finalCheckOutDate: Date | undefined;
    if (data.startDate && typeof data.duration === 'number' && data.duration > 0) {
        const durationVal = data.duration;
        if (durationVal % 1 === 0.5) {
            finalCheckOutDate = addMonths(data.startDate, Math.floor(durationVal));
            finalCheckOutDate = new Date(finalCheckOutDate.setDate(getDate(finalCheckOutDate) + 14)); 
        } else {
            finalCheckOutDate = addMonths(data.startDate, Math.round(durationVal));
        }
    }

    setReservationDetails(prev => {
      let updatedDetails = {...prev};
      if (currentStep === 1) {
        updatedDetails = {
          ...updatedDetails,
          startDate: data.startDate,
          duration: data.duration,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          checkInDate: data.startDate,
          checkOutDate: finalCheckOutDate,
        };
      } else if (currentStep === 2) { 
        updatedDetails = {
          ...updatedDetails,
          birthDate: data.birthDate,
          gender: data.gender,
          studyOrWork: data.studyOrWork,
          currentAddress: data.currentAddress,
          passportIdNumber: data.passportIdNumber,
          originCountry: data.originCountry,
          iban: data.iban,
          bic: data.bic,
          emergencyContact: data.emergencyContact,
          universityWorkCenter: data.universityWorkCenter,
          passportIdFile: passportFile,
          proofOfStudiesWorkFile: proofFile,
        };
      }
      return updatedDetails;
    });

    if (currentStep === 1) {
      if (reservationDetails.initialPaymentStatus === 'success') {
        proceedToNextStep();
      } else {
        await handlePaymentSimulation(data); 
      }
    } else if (currentStep === 2) { 
      if (!passportFile) {
            toast({ variant: "destructive", title: "Archivo Requerido", description: "Por favor, sube una foto de tu pasaporte/ID." });
            return;
        }
      proceedToNextStep();
    } else if (currentStep === 3) { 
      addReservation(reservationDetails); 
      toast({ title: "Reserva Simulada Guardada Localmente", description: "Puedes verla en el Dashboard." });
    }
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));
  const handlePassportFileChange = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files?.[0]) setPassportFile(event.target.files[0]); };
  const handleProofFileChange = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files?.[0]) setProofFile(event.target.files[0]); };
  const progressPercentage = (currentStep / STEPS.length) * 100;

  const calculatedCheckOutDateDisplay = useMemo(() => {
    if (watchedStartDate && typeof watchedDuration === 'number' && !isNaN(watchedDuration) && watchedDuration > 0) {
        if (watchedDuration % 1 === 0.5) {
            let coDate = addMonths(watchedStartDate, Math.floor(watchedDuration));
            coDate = new Date(coDate.setDate(getDate(coDate) + 14));
            return coDate;
        } else {
            return addMonths(watchedStartDate, Math.round(watchedDuration));
        }
    }
    return undefined;
  }, [watchedStartDate, watchedDuration]);

  const minCalendarDate = room.availability?.available_now
    ? startOfDay(new Date())
    : room.availability?.available_from
    ? startOfDay(parseISO(room.availability.available_from))
    : startOfDay(new Date(new Date().setDate(new Date().getDate() -1))); 

  const minDuration = room.availability?.minimum_stay_months ? Math.max(0.5, room.availability.minimum_stay_months) : 0.5;
  const maxDuration = room.availability?.maximum_stay_months || 120;
  const durationValidationSchema = z.number({invalid_type_error: "La duración debe ser un número.", required_error: "La duración es obligatoria."}).min(minDuration, `La duración mínima es de ${minDuration} meses.`).max(maxDuration, `La duración máxima es de ${maxDuration} meses.`);
  

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-2xl" suppressHydrationWarning={true}>
      <CardHeader>
        <CardTitle className="text-2xl text-center text-primary">Proceso de Reserva</CardTitle>
        <CardDescription className="text-center">
          {STEPS[currentStep - 1].title} (Paso {currentStep} de {STEPS.length})
        </CardDescription>
        <Progress value={progressPercentage} className="mt-2" />
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent>
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="startDate" className="block text-sm font-medium mb-1">Fecha de Entrada</Label>
                <Controller name="startDate" control={control} render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                      </Button></PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date)} initialFocus locale={es} disabled={{ before: minCalendarDate }} /></PopoverContent>
                    </Popover>
                )} />
                {errors.startDate && <p className="text-sm text-destructive mt-1">{errors.startDate.message}</p>}
              </div>
              <div>
                <Label htmlFor="duration" className="block text-sm font-medium mb-1">Duración (meses)</Label>
                <Controller name="duration" control={control}
                  rules={{ validate: value => durationValidationSchema.safeParse(value).success || durationValidationSchema.safeParse(value).error?.errors[0].message }}
                  render={({ field }) => (
                    <Input {...field} id="duration" type="number" placeholder="Ej: 1.5 o 2"
                           step="0.5"
                           value={field.value === undefined || field.value === null || Number.isNaN(Number(field.value)) ? '' : String(field.value)}
                           onChange={(e) => { const val = e.target.value; field.onChange(val === '' ? undefined : parseFloat(val)); }}
                           min={String(minDuration)} 
                           max={String(maxDuration)} />
                )} />
                {errors.duration && <p className="text-sm text-destructive mt-1">{errors.duration.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">Estancia mínima: {minDuration} meses. Puedes usar decimales como .5 para quincenas.</p>
                {calculatedCheckOutDateDisplay && <p className="text-xs text-muted-foreground mt-1">Fecha de salida estimada: {format(calculatedCheckOutDateDisplay, "PPP", { locale: es })}.</p>}
              </div>
              <div>
                <Label htmlFor="firstName" className="flex items-center mb-1"><User className="mr-2 h-4 w-4 text-accent" />Nombre</Label>
                <Controller name="firstName" control={control} render={({ field }) => <Input {...field} placeholder="Tu nombre" />} />
                {errors.firstName && <p className="text-sm text-destructive mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <Label htmlFor="lastName" className="flex items-center mb-1"><User className="mr-2 h-4 w-4 text-accent" />Apellidos</Label>
                <Controller name="lastName" control={control} render={({ field }) => <Input {...field} placeholder="Tus apellidos" />} />
                {errors.lastName && <p className="text-sm text-destructive mt-1">{errors.lastName.message}</p>}
              </div>
              <div>
                <Label htmlFor="email" className="flex items-center mb-1"><Mail className="mr-2 h-4 w-4 text-accent" />Correo Electrónico</Label>
                <Controller name="email" control={control} render={({ field }) => <Input {...field} type="email" placeholder="tu@ejemplo.com" />} />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone" className="flex items-center mb-1"><Phone className="mr-2 h-4 w-4 text-accent" />Teléfono/Whatsapp</Label>
                <Controller name="phone" control={control} render={({ field }) => <Input {...field} type="tel" placeholder="Ej: +34 656 93 33 91" />} />
                {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
              </div>

              <div className="border-t pt-6 mt-6 space-y-6">
                <div className="text-center space-y-2">
                    <CreditCard className="mx-auto h-10 w-10 text-primary" />
                    <h3 className="text-md font-semibold">Pago Inicial (Simulación)</h3>
                    <p className="text-muted-foreground text-xs">
                    Introduce los datos para simular el primer pago y guardar tu método de pago.
                    </p>
                </div>
                <div className="bg-muted/50 p-3 rounded-md text-sm">
                    <p><strong>Habitación:</strong> {room.title}</p>
                    <p><strong>Precio Mensual:</strong> {room.monthly_price.toLocaleString('es-ES', {style:'currency', currency: room.currency_code || 'EUR'})}</p>
                    <p className="font-semibold"><strong>Depósito/Primer Pago (25%):</strong> {(room.monthly_price * 0.25).toLocaleString('es-ES', {style:'currency', currency: room.currency_code || 'EUR'})}</p>
                </div>
                <div>
                    <Label htmlFor="cardHolderName" className="flex items-center mb-1"><User className="mr-2 h-4 w-4 text-accent" />Nombre del Titular</Label>
                    <Controller name="cardHolderName" control={control} render={({ field }) => <Input {...field} id="cardHolderName" placeholder="Nombre completo en la tarjeta" />} />
                    {errors.cardHolderName && <p className="text-sm text-destructive mt-1">{errors.cardHolderName.message}</p>}
                </div>
                <div className="space-y-1">
                    <Label className="text-xs font-medium">Número de Tarjeta (Simulación)</Label>
                    <div className="flex items-center p-2 border rounded-md bg-gray-100 dark:bg-gray-800 text-xs">
                    <Input type="text" readOnly value="**** **** **** **** (Simulado)" className="border-none bg-transparent focus:ring-0 pointer-events-none h-auto py-1"/>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                    <Label className="text-xs font-medium">Expiración (Simulación)</Label>
                    <div className="flex items-center p-2 border rounded-md bg-gray-100 dark:bg-gray-800 text-xs">
                        <Input type="text" readOnly value="MM/YY (Simulado)" className="border-none bg-transparent focus:ring-0 pointer-events-none h-auto py-1"/>
                    </div>
                    </div>
                    <div>
                    <Label className="text-xs font-medium">CVV (Simulación)</Label>
                    <div className="flex items-center p-2 border rounded-md bg-gray-100 dark:bg-gray-800 text-xs">
                        <Input type="text" readOnly value="*** (Simulado)" className="border-none bg-transparent focus:ring-0 pointer-events-none h-auto py-1"/>
                    </div>
                    </div>
                </div>
                {reservationDetails.redsysMerchantIdentifier && reservationDetails.initialPaymentStatus === 'success' && (
                    <div className="mt-3 p-2 bg-green-100 border border-green-300 text-green-700 rounded-md text-xs space-y-0.5">
                    <p className="font-semibold flex items-center"><CheckCircle className="mr-1 h-4 w-4"/> Tokenización Exitosa</p>
                    <p><strong>Token:</strong> {reservationDetails.redsysMerchantIdentifier.substring(0,10)}...</p>
                    <p><strong>Tarjeta:</strong> {reservationDetails.redsysCardNumberMasked} (Exp: {formatExpiryDateForDisplay(reservationDetails.redsysCardExpiry)})</p>
                    </div>
                )}
                {reservationDetails.initialPaymentStatus === 'failed' && (
                    <div className="mt-3 p-2 bg-red-100 border border-red-300 text-red-700 rounded-md text-xs">
                    <p className="font-semibold flex items-center"><AlertTriangle className="mr-1 h-4 w-4"/> Fallo en tokenización.</p>
                    </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && ( 
            <div className="space-y-6">
              <div><Label htmlFor="bookedRoom" className="flex items-center mb-1"><HomeIcon className="mr-2 h-4 w-4 text-accent" />Habitación Seleccionada</Label><Input id="bookedRoom" value={reservationDetails.bookedRoom || room.title} readOnly className="bg-muted"/></div>
              <div>
                <Label htmlFor="birthDate" className="block text-sm font-medium mb-1">Fecha de Nacimiento</Label>
                 <Controller name="birthDate" control={control} render={({ field }) => (
                    <Popover><PopoverTrigger asChild><Button variant={"outline"} className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona tu fecha de nacimiento</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={1950} toYear={getValues("startDate") ? getValues("startDate")!.getFullYear() - 10 : new Date().getFullYear() -10} initialFocus locale={es} /></PopoverContent></Popover>
                )} />{errors.birthDate && <p className="text-sm text-destructive mt-1">{errors.birthDate.message}</p>}
              </div>
              <div>
                 <Label className="flex items-center mb-2"><UsersIcon className="mr-2 h-4 w-4 text-accent" />Género</Label>
                 <Controller name="gender" control={control} render={({ field }) => (<RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4"><div className="flex items-center space-x-2"><RadioGroupItem value="male" id="male" /><Label htmlFor="male">Masculino</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="female" id="female" /><Label htmlFor="female">Femenino</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="other" id="other" /><Label htmlFor="other">Otro</Label></div></RadioGroup>)} />
                 {errors.gender && <p className="text-sm text-destructive mt-1">{errors.gender.message}</p>}
              </div>
               <div>
                <Label className="flex items-center mb-2"><ShieldQuestion className="mr-2 h-4 w-4 text-accent" />¿Estudias o Trabajas?</Label>
                 <Controller name="studyOrWork" control={control} render={({ field }) => (<RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-x-4 gap-y-2"><div className="flex items-center space-x-2"><RadioGroupItem value="study" id="study" /><Label htmlFor="study">Estudio</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="work" id="work" /><Label htmlFor="work">Trabajo</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="both" id="both" /><Label htmlFor="both">Ambos</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="neither" id="neither" /><Label htmlFor="neither">Ninguno</Label></div></RadioGroup>)} />
                {errors.studyOrWork && <p className="text-sm text-destructive mt-1">{errors.studyOrWork.message}</p>}
              </div>
              <div><Label htmlFor="currentAddress" className="flex items-center mb-1"><HomeIcon className="mr-2 h-4 w-4 text-accent" />Dirección Actual</Label><Controller name="currentAddress" control={control} render={({ field }) => <Input {...field} placeholder="Calle Número, CP Ciudad, País" />} />{errors.currentAddress && <p className="text-sm text-destructive mt-1">{errors.currentAddress.message}</p>}</div>
              <div><Label htmlFor="passportIdNumber" className="flex items-center mb-1"><BookUser className="mr-2 h-4 w-4 text-accent" />Número de Pasaporte / ID</Label><Controller name="passportIdNumber" control={control} render={({ field }) => <Input {...field} placeholder="Tu número de identificación" />} />{errors.passportIdNumber && <p className="text-sm text-destructive mt-1">{errors.passportIdNumber.message}</p>}</div>
              <div><Label htmlFor="originCountry" className="flex items-center mb-1"><Globe className="mr-2 h-4 w-4 text-accent" />País de Origen</Label><Controller name="originCountry" control={control} render={({ field }) => <Input {...field} placeholder="Tu país de origen" />} />{errors.originCountry && <p className="text-sm text-destructive mt-1">{errors.originCountry.message}</p>}</div>
              <div><Label htmlFor="checkInDateDisplay" className="flex items-center mb-1"><CalendarIcon className="mr-2 h-4 w-4 text-accent" />Check-IN Confirmado</Label><Input id="checkInDateDisplay" value={reservationDetails.checkInDate ? format(reservationDetails.checkInDate, "PPP", { locale: es }) : 'N/A'} readOnly  className="bg-muted"/></div>
              <div><Label htmlFor="checkOutDateDisplay" className="flex items-center mb-1"><CalendarIcon className="mr-2 h-4 w-4 text-accent" />Check-OUT Confirmado</Label><Input id="checkOutDateDisplay" value={reservationDetails.checkOutDate ? format(reservationDetails.checkOutDate, "PPP", { locale: es }) : 'N/A'} readOnly className="bg-muted"/></div>
              <div><Label htmlFor="iban" className="flex items-center mb-1"><Landmark className="mr-2 h-4 w-4 text-accent" />IBAN (Para devolución de fianza)</Label><Controller name="iban" control={control} render={({ field }) => <Input {...field} placeholder="Tu IBAN" />} />{errors.iban && <p className="text-sm text-destructive mt-1">{errors.iban.message}</p>}</div>
              <div><Label htmlFor="bic" className="flex items-center mb-1"><Landmark className="mr-2 h-4 w-4 text-accent" />BIC (Opcional)</Label><Controller name="bic" control={control} render={({ field }) => <Input {...field} placeholder="El BIC de tu banco" />} />{errors.bic && <p className="text-sm text-destructive mt-1">{errors.bic.message}</p>}</div>
              <div><Label htmlFor="emergencyContact" className="flex items-center mb-1"><UsersIcon className="mr-2 h-4 w-4 text-accent" />Contacto de Emergencia</Label><Controller name="emergencyContact" control={control} render={({ field }) => <Input {...field} placeholder="Nombre, email, teléfono" />} />{errors.emergencyContact && <p className="text-sm text-destructive mt-1">{errors.emergencyContact.message}</p>}</div>
              <div><Label htmlFor="passportFile" className="flex items-center mb-1"><UploadCloud className="mr-2 h-4 w-4 text-accent" />Foto de tu Pasaporte/ID</Label><Input id="passportFile" type="file" onChange={handlePassportFileChange} className="file:text-primary file:font-semibold" accept="image/*,.pdf"/>{passportFile && <p className="text-sm text-muted-foreground mt-1">Archivo: {passportFile.name}</p>}<p className="text-xs text-muted-foreground">Simulación. El archivo no se subirá.</p></div>
              <div><Label htmlFor="proofFile" className="flex items-center mb-1"><UploadCloud className="mr-2 h-4 w-4 text-accent" />Justificante de Estudios o Trabajo (Opcional)</Label><Input id="proofFile" type="file" onChange={handleProofFileChange} className="file:text-primary file:font-semibold" accept="image/*,.pdf"/>{proofFile && <p className="text-sm text-muted-foreground mt-1">Archivo: {proofFile.name}</p>}<p className="text-xs text-muted-foreground">Simulación. El archivo no se subirá.</p></div>
              <div><Label htmlFor="universityWorkCenter" className="flex items-center mb-1"><Building className="mr-2 h-4 w-4 text-accent" />Universidad o Centro de Trabajo (Opcional)</Label><Controller name="universityWorkCenter" control={control} render={({ field }) => <Input {...field} placeholder="Nombre de la institución" />} />{errors.universityWorkCenter && <p className="text-sm text-destructive mt-1">{errors.universityWorkCenter.message}</p>}</div>
            </div>
          )}

          {currentStep === 3 && ( 
            <div className="text-center space-y-4">
              <FileText className="mx-auto h-16 w-16 text-green-600" />
              <h3 className="text-xl font-semibold">¡Reserva Casi Lista!</h3>
              <p className="text-muted-foreground">Tu contrato de alquiler simulado está listo. Revisa tus datos.</p>
              <div className="text-left bg-muted p-4 rounded-md text-sm space-y-1 max-h-72 overflow-y-auto">
                <p><strong>ID Reserva:</strong> {reservationDetails.reservationId}</p>
                <p><strong>Habitación:</strong> {reservationDetails.bookedRoom || 'N/A'}</p>
                <p><strong>Fecha Entrada:</strong> {reservationDetails.checkInDate ? format(reservationDetails.checkInDate, "PPP", { locale: es }) : 'N/A'}</p>
                <p><strong>Duración:</strong> {typeof reservationDetails.duration === 'number' ? `${reservationDetails.duration % 1 === 0 ? reservationDetails.duration.toFixed(0) : reservationDetails.duration.toFixed(1)} mes(es)`: 'N/A'}</p>
                <p><strong>Fecha Salida:</strong> {reservationDetails.checkOutDate ? format(reservationDetails.checkOutDate, "PPP", { locale: es }) : 'N/A'}</p>
                <p><strong>Nombre:</strong> {reservationDetails.firstName} {reservationDetails.lastName}</p>
                <p><strong>Email:</strong> {reservationDetails.email}</p>
                <p><strong>Teléfono:</strong> {reservationDetails.phone}</p>
                <hr className="my-1"/>
                 <p><strong>Pago Inicial:</strong> <span className={reservationDetails.initialPaymentStatus === 'success' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{reservationDetails.initialPaymentStatus === 'success' ? 'Realizado (Token Obtenido)' : 'Pendiente/Fallido'}</span></p>
                {reservationDetails.redsysMerchantIdentifier && <p><strong>Tarjeta (Token):</strong> {reservationDetails.redsysCardNumberMasked} Exp: {formatExpiryDateForDisplay(reservationDetails.redsysCardExpiry)}</p>}
                <hr className="my-1"/>
                <p><strong>Fecha Nacimiento:</strong> {reservationDetails.birthDate ? format(reservationDetails.birthDate, "PPP", { locale: es }) : 'N/A'}</p>
                <p><strong>Género:</strong> {reservationDetails.gender}</p>
                <p><strong>Estudia/Trabaja:</strong> {reservationDetails.studyOrWork}</p>
                <p><strong>Dirección Actual:</strong> {reservationDetails.currentAddress}</p>
                <p><strong>Pasaporte/ID:</strong> {reservationDetails.passportIdNumber}</p>
                <p><strong>País Origen:</strong> {reservationDetails.originCountry}</p>
                <p><strong>IBAN:</strong> {reservationDetails.iban}</p>
                <p><strong>BIC:</strong> {reservationDetails.bic || 'N/A'}</p>
                <p><strong>Contacto Emergencia:</strong> {reservationDetails.emergencyContact}</p>
                <p><strong>Universidad/Trabajo:</strong> {reservationDetails.universityWorkCenter || 'N/A'}</p>
                <p><strong>ID Cargado:</strong> {passportFile?.name || 'No'}</p>
                <p><strong>Justificante Cargado:</strong> {proofFile?.name || 'No'}</p>
              </div>
              <Button size="lg" onClick={() => { toast({ title: "Contrato Descargado (Simulación)", description: "¡Gracias por tu reserva!" }); }} className="w-full" type="button">
                Descargar Contrato Simulado (PDF)
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 1} type="button">
            <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
          </Button>

          {currentStep < STEPS.length && (
            <Button 
              type="submit" 
              disabled={currentStep === 1 && isProcessingPayment}
            >
              {currentStep === 1 && isProcessingPayment && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {currentStep === 1 && !isProcessingPayment && reservationDetails.initialPaymentStatus !== 'success' && <CreditCard className="mr-2 h-4 w-4" />}
              
              {currentStep === 1 
                ? (reservationDetails.initialPaymentStatus === 'success' ? 'Siguiente' : 'Pagar y Continuar (Simulación)')
                : 'Siguiente'}
              
              {(currentStep > 1 || (currentStep === 1 && reservationDetails.initialPaymentStatus === 'success')) && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          )}
          
          {currentStep === STEPS.length && ( 
              <Button type="submit">
                  Finalizar y Guardar Reserva (Simulación) <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

    
