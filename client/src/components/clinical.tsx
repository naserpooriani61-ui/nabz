import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  num, fTime, fDateTime, durShort, minsSince, ago, zoneLabel, PATIENT_STATUS, ESI_LABEL, ORDER_CAT, ORDER_STATUS,
  PRIORITY, ARRIVAL, DISPOSITIONS, ZONES,
} from "@/lib/fa";
import { useAction, useOverview, type PatientDetail, type LivePatient } from "@/lib/live";
import { newsRisk, ESI_TARGET_MIN, suggestEsi, isDangerZone, type Vitals, type Order, type Bed, type Staff } from "@shared/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BedDouble, Stethoscope, HeartPulse, ClipboardList, LogOut, UserCheck, AlertTriangle, Activity, Clock, Pill, FlaskConical,
  ScanLine, MessagesSquare, Syringe, Scissors, ExternalLink, Check, Play, X, FileText, History,
} from "lucide-react";

/* ---------------- badges ---------------- */

export function EsiBadge({ esi, size = "md", className }: { esi: number | null | undefined; size?: "sm" | "md" | "lg"; className?: string }) {
  if (!esi)
    return (
      <span className={cn("inline-flex items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground font-semibold", size === "sm" ? "h-5 px-1.5 text-[11px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-6 px-2 text-xs", className)} title="تریاژ نشده">
        ؟
      </span>
    );
  const dark = esi === 3;
  return (
    <span
      title={`ESI ${esi} — ${ESI_LABEL[esi]}`}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-bold num shrink-0",
        dark ? "text-[hsl(215_35%_12%)]" : "text-white",
        size === "sm" ? "h-5 min-w-5 px-1 text-[11px]" : size === "lg" ? "h-10 w-10 text-lg" : "h-6 min-w-6 px-1.5 text-xs",
        esi === 1 && "pulse-critical",
        className,
      )}
      style={{ background: `hsl(var(--esi${esi}))` }}
      data-testid={`badge-esi-${esi}`}
    >
      {num(esi)}
    </span>
  );
}

export function NewsBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const r = newsRisk(score);
  return (
    <span
      title="امتیاز هشدار زودهنگام NEWS2"
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 h-5 text-[11px] font-semibold num",
        r === "high" && "bg-[hsl(var(--esi1))] text-white",
        r === "medium" && "bg-[hsl(var(--esi2)/.15)] text-[hsl(var(--esi2))]",
        r === "low" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      NEWS {num(score)}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    waiting_triage: "bg-[hsl(var(--esi2)/.12)] text-[hsl(var(--esi2))]",
    waiting_bed: "bg-[hsl(var(--esi3)/.15)] text-[hsl(42_80%_32%)] dark:text-[hsl(var(--esi3))]",
    in_treatment: "bg-primary/10 text-primary",
    awaiting_disposition: "bg-[hsl(var(--esi5)/.12)] text-[hsl(var(--esi5))]",
    admitted: "bg-muted text-foreground",
    discharged: "bg-muted text-muted-foreground",
    transferred: "bg-muted text-muted-foreground",
    lwbs: "bg-destructive/10 text-destructive",
    deceased: "bg-foreground text-background",
  };
  return <span className={cn("inline-flex items-center rounded px-2 h-5 text-[11px] font-medium whitespace-nowrap", tone[status])}>{PATIENT_STATUS[status] ?? status}</span>;
}

export function PriorityPill({ p }: { p: string }) {
  const x = PRIORITY[p] ?? PRIORITY.routine;
  return <span className={cn("inline-flex items-center rounded px-1.5 h-5 text-[11px] font-bold", x.cls)}>{x.label}</span>;
}

export const CAT_ICON: Record<string, any> = { med: Pill, lab: FlaskConical, imaging: ScanLine, consult: MessagesSquare, nursing: Syringe, procedure: Scissors };

/* ---------------- vitals ---------------- */

function abn(k: keyof Vitals, v: any) {
  if (v == null) return false;
  switch (k) {
    case "hr": return v > 110 || v < 50;
    case "sbp": return v < 95 || v > 180;
    case "rr": return v > 24 || v < 10;
    case "spo2": return v < 93;
    case "temp": return v >= 38.3 || v < 35.5;
    case "gcs": return v < 15;
    default: return false;
  }
}

