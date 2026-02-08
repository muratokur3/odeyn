import type { Debt } from '../types';
import { format } from 'date-fns';

/**
 * Downloads a string as a CSV file in the browser.
 */
const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

/**
 * Exports all debts and their payment logs to CSV.
 */
export const exportDebtsToCSV = (debts: Debt[]) => {
    const headers = [
        'ID', 
        'Borçlu', 
        'Alacaklı', 
        'Tutar', 
        'Kalan', 
        'Tür', 
        'Para Birimi', 
        'Durum', 
        'Oluşturma Tarihi', 
        'Vade Tarihi', 
        'Not'
    ];

    const rows = debts.map(d => [
        d.id,
        `"${d.borrowerName}"`,
        `"${d.lenderName}"`,
        d.originalAmount,
        d.remainingAmount,
        d.type,
        d.currency,
        d.status,
        format(d.createdAt.toDate(), 'yyyy-MM-dd HH:mm'),
        d.dueDate ? format(d.dueDate.toDate(), 'yyyy-MM-dd') : '',
        `"${d.note || ''}"`
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
    ].join('\n');

    const fileName = `DebtDert_Borclar_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    downloadCSV(csvContent, fileName);
};
