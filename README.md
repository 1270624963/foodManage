# 食材管理库 App

基于你提供的三张页面样式实现，当前为前后端联调版本。

## 1. 当前架构

- 前端：`index.html` + `styles.css` + `app.js`
- 认证：Supabase Auth
- 后端：Supabase Postgres + Edge Functions
- 数据权限：RLS（按 `auth.uid()` 隔离）

## 2. 主要功能

- 用户名 + 密码登录（前端将用户名稳定映射为内部邮箱后调用 Supabase Auth）
- 首页食材管理：新增、编辑、删除、分类筛选
- 统计页：总数、临期、过期、平均剩余天数、分类/状态统计
- 我的页：提醒开关、清空过期、退出登录

## 3. 默认测试账号

- 用户名：`admin`
- 密码：`123456`

应用启动时会自动确保该账号存在；登录页会默认填入这组账号密码。

## 4. 本地运行

```powershell
cd E:\workspace\food
python -m http.server 8080
```

打开：`http://localhost:8080/index.html`

可安装方式（App 形态）：

- 在 Chrome/Edge 打开页面后，点击地址栏右侧“安装应用”。
- 安装后会以独立窗口（standalone）运行。

## 5. Supabase 配置

前端配置在 `app.js` 顶部：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

`SUPABASE_ANON_KEY` 必须使用项目 API 中的 `anon/publishable` key。

## 6. 后端文件

- `supabase/config.toml`
- `supabase/migrations/202602270001_init.sql`
- `supabase/functions/food-items/index.ts`
- `supabase/functions/dashboard-stats/index.ts`
- `scripts/deploy_supabase.ps1`

## 7. 部署到 Supabase 项目

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy_supabase.ps1 -AccessToken "<your_pat>" -DbPassword "<your_db_password>"
```

目标项目：`kwohoumkqxlsqmvlpvur`

## 8. 本地后端联调测试

已提供联调脚本：

- `scripts/local_backend_test.mjs`

执行：

```powershell
cd E:\workspace\food
node scripts/local_backend_test.mjs
```

脚本会使用 `admin / 123456` 登录并调用：

- `functions/v1/food-items`
- `functions/v1/dashboard-stats?range=7`

## 9. 目录说明

运行必需：

- `index.html`
- `styles.css`
- `config.js`
- `api.js`
- `app.js`

后端维护必需：

- `supabase/`
- `scripts/deploy_supabase.ps1`

辅助文件：

- `.env.supabase.example`
- `.gitignore`
