import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Level = "years" | "brands" | "models" | "mods" | "positions" | "bulbsByPosition";

export const revalidate = 3600; // 1 час

function cachedJson(data: unknown, maxAgeSeconds = 3600) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=86400`,
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const level = (searchParams.get("level") || "years") as Level;

  const year = searchParams.get("year");
  const brand = searchParams.get("brand");
  const model = searchParams.get("model");
  const modelType = searchParams.get("modelType");
  const bodyType = searchParams.get("bodyType");

  const positionCategory = searchParams.get("positionCategory");
  const position = searchParams.get("position");

  const client = await pool.connect();
  try {
    if (level === "years") {
      const r = await client.query(`
        select distinct model_year
        from bulb_fitment
        order by model_year desc
      `);
      return cachedJson(r.rows.map((x) => x.model_year), 24 * 3600);
    }

    if (level === "brands") {
      if (!year) return cachedJson([]);
      const r = await client.query(
        `
        select distinct brand
        from bulb_fitment
        where model_year = $1
        order by brand asc
        `,
        [Number(year)]
      );
      return cachedJson(r.rows.map((x) => x.brand), 6 * 3600);
    }

    if (level === "models") {
      if (!year || !brand) return cachedJson([]);
      const r = await client.query(
        `
        select distinct model_name
        from bulb_fitment
        where model_year = $1 and brand = $2
        order by model_name asc
        `,
        [Number(year), brand]
      );
      return cachedJson(r.rows.map((x) => x.model_name), 6 * 3600);
    }

    if (level === "mods") {
      if (!year || !brand || !model) return cachedJson([]);
      const r = await client.query(
        `
        select distinct model_type_name, body_type
        from bulb_fitment
        where model_year = $1 and brand = $2 and model_name = $3
        order by model_type_name nulls last, body_type nulls last
        `,
        [Number(year), brand, model]
      );
      return cachedJson(r.rows, 6 * 3600);
    }

    // ✅ ВИД КРУШКА (позиции) - само дълги/къси/мъгла
    if (level === "positions") {
      if (!year || !brand || !model) return cachedJson([]);

      const r = await client.query(
        `
        select distinct position_category, position
        from bulb_fitment
        where model_year = $1
          and brand = $2
          and model_name = $3
          and (model_type_name is not distinct from $4)
          and (body_type is not distinct from $5)
          and position is not null
          and lower(position) in (
            'high beam',
            'low beam',
            'fog lamps',
            'fog light',
            'front fog light',
            'front fog lights'
          )
        `,
        [Number(year), brand, model, modelType || null, bodyType || null]
      );

      return cachedJson(r.rows, 6 * 3600);
    }

    // ✅ Връща цокли групирани в halogen/xenon за избраната позиция
    if (level === "bulbsByPosition") {
      if (!year || !brand || !model || !position) {
        return cachedJson({ halogen: [], xenon: [] });
      }

      const r = await client.query(
        `
        select distinct bulb_type, technology
        from bulb_fitment
        where model_year = $1
          and brand = $2
          and model_name = $3
          and (model_type_name is not distinct from $4)
          and (body_type is not distinct from $5)
          and ($6 = '' or position_category is not distinct from $6) -- category опционална
          and position = $7
          and bulb_type is not null
        `,
        [
          Number(year),
          brand,
          model,
          modelType || null,
          bodyType || null,
          positionCategory ?? "",
          position,
        ]
      );

      const halogen = new Set<string>();
      const xenon = new Set<string>();

      for (const row of r.rows as Array<{ bulb_type: string; technology: string | null }>) {
        const bt = row.bulb_type?.trim();
        if (!bt) continue;

        const tech = (row.technology ?? "").toLowerCase();

        // 1) ако technology е ясна
        if (tech.includes("halogen")) {
          halogen.add(bt);
          continue;
        }
        if (tech.includes("xenon")) {
          xenon.add(bt);
          continue;
        }

        // 2) иначе: инференция по цокъл
        // D* обикновено е ксенон
        if (bt.toUpperCase().startsWith("D")) xenon.add(bt);
        else halogen.add(bt);
      }

      return cachedJson(
        {
          halogen: Array.from(halogen).sort((a, b) => a.localeCompare(b)),
          xenon: Array.from(xenon).sort((a, b) => a.localeCompare(b)),
        },
        6 * 3600
      );
    }

    return NextResponse.json({ error: "invalid level" }, { status: 400 });
  } finally {
    client.release();
  }
}