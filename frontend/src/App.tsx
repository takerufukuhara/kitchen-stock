import { Fragment, useEffect, useState } from "react";
import { fetchItems, type Item, createItem,deleteItem,updateItem } from "./api/items";
import { createStockMovement, fetchStockMovements, deleteStockMovement, fetchWasteSummary, type StockMovement, type WasteSummary } from "./api/stockMovements";
import {
  addRecipe,
  cancelOrder,
  cancelStaffCall,
  checkoutCustomerGroup,
  completeOrder,
  confirmStandaloneStaffCall,
  confirmOrderCancellation,
  confirmStaffCall,
  createCustomerGroup,
  createClosingReport,
  createOpeningChecklistItem,
  createOpeningReport,
  deleteOpeningChecklistItem,
  createStaffCall,
  createMenuItem,
  createOrder,
  deleteMenuItem,
  deleteOrder,
  deleteRecipe,
  fetchCustomerGroup,
  fetchCustomerGroupOptions,
  fetchClosingReports,
  fetchOpeningChecklistItems,
  fetchOpeningReports,
  fetchMenuItems,
  fetchPublicMenuItems,
  fetchOrderStatus,
  fetchOrders,
  fetchStaffCall,
  fetchStaffCalls,
  getJoinedName,
  requestCustomerGroupCheckout,
  startCookingOrder,
  updateMenuItem,
  type CustomerGroup,
  type CustomerGroupOption,
  type ClosingReport,
  type OpeningChecklistItem,
  type OpeningReport,
  type MenuItem,
  type Order,
  type StaffCall,
} from "./api/orders";
import {
  clearAdminToken,
  getAdminToken,
  loginAdmin,
  setAdminToken,
} from "./api/auth";

const CUSTOMER_ORDER_IDS_KEY = "kitchen-stock-customer-order-ids";
const CUSTOMER_GROUP_ID_KEY = "kitchen-stock-customer-group-id";
const CUSTOMER_CHECKOUT_REQUESTED_KEY = "kitchen-stock-checkout-requested";
const CLOSING_CHECKLIST_KEY_PREFIX = "kitchen-stock-closing-checklist";
const CLOSING_FINISHED_KEY_PREFIX = "kitchen-stock-closing-finished";
const HIDDEN_CLOSING_CHECKLIST_ITEMS_KEY = "kitchen-stock-hidden-closing-checklist-items";
const CUSTOM_CLOSING_CHECKLIST_ITEMS_KEY = "kitchen-stock-custom-closing-checklist-items";
const OPENING_CHECKLIST_KEY_PREFIX = "kitchen-stock-opening-checklist";
const OPENING_FINISHED_KEY_PREFIX = "kitchen-stock-opening-finished";
const HIDDEN_OPENING_CHECKLIST_ITEMS_KEY = "kitchen-stock-hidden-opening-checklist-items";

const normalizeNumberInput = (value: string) =>
  value
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .replace(/[．。]/g, ".")
    .replace(/[－ー]/g, "-")
    .trim();

const parseNumberInput = (value: string) => Number(normalizeNumberInput(value));

const normalizeItemNameInput = (value: string) =>
  value.replace(/\s+/g, "").replace(/　+/g, "").trim();

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/login") {
    return <AdminLoginPage />;
  }

  if (path === "/admin") {
    return <AdminRoute />;
  }

  return <CustomerOrderPage />;
}

function AdminRoute() {
  const [loggedIn, setLoggedIn] = useState(
    () => Boolean(getAdminToken())
  );

  const handleLogout = () => {
    clearAdminToken();
    setLoggedIn(false);
    window.location.href = "/login";
  };

  if (!loggedIn) {
    window.location.href = "/login";
    return null;
  }

  return <AdminApp onLogout={handleLogout} />;
}

