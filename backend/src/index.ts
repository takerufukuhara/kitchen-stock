import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import crypto from "crypto";
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

const adminPassword = process.env.ADMIN_PASSWORD;
const adminToken =
  process.env.ADMIN_AUTH_TOKEN || crypto.randomBytes(32).toString("hex");
const customerGroupLabels = process.env.CUSTOMER_GROUP_LABELS
  ? process.env.CUSTOMER_GROUP_LABELS.split(",")
      .map((label) => label.trim())
      .filter(Boolean)
  : ["テーブル1", "テーブル2", "テーブル3", "テーブル4", "テーブル5", "テーブル6"];

const requireAdmin: express.RequestHandler = (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token || token !== adminToken) {
    return res.status(401).json({ error: "管理者認証が必要です" });
  }

  next();
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/admin/login", async (req, res) => {
  const { password } = req.body ?? {};

  if (!adminPassword || !process.env.ADMIN_AUTH_TOKEN) {
    return res.status(500).json({
      error: "管理者認証の環境変数が未設定です",
    });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: "パスワードが違います" });
  }

  res.json({ token: adminToken });
});

app.get("/items", requireAdmin, async (_req, res) => {
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
      current_stock: Math.max(0, stockMap.get(item.id) ?? 0),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/stock-movements", requireAdmin, async (req, res) => {
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

app.post("/items", requireAdmin, async (req, res) => {
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

app.get("/stock-movements", requireAdmin, async (req, res) => {
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
      .select("id,item_id,delta,reason,created_at")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });

    res.json(data ?? []);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/waste-summary", requireAdmin, async (_req, res) => {
  try {
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("id,name,unit,category,par_level");

    if (itemsError) {
      return res.status(500).json({ error: itemsError.message });
    }

    const { data: moves, error: movesError } = await supabase
      .from("stock_movements")
      .select("item_id,delta,reason")
      .eq("reason", "廃棄")
      .lt("delta", 0);

    if (movesError) {
      return res.status(500).json({ error: movesError.message });
    }

    const wasteMap = new Map<string, { waste_qty: number; waste_count: number }>();

    for (const move of moves ?? []) {
      const current = wasteMap.get(move.item_id) ?? {
        waste_qty: 0,
        waste_count: 0,
      };
      current.waste_qty += Math.abs(Number(move.delta));
      current.waste_count += 1;
      wasteMap.set(move.item_id, current);
    }

    const result = (items ?? [])
      .map((item) => {
        const waste = wasteMap.get(item.id);
        if (!waste) return null;

        const parLevel =
          item.par_level === null || item.par_level === undefined
            ? null
            : Number(item.par_level);
        const suggestedParLevel =
          parLevel === null ? null : Math.max(0, parLevel - waste.waste_qty);

        return {
          item_id: item.id,
          name: item.name,
          unit: item.unit,
          category: item.category,
          par_level: parLevel,
          waste_qty: waste.waste_qty,
          waste_count: waste.waste_count,
          suggested_par_level: suggestedParLevel,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.waste_qty - a.waste_qty);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/public/menu-items", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id,name,category,prep_required")
      .order("name", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/menu-items", requireAdmin, async (_req, res) => {
  try {
    const { data: menus, error: menusError } = await supabase
      .from("menu_items")
      .select("*")
      .order("name", { ascending: true });

    if (menusError) return res.status(500).json({ error: menusError.message });

    const { data: recipes, error: recipesError } = await supabase
      .from("recipes")
      .select("id,menu_item_id,item_id,quantity,items(name,unit)");

    if (recipesError) {
      return res.status(500).json({ error: recipesError.message });
    }

    const result = (menus ?? []).map((menu) => ({
      ...menu,
      recipes: (recipes ?? []).filter((recipe) => recipe.menu_item_id === menu.id),
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/menu-items", requireAdmin, async (req, res) => {
  try {
    const { name, category, prep_required } = req.body ?? {};
    const trimmedCategory =
      category === undefined || category === null ? "" : String(category).trim();

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "メニュー名は必須です" });
    }

    const { data, error } = await supabase
      .from("menu_items")
      .insert([
        {
          name: String(name).trim(),
          category: trimmedCategory || null,
          prep_required: Boolean(prep_required),
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

app.patch("/menu-items/:id", requireAdmin, async (req, res) => {
  try {
    const { name, category, prep_required } = req.body ?? {};
    const update: Record<string, string | null | boolean> = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res.status(400).json({ error: "メニュー名は必須です" });
      }
      update.name = trimmedName;
    }

    if (category !== undefined) {
      const trimmedCategory =
        category === null ? "" : String(category).trim();
      update.category = trimmedCategory || null;
    }

    if (prep_required !== undefined) {
      update.prep_required = Boolean(prep_required);
    }

    const { data, error } = await supabase
      .from("menu_items")
      .update(update)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/menu-items/:id", requireAdmin, async (req, res) => {
  try {
    const menuItemId = req.params.id;

    const { data, error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", menuItemId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/menu-items/:id/recipes", requireAdmin, async (req, res) => {
  try {
    const menuItemId = req.params.id;
    const { item_id, quantity } = req.body ?? {};
    const numericQuantity = Number(quantity);

    if (!item_id || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return res.status(400).json({ error: "item_id と 1以上の quantity は必須です" });
    }

    const { data, error } = await supabase
      .from("recipes")
      .insert([
        {
          menu_item_id: menuItemId,
          item_id,
          quantity: numericQuantity,
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

app.delete("/recipes/:id", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ deleted: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/orders", requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id,menu_item_id,customer_group_id,quantity,status,created_at,completed_at,cancelled_at,cancel_confirmed_at,staff_called_at,staff_call_confirmed_at,menu_items(name),customer_groups(label,closed_at)")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/staff-calls", requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("staff_calls")
      .select("id,customer_group_id,created_at,confirmed_at,cancelled_at,customer_groups(label)")
      .is("confirmed_at", null)
      .is("cancelled_at", null)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/staff-calls/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("staff_calls")
      .select("id,customer_group_id,created_at,confirmed_at,cancelled_at,customer_groups(label)")
      .eq("id", req.params.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "呼び出しが見つかりません" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/staff-calls", async (req, res) => {
  try {
    const { customer_group_id } = req.body ?? {};

    if (!customer_group_id) {
      return res.status(400).json({ error: "customer_group_id は必須です" });
    }

    const { data, error } = await supabase
      .from("staff_calls")
      .insert([{ customer_group_id }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/staff-calls/:id/confirm", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("staff_calls")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/staff-calls/:id/cancel", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("staff_calls")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/customer-groups", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("customer_groups")
      .select("id,label,created_at,closed_at")
      .in("label", customerGroupLabels)
      .is("closed_at", null)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const activeByLabel = new Map(
      (data ?? []).map((group) => [group.label, group])
    );

    res.json(
      customerGroupLabels.map((label) => ({
        label,
        active_group: activeByLabel.get(label) ?? null,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/customer-groups", async (req, res) => {
  try {
    const rawLabel = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    const label = rawLabel || customerGroupLabels[0];

    if (!customerGroupLabels.includes(label)) {
      return res.status(400).json({ error: "登録されていない卓です" });
    }

    const { data: activeGroup, error: activeGroupError } = await supabase
      .from("customer_groups")
      .select("id,label,created_at,closed_at")
      .eq("label", label)
      .is("closed_at", null)
      .maybeSingle();

    if (activeGroupError) return res.status(500).json({ error: activeGroupError.message });
    if (activeGroup) {
      return res.status(409).json({ error: "この卓はすでに注文中です" });
    }

    const { data, error } = await supabase
      .from("customer_groups")
      .insert([{ label }])
      .select("id,label,created_at,closed_at")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/customer-groups/:id/checkout", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customer_groups")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("id,label,created_at,closed_at")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/customer-groups/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customer_groups")
      .select("id,label,created_at,closed_at")
      .eq("id", req.params.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "お客様グループが見つかりません" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/orders", async (req, res) => {
  try {
    const { menu_item_id, quantity, customer_group_id } = req.body ?? {};
    const numericQuantity = Number(quantity);

    if (!menu_item_id || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return res.status(400).json({ error: "menu_item_id と 1以上の quantity は必須です" });
    }

    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          menu_item_id,
          quantity: numericQuantity,
          customer_group_id: customer_group_id || null,
          status: "調理待ち",
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

app.get("/orders/:id/status", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id,menu_item_id,customer_group_id,quantity,status,created_at,completed_at,cancelled_at,cancel_confirmed_at,staff_called_at,staff_call_confirmed_at,menu_items(name),customer_groups(label,closed_at)")
      .eq("id", req.params.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "注文が見つかりません" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/orders/:id/cancel", async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,status")
      .eq("id", orderId)
      .single();

    if (orderError) return res.status(500).json({ error: orderError.message });
    if (!order) return res.status(404).json({ error: "注文が見つかりません" });
    if (order.status !== "調理待ち") {
      return res.status(400).json({ error: "調理待ちの注文だけキャンセルできます" });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "キャンセル", cancelled_at: new Date().toISOString() })
      .eq("id", orderId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/orders/:id", requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,status")
      .eq("id", orderId)
      .single();

    if (orderError) return res.status(500).json({ error: orderError.message });
    if (!order) return res.status(404).json({ error: "注文が見つかりません" });
    if (order.status !== "調理待ち") {
      return res.status(400).json({ error: "調理待ちの注文だけ削除できます" });
    }

    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (error) return res.status(500).json({ error: error.message });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/orders/:id/confirm-cancel", requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,menu_item_id,quantity,status,menu_items(name,prep_required)")
      .eq("id", orderId)
      .single();

    if (orderError) return res.status(500).json({ error: orderError.message });
    if (!order) return res.status(404).json({ error: "注文が見つかりません" });
    if (order.status !== "キャンセル") {
      return res.status(400).json({ error: "キャンセルされた注文だけ確認済みにできます" });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ cancel_confirmed_at: new Date().toISOString() })
      .eq("id", orderId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/orders/:id/call-staff", async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,menu_item_id,quantity,status,menu_items(name)")
      .eq("id", orderId)
      .single();

    if (orderError) return res.status(500).json({ error: orderError.message });
    if (!order) return res.status(404).json({ error: "注文が見つかりません" });
    if (order.status !== "調理中") {
      return res.status(400).json({ error: "調理中の注文だけスタッフを呼べます" });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ staff_called_at: new Date().toISOString() })
      .eq("id", orderId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/orders/:id/confirm-staff-call", requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data, error } = await supabase
      .from("orders")
      .update({ staff_call_confirmed_at: new Date().toISOString() })
      .eq("id", orderId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/orders/:id/start-cooking", requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,menu_item_id,quantity,status,menu_items(name)")
      .eq("id", orderId)
      .single();

    if (orderError) return res.status(500).json({ error: orderError.message });
    if (!order) return res.status(404).json({ error: "注文が見つかりません" });
    if (order.status !== "調理待ち") {
      return res.status(400).json({ error: "調理待ちの注文だけ調理開始できます" });
    }

    const joinedMenu = Array.isArray(order.menu_items)
      ? order.menu_items[0]
      : (order.menu_items as any);
    const menuName = joinedMenu?.name;
    const prepRequired = Boolean(joinedMenu?.prep_required);

    if (!prepRequired) {
      const { data: recipes, error: recipesError } = await supabase
        .from("recipes")
        .select("item_id,quantity")
        .eq("menu_item_id", order.menu_item_id);

      if (recipesError) {
        return res.status(500).json({ error: recipesError.message });
      }
      if (!recipes || recipes.length === 0) {
        return res.status(400).json({ error: "このメニューにはレシピが登録されていません" });
      }

      const movements = recipes.map((recipe) => ({
        item_id: recipe.item_id,
        delta: -Number(recipe.quantity) * Number(order.quantity),
        reason: `注文使用:${menuName ?? "メニュー"}`,
      }));

      const { error: insertError } = await supabase
        .from("stock_movements")
        .insert(movements);

      if (insertError) return res.status(500).json({ error: insertError.message });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "調理中" })
      .eq("id", orderId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/orders/:id/complete", requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,menu_item_id,quantity,status,menu_items(name)")
      .eq("id", orderId)
      .single();

    if (orderError) return res.status(500).json({ error: orderError.message });
    if (!order) return res.status(404).json({ error: "注文が見つかりません" });
    if (order.status !== "調理中") {
      return res.status(400).json({ error: "調理中の注文だけ完了できます" });
    }

    const { data: completed, error: completeError } = await supabase
      .from("orders")
      .update({ status: "完了", completed_at: new Date().toISOString() })
      .eq("id", orderId)
      .select()
      .single();

    if (completeError) {
      return res.status(500).json({ error: completeError.message });
    }

    res.json(completed);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/items/:id", requireAdmin, async (req, res) => {
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

app.patch("/items/:id", requireAdmin, async (req, res) => {
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

app.delete("/stock-movements/:id", requireAdmin, async (req, res) => {
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
