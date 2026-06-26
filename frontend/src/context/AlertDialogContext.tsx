import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';

type DialogType = 'alert' | 'confirm';

interface DialogConfig {
  type: DialogType;
  title: string;
  message: string;
  resolve: (value: any) => void;
}

interface AlertDialogContextProps {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
}

const AlertDialogContext = createContext<AlertDialogContextProps | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertDialogContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertDialogProvider');
  }
  return context;
};

export const AlertDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogConfig | null>(null);

  const alert = useCallback((message: string, title: string = 'Notice') => {
    return new Promise<void>((resolve) => {
      setDialog({
        type: 'alert',
        title,
        message,
        resolve: () => {
          setDialog(null);
          resolve();
        }
      });
    });
  }, []);

  const confirm = useCallback((message: string, title: string = 'Confirm Action') => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: 'confirm',
        title,
        message,
        resolve: (result: boolean) => {
          setDialog(null);
          resolve(result);
        }
      });
    });
  }, []);

  return (
    <AlertDialogContext.Provider value={{ alert, confirm }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in select-none">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-brand-border p-5 shadow-2xl animate-fade-in">
            {/* Header with Title and Icon */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-zinc-800/80 border border-brand-border shrink-0 mt-0.5">
                {dialog.type === 'alert' ? (
                  <AlertCircle className="h-5 w-5 text-brand-primary animate-pulse" />
                ) : (
                  <HelpCircle className="h-5 w-5 text-brand-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-zinc-150 truncate">
                  {dialog.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed whitespace-pre-line">
                  {dialog.message}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 mt-6">
              {dialog.type === 'confirm' && (
                <button
                  type="button"
                  onClick={() => dialog.resolve(false)}
                  className="px-3.5 py-2 rounded-xl border border-brand-border text-xs text-zinc-400 hover:text-zinc-250 hover:bg-zinc-800 transition-all cursor-pointer font-medium"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => dialog.resolve(true)}
                className="px-3.5 py-2 rounded-xl bg-brand-primary text-xs font-bold text-zinc-950 hover:bg-brand-primary-hover shadow-[0_0_10px_var(--brand-shadow)] transition-all cursor-pointer"
              >
                {dialog.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertDialogContext.Provider>
  );
};
