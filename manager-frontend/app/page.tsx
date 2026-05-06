"use client";
// AI-OPT: visual overhaul — solid #020617 base with ambient radial
//   blur decorations, glassmorphism surfaces (border-white/10 +
//   bg-white/[0.03] + backdrop-blur-md), blue-500/cyan-400 neon
//   accents, and a top-level framer-motion stagger container that
//   slide-fades each section in on mount
//   (model: claude-opus-4-7, date: 2026-05-06)
// AI-OPT: research-baseline ROI scaling — 50-person team yields
//   46.5M TL operasyonel + 4M hata + 3.1M onboarding tasarrufu,
//   5M yatırım, %973 ROI; per-person coefficients drive the slider
//   (model: claude-opus-4-7, date: 2026-05-06)
// AI-OPT: terminal advances on a timer for visual feedback but
//   short-circuits to the last step the moment the API resolves
//   (model: claude-opus-4-7, date: 2026-05-06)

import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  GitBranch,
  ImageIcon,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal as TerminalIcon,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const cn = (...args: ClassValue[]) => twMerge(clsx(args));

const API_URL =
  process.env.NEXT_PUBLIC_ANALYZE_URL ?? "http://localhost:8000/analyze-task";

const TL = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);
const NUM = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));

const RESEARCH = {
  baselineTeam: 50,
  manualHrs: 40,
  autoHrs: 6.7,
  efficiency: 0.83,
  opGain: 46_542_900,
  errorSaving: 4_000_000,
  onboardingSaving: 3_102_860,
  investment: 5_000_000,
  roiPct: 973,
};

// --- shared design tokens ---------------------------------------
const GLASS =
  "border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-[0_8px_30px_rgba(2,6,23,0.6)]";
const GLOW_CYAN = "shadow-[0_0_40px_-8px_rgba(34,211,238,0.55)]";
const GLOW_BLUE = "shadow-[0_0_30px_-6px_rgba(59,130,246,0.55)]";
const GLOW_EMERALD = "shadow-[0_0_24px_-6px_rgba(16,185,129,0.55)]";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

// --- types ------------------------------------------------------
type Task = { title: string; description: string };
type JiraIssue = {
  side: string;
  summary: string;
  key?: string | null;
  url?: string | null;
  error?: string | null;
};
type AnalyzeResponse = {
  frontend_tasks: Task[];
  backend_tasks: Task[];
  jira_issues: JiraIssue[];
};

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

const TERMINAL_STEPS = [
  { icon: Database, text: "RAG sorgulanıyor — code_embeddings tablosu açılıyor..." },
  { icon: BrainCircuit, text: "Kurumsal hafıza taranıyor — top-3 chunk seçiliyor..." },
  { icon: Sparkles, text: "Claude-Opus analiz ediyor — Frontend + Backend planı kuruluyor..." },
  { icon: GitBranch, text: "Jira senkronize ediliyor — issue'lar açılıyor..." },
];

// --- ambient background -----------------------------------------
function AmbientGlow() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-40 left-1/3 h-[420px] w-[420px] rounded-full bg-blue-500/20 blur-[140px]" />
      <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-cyan-400/15 blur-[140px]" />
      <div className="absolute bottom-0 -left-32 h-[380px] w-[380px] rounded-full bg-violet-600/15 blur-[140px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(2,6,23,0)_0%,_#020617_70%)]" />
    </div>
  );
}

