# RailGo 智慧铁路售票系统分析与验收讲解

> 本文档基于 RailGo 前端与后端实际代码整理，可用于课程设计说明、系统验收讲解和答辩准备。

## 1. 系统概述

RailGo 是一个前后端分离的铁路售票系统，面向旅客和运营管理员两类用户。

- 旅客端提供注册登录、车票查询、一次换乘、乘车人管理、区间锁座、订单支付、订单查询、退票和改签。
- 管理端提供车站、车次、经停站、车厢座位、票价、运行计划、区间库存、订单、资金流水、运营报表、用户权限和审计日志管理。

系统的核心不是简单记录“一趟车还剩多少张票”，而是建立以下数据层次：

```text
车次 → 运行日期 → 车厢 → 座位 → 运行区间 → 库存状态
```

这种设计能够支持区间售票与座位复用。例如同一个座位可以先出售“北京—济南”，再出售“济南—上海”，因为两个订单占用的运行区间并不重叠。

## 2. 总体技术架构

系统整体请求链路如下：

```text
Vue 页面
  ↓
Axios API 请求
  ↓
Spring Security / JWT 身份认证
  ↓
Controller 接收请求并校验参数
  ↓
Service 执行业务规则、事务和状态流转
  ↓
MyBatis-Plus / MyBatis XML
  ↓
MySQL 保存长期核心业务数据
  ↘
   Redis 保存验证码、限流计数等短期数据
```

后端采用分层架构：

| 层次 | 主要职责 |
|---|---|
| Controller | 接收 HTTP 请求、绑定参数、提取当前用户并返回结果 |
| DTO | 定义前端传入的数据结构和校验规则 |
| Service | 实现业务规则、状态流转、事务和并发控制 |
| Mapper | 执行数据库 CRUD 和复杂 SQL |
| PO | 对应数据库持久化实体 |
| VO | 定义返回给前端的数据结构 |
| Config / Security | 权限、跨域、异常、审计和接口文档等公共能力 |

## 3. 前端技术架构

### 3.1 Vue 3

Vue 3 是前端核心视图框架，项目使用 Composition API 管理页面状态。

主要作用：

- 使用 `ref` 保存列表、加载状态、当前页和对话框状态。
- 使用 `reactive` 保存查询条件和编辑表单。
- 使用 `computed` 计算筛选结果、最低价格、权限和按钮状态。
- 使用 `onMounted` 在页面加载时调用后端接口。
- 将查询面板、车次卡片、用户中心和页面布局拆分为组件。

验收讲解：

> 前端采用 Vue 3 Composition API，将车票查询、订单、支付和管理后台拆分为独立页面和组件，通过响应式机制同步接口数据与页面状态。

### 3.2 TypeScript

TypeScript 为 JavaScript 增加静态类型。项目定义了 `Station`、`TrainRun`、`TransferPlan`、`OrderSummary`、`OrderDetail`、`UserProfile` 和 `PageData<T>` 等类型。

主要作用：

- 约束接口请求参数和响应结构。
- 在开发阶段发现字段名、数据类型和空值错误。
- 提供代码自动补全和重构支持。
- 降低前后端字段不一致造成的运行错误。

### 3.3 Vite

Vite 是前端开发服务器和生产打包工具。

主要作用：

- 启动本地开发服务和热更新。
- 代理 `/api` 请求到后端服务。
- 编译 Vue、TypeScript 和 CSS。
- 将项目打包成可部署的静态资源。
- 配合动态路由导入实现页面分包。

项目路由使用动态导入：

```ts
component: () => import('@/views/TicketListView.vue')
```

只有访问相关页面时才加载对应代码，可以降低首次加载量。

### 3.4 Element Plus

Element Plus 提供表格、表单、分页、对话框、按钮、日期选择器和消息提示等 UI 组件。

在本系统中主要用于：

- 登录和注册表单。
- 乘车人编辑对话框。
- 后台数据表格和分页。
- 运行计划日期选择。
- 订单状态标签。
- 成功和错误消息提示。

### 3.5 Vue Router

Vue Router 负责页面导航和前端路由权限。

路由分为：

