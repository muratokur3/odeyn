import React from 'react';
import { useEffect } from 'react';
import { ArrowLeft, Trash2, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDebts } from '../context/DebtContext';
import { DebtCard } from '../components/DebtCard';

export function Trash() {
  const navigate = useNavigate();
  const { deletedDebts, restoreDebt, permanentlyDeleteDebt } = useDebts();

  useEffect(() => {
    document.title = 'Çöp Kutusu - DebtDert';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-gray-700" />
            <h1 className="text-3xl font-bold text-gray-800">Çöp Kutusu</h1>
          </div>
        </div>

        {deletedDebts.length === 0 ? (
          <div className="text-center py-12">
            <Trash2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Çöp kutusu boş</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deletedDebts.map((debt) => (
              <div key={debt.id} className="relative">
                <DebtCard debt={debt} />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => restoreDebt(debt.id)}
                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                    title="Geri Yükle"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Bu borç kalıcı olarak silinecek. Emin misiniz?')) {
                        permanentlyDeleteDebt(debt.id);
                      }
                    }}
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    title="Kalıcı Olarak Sil"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}