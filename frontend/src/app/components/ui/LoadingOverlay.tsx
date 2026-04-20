import { LoadingSpinner } from "./LoadingSpinner";

type LoadingOverlayProps = {
  label?: string;
  className?: string;
  panelClassName?: string;
};

export function LoadingOverlay({
  label = "Loading...",
  className = "absolute inset-0 z-[140] bg-white/55 backdrop-blur-[2px] flex items-center justify-center p-4",
  panelClassName = "flex items-center gap-3 rounded-2xl border border-[#C4E8FF] bg-white/95 px-5 py-3 text-sm font-black text-[#1D3663] shadow-[0_18px_40px_rgba(29,54,99,0.12)]",
}: LoadingOverlayProps) {
  return (
    <div className={className}>
      <div className={panelClassName}>
        <LoadingSpinner className="h-5 w-5 text-[#F3796A]" />
        <span>{label}</span>
      </div>
    </div>
  );
}
