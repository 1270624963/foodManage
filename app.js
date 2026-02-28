import { SUPABASE_URL, SUPABASE_ANON_KEY, INITIAL_USERNAME, INITIAL_PASSWORD } from "./config.js";
import { createApi } from "./api.js";

const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
if (!supabaseClient) alert("Supabase SDK 加载失败，请检查网络");

const ALL = "__all__";
const THEME_BLUE = "blue";
const THEME_WARM = "warm";
const THEME_NOIR = "noir";
const THEMES = [THEME_BLUE, THEME_WARM, THEME_NOIR];
const state = {
  tab: "home",
  cat: ALL,
  homeStatus: null,
  user: null,
  token: "",
  theme: THEME_BLUE,
  inventory: [],
  categoryCatalog: [],
  profileCategoryExpanded: false,
  statsCategoryExpanded: false,
  settings: { expire_reminder: true }
};
const api = createApi({ supabaseClient, getToken: () => state.token });

const el = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  topHeader: document.getElementById("topHeader"),
  homePage: document.getElementById("homePage"),
  statsPage: document.getElementById("statsPage"),
  profilePage: document.getElementById("profilePage"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  foodModal: document.getElementById("foodModal"),
  foodForm: document.getElementById("foodForm"),
  modalTitle: document.getElementById("modalTitle"),
  foodIdInput: document.getElementById("foodIdInput"),
  foodNameInput: document.getElementById("foodNameInput"),
  foodCategoryInput: document.getElementById("foodCategoryInput"),
  foodQuantityInput: document.getElementById("foodQuantityInput"),
  foodInDateInput: document.getElementById("foodInDateInput"),
  foodExpireInput: document.getElementById("foodExpireInput"),
  cancelFoodBtn: document.getElementById("cancelFoodBtn"),
  toast: document.getElementById("toast"),
  loadingMask: document.getElementById("loadingMask")
};

