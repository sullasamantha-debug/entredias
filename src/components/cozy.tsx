import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title, subtitle, icon: Icon, action,
}: { title: string; subtitle?: string; icon?: LucideIcon; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div>
          <h1 className="font-display text-3xl text-foreground md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </motion.div>
  );
}

export function StatCard({
  label, value, icon: Icon, hint, tint = "primary",
}: {
  label: string; value: React.ReactNode; icon?: LucideIcon; hint?: string;
  tint?: "primary" | "blush" | "mint" | "sand";
}) {
  const bg = {
    primary: "bg-primary/15 text-primary",
    blush: "bg-blush/40 text-blush-foreground",
    mint: "bg-mint/40 text-foreground",
    sand: "bg-sand/60 text-foreground",
  }[tint];
  return (
    <motion.div whileHover={{ y: -2 }} className="cozy-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && <div className={`grid h-9 w-9 place-items-center rounded-xl ${bg}`}><Icon className="h-4 w-4" /></div>}
      </div>
      <div className="mt-3 font-display text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </motion.div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="cozy-card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary text-2xl">✿</div>
      <div className="font-display text-xl">{title}</div>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
