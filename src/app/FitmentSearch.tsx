"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { resolveBulbUrl } from "@/lib/bulbLinks";

/** ---------------- Types ---------------- */
type Mod = { model_type_name: string | null; body_type: string | null };

type PositionRow = {
  position_category: string | null;
  position: string;
};

type BulbsByTech = {
  halogen: string[];
  xenon: string[];
};

type LoadKey = "years" | "brands" | "models" | "mods" | "positions" | "bulbsByTech";
type LoadingMap = Record<LoadKey, boolean>;

type Option = { value: string; label: string };

/** ---------------- Config ---------------- */
const SUPPORT_PHONE = "+359 88 000 0000"; // TODO: смени с твоя реален номер
const SUPPORT_PHONE_TEL = "+359880000000"; // TODO: смени (само цифри)

/** ---------------- Top brands ---------------- */
const TOP_BRANDS_ORDER = [
  "MERCEDES",
  "BMW",
  "HYUNDAI",
  "TOYOTA",
  "VOLKSWAGEN",
  "AUDI",
  "OPEL",
  "FORD",
  "PEUGEOT",
  "RENAULT",
];

/** ---------------- Utils ---------------- */
const initialLoading: LoadingMap = {
  years: false,
  brands: false,
  models: false,
  mods: false,
  positions: false,
  bulbsByTech: false,
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

// ✅ FIX: generic hook => няма TypeScript error с RefObject<HTMLDivElement>
function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: () => void
) {
  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) handler();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [ref, handler]);
}

async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error("Request failed");
  return r.json();
}

function normPos(pos: string) {
  return pos.trim().toLowerCase();
}

function positionLabelBG(pos: string): string {
  const p = normPos(pos);
  if (p === "high beam") return "Дълги светлини";
  if (p === "low beam") return "Къси светлини";
  if (
    p === "fog lamps" ||
    p === "fog lamp" ||
    p === "fog light" ||
    p === "front fog light" ||
    p === "front fog lights"
  ) {
    return "Светлини за мъгла";
  }
  return pos;
}

/** Подредба: Дълги -> Къси -> Мъгла */
function positionOrder(pos: string): number {
  const p = normPos(pos);
  if (p === "high beam") return 0;
  if (p === "low beam") return 1;
  if (
    p === "fog lamps" ||
    p === "fog lamp" ||
    p === "fog light" ||
    p === "front fog light" ||
    p === "front fog lights"
  ) {
    return 2;
  }
  return 999;
}

function modKey(x: Mod) {
  return `${x.model_type_name ?? ""}__${x.body_type ?? ""}`;
}

function positionKey(x: PositionRow) {
  return `${x.position_category ?? ""}__${x.position}`;
}

function isHFamily(bt: string) {
  const t = bt.trim().toUpperCase();
  return t.startsWith("H") || t.startsWith("HB") || t === "9005" || t === "9006";
}

function isDFamily(bt: string) {
  const t = bt.trim().toUpperCase();
  return t.startsWith("D");
}

