import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

interface ServicePrice {
  id: number;
  service_key: string;
  amount: number;
  currency: string;
  label: string;
  updated_at: string;
}

/**
 * Barcha xizmat narxlarini yuklaydi va boshqaradi.
 * @returns Object with prices and loading state
 */
export const useServicePrices = () => {
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPrices = async () => {
      try {
        setLoading(true);
        const data = await apiService.udc.servicePrices.list();
        const pricesList = Array.isArray(data) ? data : (data?.results || data?.data || []);
        setPrices(pricesList);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load service prices:', err);
        setError(err?.message || 'Narxlarni yuklashda xatolik');
        setPrices([]);
      } finally {
        setLoading(false);
      }
    };

    loadPrices();
  }, []);

  /**
   * Narxni service_key bo'yicha olish
   */
  const getPrice = (serviceKey: string): number => {
    const price = prices.find(p => p.service_key === serviceKey);
    return price ? Number(price.amount) : 0;
  };

  /**
   * Narxni formatlash
   */
  const formatPrice = (serviceKey: string): string => {
    const amount = getPrice(serviceKey);
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
  };

  return {
    prices,
    loading,
    error,
    getPrice,
    formatPrice,
    refresh: async () => {
      // Manual refresh function
      try {
        const data = await apiService.udc.servicePrices.list();
        const pricesList = Array.isArray(data) ? data : (data?.results || data?.data || []);
        setPrices(pricesList);
        return pricesList;
      } catch (err: any) {
        console.error('Failed to refresh service prices:', err);
        throw err;
      }
    },
  };
};

/**
 * Quick helper to get price by key
 */
export const getServicePrice = async (serviceKey: string): Promise<number> => {
  try {
    const data = await apiService.udc.servicePrices.list();
    const pricesList = Array.isArray(data) ? data : (data?.results || data?.data || []);
    const price = pricesList.find((p: ServicePrice) => p.service_key === serviceKey);
    return price ? Number(price.amount) : 0;
  } catch {
    return 0;
  }
};
