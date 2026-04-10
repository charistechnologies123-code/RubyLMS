const ALLOWED_IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i;
const ALLOWED_FILE_DATA_URL =
  /^data:(?:application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/plain|text\/csv|application\/csv|image\/(?:png|jpeg|jpg|webp|gif));base64,[a-z0-9+/=]+$/i;

function getYouTubeVideoId(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "music.youtube.com") {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/") || url.pathname.startsWith("/live/")) {
      return url.pathname.split("/").filter(Boolean)[1] ?? null;
    }
  }

  return null;
}

function getVimeoVideoId(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") {
    return null;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);

  if (!pathParts.length) {
    return null;
  }

  if (pathParts[0] === "video" && pathParts[1]) {
    return pathParts[1];
  }

  const numericPart = pathParts.find((part) => /^\d+$/.test(part));
  return numericPart ?? null;
}

export function toEmbeddableUrl(value: string) {
  const trimmedValue = value.trim();
  const parsedUrl = new URL(trimmedValue);

  if (!/^https?:$/i.test(parsedUrl.protocol)) {
    throw new Error("Embed URLs must use http or https.");
  }

  const youtubeVideoId = getYouTubeVideoId(parsedUrl);

  if (youtubeVideoId) {
    return `https://www.youtube.com/embed/${youtubeVideoId}`;
  }

  const vimeoVideoId = getVimeoVideoId(parsedUrl);

  if (vimeoVideoId) {
    return `https://player.vimeo.com/video/${vimeoVideoId}`;
  }

  return trimmedValue;
}

export function normalizeImageInput(value: string | undefined, fieldLabel: string) {
  if (typeof value === "undefined") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith("data:image/")) {
    if (!ALLOWED_IMAGE_DATA_URL.test(trimmedValue)) {
      throw new Error(`${fieldLabel} uploads must be PNG, JPG, WEBP, or GIF images.`);
    }

    return trimmedValue;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  throw new Error(`${fieldLabel} must be uploaded as an image or provided as an http(s) URL.`);
}

export function normalizeEmbedInput(value: string | undefined, fieldLabel: string) {
  if (typeof value === "undefined") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    return toEmbeddableUrl(trimmedValue);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `${fieldLabel}: ${error.message}`
        : `${fieldLabel} must be a valid http(s) URL.`,
    );
  }
}

export function normalizeFileInput(value: string | undefined, fieldLabel: string) {
  if (typeof value === "undefined") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith("data:")) {
    if (!ALLOWED_FILE_DATA_URL.test(trimmedValue)) {
      throw new Error(`${fieldLabel} must be a supported uploaded file.`);
    }

    return trimmedValue;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  throw new Error(`${fieldLabel} must be uploaded or provided as an http(s) URL.`);
}

export function readDataUrlText(value: string) {
  const match = value.match(/^data:[^;]+;base64,(.+)$/i);

  if (!match) {
    throw new Error("Invalid uploaded text file.");
  }

  return Buffer.from(match[1], "base64").toString("utf8");
}
