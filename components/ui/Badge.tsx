type BadgeProps = {
  children: React.ReactNode;
  tone?: "purple" | "red" | "green" | "slate";
};

const styles = {
  purple: "bg-[#f2e9ff] text-[#6b00ff]",
  red: "bg-[#fff0f0] text-[#cf1a1a]",
  green: "bg-[#eafbf0] text-[#0f8a48]",
  slate: "bg-[#f3f4f8] text-slate-700",
};

export default function Badge({ children, tone = "slate" }: BadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${styles[tone]}`}
    >
      {children}
    </span>
  );
}
