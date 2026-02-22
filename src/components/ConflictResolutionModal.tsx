import { useState, useEffect } from 'react';
import type { Contact } from '../types';
import { Check, X, CheckCheck, XCircle } from 'lucide-react';
import { formatPhoneForDisplay } from '../utils/phoneUtils';

interface Conflict {
  newContact: Partial<Contact>;
  existingContact: Contact;
}

interface Resolution {
  [key: string]: 'update' | 'skip';
}

interface ConflictResolutionModalProps {
  conflicts: Conflict[];
  onResolve: (resolutions: Resolution) => void;
  onCancel: () => void;
}

export const ConflictResolutionModal = ({ conflicts, onResolve, onCancel }: ConflictResolutionModalProps) => {
  // Direct pass-through of actions to parent which now handles immediate state updates
  // No local state needed for 'visibleConflicts' as parent 'conflicts' prop will update

  const handleResolutionChange = (phoneNumber: string, resolution: 'update' | 'skip') => {
    onResolve({ [phoneNumber]: resolution });
  };

  const handleBulkAction = (action: 'update' | 'skip') => {
    const resolutions: Resolution = {};
    conflicts.forEach(c => {
      resolutions[c.existingContact.phoneNumber] = action;
    });
    onResolve(resolutions);
  };

  if (conflicts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface p-6 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col relative transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text-primary">
            Çakışan Kişileri Yönet
          </h2>
          <div className="text-sm text-text-secondary font-medium bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
            Kalan: {conflicts.length}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 space-y-3 mb-4 pr-1 min-h-[200px]">
          {conflicts.map(({ newContact, existingContact }) => (
            <div key={existingContact.phoneNumber} className="p-4 bg-background rounded-xl border border-border hover:border-blue-200 dark:hover:border-slate-600 transition-colors group">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-text-primary text-base">
                    {newContact.name}
                  </h3>
                  <p className="text-sm text-text-secondary font-mono mt-0.5">
                    {formatPhoneForDisplay(newContact.phoneNumber || '')}
                  </p>
                </div>
                <div className="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs font-bold uppercase tracking-wide">
                  Çakışma
                </div>
              </div>

              <div className="bg-surface rounded-lg p-2 mb-3 border border-dashed border-border">
                <p className="text-xs text-text-secondary uppercase font-bold mb-1">Mevcut Kayıt:</p>
                <p className="text-sm text-text-primary font-medium">{existingContact.name}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleResolutionChange(existingContact.phoneNumber, 'update')}
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Check size={16} strokeWidth={3} />
                  Birleştir
                </button>
                <button
                  onClick={() => handleResolutionChange(existingContact.phoneNumber, 'skip')}
                  className="flex-1 py-2 rounded-lg bg-white dark:bg-slate-800 border border-border text-text-primary text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <X size={16} strokeWidth={3} />
                  Atla
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="pt-2 border-t border-border mt-auto space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('update')}
              className="flex-1 py-3 px-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCheck size={18} />
              Hepsini Birleştir
            </button>
            <button
              onClick={() => handleBulkAction('skip')}
              className="flex-1 py-3 px-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <XCircle size={18} />
              Hepsini Atla
            </button>
          </div>

          <button
            onClick={onCancel}
            className="w-full py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
};
