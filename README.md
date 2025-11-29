# 记账网页应用架构说明

## 1. 概述
本应用提供个人收支记录、预算管理、数据可视化、数据导出与备份/恢复等功能。所有交互在浏览器中完成，数据以结构化对象存储并支持持久化与再次渲染。界面由表单区、统计卡片、图表区与最近交易列表组成。

## 2. 技术组成
- **HTML5 / CSS / Tailwind CSS**：界面与响应式布局。
- **Vanilla JavaScript**：业务逻辑、状态管理、事件绑定。
- **Font Awesome**：分类与功能图标。
- **Chart.js**：趋势、分类、比例与对比图表。

## 3. 数据模型
### 3.1 本地存储键
- `transactions_guest`：交易数组。
- `budget_guest`：月度预算数字（字符串存储，读取时转换为 Number）。

### 3.2 交易对象结构
```jsonc
{
	"id": "string",            // 唯一ID（时间戳+随机）
	"type": "expense|income",   // 类型
	"amount": 123.45,            // 金额（展示用浮点，计算使用 amountCents）
	"amountCents": 12345,        // 金额（整数分，避免浮点误差）
	"date": "YYYY-MM-DD",       // 日期（统一格式）
	"category": {                // 分类元数据（快照）
		"id": "food",
		"name": "餐饮",
		"icon": "utensils",
		"color": "#EF4444"
	},
	"note": "可选备注",
	"createdAt": "ISO 时间戳"
}
```

### 3.3 预算数据
```jsonc
{
	"amount": 2000.00 // 与界面输入同步，内部以 Number 使用
}
```

### 3.4 金额处理策略
统一通过 `parseAmountToCents()` / `centsToNumber()` 保证计算阶段不受浮点误差影响；所有统计、图表、百分比均基于 `amountCents` 聚合后再格式化展示。

## 4. 模块与职责
| 模块 | 主要函数 | 说明 |
|------|----------|------|
| 初始化 | `init()` | 绑定事件、渲染分类、加载交易与预算、初始化图表 |
| 分类渲染 | `renderCategories()` | 根据当前类型展示分类网格并管理选中态 |
| 交易保存 | `saveTransaction()` | 构建交易 payload、金额标准化、写入 localStorage、刷新列表与图表 |
| 交易加载 | `loadTransactions()` | 读取并规范化数据（补齐 `amountCents`），渲染最近 10 条 |
| 财务摘要 | `updateFinancialSummary()` | 计算本月收支、总资产、环比变化、预算使用情况 |
| 图表更新 | `updateCharts()` + 子函数 | 趋势/分类/收入分类/月度对比/比例五类图表数据组装与刷新 |
| 预算管理 | `loadBudget()` / `handleBudgetSave()` / `updateBudgetUI()` | 输入校验、剩余或超支提示、自动高亮 |
| 导出 | `handleExport()` / `prepareExportRows()` / CSV/Excel 导出函数 | 生成规范行、转义、构造 Blob 下载 |
| 备份/恢复 | `handleBackup()` / `importBackupData()` | JSON 快照保存与覆盖导入，格式校验与状态提示 |
| 示例数据 | `initializeGuestTransactions()` | 首次启动无数据时注入示例交易集以便图表与界面演示 |
| 交易详情 | `openTransactionModal()` / `editCurrentTransaction()` / `deleteCurrentTransaction()` | 模态显示、编辑回填与删除后刷新 |

## 5. 功能流程
### 5.1 添加交易
1. 用户选择类型与分类，输入金额、日期与备注。
2. 点击“保存记录”触发 `saveTransaction()`。
3. 金额转换为整数分并写入 `transactions_guest`。
4. 调用 `loadTransactions()` 刷新列表；`updateCharts()` 与 `updateFinancialSummary()` 同步统计与图表。

### 5.2 月度预算
1. 用户输入预算金额并点击保存。
2. 通过校验与格式化写入 `budget_guest`。
3. `updateBudgetUI()` 计算剩余/超出并更新提示与警告（首次超支触发 toast 提醒）。

### 5.3 数据导出
1. 读取全部交易，按日期倒序排序生成行。
2. CSV：逐行转义逗号/引号，加入 BOM 以兼容 Excel。
3. Excel：构建简单 HTML 表格并以 `.xls` 下载实现快速打开。

### 5.4 备份与恢复
1. 备份：`buildBackupPayload()` 生成 `{ exportedAt, transactions, budget }` JSON 并触发下载。
2. 恢复：选择 JSON 文件后解析并覆盖现有数据，重新加载交易与图表。

## 6. 图表体系
| 图表 | Canvas ID | 数据来源 | 说明 |
|------|-----------|----------|------|
| 收支趋势折线 | `trendChart` | 最近 30 天 / 周 / 月聚合 | 三种周期按钮切换（默认月）|
| 月度收支对比柱状 | `monthlyComparisonChart` | 最近 6 个月 | 收入与支出并列对比 |
| 收支比例饼图 | `incomeExpenseRatioChart` | 本月收入 vs 支出总额 | 动态百分比提示 |
| 支出分类环形 | `categoryChart` | 本月支出按分类汇总 | 列表显示金额与占比 |
| 收入分类环形 | `incomeCategoryChart` | 本月收入按分类汇总 | 同步列表百分比 |

所有图表初始化在 `initCharts()` 中完成，数据更新由各自的 `update*` 函数负责。切换周期时仅更新趋势图数据集。

## 7. 备份格式示例
```json
{
	"exportedAt": "2025-11-29T12:34:56.789Z",
	"transactions": [
		{
			"id": "1732877690000-0.123",
			"type": "expense",
			"amount": 25.9,
			"amountCents": 2590,
			"date": "2025-11-28",
			"category": { "id": "shopping", "name": "购物", "icon": "shopping-bag", "color": "#8B5CF6" },
			"note": "示例记录",
			"createdAt": "2025-11-28T10:20:30.000Z"
		}
	],
	"budget": 2000
}
```

## 8. 扩展方向（可选）
- 自定义分类增删与排序
- “查看全部”分页与多维筛选（分类/金额区间/关键词）
- PWA：离线缓存与安装入口
- 数据加密与本地密码保护
- 图表交互增强：点击分类高亮对应交易
- 多预算支持：周预算 / 年目标 / 分类限额

## 9. 当前文件结构
```
├── index.html          # 页面结构与容器
├── styles.css          # 样式与细节增强
├── app.js              # 全部业务逻辑与状态管理
├── ARCHITECTURE.md     # 架构说明（本文件）
├── README.md           # 使用与特性说明
└── server.js           # 已失去业务逻辑（可视为占位 / 历史遗留）
```

## 10. 关键设计要点摘要
- 统一金额以分为计算基准，展示再格式化。
- 图表与摘要均从同一规范化交易数组计算，避免重复转换。
- 备份与恢复保持可读 JSON，便于手动编辑与迁移。
- 最小依赖（仅引入 Chart.js、Tailwind、Font Awesome）降低维护成本。
- 通过初始化示例数据提升首次使用体验与可视化直观性。

---
此文档旨在帮助快速理解代码结构与数据流，便于后续扩展或重构。
