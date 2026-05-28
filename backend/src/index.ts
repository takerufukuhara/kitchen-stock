import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/items", async (_req, res) => {
  try {
    // items取得
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("*");

    if (itemsError) {
      return res.status(500).json({ error: itemsError.message });
    }

    // stock_movements取得
    const { data: moves, error: movesError } = await supabase
      .from("stock_movements")
      .select("item_id, delta");

    if (movesError) {
      return res.status(500).json({ error: movesError.message });
    }

    // 在庫計算
    const stockMap = new Map<string, number>();

    for (const m of moves ?? []) {
      stockMap.set(
        m.item_id,
        (stockMap.get(m.item_id) ?? 0) + Number(m.delta)
      );
    }

    // itemsにcurrent_stock追加
    const result = (items ?? []).map((item) => ({
      ...item,
      current_stock: stockMap.get(item.id) ?? 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/stock-movements", async (req, res) => {
  try {
    const { item_id, delta, reason } = req.body;

    if (!item_id || delta === undefined || delta === null) {
      return res.status(400).json({ error: "item_id と delta は必須です" });
    }

    // reason列が無いならここも消してください（後述）
    const payload: any = { item_id, delta };
    if (reason !== undefined) payload.reason = reason;

    const { data, error } = await supabase
      .from("stock_movements")
      .insert([payload])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/items", async (req, res) => {
  try {
    const { name, unit, par_level, category } = req.body ?? {};

    if (!name || !unit) {
      return res.status(400).json({ error: "name と unit は必須です" });
    }

    const trimmedCategory =
      category === undefined || category === null ? null : String(category).trim();

    const { data, error } = await supabase
      .from("items")
      .insert([
        {
          name,
          unit,
          category: trimmedCategory || null,
          par_level: par_level === "" || par_level === undefined ? null : Number(par_level),
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/stock-movements", async (req, res) => {
  try {
    const itemId = req.query.item_id as string | undefined;
    const limitStr = req.query.limit as string | undefined;
    const limit = limitStr ? Number(limitStr) : 50;

    if (!itemId) {
      return res.status(400).json({ error: "item_id は必須です" });
    }
    if (!Number.isFinite(limit) || limit <= 0 || limit > 200) {
      return res.status(400).json({ error: "limit は 1〜200 の数値にしてください" });
    }

    // stock_movements の列はあなたのDBに合わせて必要なものだけselect
    const { data, error } = await supabase
      .from("stock_movements")
      .select("id,item_id,delta,created_at") // reason/note列が無い前提で最小
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });

    res.json(data ?? []);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/items/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // 1) 先に履歴を削除（外部キー制約があると items を消せないため）
    const { error: delMovesErr } = await supabase
      .from("stock_movements")
      .delete()
      .eq("item_id", id);

    if (delMovesErr) {
      return res.status(500).json({ error: delMovesErr.message });
    }

    // 2) items を削除
    const { data, error: delItemErr } = await supabase
      .from("items")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (delItemErr) {
      return res.status(500).json({ error: delItemErr.message });
    }

    res.json({ deleted: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/items/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { name, unit, par_level, category } = req.body ?? {};

    // 送られてきた項目だけ更新する（undefinedは無視）
    const update: any = {};
    if (name !== undefined) update.name = String(name).trim();
    if (unit !== undefined) update.unit = String(unit).trim();
    if (category !== undefined) {
      const trimmedCategory =
        category === null ? "" : String(category).trim();
      update.category = trimmedCategory || null;
    }
    if (par_level !== undefined) {
      update.par_level = par_level === "" || par_level === null ? null : Number(par_level);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "更新する項目がありません" });
    }

    const { data, error } = await supabase
      .from("items")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/stock-movements/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const { data, error } = await supabase
      .from("stock_movements")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ deleted: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});



const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
