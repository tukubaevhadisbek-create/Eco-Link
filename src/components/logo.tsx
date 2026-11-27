import { cn } from "@/lib/utils";

/**
 * Логотип EcoLink: два листа образуют замкнутое кольцо (цикл вторсырья),
 * между ними — «звено» связи (две соединённые точки).
 */
export function LogoMark({ className, mono = false }: { className?: string; mono?: boolean }) {
  const a = mono ? "currentColor" : "#168B53";
  const b = mono ? "currentColor" : "#0B5D38";
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9", className)} role="img" aria-label="EcoLink" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 6C18.7 6 8 16.7 8 30c0 3.2.6 6.2 1.8 9L22 31c1-5.5 5.6-9.7 11.3-10.3L42 12.4A23.8 23.8 0 0 0 32 6Z" fill={a} />
      <path d="M56 34c0 13.3-10.7 24-24 24-3.4 0-6.6-.7-9.5-2l9-8.6c5.7-.6 10.3-4.8 11.3-10.3L56 29.8c0 1.4 0 2.8 0 4.2Z" fill={b} />
      <path d="M44 14.6A24 24 0 0 1 56 30l-8.4 1.3c-.9-3.8-3-7.1-5.8-9.5l2.2-7.2Z" fill={a} opacity=".55" />
      <path d="M20 49.4A24 24 0 0 1 8 34l8.4-1.3c.9 3.8 3 7.1 5.8 9.5l-2.2 7.2Z" fill={b} opacity=".55" />
      <circle cx="26.5" cy="32" r="4.2" fill="#fff" />
      <circle cx="37.5" cy="32" r="4.2" fill="#fff" />
      <rect x="26.5" y="30" width="11" height="4" rx="2" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9" />
      <span className={cn("text-xl font-extrabold tracking-tight", light ? "text-white" : "text-eco-700")}>
        Eco<span className={light ? "text-eco-200" : "text-eco-500"}>Link</span>
      </span>
    </span>
  );
}
