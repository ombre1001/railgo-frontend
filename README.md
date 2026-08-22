# RailGo 前端

基于 Vue 3、TypeScript、Vite、Element Plus、Pinia、Axios 与 ECharts 的火车票售票系统前端，包含乘客端和管理端。

## 运行环境

- Node.js 20+
- npm 10+
- RailGo 后端默认运行在 `http://127.0.0.1:8080`

## 本地启动

```bash
npm install
cp .env.example .env.development
npm run dev
```

浏览器打开 `http://localhost:4000`。Vite 会把 `/api` 请求代理到 `http://127.0.0.1:8080`，并自动移除 `/api` 前缀。开发代理不会把浏览器的 `Origin` 转发给后端，因此后端即使仍只配置 `http://localhost:5173`，也不会在登录控制器执行前错误返回 CORS 403。

如需修改端口或后端地址，在 `.env.development` 中设置：

```env
VITE_DEV_PORT=4000
VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8080
```

本项目没有 Mock 模式、预置账号或前端演示数据。启动前必须运行 RailGo 后端；页面中的表格、图表、状态、票价、余票和统计均来自真实接口。

## 生产构建

```bash
npm run type-check
npm run build
npm run preview
```

## 后端适配

- 请求封装：`src/api/http.ts`
- 接口清单：`src/api/index.ts`
- 登录令牌：`railgo_access_token` 与 `railgo_refresh_token`
- 后端统一响应：`{ code, data, message, requestId, timestamp }`
- 普通登录与管理员登录都调用 `/auth/login`，身份只读取后端返回的 `roles`（并兼容单值 `role`）
- 登录、注册和刷新令牌请求不会携带浏览器中残留的旧访问令牌
- 管理员入口仅允许 `ADMIN`、`SYSTEM_ADMIN` 或 `BUSINESS_ADMIN`；普通入口始终进入乘客端
- 登录和恢复会话时都会调用 `/users/me`，因此数据库角色调整后刷新页面即可生效，本地缓存不作为最终权限依据

主要接口已覆盖认证、个人资料、乘车人、车站、直达/换乘查询、订单、支付、管理端车站/车次/运行计划/库存/订单/资金流水/报表/用户权限/审计日志。

后端当前没有实现的功能不会出现在界面中，例如帮助中心、车站同步任务和订单列表导出。报表 CSV 使用 `/admin/reports/export` 生成，点击导出后文件会保存在浏览器默认下载目录。
