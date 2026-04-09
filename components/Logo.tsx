import Image from "next/image";

export default function Logo({ size = 40 }: { size?: number }) {
  const width = Math.round((size * 612) / 408);

  return (
    <div className="flex items-center gap-2">
      <Image
        src="/logo.svg"
        alt="RubyLMS Logo"
        width={width}
        height={size}
        style={{ height: "auto" }}
        priority
      />
      <span className="font-heading text-lg text-slate-950">RubyLMS</span>
    </div>
  );
}
