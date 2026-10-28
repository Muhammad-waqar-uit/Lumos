import { create } from "zustand";

/**
 * The profile: what this person calls their vault, the line under the name, and the notes they
 * pinned to the top of it.
 *
 * It lives in `localStorage` rather than in the vault on purpose. The vault is Markdown that any
 * editor can read, and a `profile.json` in it would be a file every other tool has to learn to
 * ignore; this is a preference about the interface, so it stays with the interface. What is given
 * up: it does not travel with the notes to another machine.
 */

/** How many notes a profile may pin, matching the row the cards are laid out in. */
export const PIN_LIMIT = 6;

/** Longest profile fields accepted by the editor. */
export const NAME_MAX = 40;
export const BIO_MAX = 160;
export const USERNAME_MAX = 24;
export const README_MAX = 12_000;

/** Last-modified timestamp of the profile (ISO string). */
export const PROFILE_LAST_MODIFIED = "lumos.profile.lastModified";

export interface Profile {
  /** What the profile calls itself. Empty means "show the fallback", never a blank heading. */
  name: string;
  bio: string;
  /** A local display handle, not an account name or globally unique username. */
  username: string;
  /** Optional Markdown front page for this local profile. */
  readme: string;
  /** Vault ids (`Folder/name.md`), in the order they were pinned. */
  pins: string[];
  /** ISO timestamp of when the profile was last saved. */
  lastModified: string;
}

export const DEFAULT_PROFILE: Profile = {
  name: "",
  bio: "",
  username: "",
  readme: "",
  pins: [],
  lastModified: new Date().toISOString(),
};

const STORAGE_KEY = "lumos.profile.v1";

/** The browser's storage, or undefined where there is none (a test, a server render). */
function storage(): Storage | undefined {
  try {
    return typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;
  } catch {
    // A browser with storage disabled throws on the property itself; the profile then lives for
    // the session only rather than taking the app down on load.
    return undefined;
  }
}

/** A string field, trimmed and capped, or the fallback when the stored value is not a string. */
function text(value: unknown, max: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

/** Whatever was stored, as a profile.
 *
 * The value is untrusted - it was written by an older version of this app, or by hand - so every
 * field is checked and anything unusable falls back instead of throwing on load.
 */
export function parseProfile(raw: string | null): Profile {
  if (!raw) return DEFAULT_PROFILE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_PROFILE;
  }
  if (typeof data !== "object" || data === null) return DEFAULT_PROFILE;
  const record = data as Record<string, unknown>;
  const pins = Array.isArray(record.pins)
    ? [
        ...new Set(record.pins.filter((pin): pin is string => typeof pin === "string" && !!pin)),
      ].slice(0, PIN_LIMIT)
    : [];

  const lastModified =
    typeof record.lastModified === "string" ? record.lastModified : new Date().toISOString();

  return {
    name: text(record.name, NAME_MAX, ""),
    bio: text(record.bio, BIO_MAX, ""),
    username: normalizeUsername(record.username),
    readme: text(record.readme, README_MAX, ""),
    pins,
    lastModified,
  };
}

/** A readable local handle; it is not a globally registered username. */
export function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .slice(0, USERNAME_MAX)
    .replace(/-$/, "");
}

/** The letter the avatar shows: the first of the name, or the app's when there is none. */
export function profileInitial(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toUpperCase() : "L";
}

/** Pin a note, or unpin it when it is already pinned. Full is unchanged, not an error. */
export function withPin(profile: Profile, id: string): Profile {
  if (profile.pins.includes(id)) {
    return { ...profile, pins: profile.pins.filter((pin) => pin !== id) };
  }
  if (profile.pins.length >= PIN_LIMIT) return profile;
  return { ...profile, pins: [...profile.pins, id] };
}

interface ProfileState extends Profile {
  /** Saves the profile identity; fields are normalized here, not only by the form. */
  save: (name: string, bio: string, username?: string) => void;
  /** Saves the Markdown front page without changing the rest of the profile. */
  saveReadme: (readme: string) => void;
  /** Pins or unpins one note. */
  togglePin: (id: string) => void;
}

/** Read once at module load; every change writes back, so a reload keeps the profile. */
export function loadProfile(): Profile {
  try {
    return parseProfile(storage()?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_PROFILE;
  }
}

function persist(profile: Profile): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // A full or read-only store keeps the change for this session; losing it is not worth a
    // notice over the pane the person is editing.
  }
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  ...loadProfile(),

  save: (name, bio, username = get().username) => {
    const { readme, pins } = get();
    const next: Profile = {
      name: name.trim().slice(0, NAME_MAX),
      bio: bio.trim().slice(0, BIO_MAX),
      username: normalizeUsername(username),
      readme,
      pins,
      lastModified: new Date().toISOString(),
    };
    persist(next);
    set(next);
  },

  saveReadme: (readme) => {
    const { name, bio, username, pins } = get();
    const next: Profile = {
      name,
      bio,
      username,
      readme: readme.trim().slice(0, README_MAX),
      pins,
      lastModified: new Date().toISOString(),
    };
    persist(next);
    set(next);
  },

  togglePin: (id) => {
    const { name, bio, username, readme, pins, lastModified } = get();
    const next = withPin({ name, bio, username, readme, pins, lastModified }, id);
    // A full profile hands the same array back, so there is nothing to save or re-render.
    if (next.pins === pins) return;
    persist(next);
    set({ pins: next.pins });
  },
}));
