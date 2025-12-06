import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { formatCurrency } from '../utils/format';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (amount: number, note: string) => Promise<void>;
    maxAmount: number;
    currency: string;
    initialAmount?: number;
    initialNote?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen, onClose, onSubmit, maxAmount, currency, initialAmount, initialNote
}) => {
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setAmount(initialAmount ? initialAmount.toString() : '');
            setNote(initialNote || '');
        }
    }, [isOpen, initialAmount, initialNote]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0 || numAmount > maxAmount) return;

        setLoading(true);
        try {
            await onSubmit(numAmount, note);
            onClose();
            setAmount('');
            setNote('');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in duration-200 border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-text-primary">Ödeme Yap</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full">
                        <X size={20} className="text-text-secondary" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Tutar ({currency})</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            max={maxAmount}
                            min={0}
                            step="0.01"
                            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all text-lg font-semibold"
                            placeholder="0.00"
                            required
                        />
                        <p className="text-xs text-text-secondary mt-1">
                            Kalan: {formatCurrency(maxAmount, currency)}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Not (Opsiyonel)</label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-background text-text-primary focus:border-primary focus:ring-2 focus:ring-blue-900/50 outline-none transition-all"
                            placeholder="Örn: Elden verildi"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !amount}
                        className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'İşleniyor...' : 'Ödemeyi Onayla'}
                    </button>
                </form>
            </div>
        </div>
    );
};
