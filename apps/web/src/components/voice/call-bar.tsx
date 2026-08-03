'use client';

import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTwilioDevice } from '@/hooks/use-twilio-device';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CallBar() {
  const { state, activeNumber, durationSec, isMuted, acceptCall, rejectCall, hangup, toggleMute } = useTwilioDevice();

  if (state === 'idle') return null;

  if (state === 'incoming') {
    return (
      <div className="fixed top-4 right-4 z-[100] bg-white border shadow-lg rounded-xl p-4 w-72 animate-in slide-in-from-top-2">
        <p className="text-sm text-muted-foreground">Incoming call</p>
        <p className="font-semibold text-lg mb-3">{activeNumber || 'Unknown number'}</p>
        <div className="flex gap-2">
          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={acceptCall}>
            <Phone className="w-4 h-4 mr-2" />Accept
          </Button>
          <Button variant="destructive" className="flex-1" onClick={rejectCall}>
            <PhoneOff className="w-4 h-4 mr-2" />Decline
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] bg-[#075E54] text-white shadow-lg rounded-xl px-4 py-3 flex items-center gap-4">
      <div>
        <p className="text-xs text-white/70">{state === 'connecting' ? 'Calling…' : 'On call'}</p>
        <p className="font-medium">{activeNumber || 'Unknown number'}</p>
        {state === 'in-call' && <p className="text-xs text-white/70 font-mono">{formatDuration(durationSec)}</p>}
      </div>
      <div className="flex items-center gap-2">
        {state === 'in-call' && (
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={toggleMute}>
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
        )}
        <Button size="icon" variant="destructive" onClick={hangup}>
          <PhoneOff className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
