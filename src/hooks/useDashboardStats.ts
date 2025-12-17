import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { convertToTRY, type CurrencyRates } from '../services/currency';
import type { Debt, User } from '../types';
import { Timestamp } from 'firebase/firestore';

interface ContactSummary {
    id: string;
    name: string;
    netBalance: number;
    currency: string;
    lastActivity: Date;
    lastActionSnippet: string;
    status: 'none' | 'system' | 'contact';
}

export const useDashboardStats = (
    debts: Debt[],
    user: User | null,
    rates: CurrencyRates | null,
    filterType: 'ALL' | 'RECEIVABLES' | 'PAYABLES',
    timeFilter: 'ALL' | 'THIS_WEEK' | 'THIS_MONTH',
    isContact: (id: string) => boolean,
    resolveName: (id: string, fallback: string) => { displayName: string }
) => {
    return useMemo(() => {
        if (!user || !rates) return {
            contactSummaries: [],
            availableCurrencies: [],
            totalsByCurrency: {} as Record<string, { receivables: number, payables: number, net: number, currency: string }>,
            grandTotalInTRY: { receivables: 0, payables: 0, net: 0, currency: 'TRY' }
        };

        const contactMap = new Map<string, {
            name: string;
            balance: number; // Net balance in base currency (TRY)
            lastActivity: Date;
            lastSnippet: string;
        }>();

        const totalsByCurrency: Record<string, { receivables: number, payables: number, net: number, currency: string }> = {};
        const currencies = new Set<string>();

        // Helper to determine contact status
        const getContactStatus = (id: string): 'none' | 'system' | 'contact' => {
            if (!user) return 'none';
            const isSystemUser = id.length > 20; // Basic check for UID vs Phone
            const isUserContact = isContact(id);
            if (isSystemUser) return 'system';
            if (isUserContact) return 'contact';
            return 'none';
        };

        // 1. Process Dashboard Debts
        debts.forEach(d => {
            const currency = d.currency || 'TRY';
            currencies.add(currency);

            if (!totalsByCurrency[currency]) {
                totalsByCurrency[currency] = { receivables: 0, payables: 0, net: 0, currency };
            }

            const isActiveForBalance = d.status === 'ACTIVE' || d.status === 'PARTIALLY_PAID' || d.status === 'PENDING';

            const isLender = d.lenderId === user.uid;
            const otherId = isLender ? d.borrowerId : d.lenderId;
            const fallbackName = isLender ? d.borrowerName : d.lenderName;

            // Global Totals
            if (isActiveForBalance) {
                if (isLender) {
                    totalsByCurrency[currency].receivables += d.remainingAmount;
                    totalsByCurrency[currency].net += d.remainingAmount;
                } else {
                    totalsByCurrency[currency].payables += d.remainingAmount;
                    totalsByCurrency[currency].net -= d.remainingAmount;
                }
            }

            // Contact Summaries
            if (!contactMap.has(otherId)) {
                // Resolve name if possible
                let displayName = fallbackName;
                const resolution = resolveName(otherId, fallbackName);
                if (resolution.displayName) displayName = resolution.displayName;

                contactMap.set(otherId, {
                    name: displayName,
                    balance: 0,
                    lastActivity: new Date(0),
                    lastSnippet: ''
                });
            }

            const contact = contactMap.get(otherId)!;

            // Safe Date conversion
            let debtDate = new Date(0);
            if (d.createdAt) {
                if (d.createdAt instanceof Timestamp) {
                    debtDate = d.createdAt.toDate();
                } else if (d.createdAt && typeof (d.createdAt as { seconds: number }).seconds === 'number') {
                     // Handle potential raw object from Firestore if type is lost
                     debtDate = new Date((d.createdAt as { seconds: number }).seconds * 1000);
                }
            }

            // Update last activity
            if (debtDate > contact.lastActivity) {
                contact.lastActivity = debtDate;
                const action = d.status === 'PAID' ? 'Ödendi' : (isLender ? 'Borç verdin' : 'Borç aldın');
                contact.lastActivity = debtDate;
                contact.lastSnippet = `${action} • ${formatDistanceToNow(debtDate, { addSuffix: true, locale: tr })}`;
            }

            // Update Contact Balance (Always converted to TRY for unified list)
            if (isActiveForBalance) {
                const amountInTRY = convertToTRY(d.remainingAmount, currency, rates);
                if (isLender) {
                    contact.balance += amountInTRY;
                } else {
                    contact.balance -= amountInTRY;
                }
            }
        });

        // 2. Convert Map to List & Filter
        let summaries: ContactSummary[] = Array.from(contactMap.entries())
            .map(([id, data]) => ({
                id,
                name: data.name,
                netBalance: data.balance,
                currency: 'TRY', // Contact list is unified in TRY
                lastActivity: data.lastActivity,
                lastActionSnippet: data.lastSnippet,
                status: getContactStatus(id)
            }))
            .filter(c => Math.abs(c.netBalance) > 0.01);

        // 3. Filters (Time & Type)
        const now = new Date();
        if (timeFilter === 'THIS_WEEK') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            summaries = summaries.filter(c => c.lastActivity >= oneWeekAgo);
        } else if (timeFilter === 'THIS_MONTH') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            summaries = summaries.filter(c => c.lastActivity >= oneMonthAgo);
        }

        if (filterType === 'RECEIVABLES') {
            summaries = summaries.filter(c => c.netBalance > 0);
        } else if (filterType === 'PAYABLES') {
            summaries = summaries.filter(c => c.netBalance < 0);
        }

        // 4. Sorting
        summaries.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

        // 5. Calculate Grand Total in TRY
        const grandTotalInTRY = { receivables: 0, payables: 0, net: 0, currency: 'TRY' };
        Object.values(totalsByCurrency).forEach(t => {
            grandTotalInTRY.receivables += convertToTRY(t.receivables, t.currency, rates);
            grandTotalInTRY.payables += convertToTRY(t.payables, t.currency, rates);
            grandTotalInTRY.net += convertToTRY(t.net, t.currency, rates);
        });

        return {
            contactSummaries: summaries,
            availableCurrencies: Array.from(currencies).sort(),
            totalsByCurrency,
            grandTotalInTRY
        };

    }, [debts, user, rates, filterType, timeFilter, isContact, resolveName]);
};
