type StatCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  accent?: "purple" | "red";
};

export default function StatCard({
  label,
  value,
  helper,
  accent = "purple",
}: StatCardProps) {
  return (
    <div className="panel rounded-[28px] p-5">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p
        className={`mt-3 font-heading text-3xl ${
          accent === "purple" ? "text-[#6b00ff]" : "text-[#ff1e1e]"
        }`}
      >
        {value}
      </p>
      {helper && <p className="mt-2 text-sm text-slate-600">{helper}</p>}
    </div>
  );
}
