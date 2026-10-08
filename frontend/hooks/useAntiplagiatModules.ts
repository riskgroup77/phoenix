import { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { ANTIPLAGIAT_MODULES, type AntiplagiatModule } from '../constants/antiplagiatModules';

type ApiModule = { id: string; label: string; group?: string; description?: string };

/**
 * Serverda haqiqatan tekshiriladigan antiplagiat modullari.
 * API javob bermasa — zaxira ro'yxat (har doim mavjud asosiy modullar).
 */
export function useAntiplagiatModules(): { modules: AntiplagiatModule[]; loaded: boolean } {
  const [modules, setModules] = useState<AntiplagiatModule[]>(ANTIPLAGIAT_MODULES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiService.articles
      .antiplagiatModules()
      .then((res: { modules?: ApiModule[] } | undefined) => {
        const list = Array.isArray(res?.modules) ? res!.modules : [];
        if (!cancelled && list.length) {
          setModules(
            list.map((m) => ({ id: m.id, label: m.label, category: m.group, description: m.description })),
          );
        }
      })
      .catch(() => {
        /* zaxira ro'yxat qoladi */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { modules, loaded };
}
