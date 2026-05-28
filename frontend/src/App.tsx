import { useEffect, useState } from "react";
import { fetchItems, type Item, createItem,deleteItem,updateItem } from "./api/items";
import { createStockMovement, fetchStockMovements, deleteStockMovement, fetchWasteSummary, type StockMovement, type WasteSummary } from "./api/stockMovements";
import {
  addRecipe,
  completeOrder,
  createMenuItem,
  createOrder,
  deleteMenuItem,
  deleteRecipe,
  fetchMenuItems,
  fetchOrders,
  getJoinedName,
  type MenuItem,
  type Order,
} from "./api/orders";


export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // ✅ 追加：商品ごとの数量入力を保持（key=item.id, value=入力文字列）
  const [qtyById, setQtyById] = useState<Record<string, string>>({});

  // 既に作っている商品追加フォーム用（あるならそのまま）
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPar, setNewPar] = useState<string>("");

  const [openHistoryItemId, setOpenHistoryItemId] = useState<string | null>(null);
  const [history, setHistory] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [wasteSummaries, setWasteSummaries] = useState<WasteSummary[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [newMenuName, setNewMenuName] = useState("");
  const [recipeMenuId, setRecipeMenuId] = useState("");
  const [recipeItemId, setRecipeItemId] = useState("");
  const [recipeQuantity, setRecipeQuantity] = useState("1");
  const [orderMenuId, setOrderMenuId] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("1");

  const [editingId, setEditingId] = useState<string | null>(null);
const [editName, setEditName] = useState("");
const [editUnit, setEditUnit] = useState("");
const [editCategory, setEditCategory] = useState("");
const [editPar, setEditPar] = useState<string>(""); // 入力欄は文字列で持つのが安全

const [categoryFilter, setCategoryFilter] = useState("");
const [onlyLow, setOnlyLow] = useState(false);
const [activeTab, setActiveTab] = useState<"low-stock" | "waste" | "inventory" | "orders">("low-stock");



const startEdit = (item: Item) => {
  setEditingId(item.id);
  setEditName(item.name);
  setEditUnit(item.unit);
  setEditCategory(item.category ?? "");
  setEditPar(item.par_level !== null ? String(item.par_level) : "");
};

const cancelEdit = () => {
  setEditingId(null);
  setEditName("");
  setEditUnit("");
  setEditCategory("");
  setEditPar("");
};


  const loadHistory = async (itemId: string) => {
  try {
    setHistoryLoading(true);
    setError(null);
    const data = await fetchStockMovements({ item_id: itemId, limit: 30 });
    setHistory(data);
    setOpenHistoryItemId(itemId);
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setHistoryLoading(false);
  }
};

  
  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, wasteData, menuData, orderData] = await Promise.all([
        fetchItems(),
        fetchWasteSummary(),
        fetchMenuItems(),
        fetchOrders(),
      ]);
      setItems(data);
      setWasteSummaries(wasteData);
      setMenuItems(menuData);
      setOrders(orderData);

      if (!recipeMenuId && menuData.length > 0) {
        setRecipeMenuId(menuData[0].id);
      }
      if (!recipeItemId && data.length > 0) {
        setRecipeItemId(data[0].id);
      }
      if (!orderMenuId && menuData.length > 0) {
        setOrderMenuId(menuData[0].id);
      }

      // ✅ 追加：新しく出てきたitemに数量初期値を入れておく（空欄→"1"）
      setQtyById((prev) => {
        const next = { ...prev };
        for (const it of data) {
          if (next[it.id] === undefined) next[it.id] = "1";
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const moveStock = async (itemId: string, delta: number, reason: string) => {
    try {
      setError(null);
      await createStockMovement({ item_id: itemId, delta, reason });
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // 入力欄の数量を使って在庫を増減する
  const moveWithQty = async (
    itemId: string,
    sign: 1 | -1,
    reason: string
  ) => {
    const raw = qtyById[itemId] ?? "1";
    const qty = Number(raw);

    // 入力チェック（初心者がハマりやすい）
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("数量は 1以上の数値を入力してください");
      return;
    }

    await moveStock(itemId, sign * qty, reason);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const getCategoryLabel = (item: Item) => item.category?.trim() || "未分類";

  const categoryOrder = [
    "野菜",
    "果物",
    "肉",
    "魚",
    "魚介",
    "海藻",
    "乾物",
    "米",
    "麺",
    "粉物",
    "乳製品",
    "卵",
    "調味料",
    "ソース",
    "油",
    "冷凍",
    "ドリンク",
    "消耗品",
  ];

  const getCategoryOrder = (category: string) => {
    if (category === "その他") return 998;
    if (category === "未分類") return 999;

    const index = categoryOrder.findIndex((name) => category.includes(name));
    return index === -1 ? 900 : index;
  };

  const categories = Array.from(
    new Set(items.map((item) => getCategoryLabel(item)))
  ).sort((a, b) => {
    const orderDiff = getCategoryOrder(a) - getCategoryOrder(b);
    if (orderDiff !== 0) return orderDiff;
    return a.localeCompare(b, "ja");
  });

  const categorySummaries = categories
    .map((category) => {
      const categoryItems = items.filter(
        (item) => getCategoryLabel(item) === category
      );
      const lowCount = categoryItems.filter(
        (item) =>
          item.par_level !== null && item.current_stock < item.par_level
      ).length;
      const totalStock = categoryItems.reduce(
        (sum, item) => sum + item.current_stock,
        0
      );

      return {
        category,
        itemCount: categoryItems.length,
        lowCount,
        totalStock,
      };
    })
    .sort((a, b) => {
      const orderDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
      if (orderDiff !== 0) return orderDiff;
      return a.category.localeCompare(b.category, "ja");
    });

  const lowStockItems = items
    .filter(
      (item) => item.par_level !== null && item.current_stock < item.par_level
    )
    .map((item) => ({
      ...item,
      shortage: (item.par_level ?? 0) - item.current_stock,
    }))
    .sort((a, b) => {
      if (b.shortage !== a.shortage) return b.shortage - a.shortage;
      return a.name.localeCompare(b.name, "ja");
    });

  const orderListByCategory = categories
    .map((category) => ({
      category,
      items: lowStockItems.filter(
        (item) => getCategoryLabel(item) === category
      ),
    }))
    .filter((group) => group.items.length > 0);

  const orderListText = orderListByCategory
    .map((group) => {
      const lines = group.items.map(
        (item) => `- ${item.name}: ${item.shortage}${item.unit}`
      );
      return [`【${group.category}】`, ...lines].join("\n");
    })
    .join("\n\n");

  const copyOrderList = async () => {
    if (!orderListText) return;

    try {
      await navigator.clipboard.writeText(`発注リスト\n${orderListText}`);
      setCopyMessage("発注リストをコピーしました");
    } catch (e) {
      setCopyMessage("コピーに失敗しました");
    }
  };

  const totalWasteQty = wasteSummaries.reduce(
    (sum, item) => sum + item.waste_qty,
    0
  );

  const applySuggestedParLevel = async (summary: WasteSummary) => {
    if (summary.suggested_par_level === null) return;

    try {
      setError(null);
      await updateItem(summary.item_id, {
        par_level: summary.suggested_par_level,
      });
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const pendingOrders = orders.filter((order) => order.status !== "完了");

  const addMenu = async () => {
    const name = newMenuName.trim();
    if (!name) {
      setError("メニュー名を入力してください");
      return;
    }

    try {
      setError(null);
      const created = await createMenuItem(name);
      setNewMenuName("");
      setRecipeMenuId(created.id);
      setOrderMenuId(created.id);
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const addRecipeItem = async () => {
    const quantity = Number(recipeQuantity);
    if (!recipeMenuId || !recipeItemId || !Number.isFinite(quantity) || quantity <= 0) {
      setError("メニュー、食材、1以上の使用量を入力してください");
      return;
    }

    try {
      setError(null);
      await addRecipe({
        menu_item_id: recipeMenuId,
        item_id: recipeItemId,
        quantity,
      });
      setRecipeQuantity("1");
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeMenu = async (menu: MenuItem) => {
    if (!confirm(`「${menu.name}」を削除しますか？（レシピも削除されます）`)) {
      return;
    }

    try {
      setError(null);
      await deleteMenuItem(menu.id);
      if (recipeMenuId === menu.id) setRecipeMenuId("");
      if (orderMenuId === menu.id) setOrderMenuId("");
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const addOrder = async () => {
    const quantity = Number(orderQuantity);
    if (!orderMenuId || !Number.isFinite(quantity) || quantity <= 0) {
      setError("メニューと1以上の注文数を入力してください");
      return;
    }

    try {
      setError(null);
      await createOrder({ menu_item_id: orderMenuId, quantity });
      setOrderQuantity("1");
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const finishOrder = async (orderId: string) => {
    try {
      setError(null);
      await completeOrder(orderId);
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const visibleItems = items
  .filter((it) => {
    if (!categoryFilter) return true;
    return getCategoryLabel(it) === categoryFilter;
  })
  .filter((it) => {
    if (!onlyLow) return true;
    if (it.par_level === null) return false;
    return it.current_stock < it.par_level;
  })
  .slice()
  .sort((a, b) => {
    return a.name.localeCompare(b.name, "ja");
  });

  const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  fontSize: 14,
  color: "#111827",
  fontWeight: 700,
  borderBottom: "1px solid #ddd",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  verticalAlign: "top",
  color: "#111827",
  borderBottom: "1px solid #eee",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
};

const inputStyle: React.CSSProperties = {
  minHeight: 34,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #9ca3af",
  color: "#111827",
  backgroundColor: "#fff",
  fontWeight: 500,
};

const fieldLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#111827",
  fontSize: 14,
  fontWeight: 700,
};

const buttonStyle: React.CSSProperties = {
  color: "#111827",
  backgroundColor: "#fff",
  border: "1px solid #9ca3af",
  borderRadius: 6,
  fontWeight: 600,
  cursor: "pointer",
};

const tabButtonStyle = (selected: boolean): React.CSSProperties => ({
  ...buttonStyle,
  padding: "10px 14px",
  borderColor: selected ? "#2563eb" : "#9ca3af",
  backgroundColor: selected ? "#eff6ff" : "#fff",
  color: "#111827",
});


  return (
  <div
    style={{
      minHeight: "100vh",
      backgroundColor: "#f4f6f8",
      color: "#111827",
      padding: "40px 0",
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}
  >
    <div
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        background: "white",
        color: "#111827",
        padding: 24,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >

      <h1>在庫一覧</h1>

      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => setActiveTab("low-stock")}
          style={tabButtonStyle(activeTab === "low-stock")}
        >
          低在庫
        </button>
        <button
          onClick={() => setActiveTab("waste")}
          style={tabButtonStyle(activeTab === "waste")}
        >
          廃棄分析
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          style={tabButtonStyle(activeTab === "inventory")}
        >
          在庫管理
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          style={tabButtonStyle(activeTab === "orders")}
        >
          注文管理
        </button>
      </nav>

      {activeTab === "low-stock" && (
      <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(300px, 0.9fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <section
          style={{
            ...sectionStyle,
            marginTop: 0,
            border:
              lowStockItems.length > 0 ? "1px solid #fca5a5" : "1px solid #ddd",
            background: lowStockItems.length > 0 ? "#fef2f2" : "#fff",
          }}
        >
          <h2 style={{ margin: "0 0 8px" }}>低在庫アラート</h2>

          {lowStockItems.length === 0 ? (
            <p style={{ margin: 0 }}>基準在庫を下回っている商品はありません</p>
          ) : (
            <p style={{ margin: "0 0 12px" }}>
              {lowStockItems.length}件の商品が基準在庫を下回っています。
            </p>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>発注リスト</h3>
            <button
              onClick={copyOrderList}
              disabled={orderListByCategory.length === 0}
            >
              コピー
            </button>
          </div>

          {orderListByCategory.length === 0 ? (
            <p style={{ margin: 0 }}>発注が必要な商品はありません</p>
          ) : (
            <>
              {orderListByCategory.map((group) => (
                <div key={group.category} style={{ marginTop: 12 }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: 15 }}>
                    {group.category}
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {group.items.map((item) => (
                      <li key={item.id} style={{ marginBottom: 6 }}>
                        {item.name}: {item.shortage}
                        {item.unit} 発注
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}

          {copyMessage && (
            <p style={{ margin: "12px 0 0", fontSize: 14 }}>
              {copyMessage}
            </p>
          )}
        </section>
      </div>
      </>
      )}

      {activeTab === "orders" && (
      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 12px" }}>注文管理</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>メニュー登録</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="メニュー名（例：唐揚げ定食）"
                value={newMenuName}
                onChange={(e) => setNewMenuName(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addMenu} disabled={loading}>
                追加
              </button>
            </div>

	            <h3 style={{ margin: "16px 0 8px", fontSize: 16 }}>レシピ登録</h3>
	            <p style={{ margin: "0 0 8px", fontSize: 14 }}>
	              メニューを選び、そのメニュー1個を作るために使う食材と量を登録します。
	            </p>
	            <div style={{ display: "grid", gap: 8 }}>
	              <label style={fieldLabelStyle}>
	                メニュー
	                <select
	                  value={recipeMenuId}
	                  onChange={(e) => setRecipeMenuId(e.target.value)}
	                  style={inputStyle}
	                >
	                  <option value="">メニューを選択</option>
	                  {menuItems.map((menu) => (
	                    <option key={menu.id} value={menu.id}>
	                      {menu.name}
	                    </option>
	                  ))}
	                </select>
	              </label>

	              <label style={fieldLabelStyle}>
	                使用する食材
	                <select
	                  value={recipeItemId}
	                  onChange={(e) => setRecipeItemId(e.target.value)}
	                  style={inputStyle}
	                >
	                  <option value="">食材を選択</option>
	                  {items.map((item) => (
	                    <option key={item.id} value={item.id}>
	                      {item.name}（{item.unit}）
	                    </option>
	                  ))}
	                </select>
	              </label>

	              <label style={fieldLabelStyle}>
	                1個あたりの使用量
	                <input
	                  placeholder="例：15"
	                  value={recipeQuantity}
	                  onChange={(e) => setRecipeQuantity(e.target.value)}
	                  style={inputStyle}
	                />
	              </label>

	              <button onClick={addRecipeItem} disabled={loading}>
                レシピに追加
              </button>
            </div>
          </div>

          <div>
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>注文追加</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <select
                value={orderMenuId}
                onChange={(e) => setOrderMenuId(e.target.value)}
                style={inputStyle}
              >
                <option value="">メニューを選択</option>
                {menuItems.map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.name}
                  </option>
                ))}
              </select>

              <input
                placeholder="注文数"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(e.target.value)}
                style={inputStyle}
              />

              <button onClick={addOrder} disabled={loading}>
                注文を追加
              </button>
            </div>

            <h3 style={{ margin: "16px 0 8px", fontSize: 16 }}>注文中</h3>
            {pendingOrders.length === 0 ? (
              <p style={{ margin: 0 }}>注文中の商品はありません</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {pendingOrders.map((order) => (
                  <li key={order.id} style={{ marginBottom: 8 }}>
                    {getJoinedName(order.menu_items)} × {order.quantity}
                    <button
                      onClick={() => finishOrder(order.id)}
                      disabled={loading}
                      style={{ marginLeft: 8 }}
                    >
                    完了して使用
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {menuItems.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>登録済みレシピ</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {menuItems.map((menu) => (
                <div
                  key={menu.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #ddd",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <strong>{menu.name}</strong>
                    <button
                      onClick={() => removeMenu(menu)}
                      disabled={loading}
                      style={buttonStyle}
                    >
                      メニュー削除
                    </button>
                  </div>
                  {menu.recipes.length === 0 ? (
                    <p style={{ margin: "8px 0 0" }}>レシピ未登録</p>
                  ) : (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                      {menu.recipes.map((recipe) => (
                        <li key={recipe.id} style={{ marginBottom: 6 }}>
                          {getJoinedName(recipe.items)}: {recipe.quantity}
                          <button
                            onClick={async () => {
                              try {
                                setError(null);
                                await deleteRecipe(recipe.id);
                                await loadItems();
                              } catch (e) {
                                setError(e instanceof Error ? e.message : String(e));
                              }
                            }}
                            disabled={loading}
                            style={{ marginLeft: 8 }}
                          >
                            削除
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      )}

      {activeTab === "waste" && (
      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 12px" }}>廃棄分析</h2>

        {wasteSummaries.length === 0 ? (
          <p style={{ margin: 0 }}>廃棄として記録された商品はありません</p>
        ) : (
          <>
            <p style={{ margin: "0 0 12px" }}>
              累計廃棄数: {totalWasteQty}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {wasteSummaries.map((summary) => {
                const canApply =
                  summary.suggested_par_level !== null &&
                  summary.suggested_par_level !== summary.par_level;

                return (
                  <div
                    key={summary.item_id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "#fff",
                    }}
                  >
                    <strong>{summary.name}</strong>
                    <div style={{ marginTop: 8, fontSize: 14 }}>
                      カテゴリ: {summary.category || "未分類"}
                    </div>
                    <div style={{ fontSize: 14 }}>
                      廃棄: {summary.waste_qty}
                      {summary.unit} / {summary.waste_count}回
                    </div>
                    <div style={{ fontSize: 14 }}>
                      現在の基準在庫: {summary.par_level ?? "未設定"}
                    </div>
                    <div style={{ fontSize: 14 }}>
                      見直し案: {summary.suggested_par_level ?? "基準在庫未設定"}
                    </div>

                    <button
                      onClick={() => applySuggestedParLevel(summary)}
                      disabled={!canApply || loading}
                      style={{ marginTop: 8 }}
                    >
                      見直し案を適用
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
      )}

      {activeTab === "inventory" && (
      <>
        <section style={{ ...sectionStyle, marginTop: 0 }}>
          <h2 style={{ margin: "0 0 12px" }}>カテゴリ別まとめ</h2>

          {categorySummaries.length === 0 ? (
            <p style={{ margin: 0 }}>カテゴリはまだありません</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              {categorySummaries.map((summary) => {
                const selected = categoryFilter === summary.category;

                return (
                  <button
                    key={summary.category}
                    onClick={() =>
                      setCategoryFilter(selected ? "" : summary.category)
                    }
                    style={{
                      ...buttonStyle,
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 8,
                      border: selected ? "2px solid #2563eb" : "1px solid #ddd",
                      background: selected ? "#eff6ff" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <strong>{summary.category}</strong>
                    <div style={{ marginTop: 8, fontSize: 14 }}>
                      商品数: {summary.itemCount}
                    </div>
                    <div style={{ fontSize: 14 }}>
                      低在庫:{" "}
                      <span style={{ color: summary.lowCount > 0 ? "red" : "#333" }}>
                        {summary.lowCount}
                      </span>
                    </div>
                    <div style={{ fontSize: 14 }}>
                      合計在庫: {summary.totalStock}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 12px" }}>商品追加</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            placeholder="商品名（例：トマト）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="単位（例：個, g, 本）"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="カテゴリ（例：野菜）"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="基準在庫（任意）"
            value={newPar}
            onChange={(e) => setNewPar(e.target.value)}
            style={inputStyle}
          />

          <button
            onClick={async () => {
              try {
                setError(null);
                await createItem({
                  name: newName.trim(),
                  unit: newUnit.trim(),
                  category: newCategory.trim() || null,
                  par_level: newPar.trim() === "" ? null : Number(newPar),
                });
                setNewName("");
                setNewUnit("");
                setNewCategory("");
                setNewPar("");
                await loadItems();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
            disabled={loading}
            style={{ minHeight: 36 }}
          >
            追加
          </button>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 16,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={onlyLow}
            onChange={(e) => setOnlyLow(e.target.checked)}
          />
          低在庫のみ
        </label>

        <button onClick={loadItems} disabled={loading}>
          更新
        </button>
      </div>

      {loading && <p>読み込み中...</p>}
      {error && (
        <p style={{ color: "red", whiteSpace: "pre-wrap" }}>
          エラー: {error}
        </p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
  <thead>
    <tr style={{ background: "#f0f2f5" }}>
      <th style={thStyle}>商品名</th>
      <th style={thStyle}>カテゴリ</th>
      <th style={thStyle}>在庫</th>
      <th style={thStyle}>操作</th>
    </tr>
  </thead>

  <tbody>
    {visibleItems.map((item) => {
      const low =
        item.par_level !== null && item.current_stock < item.par_level;

      return (
        <>
          <tr key={item.id}>
            <td style={tdStyle}>
              {editingId === item.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="商品名"
                    style={{ marginRight: 8 }}
                  />

                  <input
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="単位（例：個）"
                    style={{ width: 90, marginRight: 8 }}
                  />

                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="カテゴリ"
                    style={{ width: 120, marginRight: 8 }}
                  />

                  <input
                    value={editPar}
                    onChange={(e) => setEditPar(e.target.value)}
                    placeholder="par_level（空でなし）"
                    style={{ width: 140, marginRight: 8 }}
                  />
                </>
              ) : (
                <>
                  <b>{item.name}</b>（{item.unit}）
                  {low && (
                    <span style={{ color: "red", marginLeft: 8 }}>
                      ⚠ 在庫不足（基準 {item.par_level}）
                    </span>
                  )}
                </>
              )}
            </td>

            <td style={tdStyle}>{item.category || "未分類"}</td>

            <td style={tdStyle}>{item.current_stock}</td>

            <td style={tdStyle}>
              {editingId === item.id ? (
                <>
                  <button
                    onClick={async () => {
                      try {
                        setError(null);

                        const name = editName.trim();
                        const unit = editUnit.trim();
                        if (!name || !unit) {
                          setError("商品名と単位は必須です");
                          return;
                        }

                        const par = editPar.trim();
                        const parLevel = par === "" ? null : Number(par);
                        if (par !== "" && !Number.isFinite(parLevel)) {
                          setError("par_level は数値か空欄にしてください");
                          return;
                        }

                        await updateItem(item.id, {
                          name,
                          unit,
                          category: editCategory.trim() || null,
                          par_level: parLevel,
                        });

                        cancelEdit();
                        await loadItems();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    disabled={loading}
                    style={{ marginRight: 6 }}
                  >
                    保存
                  </button>

                  <button
                    onClick={cancelEdit}
                    disabled={loading}
                  >
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <input
                    value={qtyById[item.id] ?? "1"}
                    onChange={(e) =>
                      setQtyById((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    style={{ width: 60, marginRight: 6 }}
                  />

                  <button
                    onClick={() => moveWithQty(item.id, 1, "仕入れ")}
                    disabled={loading}
                    style={{ marginRight: 6 }}
                  >
                    仕入れ
                  </button>

                  <button
                    onClick={() => moveWithQty(item.id, -1, "使用")}
                    disabled={loading}
                    style={{ marginRight: 6 }}
                  >
                    使用
                  </button>

                  <button
                    onClick={() => moveWithQty(item.id, -1, "廃棄")}
                    disabled={loading}
                    style={{ marginRight: 6 }}
                  >
                    廃棄
                  </button>

                  <button
                    onClick={() => moveWithQty(item.id, -1, "棚卸し修正")}
                    disabled={loading}
                    style={{ marginRight: 6 }}
                  >
                    在庫修正
                  </button>

                  <button
                    onClick={() => {
                      if (openHistoryItemId === item.id) {
                        setOpenHistoryItemId(null);
                        setHistory([]);
                      } else {
                        loadHistory(item.id);
                      }
                    }}
                    disabled={loading || historyLoading}
                    style={{ marginRight: 6 }}
                  >
                    履歴
                  </button>

                  <button
                    onClick={async () => {
                      if (
                        !confirm(`「${item.name}」を削除しますか？（履歴も消えます）`)
                      ) {
                        return;
                      }

                      try {
                        setError(null);
                        await deleteItem(item.id);
                        await loadItems();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    disabled={loading}
                    style={{ marginRight: 6 }}
                  >
                    削除
                  </button>

                  <button
                    onClick={() => startEdit(item)}
                    disabled={loading}
                  >
                    商品編集
                  </button>
                </>
              )}
            </td>
          </tr>

          {openHistoryItemId === item.id && (
            <tr key={`${item.id}-history`}>
              <td colSpan={4} style={tdStyle}>
                <div style={{ paddingLeft: 12 }}>
                  {historyLoading && <p>履歴読み込み中...</p>}

                  {!historyLoading && history.length === 0 && (
                    <p>履歴がありません</p>
                  )}

                  {!historyLoading && history.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {history.map((h) => (
                        <li key={h.id} style={{ marginBottom: 6 }}>
                          {new Date(h.created_at).toLocaleString()} /{" "}
                          {h.delta >= 0
                            ? `${h.reason ?? "仕入れ"} +${h.delta}${item.unit}`
                            : `${h.reason ?? "使用"} -${Math.abs(h.delta)}${item.unit}`}
                          {h.reason && ` / ${h.reason}`}

                          <button
                            style={{ marginLeft: 8 }}
                            onClick={async () => {
                              if (
                                !confirm("この履歴を削除しますか？（在庫も変わります）")
                              ) {
                                return;
                              }

                              try {
                                setError(null);
                                await deleteStockMovement(h.id);
                                await loadHistory(item.id);
                                await loadItems();
                              } catch (e) {
                                setError(
                                  e instanceof Error ? e.message : String(e)
                                );
                              }
                            }}
                            disabled={loading || historyLoading}
                          >
                            削除
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </td>
            </tr>
          )}
        </>
      );
    })}
  </tbody>
</table>


      {!loading && !error && items.length === 0 && (
        <p>商品がまだ登録されていません</p>
      )}
      </>
      )}
    </div>
    </div>
  );
}
