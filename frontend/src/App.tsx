import { useEffect, useState } from "react";
import { fetchItems, type Item, createItem,deleteItem,updateItem } from "./api/items";
import { createStockMovement, fetchStockMovements, deleteStockMovement, type StockMovement } from "./api/stockMovements";


export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const [editingId, setEditingId] = useState<string | null>(null);
const [editName, setEditName] = useState("");
const [editUnit, setEditUnit] = useState("");
const [editCategory, setEditCategory] = useState("");
const [editPar, setEditPar] = useState<string>(""); // 入力欄は文字列で持つのが安全

const [query, setQuery] = useState("");
const [categoryFilter, setCategoryFilter] = useState("");
const [onlyLow, setOnlyLow] = useState(false);
const [sortKey, setSortKey] = useState<"name" | "stock" | "created_at">("name");
const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");



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
      const data = await fetchItems();
      setItems(data);

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

  const moveStock = async (itemId: string, delta: number) => {
    try {
      setError(null);
      await createStockMovement({ item_id: itemId, delta });
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // ✅ 追加：入力欄の数量を使って入出庫する
  const moveWithQty = async (itemId: string, sign: 1 | -1) => {
    const raw = qtyById[itemId] ?? "1";
    const qty = Number(raw);

    // 入力チェック（初心者がハマりやすい）
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("数量は 1以上の数値を入力してください");
      return;
    }

    await moveStock(itemId, sign * qty);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const categories = Array.from(
    new Set(
      items
        .map((item) => item.category?.trim())
        .filter((category): category is string => Boolean(category))
    )
  ).sort((a, b) => a.localeCompare(b, "ja"));

  const visibleItems = items
  .filter((it) => it.name.toLowerCase().includes(query.trim().toLowerCase()))
  .filter((it) => {
    if (!categoryFilter) return true;
    return (it.category ?? "") === categoryFilter;
  })
  .filter((it) => {
    if (!onlyLow) return true;
    if (it.par_level === null) return false;
    return it.current_stock < it.par_level;
  })
  .slice()
  .sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;

    if (sortKey === "name") {
      return a.name.localeCompare(b.name, "ja") * dir;
    }

    if (sortKey === "stock") {
      return (a.current_stock - b.current_stock) * dir;
    }

    // created_at は無い場合もあるので安全に
    const at = a.created_at ? Date.parse(a.created_at) : 0;
    const bt = b.created_at ? Date.parse(b.created_at) : 0;
    return (at - bt) * dir;
  });

  const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  fontSize: 14,
  borderBottom: "1px solid #ddd",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  verticalAlign: "top",
  borderBottom: "1px solid #eee",
};


  return (
  <div
    style={{
      minHeight: "100vh",
      backgroundColor: "#f4f6f8",
      padding: "40px 0",
      fontFamily: "sans-serif",
    }}
  >
    <div
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        background: "white",
        padding: 24,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >

      <h1>在庫一覧</h1>

      <div style={{ marginTop: 12, marginBottom: 16 }}>
  <input
    placeholder="検索（商品名）"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    style={{ marginRight: 8 }}
  />

  <label style={{ marginRight: 12 }}>
    <input
      type="checkbox"
      checked={onlyLow}
      onChange={(e) => setOnlyLow(e.target.checked)}
    />{" "}
    低在庫のみ
  </label>

  <select
    value={categoryFilter}
    onChange={(e) => setCategoryFilter(e.target.value)}
    style={{ marginRight: 8 }}
  >
    <option value="">全カテゴリ</option>
    {categories.map((category) => (
      <option key={category} value={category}>
        {category}
      </option>
    ))}
  </select>

  <select
    value={sortKey}
    onChange={(e) => setSortKey(e.target.value as "name" | "stock" | "created_at")}
    style={{ marginRight: 8 }}
  >
    <option value="name">名前</option>
    <option value="stock">在庫</option>
    <option value="created_at">作成日</option>
  </select>

  <select
    value={sortDir}
    onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
  >
    <option value="asc">昇順</option>
    <option value="desc">降順</option>
  </select>
</div>


      {/* 既に「商品追加」がある前提：なければこのブロックは削ってOK */}
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <h2 style={{ margin: "8px 0" }}>商品追加</h2>

        <input
          placeholder="商品名（例：トマト）"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          placeholder="単位（例：個, g, 本）"
          value={newUnit}
          onChange={(e) => setNewUnit(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          placeholder="カテゴリ（例：野菜）"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          placeholder="par_level（任意）"
          value={newPar}
          onChange={(e) => setNewPar(e.target.value)}
          style={{ width: 140, marginRight: 8 }}
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
        >
          追加
        </button>
      </div>

      <button onClick={loadItems} disabled={loading}>
        更新
      </button>

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
                    onClick={() => moveWithQty(item.id, 1)}
                    disabled={loading}
                    style={{ marginRight: 6 }}
                  >
                    入庫
                  </button>

                  <button
                    onClick={() => moveWithQty(item.id, -1)}
                    disabled={loading}
                    style={{ marginRight: 6 }}
                  >
                    出庫
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
                    編集
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
                            ? `入庫 ${h.delta}${item.unit}`
                            : `出庫 ${Math.abs(h.delta)}${item.unit}`}

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
    </div>
    </div>
  );
}
