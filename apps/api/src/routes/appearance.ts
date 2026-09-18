import { Router } from "express";
import multer from "multer";
import type { MenuTemplateId } from "@cardapio/shared";
import { prisma } from "../db.js";
import { requireOwnRestaurant, requireRole, requireStaff } from "../lib/auth.js";
import { serializeAppearanceState, serializePublicAppearance } from "../lib/serialize.js";
import { uploadPublicFile } from "../lib/storage.js";

export const appearanceRouter = Router();
const staffGuard = [requireStaff, requireOwnRestaurant, requireRole("owner", "manager")];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const TEMPLATES: MenuTemplateId[] = ["classico", "moderno", "minimalista", "vibrante", "editorial", "galeria"];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_COVER_PHOTOS = 6;
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const COVER_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;

async function requireRestaurant(id: string) {
  return prisma.restaurant.findUnique({ where: { id } });
}

appearanceRouter.get("/:id/appearance/draft", ...staffGuard, async (req, res) => {
  const r = await requireRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(serializeAppearanceState(r));
});

appearanceRouter.patch("/:id/appearance/draft", ...staffGuard, async (req, res) => {
  const existing = await requireRestaurant(req.params.id);
  if (!existing) return res.status(404).json({ error: "restaurant not found" });
  const body = req.body as { template?: string; brandColor?: string; logoUrl?: string | null; coverPhotos?: string[] };

  if (body.template !== undefined && !TEMPLATES.includes(body.template as MenuTemplateId)) {
    return res.status(400).json({ error: `template must be one of ${TEMPLATES.join(", ")}` });
  }
  if (body.brandColor !== undefined && !HEX_RE.test(body.brandColor)) {
    return res.status(400).json({ error: "brandColor must be a #rrggbb hex color" });
  }
  if (body.coverPhotos !== undefined && (!Array.isArray(body.coverPhotos) || body.coverPhotos.length > MAX_COVER_PHOTOS)) {
    return res.status(400).json({ error: `coverPhotos must be an array of at most ${MAX_COVER_PHOTOS} URLs` });
  }

  const r = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: {
      ...(body.template !== undefined ? { draftTemplate: body.template } : {}),
      ...(body.brandColor !== undefined ? { draftBrandColor: body.brandColor } : {}),
      ...(body.logoUrl !== undefined ? { draftLogoUrl: body.logoUrl } : {}),
      ...(body.coverPhotos !== undefined ? { draftCoverPhotosJson: JSON.stringify(body.coverPhotos) } : {})
    }
  });
  res.json(serializeAppearanceState(r));
});

appearanceRouter.post("/:id/appearance/publish", ...staffGuard, async (req, res) => {
  const existing = await requireRestaurant(req.params.id);
  if (!existing) return res.status(404).json({ error: "restaurant not found" });
  const r = await prisma.restaurant.update({
    where: { id: req.params.id },
    data: {
      template: existing.draftTemplate,
      brandColor: existing.draftBrandColor,
      appearanceLogoUrl: existing.draftLogoUrl,
      coverPhotosJson: existing.draftCoverPhotosJson,
      appearancePublishedAt: new Date()
    }
  });
  res.json(serializeAppearanceState(r));
});

appearanceRouter.post("/:id/appearance/upload", ...staffGuard, upload.single("file"), async (req, res) => {
  const existing = await requireRestaurant(req.params.id);
  if (!existing) return res.status(404).json({ error: "restaurant not found" });
  const kind = req.body.kind as string;
  if (kind !== "logo" && kind !== "cover") return res.status(400).json({ error: "kind must be 'logo' or 'cover'" });
  if (!req.file) return res.status(400).json({ error: "file is required" });

  const types = kind === "logo" ? LOGO_TYPES : COVER_TYPES;
  const extension = types[req.file.mimetype];
  if (!extension) return res.status(400).json({ error: `unsupported file type for ${kind}: ${req.file.mimetype}` });
  const maxBytes = kind === "logo" ? MAX_LOGO_BYTES : MAX_COVER_BYTES;
  if (req.file.size > maxBytes) return res.status(400).json({ error: `file too large — limit is ${Math.round(maxBytes / 1024 / 1024)} MB` });

  if (kind === "cover") {
    const current = JSON.parse(existing.draftCoverPhotosJson) as string[];
    if (current.length >= MAX_COVER_PHOTOS) return res.status(400).json({ error: `at most ${MAX_COVER_PHOTOS} cover photos` });
  }

  let url: string;
  try {
    url = await uploadPublicFile({ buffer: req.file.buffer, contentType: req.file.mimetype, folder: `restaurants/${req.params.id}/appearance`, extension });
  } catch (err) {
    console.error(err);
    return res.status(503).json({ error: "storage is not configured" });
  }

  const r =
    kind === "logo"
      ? await prisma.restaurant.update({ where: { id: req.params.id }, data: { draftLogoUrl: url } })
      : await prisma.restaurant.update({
          where: { id: req.params.id },
          data: { draftCoverPhotosJson: JSON.stringify([...(JSON.parse(existing.draftCoverPhotosJson) as string[]), url]) }
        });

  res.status(201).json({ url, ...serializeAppearanceState(r) });
});

// Public — no auth. The customer menu (QR, tablet, delivery) reads the published skin from here.
appearanceRouter.get("/:id/appearance", async (req, res) => {
  const r = await requireRestaurant(req.params.id);
  if (!r) return res.status(404).json({ error: "restaurant not found" });
  res.json(serializePublicAppearance(r));
});