function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    minHeight: 38,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #9ca3af",
    color: "#111827",
    backgroundColor: "#fff",
    fontWeight: 500,
  };

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      const token = await loginAdmin(password);
      setAdminToken(token);
      setPassword("");
      window.location.href = "/admin";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="customer-page"
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f6f8",
        color: "#111827",
        padding: "40px 16px",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <main
        className="login-shell"
        style={{
          maxWidth: 420,
          margin: "0 auto",
          background: "#fff",
          padding: 24,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 8px" }}>管理者ログイン</h1>
        <p style={{ margin: "0 0 20px", color: "#4b5563" }}>
          在庫管理画面を開くにはパスワードを入力してください。
        </p>

        <form onSubmit={submitLogin} style={{ display: "grid", gap: 12 }}>
          <input
            type="password"
            placeholder="管理者パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          {error && (
            <p style={{ margin: 0, color: "red", whiteSpace: "pre-wrap" }}>
              エラー: {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              minHeight: 40,
              color: "#fff",
              backgroundColor: "#2563eb",
              border: "1px solid #2563eb",
              borderRadius: 6,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {submitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </main>
    </div>
  );
}

function CustomerOrderPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [quantityByMenuId, setQuantityByMenuId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submittingOrderList, setSubmittingOrderList] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [callingStaff, setCallingStaff] = useState(false);
  const [staffCalled, setStaffCalled] = useState(false);
  const [activeStaffCallId, setActiveStaffCallId] = useState<string | null>(null);
  const [customerGroup, setCustomerGroup] = useState<CustomerGroup | null>(null);
  const [customerGroupOptions, setCustomerGroupOptions] = useState<CustomerGroupOption[]>([]);
  const [selectedGroupLabel, setSelectedGroupLabel] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerOrderHistory, setCustomerOrderHistory] = useState<Order[]>([]);
  const [customerOrdersOpen, setCustomerOrdersOpen] = useState(false);
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false);
  const [orderListOpen, setOrderListOpen] = useState(false);
  const [openMenuCategory, setOpenMenuCategory] = useState<string | null>(null);
  const [orderList, setOrderList] = useState<
    { menu_item_id: string; name: string; quantity: number }[]
  >([]);
  const [checkoutRequested, setCheckoutRequested] = useState(
    () => window.localStorage.getItem(CUSTOMER_CHECKOUT_REQUESTED_KEY) === "true"
  );
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    minHeight: 38,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #9ca3af",
    color: "#111827",
    backgroundColor: "#fff",
    fontWeight: 500,
  };

  const buttonStyle: React.CSSProperties = {
    minHeight: 40,
    color: "#fff",
    backgroundColor: "#2563eb",
    border: "1px solid #2563eb",
  borderRadius: 6,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  };

  const actionBarItemStyle: React.CSSProperties = {
    margin: 0,
    padding: 0,
    border: 0,
    background: "transparent",
  };

  const compactHeaderButtonStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 28,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    margin: 0,
    padding: "5px 8px",
    color: "#111827",
    background: "#fff",
    border: "1px solid #9ca3af",
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  };

  useEffect(() => {
    const loadMenus = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPublicMenuItems();
        setMenuItems(data);
        setQuantityByMenuId((prev) => {
          const next = { ...prev };
          for (const menu of data) {
            if (next[menu.id] === undefined) next[menu.id] = "1";
          }
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    loadMenus();
  }, []);

  const getStoredCustomerOrderIds = () => {
    try {
      const raw = window.localStorage.getItem(CUSTOMER_ORDER_IDS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  };

  const saveStoredCustomerOrderIds = (ids: string[]) => {
    window.localStorage.setItem(CUSTOMER_ORDER_IDS_KEY, JSON.stringify(ids));
  };

  const refreshCustomerGroupOptions = async () => {
    const options = await fetchCustomerGroupOptions();
    setCustomerGroupOptions(options);
    setSelectedGroupLabel((current) => current || options[0]?.label || "");
  };

  useEffect(() => {
    const loadCustomerGroup = async () => {
      const groupId = window.localStorage.getItem(CUSTOMER_GROUP_ID_KEY);

      try {
        await refreshCustomerGroupOptions();

        if (!groupId) return;

        const group = await fetchCustomerGroup(groupId);
        if (group.closed_at) {
          resetCustomerSession();
          return;
        }

        setCustomerGroup(group);
        setSelectedGroupLabel(group.label ?? "");
      } catch {
        window.localStorage.removeItem(CUSTOMER_GROUP_ID_KEY);
      }
    };

    loadCustomerGroup();
  }, []);

  const startCustomerGroup = async () => {
    try {
      setCreatingGroup(true);
      setError(null);
      const label = selectedGroupLabel || customerGroupOptions[0]?.label || "";
      const group = await createCustomerGroup(label);
      window.localStorage.setItem(CUSTOMER_GROUP_ID_KEY, group.id);
      window.localStorage.removeItem(CUSTOMER_CHECKOUT_REQUESTED_KEY);
      setCustomerGroup(group);
      setCheckoutRequested(false);
      setOrderList([]);
      setSelectedGroupLabel(group.label ?? "");
      await refreshCustomerGroupOptions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingGroup(false);
    }
  };

  const resetCustomerSession = () => {
    window.localStorage.removeItem(CUSTOMER_GROUP_ID_KEY);
    window.localStorage.removeItem(CUSTOMER_ORDER_IDS_KEY);
    window.localStorage.removeItem(CUSTOMER_CHECKOUT_REQUESTED_KEY);
    setCustomerGroup(null);
    setCustomerOrders([]);
    setCustomerOrderHistory([]);
    setCustomerOrdersOpen(false);
    setCustomerHistoryOpen(false);
    setOrderListOpen(false);
    setOpenMenuCategory(null);
    setOrderList([]);
    setCheckoutRequested(false);
  };

  const refreshCustomerOrders = async () => {
    const ids = getStoredCustomerOrderIds();
    if (ids.length === 0) {
      setCustomerOrders([]);
      setCustomerOrderHistory([]);
      return;
    }

    const results = await Promise.allSettled(
      ids.map((id) => fetchOrderStatus(id))
    );
    const fetchedOrders = results
      .filter(
        (result): result is PromiseFulfilledResult<Order> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value);
    const visibleOrders = fetchedOrders.filter(
      (order) =>
        order.status !== "完了" &&
        !(order.status === "キャンセル" && order.cancel_confirmed_at)
    );
    const historyOrders = fetchedOrders.filter(
      (order) =>
        order.status === "完了" ||
        (order.status === "キャンセル" && Boolean(order.cancel_confirmed_at))
    );

    setCustomerOrders(visibleOrders);
    setCustomerOrderHistory(historyOrders);
    saveStoredCustomerOrderIds(fetchedOrders.map((order) => order.id));
  };

  useEffect(() => {
    refreshCustomerOrders();
    const intervalId = window.setInterval(refreshCustomerOrders, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!customerGroup) return;

    const intervalId = window.setInterval(async () => {
      try {
        const group = await fetchCustomerGroup(customerGroup.id);
        if (group.closed_at) {
          resetCustomerSession();
          await refreshCustomerGroupOptions();
          return;
        }

        setCustomerGroup(group);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [customerGroup]);

  useEffect(() => {
    if (!activeStaffCallId) return;

    const intervalId = window.setInterval(async () => {
      try {
        const call = await fetchStaffCall(activeStaffCallId);
        if (call.confirmed_at || call.cancelled_at) {
          setActiveStaffCallId(null);
          setStaffCalled(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [activeStaffCallId]);

  const addToOrderList = (menu: MenuItem) => {
    if (!customerGroup) {
      setError("先にお客様グループを作成してください");
      return;
    }

    const quantity = parseNumberInput(quantityByMenuId[menu.id] ?? "1");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("数量は1以上の数値を入力してください");
      return;
    }

    setError(null);
    setOrderList((prev) => {
      const existing = prev.find((item) => item.menu_item_id === menu.id);
      if (existing) {
        return prev.map((item) =>
          item.menu_item_id === menu.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [
        ...prev,
        {
          menu_item_id: menu.id,
          name: menu.name,
          quantity,
        },
      ];
    });
    setOrderListOpen(true);
    setQuantityByMenuId((prev) => ({ ...prev, [menu.id]: "1" }));
  };

  const removeFromOrderList = (menuItemId: string) => {
    setOrderList((prev) => prev.filter((item) => item.menu_item_id !== menuItemId));
  };

  const submitOrderList = async () => {
    if (!customerGroup) {
      setError("先にお客様グループを作成してください");
      return;
    }
    if (orderList.length === 0) {
      setError("注文リストにメニューを追加してください");
      return;
    }

    try {
      setSubmittingOrderList(true);
      setError(null);
      const createdOrders = await Promise.all(
        orderList.map((item) =>
          createOrder({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            customer_group_id: customerGroup.id,
          })
        )
      );
      const orderIds = getStoredCustomerOrderIds();
      saveStoredCustomerOrderIds([
        ...createdOrders.map((order) => order.id),
        ...orderIds.filter(
          (id) => !createdOrders.some((order) => order.id === id)
        ),
      ]);
      setOrderList([]);
      await refreshCustomerOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmittingOrderList(false);
    }
  };

  const callStaffFromCustomerPage = async () => {
    if (!customerGroup) {
      setError("注文開始後にスタッフを呼べます");
      return;
    }

    try {
      setCallingStaff(true);
      setError(null);
      if (staffCalled && activeStaffCallId) {
        await cancelStaffCall(activeStaffCallId);
        setStaffCalled(false);
        setActiveStaffCallId(null);
        return;
      }

      const call = await createStaffCall(customerGroup.id);
      setStaffCalled(true);
      setActiveStaffCallId(call.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCallingStaff(false);
    }
  };

  const requestCheckout = async () => {
    if (!customerGroup) return;

    try {
      setError(null);
      const group = await requestCustomerGroupCheckout(customerGroup.id);
      setCustomerGroup(group);
      window.localStorage.setItem(CUSTOMER_CHECKOUT_REQUESTED_KEY, "true");
      setCheckoutRequested(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const selectedGroupOption = customerGroupOptions.find(
    (option) => option.label === selectedGroupLabel
  );
  const canStartCustomerGroup =
    Boolean(selectedGroupLabel) && !selectedGroupOption?.active_group;
  const getCustomerMenuCategoryLabel = (menu: MenuItem) =>
    menu.category?.trim() || "未分類";
  const customerMenuCategoryGroups = Array.from(
    menuItems
      .reduce((map, menu) => {
        const category = getCustomerMenuCategoryLabel(menu);
        const current = map.get(category) ?? {
          category,
          menus: [] as MenuItem[],
        };
        current.menus.push(menu);
        map.set(category, current);
        return map;
      }, new Map<string, { category: string; menus: MenuItem[] }>())
      .values()
  ).sort((a, b) => {
    if (a.category === "その他") return 1;
    if (b.category === "その他") return -1;
    if (a.category === "未分類") return 1;
    if (b.category === "未分類") return -1;
    return a.category.localeCompare(b.category, "ja");
  });
  const openedMenuCategoryGroup = customerMenuCategoryGroups.find(
    (group) => group.category === openMenuCategory
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f6f8",
        color: "#111827",
        padding: "32px 0",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <main
        className="customer-shell"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: "#fff",
          padding: 24,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        {checkoutRequested && (
          <section style={{ display: "grid", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>本日はありがとうございました。</h1>
            <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.7 }}>
              注文開始画面に戻るには、下のボタンを押してください。
            </p>
            <button
              type="button"
              onClick={resetCustomerSession}
              style={{
                ...buttonStyle,
                width: "fit-content",
                padding: "8px 14px",
              }}
            >
              注文開始画面に戻る
            </button>
          </section>
        )}
        {!checkoutRequested && (
          <>
            <h1 style={{ margin: "0 0 8px" }}>注文</h1>
            <p style={{ margin: "0 0 20px", color: "#4b5563" }}>
              メニューと数量を選んで注文できます。
            </p>
          </>
        )}
        {!checkoutRequested && customerGroup && menuItems.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 8,
              }}
            >
              {customerMenuCategoryGroups.map((group) => {
                const selected = openMenuCategory === group.category;

                return (
                  <button
                    key={group.category}
                    type="button"
                    onClick={() =>
                      setOpenMenuCategory(selected ? null : group.category)
                    }
                    style={{
                      minHeight: 38,
                      color: selected ? "#fff" : "#111827",
                      backgroundColor: selected ? "#2563eb" : "#fff",
                      border: selected ? "1px solid #2563eb" : "1px solid #d1d5db",
                      borderRadius: 6,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {group.category}
                  </button>
                );
              })}
            </div>

            {openedMenuCategoryGroup && (
              <section
                key={openedMenuCategoryGroup.category}
                style={{
                  display: "grid",
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  gap: 10,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  {openedMenuCategoryGroup.category}
                </h2>
                {openedMenuCategoryGroup.menus.map((menu) => (
                  <div
                    className="customer-menu-row"
                    key={menu.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 90px 112px",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <strong>{menu.name}</strong>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={quantityByMenuId[menu.id] ?? "1"}
                      onChange={(e) =>
                        setQuantityByMenuId((prev) => ({
                          ...prev,
                          [menu.id]: e.target.value,
                        }))
                      }
                      aria-label={`${menu.name}の数量`}
                      style={inputStyle}
                    />
                    <button
                      onClick={() => addToOrderList(menu)}
                      disabled={submittingOrderList || !customerGroup}
                      style={{
                        ...buttonStyle,
                        opacity: submittingOrderList || !customerGroup ? 0.7 : 1,
                      }}
                    >
                      リストに追加
                    </button>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {!checkoutRequested && (
          <div
            className="customer-action-bar"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            <section
              style={{
                ...actionBarItemStyle,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flex: customerGroup ? "0 0 auto" : "1 1 260px",
              }}
            >
              {customerGroup ? (
                  <button
                    type="button"
                    onClick={requestCheckout}
                    style={{
                      color: "#111827",
                      backgroundColor: "#fff",
                      border: "1px solid #9ca3af",
                      borderRadius: 6,
                      fontWeight: 700,
                      padding: "5px 8px",
                      cursor: "pointer",
                    }}
                  >
                    会計
                  </button>
              ) : (
                <div
                  className="customer-start-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 120px",
                    gap: 8,
                  }}
                >
                  <select
                    value={selectedGroupLabel}
                    onChange={(e) => setSelectedGroupLabel(e.target.value)}
                    style={inputStyle}
                  >
                    {customerGroupOptions.map((option) => (
                      <option
                        key={option.label}
                        value={option.label}
                        disabled={Boolean(option.active_group)}
                      >
                        {option.label}
                        {option.active_group ? "（注文中）" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={startCustomerGroup}
                    disabled={creatingGroup || !canStartCustomerGroup}
                    style={{
                      ...buttonStyle,
                      opacity: creatingGroup || !canStartCustomerGroup ? 0.7 : 1,
                    }}
                  >
                    {creatingGroup ? "開始中..." : "注文開始"}
                  </button>
                </div>
              )}
            </section>

            {customerGroup && (
              <section
                style={{
                  ...actionBarItemStyle,
                  flex: "1 1 150px",
                }}
              >
                <button
                  onClick={callStaffFromCustomerPage}
                  disabled={callingStaff}
                  style={{
                    ...compactHeaderButtonStyle,
                    cursor: "pointer",
                  }}
                >
                  <span>
                    {staffCalled
                      ? "呼び出しをキャンセル"
                      : callingStaff
                        ? "呼び出し中..."
                        : "スタッフを呼ぶ"}
                  </span>
                </button>
              </section>
            )}
        {!checkoutRequested && loading && <p>読み込み中...</p>}
        {!checkoutRequested && error && (
          <p style={{ color: "red", whiteSpace: "pre-wrap" }}>
            エラー: {error}
          </p>
        )}
        {!checkoutRequested && customerGroup && customerOrders.length > 0 && (
          <section
            style={{ ...actionBarItemStyle, flex: "1 1 150px" }}
          >
            <button
              type="button"
              onClick={() => setCustomerOrdersOpen((open) => !open)}
              style={compactHeaderButtonStyle}
            >
              <span>注文中リスト</span>
            </button>
            {customerOrdersOpen && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {customerOrders.map((order) => {
                const canCancel =
                  order.status === "調理待ち";

                return (
                  <li key={order.id} style={{ marginBottom: 8 }}>
                    <div>
                      <strong>{getJoinedName(order.menu_items)}</strong> × {order.quantity}
                    </div>
                    <div style={{ fontSize: 14, color: "#4b5563" }}>
                      状態: {order.status}
                    </div>
                    {canCancel && (
                      <button
                        onClick={async () => {
                          try {
                            setCancelingOrderId(order.id);
                            setError(null);
                            await cancelOrder(order.id);
                            await refreshCustomerOrders();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : String(e));
                          } finally {
                            setCancelingOrderId(null);
                          }
                        }}
                        disabled={cancelingOrderId === order.id}
                        style={{
                          marginTop: 6,
                          color: "#991b1b",
                          backgroundColor: "#fff",
                          border: "1px solid #fca5a5",
                          borderRadius: 6,
                          fontWeight: 700,
                          padding: "6px 8px",
                          cursor: "pointer",
                        }}
                      >
                        {cancelingOrderId === order.id
                          ? "キャンセル中..."
                          : "注文をキャンセル"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            )}
          </section>
        )}

        {!checkoutRequested && customerGroup && customerOrderHistory.length > 0 && (
          <section
            style={{ ...actionBarItemStyle, flex: "1 1 150px" }}
          >
            <button
              type="button"
              onClick={() => setCustomerHistoryOpen((open) => !open)}
              style={compactHeaderButtonStyle}
            >
              <span>注文履歴</span>
            </button>
            {customerHistoryOpen && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {customerOrderHistory.map((order) => (
                <li key={order.id} style={{ marginBottom: 8 }}>
                  <div>
                    <strong>{getJoinedName(order.menu_items)}</strong> × {order.quantity}
                  </div>
                  <div style={{ fontSize: 14, color: "#4b5563" }}>
                    状態: {order.status}
                    {order.completed_at &&
                      ` / 完了: ${new Date(order.completed_at).toLocaleString()}`}
                    {order.cancel_confirmed_at &&
                      ` / キャンセル確認: ${new Date(order.cancel_confirmed_at).toLocaleString()}`}
                  </div>
                </li>
              ))}
            </ul>
            )}
          </section>
        )}

        {!checkoutRequested && customerGroup && (
          <section
            style={{ ...actionBarItemStyle, flex: "1 1 170px" }}
          >
            <button
              type="button"
              onClick={() => setOrderListOpen((open) => !open)}
              style={compactHeaderButtonStyle}
            >
              <span>注文予定リスト</span>
            </button>
            {orderListOpen && orderList.length === 0 ? (
              <p style={{ margin: 0, color: "#4b5563" }}>
                メニューを選んでリストに追加してください。
              </p>
            ) : orderListOpen && (
              <>
                <ul style={{ margin: "8px 0 12px", paddingLeft: 20 }}>
                  {orderList.map((item) => (
                    <li key={item.menu_item_id} style={{ marginBottom: 8 }}>
                      <div>
                        <strong>{item.name}</strong> × {item.quantity}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromOrderList(item.menu_item_id)}
                        disabled={submittingOrderList}
                        style={{
                          marginTop: 4,
                          color: "#374151",
                          backgroundColor: "#fff",
                          border: "1px solid #d1d5db",
                          borderRadius: 6,
                          fontWeight: 700,
                          padding: "4px 8px",
                          cursor: "pointer",
                        }}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={submitOrderList}
                  disabled={submittingOrderList}
                  style={{
                    ...buttonStyle,
                    opacity: submittingOrderList ? 0.7 : 1,
                  }}
                >
                  {submittingOrderList ? "注文中..." : "まとめて注文する"}
                </button>
              </>
            )}
          </section>
        )}

          </div>
        )}

        {!checkoutRequested && !customerGroup ? (
          <p style={{ margin: 0, color: "#4b5563" }}>
            卓番号を選んで「注文開始」を押してください。
          </p>
        ) : !checkoutRequested && customerGroup && !loading && menuItems.length === 0 ? (
          <p>注文できるメニューはまだありません</p>
        ) : null}
      </main>
    </div>
  );
}

function AdminApp({ onLogout }: { onLogout: () => void }) {
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
  const [itemFormOpen, setItemFormOpen] = useState(false);

  const [openHistoryItemId, setOpenHistoryItemId] = useState<string | null>(null);
  const [history, setHistory] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dailyStockMovements, setDailyStockMovements] = useState<StockMovement[]>([]);
  const [wasteSummaries, setWasteSummaries] = useState<WasteSummary[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffCalls, setStaffCalls] = useState<StaffCall[]>([]);
  const [customerGroupOptions, setCustomerGroupOptions] = useState<CustomerGroupOption[]>([]);
  const [closingChecklist, setClosingChecklist] = useState<Record<string, boolean>>({});
  const [closingFinished, setClosingFinished] = useState(false);
  const [closingReports, setClosingReports] = useState<ClosingReport[]>([]);
  const [hiddenClosingChecklistKeys, setHiddenClosingChecklistKeys] = useState<string[]>([]);
  const [openingChecklist, setOpeningChecklist] = useState<Record<string, boolean>>({});
  const [openingFinished, setOpeningFinished] = useState(false);
  const [openingReports, setOpeningReports] = useState<OpeningReport[]>([]);
  const [hiddenOpeningChecklistKeys, setHiddenOpeningChecklistKeys] = useState<string[]>([]);
  const [customOpeningChecklistItems, setCustomOpeningChecklistItems] = useState<
    OpeningChecklistItem[]
  >([]);
  const [newOpeningChecklistItem, setNewOpeningChecklistItem] = useState("");
  const [customClosingChecklistItems, setCustomClosingChecklistItems] = useState<
    { key: string; label: string }[]
  >([]);
  const [newClosingChecklistItem, setNewClosingChecklistItem] = useState("");

  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuCategory, setNewMenuCategory] = useState("");
  const [newMenuPrepRequired, setNewMenuPrepRequired] = useState(false);
  const [recipeMenuId, setRecipeMenuId] = useState("");
  const [recipeItemId, setRecipeItemId] = useState("");
  const [recipeItemInput, setRecipeItemInput] = useState("");
  const [recipeQuantity, setRecipeQuantity] = useState("1");
  const [orderMenuId, setOrderMenuId] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [openOrderSections, setOpenOrderSections] = useState<Record<string, boolean>>({});
  const [openClosingSections, setOpenClosingSections] = useState<Record<string, boolean>>({
    checklist: true,
  });
  const [openOpeningSections, setOpenOpeningSections] = useState<Record<string, boolean>>({
    checklist: true,
  });
  const [menuFormOpen, setMenuFormOpen] = useState(false);
  const [recipeFormOpen, setRecipeFormOpen] = useState(false);
  const [expandedRecipeMenuId, setExpandedRecipeMenuId] = useState<string | null>(null);
  const [openRecipeCategory, setOpenRecipeCategory] = useState<string | null>(null);
  const [openPrepCategory, setOpenPrepCategory] = useState<string | null>(null);
  const [expandedPrepMenuId, setExpandedPrepMenuId] = useState<string | null>(null);
  const [prepQuantityByMenuId, setPrepQuantityByMenuId] = useState<Record<string, string>>({});
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editingMenuName, setEditingMenuName] = useState("");
  const [editingMenuCategory, setEditingMenuCategory] = useState("");
  const [editingMenuPrepRequired, setEditingMenuPrepRequired] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
const [editName, setEditName] = useState("");
const [editUnit, setEditUnit] = useState("");
const [editCategory, setEditCategory] = useState("");
const [editPar, setEditPar] = useState<string>(""); // 入力欄は文字列で持つのが安全

const [categoryFilter, setCategoryFilter] = useState("");
const [onlyLow, setOnlyLow] = useState(false);
const [pendingStockCorrection, setPendingStockCorrection] = useState<{
  item: Item;
  qty: number;
  sign: 1 | -1 | null;
} | null>(null);
const [customStockCorrectionReason, setCustomStockCorrectionReason] = useState("");
const [activeTab, setActiveTab] = useState<
  | "inventory"
  | "low-stock"
  | "waste"
  | "menu"
  | "prep"
  | "orders"
  | "opening"
  | "closing"
>("inventory");



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

      if (!recipeItemId && data.length > 0) {
        setRecipeItemId(data[0].id);
        setRecipeItemInput(data[0].name);
      }

      setQtyById((prev) => {
        const next = { ...prev };
        for (const it of data) {
          if (next[it.id] === undefined) next[it.id] = "";
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadWasteData = async () => {
    try {
      setLoading(true);
      setError(null);
      const wasteData = await fetchWasteSummary();
      setWasteSummaries(wasteData);
    } catch (e) {
      setWasteSummaries([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadOrderData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [menuData, orderData, staffCallData, customerGroupData] = await Promise.all([
        fetchMenuItems(),
        fetchOrders(),
        fetchStaffCalls(),
        fetchCustomerGroupOptions(),
      ]);
      setMenuItems(menuData);
      setOrders(orderData);
      setStaffCalls(staffCallData);
      setCustomerGroupOptions(customerGroupData);

      if (!recipeMenuId && menuData.length > 0) {
        setRecipeMenuId(menuData[0].id);
      }
      if (!orderMenuId && menuData.length > 0) {
        setOrderMenuId(menuData[0].id);
      }
    } catch (e) {
      setMenuItems([]);
      setOrders([]);
      setStaffCalls([]);
      setCustomerGroupOptions([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      start,
      end,
      since: start.toISOString(),
      until: end.toISOString(),
    };
  };

  const getClosingChecklistKey = () => {
    const dateKey = getBusinessDateKey();
    return `${CLOSING_CHECKLIST_KEY_PREFIX}:${dateKey}`;
  };

  const getBusinessDateKey = () => {
    const start = getTodayRange().start;
    return [
      start.getFullYear(),
      String(start.getMonth() + 1).padStart(2, "0"),
      String(start.getDate()).padStart(2, "0"),
    ].join("-");
  };

  const getClosingFinishedKey = () => {
    const dateKey = getBusinessDateKey();
    return `${CLOSING_FINISHED_KEY_PREFIX}:${dateKey}`;
  };

  const getOpeningChecklistKey = () =>
    `${OPENING_CHECKLIST_KEY_PREFIX}:${getBusinessDateKey()}`;

  const getOpeningFinishedKey = () =>
    `${OPENING_FINISHED_KEY_PREFIX}:${getBusinessDateKey()}`;

  const loadOpeningChecklist = () => {
    try {
      const raw = window.localStorage.getItem(getOpeningChecklistKey());
      setOpeningChecklist(raw ? JSON.parse(raw) : {});
      setOpeningFinished(
        window.localStorage.getItem(getOpeningFinishedKey()) === "true"
      );
    } catch {
      setOpeningChecklist({});
      setOpeningFinished(false);
    }
  };

  const loadHiddenOpeningChecklistItems = () => {
    try {
      const raw = window.localStorage.getItem(HIDDEN_OPENING_CHECKLIST_ITEMS_KEY);
      setHiddenOpeningChecklistKeys(raw ? JSON.parse(raw) : []);
    } catch {
      setHiddenOpeningChecklistKeys([]);
    }
  };

  const loadCustomOpeningChecklistItems = async () => {
    try {
      const items = await fetchOpeningChecklistItems();
      setCustomOpeningChecklistItems(items);
    } catch (e) {
      setCustomOpeningChecklistItems([]);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const updateOpeningChecklist = (key: string, checked: boolean) => {
    setOpeningChecklist((prev) => {
      const next = { ...prev, [key]: checked };
      window.localStorage.setItem(getOpeningChecklistKey(), JSON.stringify(next));
      if (!checked) {
        window.localStorage.removeItem(getOpeningFinishedKey());
        setOpeningFinished(false);
      }
      return next;
    });
  };

  const addCustomOpeningChecklistItem = async () => {
    const label = newOpeningChecklistItem.trim();
    if (!label) {
      setError("追加するチェック項目を入力してください");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const item = await createOpeningChecklistItem(label);
      setCustomOpeningChecklistItems((prev) => [...prev, item]);
      setNewOpeningChecklistItem("");
      window.localStorage.removeItem(getOpeningFinishedKey());
      setOpeningFinished(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomOpeningChecklistItem = async (id: string) => {
    if (!confirm("このチェック項目を削除しますか？")) return;

    try {
      setLoading(true);
      setError(null);
      await deleteOpeningChecklistItem(id);
      setCustomOpeningChecklistItems((prev) =>
        prev.filter((item) => item.id !== id)
      );
      const key = `custom:${id}`;
      setOpeningChecklist((prev) => {
        const next = { ...prev };
        delete next[key];
        window.localStorage.setItem(getOpeningChecklistKey(), JSON.stringify(next));
        return next;
      });
      window.localStorage.removeItem(getOpeningFinishedKey());
      setOpeningFinished(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteDefaultOpeningChecklistItem = (key: string) => {
    if (!confirm("このチェック項目を削除しますか？")) return;

    setHiddenOpeningChecklistKeys((prev) => {
      const next = Array.from(new Set([...prev, key]));
      window.localStorage.setItem(
        HIDDEN_OPENING_CHECKLIST_ITEMS_KEY,
        JSON.stringify(next)
      );
      return next;
    });
    setOpeningChecklist((prev) => {
      const next = { ...prev };
      delete next[key];
      window.localStorage.setItem(getOpeningChecklistKey(), JSON.stringify(next));
      return next;
    });
    window.localStorage.removeItem(getOpeningFinishedKey());
    setOpeningFinished(false);
  };

  const loadClosingChecklist = () => {
    try {
      const raw = window.localStorage.getItem(getClosingChecklistKey());
      setClosingChecklist(raw ? JSON.parse(raw) : {});
      setClosingFinished(
        window.localStorage.getItem(getClosingFinishedKey()) === "true"
      );
    } catch {
      setClosingChecklist({});
      setClosingFinished(false);
    }
  };

  const loadCustomClosingChecklistItems = () => {
    try {
      const raw = window.localStorage.getItem(CUSTOM_CLOSING_CHECKLIST_ITEMS_KEY);
      setCustomClosingChecklistItems(raw ? JSON.parse(raw) : []);
    } catch {
      setCustomClosingChecklistItems([]);
    }
  };

  const loadHiddenClosingChecklistItems = () => {
    try {
      const raw = window.localStorage.getItem(HIDDEN_CLOSING_CHECKLIST_ITEMS_KEY);
      setHiddenClosingChecklistKeys(raw ? JSON.parse(raw) : []);
    } catch {
      setHiddenClosingChecklistKeys([]);
    }
  };

  const updateClosingChecklist = (key: string, checked: boolean) => {
    setClosingChecklist((prev) => {
      const next = { ...prev, [key]: checked };
      window.localStorage.setItem(getClosingChecklistKey(), JSON.stringify(next));
      if (!checked) {
        window.localStorage.removeItem(getClosingFinishedKey());
        setClosingFinished(false);
      }
      return next;
    });
  };

  const finishClosingWork = async () => {
    if (!confirm("閉店作業を終了しますか？")) return;

    try {
      setLoading(true);
      setError(null);
      const report = await createClosingReport({
        business_date: getBusinessDateKey(),
        checklist_total: closingChecklistItems.length,
        checklist_completed: completedClosingChecklistCount,
        order_count: todayOrders.length,
        completed_order_count: todayCompletedOrders.length,
        active_order_count: todayActiveOrders.length,
        canceled_order_count: todayCanceledOrders.length,
        stock_movement_count: dailyStockMovements.length,
        stock_reconciliation_issue_count: orderUsageDiffs.length,
        checklist_items: closingChecklistItems.map((item) => ({
          key: item.key,
          label: item.label,
          checked: Boolean(closingChecklist[item.key]),
        })),
      });

      window.localStorage.setItem(getClosingFinishedKey(), "true");
      setClosingFinished(true);
      setClosingReports((prev) => [
        report,
        ...prev.filter((item) => item.business_date !== report.business_date),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const finishOpeningWork = async () => {
    if (!confirm("開店準備を完了しますか？")) return;

    try {
      setLoading(true);
      setError(null);
      const report = await createOpeningReport({
        business_date: getBusinessDateKey(),
        checklist_total: openingChecklistItems.length,
        checklist_completed: completedOpeningChecklistCount,
        checklist_items: openingChecklistItems.map((item) => ({
          key: item.key,
          label: item.label,
          checked: Boolean(openingChecklist[item.key]),
        })),
      });

      window.localStorage.setItem(getOpeningFinishedKey(), "true");
      setOpeningFinished(true);
      setOpeningReports((prev) => [
        report,
        ...prev.filter((item) => item.business_date !== report.business_date),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const saveCustomClosingChecklistItems = (
    items: { key: string; label: string }[]
  ) => {
    setCustomClosingChecklistItems(items);
    window.localStorage.setItem(
      CUSTOM_CLOSING_CHECKLIST_ITEMS_KEY,
      JSON.stringify(items)
    );
  };

  const addCustomClosingChecklistItem = () => {
    const label = newClosingChecklistItem.trim();
    if (!label) {
      setError("追加するチェック項目を入力してください");
      return;
    }

    saveCustomClosingChecklistItems([
      ...customClosingChecklistItems,
      { key: `custom:${Date.now()}`, label },
    ]);
    setNewClosingChecklistItem("");
    window.localStorage.removeItem(getClosingFinishedKey());
    setClosingFinished(false);
    setError(null);
  };

  const deleteCustomClosingChecklistItem = (key: string) => {
    if (!confirm("このチェック項目を削除しますか？")) return;

    saveCustomClosingChecklistItems(
      customClosingChecklistItems.filter((item) => item.key !== key)
    );
    setClosingChecklist((prev) => {
      const next = { ...prev };
      delete next[key];
      window.localStorage.setItem(getClosingChecklistKey(), JSON.stringify(next));
      return next;
    });
    window.localStorage.removeItem(getClosingFinishedKey());
    setClosingFinished(false);
  };

  const deleteDefaultClosingChecklistItem = (key: string) => {
    if (!confirm("このチェック項目を削除しますか？")) return;

    setHiddenClosingChecklistKeys((prev) => {
      const next = Array.from(new Set([...prev, key]));
      window.localStorage.setItem(
        HIDDEN_CLOSING_CHECKLIST_ITEMS_KEY,
        JSON.stringify(next)
      );
      return next;
    });
    setClosingChecklist((prev) => {
      const next = { ...prev };
      delete next[key];
      window.localStorage.setItem(getClosingChecklistKey(), JSON.stringify(next));
      return next;
    });
    window.localStorage.removeItem(getClosingFinishedKey());
    setClosingFinished(false);
  };

  const loadClosingCheckData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { since, until } = getTodayRange();
      const [
        itemData,
        menuData,
        orderData,
        staffCallData,
        customerGroupData,
        stockMovementData,
        closingReportData,
      ] =
        await Promise.all([
          fetchItems(),
          fetchMenuItems(),
          fetchOrders(),
          fetchStaffCalls(),
          fetchCustomerGroupOptions(),
          fetchStockMovements({ since, until, limit: 200 }),
          fetchClosingReports(),
        ]);
      setItems(itemData);
      setMenuItems(menuData);
      setOrders(orderData);
      setStaffCalls(staffCallData);
      setCustomerGroupOptions(customerGroupData);
      setDailyStockMovements(stockMovementData);
      setClosingReports(closingReportData);
    } catch (e) {
      setDailyStockMovements([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadOpeningCheckData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { since, until } = getTodayRange();
      const [itemData, stockMovementData, reports] = await Promise.all([
        fetchItems(),
        fetchStockMovements({ since, until, limit: 200 }),
        fetchOpeningReports(),
      ]);
      setItems(itemData);
      setDailyStockMovements(stockMovementData);
      setOpeningReports(reports);
    } catch (e) {
      setDailyStockMovements([]);
      setOpeningReports([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const stockCorrectionReasonOptions = [
    "棚卸し差異",
    "入力ミス修正",
    "仕入れ記録漏れ",
    "使用記録漏れ",
    "廃棄記録漏れ",
    "その他",
  ];

  const moveStock = async (itemId: string, delta: number, reason: string) => {
    try {
      setError(null);
      await createStockMovement({ item_id: itemId, delta, reason });
      await loadItems();
      if (reason === "廃棄") {
        await loadWasteData();
      }
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
    const item = items.find((current) => current.id === itemId);
    const raw = qtyById[itemId] ?? "";
    const qty = parseNumberInput(raw);

    // 入力チェック（初心者がハマりやすい）
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("数量は 1以上の数値を入力してください");
      return;
    }

    const isStockCorrection = reason === "在庫修正";
    if (isStockCorrection) {
      if (!item) {
        setError("商品が見つかりません");
        return;
      }
      setError(null);
      setCustomStockCorrectionReason("");
      setPendingStockCorrection({ item, qty, sign: null });
      return;
    }

    const unit = item?.unit ?? "";

    if (
      !confirm(
        `${reason}を実行しますか？\n\n対象商品:\n・${item?.name ?? "商品不明"}: ${formatStockQuantity(qty)}${unit}`
      )
    ) {
      return;
    }

    await moveStock(itemId, sign * qty, reason);
    setQtyById((prev) => ({ ...prev, [itemId]: "" }));
  };

  const moveSelectedQuantities = async (sign: 1 | -1 | null, reason: string) => {
    const movements = visibleItems
      .map((item) => ({
        item,
        qty: parseNumberInput(qtyById[item.id] ?? ""),
      }))
      .filter(({ qty }) => Number.isFinite(qty) && qty > 0);

    if (movements.length === 0) {
      setError("数量を1以上入力した商品がありません");
      return;
    }

    const targetLines = movements
      .map(({ item, qty }) => `・${item.name}: ${formatStockQuantity(qty)}${item.unit}`)
      .join("\n");

    if (
      !confirm(
        `${reason}を実行しますか？\n\n対象商品:\n${targetLines}`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await Promise.all(
        movements.map(({ item, qty }) =>
          createStockMovement({
            item_id: item.id,
            delta: (sign ?? 1) * qty,
            reason,
          })
        )
      );
      setQtyById((prev) => {
        const next = { ...prev };
        for (const { item } of movements) {
          next[item.id] = "";
        }
        return next;
      });
      await loadItems();
      if (reason === "廃棄") {
        await loadWasteData();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const applyPendingStockCorrection = async (selectedReason: string) => {
    if (!pendingStockCorrection) return;
    if (!pendingStockCorrection.sign) {
      setError("在庫を増やすか減らすか選択してください");
      return;
    }

    const correctionReason =
      selectedReason === "その他"
        ? customStockCorrectionReason.trim()
        : selectedReason;

    if (!correctionReason) {
      setError("その他の理由を入力してください");
      return;
    }

    const actualReason =
      selectedReason === "その他"
        ? `在庫修正:その他:${correctionReason}`
        : `在庫修正:${correctionReason}`;
    const targetLine = `・${pendingStockCorrection.item.name}: ${
      pendingStockCorrection.sign === 1 ? "増やす" : "減らす"
    } ${formatStockQuantity(pendingStockCorrection.qty)}${pendingStockCorrection.item.unit}`;

    if (
      !confirm(
        `在庫修正（${actualReason.replace("在庫修正:", "")}）を実行しますか？\n\n対象商品:\n${targetLine}`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createStockMovement({
        item_id: pendingStockCorrection.item.id,
        delta: pendingStockCorrection.sign * pendingStockCorrection.qty,
        reason: actualReason,
      });
      setQtyById((prev) => {
        const next = { ...prev };
        next[pendingStockCorrection.item.id] = "";
        return next;
      });
      setPendingStockCorrection(null);
      setCustomStockCorrectionReason("");
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    try {
      setError(null);
      const par = normalizeNumberInput(newPar);
      const parLevel = par === "" ? null : parseNumberInput(newPar);
      if (par !== "" && !Number.isFinite(parLevel)) {
        setError("基準在庫は数値か空欄にしてください");
        return;
      }
      await createItem({
        name: newName.trim(),
        unit: newUnit.trim(),
        category: newCategory.trim() || null,
        par_level: parLevel,
      });
      setNewName("");
      setNewUnit("");
      setNewCategory("");
      setNewPar("");
      setItemFormOpen(false);
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (activeTab === "waste") {
      loadWasteData();
    }
    if (activeTab === "orders" || activeTab === "menu" || activeTab === "prep") {
      loadOrderData();
    }
    if (activeTab === "closing") {
      loadClosingCheckData();
      loadClosingChecklist();
      loadCustomClosingChecklistItems();
      loadHiddenClosingChecklistItems();
    }
    if (activeTab === "opening") {
      loadOpeningCheckData();
      loadOpeningChecklist();
      loadCustomOpeningChecklistItems();
      loadHiddenOpeningChecklistItems();
    }
    if (activeTab === "orders") {
      const intervalId = window.setInterval(loadOrderData, 5000);
      return () => window.clearInterval(intervalId);
    }
  }, [activeTab]);

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

  const recipeItemOptions = [...items].sort((a, b) => {
    const orderDiff =
      getCategoryOrder(getCategoryLabel(a)) - getCategoryOrder(getCategoryLabel(b));
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "ja");
  });

  const unitOptions = Array.from(
    new Set(items.map((item) => item.unit.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ja"));

  const categoryOptions = categories.filter((category) => category !== "未分類");
  const getMenuCategoryLabel = (menu: MenuItem) =>
    menu.category?.trim() || "未分類";
  const menuCategoryOptions = Array.from(
    new Set(menuItems.map((menu) => getMenuCategoryLabel(menu)).filter((category) => category !== "未分類"))
  ).sort((a, b) => a.localeCompare(b, "ja"));
  const menuCategoryGroups = Array.from(
    menuItems
      .reduce((map, menu) => {
        const category = getMenuCategoryLabel(menu);
        const current = map.get(category) ?? {
          category,
          menus: [] as MenuItem[],
        };
        current.menus.push(menu);
        map.set(category, current);
        return map;
      }, new Map<string, { category: string; menus: MenuItem[] }>())
      .values()
  ).sort((a, b) => {
    if (a.category === "その他") return 1;
    if (b.category === "その他") return -1;
    if (a.category === "未分類") return 1;
    if (b.category === "未分類") return -1;
    return a.category.localeCompare(b.category, "ja");
  });
  const openedRecipeCategoryGroup = menuCategoryGroups.find(
    (group) => group.category === openRecipeCategory
  );

  const getDisplayStock = (stock: number) => Math.max(0, stock);

  const formatStockQuantity = (stock: number) =>
    Number.isInteger(getDisplayStock(stock))
      ? String(getDisplayStock(stock))
      : getDisplayStock(stock).toFixed(2).replace(/\.?0+$/, "");

  const categorySummaries = categories
    .map((category) => {
      const categoryItems = items.filter(
        (item) => getCategoryLabel(item) === category
      );
      const lowCount = categoryItems.filter(
        (item) => {
          const displayStock = Math.max(0, item.current_stock);
          return (
            displayStock === 0 ||
            (item.par_level !== null &&
              item.par_level > 0 &&
              displayStock <= item.par_level * 0.3)
          );
        }
      ).length;
      return {
        category,
        lowCount,
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
        (item) => `- ${item.name}: ${formatStockQuantity(item.shortage)}${item.unit}`
      );
      return [`【${group.category}】`, ...lines].join("\n");
    })
    .join("\n\n");

  const getOrderListCategoryText = (group: (typeof orderListByCategory)[number]) => {
    const lines = group.items.map(
      (item) => `- ${item.name}: ${formatStockQuantity(item.shortage)}${item.unit}`
    );
    return [`【${group.category}】`, ...lines].join("\n");
  };

  const copyOrderList = async () => {
    if (!orderListText) return;

    try {
      await navigator.clipboard.writeText(`発注リスト\n${orderListText}`);
      setCopyMessage("発注リストをコピーしました");
    } catch (e) {
      setCopyMessage("コピーに失敗しました");
    }
  };

  const copyOrderListCategory = async (
    group: (typeof orderListByCategory)[number]
  ) => {
    try {
      await navigator.clipboard.writeText(
        `発注リスト\n${getOrderListCategoryText(group)}`
      );
      setCopyMessage(`${group.category}の発注リストをコピーしました`);
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
      await loadWasteData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const pendingOrders = orders.filter(
    (order) => order.status === "調理待ち" || order.status === "調理中"
  );
  const firstOrderIdByGroup = new Map<string, string>();

  for (const order of [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )) {
    const key = order.customer_group_id ?? "no-group";
    if (!firstOrderIdByGroup.has(key)) {
      firstOrderIdByGroup.set(key, order.id);
    }
  }

  const isFirstOrder = (order: Order) =>
    firstOrderIdByGroup.get(order.customer_group_id ?? "no-group") === order.id;

  const historyOrders = orders.filter(
    (order) => order.status === "完了" || order.status === "キャンセル"
  );
  const canceledOrders = orders.filter(
    (order) => order.status === "キャンセル" && !order.cancel_confirmed_at
  );
  const staffCallOrders = orders.filter(
    (order) => order.staff_called_at && !order.staff_call_confirmed_at
  );
  const activeCustomerGroups = customerGroupOptions
    .filter((option) => option.active_group)
    .map((option) => option.active_group)
    .filter((group): group is CustomerGroup => Boolean(group));
  const getOrdersByGroup = (groupId: string, targetOrders: Order[]) =>
    targetOrders.filter((order) => order.customer_group_id === groupId);
  const getStaffCallsByGroup = (groupId: string) =>
    staffCalls.filter((call) => call.customer_group_id === groupId);
  const orderManagementGroups = activeCustomerGroups.map((group) => {
    const groupPendingOrders = getOrdersByGroup(group.id, pendingOrders);
    const groupHistoryOrders = getOrdersByGroup(group.id, historyOrders);
    const groupCanceledOrders = getOrdersByGroup(group.id, canceledOrders);
    const groupStaffCalls = getStaffCallsByGroup(group.id);
    const groupStaffCallOrders = getOrdersByGroup(group.id, staffCallOrders);

    return {
      group,
      pendingOrders: groupPendingOrders,
      historyOrders: groupHistoryOrders,
      canceledOrders: groupCanceledOrders,
      staffCalls: groupStaffCalls,
      staffCallOrders: groupStaffCallOrders,
      noticeCount:
        groupCanceledOrders.length +
        groupStaffCalls.length +
        groupStaffCallOrders.length +
        (group.checkout_requested_at ? 1 : 0),
    };
  });
  const getOrderSectionKey = (groupId: string, section: string) =>
    `${groupId}:${section}`;
  const isOrderSectionOpen = (groupId: string, section: string) =>
    Boolean(openOrderSections[getOrderSectionKey(groupId, section)]);
  const toggleOrderSection = (groupId: string, section: string) => {
    const key = getOrderSectionKey(groupId, section);
    setOpenOrderSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const isClosingSectionOpen = (section: string) =>
    Boolean(openClosingSections[section]);
  const toggleClosingSection = (section: string) => {
    setOpenClosingSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
  const isOpeningSectionOpen = (section: string) =>
    Boolean(openOpeningSections[section]);
  const toggleOpeningSection = (section: string) => {
    setOpenOpeningSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const todayRange = getTodayRange();
  const isTodayDate = (value: string | null) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return time >= todayRange.start.getTime() && time < todayRange.end.getTime();
  };
  const todayOrders = orders.filter((order) => isTodayDate(order.created_at));
  const todayCompletedOrders = todayOrders.filter((order) => order.status === "完了");
  const todayActiveOrders = todayOrders.filter(
    (order) => order.status === "調理待ち" || order.status === "調理中"
  );
  const todayCanceledOrders = todayOrders.filter((order) => order.status === "キャンセル");
  const getStockMovementCategory = (movement: StockMovement) => {
    const reason = movement.reason ?? "";

    if (reason === "仕入れ") return "仕入れ";
    if (reason === "廃棄") return "廃棄";
    if (reason === "棚卸し修正" || reason.startsWith("在庫修正:")) {
      return "在庫修正";
    }
    if (reason === "使用" || reason.startsWith("注文使用:") || reason.startsWith("仕込み:")) {
      return "使用";
    }
    return movement.delta >= 0 ? "仕入れ" : "使用";
  };
  const todayPurchaseMovements = dailyStockMovements
    .filter((movement) => getStockMovementCategory(movement) === "仕入れ")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  const closingMovementCategories = ["仕入れ", "使用", "廃棄", "在庫修正"];
  const closingMovementSummary = closingMovementCategories.map((category) => {
    const movements = dailyStockMovements.filter(
      (movement) => getStockMovementCategory(movement) === category
    );
    return {
      category,
      count: movements.length,
      movements,
    };
  });
  const menuItemsById = new Map(menuItems.map((menu) => [menu.id, menu]));
  const completedStockTargetOrders = todayCompletedOrders.filter((order) => {
    const menu = menuItemsById.get(order.menu_item_id);
    return menu && !menu.prep_required;
  });
  const getActualOrderUsageQty = (orderId: string, itemId: string) =>
    dailyStockMovements
      .filter((movement) => {
        const reason = movement.reason ?? "";
        return (
          movement.order_id === orderId &&
          movement.item_id === itemId &&
          movement.delta < 0 &&
          (reason.startsWith("注文使用:") || reason === "閉店チェック補正")
        );
      })
      .reduce((sum, movement) => sum + Math.abs(Number(movement.delta)), 0);
  const orderUsageDiffs = completedStockTargetOrders
    .flatMap((order) => {
      const menu = menuItemsById.get(order.menu_item_id);
      if (!menu) return [];

      return menu.recipes.map((recipe) => {
        const expectedQty = Number(recipe.quantity) * Number(order.quantity);
        const actualQty = getActualOrderUsageQty(order.id, recipe.item_id);
        const diffQty = Math.max(0, expectedQty - actualQty);
        const item = itemsById.get(recipe.item_id);
        return {
          order,
          menu,
          itemId: recipe.item_id,
          item,
          expectedQty,
          actualQty,
          diffQty,
        };
      });
    })
    .filter((diff) => diff.diffQty > 0)
    .sort((a, b) => {
      const orderDiff =
        new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime();
      if (orderDiff !== 0) return orderDiff;
      return (a.item?.name ?? "").localeCompare(b.item?.name ?? "", "ja");
    });
  const defaultClosingChecklistItems = [
    {
      key: "open-orders",
      label: "調理中・待ちの注文が残っていないか確認",
      warning: todayActiveOrders.length > 0 ? `${todayActiveOrders.length}件残っています` : null,
    },
    {
      key: "usage-diff",
      label: "在庫反映漏れチェックを確認",
      warning:
        orderUsageDiffs.length > 0
          ? `${orderUsageDiffs.length}件の反映漏れ候補があります`
          : null,
    },
    {
      key: "stock-movements",
      label: "今日の仕入れ・使用・廃棄・在庫修正を確認",
      warning: dailyStockMovements.length === 0 ? "今日の在庫変動はありません" : null,
    },
    {
      key: "physical-stock",
      label: "実際の在庫を目で確認",
      warning: null,
    },
    {
      key: "waste",
      label: "廃棄記録を確認",
      warning:
        closingMovementSummary.find((group) => group.category === "廃棄")?.count
          ? null
          : "今日の廃棄記録はありません",
    },
    {
      key: "corrections",
      label: "在庫修正・閉店チェック補正の理由を確認",
      warning: null,
    },
  ];
  const closingChecklistItems = [
    ...defaultClosingChecklistItems.filter(
      (item) => !hiddenClosingChecklistKeys.includes(item.key)
    ),
    ...customClosingChecklistItems.map((item) => ({
      ...item,
      warning: null,
      custom: true,
    })),
  ];
  const completedClosingChecklistCount = closingChecklistItems.filter(
    (item) => closingChecklist[item.key]
  ).length;
  const allClosingChecklistDone =
    closingChecklistItems.length > 0 &&
    completedClosingChecklistCount === closingChecklistItems.length;
  const defaultOpeningChecklistItems = [
    {
      key: "staff-ready",
      label: "スタッフの出勤・持ち場を確認",
      warning: null,
    },
    {
      key: "register-ready",
      label: "レジ・釣り銭を確認",
      warning: null,
    },
    {
      key: "reservation-check",
      label: "予約・来店予定を確認",
      warning: null,
    },
    {
      key: "stock-check",
      label: "開店前の在庫を確認",
      warning: null,
    },
    {
      key: "prep-check",
      label: "仕込み状況を確認",
      warning: null,
    },
  ];
  const openingChecklistItems = [
    ...defaultOpeningChecklistItems.filter(
      (item) => !hiddenOpeningChecklistKeys.includes(item.key)
    ),
    ...customOpeningChecklistItems.map((item) => ({
      key: `custom:${item.id}`,
      label: item.label,
      id: item.id,
      warning: null,
      custom: true,
    })),
  ];
  const completedOpeningChecklistCount = openingChecklistItems.filter(
    (item) => openingChecklist[item.key]
  ).length;
  const allOpeningChecklistDone =
    openingChecklistItems.length > 0 &&
    completedOpeningChecklistCount === openingChecklistItems.length;
  const formatOrderDate = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "";

  const formatOrderTime = (value: string) =>
    new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const getElapsedMinutes = (value: string) => {
    const diffMs = Date.now() - new Date(value).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const getOrderHistoryDateLabel = (order: Order) => {
    if (order.status === "完了") {
      return `完了: ${formatOrderDate(order.completed_at)}`;
    }
    if (order.status === "キャンセル") {
      return `キャンセル: ${formatOrderDate(order.cancelled_at)}`;
    }
    return `注文: ${formatOrderDate(order.created_at)}`;
  };

  const getMenuAvailability = (menu: MenuItem) => {
    const ingredientMap = new Map<
      string,
      {
        itemId: string;
        name: string;
        unit: string;
        requiredQty: number;
        currentStock: number;
      }
    >();

    for (const recipe of menu.recipes) {
      const item = itemsById.get(recipe.item_id);
      const joinedName = getJoinedName(recipe.items);
      const current = ingredientMap.get(recipe.item_id);
      const quantity = Number(recipe.quantity);

      ingredientMap.set(recipe.item_id, {
        itemId: recipe.item_id,
        name: item?.name ?? joinedName,
        unit: item?.unit ?? "",
        requiredQty: (current?.requiredQty ?? 0) + quantity,
        currentStock: getDisplayStock(item?.current_stock ?? 0),
      });
    }

    const ingredients = Array.from(ingredientMap.values()).map((ingredient) => ({
      ...ingredient,
      possible:
        ingredient.requiredQty > 0
          ? Math.max(0, Math.floor(ingredient.currentStock / ingredient.requiredQty))
          : 0,
    }));

    const servings =
      ingredients.length === 0
        ? null
        : Math.min(...ingredients.map((ingredient) => ingredient.possible));

    return { servings, ingredients };
  };

  const getAvailabilityColor = (servings: number | null) => {
    if (servings === null) return "#4b5563";
    if (servings === 0) return "#dc2626";
    if (servings <= 5) return "#f97316";
    return "#166534";
  };

  const getAvailabilityStatus = (servings: number | null) => {
    if (servings === null) return null;
    if (servings === 0) {
      return { label: "作成不可", color: "#dc2626", background: "#fef2f2" };
    }
    if (servings <= 5) {
      return { label: "残り少", color: "#f97316", background: "#fff7ed" };
    }
    return null;
  };

  const getMenuCategoryAvailabilitySummary = (menus: MenuItem[]) => {
    return menus.reduce(
      (summary, menu) => {
        const status = getAvailabilityStatus(getMenuAvailability(menu).servings);
        if (status?.label === "作成不可") summary.unavailable += 1;
        if (status?.label === "残り少") summary.low += 1;
        return summary;
      },
      { unavailable: 0, low: 0 }
    );
  };

  const prepCategoryGroups = menuCategoryGroups
    .map((group) => ({
      category: group.category,
      menus: group.menus.filter(
        (menu) =>
          menu.prep_required &&
          Boolean(getAvailabilityStatus(getMenuAvailability(menu).servings))
      ),
    }))
    .filter((group) => group.menus.length > 0);
  const openedPrepCategoryGroup = prepCategoryGroups.find(
    (group) => group.category === openPrepCategory
  );

  const getStockColor = (stock: number, parLevel: number | null) => {
    const displayStock = getDisplayStock(stock);
    if (displayStock === 0) return "#dc2626";
    if (parLevel !== null && parLevel > 0 && displayStock <= parLevel * 0.3) {
      return "#f97316";
    }
    return "#166534";
  };

  const addMenu = async () => {
    const name = newMenuName.trim();
    if (!name) {
      setError("メニュー名を入力してください");
      return;
    }

    try {
      setError(null);
      const created = await createMenuItem({
        name,
        category: newMenuCategory.trim() || null,
        prep_required: newMenuPrepRequired,
      });
      setNewMenuName("");
      setNewMenuCategory("");
      setNewMenuPrepRequired(false);
      setRecipeMenuId(created.id);
      setOrderMenuId(created.id);
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const addRecipeItem = async () => {
    const quantity = parseNumberInput(recipeQuantity);
    const inputName = recipeItemInput.trim();
    const normalizedInputName = normalizeItemNameInput(inputName);
    const selectedItem =
      items.find(
        (item) =>
          item.id === recipeItemId &&
          normalizeItemNameInput(item.name) === normalizedInputName
      ) ??
      items.find(
        (item) => normalizeItemNameInput(item.name) === normalizedInputName
      );

    if (!recipeMenuId) {
      setError("メニューを選択してください");
      return;
    }
    if (!inputName || !selectedItem) {
      setError("そのような商品はありません");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("1以上の使用量を入力してください");
      return;
    }

    try {
      setError(null);
      await addRecipe({
        menu_item_id: recipeMenuId,
        item_id: selectedItem.id,
        quantity,
      });
      setRecipeQuantity("1");
      setRecipeItemId(selectedItem.id);
      setRecipeItemInput(selectedItem.name);
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startMenuEdit = (menu: MenuItem) => {
    setEditingMenuId(menu.id);
    setEditingMenuName(menu.name);
    setEditingMenuCategory(menu.category ?? "");
    setEditingMenuPrepRequired(Boolean(menu.prep_required));
  };

  const cancelMenuEdit = () => {
    setEditingMenuId(null);
    setEditingMenuName("");
    setEditingMenuCategory("");
    setEditingMenuPrepRequired(false);
  };

  const saveMenuEdit = async () => {
    if (!editingMenuId) return;
    const name = editingMenuName.trim();
    if (!name) {
      setError("メニュー名を入力してください");
      return;
    }

    try {
      setError(null);
      const updated = await updateMenuItem(editingMenuId, {
        name,
        category: editingMenuCategory.trim() || null,
        prep_required: editingMenuPrepRequired,
      });
      if (recipeMenuId === editingMenuId) setRecipeMenuId(updated.id);
      if (orderMenuId === editingMenuId) setOrderMenuId(updated.id);
      cancelMenuEdit();
      await loadOrderData();
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
      if (expandedRecipeMenuId === menu.id) setExpandedRecipeMenuId(null);
      if (openRecipeCategory === getMenuCategoryLabel(menu)) setOpenRecipeCategory(null);
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const recordPrep = async (menu: MenuItem) => {
    const quantity = parseNumberInput(prepQuantityByMenuId[menu.id] ?? "");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("仕込み数は1以上の数値を入力してください");
      return;
    }
    if (menu.recipes.length === 0) {
      setError("レシピ未登録のメニューは仕込み記録できません");
      return;
    }

    const lines = menu.recipes.map((recipe) => {
      const itemName = getJoinedName(recipe.items) || "食材";
      return `・${itemName}: ${formatStockQuantity(Number(recipe.quantity) * quantity)}`;
    });

    if (
      !confirm(
        `「${menu.name}」を${formatStockQuantity(quantity)}件分仕込みますか？\n\n使用する食材:\n${lines.join("\n")}`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await Promise.all(
        menu.recipes.map((recipe) =>
          createStockMovement({
            item_id: recipe.item_id,
            delta: -Number(recipe.quantity) * quantity,
            reason: `仕込み:${menu.name}`,
          })
        )
      );
      setPrepQuantityByMenuId((prev) => ({ ...prev, [menu.id]: "" }));
      await loadItems();
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const addOrder = async (customerGroupId: string | null = null) => {
    const quantity = parseNumberInput(orderQuantity);
    if (!orderMenuId || !Number.isFinite(quantity) || quantity <= 0) {
      setError("メニューと1以上の注文数を入力してください");
      return;
    }

    try {
      setError(null);
      await createOrder({
        menu_item_id: orderMenuId,
        quantity,
        customer_group_id: customerGroupId,
      });
      setOrderQuantity("1");
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeOrder = async (order: Order) => {
    if (order.status !== "調理待ち") {
      setError("調理開始後の注文は削除できません。完成またはキャンセルで処理してください。");
      return;
    }
    if (!confirm(`「${getJoinedName(order.menu_items)}」の注文を削除しますか？`)) {
      return;
    }

    try {
      setError(null);
      await deleteOrder(order.id);
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const finishOrder = async (orderId: string) => {
    try {
      setError(null);
      await completeOrder(orderId);
      await loadItems();
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const checkoutGroup = async (groupId: string) => {
    if (groupId === "no-group") return;

    try {
      setError(null);
      await checkoutCustomerGroup(groupId);
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const applyClosingUsageDiff = async () => {
    if (orderUsageDiffs.length === 0) return;

    const targetLines = orderUsageDiffs
      .map((diff) => {
        const item = diff.item;
        return `・${diff.menu.name} / ${item?.name ?? "商品不明"}: ${formatStockQuantity(diff.diffQty)}${item?.unit ?? ""}`;
      })
      .join("\n");

    if (
      !confirm(
        `未反映の在庫減少を反映しますか？\n\n対象商品:\n${targetLines}`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await Promise.all(
        orderUsageDiffs.map((diff) =>
          createStockMovement({
            item_id: diff.itemId,
            delta: -diff.diffQty,
            reason: "閉店チェック補正",
            order_id: diff.order.id,
          })
        )
      );
      await loadClosingCheckData();
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const startCooking = async (orderId: string) => {
    try {
      setError(null);
      await startCookingOrder(orderId);
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmCancellation = async (orderId: string) => {
    try {
      setError(null);
      await confirmOrderCancellation(orderId);
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const markStaffCallConfirmed = async (orderId: string) => {
    try {
      setError(null);
      await confirmStaffCall(orderId);
      await loadOrderData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const markStandaloneStaffCallConfirmed = async (callId: string) => {
    try {
      setError(null);
      await confirmStandaloneStaffCall(callId);
      await loadOrderData();
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
  padding: "8px 10px",
  whiteSpace: "nowrap",
};

const tabButtonStyle = (selected: boolean): React.CSSProperties => ({
  ...buttonStyle,
  position: "relative",
  padding: "10px 14px",
  borderColor: selected ? "#2563eb" : "#9ca3af",
  backgroundColor: selected ? "#eff6ff" : "#fff",
  color: "#111827",
});

const notificationBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: -8,
  right: -8,
  minWidth: 22,
  height: 22,
  padding: "0 6px",
  borderRadius: 999,
  background: "#dc2626",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: "22px",
  textAlign: "center",
  boxShadow: "0 0 0 2px #fff",
};

const notificationBadge = (count: number) =>
  count > 0 ? <span style={notificationBadgeStyle}>{count}</span> : null;

const orderSectionHeaderStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  padding: 0,
  color: "#111827",
  background: "transparent",
  border: 0,
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "left",
};


  return (
  <div
    className="admin-page"
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
      className="admin-shell"
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
      <div
        className="admin-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <a
          href="/order"
          style={{
            ...buttonStyle,
            padding: "10px 14px",
            textDecoration: "none",
          }}
        >
          お客様注文画面
        </a>
        <button
          onClick={onLogout}
          style={{
            ...buttonStyle,
            padding: "10px 14px",
          }}
        >
          ログアウト
        </button>
      </div>

      <nav
        className="admin-nav"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => setActiveTab("opening")}
          style={tabButtonStyle(activeTab === "opening")}
        >
          開店チェック
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          style={tabButtonStyle(activeTab === "inventory")}
        >
          在庫管理
        </button>
        <button
          onClick={() => setActiveTab("low-stock")}
          style={tabButtonStyle(activeTab === "low-stock")}
        >
          発注管理
        </button>
        <button
          onClick={() => setActiveTab("waste")}
          style={tabButtonStyle(activeTab === "waste")}
        >
          廃棄分析
        </button>
        <button
          onClick={() => setActiveTab("menu")}
          style={tabButtonStyle(activeTab === "menu")}
        >
          メニュー管理
        </button>
        <button
          onClick={() => setActiveTab("prep")}
          style={tabButtonStyle(activeTab === "prep")}
        >
          仕込み管理
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          style={tabButtonStyle(activeTab === "orders")}
        >
          注文管理
        </button>
        <button
          onClick={() => setActiveTab("closing")}
          style={tabButtonStyle(activeTab === "closing")}
        >
          閉店チェック
        </button>
      </nav>

      {error && (
        <p style={{ color: "red", whiteSpace: "pre-wrap" }}>
          エラー: {error}
        </p>
      )}

      {activeTab === "opening" && (
        <section style={sectionStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 4px" }}>開店チェック</h2>
              <p style={{ margin: 0, color: "#4b5563" }}>
                開店前の確認項目をチェックします。
              </p>
            </div>
            <button onClick={loadOpeningCheckData} disabled={loading}>
              更新
            </button>
          </div>

          <section>
            <button
              type="button"
              onClick={() => toggleOpeningSection("purchases")}
              style={orderSectionHeaderStyle}
            >
              <span>
                {isOpeningSectionOpen("purchases") ? "▼" : "▶"} 本日の仕入れ確認
              </span>
              <strong>{todayPurchaseMovements.length}件</strong>
            </button>
            {isOpeningSectionOpen("purchases") && (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 8,
                  marginBottom: 16,
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                {todayPurchaseMovements.length === 0 ? (
                  <p style={{ margin: 0, color: "#6b7280" }}>
                    本日の仕入れ記録はありません
                  </p>
                ) : (
                  todayPurchaseMovements.map((movement) => {
                    const item = itemsById.get(movement.item_id);
                    return (
                      <div
                        key={movement.id}
                        style={{
                          border: "1px solid #f3f4f6",
                          borderRadius: 6,
                          padding: 8,
                        }}
                      >
                        <strong>{item?.name ?? "商品不明"}</strong>
                        <p style={{ margin: "4px 0 0", color: "#4b5563" }}>
                          +{formatStockQuantity(Math.abs(movement.delta))}
                          {item?.unit ?? ""} / {formatOrderTime(movement.created_at)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>

          <section>
            <button
              type="button"
              onClick={() => toggleOpeningSection("low-stock")}
              style={orderSectionHeaderStyle}
            >
              <span>
                {isOpeningSectionOpen("low-stock") ? "▼" : "▶"} 在庫基準未満チェック
              </span>
              <strong>{lowStockItems.length}件</strong>
            </button>
            {isOpeningSectionOpen("low-stock") && (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 8,
                  marginBottom: 16,
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                {lowStockItems.length === 0 ? (
                  <p style={{ margin: 0, color: "#166534", fontWeight: 700 }}>
                    在庫基準を下回っている商品はありません
                  </p>
                ) : (
                  lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: 8,
                      }}
                    >
                      <strong>{item.name}</strong>
                      <p style={{ margin: "4px 0 0", color: "#4b5563" }}>
                        現在 {formatStockQuantity(Math.max(0, item.current_stock))}
                        {item.unit} / 在庫基準 {formatStockQuantity(item.par_level ?? 0)}
                        {item.unit} / 不足 {formatStockQuantity(item.shortage)}
                        {item.unit}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          <section>
            <button
              type="button"
              onClick={() => toggleOpeningSection("checklist")}
              style={orderSectionHeaderStyle}
            >
              <span>
                {isOpeningSectionOpen("checklist") ? "▼" : "▶"} 開店前チェックリスト
              </span>
              <strong>
                {completedOpeningChecklistCount}/{openingChecklistItems.length}
              </strong>
            </button>
            {isOpeningSectionOpen("checklist") && (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 8,
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                {openingChecklistItems.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "flex-start",
                      padding: 8,
                      border: "1px solid #f3f4f6",
                      borderRadius: 6,
                      background: openingChecklist[item.key] ? "#f0fdf4" : "#fff",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        flex: "1 1 auto",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(openingChecklist[item.key])}
                        onChange={(e) =>
                          updateOpeningChecklist(item.key, e.target.checked)
                        }
                        style={{ marginTop: 3 }}
                      />
                      <span>
                        <strong>{item.label}</strong>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        "id" in item && typeof item.id === "string"
                          ? deleteCustomOpeningChecklistItem(item.id)
                          : deleteDefaultOpeningChecklistItem(item.key)
                      }
                      disabled={loading}
                    >
                      削除
                    </button>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                    paddingTop: 4,
                  }}
                >
                  <input
                    value={newOpeningChecklistItem}
                    onChange={(e) => setNewOpeningChecklistItem(e.target.value)}
                    placeholder="チェック項目を追加"
                    style={{ ...inputStyle, flex: "1 1 240px" }}
                  />
                  <button
                    type="button"
                    onClick={addCustomOpeningChecklistItem}
                    disabled={loading}
                  >
                    追加
                  </button>
                </div>
                {allOpeningChecklistDone && !openingFinished && (
                  <button
                    type="button"
                    onClick={finishOpeningWork}
                    disabled={loading}
                    style={{ marginTop: 4 }}
                  >
                    開店準備を完了する
                  </button>
                )}
                {openingFinished && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      padding: 10,
                      borderRadius: 6,
                      background: "#f0fdf4",
                      color: "#166534",
                      fontWeight: 700,
                    }}
                  >
                    本日もよろしくお願いします。
                  </p>
                )}
              </div>
            )}
          </section>

          <section style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => toggleOpeningSection("history")}
              style={orderSectionHeaderStyle}
            >
              <span>
                {isOpeningSectionOpen("history") ? "▼" : "▶"} 開店履歴
              </span>
              <strong>{openingReports.length}件</strong>
            </button>
            {isOpeningSectionOpen("history") && (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 8,
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                {openingReports.length === 0 ? (
                  <p style={{ margin: 0, color: "#6b7280" }}>
                    開店履歴はまだありません
                  </p>
                ) : (
                  openingReports.map((report) => (
                    <div
                      key={report.id}
                      style={{
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: 8,
                      }}
                    >
                      <strong>
                        {report.business_date} /{" "}
                        {new Date(report.completed_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>
                      <p style={{ margin: "4px 0 0", color: "#4b5563" }}>
                        チェック {report.checklist_completed}/{report.checklist_total}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </section>
      )}

      {activeTab === "low-stock" && (
      <>
      <div
        className="admin-two-column"
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
          }}
        >
          <h2 style={{ margin: "0 0 8px" }}>発注管理</h2>

          {lowStockItems.length === 0 ? (
            <p style={{ margin: 0 }}>基準在庫を下回っている商品はありません</p>
          ) : (
            <p style={{ margin: "0 0 12px" }}>
              <strong style={{ color: "#dc2626" }}>
                {lowStockItems.length}件
              </strong>
              の商品が基準在庫を下回っています。
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <h4 style={{ margin: 0, fontSize: 15 }}>
                      {group.category}
                    </h4>
                    <button onClick={() => copyOrderListCategory(group)}>
                      コピー
                    </button>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {group.items.map((item) => (
                      <li key={item.id} style={{ marginBottom: 6 }}>
                        {item.name}:{" "}
                        <strong style={{ color: "#dc2626" }}>
                          {formatStockQuantity(item.shortage)}
                        </strong>
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

        {orderManagementGroups.length === 0 ? (
          <p style={{ margin: 0 }}>使用中の卓はありません</p>
        ) : (
        <div
          className="order-table-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {orderManagementGroups.map(
            ({ group, pendingOrders, historyOrders, canceledOrders, staffCalls, staffCallOrders, noticeCount }) => (
              <section
                key={group.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 12,
                  backgroundColor: "#f9fafb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 18 }}>
                    {group.label}
                    {notificationBadge(noticeCount)}
                  </h3>
                  <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
                    {group.checkout_requested_at ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>
                        会計希望あり
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: "#6b7280" }}>
                        会計希望なし
                      </span>
                    )}
                    <button
                      onClick={() => checkoutGroup(group.id)}
                      disabled={loading || !group.checkout_requested_at}
                      style={{
                        opacity: loading || !group.checkout_requested_at ? 0.55 : 1,
                        cursor: loading || !group.checkout_requested_at ? "not-allowed" : "pointer",
                      }}
                    >
                      会計済みにする
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleOrderSection(group.id, "pending")}
                      style={orderSectionHeaderStyle}
                    >
                      <span>
                        {isOrderSectionOpen(group.id, "pending") ? "▼" : "▶"} 注文中
                      </span>
                      {notificationBadge(pendingOrders.length)}
                    </button>
                    {isOrderSectionOpen(group.id, "pending") && (
                    pendingOrders.length === 0 ? (
                      <p style={{ margin: 0, color: "#4b5563" }}>注文中の商品はありません</p>
                    ) : (
                      <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                      {pendingOrders.map((order) => (
                        <li key={order.id} style={{ marginBottom: 8 }}>
                          <div>
                            <strong>{getJoinedName(order.menu_items)}</strong> × {order.quantity}
                            {isFirstOrder(order) && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  color: "#92400e",
                                  backgroundColor: "#fff7ed",
                                  border: "1px solid #fdba74",
                                  borderRadius: 999,
                                  padding: "2px 6px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                ファーストオーダー
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 14, color: "#4b5563" }}>
                            状態: {order.status}
                          </div>
                          <div style={{ fontSize: 14, color: "#4b5563" }}>
                            経過: {getElapsedMinutes(order.created_at)}分 / 注文: {formatOrderTime(order.created_at)}
                          </div>
                          {order.status === "調理待ち" ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                              <button
                                onClick={() => startCooking(order.id)}
                                disabled={loading}
                              >
                                調理開始
                              </button>
                              <button
                                onClick={() => removeOrder(order)}
                                disabled={loading}
                                style={{
                                  color: "#b91c1c",
                                  backgroundColor: "#fff",
                                  border: "1px solid #fca5a5",
                                }}
                              >
                                削除
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => finishOrder(order.id)}
                              disabled={loading}
                              style={{ marginTop: 6 }}
                            >
                              完成
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    ))}
                  </div>

                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleOrderSection(group.id, "manual")}
                      style={orderSectionHeaderStyle}
                    >
                      <span>
                        {isOrderSectionOpen(group.id, "manual") ? "▼" : "▶"} 手動注文
                      </span>
                    </button>
                    {isOrderSectionOpen(group.id, "manual") && (
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
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
                        inputMode="decimal"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(e.target.value)}
                        style={inputStyle}
                      />

                      <button onClick={() => addOrder(group.id)} disabled={loading}>
                        この卓に追加
                      </button>
                    </div>
                    )}
                  </div>

                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleOrderSection(group.id, "canceled")}
                      style={orderSectionHeaderStyle}
                    >
                      <span>
                        {isOrderSectionOpen(group.id, "canceled") ? "▼" : "▶"} キャンセル
                      </span>
                      {notificationBadge(canceledOrders.length)}
                    </button>
                    {isOrderSectionOpen(group.id, "canceled") && (
                    canceledOrders.length === 0 ? (
                      <p style={{ margin: 0, color: "#4b5563" }}>未確認のキャンセルはありません</p>
                    ) : (
                      <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                        {canceledOrders.map((order) => (
                          <li key={order.id} style={{ marginBottom: 8 }}>
                          <div>
                            <strong>{getJoinedName(order.menu_items)}</strong> × {order.quantity}
                          </div>
                          <div style={{ fontSize: 14, color: "#4b5563" }}>
                            注文: {new Date(order.created_at).toLocaleString()}
                            {order.cancelled_at &&
                              ` / キャンセル: ${new Date(order.cancelled_at).toLocaleString()}`}
                          </div>
                          <button
                            onClick={() => confirmCancellation(order.id)}
                            disabled={loading}
                            style={{ marginTop: 6 }}
                          >
                            確認済みにする
                          </button>
                        </li>
                        ))}
                      </ul>
                    ))}
                  </div>

                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleOrderSection(group.id, "staff-calls")}
                      style={orderSectionHeaderStyle}
                    >
                      <span>
                        {isOrderSectionOpen(group.id, "staff-calls") ? "▼" : "▶"} 呼び出し
                      </span>
                      {notificationBadge(staffCalls.length + staffCallOrders.length)}
                    </button>
                    {isOrderSectionOpen(group.id, "staff-calls") && (
                    staffCalls.length + staffCallOrders.length === 0 ? (
                      <p style={{ margin: 0, color: "#4b5563" }}>未確認の呼び出しはありません</p>
                    ) : (
                      <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                        {staffCalls.map((call) => (
                          <li key={call.id} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 14, color: "#4b5563" }}>
                              呼び出し: {new Date(call.created_at).toLocaleString()}
                            </div>
                            <button
                              onClick={() => markStandaloneStaffCallConfirmed(call.id)}
                              disabled={loading}
                              style={{ marginTop: 6 }}
                            >
                              確認済みにする
                            </button>
                          </li>
                        ))}
                        {staffCallOrders.map((order) => (
                          <li key={order.id} style={{ marginBottom: 8 }}>
                            <div>
                              <strong>{getJoinedName(order.menu_items)}</strong> × {order.quantity}
                            </div>
                            <div style={{ fontSize: 14, color: "#4b5563" }}>
                              注文: {new Date(order.created_at).toLocaleString()}
                              {order.staff_called_at &&
                                ` / 呼び出し: ${new Date(order.staff_called_at).toLocaleString()}`}
                            </div>
                            <button
                              onClick={() => markStaffCallConfirmed(order.id)}
                              disabled={loading}
                              style={{ marginTop: 6 }}
                            >
                              確認済みにする
                            </button>
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>

                  <div
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleOrderSection(group.id, "history")}
                      style={orderSectionHeaderStyle}
                    >
                      <span>
                        {isOrderSectionOpen(group.id, "history") ? "▼" : "▶"} 注文履歴
                      </span>
                    </button>
                    {isOrderSectionOpen(group.id, "history") && (
                    historyOrders.length === 0 ? (
                      <p style={{ margin: 0, color: "#4b5563" }}>完了・キャンセル済みの注文はありません</p>
                    ) : (
                      <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                        {historyOrders.map((order) => (
                          <li key={order.id} style={{ marginBottom: 8 }}>
                            <div>
                              <strong>{getJoinedName(order.menu_items)}</strong> × {order.quantity}
                            </div>
                            <div style={{ fontSize: 14, color: "#4b5563" }}>
                              {getOrderHistoryDateLabel(order)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                </div>
              </section>
            )
          )}
        </div>
        )}

      </section>
      )}

      {activeTab === "closing" && (
        <section style={sectionStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 4px" }}>閉店チェック</h2>
              <p style={{ margin: 0, color: "#4b5563" }}>
                今日の注文と在庫変動を確認します。
              </p>
            </div>
            <button onClick={loadClosingCheckData} disabled={loading}>
              更新
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {[
              ["今日の注文", todayOrders.length],
              ["完了", todayCompletedOrders.length],
              ["調理中・待ち", todayActiveOrders.length],
              ["キャンセル", todayCanceledOrders.length],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <p style={{ margin: "0 0 6px", color: "#4b5563", fontSize: 14 }}>
                  {label}
                </p>
                <strong style={{ fontSize: 24 }}>{value}</strong>
              </div>
            ))}
          </div>

          <div
            className="closing-check-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                background: "#fff",
                gridColumn: isClosingSectionOpen("usage-diff") ? "1 / -1" : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => toggleClosingSection("usage-diff")}
                style={orderSectionHeaderStyle}
              >
                <span>
                  {isClosingSectionOpen("usage-diff") ? "▼" : "▶"} 在庫反映漏れチェック
                </span>
                {notificationBadge(orderUsageDiffs.length)}
              </button>
              {isClosingSectionOpen("usage-diff") && (
              <div style={{ marginTop: 8 }}>
              <p style={{ margin: "0 0 10px", color: "#4b5563", fontSize: 14 }}>
                注文で減るはずの食材数と、実際に在庫から減った数を比べます。
              </p>
              {orderUsageDiffs.length === 0 ? (
                <p style={{ margin: 0, color: "#166534", fontWeight: 700 }}>
                  在庫反映漏れの候補はありません
                </p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {orderUsageDiffs.map((diff) => (
                    <div
                      key={`${diff.order.id}:${diff.itemId}`}
                      style={{
                        border: "1px solid #fed7aa",
                        borderRadius: 6,
                        padding: 8,
                        background: "#fff7ed",
                      }}
                    >
                      <strong>
                        {diff.menu.name} / {diff.item?.name ?? "商品不明"}
                      </strong>
                      <p style={{ margin: "4px 0 0", color: "#9a3412" }}>
                        注文: {formatOrderTime(diff.order.created_at)} / 本来{" "}
                        {formatStockQuantity(diff.expectedQty)}
                        {diff.item?.unit ?? ""} / 実際 {formatStockQuantity(diff.actualQty)}
                        {diff.item?.unit ?? ""} / 差分{" "}
                        {formatStockQuantity(diff.diffQty)}
                        {diff.item?.unit ?? ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={applyClosingUsageDiff}
                disabled={loading || orderUsageDiffs.length === 0}
                style={{
                  marginTop: 10,
                  opacity: loading || orderUsageDiffs.length === 0 ? 0.55 : 1,
                  cursor:
                    loading || orderUsageDiffs.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                未反映分を在庫に反映
              </button>
              </div>
              )}
            </section>
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                background: "#fff",
                gridColumn: isClosingSectionOpen("orders") ? "1 / -1" : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => toggleClosingSection("orders")}
                style={orderSectionHeaderStyle}
              >
                <span>
                  {isClosingSectionOpen("orders") ? "▼" : "▶"} 今日の注文一覧
                </span>
                <strong>{todayOrders.length}件</strong>
              </button>
              {isClosingSectionOpen("orders") && (
              <div style={{ marginTop: 8 }}>
              {todayOrders.length === 0 ? (
                <p style={{ margin: 0, color: "#6b7280" }}>今日の注文はありません</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {todayOrders.map((order) => (
                    <div
                      key={order.id}
                      style={{
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: 8,
                      }}
                    >
                      <strong>{getJoinedName(order.menu_items) || "メニュー不明"}</strong>
                      <p style={{ margin: "4px 0 0", color: "#4b5563" }}>
                        {formatStockQuantity(order.quantity)}件 / {order.status} /{" "}
                        {(Array.isArray(order.customer_groups)
                          ? order.customer_groups[0]?.label
                          : order.customer_groups?.label) || "卓なし"} /{" "}
                        {formatOrderTime(order.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              </div>
              )}
            </section>

            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                background: "#fff",
                gridColumn: isClosingSectionOpen("stock-movements") ? "1 / -1" : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => toggleClosingSection("stock-movements")}
                style={orderSectionHeaderStyle}
              >
                <span>
                  {isClosingSectionOpen("stock-movements") ? "▼" : "▶"} 今日の在庫変動
                </span>
                <strong>{dailyStockMovements.length}件</strong>
              </button>
              {isClosingSectionOpen("stock-movements") && (
              <div style={{ marginTop: 8 }}>
              {dailyStockMovements.length === 0 ? (
                <p style={{ margin: 0, color: "#6b7280" }}>今日の在庫変動はありません</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {closingMovementSummary.map((group) => (
                    <div key={group.category}>
                      <h4 style={{ margin: "0 0 6px" }}>
                        {group.category} {group.count}件
                      </h4>
                      {group.movements.length === 0 ? (
                        <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
                          記録なし
                        </p>
                      ) : (
                        <div style={{ display: "grid", gap: 6 }}>
                          {group.movements.map((movement) => {
                            const item = itemsById.get(movement.item_id);
                            return (
                              <div
                                key={movement.id}
                                style={{
                                  border: "1px solid #f3f4f6",
                                  borderRadius: 6,
                                  padding: 8,
                                }}
                              >
                                <strong>{item?.name ?? "商品不明"}</strong>
                                <p style={{ margin: "4px 0 0", color: "#4b5563" }}>
                                  {movement.delta >= 0 ? "+" : "-"}
                                  {formatStockQuantity(Math.abs(movement.delta))}
                                  {item?.unit ?? ""} / {movement.reason ?? group.category} /{" "}
                                  {formatOrderTime(movement.created_at)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
              )}
            </section>
          </div>

          <section style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => toggleClosingSection("checklist")}
              style={orderSectionHeaderStyle}
            >
              <span>
                {isClosingSectionOpen("checklist") ? "▼" : "▶"} 閉店後チェックリスト
              </span>
              <strong>
                {completedClosingChecklistCount}/{closingChecklistItems.length}
              </strong>
            </button>
            {isClosingSectionOpen("checklist") && (
            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 8,
                padding: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              {closingChecklistItems.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "flex-start",
                    padding: 8,
                    border: "1px solid #f3f4f6",
                    borderRadius: 6,
                    background: closingChecklist[item.key] ? "#f0fdf4" : "#fff",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      flex: "1 1 auto",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(closingChecklist[item.key])}
                      onChange={(e) =>
                        updateClosingChecklist(item.key, e.target.checked)
                      }
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      {item.warning && (
                        <span
                          style={{
                            display: "block",
                            marginTop: 2,
                            color: "#b45309",
                            fontSize: 13,
                          }}
                        >
                          {item.warning}
                        </span>
                      )}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      "custom" in item && item.custom
                        ? deleteCustomClosingChecklistItem(item.key)
                        : deleteDefaultClosingChecklistItem(item.key)
                    }
                    disabled={loading}
                  >
                    削除
                  </button>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                  paddingTop: 4,
                }}
              >
                <input
                  value={newClosingChecklistItem}
                  onChange={(e) => setNewClosingChecklistItem(e.target.value)}
                  placeholder="チェック項目を追加"
                  style={{ ...inputStyle, flex: "1 1 240px" }}
                />
                <button
                  type="button"
                  onClick={addCustomClosingChecklistItem}
                  disabled={loading}
                >
                  追加
                </button>
              </div>
              {allClosingChecklistDone && !closingFinished && (
                <button
                  type="button"
                  onClick={finishClosingWork}
                  disabled={loading}
                  style={{ marginTop: 4 }}
                >
                  閉店作業を終了する
                </button>
              )}
              {closingFinished && (
                <p
                  style={{
                    margin: "4px 0 0",
                    padding: 10,
                    borderRadius: 6,
                    background: "#f0fdf4",
                    color: "#166534",
                    fontWeight: 700,
                  }}
                >
                  お疲れ様でした。
                </p>
              )}
            </div>
            )}
          </section>

          <section style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => toggleClosingSection("history")}
              style={orderSectionHeaderStyle}
            >
              <span>
                {isClosingSectionOpen("history") ? "▼" : "▶"} 閉店履歴
              </span>
              <strong>{closingReports.length}件</strong>
            </button>
            {isClosingSectionOpen("history") && (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 8,
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                {closingReports.length === 0 ? (
                  <p style={{ margin: 0, color: "#6b7280" }}>
                    閉店履歴はまだありません
                  </p>
                ) : (
                  closingReports.map((report) => (
                    <div
                      key={report.id}
                      style={{
                        border: "1px solid #f3f4f6",
                        borderRadius: 6,
                        padding: 8,
                      }}
                    >
                      <strong>
                        {report.business_date} /{" "}
                        {new Date(report.completed_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>
                      <p style={{ margin: "4px 0 0", color: "#4b5563" }}>
                        チェック {report.checklist_completed}/{report.checklist_total} / 注文{" "}
                        {report.order_count}件 / 完了 {report.completed_order_count}件 / 在庫変動{" "}
                        {report.stock_movement_count}件 / 反映漏れ候補{" "}
                        {report.stock_reconciliation_issue_count}件
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </section>
      )}

      {activeTab === "menu" && (
        <section style={sectionStyle}>
          <h2 style={{ margin: "0 0 12px" }}>メニュー管理</h2>
        <div>
          <button
            type="button"
            onClick={() => setMenuFormOpen((open) => !open)}
            style={{
              ...buttonStyle,
              width: "100%",
              textAlign: "left",
              padding: "8px 10px",
              background: menuFormOpen ? "#eff6ff" : "#fff",
              borderColor: menuFormOpen ? "#2563eb" : "#9ca3af",
            }}
          >
            {menuFormOpen ? "▼" : "▶"} メニュー登録
          </button>
          {menuFormOpen && (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <input
              placeholder="メニュー名（例：唐揚げ定食）"
              value={newMenuName}
              onChange={(e) => setNewMenuName(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="カテゴリ（例：定食・麺・ドリンク）"
              value={newMenuCategory}
              onChange={(e) => setNewMenuCategory(e.target.value)}
              list="menu-category-options"
              style={inputStyle}
            />
            <datalist id="menu-category-options">
              {menuCategoryOptions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={newMenuPrepRequired}
                onChange={(e) => setNewMenuPrepRequired(e.target.checked)}
              />
              仕込み対象にする
            </label>
            <button onClick={addMenu} disabled={loading}>
              追加
            </button>
          </div>
          )}

          <button
            type="button"
            onClick={() => setRecipeFormOpen((open) => !open)}
            style={{
              ...buttonStyle,
              width: "100%",
              textAlign: "left",
              marginTop: 12,
              padding: "8px 10px",
              background: recipeFormOpen ? "#eff6ff" : "#fff",
              borderColor: recipeFormOpen ? "#2563eb" : "#9ca3af",
            }}
          >
            {recipeFormOpen ? "▼" : "▶"} レシピ登録
          </button>
          {recipeFormOpen && (
          <>
          <p style={{ margin: "8px 0", fontSize: 14 }}>
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
              <input
                value={recipeItemInput}
                onChange={(e) => {
                  const value = e.target.value;
                  const normalizedValue = normalizeItemNameInput(value);
                  const matchedItem = items.find(
                    (item) => normalizeItemNameInput(item.name) === normalizedValue
                  );
                  setError(null);
                  setRecipeItemInput(value);
                  setRecipeItemId(matchedItem?.id ?? "");
                }}
                placeholder="食材名を入力"
                list="recipe-item-options"
                style={inputStyle}
              />
              <datalist id="recipe-item-options">
                {recipeItemOptions.map((item) => (
                  <option
                    key={item.id}
                    value={item.name}
                    label={`${getCategoryLabel(item)} / ${item.unit}`}
                  />
                ))}
              </datalist>
            </label>

            <label style={fieldLabelStyle}>
              1個あたりの使用量
              <input
                placeholder="例：15"
                inputMode="decimal"
                value={recipeQuantity}
                onChange={(e) => setRecipeQuantity(e.target.value)}
                style={inputStyle}
              />
            </label>

            <button onClick={addRecipeItem} disabled={loading}>
              レシピに追加
            </button>
          </div>
          </>
          )}
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
              {(openedRecipeCategoryGroup ? [openedRecipeCategoryGroup] : menuCategoryGroups).map((group) => {
                const categoryOpened = openRecipeCategory === group.category;
                const categoryAvailability =
                  getMenuCategoryAvailabilitySummary(group.menus);

                return (
                <section
                  key={group.category}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenRecipeCategory(categoryOpened ? null : group.category);
                      setExpandedRecipeMenuId(null);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      padding: 0,
                      color: "#111827",
                      background: "transparent",
                      border: 0,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{group.category}</span>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {categoryAvailability.unavailable > 0 && (
                        <span style={{ color: "#dc2626", fontSize: 13 }}>
                          作成不可 {categoryAvailability.unavailable}
                        </span>
                      )}
                      {categoryAvailability.low > 0 && (
                        <span style={{ color: "#f97316", fontSize: 13 }}>
                          残り少 {categoryAvailability.low}
                        </span>
                      )}
                    </span>
                  </button>
                  {categoryOpened && (
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {group.menus.map((menu) => {
                      const expanded = expandedRecipeMenuId === menu.id;
                      const availability = getMenuAvailability(menu);
                      const availabilityStatus = getAvailabilityStatus(
                        availability.servings
                      );

                      return (
                        <div
                          key={menu.id}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                          }}
                        >
                    {editingMenuId === menu.id && (
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          marginBottom: 10,
                          padding: 10,
                          borderRadius: 8,
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <input
                          value={editingMenuName}
                          onChange={(e) => setEditingMenuName(e.target.value)}
                          placeholder="メニュー名"
                          style={inputStyle}
                        />
                        <input
                          value={editingMenuCategory}
                          onChange={(e) => setEditingMenuCategory(e.target.value)}
                          placeholder="カテゴリ"
                          list="menu-category-options"
                          style={inputStyle}
                        />
                        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={editingMenuPrepRequired}
                            onChange={(e) =>
                              setEditingMenuPrepRequired(e.target.checked)
                            }
                          />
                          仕込み対象にする
                        </label>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={saveMenuEdit}
                            disabled={loading}
                            style={buttonStyle}
                          >
                            保存
                          </button>
                          <button
                            onClick={cancelMenuEdit}
                            disabled={loading}
                            style={buttonStyle}
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() =>
                          setExpandedRecipeMenuId(expanded ? null : menu.id)
                        }
                        style={{
                          ...buttonStyle,
                          flex: "1 1 220px",
                          textAlign: "left",
                          padding: "8px 10px",
                          background: expanded ? "#eff6ff" : "#fff",
                          borderColor: expanded ? "#2563eb" : "#9ca3af",
                        }}
                      >
                        {expanded ? "▼" : "▶"} {menu.name}
                        <span style={{ marginLeft: 8, fontSize: 13, color: "#4b5563" }}>
                          {menu.recipes.length}品
                        </span>
                        {availability.servings !== null && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 13,
                              color: getAvailabilityColor(availability.servings),
                              fontWeight: 700,
                            }}
                          >
                            作成可能: {availability.servings}件
                          </span>
                        )}
                        {availabilityStatus && (
                          <span
                            style={{
                              marginLeft: 8,
                              padding: "2px 6px",
                              borderRadius: 999,
                              fontSize: 12,
                              color: availabilityStatus.color,
                              backgroundColor: availabilityStatus.background,
                              fontWeight: 700,
                            }}
                          >
                            {availabilityStatus.label}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => startMenuEdit(menu)}
                        disabled={loading}
                        style={{ ...buttonStyle, flex: "0 0 auto" }}
                      >
                        メニュー編集
                      </button>
                      <button
                        onClick={() => removeMenu(menu)}
                        disabled={loading}
                        style={{ ...buttonStyle, flex: "0 0 auto" }}
                      >
                        メニュー削除
                      </button>
                    </div>

                    {expanded &&
                      (menu.recipes.length === 0 ? (
                        <p style={{ margin: "8px 0 0" }}>レシピ未登録</p>
                      ) : (
                        <>
                        <div
                          style={{
                            marginTop: 10,
                            padding: 10,
                            borderRadius: 8,
                            background: "#f9fafb",
                            border: "1px solid #e5e7eb",
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>
                            単独作成可能:{" "}
                            <span
                              style={{
                                color: getAvailabilityColor(availability.servings),
                              }}
                            >
                              {availability.servings ?? 0}件
                            </span>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {availability.ingredients.map((ingredient) => (
                              <li key={ingredient.itemId} style={{ marginBottom: 4 }}>
                                {ingredient.name}: 在庫 {formatStockQuantity(ingredient.currentStock)}
                                {ingredient.unit} / 1件 {ingredient.requiredQty}
                                {ingredient.unit}
                              </li>
                            ))}
                          </ul>
                          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#4b5563" }}>
                            同じ食材を使う別メニューと同時に作る場合、作成可能数は変わります。
                          </p>
                        </div>
                        <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                          {menu.recipes.map((recipe) => (
                            <li key={recipe.id} style={{ marginBottom: 6 }}>
                              {getJoinedName(recipe.items)}: {recipe.quantity}
                              <button
                                onClick={async () => {
                                  try {
                                    setError(null);
                                    await deleteRecipe(recipe.id);
                                    await loadOrderData();
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
                        </>
                      ))}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </section>
                );
              })}
            </div>
          </div>
        )}
      </section>
      )}

      {activeTab === "prep" && (
      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 12px" }}>仕込み管理</h2>

        {prepCategoryGroups.length === 0 ? (
          <p style={{ margin: 0 }}>
            仕込み対象で、作成可能数が少ないメニューはありません
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {(openedPrepCategoryGroup ? [openedPrepCategoryGroup] : prepCategoryGroups).map((group) => {
              const categoryOpened = openPrepCategory === group.category;
              const categoryAvailability =
                getMenuCategoryAvailabilitySummary(group.menus);

              return (
                <section
                  key={group.category}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPrepCategory(categoryOpened ? null : group.category);
                      setExpandedPrepMenuId(null);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      padding: 0,
                      color: "#111827",
                      background: "transparent",
                      border: 0,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{group.category}</span>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {categoryAvailability.unavailable > 0 && (
                        <span style={{ color: "#dc2626", fontSize: 13 }}>
                          作成不可 {categoryAvailability.unavailable}
                        </span>
                      )}
                      {categoryAvailability.low > 0 && (
                        <span style={{ color: "#f97316", fontSize: 13 }}>
                          残り少 {categoryAvailability.low}
                        </span>
                      )}
                    </span>
                  </button>

                  {categoryOpened && (
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {group.menus.map((menu) => {
                      const expanded = expandedPrepMenuId === menu.id;
                      const availability = getMenuAvailability(menu);
                      const availabilityStatus = getAvailabilityStatus(
                        availability.servings
                      );

                      return (
                        <div
                          key={menu.id}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                          }}
                        >
                          <button
                            onClick={() =>
                              setExpandedPrepMenuId(expanded ? null : menu.id)
                            }
                            style={{
                              ...buttonStyle,
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 10px",
                              background: expanded ? "#eff6ff" : "#fff",
                              borderColor: expanded ? "#2563eb" : "#9ca3af",
                            }}
                          >
                            {expanded ? "▼" : "▶"} {menu.name}
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 13,
                                color: getAvailabilityColor(availability.servings),
                                fontWeight: 700,
                              }}
                            >
                              作成可能: {availability.servings ?? 0}件
                            </span>
                            {availabilityStatus && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  padding: "2px 6px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  color: availabilityStatus.color,
                                  backgroundColor: availabilityStatus.background,
                                  fontWeight: 700,
                                }}
                              >
                                {availabilityStatus.label}
                              </span>
                            )}
                          </button>

                          {expanded && (
                            <div
                              style={{
                                marginTop: 10,
                                padding: 10,
                                borderRadius: 8,
                                background: "#f9fafb",
                                border: "1px solid #e5e7eb",
                              }}
                            >
                              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                                仕込み確認
                              </div>
                              {availability.ingredients.length === 0 ? (
                                <p style={{ margin: 0 }}>レシピ未登録</p>
                              ) : (
                                <>
                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                  {availability.ingredients.map((ingredient) => (
                                    <li key={ingredient.itemId} style={{ marginBottom: 4 }}>
                                      {ingredient.name}: 在庫{" "}
                                      {formatStockQuantity(ingredient.currentStock)}
                                      {ingredient.unit} / 1件{" "}
                                      {ingredient.requiredQty}
                                      {ingredient.unit}
                                    </li>
                                  ))}
                                </ul>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    marginTop: 10,
                                  }}
                                >
                                  <input
                                    inputMode="decimal"
                                    placeholder="仕込み数"
                                    value={prepQuantityByMenuId[menu.id] ?? ""}
                                    onChange={(e) =>
                                      setPrepQuantityByMenuId((prev) => ({
                                        ...prev,
                                        [menu.id]: e.target.value,
                                      }))
                                    }
                                    style={{ ...inputStyle, width: 120 }}
                                  />
                                  <button
                                    onClick={() => recordPrep(menu)}
                                    disabled={loading}
                                  >
                                    仕込み記録
                                  </button>
                                </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </section>
              );
            })}
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
        <section style={sectionStyle}>
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
                      position: "relative",
                      textAlign: "left",
                      padding: 12,
                      paddingRight: summary.lowCount > 0 ? 42 : 12,
                      borderRadius: 8,
                      border: selected ? "2px solid #2563eb" : "1px solid #ddd",
                      background: selected ? "#eff6ff" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <strong>{summary.category}</strong>
                    {summary.lowCount > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          minWidth: 22,
                          height: 22,
                          padding: "0 6px",
                          borderRadius: 999,
                          background: "#dc2626",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 800,
                          lineHeight: "22px",
                          textAlign: "center",
                        }}
                      >
                        {summary.lowCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

      <div
        className="inventory-controls"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={onlyLow}
              onChange={(e) => setOnlyLow(e.target.checked)}
            />
            在庫基準未満
          </label>
        </div>

        <div className="inventory-bulk-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setItemFormOpen((open) => !open)}
            disabled={loading}
          >
            商品追加
          </button>
          <button onClick={() => moveSelectedQuantities(1, "仕入れ")} disabled={loading}>
            まとめて仕入れ
          </button>
          <button onClick={() => moveSelectedQuantities(-1, "使用")} disabled={loading}>
            まとめて使用
          </button>
          <button onClick={() => moveSelectedQuantities(-1, "廃棄")} disabled={loading}>
            まとめて廃棄
          </button>
        </div>
      </div>

      {pendingStockCorrection && (
        <section
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #f59e0b",
            borderRadius: 8,
            background: "#fffbeb",
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>
            在庫修正内容を選択
          </h3>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              padding: 8,
              border: "1px solid #fde68a",
              borderRadius: 6,
              background: "#fff",
              marginBottom: 10,
            }}
          >
            <p style={{ margin: 0, color: "#4b5563" }}>
              {pendingStockCorrection.item.name}:{" "}
              {formatStockQuantity(pendingStockCorrection.qty)}
              {pendingStockCorrection.item.unit}
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() =>
                  setPendingStockCorrection((current) =>
                    current ? { ...current, sign: 1 } : current
                  )
                }
                disabled={loading}
                style={{
                  border:
                    pendingStockCorrection.sign === 1
                      ? "2px solid #2563eb"
                      : "1px solid #9ca3af",
                }}
              >
                増やす
              </button>
              <button
                type="button"
                onClick={() =>
                  setPendingStockCorrection((current) =>
                    current ? { ...current, sign: -1 } : current
                  )
                }
                disabled={loading}
                style={{
                  border:
                    pendingStockCorrection.sign === -1
                      ? "2px solid #2563eb"
                      : "1px solid #9ca3af",
                }}
              >
                減らす
              </button>
            </div>
          </div>
          <p style={{ margin: "0 0 8px", color: "#4b5563", fontSize: 14 }}>
            在庫を増やすか減らすか選んでから、理由を選択してください。
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stockCorrectionReasonOptions.slice(0, 5).map((reason, index) => (
              <button
                key={reason}
                type="button"
                onClick={() => applyPendingStockCorrection(reason)}
                disabled={loading || !pendingStockCorrection.sign}
              >
                {index + 1}. {reason}
              </button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: 10,
            }}
          >
            <input
              value={customStockCorrectionReason}
              onChange={(e) => setCustomStockCorrectionReason(e.target.value)}
              placeholder="その他の理由"
              style={{ ...inputStyle, minWidth: 220 }}
            />
            <button
              type="button"
              onClick={() => applyPendingStockCorrection("その他")}
              disabled={loading || !pendingStockCorrection.sign}
            >
              6. その他
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingStockCorrection(null);
                setCustomStockCorrectionReason("");
              }}
              disabled={loading}
            >
              キャンセル
            </button>
          </div>
        </section>
      )}

      {itemFormOpen && (
      <section style={sectionStyle}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>商品追加</h3>
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
            list="unit-options"
            onChange={(e) => setNewUnit(e.target.value)}
            style={inputStyle}
          />
          <datalist id="unit-options">
            {unitOptions.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          <input
            placeholder="カテゴリ（例：野菜）"
            value={newCategory}
            list="category-options"
            onChange={(e) => setNewCategory(e.target.value)}
            style={inputStyle}
          />
          <datalist id="category-options">
            {categoryOptions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <input
            placeholder="基準在庫（任意）"
            inputMode="decimal"
            value={newPar}
            onChange={(e) => setNewPar(e.target.value)}
            style={inputStyle}
          />

          <button onClick={addItem} disabled={loading} style={{ minHeight: 36 }}>
            追加
          </button>
        </div>
      </section>
      )}

      {loading && <p>読み込み中...</p>}

      <div className="inventory-table-scroll">
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
        <Fragment key={item.id}>
          <tr>
            <td style={tdStyle}>
              {editingId === item.id ? (
                <div className="inventory-edit-fields">
                  <label>
                    商品名
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="例：醤油"
                    />
                  </label>

                  <label>
                    単位
                    <input
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      placeholder="例：本・個・g"
                    />
                  </label>

                  <label>
                    カテゴリ
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="例：調味料"
                    />
                  </label>

                  <label>
                    在庫基準
                    <input
                      value={editPar}
                      onChange={(e) => setEditPar(e.target.value)}
                      placeholder="空欄でも可"
                      inputMode="decimal"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <b>{item.name}</b>（{item.unit}）
                  {low && (
                    <span style={{ color: "red", marginLeft: 8 }}>
                      在庫基準 {item.par_level}
                    </span>
                  )}
                </>
              )}
            </td>

            <td style={tdStyle}>{item.category || "未分類"}</td>

            <td className="inventory-actions-cell" style={tdStyle}>
              <strong style={{ color: getStockColor(item.current_stock, item.par_level) }}>
                {formatStockQuantity(item.current_stock)}
              </strong>
            </td>

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

                        const par = normalizeNumberInput(editPar);
                        const parLevel = par === "" ? null : parseNumberInput(editPar);
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
                    inputMode="decimal"
                    value={qtyById[item.id] ?? ""}
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
                    onClick={() => moveWithQty(item.id, 1, "在庫修正")}
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
            <tr>
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
                                if (h.reason === "廃棄") {
                                  await loadWasteData();
                                }
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
        </Fragment>
      );
    })}
  </tbody>
</table>
</div>


      {!loading && !error && items.length === 0 && (
        <p>商品がまだ登録されていません</p>
      )}
      </>
      )}
    </div>
    </div>
  );
}
