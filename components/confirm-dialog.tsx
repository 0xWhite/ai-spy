"use client";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "neutral";
  isConfirming?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "取消",
  confirmVariant = "neutral",
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const confirmClasses =
    confirmVariant === "danger"
      ? "border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/22"
      : "border-blue-400/30 bg-blue-500/15 text-blue-100 hover:bg-blue-500/22";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div
        aria-describedby="confirm-dialog-description"
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="w-full max-w-md rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,_rgba(21,29,42,0.98),_rgba(13,19,31,0.99))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.55)]"
        role="dialog"
      >
        <div className="grid gap-3">
          <h2 className="text-2xl font-semibold text-white" id="confirm-dialog-title">
            {title}
          </h2>
          <p className="text-sm leading-6 text-slate-300" id="confirm-dialog-description">
            {description}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClasses}`}
            disabled={isConfirming}
            onClick={() => void onConfirm()}
            type="button"
          >
            {isConfirming ? "处理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