- 公共页面：首页、系统详情、车票查询、登录和注册。
- 登录页面：购票、支付、订单、乘车人、个人资料和改签。
- 管理页面：运营看板及所有 `/admin` 页面。

前端通过 `meta.requiresAuth` 和 `meta.requiresAdmin` 进行访问拦截。前端拦截主要改善用户体验，真正的安全控制仍由后端 Spring Security 完成。

### 3.6 Pinia

Pinia 保存全局登录状态，包括：

- Access Token。
- Refresh Token。
- 当前用户信息。
- 是否已经登录。
- 是否具有管理员角色。
- 是否已经校验服务端会话。

登录成功后，前端会再次调用 `/users/me` 读取用户及角色，避免数据库中的角色发生变化后，前端仍长期依赖旧缓存。

### 3.7 Axios

Axios 负责统一发送 HTTP 请求。项目统一处理了：

- API 基础地址。
- 15 秒默认超时。
- JSON 请求头。
- 自动携带 JWT。
- 为每次请求生成 `X-Request-Id`。
- 清理空查询参数。
- 解析统一响应体。
- 401 时清理本地登录状态。
- CSV 等文件下载。

后端统一响应结构为：

```json
{
  "code": 0,
  "data": {},
  "message": "success",
  "requestId": "...",
  "timestamp": "..."
}
```

### 3.8 ECharts

ECharts 用于管理端的数据可视化，包括销售趋势、热门路线、上座率和用户统计。图表数据由后端根据支付、退款、改签和库存数据实时聚合，不是前端静态演示数据。

## 4. 后端技术架构

### 4.1 Spring Boot

Spring Boot 是后端整体运行框架，项目使用 Java 21。

主要作用：

- 启动内嵌 Web 服务。
- 自动配置数据库、Redis、邮件和 Spring Security。
- 扫描并管理 Controller、Service 和 Mapper。
- 提供依赖注入。
- 管理数据库事务和定时任务。
- 从配置文件和环境变量读取运行参数。

### 4.2 Spring MVC

Spring MVC 将 HTTP 地址映射到 Controller 方法，例如：

```java
@PostMapping("/orders")
@GetMapping("/tickets/direct")
@PostMapping("/tickets/{ticketId}/return")
```

主要负责 JSON 转换、参数绑定、参数校验和响应序列化。

### 4.3 Spring Security

Spring Security 负责认证和权限控制。

主要规则：

- 登录、注册、刷新令牌接口公开。
- 车站和车票查询接口公开。
- 订单、支付、退改签等接口必须登录。
- `/admin/**` 仅业务管理员和系统管理员访问。
- 具体后台方法使用 `@PreAuthorize` 检查角色和权限码。
- 服务端采用无状态会话，不创建传统 Session。

权限判断示例：

```java
@PreAuthorize(
    "hasRole('SYSTEM_ADMIN') or hasAuthority('BUSINESS:TRAIN:WRITE')"
)
```

这形成两级权限控制：角色决定是否能够进入管理端，权限码决定是否能够操作具体模块。

### 4.4 JWT 双令牌

登录成功后生成：

- Access Token：短期访问令牌，默认有效期两小时。
- Refresh Token：长期刷新令牌，默认有效期三十天。

Access Token 放在请求头中：

```http
Authorization: Bearer <token>
```

后端 JWT 过滤器会：

1. 提取 Bearer Token。
2. 校验签名、令牌类型和有效期。
3. 解析用户 ID。
4. 从数据库重新读取用户、角色和权限。
5. 将身份信息放入 Spring Security 上下文。

Refresh Token 还会在 `auth_refresh_token` 表保存 JTI、用户 ID、有效期和撤销时间。刷新时撤销旧令牌并签发新令牌，形成刷新令牌轮换。

### 4.5 MyBatis-Plus 与 MyBatis XML

MyBatis-Plus 负责普通 CRUD，例如用户、车站和车次的增删改查；MyBatis XML 负责直达车票、换乘方案、区间库存、订单分页、报表聚合和行级锁等复杂 SQL。