export function VitalsInline({ v, compact }: { v: Vitals | null | undefined; compact?: boolean }) {
  if (!v) return <span className="text-xs text-muted-foreground">علائم حیاتی ثبت نشده</span>;
  const items: [string, keyof Vitals, string][] = [
    ["HR", "hr", v.hr != null ? num(v.hr) : "—"],
    ["BP", "sbp", v.sbp != null ? (v.dbp != null ? `${num(v.sbp)}/${num(v.dbp)}` : num(v.sbp)) : "—"],
    ["RR", "rr", v.rr != null ? num(v.rr) : "—"],
    ["SpO₂", "spo2", v.spo2 != null ? `${num(v.spo2)}٪` : "—"],
    ["T", "temp", v.temp != null ? num(v.temp, 1) : "—"],
  ];
  if (!compact) items.push(["GCS", "gcs", v.gcs != null ? num(v.gcs) : "—"]);
  return (
    <div className={cn("flex flex-wrap gap-x-3 gap-y-0.5 num", compact ? "text-[11px]" : "text-xs")} dir="rtl">
      {items.map(([l, k, val]) => (
        <span key={l} className={cn("whitespace-nowrap", abn(k, (v as any)[k]) ? "text-[hsl(var(--esi1))] font-semibold" : "text-muted-foreground")}>
          <span className="opacity-70 font-mono text-[10px]">{l}</span> <span className={abn(k, (v as any)[k]) ? "" : "text-foreground"}>{val}</span>
        </span>
      ))}
    </div>
  );
}

/* ---------------- KPI & Panel ---------------- */

export function Kpi({ label, value, hint, tone, icon: Icon, testId }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "warn" | "ok"; icon?: any; testId?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1 min-w-0" data-testid={testId}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        {Icon && <Icon className="h-4 w-4 shrink-0 opacity-60" />}
      </div>
      <div className={cn("text-xl font-bold num leading-tight", tone === "danger" && "text-[hsl(var(--esi1))]", tone === "warn" && "text-[hsl(var(--esi2))]", tone === "ok" && "text-[hsl(var(--esi4))]")}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, bodyClass }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card flex flex-col min-w-0", className)}>
      <div className="flex items-center justify-between gap-2 px-4 h-11 border-b shrink-0">
        <h2 className="text-sm font-semibold truncate">{title}</h2>
        {action}
      </div>
      <div className={cn("p-4 min-h-0", bodyClass)}>{children}</div>
    </section>
  );
}

export function Empty({ icon: Icon = ClipboardList, title, hint }: { icon?: any; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-2 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-40" />
      <div className="text-sm font-medium text-foreground/80">{title}</div>
      {hint && <div className="text-xs">{hint}</div>}
    </div>
  );
}

export function WaitClock({ p, now }: { p: { arrivedAt: number; seenAt: number | null; esi: number | null }; now: number }) {
  const m = minsSince(p.arrivedAt, now)!;
  const target = p.esi ? ESI_TARGET_MIN[p.esi] : 15;
  const late = !p.seenAt && m > Math.max(target, 5);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs num whitespace-nowrap", late ? "text-[hsl(var(--esi1))] font-semibold" : "text-muted-foreground")} title={late ? "زمان انتظار از هدف ESI گذشته" : "مدت حضور در اورژانس"}>
      <Clock className="h-3 w-3" />
      {durShort(m)}
    </span>
  );
}

/* ---------------- patient drawer context ---------------- */

const DrawerCtx = createContext<{ open: (id: number) => void }>({ open: () => {} });
export const usePatientDrawer = () => useContext(DrawerCtx);

export function PatientDrawerProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<number | null>(null);
  return (
    <DrawerCtx.Provider value={{ open: setId }}>
      {children}
      <Sheet open={id != null} onOpenChange={(o) => !o && setId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-xl p-0 overflow-y-auto overscroll-contain" dir="rtl">
          {id != null && <PatientPanel id={id} onClose={() => setId(null)} />}
        </SheetContent>
      </Sheet>
    </DrawerCtx.Provider>
  );
}

export function usePatientDetail(id: number | null) {
  return useQuery<PatientDetail>({ queryKey: ["/api/patients", String(id)], enabled: id != null, staleTime: 0 });
}

/* ---------------- THE SUPERHUMAN PATIENT PANEL ---------------- */

