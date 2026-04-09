type PanelProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export default function Panel({ title, subtitle, children, className = "", id }: PanelProps) {
  return (
    <section id={id} className={`panel rounded-[28px] p-5 md:p-6 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4 space-y-1">
          {title && <h2 className="font-heading text-xl text-slate-950">{title}</h2>}
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
