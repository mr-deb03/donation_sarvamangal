import { formatAmount } from "@/lib/format";

/** An amount with the ₹ sign in the system font (the main site's <Rupees>). */
export function Rupees({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={className}>
      <span className="rupee">₹</span>
      {formatAmount(amount)}
    </span>
  );
}
