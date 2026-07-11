
import { Asset, AssetType } from '../types';

/**
 * Calculates the remaining loan balance using an amortization formula.
 * This is the single source of truth for loan calculations across the app.
 * @param asset - The asset object, must be of type DEBT and have necessary properties.
 * @returns The calculated remaining balance as a number.
 */
export const calculateLoanBalance = (asset: Partial<Asset>): number => {
    if (asset.type !== AssetType.DEBT || !asset.startDate || !asset.originalAmount) {
        return asset.amount || 0;
    }

    const principal = asset.originalAmount;
    const annualRate = asset.interestRate || 2; // Default 2%
    const totalYears = asset.termYears || 20;
    const graceYears = asset.interestOnlyPeriod || 0;
    
    const now = new Date();
    const start = new Date(asset.startDate);
    
    // Calculate months passed since the loan started.
    const monthsPassed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

    // If the loan start date is in the future, return the full principal.
    if (monthsPassed < 0) return principal; 

    const graceMonths = graceYears * 12;

    // Phase 1: Grace Period (Interest Only). Principal does not decrease.
    if (monthsPassed <= graceMonths) {
        return principal;
    }

    // Phase 2: Repayment Period (Amortization).
    const monthlyRate = (annualRate / 100) / 12;
    const totalAmortizationMonths = (totalYears * 12) - graceMonths;
    const paymentsMade = monthsPassed - graceMonths;

    // If all payments have been made, the loan is paid off.
    if (paymentsMade >= totalAmortizationMonths) return 0; 

    // Handle 0% interest rate as a special case (linear reduction).
    if (monthlyRate === 0) {
        return principal * (1 - (paymentsMade / totalAmortizationMonths));
    }

    // Standard amortization formula to calculate remaining balance.
    const factorN = Math.pow(1 + monthlyRate, totalAmortizationMonths);
    const factorP = Math.pow(1 + monthlyRate, paymentsMade);

    const remaining = principal * (factorN - factorP) / (factorN - 1);
    
    return Math.round(remaining);
};