这种组合既减少普通 CRUD 的重复代码，又能精确控制铁路业务所需的 JOIN、GROUP BY、`FOR UPDATE` 和聚合计算。

### 4.6 MySQL

MySQL 保存所有长期核心数据，并承担：

- 用户、权限和业务数据持久化。
- 事务一致性。
- 行级锁和并发控制。
- 唯一约束防止重复请求。
- 运营报表聚合。
- 车次同步任务的数据库命名锁。

### 4.7 Redis

Redis 当前主要用于验证码时效、单次消费和发送限流，不参与车票库存计算。

邮箱验证码流程：

1. 生成六位随机验证码。
2. 使用 HMAC-SHA256 计算验证码摘要。
3. 将摘要写入 Redis 并设置有效期。
4. 设置邮箱发送冷却时间。
5. 统计邮箱每日发送次数。
6. 统计 IP 每小时发送次数。
7. 使用 Lua 脚本原子完成“验证并删除”。
8. 连续错误达到上限后删除验证码。

正确的验收表述是：

> Redis 用于验证码时效、单次消费和限流；核心余票和库存由 MySQL 事务保证一致性。

### 4.8 HikariCP 数据库连接池

HikariCP 维护一组可复用的数据库连接，避免每次请求重新建立数据库连接。

当前配置包括：

- 最小空闲连接数：2。
- 最大连接数：10。
- 连接超时：30 秒。
- 空闲超时：5 分钟。
- 最大生命周期：10 分钟。
- 保活时间：60 秒。

### 4.9 Spring Transaction

`@Transactional` 保证一组数据库操作要么全部提交，要么全部回滚。

例如支付确认需要同时完成：

1. 库存 `LOCKED → SOLD`。
2. 车票 `LOCKED → ISSUED`。
3. 订单 `PENDING_PAYMENT → PAID`。
4. 支付流水 `PROCESSING → SUCCESS`。

任何一步失败，事务都会回滚，防止出现“支付成功但没有出票”或“已经出票但库存仍可售”。

### 4.10 Spring Scheduler

系统包含三个定时任务：

- 订单超时扫描。
- 改签超时扫描。
- 12306 车次数据同步。

订单和改签默认每分钟扫描一次，将过期业务关闭并释放临时锁定的库存。

### 4.11 Swagger / OpenAPI

Swagger 根据 Controller、DTO 和注解生成接口文档。默认地址：

```text
http://localhost:8080/swagger-ui.html
```

可用于证明接口定义清晰，并支持前后端独立调试。

### 4.12 SMTP、阿里云短信、HttpClient 与 Jsoup

- Spring Mail 通过 SMTP 发送注册验证码。
- 阿里云短信 SDK 为短信验证码保留扩展能力，当前默认关闭。
- HttpClient 负责访问 12306、管理 Cookie 和响应。
- Jsoup 辅助解析网页或脚本数据。

## 5. 旅客端功能与后端实现

### 5.1 注册

注册流程：

1. 前端请求发送邮箱验证码。
2. 后端规范化邮箱并检查是否已注册。
3. Redis 控制发送冷却、邮箱每日次数和 IP 每小时次数。
4. 用户提交验证码、昵称和密码。
5. 后端原子验证并消费验证码。
6. 使用 BCrypt 对密码进行哈希。
7. 插入 `user` 表。
8. 在 `user_role` 中分配 `PASSENGER` 角色。
9. 签发 Access Token 和 Refresh Token。

数据库不保存明文密码，BCrypt 强度参数为 12。

### 5.2 登录

支持邮箱或手机号登录。

后端登录步骤：

1. 检查失败次数和锁定状态。
2. 根据账号查询用户。
3. 使用 BCrypt 验证密码。
4. 检查账号是否启用。
5. 更新最后登录时间。
6. 查询角色和权限。
7. 签发双令牌。

连续失败五次后会锁定十五分钟。当前登录失败次数保存在后端进程内存中，适合单机演示；多实例部署时应迁移到 Redis。

### 5.3 个人资料与密码

用户可以查看资料、修改昵称和修改密码。手机号和邮箱暂时不允许直接修改，防止绕过二次验证。

修改密码后会撤销该用户全部 Refresh Token，使旧会话失效。

