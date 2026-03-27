import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import {
    getAdminStats,
    getRecentFeedbacks,
    getRecentDebts,
    type AdminStats,
    type AdminFeedback,
    type AdminDebtSummary,
} from '../services/adminService';
import { Timestamp } from 'firebase/firestore';

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (raw: { seconds: number; nanoseconds: number } | null | undefined): string => {
    if (!raw) return '—';
    try {
        const ts = new Timestamp(raw.seconds, raw.nanoseconds);
        return ts.toDate().toLocaleDateString('tr-TR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return '—';
    }
};

const statusLabel: Record<string, { label: string; color: string }> = {
    ACTIVE:           { label: 'Aktif',    color: '#22c55e' },
    PAID:             { label: 'Ödendi',   color: '#3b82f6' },
    AUTO_HIDDEN:      { label: 'Gizli',    color: '#f59e0b' },
    HIDDEN:           { label: 'Gizli',    color: '#f59e0b' },
    REJECTED:         { label: 'Reddedildi', color: '#ef4444' },
    REJECTED_BY_RECEIVER: { label: 'Silindi', color: '#ef4444' },
    ARCHIVED:         { label: 'Arşiv',    color: '#8b5cf6' },
    DISPUTED:         { label: 'İtiraz',   color: '#f97316' },
    PENDING:          { label: 'Bekliyor', color: '#94a3b8' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: number | string;
    icon: string;
    accent: string;
    sub?: string;
}

const StatCard = ({ label, value, icon, accent, sub }: StatCardProps) => (
    <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${accent}33`,
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
        overflow: 'hidden',
    }}>
        <div style={{
            position: 'absolute', top: -10, right: -10,
            fontSize: 64, opacity: 0.07, lineHeight: 1,
        }}>{icon}</div>
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {label}
        </span>
        <span style={{ fontSize: 36, fontWeight: 700, color: accent, lineHeight: 1 }}>
            {value}
        </span>
        {sub && <span style={{ fontSize: 11, color: '#64748b' }}>{sub}</span>}
    </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────

export const AdminPanel = () => {
    const { user } = useAuthContext();
    const navigate = useNavigate();

    const [stats, setStats] = useState<AdminStats | null>(null);
    const [feedbacks, setFeedbacks] = useState<AdminFeedback[]>([]);
    const [debts, setDebts] = useState<AdminDebtSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'feedbacks' | 'debts'>('feedbacks');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isAdmin = (user as any)?.isAdmin === true;

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [s, f, d] = await Promise.all([
                getAdminStats(),
                getRecentFeedbacks(20),
                getRecentDebts(10),
            ]);
            setStats(s);
            setFeedbacks(f);
            setDebts(d);
        } catch (err) {
            console.error(err);
            setError('Veriler yüklenirken hata oluştu. Firestore kurallarını kontrol edin.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isAdmin) {
            navigate('/', { replace: true });
            return;
        }
        loadData();
    }, [isAdmin, navigate, loadData]);

    if (!isAdmin) return null;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
            color: '#e2e8f0',
            fontFamily: "'Inter', system-ui, sans-serif",
            padding: '0 0 60px',
        }}>
            {/* Header */}
            <div style={{
                background: 'rgba(15,23,42,0.8)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '16px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>🛡️</span>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1 }}>Admin Panel</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Odeyn · Read-only</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={loadData}
                        style={{
                            background: 'rgba(99,102,241,0.15)',
                            border: '1px solid rgba(99,102,241,0.4)',
                            borderRadius: 10,
                            color: '#a5b4fc',
                            padding: '7px 16px',
                            fontSize: 13,
                            cursor: 'pointer',
                            fontWeight: 500,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.3)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
                    >
                        🔄 Yenile
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            color: '#94a3b8',
                            padding: '7px 16px',
                            fontSize: 13,
                            cursor: 'pointer',
                            fontWeight: 500,
                        }}
                    >
                        ← Uygulamaya Dön
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 0' }}>

                {/* Error */}
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 12,
                        padding: '14px 18px',
                        color: '#fca5a5',
                        fontSize: 14,
                        marginBottom: 24,
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Stats Grid */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b', fontSize: 14 }}>
                        Yükleniyor...
                    </div>
                ) : stats && (
                    <>
                        <div style={{ marginBottom: 8 }}>
                            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                                Genel Bakış
                            </h2>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: 16,
                            marginBottom: 36,
                            marginTop: 12,
                        }}>
                            <StatCard label="Kullanıcılar"  value={stats.totalUsers}    icon="👤" accent="#818cf8" />
                            <StatCard label="Toplam Borç"   value={stats.totalDebts}    icon="📋" accent="#38bdf8" />
                            <StatCard label="Aktif"         value={stats.activeDebts}   icon="⚡" accent="#34d399" />
                            <StatCard label="Ödendi"        value={stats.paidDebts}     icon="✅" accent="#4ade80" />
                            <StatCard label="Gizli"         value={stats.hiddenDebts}   icon="🫥" accent="#fb923c" />
                            <StatCard label="Feedback"      value={stats.totalFeedbacks} icon="💬" accent="#f472b6" />
                        </div>

                        {/* Tab Bar */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                            {(['feedbacks', 'debts'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    style={{
                                        background: activeTab === tab ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                                        border: activeTab === tab ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 10,
                                        color: activeTab === tab ? '#a5b4fc' : '#64748b',
                                        padding: '8px 20px',
                                        fontSize: 13,
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {tab === 'feedbacks' ? `💬 Feedback'ler (${feedbacks.length})` : `📋 Son Borçlar (${debts.length})`}
                                </button>
                            ))}
                        </div>

                        {/* Feedbacks Tab */}
                        {activeTab === 'feedbacks' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {feedbacks.length === 0 && (
                                    <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0', fontSize: 14 }}>
                                        Henüz feedback yok.
                                    </div>
                                )}
                                {feedbacks.map(fb => (
                                    <div key={fb.id} style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.07)',
                                        borderRadius: 14,
                                        padding: '16px 20px',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto',
                                        gap: 12,
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0', marginBottom: 4 }}>
                                                {fb.title || '(Başlıksız)'}
                                            </div>
                                            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, marginBottom: 10 }}>
                                                {fb.description || '—'}
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                <Pill color="#818cf8">{fb.staticName || fb.uid?.slice(0, 8) || '?'}</Pill>
                                                {fb.platform && <Pill color="#38bdf8">{fb.platform}</Pill>}
                                                {fb.deviceName && <Pill color="#64748b">{fb.deviceName}</Pill>}
                                                {fb.pagePath && <Pill color="#6ee7b7">📍 {fb.pagePath}</Pill>}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: 11, color: '#475569', whiteSpace: 'nowrap', paddingTop: 2 }}>
                                            {formatDate(fb.createdAt as never)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Debts Tab */}
                        {activeTab === 'debts' && (
                            <div style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: 14,
                                overflow: 'hidden',
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                                            {['Alacaklı', 'Borçlu', 'Miktar', 'Durum', 'Tarih'].map(h => (
                                                <th key={h} style={{
                                                    padding: '12px 16px',
                                                    textAlign: 'left',
                                                    color: '#64748b',
                                                    fontWeight: 600,
                                                    fontSize: 11,
                                                    letterSpacing: '0.05em',
                                                    textTransform: 'uppercase',
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {debts.map((d, i) => {
                                            const st = statusLabel[d.status] ?? { label: d.status, color: '#94a3b8' };
                                            return (
                                                <tr key={d.id} style={{
                                                    borderBottom: i < debts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                                    transition: 'background 0.15s',
                                                }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                    <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{d.lenderName}</td>
                                                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{d.borrowerName}</td>
                                                    <td style={{ padding: '12px 16px', color: '#38bdf8', fontWeight: 600 }}>
                                                        {d.originalAmount.toLocaleString('tr-TR')} {d.currency}
                                                    </td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{
                                                            background: st.color + '22',
                                                            color: st.color,
                                                            border: `1px solid ${st.color}44`,
                                                            borderRadius: 6,
                                                            padding: '2px 8px',
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                        }}>{st.label}</span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: 12 }}>
                                                        {formatDate(d.createdAt as never)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {debts.length === 0 && (
                                    <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0', fontSize: 14 }}>
                                        Kayıt bulunamadı.
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const Pill = ({ children, color }: { children: React.ReactNode; color: string }) => (
    <span style={{
        background: color + '18',
        color,
        border: `1px solid ${color}33`,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 500,
    }}>{children}</span>
);
