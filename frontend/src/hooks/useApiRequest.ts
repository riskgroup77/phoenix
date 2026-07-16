import { useState, useCallback } from 'react';
import { apiService } from '@/services/apiService';

interface ApiRequestOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  onFinally?: () => void;
}

export function useApiRequest<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const request = useCallback(
    async (
      apiCall: () => Promise<{ data: T }>,
      options: ApiRequestOptions<T> = {}
    ) => {
      const { onSuccess, onError, onFinally } = options;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await apiCall();
        setData(response.data);
        if (onSuccess) onSuccess(response.data);
        return response.data;
      } catch (err) {
        console.error('API request failed:', err);
        setError(err);
        if (onError) onError(err);
        throw err;
      } finally {
        setLoading(false);
        if (onFinally) onFinally();
      }
    },
    []
  );

  return { data, loading, error, request };
}

// Example usage:
// const { data, loading, error, request } = useApiRequest<User>();
// 
// const fetchUser = async (userId: string) => {
//   return request(() => apiService.users.get(userId));
// };

export default useApiRequest;
