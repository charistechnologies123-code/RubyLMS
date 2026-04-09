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
}: FormFieldProps) {
  const className =
    "mt-2 w-full rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]";

  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {as === "textarea" ? (
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
        />
      )}
    </label>
  );
}
