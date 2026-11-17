// client/src/lib/panel-registry.tsx
// ─── نگاشت kindهای ERF به صفحات کامل React ───
// بدون این فایل، پنل‌های ERF به drawer خام می‌افتند.
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard     = lazy(() => import('@/pages/dashboard'));
const BedsPage      = lazy(() => import('@/pages/beds'));
const CodesPage     = lazy(() => import('@/pages/codes'));
const OrdersPage    = lazy(() => import('@/pages/orders'));
const ReportsPage   = lazy(() => import('@/pages/reports'));
const TriagePage    = lazy(() => import('@/pages/triage'));
const NursingPage   = lazy(() => import('@/pages/nursing'));

const fallback = (
  <div className="p-4 space-y-3">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-64 w-full" />
  </div>
);

type PanelKind =
  | 'erf_dashboard'
  | 'erf_beds'
  | 'erf_codes'
  | 'erf_orders'
  | 'erf_stats'
  | 'erf_triage'
  | 'erf_nursing';

const PANEL_REGISTRY: Record<PanelKind, any> = {
  erf_dashboard: Dashboard,
  erf_beds:      BedsPage,
  erf_codes:     CodesPage,
  erf_orders:    OrdersPage,
  erf_stats:     ReportsPage,
  erf_triage:    TriagePage,
  erf_nursing:   NursingPage,
};

export function renderPanel(kind: string) {
  const Comp = PANEL_REGISTRY[kind as PanelKind];
  if (!Comp) return null;
  return (
    <Suspense fallback={fallback}>
      <Comp />
    </Suspense>
  );
}

export function isERFPanel(kind: string | undefined | null): boolean {
  return !!kind && kind.startsWith('erf_');
}

// اگر shell از navigation استفاده می‌کند:
export const PANEL_ROUTES: Record<string, string> = {
  er_dashboard: '/',
  er_beds:      '/beds',
  er_codes:     '/codes',
  er_orders:    '/orders',
  er_stats:     '/reports',
  er_triage:    '/triage',
  er_nursing:   '/nursing',
};