/** ---------------- UI pieces ---------------- */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-extrabold tracking-wide text-neutral-900">{label}</div>
        {hint ? <div className="text-xs text-neutral-500">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

function LoadingPill({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 rounded-lg bg-neutral-900/90 px-2.5 py-1 text-xs font-semibold text-yellow-300 shadow">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-yellow-300/30 border-t-yellow-300" />
      Зареждане…
    </span>
  );
}

/**
 * Searchable dropdown
 * - Без auto-focus (за да не вдига клавиатурата на мобилен)
 * - Panel: z-[9999] + parent overflow-visible => няма да се реже
 */
function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  loading,
  searchPlaceholder = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  searchPlaceholder?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useOnClickOutside(wrapRef, () => setOpen(false));

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    return options.find((o) => o.value === value)?.label ?? "";
  }, [value, options]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(query));
  }, [q, options]);

  function toggle() {
    if (disabled) return;
    setOpen((s) => !s);
    setQ("");
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={wrapRef} className={cx("relative", disabled && "opacity-80")}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={cx(
          "relative w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left shadow-sm",
          "outline-none transition",
          "focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20",
          "disabled:bg-neutral-100",
          "pr-10"
        )}
      >
        <span className="block truncate text-neutral-950">
          {value ? selectedLabel : placeholder}
        </span>

        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-900">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <LoadingPill show={loading} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-[9999] mt-2 overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-xl">
          <div className="border-b border-neutral-200 p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className={cx(
                "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base",
                "text-neutral-950 placeholder:text-neutral-500",
                "outline-none transition",
                "focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20"
              )}
            />
            <div className="mt-2 text-[11px] text-neutral-500">(по желание) търси в списъка</div>
          </div>

          <div className="max-h-72 overflow-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-neutral-500">Няма резултати</div>
            ) : (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => pick(o.value)}
                    className={cx(
                      "flex w-full items-center justify-between px-4 py-3 text-left text-base",
                      "transition",
                      active
                        ? "bg-neutral-950 text-white"
                        : "text-neutral-950 hover:bg-neutral-100"
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {active ? <span className="text-yellow-300">✓</span> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CallBox() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-black text-neutral-950">При вашия модел е специфично</div>
      <div className="mt-2 text-sm text-neutral-700">
        За този автомобил има повече от един възможен вариант. За да ви насочим
        точно — свържете се с нас:
      </div>
      <a
        href={`tel:${SUPPORT_PHONE_TEL}`}
        className={cx(
          "mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-extrabold",
          "bg-neutral-950 text-white hover:bg-neutral-800 active:bg-neutral-900",
          "transition focus:outline-none focus:ring-4 focus:ring-neutral-400/30"
        )}
      >
        Обадете се: {SUPPORT_PHONE}
      </a>
    </div>
  );
}

function SingleDirectBox({ bulbType }: { bulbType: string }) {
  const url = resolveBulbUrl(bulbType);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-black text-neutral-950">Намерихме цокъл</div>
      <div className="mt-2 text-sm text-neutral-700">
        За вашия избор е наличен цокъл: <span className="font-extrabold">{bulbType}</span>
      </div>

      {url ? (
        <a
          href={url}
          className={cx(
            "mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-extrabold",
            "bg-yellow-400 text-neutral-950 hover:bg-yellow-300 active:bg-yellow-500",
            "transition focus:outline-none focus:ring-4 focus:ring-yellow-400/30"
          )}
        >
          Виж продукта
        </a>
      ) : (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
          Нямам линк за този цокъл още. Добави го в <b>BULB_TYPE_TO_URL</b>.
        </div>
      )}
    </div>
  );
}

