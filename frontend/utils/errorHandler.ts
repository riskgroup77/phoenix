import { API_V1_BASE_URL } from '../config/apiBase';

/**
 * Centralized error handling utility
 * Provides user-friendly error messages in Uzbek
 */

export interface ApiError {
  status?: number;
  message?: string;
  detail?: string;
  error?: string;
  error_note?: string;
  non_field_errors?: string[];
  [key: string]: any;
}

/**
 * Extract user-friendly error message from API error
 */
export function getErrorMessage(error: any): string {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error;
  }

  // Handle API error response
  if (error?.response) {
    const apiError: ApiError = error.response;
    
    // Check for non_field_errors first
    if (apiError.non_field_errors && Array.isArray(apiError.non_field_errors) && apiError.non_field_errors.length > 0) {
      return apiError.non_field_errors[0];
    }
    
    // Check for detail
    if (apiError.detail) {
      return typeof apiError.detail === 'string' ? apiError.detail : JSON.stringify(apiError.detail);
    }
    
    // DRF validation errors: { field_name: ["msg1", "msg2"], ... }
    if (typeof apiError === 'object' && apiError !== null && !Array.isArray(apiError)) {
      const fieldParts = Object.entries(apiError)
        .filter(([k]) => !['detail', 'message', 'error', 'error_note', 'non_field_errors'].includes(k))
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
      if (fieldParts.length > 0) return fieldParts.join('; ');
    }
    
    // Check for error_note (Click payment errors)
    if (apiError.error_note) {
      return apiError.error_note;
    }
    
    // Check for error
    if (apiError.error) {
      return typeof apiError.error === 'string' ? apiError.error : JSON.stringify(apiError.error);
    }
    
    // Check for message
    if (apiError.message) {
      return apiError.message;
    }
  }
  
  // Handle error object directly
  if (error?.detail) {
    return typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
  }
  
  if (error?.error_note) {
    return error.error_note;
  }
  
  if (error?.error) {
    return typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
  }
  
  if (error?.message) {
    return error.message;
  }
  
  // Default error message
  return 'Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.';
}

/**
 * Get error message for specific field
 */
/**
 * DRF 400 body: { field: ["msg"], non_field_errors: [...], detail: "..." }
 */
export function formatDrfValidationErrors(responseBody: Record<string, unknown> | null | undefined): string | null {
  if (!responseBody || typeof responseBody !== 'object' || Array.isArray(responseBody)) {
    return null;
  }
  const skip = new Set(['detail', 'message', 'error', 'error_note', 'html']);
  const label: Record<string, string> = {
    phone: 'Telefon',
    email: 'Email',
    password: 'Parol',
    password_confirm: 'Parol tasdiq',
    first_name: 'Ism',
    last_name: 'Familiya',
    affiliation: 'Tashkilot',
    journal: 'Jurnal',
    article: 'Maqola',
    non_field_errors: '',
  };
  const parts: string[] = [];
  const nfe = responseBody.non_field_errors;
  if (Array.isArray(nfe) && nfe.length > 0) {
    parts.push(String(nfe[0]));
  }
  for (const [k, v] of Object.entries(responseBody)) {
    if (skip.has(k) || k === 'non_field_errors') continue;
    if (Array.isArray(v) && v.length > 0) {
      const lab = label[k] || k;
      parts.push(lab ? `${lab}: ${v[0]}` : String(v[0]));
    } else if (typeof v === 'string' && v.trim()) {
      const lab = label[k] || k;
      parts.push(lab ? `${lab}: ${v}` : v);
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

export function getFieldError(error: any, fieldName: string): string | null {
  if (error?.response?.[fieldName]) {
    const fieldError = error.response[fieldName];
    if (Array.isArray(fieldError) && fieldError.length > 0) {
      return fieldError[0];
    }
    return typeof fieldError === 'string' ? fieldError : null;
  }
  
  if (error?.[fieldName]) {
    const fieldError = error[fieldName];
    if (Array.isArray(fieldError) && fieldError.length > 0) {
      return fieldError[0];
    }
    return typeof fieldError === 'string' ? fieldError : null;
  }
  
  return null;
}

/**
 * Check if error is server-side (5xx). Such errors must not be shown as "network error".
 */
export function isServerError(error: any): boolean {
  const status = error?.status ?? error?.response?.status;
  return typeof status === 'number' && status >= 500 && status < 600;
}

/**
 * Check if error is network error (no response from server).
 * 5xx responses are not network errors — server responded.
 */
export function isNetworkError(error: any): boolean {
  if (isServerError(error)) return false;
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorName = error?.name?.toLowerCase() || '';
  
  return errorMessage.includes('network') || 
         errorMessage.includes('failed to fetch') ||
         errorMessage.includes('networkerror') ||
         errorMessage.includes('load failed') ||
         errorMessage.includes('network request failed') ||
         errorName === 'typeerror' ||
         error?.code === 'NETWORK_ERROR' ||
         error?.code === 'ERR_NETWORK' ||
         !error?.response; // Agar response bo'lmasa, network error bo'lishi mumkin
}

/**
 * Check if error is authentication error
 */
export function isAuthError(error: any): boolean {
  return error?.status === 401 || 
         error?.response?.status === 401 ||
         error?.message?.includes('Unauthorized') ||
         error?.message?.includes('authentication');
}

/**
 * Get user-friendly error message based on error type.
 * 5xx is checked first so we never show "Serverga ulanib bo'lmadi" for server errors.
 */
export function getUserFriendlyError(error: any): string {
  const status = error?.status ?? error?.response?.status;
  if (typeof status === 'number' && status >= 500 && status < 600) {
    const body = error?.response;
    const detail = body?.detail;
    if (
      detail &&
      typeof detail === 'string' &&
      detail.length < 200 &&
      !detail.includes('<!DOCTYPE') &&
      !detail.includes('<html')
    ) {
      return detail;
    }
    return 'Server xatosi. Iltimos, keyinroq urinib ko\'ring.';
  }

  if (isNetworkError(error)) {
    if (import.meta.env.PROD) {
      return 'Serverga ulanib bo\'lmadi. Iltimos, internet aloqasini tekshiring yoki keyinroq urinib ko\'ring.';
    } else {
      const apiUrl = API_V1_BASE_URL;
      return `Serverga ulanib bo'lmadi. Iltimos, internet aloqasini tekshiring yoki keyinroq urinib ko'ring. (API: ${apiUrl})`;
    }
  }
  
  if (isAuthError(error)) {
    return 'Sizning sessiyangiz muddati tugagan. Iltimos, qayta kiring.';
  }
  
  if (status === 402) {
    const body = error?.response;
    const msg = (body && (body.error || body.detail));
    return (typeof msg === 'string' ? msg : null) || 'To\'lov talab qilinadi. Iltimos, avval to\'lovni amalga oshiring.';
  }
  
  if (status === 403) {
    return 'Siz bu amalni bajarish huquqiga egasiz.';
  }
  
  if (status === 404) {
    return 'Ma\'lumot topilmadi.';
  }
  
  return getErrorMessage(error);
}
