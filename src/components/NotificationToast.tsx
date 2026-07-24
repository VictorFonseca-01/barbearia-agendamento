'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

export function NotificationToast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-zinc-900/95 border-emerald-500/50 text-emerald-200 shadow-emerald-500/10',
          icon: <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
        };
      case 'error':
        return {
          bg: 'bg-zinc-900/95 border-rose-500/50 text-rose-200 shadow-rose-500/10',
          icon: <AlertCircle size={20} className="text-rose-400 flex-shrink-0" />
        };
      case 'warning':
        return {
          bg: 'bg-zinc-900/95 border-amber-500/50 text-amber-200 shadow-amber-500/10',
          icon: <AlertTriangle size={20} className="text-amber-400 flex-shrink-0" />
        };
      case 'info':
      default:
        return {
          bg: 'bg-zinc-900/95 border-blue-500/50 text-blue-200 shadow-blue-500/10',
          icon: <Info size={20} className="text-blue-400 flex-shrink-0" />
        };
    }
  };

  const style = getStyle();

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
      <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 ${style.bg}`}>
        <div className="flex items-center gap-3">
          {style.icon}
          <p className="text-xs font-semibold tracking-wide leading-relaxed">{toast.message}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CustomConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
          <AlertTriangle size={24} />
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="font-bold text-lg text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-rose-600/20"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
