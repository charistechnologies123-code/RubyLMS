"use client";

import { useRouter } from "next/router";
import { useState } from "react";
import toast from "react-hot-toast";

type ApiFormProps = {
  action: string;
  method?: "POST" | "PATCH" | "DELETE";
  submitLabel: string;
  successMessage: string;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
};

export default function ApiForm({
  action,
  method = "POST",
  submitLabel,
  successMessage,
  children,
  className = "",
  resetOnSuccess = method === "POST",
  onSuccess,
}: ApiFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = event.currentTarget;

    const formData = new FormData(form);
    const payload = Array.from(formData.entries()).reduce<Record<string, FormDataEntryValue | FormDataEntryValue[]>>(
      (currentPayload, [key, value]) => {
        const existingValue = currentPayload[key];

        if (typeof existingValue === "undefined") {
          currentPayload[key] = value;
          return currentPayload;
        }

        if (Array.isArray(existingValue)) {
          existingValue.push(value);
          return currentPayload;
        }

        currentPayload[key] = [existingValue, value];
        return currentPayload;
      },
      {},
    );

    const response = await fetch(action, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    toast.success(successMessage);
    if (resetOnSuccess) {
      form.reset();
    }
    onSuccess?.();
    setSubmitting(false);
    router.replace(router.asPath);
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      {children}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8e42ff)] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
