// paymentService.ts
// Barcha to'lovlar Click orqali (Ilmiyfaoliyat.uz — bir xil payment sahifa va callback).
// createTransactionAndPay + redirectToPaymentPage → #/payment/click (QR + tugma).

import { apiService } from './apiService';

interface ProcessPaymentResponse {
  success: boolean;
  transaction_id?: string;
  payment_url?: string;
  invoice_id?: number;
  merchant_trans_id?: string;
  amount?: number;
  currency?: string;
  error_code?: number;
  error?: string;
  error_note?: string;
  user_message?: string;
  details?: {
    user_message?: string;
    error_note?: string;
    error?: string;
    error_code?: number;
  };
}

interface PaymentStatusResponse {
  error_code: number;
  error_note: string;
  payment_status?: number;
}

class PaymentService {
  /**
   * Process payment for a transaction
   * Creates invoice via Click or Payme API and returns payment URL
   * 
   * @param transactionId - Transaction ID
   * @param provider - Payment provider ('click' or 'payme'), default 'click'
   */
  async processPayment(
    transactionId: string, 
    provider: 'click' | 'payme' = 'click'
  ): Promise<ProcessPaymentResponse> {
    try {
      console.log('Processing payment for transaction ID:', transactionId, 'Provider:', provider);
      const response = await apiService.payments.processPayment(transactionId, provider);
      console.log('Process payment response:', response);
      
      // Ensure response has success field
      // Check if payment_url exists (even if invoice creation failed, we may have fallback URL)
      if (response && typeof response.success === 'undefined') {
        // If response has payment_url, consider it success (even if invoice failed)
        if (response.payment_url) {
          response.success = true;
        } else if (response.error_code === 0 || (!response.error_code && !response.error)) {
          response.success = true;
        } else {
          response.success = false;
        }
      }
      
      // If payment_url exists but success is false, override it to true
      if (response && response.payment_url && response.success === false) {
        console.warn('Payment URL exists but success is false, overriding to true:', response);
        response.success = true;
      }
      
      return response;
    } catch (error: any) {
      console.error('Error processing payment:', error);
      
      // Extract error message from different error formats
      let errorMessage = 'To\'lovni amalga oshirishda xatolik yuz berdi';
      let errorCode = -1;
      
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.error) {
        errorMessage = error.error;
      } else if (error.error_note) {
        errorMessage = error.error_note;
      }
      
      if (error.error_code) {
        errorCode = error.error_code;
      }
      
      return {
        success: false,
        error_code: errorCode,
        error: errorMessage,
        error_note: errorMessage
      };
    }
  }

  /**
   * Check payment status for a transaction.
   * Aniq ID bo'yicha GET — ro'yxat paginatsiyasi (masalan 20 ta) tufayli yangi tranzaksiya topilmasligi xatosini oldini oladi.
   */
  async checkPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const syncResult = await apiService.payments.checkStatus(transactionId);
      const transaction = syncResult?.transaction;

      if (!transaction?.id) {
        return {
          error_code: syncResult?.error_code ?? -5,
          error_note: syncResult?.error_note || 'Transaction not found',
          payment_status: syncResult?.payment_status ?? 0,
        };
      }

      const st = transaction.status as string;
      return {
        error_code: syncResult?.error_code ?? 0,
        error_note: syncResult?.error_note || 'Success',
        payment_status:
          st === 'completed'
            ? 2
            : st === 'failed' || st === 'cancelled'
              ? -1
              : syncResult?.payment_status ?? 0,
      };
    } catch (error: any) {
      console.error('Error checking payment status:', error);
      if (error?.status === 404) {
        return {
          error_code: -5,
          error_note: 'Transaction not found',
        };
      }
      return {
        error_code: -9,
        error_note: error.message || 'Failed to check payment status',
      };
    }
  }

  /**
   * Redirect user to our payment page (with QR code + button).
   * Use this so user can scan QR with phone or click to open Click in browser.
   */
  redirectToPaymentPage(transactionId: string): void {
    if (!transactionId) {
      console.error('Transaction ID is not available');
      throw new Error('To\'lov ID topilmadi');
    }
    const hash = `#/payment/click?transaction_id=${encodeURIComponent(transactionId)}`;
    window.location.hash = hash;
  }

  /**
   * Redirect user to Click payment page (direct external link).
   * Uses window.location.replace() to avoid CSP issues and prevent back navigation.
   * Prefer redirectToPaymentPage(transactionId) so user sees QR code.
   */
  redirectToPayment(paymentUrl: string): void {
    if (!paymentUrl) {
      console.error('Payment URL is not available');
      throw new Error('To\'lov URL topilmadi');
    }
    
    // Validate URL format
    try {
      const url = new URL(paymentUrl);
      if (!url.protocol.startsWith('http')) {
        console.error('Invalid payment URL protocol:', paymentUrl);
        throw new Error('Noto\'g\'ri to\'lov URL formati');
      }
    } catch (urlError) {
      console.error('Invalid payment URL format:', paymentUrl, urlError);
      throw new Error('Noto\'g\'ri to\'lov URL formati');
    }
    
    // Redirect to payment page
    // Using window.location.replace() instead of href to:
    // 1. Avoid CSP issues with history manipulation
    // 2. Prevent users from going back to payment page after redirect
    // 3. Better handling of external redirects
    try {
      console.log('Redirecting to payment URL:', paymentUrl);
      
      // Use replace instead of href to avoid history issues
      // This also helps with CSP compliance
      window.location.replace(paymentUrl);
      
      // Fallback if replace doesn't work
      setTimeout(() => {
        if (window.location.href !== paymentUrl) {
          console.warn('Replace failed, using href as fallback');
          window.location.href = paymentUrl;
        }
      }, 100);
    } catch (redirectError) {
      console.error('Failed to redirect to payment URL:', redirectError);
      
      // Last resort: try opening in new window
      try {
        const newWindow = window.open(paymentUrl, '_blank');
        if (!newWindow) {
          throw new Error('Popup blocked');
        }
      } catch (popupError) {
        throw new Error('To\'lov sahifasiga yo\'naltirishda xatolik yuz berdi. Iltimos, quyidagi linkni oching: ' + paymentUrl);
      }
    }
  }

  /**
   * Create transaction and process payment
   * Helper method that creates transaction first, then processes payment
   *
   * @param extraData - Optional payload (e.g. book_publication: bosma nashr + yetkazib berish manzili)
   * @param provider - Payment provider ('click' or 'payme'), default 'click'
   */
  async createTransactionAndPay(
    amount: number,
    currency: string,
    serviceType: string,
    articleId?: string,
    translationRequestId?: string,
    provider: 'click' | 'payme' = 'click',
    extraData?: Record<string, unknown>
  ): Promise<ProcessPaymentResponse> {
    try {
      console.log('Creating transaction with data:', { amount, currency, serviceType, articleId, translationRequestId, extraData });
      
      // Create transaction first - only include defined fields
      const transactionData: any = {
        amount: amount,
        currency: currency || 'UZS',
        service_type: serviceType,
      };

      // Only add article and translation_request if they are provided and not empty
      if (articleId && articleId.trim() !== '') {
        transactionData.article = articleId;
      }
      if (translationRequestId && translationRequestId.trim() !== '') {
        transactionData.translation_request = translationRequestId;
      }
      if (extraData && Object.keys(extraData).length > 0) {
        transactionData.extra_data = extraData;
      }

      console.log('Transaction data to send:', transactionData);

      const transaction = await apiService.payments.createTransaction(transactionData);
      
      console.log('Transaction created:', transaction);
      
      if (!transaction || !transaction.id) {
        console.error('Transaction creation failed - no ID returned:', transaction);
        return {
          success: false,
          error_code: -1,
          error: 'Transaction yaratilmadi. Server javob bermadi.',
          error_note: 'Failed to create transaction - no transaction ID returned'
        };
      }

      console.log('Processing payment for transaction:', transaction.id, 'Provider:', provider);

      // Process payment for the created transaction
      const paymentResult = await this.processPayment(transaction.id, provider);
      console.log('Payment processing result:', paymentResult);

      return {
        ...paymentResult,
        transaction_id: transaction.id,
      };
    } catch (error: any) {
      console.error('Error creating transaction and processing payment:', error);
      
      // Extract error message from different error formats
      let errorMessage = 'To\'lovni amalga oshirishda xatolik yuz berdi';
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.error) {
        errorMessage = error.error;
      } else if (error.error_note) {
        errorMessage = error.error_note;
      }
      
      return {
        success: false,
        error_code: error.error_code || -1,
        error: errorMessage,
        error_note: errorMessage
      };
    }
  }
}

export const paymentService = new PaymentService();