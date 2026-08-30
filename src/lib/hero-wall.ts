import wallAvif from "../assets/tboi-wall.avif";
import wallLgAvif from "../assets/tboi-wall-lg.avif";
import wallWebp from "../assets/tboi-wall.webp";
import wallLgWebp from "../assets/tboi-wall-lg.webp";

export const HERO_WALL_AVIF_SRC = wallAvif.src;
export const HERO_WALL_AVIF_LG_SRC = wallLgAvif.src;
export const HERO_WALL_WEBP_SRC = wallWebp.src;
export const HERO_WALL_WEBP_LG_SRC = wallLgWebp.src;
export const HERO_WALL_AVIF_SRCSET = `${wallAvif.src} ${wallAvif.width}w, ${wallLgAvif.src} ${wallLgAvif.width}w`;
export const HERO_WALL_WEBP_SRCSET = `${wallWebp.src} ${wallWebp.width}w, ${wallLgWebp.src} ${wallLgWebp.width}w`;