// --- sidebar ----------------------------------------------------
function Sidebar() {
  const items = [
    { id: "dashboard", label: "Panel", icon: LayoutDashboard },
    { id: "roi", label: "ROI", icon: Calculator },
    { id: "market", label: "Pazar Etkisi", icon: TrendingUp },
  ];
  return (
    <motion.aside
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "hidden w-64 shrink-0 flex-col border-r border-white/10 bg-white/[0.02] px-4 py-6 backdrop-blur-md lg:flex",
        "fixed left-0 top-0 z-20 h-screen"
      )}
    >
      <div className="mb-10 flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-cyan-400 to-violet-500",
            GLOW_CYAN
          )}
        >
          <BrainCircuit className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Auto Tech Analyst</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">
            Plan Agent · v1
          </div>
        </div>
      </div>

      <nav className="space-y-1.5">
        {items.map((it) => (
          <a
            key={it.id}
            href={`#${it.id}`}
            className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] text-slate-400 transition group-hover:bg-cyan-400/15 group-hover:text-cyan-200">
              <it.icon className="h-4 w-4" />
            </span>
            {it.label}
            <ArrowRight className="ml-auto h-3.5 w-3.5 -translate-x-2 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
          </a>
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-8">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" /> KVKK / BDDK Uyumlu
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Yerel RAG altyapısı — kurumsal hafıza yurt dışına çıkmaz.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <Zap className="h-3.5 w-3.5" /> 50 kişilik ekip
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Haftalık ~1.000 saat atıl kapasite serbest kalır.
          </p>
        </div>
      </div>
    </motion.aside>
  );
}