export function PatientPanel({ id, onClose, full }: { id: number; onClose?: () => void; full?: boolean }) {
  const { data, isLoading } = usePatientDetail(id);
  const ov = useOverview();
  const [dlg, setDlg] = useState<null | "vitals" | "bed" | "dispo" | "order" | "staff" | "triage">(null);
  const [tab, setTab] = useState<"orders" | "vitals" | "events">("orders");
  
  const seen = useAction("POST", "ویزیت پزشک ثبت شد");
  const ready = useAction("POST", "بیمار آماده تعیین تکلیف است");
  const ord = useAction("PATCH");
  
  if (isLoading || !data) return <div className="p-6 space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>;
  
  const { patient: p, vitals, orders, events, bed } = data;
  const active = ["waiting_triage", "waiting_bed", "in_treatment", "awaiting_disposition"].includes(p.status);
  const now = Date.now();
  const lastV = vitals[0];
  
  const isDanger = (val: number | null | undefined, min: number, max: number) => val != null && (val < min || val > max);

  return (
    <div className="flex flex-col bg-background min-h-full pb-10">
      
      {/* ─── 1. هدر بالینی فشرده (Superhuman Cockpit) ─── */}
      <div className={cn("p-5 border-b bg-gradient-to-b from-primary/10 to-transparent", !full && "pt-10")}>
        <SheetHeaderSafe full={full}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <EsiBadge esi={p.esi} size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <TitleSafe full={full} className="text-xl font-black">{p.name}</TitleSafe>
                  <StatusPill status={p.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-2 num items-center">
                  <span>{p.mrn}</span> <span>·</span>
                  <span>{num(p.age)} ساله</span> <span>·</span>
                  <span>{p.sex === "M" ? "مرد" : "زن"}</span> <span>·</span>
                  <span>{ARRIVAL[p.arrivalMode]}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="bg-primary/20 text-primary border border-primary/30 rounded-md px-2 py-1 text-xs font-bold whitespace-nowrap">
                {bed ? `${bed.code} · ${zoneLabel(bed.zone)}` : "بدون تخت"}
              </span>
              <NewsBadge score={data.news} className="text-sm px-2 py-0.5" />
            </div>
          </div>
        </SheetHeaderSafe>

        {/* مانیتور فشرده علائم حیاتی */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <div className="bg-card border rounded-lg p-2 flex flex-col items-center justify-center shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold mb-1">HR</span>
            <span className={cn("text-xl font-black num", isDanger(lastV?.hr, 50, 110) ? "text-destructive animate-pulse" : "text-emerald-500")}>
              {lastV?.hr ? num(lastV.hr) : "—"}
            </span>
            <span className="text-[9px] text-muted-foreground">bpm</span>
          </div>
          <div className="bg-card border rounded-lg p-2 flex flex-col items-center justify-center shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold mb-1">BP</span>
            <span className={cn("text-xl font-black num", isDanger(lastV?.sbp, 90, 160) ? "text-destructive" : "text-emerald-500")} dir="ltr">
              {lastV?.sbp ? `${num(lastV.sbp)}/${num(lastV.dbp)}` : "—"}
            </span>
            <span className="text-[9px] text-muted-foreground">mmHg</span>
          </div>
          <div className="bg-card border rounded-lg p-2 flex flex-col items-center justify-center shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold mb-1">SpO₂</span>
            <span className={cn("text-xl font-black num", isDanger(lastV?.spo2, 92, 100) ? "text-destructive animate-pulse" : "text-emerald-500")}>
              {lastV?.spo2 ? num(lastV.spo2) : "—"}<span className="text-xs">%</span>
            </span>
            <span className="text-[9px] text-muted-foreground">Oxygen</span>
          </div>
          <div className="bg-card border rounded-lg p-2 flex flex-col items-center justify-center shadow-sm">
            <span className="text-[10px] text-muted-foreground font-bold mb-1">Temp</span>
            <span className={cn("text-xl font-black num", isDanger(lastV?.temp, 36, 38) ? "text-warning" : "text-emerald-500")}>
              {lastV?.temp ? num(lastV.temp, 1) : "—"}<span className="text-xs">°</span>
            </span>
            <span className="text-[9px] text-muted-foreground">Celsius</span>
          </div>
        </div>

        {/* تشخیص و آلرژی */}
        <div className="mt-3 flex flex-col gap-1 text-sm bg-muted/30 rounded-lg p-2 border">
          <div className="flex items-start gap-1">
            <span className="text-muted-foreground text-xs whitespace-nowrap mt-0.5">تشخیص:</span>
            <span className="font-semibold text-xs">{p.chiefComplaint}</span>
          </div>
          {p.allergies && (
            <div className="flex items-center gap-1 text-destructive font-bold text-xs mt-1">
              <AlertTriangle className="h-3.5 w-3.5" /> حساسیت: {p.allergies}
            </div>
          )}
        </div>

        {/* دکمه‌های عملیات (راند و درمان) */}
        {active && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {p.status === "waiting_triage" && (
              <Button size="sm" className="w-full text-xs" onClick={() => setDlg("triage")}>
                <Activity className="h-3.5 w-3.5 me-1" />تریاژ
              </Button>
            )}
            <Button size="sm" variant={p.bedId ? "outline" : "default"} className="w-full text-xs" onClick={() => setDlg("bed")}>
              <BedDouble className="h-3.5 w-3.5 me-1" />{p.bedId ? "جابه‌جایی تخت" : "تخصیص تخت"}
            </Button>
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setDlg("order")}>
              <ClipboardList className="h-3.5 w-3.5 me-1" />دستور جدید
            </Button>
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setDlg("vitals")}>
              <HeartPulse className="h-3.5 w-3.5 me-1" />ثبت علائم
            </Button>
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setDlg("staff")}>
              <UserCheck className="h-3.5 w-3.5 me-1" />کادر درمان
            </Button>
            {!p.seenAt && (
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => seen.mutate({ url: `/api/patients/${p.id}/seen` })}>
                <Stethoscope className="h-3.5 w-3.5 me-1" />ثبت ویزیت
              </Button>
            )}
            {p.status === "in_treatment" && (
              <Button size="sm" variant="secondary" className="w-full text-xs" onClick={() => ready.mutate({ url: `/api/patients/${p.id}/ready` })}>
                آماده تعیین تکلیف
              </Button>
            )}
            <Button size="sm" variant="destructive" className={cn("w-full text-xs", !p.bedId && "col-span-2 sm:col-span-1")} onClick={() => setDlg("dispo")}>
              <LogOut className="h-3.5 w-3.5 me-1" />تعیین تکلیف
            </Button>
          </div>
        )}
        
        {!full && (
          <Link href={`/patients/${p.id}`} onClick={onClose} className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold">
            <ExternalLink className="h-3.5 w-3.5" /> پرونده کامل بالینی
          </Link>
        )}
      </div>

      {/* ─── 2. بخش تب‌بندی شده (تب‌ها جایگزین لیست طولانی شده‌اند) ─── */}
      <div className="px-5 mt-2">
        <div className="flex border-b">
          <button onClick={() => setTab("orders")} className={cn("px-4 py-2 text-sm font-semibold border-b-2", tab === "orders" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>
            <ClipboardList className="inline h-4 w-4 me-1" /> کاردکس ({num(orders.filter(o=>o.status !== 'done' && o.status !== 'cancelled').length)})
          </button>
          <button onClick={() => setTab("vitals")} className={cn("px-4 py-2 text-sm font-semibold border-b-2", tab === "vitals" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>
            <Activity className="inline h-4 w-4 me-1" /> سوابق ویتال
          </button>
          <button onClick={() => setTab("events")} className={cn("px-4 py-2 text-sm font-semibold border-b-2", tab === "events" ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>
            <History className="inline h-4 w-4 me-1" /> رویدادها
          </button>
        </div>

        <div className="py-4">
          {tab === "orders" && (
            <div className="bg-card rounded-lg border">
              {orders.length === 0 ? <div className="text-xs text-muted-foreground text-center py-6">دستوری ثبت نشده است.</div> : (
                <ul className="divide-y px-4">
                  {orders.map((o) => <OrderRow key={o.id} o={o} onAct={(s) => ord.mutate({ url: `/api/orders/${o.id}`, body: { status: s, handledBy: data.nurse ?? "پرستار شیفت" } })} />)}
                </ul>
              )}
            </div>
          )}

          {tab === "vitals" && (
            <div className="space-y-2">
              {vitals.length === 0 ? <div className="text-xs text-muted-foreground text-center py-6">داده‌ای ثبت نشده</div> : 
                vitals.map(v => (
                  <div key={v.id} className="bg-card border rounded-lg p-3 text-xs flex justify-between items-center">
                    <span className="text-muted-foreground">{fDateTime(v.recordedAt)}</span>
                    <VitalsInline v={v} compact />
                  </div>
                ))
              }
            </div>
          )}

          {tab === "events" && (
            <div className="bg-card border rounded-lg p-3">
              <ol className="space-y-3 text-xs">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-2 items-start">
                    <span className="text-muted-foreground num w-16 shrink-0 text-[10px] mt-0.5">{fTime(e.createdAt)}</span>
                    <span className={cn(e.level === "critical" && "text-[hsl(var(--esi1))] font-semibold", e.level === "warn" && "text-[hsl(var(--esi2))]")}>{e.message}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* ─── Dialogs (بدون تغییر، عملکرد اصلی) ─── */}
      <VitalsDialog open={dlg === "vitals"} onOpenChange={(o) => !o && setDlg(null)} patientId={p.id} defaultBy={data.nurse ?? ""} />
      <AssignBedDialog open={dlg === "bed"} onOpenChange={(o) => !o && setDlg(null)} patient={p} beds={ov.data?.beds ?? []} />
      <DispositionDialog open={dlg === "dispo"} onOpenChange={(o) => !o && setDlg(null)} patientId={p.id} name={p.name} onDone={onClose} />
      <StaffDialog open={dlg === "staff"} onOpenChange={(o) => !o && setDlg(null)} patient={p} staff={ov.data?.staff ?? []} />
      <TriageDialog open={dlg === "triage"} onOpenChange={(o) => !o && setDlg(null)} patient={p} staff={ov.data?.staff ?? []} />
      <Dialog open={dlg === "order"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>ثبت دستور برای {p.name}</DialogTitle><DialogDescription>دستور برای ایستگاه پرستاری ارسال می‌شود.</DialogDescription></DialogHeader>
          <OrderForm patientId={p.id} physician={data.physician} onDone={() => setDlg(null)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- helpers & dialogs ---------------- */

function SheetHeaderSafe({ full, children }: { full?: boolean; children: ReactNode }) {
  return full ? <div>{children}</div> : <SheetHeader className="text-start space-y-0">{children}<SheetDescription className="sr-only">جزئیات بیمار</SheetDescription></SheetHeader>;
}

function TitleSafe({ full, children, className }: { full?: boolean; children: ReactNode; className?: string }) {
  return full ? <h1 className={cn("text-xl font-bold", className)}>{children}</h1> : <SheetTitle className={cn("text-lg", className)}>{children}</SheetTitle>;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border px-2.5 py-1.5 min-w-0">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium truncate num">{value}</div>
    </div>
  );
}

export function OrderRow({ o, onAct, showPatient }: { o: Order; onAct?: (s: string) => void; showPatient?: ReactNode }) {
  const Icon = CAT_ICON[o.category] ?? ClipboardList;
  const open = o.status !== "done" && o.status !== "cancelled";
  return (
    <li className="py-2.5 flex items-start gap-3" data-testid={`row-order-${o.id}`}>
      <div className="mt-0.5 h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0"><Icon className="h-3.5 w-3.5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityPill p={o.priority} />
          <span className={cn("text-sm font-medium", o.status === "cancelled" && "line-through text-muted-foreground")}>{o.item}</span>
          {(o.dose || o.route || o.frequency) && <span className="text-xs text-muted-foreground num" dir="auto">{[o.dose, o.route, o.frequency].filter(Boolean).join(" · ")}</span>}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
          {showPatient}
          <span>{ORDER_CAT[o.category]}</span>
          <span>· {o.orderedBy}</span>
          <span className="num">· {fTime(o.createdAt)}</span>
          <span className={cn("font-medium", o.status === "pending" && "text-[hsl(var(--esi2))]", o.status === "done" && "text-[hsl(var(--esi4))]")}>· {ORDER_STATUS[o.status]}</span>
        </div>
        {o.note && <div className="text-xs mt-1">{o.note}</div>}
      </div>
      {open && onAct && (
        <div className="flex gap-1 shrink-0">
          {o.status === "pending" && <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onAct("acknowledged")}><Check className="h-3.5 w-3.5 me-1" />تأیید</Button>}
          {o.status === "acknowledged" && <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onAct("in_progress")}><Play className="h-3.5 w-3.5 me-1" />شروع</Button>}
          <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onAct("done")}>اجرا شد</Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onAct("cancelled")}><X className="h-3.5 w-3.5" /></Button>
        </div>
      )}
    </li>
  );
}

type DlgProps = { open: boolean; onOpenChange: (o: boolean) => void };

export function VitalsFields({ v, set }: { v: Record<string, any>; set: (k: string, x: any) => void }) {
  const f: [string, string, string][] = [["hr", "ضربان قلب (HR)", "/min"], ["sbp", "فشار سیستولیک", "mmHg"], ["dbp", "فشار دیاستولیک", "mmHg"], ["rr", "تعداد تنفس (RR)", "/min"], ["spo2", "اشباع اکسیژن", "٪"], ["temp", "دمای بدن", "°C"], ["gcs", "GCS", "۳–۱۵"], ["pain", "شدت درد", "۰–۱۰"]];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {f.map(([k, l, u]) => (
        <div key={k} className="space-y-1">
          <Label className="text-xs">{l} <span className="text-muted-foreground">{u}</span></Label>
          <Input inputMode="decimal" dir="ltr" className="num text-left h-9" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
        </div>
      ))}
      <label className="col-span-2 sm:col-span-4 flex items-center gap-2 text-sm">
        <Switch checked={!!v.onOxygen} onCheckedChange={(x) => set("onOxygen", x)} /> بیمار اکسیژن مکمل دریافت می‌کند
      </label>
    </div>
  );
}

export const cleanVitals = (v: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === "onOxygen") out[k] = !!x;
    else if (x !== "" && x != null) out[k] = Number(String(x).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  }
  return out;
};

export function VitalsDialog({ open, onOpenChange, patientId, defaultBy }: DlgProps & { patientId: number; defaultBy?: string }) {
  const [v, setV] = useState<Record<string, any>>({});
  const [by, setBy] = useState(defaultBy ?? "");
  const m = useAction("POST", "علائم حیاتی ثبت شد");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader><DialogTitle>ثبت علائم حیاتی</DialogTitle></DialogHeader>
        <VitalsFields v={v} set={(k, x) => setV((s) => ({ ...s, [k]: x }))} />
        <div className="space-y-1"><Label className="text-xs">ثبت‌کننده</Label><Input value={by} onChange={(e) => setBy(e.target.value)} /></div>
        <DialogFooter>
          <Button disabled={m.isPending} onClick={() => m.mutate({ url: `/api/patients/${patientId}/vitals`, body: { ...cleanVitals(v), recordedBy: by || defaultBy } }, { onSuccess: () => { setV({}); onOpenChange(false); } })}>ثبت</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignBedDialog({ open, onOpenChange, patient, beds }: DlgProps & { patient: { id: number; name: string; esi: number | null; bedId: number | null }; beds: Bed[] }) {
  const m = useAction("POST", (r) => `${r.name} به تخت منتقل شد`);
  const suggested = patient.esi === 1 ? "cpr" : patient.esi === 2 ? "acute1" : patient.esi === 3 ? "acute2" : "fast";
  const avail = beds.filter((b) => b.status === "empty" || b.status === "reserved");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader><DialogTitle>تخصیص تخت — {patient.name}</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto overscroll-contain">
          {ZONES.map((z) => {
            const list = avail.filter((b) => b.zone === z.key);
            return (
              <div key={z.key}>
                <div className="text-xs font-semibold mb-2 flex items-center gap-2">{z.label}{z.key === suggested && <span className="text-[10px] rounded bg-primary/10 text-primary px-1.5">پیشنهادی</span>}</div>
                {list.length === 0 ? <div className="text-xs text-muted-foreground">تخت آزاد ندارد</div> : (
                  <div className="flex flex-wrap gap-2">
                    {list.map((b) => (
                      <Button key={b.id} size="sm" variant={z.key === suggested ? "default" : "outline"} className="font-mono" disabled={m.isPending}
                        onClick={() => m.mutate({ url: `/api/patients/${patient.id}/bed`, body: { bedId: b.id } }, { onSuccess: () => onOpenChange(false) })}>
                        {b.code}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DispositionDialog({ open, onOpenChange, patientId, name, onDone }: DlgProps & { patientId: number; name: string; onDone?: () => void }) {
  const [d, setD] = useState("discharged");
  const [note, setNote] = useState("");
  const m = useAction("POST", "تعیین تکلیف ثبت شد");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>تعیین تکلیف — {name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {DISPOSITIONS.map((x) => (
            <button key={x.key} onClick={() => setD(x.key)} className={cn("rounded-md border px-3 py-2 text-sm text-start", d === x.key ? "border-primary bg-primary/10 text-primary font-semibold" : "")}>{x.label}</button>
          ))}
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="توضیحات..." />
        <DialogFooter><Button disabled={m.isPending} onClick={() => m.mutate({ url: `/api/patients/${patientId}/disposition`, body: { disposition: d, note } }, { onSuccess: () => { onOpenChange(false); onDone?.(); } })}>ثبت نهایی</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StaffDialog({ open, onOpenChange, patient, staff }: DlgProps & { patient: { id: number; physicianId: number | null; nurseId: number | null }; staff: Staff[] }) {
  const [doc, setDoc] = useState(patient.physicianId ? String(patient.physicianId) : "");
  const [nur, setNur] = useState(patient.nurseId ? String(patient.nurseId) : "");
  const m = useAction("POST", "کادر درمان به‌روزرسانی شد");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>تخصیص کادر درمان</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">پزشک</Label>
            <Select value={doc} onValueChange={setDoc} dir="rtl"><SelectTrigger><SelectValue placeholder="انتخاب" /></SelectTrigger>
              <SelectContent>{staff.filter((s) => s.role !== "nurse").map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-xs">پرستار</Label>
            <Select value={nur} onValueChange={setNur} dir="rtl"><SelectTrigger><SelectValue placeholder="انتخاب" /></SelectTrigger>
              <SelectContent>{staff.filter((s) => s.role === "nurse").map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button disabled={m.isPending} onClick={() => m.mutate({ url: `/api/patients/${patient.id}/staff`, body: { physicianId: doc ? Number(doc) : null, nurseId: nur ? Number(nur) : null } }, { onSuccess: () => onOpenChange(false) })}>ذخیره</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TriageForm({ patient, staff, onDone }: { patient: { id: number; name: string; age: number; chiefComplaint: string }; staff: Staff[]; onDone?: () => void }) {
  const [a, setA] = useState({ lifesaving: false, highRisk: false, confusedOrPain: false, resources: 1 });
  const [v, setV] = useState<Record<string, any>>({});
  const [override, setOverride] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [nurse, setNurse] = useState("");
  const vv = cleanVitals(v);
  const danger = isDangerZone(vv as any, patient.age);
  const suggested = suggestEsi({ ...a, dangerVitals: danger });
  const esi = override ?? suggested;
  const m = useAction("POST", `تریاژ ثبت شد`);
  
  const Q = ({ k, q }: { k: "lifesaving" | "highRisk" | "confusedOrPain"; q: string }) => (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b last:border-0">
      <div className="text-sm font-medium">{q}</div>
      <div className="flex rounded-md border overflow-hidden shrink-0">
        {[true, false].map((x) => (
          <button key={String(x)} onClick={() => setA((s) => ({ ...s, [k]: x }))} className={cn("px-3 h-8 text-xs", a[k] === x ? (x ? "bg-[hsl(var(--esi1))] text-white" : "bg-primary text-primary-foreground") : "")}>{x ? "بله" : "خیر"}</button>
        ))}
      </div>
    </div>
  );
  
  return (
    <div className="space-y-5">
      <div className="rounded-md bg-muted/60 p-3 text-sm">{patient.chiefComplaint} · {num(patient.age)} ساله</div>
      <div>
        <Q k="lifesaving" q="الف) نیاز به اقدام فوری نجات‌بخش؟" />
        <Q k="highRisk" q="ب) وضعیت پرخطر؟" />
        <Q k="confusedOrPain" q="ب) گیجی یا درد شدید؟" />
        <div className="flex items-start justify-between gap-3 py-2.5">
          <div className="text-sm font-medium">ج) منابع مورد نیاز</div>
          <div className="flex rounded-md border overflow-hidden shrink-0">
            {[0, 1, 2].map((x) => (
              <button key={x} onClick={() => setA((s) => ({ ...s, resources: x }))} className={cn("px-3 h-8 text-xs num", a.resources === x ? "bg-primary text-primary-foreground" : "")}>{x === 2 ? "۲ یا بیشتر" : num(x)}</button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-2">د) علائم حیاتی</div>
        <VitalsFields v={v} set={(k, x) => setV((s) => ({ ...s, [k]: x }))} />
      </div>
      <div className="rounded-lg border p-4 flex items-center gap-4">
        <EsiBadge esi={esi} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">سطح {num(esi)} — {ESI_LABEL[esi]}</div>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((x) => (
            <button key={x} onClick={() => setOverride(x === suggested ? null : x)} className={cn("h-7 w-7 rounded text-xs font-bold num border", esi === x ? "ring-2 ring-offset-1 ring-ring" : "opacity-60")} style={{ background: `hsl(var(--esi${x}))`, color: x === 3 ? "hsl(215 35% 12%)" : "white" }}>{num(x)}</button>
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={m.isPending} onClick={() => m.mutate({ url: `/api/patients/${patient.id}/triage`, body: { esi, triageNote: (override ? `تغییر دستی از سطح ${suggested}. ` : "") + note, vitals: Object.keys(vv).length > 1 ? vv : undefined, nurseId: nurse ? Number(nurse) : null } }, { onSuccess: () => onDone?.() })}>ثبت تریاژ با سطح {num(esi)}</Button>
    </div>
  );
}

export function TriageDialog({ open, onOpenChange, patient, staff }: DlgProps & { patient: { id: number; name: string; age: number; chiefComplaint: string }; staff: Staff[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto overscroll-contain" dir="rtl">
        <DialogHeader><DialogTitle>تریاژ — {patient.name}</DialogTitle></DialogHeader>
        {open && <TriageForm patient={patient} staff={staff} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function OrderForm({ patientId, physician, onDone, patients }: { patientId?: number; physician?: string | null; onDone?: () => void; patients?: LivePatient[] }) {
  const tpl = useQuery<Record<string, { item: string; dose?: string; route?: string; frequency?: string }[]>>({ queryKey: ["/api/templates"] });
  const ov = useOverview();
  const [pid, setPid] = useState(patientId ? String(patientId) : "");
  const [cat, setCat] = useState("med");
  const [f, setF] = useState({ item: "", dose: "", route: "", frequency: "", note: "" });
  const [prio, setPrio] = useState("routine");
  const [by, setBy] = useState(physician ?? "");
  const m = useAction("POST", "دستور ثبت شد");
  const docs = (ov.data?.staff ?? []).filter((s) => s.role !== "nurse");
  const set = (k: string, x: string) => setF((s) => ({ ...s, [k]: x }));
  
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(ORDER_CAT).map(([k, l]) => {
          const I = CAT_ICON[k];
          return <button key={k} onClick={() => { setCat(k); setF({ item: "", dose: "", route: "", frequency: "", note: f.note }); }} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-xs", cat === k ? "border-primary bg-primary/10 text-primary font-semibold" : "")}><I className="h-3.5 w-3.5" />{l}</button>;
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(tpl.data?.[cat] ?? []).map((t) => (
          <button key={t.item} onClick={() => setF((s) => ({ ...s, item: t.item, dose: t.dose ?? "", route: t.route ?? "", frequency: t.frequency ?? "" }))} className={cn("rounded-full border px-2.5 h-7 text-xs", f.item === t.item ? "bg-foreground text-background" : "")}>{t.item}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2"><Label className="text-xs">عنوان دستور</Label><Input value={f.item} onChange={(e) => set("item", e.target.value)} placeholder="نام دارو یا اقدام" /></div>
        <div className="space-y-1"><Label className="text-xs">دوز</Label><Input dir="ltr" className="text-left" value={f.dose} onChange={(e) => set("dose", e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">مسیر</Label>
          <Select value={f.route || undefined} onValueChange={(x) => set("route", x)} dir="rtl"><SelectTrigger><SelectValue placeholder="انتخاب" /></SelectTrigger>
            <SelectContent>{["IV", "IM", "PO", "SC", "SL", "INH", "PR"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">تکرار</Label><Input value={f.frequency} onChange={(e) => set("frequency", e.target.value)} placeholder="یک‌بار، هر ۶ ساعت" /></div>
        <div className="space-y-1"><Label className="text-xs">اولویت</Label>
          <div className="flex rounded-md border overflow-hidden h-9">
            {Object.entries(PRIORITY).map(([k, x]) => <button key={k} onClick={() => setPrio(k)} className={cn("flex-1 text-xs", prio === k ? (k === "stat" ? "bg-[hsl(var(--esi1))] text-white" : "bg-primary text-primary-foreground") : "")}>{x.label}</button>)}
          </div>
        </div>
        <div className="space-y-1 col-span-2"><Label className="text-xs">پزشک</Label>
          <Select value={by || undefined} onValueChange={setBy} dir="rtl"><SelectTrigger><SelectValue placeholder="انتخاب" /></SelectTrigger>
            <SelectContent>{docs.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1 col-span-2"><Label className="text-xs">توضیحات</Label><Textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></div>
      </div>
      <Button className="w-full" disabled={m.isPending || !f.item || !pid || !by} onClick={() => m.mutate({ url: "/api/orders", body: { patientId: Number(pid), category: cat, ...f, priority: prio, orderedBy: by } }, { onSuccess: () => { setF({ item: "", dose: "", route: "", frequency: "", note: "" }); onDone?.(); } })}>ثبت دستور</Button>
    </div>
  );
}
