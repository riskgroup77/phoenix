/**
 * Reusable Payment Modal Component
 * Used across all payment flows (Article, Book, Translation, Plagiarism)
 */

import React from 'react';
import Button from './ui/Button';
import { CreditCard, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPay: () => Promise<void>;
  amount: number;
  serviceName: string;
  status: 'idle' | 'processing' | 'success' | 'failed';
  error: string | null;
  currency?: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPay,
  amount,
  serviceName,
  status,
  error,
  currency = 'so\'m'
}) => {
  if (!isOpen) return null;

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('uz-UZ').format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white/55 rounded-lg p-6 max-w-md w-full border border-slate-200/90">
        {status === 'idle' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-900">To'lovni tasdiqlash</h3>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-900 transition-colors"
                aria-label="Yopish"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <p className="text-slate-600 mb-2">
              {serviceName} uchun to'lov:
            </p>
            <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/30 mb-4">
              <p className="text-2xl font-bold text-slate-900 text-center">
                {formatAmount(amount)} {currency}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={onPay} className="flex-1">
                <CreditCard className="mr-2 h-4 w-4" />
                To'lovni Amalga Oshirish
              </Button>
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Bekor qilish
              </Button>
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <p className="mt-4 text-lg font-medium text-slate-700">To'lov tasdiqlanmoqda...</p>
            <p className="mt-2 text-sm text-slate-500">Iltimos, kuting</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-800 mx-auto mb-4" />
            <p className="mt-4 text-lg font-medium text-slate-700">To'lov muvaffaqiyatli!</p>
            <p className="mt-2 text-sm text-slate-500">To'lov sahifasiga yo'naltirilmoqdasiz</p>
          </div>
        )}

        {status === 'failed' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-900">To'lovda xatolik</h3>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-900 transition-colors"
                aria-label="Yopish"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="text-center mb-4">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-sm text-slate-500 max-w-xs mx-auto">{error || "To'lovni amalga oshirishda xatolik yuz berdi"}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={onPay} className="flex-1">
                Qayta Urinish
              </Button>
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Yopish
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