### 5.4 常用乘车人

支持查询、新增、修改和删除乘车人。每个用户最多保存 20 个乘车人，支持成人、儿童和学生，以及身份证、护照等证件类型。

证件号采用两种形式保存：

- `id_no_cipher`：AES-256-GCM 可逆加密，用于必要时读取。
- `id_no_hash`：HMAC-SHA256 摘要，用于判断重复证件。

前端显示前还会对证件号码进行脱敏。

### 5.5 车站搜索

车站支持按车站代码、中文名称、规范化名称、拼音、拼音首字母、城市、省份、区县和地址搜索。

热门车站可以结合订单中的出发站、到达站和最近购票时间计算，不是固定写死的列表。

### 5.6 直达车票查询

查询条件包括出发地、到达地、乘车日期、车次类型、出发时间段和排序方式。

SQL 主要连接：

```text
train_run
→ train
→ train_stop（出发站）
→ train_stop（到达站）
→ station
```

关键条件：

- 到达站站序必须大于出发站站序。
- 运行日期符合查询日期。
- 运行计划处于 `ON_SALE`。
- 库存已经初始化。
- 车次处于 `ACTIVE`。

跨日到发时间通过运行日期、日偏移和具体时间组合计算。

### 5.7 一次换乘查询

换乘查询需要找到：

```text
第一程：出发站 → 换乘站
第二程：换乘站 → 到达站
```

后端会筛选：

- 两程不是同一车次。
- 两程都已开售并完成库存初始化。
- 第二程出发时间晚于第一程到达时间。
- 换乘等待时间符合要求。
- 换乘站不是起点或终点。
- 两程都存在可售席别。

SQL 先生成候选方案，Service 再批量查询两程余票和票价，减少逐方案查询造成的 N+1 问题。

### 5.8 区间余票模型

假设列车经过：

```text
A → B → C → D
```

一个座位会生成三条库存记录：

| 座位 | 区间 | 状态 |
|---|---|---|
| 01A | A→B | AVAILABLE |
| 01A | B→C | AVAILABLE |
| 01A | C→D | AVAILABLE |

如果旅客购买 A→C，则锁定 A→B 和 B→C，C→D 仍然可售。

余票查询只有在目标区间内的所有库存段都为 `AVAILABLE` 时，才把该座位计算为一张可售车票。

### 5.9 创建订单和锁座

下单前检查：

- 乘车人属于当前用户。
- 同一订单不能重复选择乘车人。
- 运行计划存在并已开售。
- 库存已经初始化。
- 列车尚未发车。
- 票价存在。
- 乘车人没有时间重叠的有效订单。
- 换乘等待时间合法。
- `clientRequestId` 没有重复使用。

锁座流程：

1. 创建 `ticket_order`，状态为 `PENDING_PAYMENT`。
2. 创建 `order_item`，状态为 `LOCKED`。
3. 查询满足席别和座位偏好的候选座位。
4. 对候选座位所经过的库存行执行 `SELECT ... FOR UPDATE`。
5. 再次检查所有区间是否为 `AVAILABLE`。
6. 将库存更新为 `LOCKED`。
7. 关联 `order_item_id`。
8. 保存具体车厢和座位。
9. 设置十五分钟过期时间。

### 5.10 防止并发超售

当两个用户同时购买同一座位和同一区间时：

1. 两个请求可能同时在候选查询中看到该座位。
2. 第一个事务执行 `SELECT ... FOR UPDATE`，锁定库存行。
3. 第二个事务等待第一个事务提交。
4. 第一个事务将库存更新为 `LOCKED`。
5. 第二个事务获得锁后重新检查，发现库存不再是 `AVAILABLE`。
6. 第二个请求跳过该座位或返回余票不足。

更新 SQL 还要求原状态必须为 `AVAILABLE`，并校验实际更新行数是否等于目标区间数，形成第二层保护。

### 5.11 支付

支付分为创建支付流水和确认支付两步。

创建支付流水：

1. 锁定订单行。
2. 检查订单状态和有效期。
3. 检查重复 `clientRequestId`。
4. 创建 `PROCESSING` 支付流水。

