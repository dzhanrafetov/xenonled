// Мапинг: цокъл (bulb_type) -> продуктова страница в xenon.bg
// Ползваме нормализиран ключ, за да работи и при различно изписване от базата.

function normalizeBulbKey(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ""); // маха интервали (пример: "HB3 / 9005" -> "HB3/9005" ако няма интервали около /)
}

export const BULB_TYPE_TO_URL: Record<string, string> = {
  // Halogen H-series
  H1: "https://www.xenon.bg/product/led-krushki-h1-raytech-turbo-130w-6000k", // ⚠️ дадено от теб за H1
  H3: "https://www.xenon.bg/product/led-krushki-h3-raytech-90w-6000k-canbus",
  H4: "https://www.xenon.bg/product/led-krushki-h4-raytech-90w-6000k",
  H7: "https://www.xenon.bg/product/led-krushki-h7-raytech-turbo-130w-6000k",
  H8: "https://www.xenon.bg/product/led-krushki-h8-raytech-turbo-130w-6000k-1",
  H9: "https://www.xenon.bg/product/led-krushki-h9-raytech-turbo-130w-6000k-1",
  H11: "https://www.xenon.bg/product/led-krushki-h11-raytech-turbo-130w-6000k",
  H16: "https://www.xenon.bg/product/led-krushki-h16-raytech-turbo-130w-6000k-1",

  // HB series (често идва като HB3/9005 и HB4/9006)
  "HB3/9005": "https://www.xenon.bg/product/led-krushki-hb3-raytech-turbo-130w-6000k",
  "HB4/9006": "https://www.xenon.bg/product/led-krushki-hb4-raytech-turbo-130w-6000k",

  // Aliases (ако базата върне само HB3 или само 9005)
  HB3: "https://www.xenon.bg/product/led-krushki-hb3-raytech-turbo-130w-6000k",
  "9005": "https://www.xenon.bg/product/led-krushki-hb3-raytech-turbo-130w-6000k",
  HB4: "https://www.xenon.bg/product/led-krushki-hb4-raytech-turbo-130w-6000k",
  "9006": "https://www.xenon.bg/product/led-krushki-hb4-raytech-turbo-130w-6000k",

  // D-series (ксенон заместители)
  D1S: "https://www.xenon.bg/product/led-krushki-d1s-raytech-70w-5500k",
  D2S: "https://www.xenon.bg/product/led-krushki-d2s-raytech-70w-5500k-canbus",
  D3S: "https://www.xenon.bg/product/led-krushki-d3s-raytech-70w-5500k",
  D4S: "https://www.xenon.bg/product/led-krushki-d4s-raytech-70w-5500k",
  D5S: "https://www.xenon.bg/product/led-krushki-d5s-raytech-50w-5500k",
  D8S: "https://www.xenon.bg/product/led-krushki-d8s-raytech-50w-5500k",
};

export function resolveBulbUrl(bulbType: string): string | null {
  const key = normalizeBulbKey(bulbType);

  // 1) директен мач
  if (BULB_TYPE_TO_URL[key]) return BULB_TYPE_TO_URL[key];

  // 2) ако е нещо като "HB3/9005" с интервали около '/'
  const cleaned = key.replace(/\s*/g, "");
  if (BULB_TYPE_TO_URL[cleaned]) return BULB_TYPE_TO_URL[cleaned];

  // 3) fallback: ако е формат "HB3/9005" опитай ляво/дясно
  if (cleaned.includes("/")) {
    const [left, right] = cleaned.split("/");
    if (left && BULB_TYPE_TO_URL[left]) return BULB_TYPE_TO_URL[left];
    if (right && BULB_TYPE_TO_URL[right]) return BULB_TYPE_TO_URL[right];
  }

  return null;
}