function toast(msg) { if (!el.toast) return; el.toast.textContent = msg; el.toast.classList.remove("hidden"); setTimeout(() => el.toast.classList.add("hidden"), 1500); }
let loadingCounter = 0;
function setLoading(visible, text = "处理中...") {
  if (!el.loadingMask) return;
  if (visible) loadingCounter += 1;
  else loadingCounter = Math.max(0, loadingCounter - 1);
  const show = loadingCounter > 0;
  el.loadingMask.classList.toggle("hidden", !show);
  const textNode = el.loadingMask.querySelector(".loading-text");
  if (show && textNode) textNode.textContent = text;
}
async function withLoading(text, task) {
  setLoading(true, text);
  try {
    return await task();
  } finally {
    setLoading(false);
  }
}
async function withTimeout(promise, ms, timeoutMessage) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage || "操作超时")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
function resetHomeFilters() {
  state.cat = ALL;
  state.homeStatus = null;
}
function setLoggedIn(v) { el.loginView.classList.toggle("hidden", v); el.appView.classList.toggle("hidden", !v); }
function parseDate(v) { return new Date(`${v}T00:00:00`); }
function daysLeft(d) { const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()); return Math.ceil((parseDate(d) - today) / (24 * 3600 * 1000)); }
function status(i) { const d = daysLeft(i.expire_date); if (d < 0) return ["已过期", "status-expired"]; if (d <= 3) return ["即将过期", "status-warning"]; return ["新鲜", "status-fresh"]; }
function esc(v) { return String(v || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function normalizeCategoryName(v) { return (v || "").trim().slice(0, 12); }
function uniqueSorted(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN")); }
function categoryStorageKey() { return `food.categories.${state.user?.id || "anon"}`; }
function themeStorageKey() { return `food.theme.${state.user?.id || "anon"}`; }
function normalizeTheme(v) { return THEMES.includes(v) ? v : THEME_BLUE; }
function applyTheme(v) {
  const theme = normalizeTheme(v);
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
}
function loadTheme() {
  try {
    const v = localStorage.getItem(themeStorageKey());
    return normalizeTheme(v || THEME_BLUE);
  } catch {
    return THEME_BLUE;
  }
}
function saveTheme(v) {
  const theme = normalizeTheme(v);
  try { localStorage.setItem(themeStorageKey(), theme); } catch {}
  applyTheme(theme);
}
function loadCategoryCatalog() {
  try {
    const raw = localStorage.getItem(categoryStorageKey());
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return uniqueSorted(data.map(normalizeCategoryName));
  } catch {
    return [];
  }
}
function saveCategoryCatalog(list) {
  state.categoryCatalog = uniqueSorted(list.map(normalizeCategoryName));
  try { localStorage.setItem(categoryStorageKey(), JSON.stringify(state.categoryCatalog)); } catch {}
}
function allCategories() {
  const fromItems = state.inventory.map((i) => normalizeCategoryName(i.category));
  const fromCatalog = state.categoryCatalog.map(normalizeCategoryName);
  return uniqueSorted([...fromItems, ...fromCatalog]);
}
function renderCategorySelectOptions(selected = "") {
  const opts = allCategories();
  const selectedValue = normalizeCategoryName(selected) || opts[0] || "未分类";
  const source = opts.length ? opts : ["未分类"];
  el.foodCategoryInput.innerHTML = source
    .map((name) => `<option value="${name}" ${name === selectedValue ? "selected" : ""}>${name}</option>`)
    .join("");
}

async function usernameToLoginId(username) {
  const n = username.trim().toLowerCase();
  const bytes = new TextEncoder().encode(n);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return `u${hex}@example.com`;
}

function categories() { return [{ key: ALL, label: "全部" }, ...allCategories().map((v) => ({ key: v, label: v }))]; }
function filtered() {
  let rows = state.cat === ALL ? state.inventory : state.inventory.filter((i) => i.category === state.cat);
  if (state.homeStatus === "fresh") rows = rows.filter((i) => daysLeft(i.expire_date) > 3);
  if (state.homeStatus === "soon") rows = rows.filter((i) => { const d = daysLeft(i.expire_date); return d >= 0 && d <= 3; });
  if (state.homeStatus === "expired") rows = rows.filter((i) => daysLeft(i.expire_date) < 0);
  return rows;
}

function headerHome() { return `<div class="header-row"><div class="header-title"><h2>我的食材库</h2><small>智能管理，新鲜生活</small></div><button id="addFoodBtn" class="round-btn">+</button></div>`; }
function headerStats() { return `<div class="header-row"><div class="header-title"><h2>统计</h2><small>数据概览</small></div></div>`; }
function headerProfile() { const u = state.user?.user_metadata?.username || "用户"; return `<div class="header-row"><div class="header-title"><h2>我的</h2><small>账号与设置</small></div><div class="header-user">${u}</div></div>`; }
function renderHeader() { if (state.tab === "home") { el.topHeader.innerHTML = headerHome(); document.getElementById("addFoodBtn")?.addEventListener("click", () => openModal()); return; } if (state.tab === "stats") { el.topHeader.innerHTML = headerStats(); return; } el.topHeader.innerHTML = headerProfile(); }

function renderHome() {
  const chips = categories().map((c) => `<button class="${c.key === state.cat ? "chip active" : "chip"}" data-category="${c.key}">${c.label}</button>`).join("");
  const rows = filtered().map((i) => {
    const [txt, cls] = status(i);
    return `<article class="food-item"><div class="food-item-top"><h3>${i.name}</h3><span class="status status-corner ${cls}">${txt}</span></div><p>${i.in_date} 入库</p><p>剩余: ${i.quantity}</p><p>保质期至: ${i.expire_date}</p><div class="food-actions"><button class="text-btn" data-edit-id="${i.id}">编辑</button><button class="text-btn danger" data-delete-id="${i.id}">删除</button></div></article>`;
  }).join("");
  const empty = `<section class="empty-state"><h3>暂无数据</h3><p>点击右上角 + 添加食材</p></section>`;
  el.homePage.innerHTML = `<div class="category-bar">${chips}</div><div class="food-list">${rows || empty}</div>`;

  el.homePage.querySelectorAll("[data-category]").forEach((b) => b.addEventListener("click", () => {
    state.cat = b.dataset.category;
    state.homeStatus = null;
    renderHome();
  }));
  el.homePage.querySelectorAll("[data-edit-id]").forEach((b) => b.addEventListener("click", () => { const it = state.inventory.find((x) => x.id === b.dataset.editId); if (it) openModal(it); }));
  el.homePage.querySelectorAll("[data-delete-id]").forEach((b) => b.addEventListener("click", async () => {
    try {
      await withLoading("删除食材中...", async () => {
        await api.deleteFoodItem(b.dataset.deleteId);
        await refreshAndRender();
      });
      toast("已删除");
    } catch (e) {
      alert(e.message);
    }
  }));
}

function renderStats() {
  const total = state.inventory.length;
  const fresh = state.inventory.filter((i) => daysLeft(i.expire_date) > 3).length;
  const soon = state.inventory.filter((i) => { const d = daysLeft(i.expire_date); return d >= 0 && d <= 3; }).length;
  const exp = state.inventory.filter((i) => daysLeft(i.expire_date) < 0).length;

  if (total === 0) {
    el.statsPage.innerHTML = `<section class="empty-state"><h3>暂无统计数据</h3><p>请先在首页添加食材后再查看统计。</p></section>`;
    return;
  }

  const validDays = state.inventory.map((i) => Math.max(daysLeft(i.expire_date), 0));
  const avgDays = validDays.length ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length) : 0;

  const categoryMap = {};
  state.inventory.forEach((i) => {
    const key = i.category || "未分类";
    categoryMap[key] = (categoryMap[key] || 0) + 1;
  });

  const categoryRows = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `<div class="list-row clickable-row" data-action="stats-filter-category" data-category="${encodeURIComponent(name)}"><span>${name}</span><span>${count}</span></div>`)
    .join("");

  const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "无";

  el.statsPage.innerHTML = `
    <section class="stats-hero">
    <div class="cards-grid">
      <article class="metric metric-clickable" data-action="stats-filter-total"><strong class="metric-value metric-info">${total}</strong><span>总数</span></article>
      <article class="metric metric-clickable" data-action="stats-filter-status" data-status="fresh"><strong class="metric-value metric-fresh">${fresh}</strong><span>新鲜</span></article>
      <article class="metric metric-clickable" data-action="stats-filter-status" data-status="soon"><strong class="metric-value metric-soon">${soon}</strong><span>即将过期</span></article>
      <article class="metric metric-clickable" data-action="stats-filter-status" data-status="expired"><strong class="metric-value metric-expired">${exp}</strong><span>已过期</span></article>
      <article class="metric"><strong class="metric-value metric-info metric-compact">${avgDays}天</strong><span>平均剩余天数</span></article>
      <article class="metric"><strong class="metric-value metric-info metric-compact">${topCategory}</strong><span>主要分类</span></article>
    </div>
    <h3 class="panel-title fold-title stats-title">
      分类统计
      <button class="text-btn" data-action="toggle-stats-category">${state.statsCategoryExpanded ? "收起" : "展开"}</button>
    </h3>
    </section>
    <section class="list-card stats-category-card ${state.statsCategoryExpanded ? "" : "hidden"}">${categoryRows || "<div class='list-row'><span>暂无数据</span><span>-</span></div>"}</section>
  `;
}

function renderProfile() {
  const u = state.user?.user_metadata?.username || "用户";
  const expired = state.inventory.filter((i) => daysLeft(i.expire_date) < 0).length;
  const categoryNames = allCategories();
  const categoryRows = categoryNames.length
    ? categoryNames.map((name) => `<div class="menu-item"><span>${esc(name)}</span><span><button class="text-btn" data-action="edit-category" data-category="${encodeURIComponent(name)}">修改</button><button class="text-btn danger" data-action="delete-category" data-category="${encodeURIComponent(name)}">删除</button></span></div>`).join("")
    : `<div class="menu-item"><span>暂无分类</span><span>-</span></div>`;

  el.profilePage.innerHTML = `
    <section class="menu-group">
      <h4>功能设置</h4>
      <div class="menu-item"><span>过期提醒</span><button id="toggleReminderBtn" data-action="toggle-reminder" class="inline-switch ${state.settings?.expire_reminder ? "on" : ""}" title="提醒开关"></button></div>
      <div class="menu-item"><span>主题风格</span><select id="themeSelect" class="theme-select" data-action="theme-change"><option value="blue" ${state.theme === "blue" ? "selected" : ""}>淡蓝主题</option><option value="warm" ${state.theme === "warm" ? "selected" : ""}>暖橙主题</option><option value="noir" ${state.theme === "noir" ? "selected" : ""}>暗色主题</option></select></div>
      <div class="menu-item"><button id="clearExpiredBtn" data-action="clear-expired" class="text-btn danger">清空已过期</button><span>已过期 ${expired} 项</span></div>
    </section>

    <section class="menu-group">
      <h4 class="fold-title">
        分类管理
        <button class="text-btn" data-action="toggle-profile-category">${state.profileCategoryExpanded ? "收起" : "展开"}</button>
      </h4>
      <div class="${state.profileCategoryExpanded ? "" : "hidden"}">
      <div class="menu-item">
        <input id="newCategoryInput" class="input-inline" type="text" maxlength="12" placeholder="输入新分类名称">
        <button class="text-btn" data-action="add-category">新增</button>
      </div>
      ${categoryRows}
      </div>
    </section>

    <section class="menu-group">
      <h4>账户信息</h4>
      <div class="menu-item"><span>当前用户</span><span>${u}</span></div>
      <div class="menu-item"><span>账号状态</span><span>已登录</span></div>
      <div class="menu-item menu-item-center"><button id="logoutBtn" data-action="logout" class="logout-btn">退出登录</button></div>
    </section>
  `;
}

async function renameCategory(oldName, nextName) {
  const oldVal = normalizeCategoryName(oldName);
  const nextVal = normalizeCategoryName(nextName);
  if (!oldVal || !nextVal) throw new Error("分类名称不能为空");
  if (oldVal === nextVal) return;

  const duplicated = allCategories().some((c) => c === nextVal && c !== oldVal);
  if (duplicated) throw new Error("分类名称已存在");

  const targets = state.inventory.filter((i) => i.category === oldVal);
  for (const it of targets) {
    await api.updateFoodItem({ id: it.id, category: nextVal });
  }

  const nextCatalog = state.categoryCatalog.map((c) => (c === oldVal ? nextVal : c));
  saveCategoryCatalog(nextCatalog);
}

async function deleteCategory(name) {
  const val = normalizeCategoryName(name);
  if (!val) return;
  const targets = state.inventory.filter((i) => i.category === val);
  for (const it of targets) {
    await api.updateFoodItem({ id: it.id, category: "未分类" });
  }
  saveCategoryCatalog(state.categoryCatalog.filter((c) => c !== val));
}

async function refreshStatsTab() {
  try {
    const latest = await api.fetchFoodItems();
    if (Array.isArray(latest)) state.inventory = latest;
    if (state.tab === "stats") renderStats();
  } catch (e) {
    console.warn(e);
  }
}

function switchTab(tab) {
  state.tab = tab;
  el.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  el.homePage.classList.toggle("hidden", tab !== "home");
  el.statsPage.classList.toggle("hidden", tab !== "stats");
  el.profilePage.classList.toggle("hidden", tab !== "profile");
  renderHeader();
  if (tab === "stats") void refreshStatsTab();
}
function renderApp() { renderHeader(); if (!categories().some((c) => c.key === state.cat)) state.cat = ALL; renderHome(); renderStats(); renderProfile(); switchTab(state.tab || "home"); }

function openModal(item) {
  el.modalTitle.textContent = item ? "编辑食材" : "新增食材";
  el.foodIdInput.value = item?.id || "";
  el.foodNameInput.value = item?.name || "";
  renderCategorySelectOptions(item?.category || "");
  el.foodQuantityInput.value = item?.quantity || "";
  el.foodInDateInput.value = item?.in_date || "";
  el.foodExpireInput.value = item?.expire_date || "";
  el.foodModal.classList.remove("hidden");
}
function closeModal() { el.foodModal.classList.add("hidden"); el.foodForm.reset(); }

async function refreshRemoteData() {
  state.inventory = (await api.fetchFoodItems()) || [];
  state.categoryCatalog = loadCategoryCatalog();
  try {
    state.settings = await withTimeout(api.ensureSettings(state.user.id), 8000, "设置同步超时");
  } catch {
    state.settings = { expire_reminder: true };
  }
}
async function refreshAndRender() { await refreshRemoteData(); renderApp(); }
async function renderShellFirst() { renderApp(); try { await refreshAndRender(); } catch (e) { console.warn(e); toast("同步失败，请检查网络"); } }

async function hydrateSession() { const { data } = await supabaseClient.auth.getSession(); const s = data.session; if (!s) { applyTheme(loadTheme()); setLoggedIn(false); return; } state.user = s.user; state.token = s.access_token; applyTheme(loadTheme()); resetHomeFilters(); setLoggedIn(true); await renderShellFirst(); }
async function loginWithUsernamePassword(username, password) { const email = await usernameToLoginId(username); const r = await supabaseClient.auth.signInWithPassword({ email, password }); if (r.error) throw r.error; state.user = r.data.user; state.token = r.data.session.access_token; applyTheme(loadTheme()); resetHomeFilters(); setLoggedIn(true); await renderShellFirst(); }
function mapAuthError(err) { const m = String(err?.message || "").toLowerCase(); if (m.includes("invalid")) return "用户名或密码错误"; if (m.includes("rate")) return "请求过于频繁，请稍后再试"; return err?.message || "登录失败"; }

function bindEvents() {
  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = el.usernameInput.value.trim();
    const p = el.passwordInput.value.trim();
    if (u.includes("@")) { alert("仅支持用户名登录，请勿输入 @"); return; }
    if (u.length < 2) { alert("用户名至少 2 位"); return; }
    try {
      await withLoading("登录中...", async () => loginWithUsernamePassword(u, p));
    } catch (err) {
      alert(`登录失败: ${mapAuthError(err)}`);
    }
  });

  el.tabs.forEach((t) => t.addEventListener("click", () => {
    if (t.dataset.tab === "home") resetHomeFilters();
    switchTab(t.dataset.tab);
  }));

  el.profilePage.addEventListener("click", async (e) => {
    const hit = e.target.closest("[data-action], #toggleReminderBtn, #clearExpiredBtn, #logoutBtn");
    if (!hit) return;

    const action = hit.dataset.action
      || (hit.id === "toggleReminderBtn" ? "toggle-reminder"
        : hit.id === "clearExpiredBtn" ? "clear-expired"
          : hit.id === "logoutBtn" ? "logout" : "");

    if (!action) return;

    if (action === "toggle-profile-category") {
      state.profileCategoryExpanded = !state.profileCategoryExpanded;
      renderProfile();
      return;
    }

    if (action === "toggle-reminder") {
      const next = !state.settings?.expire_reminder;
      await withLoading("保存设置中...", async () => {
        try {
          if (!state.user?.id) throw new Error("未登录");
          state.settings = await withTimeout(api.updateSettings(state.user.id, next), 8000, "保存设置超时");
        } catch (err) {
          state.settings = { ...(state.settings || {}), expire_reminder: next };
          console.warn("updateSettings failed, fallback to local state", err);
        }
      });
      renderProfile();
      toast(next ? "已开启过期提醒" : "已关闭过期提醒");
      return;
    }

    if (action === "clear-expired") {
      const expiredIds = state.inventory.filter((i) => daysLeft(i.expire_date) < 0).map((i) => i.id);
      if (!expiredIds.length) { toast("没有已过期食材"); return; }
      try {
        await withLoading("清理过期食材...", async () => {
          for (const id of expiredIds) await api.deleteFoodItem(id);
          await refreshAndRender();
        });
        toast("已清空过期食材");
      } catch (err) {
        alert(err?.message || "清空失败");
      }
      return;
    }

    if (action === "add-category") {
      const input = document.getElementById("newCategoryInput");
      const name = normalizeCategoryName(input?.value || "");
      if (!name) { toast("请输入分类名称"); return; }
      if (allCategories().includes(name)) { toast("分类已存在"); return; }
      saveCategoryCatalog([...state.categoryCatalog, name]);
      if (input) input.value = "";
      renderProfile();
      renderHome();
      toast("已新增分类");
      return;
    }

    if (action === "edit-category") {
      const raw = decodeURIComponent(hit.dataset.category || "");
      const nextName = prompt("请输入新的分类名称", raw);
      if (nextName === null) return;
      try {
        await withLoading("更新分类中...", async () => {
          await renameCategory(raw, nextName);
          await refreshAndRender();
        });
        toast("分类已修改");
      } catch (err) {
        alert(err?.message || "分类修改失败");
      }
      return;
    }

    if (action === "delete-category") {
      const raw = decodeURIComponent(hit.dataset.category || "");
      const ok = confirm(`确定删除分类「${raw}」吗？\n该分类下食材将转为“未分类”。`);
      if (!ok) return;
      try {
        await withLoading("删除分类中...", async () => {
          await deleteCategory(raw);
          await refreshAndRender();
        });
        toast("分类已删除");
      } catch (err) {
        alert(err?.message || "分类删除失败");
      }
      return;
    }

    if (action === "logout") {
      await withLoading("退出登录中...", async () => {
        try {
          await withTimeout(supabaseClient.auth.signOut(), 6000, "退出登录超时");
        } catch (err) {
          console.warn("signOut failed, force local logout", err);
        }
      });
      state.user = null;
      state.token = "";
      state.inventory = [];
      applyTheme(THEME_BLUE);
      setLoggedIn(false);
      toast("已退出登录");
    }
  });

  el.profilePage.addEventListener("change", (e) => {
    const target = e.target;
    if (!target || target.dataset?.action !== "theme-change") return;
    saveTheme(target.value);
    renderApp();
    toast("主题已切换");
  });

  el.statsPage.addEventListener("click", (e) => {
    const hit = e.target.closest("[data-action]");
    if (!hit) return;
    const action = hit.dataset.action;

    if (action === "toggle-stats-category") {
      state.statsCategoryExpanded = !state.statsCategoryExpanded;
      renderStats();
      return;
    }

    if (action === "stats-filter-total") {
      state.cat = ALL;
      state.homeStatus = null;
      renderHome();
      switchTab("home");
      toast("已显示全部食材");
      return;
    }

    if (action === "stats-filter-category") {
      const cat = decodeURIComponent(hit.dataset.category || "");
      if (!cat) return;
      state.cat = cat;
      state.homeStatus = null;
      renderHome();
      switchTab("home");
      toast(`已筛选分类：${cat}`);
      return;
    }

    if (action === "stats-filter-status") {
      const s = hit.dataset.status;
      if (!["fresh", "soon", "expired"].includes(s)) return;
      state.cat = ALL;
      state.homeStatus = s;
      renderHome();
      switchTab("home");
      const text = s === "fresh" ? "新鲜" : s === "soon" ? "即将过期" : "已过期";
      toast(`已筛选状态：${text}`);
    }
  });

  el.foodForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = { id: el.foodIdInput.value, name: el.foodNameInput.value.trim(), category: el.foodCategoryInput.value.trim(), quantity: el.foodQuantityInput.value.trim(), in_date: el.foodInDateInput.value, expire_date: el.foodExpireInput.value };
    if (parseDate(payload.expire_date) < parseDate(payload.in_date)) { alert("保质期不能早于入库日期"); return; }
    try {
      await withLoading("保存食材中...", async () => {
        if (payload.id) { await api.updateFoodItem(payload); toast("已更新"); }
        else { await api.createFoodItem(payload); toast("已新增"); }
      });
      closeModal();
      await refreshAndRender();
    } catch (err) {
      alert(err.message);
    }
  });

  el.cancelFoodBtn.addEventListener("click", closeModal);
  el.foodModal.addEventListener("click", (e) => { if (e.target === el.foodModal) closeModal(); });

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    if (!session) { setLoggedIn(false); return; }
    state.user = session.user;
    state.token = session.access_token;
    applyTheme(loadTheme());
    resetHomeFilters();
    setLoggedIn(true);
    await renderShellFirst();
  });
}

function registerServiceWorker() { if (!("serviceWorker" in navigator)) return; window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); }); }

async function bootstrap() { bindEvents(); registerServiceWorker(); applyTheme(loadTheme()); el.usernameInput.value = INITIAL_USERNAME; el.passwordInput.value = INITIAL_PASSWORD; await hydrateSession(); }
bootstrap();