确认支付：

1. 按固定顺序锁定订单和支付流水，降低死锁风险。
2. 检查支付流水仍为 `PROCESSING`。
3. 检查订单仍为 `PENDING_PAYMENT`。
4. 检查锁定车票和库存数量完整。
5. 库存改为 `SOLD`。
6. 车票改为 `ISSUED`。
7. 订单改为 `PAID`。
8. 支付流水改为 `SUCCESS`。

重复确认成功支付时，后端直接返回原成功结果，不会重复扣款或重复出票。

### 5.12 订单查询、取消与超时

旅客可按订单状态、下单日期、乘车日期、订单号、车次、车站和乘车人查询订单。

未支付订单可以主动取消，也会在超时后自动关闭：

```text
PENDING_PAYMENT → CANCELLED
PENDING_PAYMENT → EXPIRED
```

关闭时释放 `LOCKED` 区间，并将对应车票改为 `CANCELLED`。

状态更新使用“原状态匹配后再更新”的方式，避免支付和取消并发时相互覆盖。

### 5.13 退票

退票前检查：

- 车票属于当前用户。
- 订单已支付。
- 车票状态为 `ISSUED`。
- 列车尚未发车。
- 不存在进行中的改签。
- 不存在重复退票请求。

演示手续费规则：

- 发车前 8 天及以上：0%。
- 48 小时及以上：5%。
- 24 小时及以上：10%。
- 不足 24 小时：20%。

退票事务内完成：

1. 创建 `ticket_return`。
2. 已售区间 `SOLD → AVAILABLE`。
3. 车票 `ISSUED → REFUNDED`。
4. 创建 `refund_record`。
5. 退票记录改为 `COMPLETED`。
6. 根据剩余有效车票数，把订单改为 `PARTIALLY_REFUNDED` 或 `REFUNDED`。

### 5.14 改签

改签采用“先锁新票，再释放旧票”的策略。

预览阶段：

1. 锁定并读取旧票。
2. 检查旧票是否允许改签。
3. 查询新车次并验证区间。
4. 检查乘车时间冲突。
5. 锁定新车次座位。
6. 创建状态为 `CHANGE_LOCKED` 的新车票。
7. 计算新旧票差价。
8. 创建 `change_record`。
9. 设置十五分钟有效期。

差价类型：

- `PAY_DIFFERENCE`：新票更贵，需要补款。
- `REFUND_DIFFERENCE`：新票更便宜，需要退款。
- `NO_DIFFERENCE`：同价。

确认阶段在一个事务内完成：

- 旧票库存 `SOLD → AVAILABLE`。
- 新票库存 `LOCKED → SOLD`。
- 旧票 `ISSUED → CHANGED`。
- 新票 `CHANGE_LOCKED → ISSUED`。
- 改签记录改为 `COMPLETED`。
- 更新订单总金额。
- 创建补款或退款资金记录。

如果改签超时，只释放新票，原车票保持不变。

## 6. 管理端功能

### 6.1 运营看板

展示总订单数、已支付订单数、出票数、销售额、退款金额、净收入、销售趋势和热门路线。

净收入计算逻辑：

```text
支付收入 + 改签补款 - 退票退款 - 改签退款
```

### 6.2 车站管理

支持分页、关键词搜索、新增、修改、启停，以及客运属性、经纬度、铁路局和热度维护。

### 6.3 车次、经停站、座席与票价

管理员可以维护车次编号、车次类型、始发终到站、经停站顺序、到发时间、跨日偏移、车厢、席别、座位和区间票价。

座位可根据车厢号、行数和座位字母批量生成。

### 6.4 运行计划

`train` 表表示抽象车次，例如 G1；`train_run` 表表示某一天实际运行的 G1。

```text
G1 + 2026-09-01
G1 + 2026-09-02
```

相同车次在不同日期拥有独立库存。

运行计划状态流转：

```text
DRAFT / NOT_ON_SALE → ON_SALE → OFF_SALE → ON_SALE
有效状态 → CANCELLED
```

开售前必须完成库存初始化。

### 6.5 库存初始化

