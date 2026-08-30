# GroundDesk Evals

本目录是评测入口说明，评测真值不会复制成多份难以同步的 JSON：

- 用例数据：[`supabase/seed/002_evaluation_cases.sql`](../supabase/seed/002_evaluation_cases.sql)；
- 执行器与确定性评分：[`apps/api/src/evaluations`](../apps/api/src/evaluations)；
- 真实结果与失败分析：[`docs/evaluation-report.md`](../docs/evaluation-report.md)。

Seed 包含 26 条中英文用例：8 条知识、5 条订单、5 条退货、4 条无答案、2 条安全攻击和 2 条 Workspace 隔离。每条用例声明预期引用、工具、拒答/接管、退货状态或隔离结果；页面不会把预期值当作实际结果。

```bash
# 可控 Provider，适合本地与 CI
pnpm eval:smoke

# 真实 DeepSeek + SiliconFlow + Supabase，会产生少量费用
pnpm eval:live

# 从数据库读取最新运行和失败明细
pnpm eval:report
```

评测会话使用 `evaluation` 来源，保留检索、消息、工具和用量审计，但不占公开 Demo 配额、不创建人工工单，也不进入运营看板。