// --- control center ---------------------------------------------
function ControlCenter(props: {
  prompt: string;
  setPrompt: (s: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
}) {
  const { prompt, setPrompt, file, setFile, loading, onSubmit, error } = props;
  return (
    <motion.section
      variants={itemVariants}
      id="dashboard"
      className={cn(
        "relative overflow-hidden rounded-3xl p-7",
        GLASS,
        GLOW_BLUE
      )}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
          <span className={cn("h-1.5 w-1.5 rounded-full bg-cyan-400", GLOW_CYAN)} />
          Yönetici Kontrol Merkezi
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Otonom Teknik Analiz · İstek Dispatch
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Talebi yazın, isteğe bağlı ekran görüntüsü ekleyin. RAG → Claude-Opus →
          Jira zinciri Frontend ve Backend görevlerini otomatik üretir.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]"
        >
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              <BookOpen className="h-3.5 w-3.5" /> Yönetici İsteği *
            </span>
            <textarea
              required
              rows={6}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Örn: Todo öğelerine öncelik (P1/P2) ekleyelim. Liste başında öncelik kullanıcıya görünmeli, filtre eklenmeli..."
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            />
          </label>

          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                <ImageIcon className="h-3.5 w-3.5" /> Ekran Görüntüsü (opsiyonel)
              </span>
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-4 transition hover:border-cyan-400/40">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-400/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-200 hover:file:bg-cyan-400/25"
                />
                {file && (
                  <div className="mt-2 truncate text-[11px] text-slate-500">
                    {file.name} · {(file.size / 1024).toFixed(0)} KB
                  </div>
                )}
              </div>
            </label>

            <motion.button
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className={cn(
                "group inline-flex items-center justify-center gap-2 rounded-2xl",
                "bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 bg-[length:200%_100%]",
                "px-5 py-3.5 text-sm font-semibold text-white",
                "ring-1 ring-cyan-400/40 transition-all",
                "hover:bg-[position:100%_0]",
                GLOW_CYAN,
                "hover:shadow-[0_0_60px_-4px_rgba(34,211,238,0.7)]",
                "disabled:opacity-60 disabled:hover:shadow-none"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analiz ediliyor…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Analizi Başlat
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              )}
            </motion.button>
          </div>
        </form>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300 backdrop-blur-md"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Analiz başarısız</div>
              <div className="text-xs text-red-200/80">{error}</div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}

// --- live terminal ----------------------------------------------
function LiveTerminal({
  active,
  completed,
  error,
}: {
  active: boolean;
  completed: boolean;
  error: string | null;
}) {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    if (!active) return;
    setStep(0);
    const ids: number[] = [];
    for (let i = 1; i < TERMINAL_STEPS.length; i++) {
      ids.push(window.setTimeout(() => setStep(i), i * 950));
    }
    return () => ids.forEach((id) => clearTimeout(id));
  }, [active]);

  useEffect(() => {
    if (completed) setStep(TERMINAL_STEPS.length - 1);
  }, [completed]);

  useEffect(() => {
    if (!active && !completed && !error) setStep(-1);
  }, [active, completed, error]);

  const status = error
    ? "hata"
    : completed
      ? "tamamlandı"
      : active
        ? "çalışıyor"
        : "bekleniyor";
  const statusGlow = error
    ? "bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.7)]"
    : completed
      ? "bg-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.7)]"
      : active
        ? "bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.7)] animate-pulse"
        : "bg-slate-600";

  return (
    <motion.section
      variants={itemVariants}
      className={cn("overflow-hidden rounded-3xl", GLASS)}
    >
      <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          <span className="ml-3 flex items-center gap-1.5 font-mono text-slate-400">
            <TerminalIcon className="h-3.5 w-3.5" />
            analyze-task · chain of thought
          </span>
        </div>
        <span className="flex items-center gap-2 font-mono text-xs text-slate-300">
          <span className={cn("h-2 w-2 rounded-full", statusGlow)} />
          {status}
        </span>
      </header>
      <div className="space-y-1.5 p-5 font-mono text-sm">
        {step < 0 && !error && (
          <div className="text-slate-500">
            <span className="text-cyan-400">$</span> analizi başlatmak için Kontrol
            Merkezi'nden bir istek gönderin.
          </div>
        )}
        <AnimatePresence>
          {TERMINAL_STEPS.map((s, i) => {
            if (i > step) return null;
            const isCurrent = i === step && active && !completed;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "flex items-center gap-2",
                  isCurrent ? "text-cyan-200" : "text-slate-300"
                )}
              >
                <span className="text-cyan-400">$</span>
                <s.icon
                  className={cn(
                    "h-3.5 w-3.5",
                    isCurrent ? "text-cyan-300" : "text-blue-400"
                  )}
                />
                <span className="flex-1">{s.text}</span>
                {isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 flex items-start gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-300"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">{error}</span>
          </motion.div>
        )}
        {completed && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-xs text-emerald-300"
          >
            ✓ analiz zinciri tamamlandı — sprint çıktısı aşağıda hazır.
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}

// --- task card --------------------------------------------------
function TaskCard({
  task,
  side,
  idx,
  jira,
}: {
  task: Task;
  side: "frontend" | "backend";
  idx: number;
  jira?: JiraIssue;
}) {
  const priority = idx === 0 ? "P1" : "P2";
  const synced = !!jira?.key;
  const syncFailed = !!jira?.error;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      whileHover={{ y: -3 }}
      className={cn(
        "rounded-2xl p-4 transition-shadow hover:shadow-[0_0_30px_-10px_rgba(34,211,238,0.4)]",
        GLASS
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider",
              side === "frontend"
                ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/30"
                : "bg-violet-400/15 text-violet-200 ring-1 ring-violet-400/30"
            )}
          >
            {side === "frontend" ? "FRONTEND" : "BACKEND"}
          </span>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-bold ring-1",
              priority === "P1"
                ? "bg-red-400/15 text-red-200 ring-red-400/30"
                : "bg-amber-400/15 text-amber-200 ring-amber-400/30"
            )}
          >
            {priority}
          </span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1",
            synced && cn("bg-emerald-400/15 text-emerald-200 ring-emerald-400/30", GLOW_EMERALD),
            syncFailed && "bg-red-400/15 text-red-200 ring-red-400/30",
            !synced && !syncFailed && "bg-slate-700/40 text-slate-400 ring-white/10"
          )}
        >
          {synced && (
            <>
              <CheckCircle2 className="h-3 w-3" /> Jira-Synced
            </>
          )}
          {syncFailed && (
            <>
              <AlertTriangle className="h-3 w-3" /> Jira hatası
            </>
          )}
          {!synced && !syncFailed && (
            <>
              <Clock className="h-3 w-3" /> Beklemede
            </>
          )}
        </span>
      </div>

      <h4 className="mt-3 text-sm font-semibold leading-snug text-white">
        {task.title}
      </h4>

      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
        {task.description}
      </pre>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        {synced && jira?.url ? (
          <a
            href={jira.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
          >
            {jira.key}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : syncFailed ? (
          <span className="truncate text-red-300/80">{jira?.error}</span>
        ) : (
          <span className="text-slate-500">Jira senkronizasyonu bekleniyor…</span>
        )}
        <span className="text-slate-600">#{idx + 1}</span>
      </div>
    </motion.article>
  );
}

