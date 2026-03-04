import { useState, useEffect, useCallback } from 'preact/hooks';
import type { InsightsResponse } from '@bogota-insights/shared';
import { fetchInsights, getMockData, APIError } from '../utils/api';

interface UseInsightsOptions {
  lat: number;
  lng: number;
  radius: number;
  lang: 'es' | 'en';
  apiKey?: string;
  apiBaseUrl?: string;
  useMock?: boolean;
}

interface UseInsightsResult {
  data: InsightsResponse | null;
  loading: boolean;
  error: { code: string; message: string } | null;
  refetch: () => void;
}

export function useInsights(opts: UseInsightsOptions): UseInsightsResult {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (opts.useMock) {
      // Simulate network delay for mock data
      await new Promise((r) => setTimeout(r, 800));
      setData(getMockData(opts.lat, opts.lng, opts.radius));
      setLoading(false);
      return;
    }

    try {
      const result = await fetchInsights({
        lat: opts.lat,
        lng: opts.lng,
        radius: opts.radius,
        lang: opts.lang,
        apiKey: opts.apiKey,
        apiBaseUrl: opts.apiBaseUrl,
      });
      setData(result);
    } catch (err) {
      if (err instanceof APIError) {
        setError({ code: err.code, message: err.message });
      } else {
        setError({ code: 'NETWORK_ERROR', message: 'Unable to load insights' });
      }
    } finally {
      setLoading(false);
    }
  }, [opts.lat, opts.lng, opts.radius, opts.lang, opts.apiKey, opts.apiBaseUrl, opts.useMock]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
