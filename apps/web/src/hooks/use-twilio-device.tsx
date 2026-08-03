'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type CallState = 'idle' | 'incoming' | 'connecting' | 'in-call';

interface TwilioDeviceContextValue {
  state: CallState;
  activeNumber: string | null;
  durationSec: number;
  isMuted: boolean;
  makeCall: (to: string, params?: { contact_id?: string; lead_id?: string }) => Promise<void>;
  acceptCall: () => void;
  rejectCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
}

const TwilioDeviceContext = createContext<TwilioDeviceContextValue | null>(null);

export function useTwilioDevice() {
  const ctx = useContext(TwilioDeviceContext);
  if (!ctx) throw new Error('useTwilioDevice must be used within TwilioDeviceProvider');
  return ctx;
}

export function TwilioDeviceProvider({ children }: { children: React.ReactNode }) {
  const deviceRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const incomingCallRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<CallState>('idle');
  const [activeNumber, setActiveNumber] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const startTimer = useCallback(() => {
    setDurationSec(0);
    timerRef.current = setInterval(() => setDurationSec((s) => s + 1), 1000);
  }, []);
  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // No voice channel connected, or user not an agent in an active company —
      // fail silently, the call bar just never appears. Calling stays unavailable
      // until Settings > Voice has a connected Twilio channel.
      let Device: any;
      try {
        ({ Device } = await import('@twilio/voice-sdk'));
      } catch {
        return;
      }

      let token: string;
      try {
        const res = await api.post<{ token: string }>('/voice/token', {});
        token = res.token;
      } catch {
        return;
      }
      if (cancelled) return;

      const device = new Device(token, { logLevel: 'error' });
      deviceRef.current = device;

      device.on('tokenWillExpire', async () => {
        try {
          const res = await api.post<{ token: string }>('/voice/token', {});
          device.updateToken(res.token);
        } catch { /* next call will just fail to connect; not fatal */ }
      });

      device.on('incoming', (call: any) => {
        incomingCallRef.current = call;
        setActiveNumber(call.parameters?.From || null);
        setState('incoming');
        call.on('cancel', () => { incomingCallRef.current = null; setState('idle'); });
        call.on('disconnect', () => { incomingCallRef.current = null; stopTimer(); setState('idle'); });
      });

      try {
        await device.register();
      } catch { /* registration failure just means no incoming-call support this session */ }
    })();

    return () => {
      cancelled = true;
      deviceRef.current?.destroy();
      stopTimer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wireActiveCall = useCallback((call: any) => {
    activeCallRef.current = call;
    setState('in-call');
    startTimer();
    call.on('disconnect', () => {
      activeCallRef.current = null;
      stopTimer();
      setState('idle');
      setActiveNumber(null);
      setIsMuted(false);
    });
    call.on('cancel', () => {
      activeCallRef.current = null;
      stopTimer();
      setState('idle');
    });
  }, [startTimer, stopTimer]);

  const makeCall = useCallback(async (to: string, params?: { contact_id?: string; lead_id?: string }) => {
    if (!deviceRef.current) throw new Error('Voice calling is not set up — connect Twilio in Settings first.');
    setState('connecting');
    setActiveNumber(to);
    const call = await deviceRef.current.connect({
      params: { To: to, contact_id: params?.contact_id || '', lead_id: params?.lead_id || '' },
    });
    wireActiveCall(call);
  }, [wireActiveCall]);

  const acceptCall = useCallback(() => {
    const call = incomingCallRef.current;
    if (!call) return;
    call.accept();
    wireActiveCall(call);
  }, [wireActiveCall]);

  const rejectCall = useCallback(() => {
    incomingCallRef.current?.reject();
    incomingCallRef.current = null;
    setState('idle');
  }, []);

  const hangup = useCallback(() => {
    activeCallRef.current?.disconnect();
  }, []);

  const toggleMute = useCallback(() => {
    const call = activeCallRef.current;
    if (!call) return;
    const next = !isMuted;
    call.mute(next);
    setIsMuted(next);
  }, [isMuted]);

  return (
    <TwilioDeviceContext.Provider value={{ state, activeNumber, durationSec, isMuted, makeCall, acceptCall, rejectCall, hangup, toggleMute }}>
      {children}
    </TwilioDeviceContext.Provider>
  );
}
