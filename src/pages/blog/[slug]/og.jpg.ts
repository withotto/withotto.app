// Each blog post's Open Graph image: its hero cropped to 1200x630, the size
// link previews expect, with the With Otto logo on a navy panel in the bottom
// left corner. Most heroes are abstract and carry no branding of their own.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import sharp from "sharp";
import logoSvg from "@assets/logo-white.svg?raw";
import { getBlogSlug } from "@utils/blog";

const WIDTH = 1200;
const HEIGHT = 630;
// The navy behind the logo on the default Open Graph image.
const PANEL_COLOUR = "#170941";
const LOGO_WIDTH = 280;
const PANEL_PADDING_X = 28;
const PANEL_PADDING_Y = 22;
const PANEL_MARGIN = 40;

let logo: Promise<Buffer> | undefined;

function renderLogo(): Promise<Buffer> {
  logo ??= sharp(Buffer.from(logoSvg), { density: 300 })
    .resize({ width: LOGO_WIDTH })
    .png()
    .toBuffer();
  return logo;
}

export const getStaticPaths = (async () => {
  const blogEntries = await getCollection("blog");
  return blogEntries.map((entry) => ({
    params: { slug: getBlogSlug(entry) },
    props: { entry },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { entry } = props as Awaited<
    ReturnType<typeof getStaticPaths>
  >[number]["props"];
  // Astro gives every image asset a non-enumerable `fsPath` to its source
  // file. Fail the build if that ever goes, rather than ship a broken image.
  const heroPath = (entry.data.image as { fsPath?: string }).fsPath;
  if (!heroPath) {
    throw new Error(
      `No source path for the hero image of ${entry.id}, so its Open Graph image can't be built.`,
    );
  }

  const logoPng = await renderLogo();
  const { height: logoHeight = 0 } = await sharp(logoPng).metadata();
  const panelWidth = LOGO_WIDTH + PANEL_PADDING_X * 2;
  const panelHeight = logoHeight + PANEL_PADDING_Y * 2;
  const panelLeft = PANEL_MARGIN;
  const panelTop = HEIGHT - PANEL_MARGIN - panelHeight;
  const panel = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}" height="${panelHeight}"><rect width="100%" height="100%" rx="16" fill="${PANEL_COLOUR}"/></svg>`,
  );

  const image = await sharp(heroPath)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .composite([
      { input: panel, left: panelLeft, top: panelTop },
      {
        input: logoPng,
        left: panelLeft + PANEL_PADDING_X,
        top: panelTop + PANEL_PADDING_Y,
      },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/jpeg" },
  });
};
