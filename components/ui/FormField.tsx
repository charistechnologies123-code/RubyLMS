import { useState } from "react";

type FormFieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
  as?: "input" | "textarea" | "select";
  rows?: number;
  options?: Array<{ label: string; value: string }>;
  disabled?: boolean;
  helperText?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
};

export default function FormField({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required,
  as = "input",
  rows = 4,
  options = [],
  disabled,
  helperText,
  min,
  max,
  step,
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const className =
    "mt-2 w-full rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]";

  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {type === "password" && as === "input" ? (
        <div className="relative mt-2">
          <input
            className={`${className} pr-20`}
            defaultValue={defaultValue}
            name={name}
            placeholder={placeholder}
            required={required}
            type={showPassword ? "text" : "password"}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
          />
          <button
            type="button"
            aria-pressed={showPassword}
            aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm font-semibold text-[#6b00ff] transition hover:bg-[#f5edff]"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      ) : as === "textarea" ? (
        <textarea
          className={className}
          defaultValue={defaultValue}
          name={name}
          placeholder={placeholder}
          required={required}
          rows={rows}
          disabled={disabled}
        />
      ) : as === "select" ? (
        <select
          className={className}
          defaultValue={defaultValue}
          name={name}
          required={required}
          disabled={disabled}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={className}
          defaultValue={defaultValue}
          name={name}
          placeholder={placeholder}
          required={required}
          type={type}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
        />
      )}
      {helperText ? <p className="mt-2 text-xs text-slate-500">{helperText}</p> : null}
    </label>
  );
}