// --- sprint board -----------------------------------------------
function SprintBoard({ result }: { result: AnalyzeResponse | null }) {
  const fe = result?.frontend_tasks ?? [];
  const be = result?.backend_tasks ?? [];
  const jiraFor = (side: string, idx: number): JiraIssue | undefined => {
    if (!result) return undefined;
    return result.jira_issues.filter((j) => j.side === side)[idx];
  };

  const totalSynced = result
    ? result.jira_issues.filter((j) => j.key).length
    : 0;

  return (
    <motion.section variants={itemVariants} className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-300">
            <ListChecks className="h-3.5 w-3.5" /> Sprint Çıktısı
          </div>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Frontend & Backend Görev Panosu
          </h2>
        </div>
        {result && (
          <div
            className={cn(
              "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200",
              GLOW_EMERALD
            )}
          >
            {totalSynced}/{result.jira_issues.length} Jira-Synced
          </div>
        )}
      </header>

      {!result ? (
        <div
          className={cn(
            "rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-slate-500 backdrop-blur-md"
          )}
        >
          Henüz analiz yapılmadı. Yukarıdan "Analizi Başlat" deyince çıktılar
          buraya gelecek.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-300">
              <span
                className={cn("h-2 w-2 rounded-full bg-cyan-400", GLOW_CYAN)}
              />
              Frontend · {fe.length}
            </div>
            {fe.length === 0 && (
              <div className={cn("rounded-2xl p-4 text-xs text-slate-500", GLASS)}>
                Frontend görevi üretilmedi.
              </div>
            )}
            {fe.map((t, i) => (
              <TaskCard
                key={`fe-${i}`}
                task={t}
                side="frontend"
                idx={i}
                jira={jiraFor("frontend", i)}
              />
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-300">
              <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.7)]" />
              Backend · {be.length}
            </div>
            {be.length === 0 && (
              <div className={cn("rounded-2xl p-4 text-xs text-slate-500", GLASS)}>
                Backend görevi üretilmedi.
              </div>
            )}
            {be.map((t, i) => (
              <TaskCard
                key={`be-${i}`}
                task={t}
                side="backend"
                idx={i}
                jira={jiraFor("backend", i)}
              />
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

// --- ROI calculator ---------------------------------------------
function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: "blue" | "cyan" | "emerald" | "amber";
}) {
  const ring: Record<string, string> = {
    blue: "ring-blue-400/25 from-blue-500/15",
    cyan: "ring-cyan-400/25 from-cyan-500/15",
    emerald: "ring-emerald-400/25 from-emerald-500/15",
    amber: "ring-amber-400/25 from-amber-500/15",
  };
  return (
    <div
      className={cn(
        "rounded-2xl bg-gradient-to-br to-transparent p-4 ring-1 ring-inset backdrop-blur-md",
        ring[accent]
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-300">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function ROICalculator() {
  const [team, setTeam] = useState(RESEARCH.baselineTeam);
  const ratio = team / RESEARCH.baselineTeam;

  const opGain = RESEARCH.opGain * ratio;
  const errSave = RESEARCH.errorSaving * ratio;
  const onbSave = RESEARCH.onboardingSaving * ratio;
  const total = opGain + errSave + onbSave;
  const invest = RESEARCH.investment * ratio;
  const net = total - invest;
  const roiPct = (net / invest) * 100;
  const weeklyHoursSaved = (RESEARCH.manualHrs - RESEARCH.autoHrs) * team;

  return (
    <motion.section
      variants={itemVariants}
      id="roi"
      className={cn("rounded-3xl p-6", GLASS)}
    >
      <header className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
            <Calculator className="h-3.5 w-3.5" /> ROI Hesaplayıcı
          </div>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Yıllık Yatırım Getirisi · 2026 Projeksiyonu
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Manuel analiz haftada{" "}
            <span className="font-semibold text-white">
              {RESEARCH.manualHrs} saat
            </span>{" "}
            sürerken sistem bunu{" "}
            <span className="font-semibold text-white">
              {RESEARCH.autoHrs} saate
            </span>{" "}
            indiriyor (≈%{Math.round(RESEARCH.efficiency * 100)} verimlilik artışı).
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200 backdrop-blur-md",
            GLOW_EMERALD
          )}
        >
          Kaynak: Yerel Pazar Raporu
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div
          className={cn(
            "space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md"
          )}
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            <Users className="h-3.5 w-3.5" /> Ekip Büyüklüğü
          </div>
          <div className="text-4xl font-semibold text-white">
            {team}{" "}
            <span className="text-base font-normal text-slate-400">kişi</span>
          </div>
          <input
            type="range"
            min={5}
            max={300}
            step={5}
            value={team}
            onChange={(e) => setTeam(Number(e.target.value))}
            className="w-full accent-cyan-400"
            aria-label="Ekip büyüklüğü"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>5</span>
            <span>50</span>
            <span>150</span>
            <span>300</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-300">
              <TrendingUp className="h-3.5 w-3.5" /> Haftalık serbest kalan
              kapasite
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {NUM(weeklyHoursSaved)} saat
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Yıllık Operasyonel Kazanç"
            value={TL(opGain)}
            hint="Analiz, dokümantasyon, toplantı tasarrufu"
            accent="blue"
          />
          <StatCard
            label="Hata Maliyeti Tasarrufu"
            value={TL(errSave)}
            hint="Üretim ortamına kaçan bug'ların önlenmesi"
            accent="amber"
          />
          <StatCard
            label="Onboarding Tasarrufu"
            value={TL(onbSave)}
            hint="Yeni mühendis adaptasyon süresi düşüşü"
            accent="cyan"
          />
          <StatCard
            label="Toplam Brüt Değer"
            value={TL(total)}
            hint={`Yatırım: ${TL(invest)}`}
            accent="emerald"
          />
          <div
            className={cn(
              "col-span-2 rounded-2xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-blue-500/15 p-5 backdrop-blur-md",
              GLOW_EMERALD
            )}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.25em] text-emerald-200">
                  Yıllık ROI
                </div>
                <div className="mt-1 text-4xl font-semibold text-white">
                  %{NUM(roiPct)}
                </div>
                <div className="text-xs text-slate-300">
                  1 ₺ yatırıma{" "}
                  <span className="font-semibold text-emerald-300">
                    ₺{(roiPct / 100 + 1).toFixed(1)}
                  </span>{" "}
                  geri dönüş
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                  Net Kazanç
                </div>
                <div className="mt-1 text-2xl font-semibold text-emerald-200">
                  {TL(net)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

// --- market impact ----------------------------------------------
const COST_TIERS = [
  { stage: "Gereksinim Analizi", mult: "1×", cost: "$30 – $50", tone: "emerald" },
  { stage: "Tasarım", mult: "3 – 8×", cost: "$90 – $400", tone: "cyan" },
  { stage: "Kodlama", mult: "6 – 10×", cost: "$180 – $500", tone: "blue" },
  { stage: "Test & Entegrasyon", mult: "21 – 78×", cost: "$630 – $3.900", tone: "amber" },
  { stage: "Üretim (Canlı)", mult: "100 – 1.500×", cost: "$3.000 – $75.000+", tone: "red" },
];

const TONE: Record<string, string> = {
  emerald: "border-emerald-400/30 text-emerald-200 bg-emerald-400/10",
  cyan: "border-cyan-400/30 text-cyan-200 bg-cyan-400/10",
  blue: "border-blue-400/30 text-blue-200 bg-blue-400/10",
  amber: "border-amber-400/30 text-amber-200 bg-amber-400/10",
  red: "border-red-400/40 text-red-200 bg-red-500/15",
};

function MarketImpact() {
  return (
    <motion.section
      variants={itemVariants}
      id="market"
      className="grid gap-4 lg:grid-cols-2"
    >
      <article className={cn("rounded-3xl p-6", GLASS)}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
          <Lock className="h-3.5 w-3.5" /> Yerel RAG · Stratejik Avantaj
        </div>
        <h3 className="mt-1 text-lg font-semibold text-white">
          KVKK / BDDK Uyumu — Küresel Araçlar vs. Yerel RAG
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          GitHub Copilot ve Jira AI gibi küresel araçlar kurumsal kodu yurt
          dışındaki bulutlarda işler. Türkiye'de bankacılık ve fintech
          regülasyonları bu modeli kabul etmez.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Özellik</th>
                <th className="px-3 py-2 font-medium">Küresel Araçlar</th>
                <th className="px-3 py-2 font-medium">Yerel RAG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-300">
              <tr>
                <td className="px-3 py-2">Veri Lokalizasyonu</td>
                <td className="px-3 py-2 text-red-300">Yurt Dışı Bulut</td>
                <td className="px-3 py-2 text-emerald-300">On-Premise</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Bağlam Derinliği</td>
                <td className="px-3 py-2 text-red-300">Sınırlı</td>
                <td className="px-3 py-2 text-emerald-300">
                  Tüm Kurumsal Hafıza
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Mevzuat Uyumu</td>
                <td className="px-3 py-2 text-red-300">KVKK Riski</td>
                <td className="px-3 py-2 text-emerald-300">%100 Uyumlu</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className={cn("rounded-3xl p-6", GLASS)}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" /> Cost of Quality
        </div>
        <h3 className="mt-1 text-lg font-semibold text-white">
          Üretimdeki bug, analizde yakalanandan{" "}
          <span className="text-red-300">1.500× daha pahalı</span>
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Bir bug'ın gereksinim aşamasında yakalanması, canlı ortama kaçtıktan
          sonra düzeltilmesine kıyasla 1.500 kata kadar daha düşük maliyetlidir.
          Otonom analiz, hatayı en ucuz aşamada öne çeker.
        </p>
        <ul className="mt-4 space-y-2">
          {COST_TIERS.map((t) => (
            <li
              key={t.stage}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm backdrop-blur-md"
            >
              <span className="font-medium text-slate-200">{t.stage}</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-bold",
                    TONE[t.tone]
                  )}
                >
                  {t.mult}
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {t.cost}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </motion.section>
  );
}

// --- main page --------------------------------------------------
export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) {
      setError("Yönetici isteği zorunlu.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const image_base64 = file ? await fileToBase64(file) : undefined;
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_prompt: prompt, image_base64 }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      setResult((await res.json()) as AnalyzeResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "İstek başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-200">
      <AmbientGlow />
      <div className="relative flex min-h-screen">
        <Sidebar />
        <motion.main
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="relative z-10 flex-1 space-y-8 p-6 lg:ml-64 lg:p-10"
        >
          <ControlCenter
            prompt={prompt}
            setPrompt={setPrompt}
            file={file}
            setFile={setFile}
            loading={loading}
            onSubmit={onSubmit}
            error={error}
          />
          <LiveTerminal active={loading} completed={!!result} error={error} />
          <SprintBoard result={result} />
          <ROICalculator />
          <MarketImpact />
          <motion.footer
            variants={itemVariants}
            className="pb-6 pt-4 text-center text-[11px] tracking-[0.2em] text-slate-600"
          >
            AUTO TECH ANALYST · YEREL RAG · PLAN AGENT v1 · 2026
          </motion.footer>
        </motion.main>
      </div>
    </div>
  );
}
