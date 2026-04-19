import React, { useState } from 'react';
import { Shield, LockKeyhole, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const APP_PIN = '1337';
export const PIN_SESSION_KEY = 'laskenta_pin_ok';

export const PinGate = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    if (pin === APP_PIN) {
      sessionStorage.setItem(PIN_SESSION_KEY, 'true');
      setError('');
      onUnlock();
      return;
    }

    setError('Väärä PIN-koodi');
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(74,155,173,0.22),transparent_34%),linear-gradient(180deg,#f8fbfd_0%,#eef4f7_52%,#e7eef3_100%)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-12 h-56 w-56 rounded-full bg-[#4A9BAD]/15 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-[#0052CC]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-white/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white/88 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(0,82,204,0.08),rgba(74,155,173,0.12))] px-6 py-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0052CC] text-white shadow-lg shadow-[#0052CC]/20">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Laskenta</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Suojattu työtila. Anna PIN-koodi avataksesi laskentasivun.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <label htmlFor="pin-code" className="text-sm font-medium text-slate-700">
              PIN-koodi
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="pin-code"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Anna PIN"
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 text-base shadow-sm focus-visible:ring-[#0052CC]"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <Button type="submit" className="h-12 w-full rounded-xl bg-[#0052CC] text-sm font-medium hover:bg-[#0043A8]">
            Avaa työtila
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            Tämä suojaus näkyy ennen varsinaista laskentanäkymää ja sopii yhteen nykyisen työkalun visuaalisen ilmeen kanssa.
          </div>
        </form>
      </div>
    </div>
  );
};
