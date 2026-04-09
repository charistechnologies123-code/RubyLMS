import { normalizeImageInput } from "@/lib/media";

export function normalizeAvatarInput(value?: string) {
  return normalizeImageInput(value, "Avatar");
}
