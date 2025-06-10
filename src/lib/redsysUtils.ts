
'use client';

import type { ReservationDetailsType, Room } from './types';
import { format } from 'date-fns';

// --- Mock Redsys API Responses ---

interface RedsysInitialTokenizationResponse {
  Ds_Amount: string;
  Ds_Currency: string; // "978" for EUR
  Ds_Order: string;
  Ds_MerchantCode: string;
  Ds_Terminal: string;
  Ds_Response: string; // "0000" for success
  Ds_AuthorisationCode: string;
  Ds_TransactionType: string;
  Ds_SecurePayment: string;
  Ds_Language: string;
  Ds_CardNumber: string; // Masked card number like "454881******0003"
  Ds_ExpiryDate: string; // AAMM format, e.g., "2912"
  Ds_Merchant_Identifier: string; // This is the token/reference
  Ds_Card_Last4: string;
  Ds_MerchantData: string;
  Ds_Card_Country: string; // e.g., "724" for Spain
  Ds_Card_Brand: string; // e.g., "1" for Visa
  Ds_Merchant_Cof_Txnid: string; // Transaction ID for COF operations
}

interface RedsysMITPaymentResponse {
  Ds_Amount: string;
  Ds_Currency: string;
  Ds_Order: string;
  Ds_MerchantCode: string;
  Ds_Terminal: string;
  Ds_Response: string; // "0000" for success
  Ds_AuthorisationCode: string;
  Ds_TransactionType: string;
  Ds_SecurePayment: string;
  Ds_Language: string;
  Ds_CardNumber?: string; // Might not be present or relevant in MIT response
  Ds_ExpiryDate?: string; // Might not be present
  Ds_Merchant_Identifier: string; // The token used
  Ds_Card_Last4?: string;
  Ds_MerchantData?: string;
  Ds_Card_Country?: string;
  Ds_Card_Brand?: string;
  Ds_Merchant_Cof_Txnid: string; // Original COF Txn ID
}

function generateMockOrderId(): string {
  return `mockOrder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function generateMockAuthCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateMockRedsysToken(): string {
  return `mock_token_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}

function generateMockCofTxnId(): string {
  return `cof_txnid_${Date.now()}`;
}

export function simulateRedsysInitialTokenization(
  amountCents: number, // Amount in cents
  currencyCode: string = "978" // EUR
): Promise<RedsysInitialTokenizationResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockCardLast4 = Math.floor(1000 + Math.random() * 9000).toString();
      const currentYear = new Date().getFullYear() % 100; // last two digits of year
      const expiryYear = currentYear + 3 + Math.floor(Math.random() * 3); // Expires in 3-5 years
      const expiryMonth = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0');
      
      const response: RedsysInitialTokenizationResponse = {
        Ds_Amount: amountCents.toString(),
        Ds_Currency: currencyCode,
        Ds_Order: generateMockOrderId(),
        Ds_MerchantCode: "999008881", // Example merchant code
        Ds_Terminal: "1",
        Ds_Response: "0000", // Simulate success
        Ds_AuthorisationCode: generateMockAuthCode(),
        Ds_TransactionType: "0", // Standard payment
        Ds_SecurePayment: "0", // Non-secure for MIT usually
        Ds_Language: "1", // Spanish
        Ds_CardNumber: `454881******${mockCardLast4.slice(-4)}`, // Example VISA prefix
        Ds_ExpiryDate: `${expiryYear.toString().padStart(2,'0')}${expiryMonth}`, // AAMM
        Ds_Merchant_Identifier: generateMockRedsysToken(), // THE TOKEN
        Ds_Card_Last4: mockCardLast4.slice(-4),
        Ds_MerchantData: "",
        Ds_Card_Country: "724", // Spain
        Ds_Card_Brand: "1", // VISA
        Ds_Merchant_Cof_Txnid: generateMockCofTxnId(),
      };
      resolve(response);
    }, 1500); // Simulate network delay
  });
}

export function simulateRedsysMITPayment(
  amountCents: number,
  currencyCode: string = "978", // EUR
  merchantIdentifier: string, // The token
  cofTxnId: string // The original COF transaction ID
): Promise<RedsysMITPaymentResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate a small chance of failure for demonstration
      const isSuccess = Math.random() > 0.1; 
      
      const response: RedsysMITPaymentResponse = {
        Ds_Amount: amountCents.toString(),
        Ds_Currency: currencyCode,
        Ds_Order: generateMockOrderId(), // New order ID for this specific transaction
        Ds_MerchantCode: "999008881",
        Ds_Terminal: "1",
        Ds_Response: isSuccess ? "0000" : "0180", // 0180: Card expired or general error
        Ds_AuthorisationCode: isSuccess ? generateMockAuthCode() : "ERROR",
        Ds_TransactionType: "0", // Or specific MIT type if applicable
        Ds_SecurePayment: "0",
        Ds_Language: "1",
        Ds_Merchant_Identifier: merchantIdentifier,
        Ds_Merchant_Cof_Txnid: cofTxnId,
        // Other fields like CardNumber, ExpiryDate, Card_Last4 might or might not be returned
        // or might be the same as initial if Redsys returns them for reference.
        // For simulation, we can omit them or return the original ones.
      };
      resolve(response);
    }, 1500);
  });
}

export function formatExpiryDateForDisplay(aamm: string | undefined): string {
  if (!aamm || aamm.length !== 4) return "MM/YY";
  const year = aamm.substring(0, 2);
  const month = aamm.substring(2, 4);
  return `${month}/${year}`;
}

// Helper for localStorage keys
export const LOCAL_STORAGE_SAVED_RESERVATIONS_KEY = 'chattyRentalReservations';

// Function to get saved reservations
export function getSavedReservations(): ReservationDetailsType[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(LOCAL_STORAGE_SAVED_RESERVATIONS_KEY);
  return data ? JSON.parse(data) : [];
}

// Function to save/update reservations
export function saveReservations(reservations: ReservationDetailsType[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_SAVED_RESERVATIONS_KEY, JSON.stringify(reservations));
}

// Function to add a new reservation
export function addReservation(newReservation: ReservationDetailsType): void {
  const reservations = getSavedReservations();
  // Ensure reservationId is unique if it's somehow duplicated (though unlikely with UUID/timestamp)
  const existingIndex = reservations.findIndex(r => r.reservationId === newReservation.reservationId);
  if (existingIndex > -1) {
    reservations[existingIndex] = newReservation; // Update if ID exists
  } else {
    reservations.push(newReservation);
  }
  saveReservations(reservations);
}

// Function to update a specific reservation (e.g., after a payment attempt)
export function updateReservationById(reservationId: string, updatedDetails: Partial<ReservationDetailsType>): void {
  let reservations = getSavedReservations();
  const index = reservations.findIndex(r => r.reservationId === reservationId);
  if (index !== -1) {
    reservations[index] = { ...reservations[index], ...updatedDetails };
    saveReservations(reservations);
  }
}
