import { useEffect, useRef } from "react";
import { LoaderCircle, Send } from "lucide-react";

/*
  Shared chat input used by the TPO copilot, the TPO ticket reply box and the
  student support chat. Auto-grows with content, sends on Enter, and keeps a
  newline on Shift+Enter.
*/
const TONES = {
  brand: { send: "bg-brand-600 hover:bg-brand-700", field: "focus-within:border-brand-300" },
  violet: { send: "bg-indigo-600 hover:bg-indigo-700", field: "focus-within:border-indigo-300" },
};

export default function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  busy = false,
  placeholder,
  label,
  sendLabel = "Send message",
  maxLength = 4000,
  tone = "brand",
  inputRef: externalRef,
}) {
  const localRef = useRef(null);
  const textareaRef = externalRef || localRef;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value, textareaRef]);

  const canSend = Boolean(value.trim()) && !disabled && !busy;
  const accent = TONES[tone] || TONES.brand;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit(e);
      }}
      className="shrink-0 border-t border-line bg-white p-3 sm:p-4"
    >
      <div
        className={`flex items-end gap-2 rounded-2xl border border-line bg-surface-muted p-1.5 pl-3 transition focus-within:bg-white focus-within:shadow-[var(--cf-focus-ring)] ${accent.field}`}
      >
        <textarea
          ref={textareaRef}
          aria-label={label}
          rows={1}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSubmit(e);
            }
          }}
          placeholder={placeholder}
          className="max-h-[180px] min-h-10 flex-1 resize-none bg-transparent py-2 text-sm leading-6 text-slate-800 outline-none focus-visible:shadow-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={sendLabel}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition active:scale-95 disabled:bg-slate-300 disabled:shadow-none ${accent.send}`}
        >
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10px] font-medium text-slate-400">
        <span className="hidden sm:inline">
          <kbd className="font-sans font-bold text-slate-500">Enter</kbd> to send ·{" "}
          <kbd className="font-sans font-bold text-slate-500">Shift + Enter</kbd> for a new line
        </span>
        <span className={`ml-auto tabular-nums ${value.length > maxLength * 0.9 ? "text-amber-600" : ""}`}>
          {value.length}/{maxLength}
        </span>
      </div>
    </form>
  );
}

/** Animated "assistant is working" indicator. */
export function TypingIndicator({ label }) {
  return (
    <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-500" role="status">
      <span className="flex items-center gap-1 text-indigo-500" aria-hidden="true">
        <span className="cf-typing-dot" />
        <span className="cf-typing-dot" />
        <span className="cf-typing-dot" />
      </span>
      <span>{label}</span>
    </div>
  );
}
