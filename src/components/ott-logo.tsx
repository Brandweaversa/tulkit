// OTT Voucher logo chip. The source PNG has a white background, so it is
// always rendered on a white rounded chip with a subtle ring — it blends
// cleanly on light and dark surfaces alike.

export function OttLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return (
    <span className="inline-flex items-center justify-center rounded-md bg-white px-2.5 py-1.5 ring-1 ring-black/10 shrink-0">
      <img src="/ott-voucher-logo.png" alt="OTT Voucher" className={className} />
    </span>
  );
}
