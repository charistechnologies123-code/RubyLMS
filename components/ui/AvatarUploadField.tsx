"use client";

import ImageUploadField from "./ImageUploadField";

type AvatarUploadFieldProps = {
  label: string;
  name: string;
  defaultValue?: string | null;
  helperText?: string;
};

export default function AvatarUploadField({
  label,
  name,
  defaultValue,
  helperText = "Upload PNG, JPG, WEBP, or GIF up to 750KB.",
}: AvatarUploadFieldProps) {
  return (
    <ImageUploadField
      label={label}
      name={name}
      defaultValue={defaultValue}
      helperText={helperText}
      emptyLabel="No avatar"
      maxFileSizeKb={750}
      previewClassName="h-20 w-20 rounded-[24px]"
    />
  );
}
