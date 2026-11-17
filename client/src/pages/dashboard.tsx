// client/src/pages/dashboard.tsx — نسخه بهینه‌شده (۶ KPI + پنل تب‌دار)
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useOverview, useNow } from '@/lib/live';
import { PageHead } from '@/components/shell';
import { Kpi, Panel, EsiBadge, NewsBadge, VitalsInline, WaitClock, usePatientDrawer, Empty, StatusPill } from '@/components/clinical';
import { num, pct, durShort, ago, ZONES, BED_STATUS, fTime, minsSince } from '@/lib/fa';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, BedDouble, Clock, AlertTriangle, ClipboardList, LogOut, Siren } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { ESI_TARGET_MIN } from '@shared/schema';

type QueueTab = 'alerts' | 'queue' | 'events';

export default function Dashboard() {
  const { data, isLoading } = useOverview();
  const now = useNow(30_000);
  const drawer = usePatientDrawer();
  const [tab, setTab] = useState<QueueTab>('alerts');

  const m = useMemo(() => {
    if (!data) return null;
    const P = data.patients;
    const usable = data.beds.filter(b => b.status !== 'blocked');
    const occ = data.beds.filter(b => b.status === 'occupied').length;
    const waitingTriage = P.filter(p => p.status === 'waiting_triage');
    const waitingBed = P.filter(p => p.status === 'waiting_bed');
    const notSeen = P.filter(p => !p.seenAt && p.esi);
    const overdue = notSeen.filter(p => minsSince(p.arrivedAt, now)! > Math.max(ESI_TARGET_MIN[p.esi!] ?? 30, 5));
    const avgWait = notSeen.length ? notSeen.reduce((s, p) => s + minsSince(p.arrivedAt, now)!, 0) / notSeen.length : 0;
    const stat = data.orders.filter(o => o.priority === 'stat' && o.status !== 'done' && o.status !== 'cancelled');
    const pending = data.orders.filter(o => o.status === 'pending');
    const alerts = P.filter(p => (p.news ?? 0) >= 5).sort((a, b) => (b.news ?? 0) - (a.news ?? 0));
    const esi = [1, 2, 3, 4, 5].map(e => ({ esi: e, count: P.filter(p => p.esi === e).length }));
    const boarding = P.filter(p => p.status === 'awaiting_disposition');
    const crowd = Math.min(200, Math.round(
      (P.length / Math.max(1, usable.length)) * 100 * 0.7
      + waitingTriage.length * 4
      + boarding.length * 3
      + overdue.length * 3
    ));
    return { P, occ, usable: usable.length, waitingTriage, waitingBed, notSeen, overdue, avgWait, stat, pending, alerts, esi, boarding, crowd };
  }, [data, now]);

  if (isLoading || !data || !m) return <DashSkeleton />;

  const crowdLabel = m.crowd >= 140 ? 'ازدحام شدید' : m.crowd >= 100 ? 'پرازدحام' : m.crowd >= 60 ? 'شلوغ' : 'عادی';
  const crowdTone = m.crowd >= 140 ? 'danger' : m.crowd >= 100 ? 'warn' : undefined;
  const queue = [...m.P]
    .filter(p => p.status === 'waiting_triage' || p.status === 'waiting_bed')
    .sort((a, b) => (a.esi ?? 0) - (b.esi ?? 0) || a.arrivedAt - b.arrivedAt);

  const activeCodes = data.codes ?? [];

  return (
    <div className="pb-20 lg:pb-0">
      <PageHead
        title="وضعیت لحظه‌ای اورژانس"
        sub={`${num(m.P.length)} بیمار در بخش · ${num(data.today.total)} پذیرش در ۲۴ ساعت گذشته`}
      />

      {activeCodes.length > 0 && (
        <div className="mb-4 space-y-2">
          {activeCodes.map((c: any) => (
            <Link key={c.id} href="/codes" className="flex items-center gap-3 rounded-xl border-2 border-red-600 bg-red-600 text-white px-4 py-3 shadow-lg animate-pulse">
              <Siren className="h-6 w-6 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold">کد فعال — {c.codeType?.replace('code_', 'کد ')}</div>
                <div className="text-xs opacity-90">{c.location || 'محل نامشخص'} · {c.activatedBy}</div>
              </div>
              <span className="text-sm font-semibold underline">مشاهده</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <Kpi label="بیماران حاضر" value={num(m.P.length)} hint={`${num(m.boarding.length)} در انتظار تعیین تکلیف`} icon={Users} testId="kpi-census" />
        <Kpi label="اشغال تخت" value={pct(m.occ / Math.max(1, m.usable))} hint={`${num(m.occ)} از ${num(m.usable)} تخت فعال`} icon={BedDouble} tone={m.occ / m.usable > 0.9 ? 'danger' : undefined} testId="kpi-occupancy" />
        <Kpi label="در انتظار تریاژ" value={num(m.waitingTriage.length)} hint="هدف: کمتر از ۱۰ دقیقه" icon={Siren} tone={m.waitingTriage.length >= 3 ? 'warn' : undefined} testId="kpi-triage" />
        <Kpi label="میانگین انتظار ویزیت" value={durShort(m.avgWait)} hint={`${num(m.notSeen.length)} بیمار ویزیت‌نشده`} icon={Clock} />
        <Kpi label="دستورات STAT باز" value={num(m.stat.length)} hint={`${num(m.pending.length)} تأییدنشده`} icon={ClipboardList} tone={m.stat.length ? 'warn' : undefined} />
        <Kpi label="شاخص ازدحام" value={num(m.crowd)} hint={crowdLabel} icon={LogOut} tone={crowdTone as any} />
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        <Panel title="نقشه حرارتی تخت‌ها" className="xl:col-span-2" action={<Link href="/beds" className="text-xs text-primary hover:underline">مدیریت تخت‌ها</Link>}>
          <div className="space-y-3">
            {ZONES.map(z => {
              const zb = data.beds.filter(b => b.zone === z.key);
              const occ = zb.filter(b => b.status === 'occupied').length;
              return (
                <div key={z.key} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <div className="text-xs font-semibold truncate">{z.label}</div>
                    <div className="text-[11px] text-muted-foreground num">{num(occ)}/{num(zb.length)}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {zb.map(b => {
                      const p = m.P.find(x => x.id === b.patientId);
                      return (
                        <button key={b.id}
                          onClick={() => p && drawer.open(p.id)}
                          title={p ? `${b.code} — ${p.name}` : `${b.code} — ${BED_STATUS[b.status].label}`}
                          className={cn('h-9 w-12 rounded-md border text-[10px] font-mono flex flex-col items-center justify-center leading-none gap-0.5 transition-transform', p ? 'hover:-translate-y-0.5' : 'cursor-default', BED_STATUS[b.status].cls)}
                          style={p?.esi ? { borderColor: `hsl(var(--esi${p.esi}))`, background: `hsl(var(--esi${p.esi}) / .12)` } : undefined}
                          data-testid={`mini-bed-${b.code}`}
                        >
                          <span>{b.code}</span>
                          {p?.esi ? <span className="h-1.5 w-5 rounded-full" style={{ background: `hsl(var(--esi${p.esi}))` }} /> : <span className={cn('h-1.5 w-1.5 rounded-full', BED_STATUS[b.status].dot)} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t text-[11px] text-muted-foreground">
            {Object.entries(BED_STATUS).map(([k, s]) => <span key={k} className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', s.dot)} />{s.label}</span>)}
          </div>
        </Panel>

        <Panel title="توزیع ESI + KPIهای زمانی">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.esi} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="esi" tickFormatter={x => `سطح ${num(x)}`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} reversed />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v: any) => [num(v), 'بیمار']} labelFormatter={l => `ESI ${num(l)}`} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, direction: 'rtl' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, fill: 'hsl(var(--foreground))', formatter: (v: any) => num(v) }}>
                  {m.esi.map(e => <Cell key={e.esi} fill={`hsl(var(--esi${e.esi}))`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="rounded-md bg-muted/60 py-2"><div className="text-[10px] text-muted-foreground">ورود تا تریاژ</div><div className="text-sm font-bold num">{durShort(data.today.doorToTriage.median)}</div></div>
            <div className="rounded-md bg-muted/60 py-2"><div className="text-[10px] text-muted-foreground">ورود تا پزشک</div><div className="text-sm font-bold num">{durShort(data.today.doorToDoctor.median)}</div></div>
            <div className="rounded-md bg-muted/60 py-2"><div className="text-[10px] text-muted-foreground">مدت اقامت</div><div className="text-sm font-bold num">{durShort(data.today.los.median)}</div></div>
          </div>
        </Panel>
      </div>

      <Panel
        title={
          <div className="flex items-center gap-1">
            {[
              { k: 'alerts' as QueueTab, l: `هشدارها (${num(m.alerts.length)})` },
              { k: 'queue'  as QueueTab, l: `صف انتظار (${num(queue.length)})` },
              { k: 'events' as QueueTab, l: 'رویدادها' },
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} className={cn('px-3 h-7 rounded-md text-xs', tab === t.k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                {t.l}
              </button>
            ))}
          </div>
        }
        bodyClass="p-0"
      >
        {tab === 'alerts' && (
          m.alerts.length === 0 ? <Empty icon={AlertTriangle} title="هشدار فعالی وجود ندارد" hint="بیماران NEWS2 ≥ ۵ اینجا نمایش داده می‌شوند" /> : (
            <ul className="divide-y max-h-[380px] overflow-y-auto overscroll-contain">
              {m.alerts.map(p => {
                const bed = data.beds.find(b => b.id === p.bedId);
                return (
                  <li key={p.id}>
                    <button className="w-full text-start px-4 py-3 hover-elevate flex gap-3" onClick={() => drawer.open(p.id)}>
                      <EsiBadge esi={p.esi} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium truncate">{p.name}</span><NewsBadge score={p.news} /></div>
                        <div className="text-[11px] text-muted-foreground mb-1">{bed ? `تخت ${bed.code}` : 'بدون تخت'} · {p.chiefComplaint}</div>
                        <VitalsInline v={p.vitals} compact />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {tab === 'queue' && (
          queue.length === 0 ? <Empty title="صف انتظار خالی است" /> : (
            <ul className="divide-y max-h-[380px] overflow-y-auto overscroll-contain">
              {queue.map(p => (
                <li key={p.id}>
                  <button className="w-full text-start px-4 py-3 hover-elevate flex items-center gap-3" onClick={() => drawer.open(p.id)}>
                    <EsiBadge esi={p.esi} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{p.chiefComplaint}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1"><StatusPill status={p.status} /><WaitClock p={p} now={now} /></div>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'events' && (
          <ol className="divide-y max-h-[380px] overflow-y-auto overscroll-contain">
            {data.events.slice(0, 40).map(e => (
              <li key={e.id} className="px-4 py-2.5 flex gap-3 text-xs">
                <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', e.level === 'critical' ? 'bg-[hsl(var(--esi1))]' : e.level === 'warn' ? 'bg-[hsl(var(--esi2))]' : 'bg-primary/60')} />
                <div className="min-w-0 flex-1">
                  <div className={cn('leading-relaxed', e.level === 'critical' && 'font-semibold text-[hsl(var(--esi1))]')}>{e.message}</div>
                  <div className="text-[10px] text-muted-foreground num mt-0.5">{fTime(e.createdAt)} · {ago(e.createdAt, now)}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid xl:grid-cols-3 gap-4"><Skeleton className="h-72 xl:col-span-2" /><Skeleton className="h-72" /></div>
    </div>
  );
}