库存理论行数：

```text
座位数 ×（经停站数 - 1）
```

例如 100 个座位、5 个经停站，应生成 `100 × 4 = 400` 条区间库存。初始化结束后，后端会核对实际数量，不一致则回滚事务。

### 6.6 订单与资金管理

管理员可以查看用户、车票、车次、座位、订单状态、支付、退款、改签和实际占用区间。

资金页面分为支付流水、退款流水和改签记录，并支持按流水号、订单号、车次和状态筛选。

### 6.7 运营报表

报表包括：

- 销售趋势。
- 热门路线。
- 上座率。
- 用户统计。
- CSV 导出。

上座率按区间库存计算：

```text
已售区间数量 ÷ 总区间数量 × 100%
```

### 6.8 用户与权限

系统采用 RBAC 模型：

```text
user
  ↕ user_role
role
  ↕ role_permission
permission
```

支持创建管理员、启停用户、分配角色、重置密码、查询权限和更新角色权限，同时保护最后一个系统管理员。

### 6.9 审计日志

管理端写操作会记录：

- 请求 ID。
- 操作用户。
- 模块和操作方法。
- HTTP 方法和 URI。
- 请求参数。
- 客户端 IP。
- 响应状态。
- 成功或失败结果。
- 错误信息。
- 执行耗时。

密码和 Token 等敏感参数会被替换为星号。审计日志写入失败不会覆盖原业务响应。

## 7. 12306 数据来源

系统可以从 12306 公共查询接口同步车站、车次、始发终到站、车次类型、经停站、到发时间和跨日信息。

同步流程：

1. 按配置的热门区间查询车次。
2. 过滤 G、D、C 等目标车次类型。
3. 对同一车次去重。
4. 控制每日同步数量。
5. 获取车次经停站。
6. 修复或创建车站数据。
7. 合并 `train` 和 `train_stop`。
8. 创建对应日期的 `train_run`。
9. 写入 `train_sync_log`。

同步使用 MySQL 命名锁：

```sql
GET_LOCK('railgo_train_sync', 0)
```

保证同一时间只有一个同步任务运行。

系统还会对时刻表计算 SHA-256 摘要。如果时刻表发生变化，而相关运行计划已经初始化库存，则拒绝自动覆盖，防止旧库存区间与新时刻表错位。

## 8. 数据库关系与业务作用

| 数据表 | 作用 |
|---|---|
| `user` | 用户账号 |
| `passenger` | 用户的常用乘车人 |
| `role` | 系统角色 |
| `permission` | 细粒度权限 |
| `user_role` | 用户与角色的多对多关系 |
| `role_permission` | 角色与权限的多对多关系 |
| `auth_refresh_token` | Refresh Token 生命周期 |
| `station` | 车站主数据 |
| `train` | 车次模板 |
| `train_stop` | 车次经停站和顺序 |
| `train_coach` | 车厢 |
| `train_seat` | 具体座位 |
| `seat_type` | 席别字典 |
| `train_fare` | 车次区间票价 |
| `train_run` | 某日期的运行实例 |
| `seat_segment_inventory` | 某运行实例下每个座位的区间库存 |
| `ticket_order` | 订单主表 |
| `order_item` | 每位乘车人、每一程的具体车票 |
| `payment_record` | 支付流水 |
| `ticket_return` | 退票业务记录 |
| `refund_record` | 退款流水 |
| `change_record` | 改签记录 |
| `change_fund_record` | 改签补款或退款流水 |
| `train_sync_log` | 数据同步日志 |
| `operation_log` | 管理操作审计日志 |

主要关系：

```text
user 1 ── N passenger
user 1 ── N ticket_order
ticket_order 1 ── N order_item
ticket_order 1 ── N payment_record

train 1 ── N train_stop
train 1 ── N train_coach
train_coach 1 ── N train_seat
train 1 ── N train_fare
train 1 ── N train_run

train_run 1 ── N seat_segment_inventory
order_item 1 ── N seat_segment_inventory

order_item 1 ── N ticket_return
ticket_return 1 ── N refund_record

change_record → old_order_item
change_record → new_order_item
```