function TwoChoiceBox({ halogen, xenon }: { halogen: string; xenon: string }) {
  const hUrl = resolveBulbUrl(halogen);
  const dUrl = resolveBulbUrl(xenon);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-yellow-300/70 bg-yellow-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-black text-neutral-950">Жълто = халоген</div>
            <div className="mt-1 text-sm text-neutral-700">
              Ако фаровете ви светят в жълто, вашият цокъл е:
              <span className="ml-2 font-extrabold">{halogen}</span>
            </div>
          </div>
          <span className="rounded-xl bg-yellow-400 px-3 py-1 text-xs font-extrabold text-neutral-950">
            ЖЪЛТО
          </span>
        </div>

        {hUrl ? (
          <a
            href={hUrl}
            className={cx(
              "mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-extrabold",
              "bg-yellow-400 text-neutral-950 hover:bg-yellow-300 active:bg-yellow-500",
              "transition focus:outline-none focus:ring-4 focus:ring-yellow-400/30"
            )}
          >
            Натиснете тук
          </a>
        ) : (
          <div className="mt-4 rounded-xl bg-white p-3 text-sm text-neutral-700">
            Нямам линк за {halogen}. Добави го в <b>BULB_TYPE_TO_URL</b>.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-black text-neutral-950">Бяло = ксенон</div>
            <div className="mt-1 text-sm text-neutral-700">
              Ако фаровете ви светят в бяло, вашият цокъл е:
              <span className="ml-2 font-extrabold">{xenon}</span>
            </div>
          </div>
          <span className="rounded-xl bg-neutral-950 px-3 py-1 text-xs font-extrabold text-white">
            БЯЛО
          </span>
        </div>

        {dUrl ? (
          <a
            href={dUrl}
            className={cx(
              "mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-extrabold",
              "bg-neutral-950 text-white hover:bg-neutral-800 active:bg-neutral-900",
              "transition focus:outline-none focus:ring-4 focus:ring-neutral-400/30"
            )}
          >
            Натиснете тук
          </a>
        ) : (
          <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
            Нямам линк за {xenon}. Добави го в <b>BULB_TYPE_TO_URL</b>.
          </div>
        )}
      </div>
    </div>
  );
}

/** ---------------- Main ---------------- */
export default function FitmentSearch() {
  const [years, setYears] = useState<number[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [bulbsByTech, setBulbsByTech] = useState<BulbsByTech>({ halogen: [], xenon: [] });

  const [year, setYear] = useState<number | "">("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [modelType, setModelType] = useState<string | null>(null);
  const [bodyType, setBodyType] = useState<string | null>(null);
  const [posCategory, setPosCategory] = useState<string | null>(null);
  const [pos, setPos] = useState<string>("");

  const [loading, setLoading] = useState<LoadingMap>(initialLoading);

  const cacheRef = useRef(new Map<string, unknown>());
  const abortRef = useRef<Record<LoadKey, AbortController | null>>({
    years: null,
    brands: null,
    models: null,
    mods: null,
    positions: null,
    bulbsByTech: null,
  });

  const modValue = useMemo(() => `${modelType ?? ""}__${bodyType ?? ""}`, [modelType, bodyType]);
  const selectedPositionValue = useMemo(
    () => `${posCategory ?? ""}__${pos}`,
    [posCategory, pos]
  );

  const positionsSorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      const oa = positionOrder(a.position);
      const ob = positionOrder(b.position);
      if (oa !== ob) return oa - ob;
      return a.position.localeCompare(b.position);
    });
  }, [positions]);

  function setLoadingKey(key: LoadKey, v: boolean) {
    setLoading((prev) => ({ ...prev, [key]: v }));
  }

  async function cachedGet<T>(cacheKey: string, url: string, loadKey: LoadKey): Promise<T> {
    const cached = cacheRef.current.get(cacheKey);
    if (cached) return cached as T;

    abortRef.current[loadKey]?.abort();
    const ac = new AbortController();
    abortRef.current[loadKey] = ac;

    setLoadingKey(loadKey, true);
    try {
      const data = await fetchJSON<T>(url, ac.signal);
      cacheRef.current.set(cacheKey, data);
      return data;
    } finally {
      setLoadingKey(loadKey, false);
    }
  }

  // years
  useEffect(() => {
    (async () => {
      const data = await cachedGet<number[]>("years", "/api/fitment/options?level=years", "years");
      setYears(data);
    })().catch(() => {});
  }, []);

  // year -> brands
  useEffect(() => {
    setBrand("");
    setModel("");
    setModelType(null);
    setBodyType(null);
    setPosCategory(null);
    setPos("");
    setBulbsByTech({ halogen: [], xenon: [] });

    setModels([]);
    setMods([]);
    setPositions([]);

    if (year === "") {
      setBrands([]);
      return;
    }

    (async () => {
      const key = `brands|${year}`;
      const url = `/api/fitment/options?level=brands&year=${year}`;
      const data = await cachedGet<string[]>(key, url, "brands");
      setBrands(data);
    })().catch(() => {});
  }, [year]);

  // year+brand -> models
  useEffect(() => {
    setModel("");
    setModelType(null);
    setBodyType(null);
    setPosCategory(null);
    setPos("");
    setBulbsByTech({ halogen: [], xenon: [] });

    setMods([]);
    setPositions([]);

    if (year === "" || !brand) {
      setModels([]);
      return;
    }

    (async () => {
      const key = `models|${year}|${brand}`;
      const url = `/api/fitment/options?level=models&year=${year}&brand=${encodeURIComponent(brand)}`;
      const data = await cachedGet<string[]>(key, url, "models");
      setModels(data);
    })().catch(() => {});
  }, [year, brand]);

  // year+brand+model -> mods
  useEffect(() => {
    setModelType(null);
    setBodyType(null);
    setPosCategory(null);
    setPos("");
    setBulbsByTech({ halogen: [], xenon: [] });

    setPositions([]);

    if (year === "" || !brand || !model) {
      setMods([]);
      return;
    }

    (async () => {
      const key = `mods|${year}|${brand}|${model}`;
      const url = `/api/fitment/options?level=mods&year=${year}&brand=${encodeURIComponent(
        brand
      )}&model=${encodeURIComponent(model)}`;
      const data = await cachedGet<Mod[]>(key, url, "mods");
      setMods(data);
    })().catch(() => {});
  }, [year, brand, model]);

  // positions
  useEffect(() => {
    setPosCategory(null);
    setPos("");
    setBulbsByTech({ halogen: [], xenon: [] });

    if (year === "" || !brand || !model) {
      setPositions([]);
      return;
    }

    (async () => {
      const key = `positions|${year}|${brand}|${model}|${modelType ?? ""}|${bodyType ?? ""}`;
      const params = new URLSearchParams({
        level: "positions",
        year: String(year),
        brand,
        model,
        modelType: modelType ?? "",
        bodyType: bodyType ?? "",
      });
      const url = `/api/fitment/options?${params.toString()}`;
      const data = await cachedGet<PositionRow[]>(key, url, "positions");
      setPositions(data);
    })().catch(() => {});
  }, [year, brand, model, modValue]);

  // bulbs by tech after position
  useEffect(() => {
    setBulbsByTech({ halogen: [], xenon: [] });
    if (year === "" || !brand || !model || !pos) return;

    (async () => {
      const key = `bulbsByTech|${year}|${brand}|${model}|${modelType ?? ""}|${bodyType ?? ""}|${posCategory ?? ""}|${pos}`;
      const params = new URLSearchParams({
        level: "bulbsByPosition",
        year: String(year),
        brand,
        model,
        modelType: modelType ?? "",
        bodyType: bodyType ?? "",
        positionCategory: posCategory ?? "",
        position: pos,
      });
      const url = `/api/fitment/options?${params.toString()}`;
      const data = await cachedGet<BulbsByTech>(key, url, "bulbsByTech");
      setBulbsByTech(data);
    })().catch(() => {});
  }, [year, brand, model, modValue, selectedPositionValue]);

  function onClear() {
    setYear("");
  }

  /** Options for dropdowns */
  const yearOptions: Option[] = useMemo(
    () => years.map((y) => ({ value: String(y), label: String(y) })),
    [years]
  );

  const brandOptions: Option[] = useMemo(() => {
    const all = [...brands];
    const topSet = new Set(TOP_BRANDS_ORDER);

    const top = TOP_BRANDS_ORDER.filter((b) => all.includes(b));
    const rest = all.filter((b) => !topSet.has(b)).sort((a, b) => a.localeCompare(b));

    return [...top, ...rest].map((b) => ({ value: b, label: b }));
  }, [brands]);

  const modelOptions: Option[] = useMemo(
    () => models.map((m) => ({ value: m, label: m })),
    [models]
  );

  const modOptions: Option[] = useMemo(() => {
    return mods.map((x) => {
      const key = modKey(x);
      const label = `${x.model_type_name ?? "—"} / ${x.body_type ?? "—"}`;
      return { value: key, label };
    });
  }, [mods]);

  const positionOptions: Option[] = useMemo(() => {
    return positionsSorted.map((x) => {
      const key = positionKey(x);
      return { value: key, label: positionLabelBG(x.position) };
    });
  }, [positionsSorted]);

  /** ---------------- RESULT LOGIC ---------------- */
  const showResult = year !== "" && brand && model && pos;

  const hal = bulbsByTech.halogen ?? [];
  const xen = bulbsByTech.xenon ?? [];

  const allUnique = useMemo(() => Array.from(new Set([...hal, ...xen])), [hal, xen]);

  const singleBulb = !loading.bulbsByTech && allUnique.length === 1 ? allUnique[0] : null;

  const hasHal = hal.length > 0;
  const hasXen = xen.length > 0;

  const canTwoChoice =
    !loading.bulbsByTech &&
    hasHal &&
    hasXen &&
    hal.length === 1 &&
    xen.length === 1 &&
    isHFamily(hal[0]) &&
    isDFamily(xen[0]);

  // ✅ ONLY when there are 2 options (H/HB + D)
  const showImportant = showResult && !loading.bulbsByTech && !singleBulb && canTwoChoice;

  const onlyHalogen = !loading.bulbsByTech && hasHal && !hasXen;
  const twoPlusH = onlyHalogen && hal.length >= 2 && hal.every((b) => isHFamily(b));

  const onlyXenon = !loading.bulbsByTech && hasXen && !hasHal;
  const twoPlusD = onlyXenon && xen.length >= 2 && xen.every((b) => isDFamily(b));

  const ambiguous =
    showResult &&
    !loading.bulbsByTech &&
    !singleBulb &&
    !canTwoChoice &&
    !twoPlusH &&
    !twoPlusD &&
    allUnique.length > 0;

  return (
    <section className="overflow-visible rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="bg-neutral-950 px-6 py-6 text-center">
        <div className="mx-auto inline-flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">
            ТЪРСИ ПО…
          </h1>
        </div>
        <p className="mt-2 text-sm text-neutral-300">
          Изберете автомобил и вид светлини. Ние ще ви покажем правилния цокъл.
        </p>
      </div>

      <div className="px-6 py-8 md:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Field label="ГОДИНА">
            <SearchSelect
              value={year === "" ? "" : String(year)}
              onChange={(v) => setYear(v ? Number(v) : "")}
              options={yearOptions}
              placeholder={loading.years ? "Зареждане..." : "Избери Година"}
              loading={loading.years}
            />
          </Field>

          <Field label="МАРКА" hint="(топ марки най-отгоре)">
            <SearchSelect
              value={brand}
              onChange={(v) => setBrand(v)}
              options={brandOptions}
              placeholder={
                year === ""
                  ? "Избери Марка"
                  : loading.brands
                  ? "Зареждане..."
                  : "Избери Марка"
              }
              disabled={year === "" || loading.brands}
              loading={loading.brands}
            />
          </Field>

          <Field label="МОДЕЛ">
            <SearchSelect
              value={model}
              onChange={(v) => setModel(v)}
              options={modelOptions}
              placeholder={
                !brand
                  ? "Избери Модел"
                  : loading.models
                  ? "Зареждане..."
                  : "Избери Модел"
              }
              disabled={!brand || loading.models}
              loading={loading.models}
            />
          </Field>

          <Field label="МОДИФИКАЦИЯ" hint="(двигател/купе)">
            <SearchSelect
              value={modValue === "__" ? "" : modValue}
              onChange={(v) => {
                if (!v) {
                  setModelType(null);
                  setBodyType(null);
                  return;
                }
                const [mt, bt] = v.split("__");
                setModelType(mt || null);
                setBodyType(bt || null);
              }}
              options={modOptions}
              placeholder={
                !model
                  ? "Избери Модификация"
                  : loading.mods
                  ? "Зареждане..."
                  : "Избери Модификация"
              }
              disabled={!model || loading.mods}
              loading={loading.mods}
            />
          </Field>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="ВИД КРУШКА" hint="(дълги/къси/мъгла)">
            <SearchSelect
              value={selectedPositionValue === "__" ? "" : selectedPositionValue}
              onChange={(v) => {
                if (!v) {
                  setPosCategory(null);
                  setPos("");
                  return;
                }
                const [pc, p] = v.split("__");
                setPosCategory(pc || null);
                setPos(p || "");
              }}
              options={positionOptions}
              placeholder={
                year === "" || !brand || !model
                  ? "Избери Вид крушка"
                  : loading.positions
                  ? "Зареждане..."
                  : "Избери Вид крушка"
              }
              disabled={year === "" || !brand || !model || loading.positions}
              loading={loading.positions}
            />
          </Field>

          {/* ✅ Само ако има 2 варианта */}
          {showImportant ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-extrabold text-neutral-900">Важно</div>
              <div className="mt-2 text-sm text-neutral-700">
                Има 2 варианта за вашия модел:
                <ul className="mt-2 list-disc pl-5">
                  <li>
                    <b>Жълто</b> = халоген (H/HB…)
                  </li>
                  <li>
                    <b>Бяло</b> = ксенон (D…)
                  </li>
                </ul>
                Изберете според цвета на фаровете.
              </div>
            </div>
          ) : null}
        </div>

        {showResult ? (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-neutral-950">Резултат</div>
              {loading.bulbsByTech ? (
                <div className="text-sm font-bold text-neutral-600">Зареждане…</div>
              ) : null}
            </div>

            {!loading.bulbsByTech && singleBulb ? <SingleDirectBox bulbType={singleBulb} /> : null}

            {!loading.bulbsByTech && !singleBulb && canTwoChoice ? (
              <TwoChoiceBox halogen={hal[0]} xenon={xen[0]} />
            ) : null}

            {!loading.bulbsByTech && !singleBulb && !canTwoChoice && (twoPlusH || twoPlusD) ? (
              <CallBox />
            ) : null}

            {!loading.bulbsByTech && ambiguous ? <CallBox /> : null}

            {!loading.bulbsByTech && allUnique.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700 shadow-sm">
                Няма намерени цокли за избраната конфигурация. Опитай друга модификация/вид светлини.
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            className={cx(
              "inline-flex items-center justify-center rounded-xl px-10 py-3 text-lg font-extrabold",
              "bg-neutral-100 text-neutral-900 shadow-sm transition",
              "hover:bg-neutral-200 active:bg-neutral-300",
              "focus:outline-none focus:ring-4 focus:ring-neutral-300/60"
            )}
            onClick={onClear}
          >
            Изчисти
          </button>
        </div>
      </div>
    </section>
  );
}