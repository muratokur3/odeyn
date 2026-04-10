/**
 * Client-Side Rate Limiter / Cooldown Utility
 * Spam koruması için basit cooldown mekanizması
 */

const cooldowns = new Map<string, number>();

/**
 * Cooldown kontrolü yapar.
 * @returns true = işlem yapılabilir, false = cooldown aktif (beklemeli)
 */
export function checkCooldown(key: string, cooldownMs: number): boolean {
    const lastTime = cooldowns.get(key) || 0;
    const now = Date.now();
    if (now - lastTime < cooldownMs) {
        return false;
    }
    cooldowns.set(key, now);
    return true;
}

/**
 * Kalan cooldown süresini saniye olarak döner.
 * @returns 0 = cooldown bitti, >0 = kalan saniye
 */
export function getRemainingCooldown(key: string, cooldownMs: number): number {
    const lastTime = cooldowns.get(key) || 0;
    const elapsed = Date.now() - lastTime;
    if (elapsed >= cooldownMs) return 0;
    return Math.ceil((cooldownMs - elapsed) / 1000);
}

/**
 * Belirli bir key'in cooldown'ını sıfırlar.
 */
export function resetCooldown(key: string): void {
    cooldowns.delete(key);
}

// --- Öntanımlı Cooldown Süreleri (ms) ---
export const COOLDOWN = {
    DEBT_CREATE: 5000,       // Borç oluşturma: 5 saniye
    PAYMENT: 3000,           // Ödeme: 3 saniye
    LEDGER_TRANSACTION: 3000,// Cari işlem: 3 saniye
    FEEDBACK: 30000,         // Feedback: 30 saniye
    CONTACT_ADD: 2000,       // Kişi ekleme: 2 saniye
} as const;