## 9. 业务状态机

### 9.1 订单状态

```text
PENDING_PAYMENT
  ├─支付成功→ PAID
  ├─用户取消→ CANCELLED
  └─超时→ EXPIRED

PAID
  ├─部分退票→ PARTIALLY_REFUNDED
  └─全部退票→ REFUNDED
```

### 9.2 车票状态

```text
LOCKED → ISSUED → REFUNDED
   └────→ CANCELLED

ISSUED → CHANGED
CHANGE_LOCKED → ISSUED / CANCELLED
```

### 9.3 库存状态

```text
AVAILABLE → LOCKED → SOLD
     ↑          │       │
     └──────────┘       │
     └──────────────────┘
```

### 9.4 支付状态

```text
PROCESSING → SUCCESS
PROCESSING → FAILED
PROCESSING → CLOSED
```

### 9.5 改签状态

```text
WAITING_CONFIRMATION → COMPLETED
WAITING_PAYMENT → COMPLETED

WAITING_CONFIRMATION / WAITING_PAYMENT
  ├─主动取消→ CANCELLED
  └─超时→ EXPIRED
```

## 10. 性能、并发与可靠性设计

系统已经实现或考虑的措施：

1. 使用 HikariCP 复用数据库连接。
2. 使用前端动态路由实现页面懒加载。
3. 管理列表和订单列表采用分页。
4. 换乘余票采用批量查询，降低 N+1 查询。
5. 区间余票在 SQL 中分组聚合。
6. 候选座位限制为 50 个，避免无边界扫描。
7. 同步任务限制每日车次数量。
8. 同步经停站使用任务内缓存，避免重复抓取。
9. 订单、支付、退票和改签使用事务。
10. 座位区间使用数据库行级锁。
11. 状态更新检查原状态，避免并发覆盖。
12. 使用 `clientRequestId` 实现下单、支付、退票和改签幂等。
13. 支付采用固定加锁顺序，降低死锁概率。
14. 超时订单和改签自动释放库存。
15. 车次同步使用 MySQL 命名锁，避免重复执行。

## 11. 验收演示建议

建议按一条完整业务链演示：

1. 打开系统详情页，介绍架构和技术栈。
2. 注册或登录旅客账号。
3. 新增常用乘车人，讲解证件号加密和脱敏。
4. 查询直达车票，展示真实车站、席别和区间余票。
5. 切换一次换乘查询。
6. 选择车次和席别并创建订单。
7. 展示具体车厢、座位和十五分钟倒计时。
8. 完成模拟支付。
9. 查看电子客票和订单详情。
10. 演示改签和差价处理。
11. 演示退票、手续费和退款。
12. 登录管理端。
13. 展示车次、运行计划和区间库存。
14. 展示订单、支付、退款和改签全链路。
15. 展示销售趋势、热门路线和上座率。
16. 展示用户权限与审计日志。

验收时最值得强调的技术亮点：

- 区间库存模型支持座位复用。
- MySQL 事务和行级锁防止并发超售。
- `clientRequestId` 和状态检查保证幂等性。
- 支付、退票和改签具有完整状态闭环。
- RBAC 权限模型和审计日志提高管理端安全性。
- 车站和车次可以从 12306 数据源同步。

## 12. 当前不足与后续优化

### 12.1 缺少数据库建表和迁移脚本

后端仓库目前没有发现完整的 `schema.sql`、Flyway 或 Liquibase 迁移文件。新环境不能仅通过代码自动建立数据库。

建议补充：

- 全部 `CREATE TABLE`。
- 主键、外键和唯一约束。
- 查询索引。
- 角色、权限和席别初始化数据。
- 数据库 ER 图。

### 12.2 数据库模型映射需要统一

部分 SQL 使用了 `train_run.run_status`，但当前 `TrainRun` 实体没有对应字段，需要确认数据库表与 Java 实体是否完全同步。

### 12.3 前端没有自动刷新 Access Token

后端已经实现 `/auth/refresh`，但前端遇到 401 时会直接清除登录状态，没有自动使用 Refresh Token 刷新并重试请求。

### 12.4 登录失败限制为单机内存实现

