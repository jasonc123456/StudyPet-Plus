'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import type { PetSnapshot } from '@/lib/pet-snapshot';

export type LivePetFetchStatus = 'loading' | 'ready' | 'unauthorized' | 'error';

type LivePetResponse = {
  pet?: PetSnapshot | null;
  error?: string;
};

export type LivePetContextValue = {
  pet: PetSnapshot | null;
  status: LivePetFetchStatus;
  error: string | null;
  refresh: () => Promise<void>;
  applyPet: (next: PetSnapshot | null) => void;
};

const FETCH_TIMEOUT_MS = 10_000;

const LivePetContext = createContext<LivePetContextValue | null>(null);

function useLivePetState(): LivePetContextValue {
  const [pet, setPet] = useState<PetSnapshot | null>(null);
  const [status, setStatus] = useState<LivePetFetchStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setStatus((current) => (current === 'ready' ? current : 'loading'));

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS
    );

    try {
      const response = await fetch('/api/pet/xp', {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (response.status === 401) {
        setPet(null);
        setStatus('unauthorized');
        return;
      }

      const data = (await response.json()) as LivePetResponse;

      if (!response.ok) {
        setStatus('error');
        setError(
          data.error ??
            'Could not load your StudyPet. Check your connection and try again.'
        );
        return;
      }

      setPet(data.pet ?? null);
      setStatus('ready');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setStatus('error');
        setError('Request timed out — is your database tunnel open?');
        return;
      }

      setStatus('error');
      setError('Connection lost — check your network or database tunnel.');
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyPet = useCallback((next: PetSnapshot | null) => {
    setPet(next);
    if (next) {
      setStatus('ready');
      setError(null);
    }
  }, []);

  return { pet, status, error, refresh, applyPet };
}

/** US-4.10 — shared live pet state for StudyPetHero and XP award hooks. */
export function LivePetProvider({ children }: { children: React.ReactNode }) {
  const value = useLivePetState();

  return (
    <LivePetContext.Provider value={value}>{children}</LivePetContext.Provider>
  );
}

/**
 * Loads the signed-in user's StudyPet from GET `/api/pet/xp`.
 * Returns `unauthorized` for guests so marketing UI can fall back gracefully.
 */
export function useLivePet(): LivePetContextValue {
  const context = useContext(LivePetContext);
  if (!context) {
    throw new Error('useLivePet must be used within a LivePetProvider');
  }

  return context;
}

/** Optional access for hooks that may run outside a provider tree. */
export function useLivePetOptional(): LivePetContextValue | null {
  return useContext(LivePetContext);
}
