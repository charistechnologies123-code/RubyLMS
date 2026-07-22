import { WEEKDAY_OPTIONS } from "@/lib/attendance";

type WeekdayCheckboxGroupProps = {
  label?: string;
  name: string;
  defaultValues?: string[];
  helperText?: string;
};

export default function WeekdayCheckboxGroup({
  label = "Attendance days per week",
  name,
  defaultValues = [],
  helperText = "Choose the weekday(s) this course normally meets on.",
}: WeekdayCheckboxGroupProps) {
  return (
    <label className="block md:col-span-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input type="hidden" name={name} value="" />
      <div className="mt-2 grid gap-2 rounded-[20px] border border-[#e8ddff] bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        {WEEKDAY_OPTIONS.map((day) => (
          <label key={day.value} className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" name={name} value={day.value} defaultChecked={defaultValues.includes(day.value)} />
            <span>{day.label}</span>
          </label>
        ))}
      </div>
      {helperText ? <p className="mt-2 text-xs text-slate-500">{helperText}</p> : null}
    </label>
  );
}
