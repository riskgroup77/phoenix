// PaymentTest.tsx
import React, { useState } from 'react';
import { paymentService } from '../services/paymentService';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';

const PaymentTest: React.FC = () => {
  const [amount, setAmount] = useState<string>('10000');
  const [serviceType, setServiceType] = useState<string>('top_up');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleProcessPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Iltimos, to\'g\'ri summani kiriting');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Create transaction and process payment
      const response = await paymentService.createTransactionAndPay(
        parseFloat(amount),
        'UZS',
        serviceType
      );

      setResult(response);

      if (response.success && response.transaction_id) {
        toast.success('To\'lov sahifasiga o\'tmoqdasiz. QR kodni skanerlang yoki tugmani bosing.');
        paymentService.redirectToPaymentPage(response.transaction_id);
      } else if (response.success && response.payment_url) {
        toast.success('To\'lov sahifasiga o\'tmoqdasiz...');
        setTimeout(() => {
          paymentService.redirectToPayment(response.payment_url!);
        }, 1000);
      } else {
        // Show error message
        const errorMsg = response.error_note || response.error || 'To\'lovni amalga oshirishda xatolik yuz berdi';
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      setResult({ 
        success: false, 
        error: error.message || 'Noma\'lum xatolik yuz berdi' 
      });
      toast.error('To\'lovni amalga oshirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Click To'lov Test</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">To'lovni amalga oshirish</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summa (UZS)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Summani kiriting"
              min="1000"
              step="1000"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Xizmat turi
            </label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="top_up">Hisobni to'ldirish</option>
              <option value="publication_fee">Nashr to'lovi</option>
              <option value="fast-track">Tezkor nashr</option>
              <option value="language_editing">Til tahriri</option>
              <option value="translation">Tarjima</option>
              <option value="book_publication">Kitob nashri</option>
            </select>
          </div>
          
          <button
            onClick={handleProcessPayment}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Jarayonda...' : "To'lovni amalga oshirish"}
          </button>
        </div>
      </div>
      
      {result && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Natija</h2>
          <div className="mb-2">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              result.success 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {result.success ? 'Muvaffaqiyatli' : 'Xatolik'}
            </span>
          </div>
          {result.payment_url && (
            <div className="mb-4">
              <a
                href={result.payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                To'lov sahifasiga o'tish
              </a>
            </div>
          )}
          <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PaymentTest;