当前 `LoginAttemptService` 使用 `ConcurrentHashMap`。后端重启后记录会丢失，多实例之间也不能共享。生产环境适合迁移至 Redis。

### 12.5 Redis 尚未承担热点缓存

当前 Redis 用于验证码和限流，尚未缓存热门车站、字典、车票查询或运营看板。验收时不应声称 Redis 缓存了余票。

### 12.6 自动化测试覆盖不足

目前主要是 Spring Boot 上下文测试，建议增加：

- 并发锁座测试。
- 重复支付测试。
- 超时释放测试。
- 退票事务测试。
- 改签回滚测试。
- Controller 接口测试。

### 12.7 前端本地类型环境问题

Vite 实际打包可以通过，但当前本地环境执行完整 `npm run build` 时存在 ECharts 类型声明解析问题。验收前应重新安装锁定依赖或修复类型解析，确保完整构建命令通过。

## 13. 总结

RailGo 已经具备完整的铁路售票业务链路，其核心价值不只是页面数量，而是以下设计：

1. 使用“运行计划 + 座位 + 区间”建立库存模型。
2. 通过数据库事务和行级锁避免并发超售。
3. 使用状态机控制订单、支付、退票和改签流程。
4. 使用幂等请求标识防止重复提交。
5. 使用 JWT、RBAC 和审计日志保护管理端。
6. 使用 Redis 实现验证码时效、单次消费和限流。
7. 支持从 12306 同步真实车站、车次和时刻数据。
8. 通过运营报表展示支付、退款、改签和库存数据价值。

在课程设计验收中，应重点围绕“完整业务闭环、区间库存设计、数据库一致性、权限安全和真实数据来源”展开讲解。

## 14. 关键代码索引

### 前端

- [路由与权限](../src/router/index.ts)
- [统一接口封装](../src/api/index.ts)
- [Axios 请求处理](../src/api/http.ts)
- [登录状态管理](../src/stores/auth.ts)
- [系统详情页](../src/views/SystemOverviewView.vue)
- [车票查询页](../src/views/TicketListView.vue)
- [购票页](../src/views/BookingView.vue)
- [支付页](../src/views/PaymentView.vue)
- [改签页](../src/views/ChangeView.vue)
- [运营看板](../src/views/admin/DashboardView.vue)
- [运营报表](../src/views/admin/ReportsView.vue)

### 后端

- [安全配置](../../railgo-backend/src/main/java/com/example/railgo/config/SecurityConfig.java)
- [JWT 认证过滤器](../../railgo-backend/src/main/java/com/example/railgo/security/JwtAuthenticationFilter.java)
- [注册登录服务](../../railgo-backend/src/main/java/com/example/railgo/service/AuthService.java)
- [车票查询服务](../../railgo-backend/src/main/java/com/example/railgo/service/TicketQueryService.java)
- [订单与锁座服务](../../railgo-backend/src/main/java/com/example/railgo/service/OrderService.java)
- [支付服务](../../railgo-backend/src/main/java/com/example/railgo/service/PaymentService.java)
- [退票服务](../../railgo-backend/src/main/java/com/example/railgo/service/TicketReturnService.java)
- [改签服务](../../railgo-backend/src/main/java/com/example/railgo/service/TicketChangeService.java)
- [区间库存 SQL](../../railgo-backend/src/main/resources/mapper/InventoryMapper.xml)
- [车票查询 SQL](../../railgo-backend/src/main/resources/mapper/TicketQueryMapper.xml)
- [运营报表 SQL](../../railgo-backend/src/main/resources/mapper/AdminOrderReportMapper.xml)
- [12306 同步服务](../../railgo-backend/src/main/java/com/example/railgo/service/TrainSyncService.java)
- [验证码与 Redis](../../railgo-backend/src/main/java/com/example/railgo/service/EmailVerificationCodeService.java)
- [乘车人证件加密](../../railgo-backend/src/main/java/com/example/railgo/utils/PassengerIdentityUtil.java)
- [后台审计日志](../../railgo-backend/src/main/java/com/example/railgo/config/AdminAuditInterceptor.java)
