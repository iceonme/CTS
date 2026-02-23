# Arena 历史比赛存档

> 记录回测竞技场的所有比赛结果，用于对比分析和策略优化

---

## 📁 存档格式

每个比赛一个文件夹，命名格式：`YYYY-MM-DD/NNN-比赛名称/`

```
arena-history/
├── README.md                    # 本文件
├── 2026-02-20/
│   ├── 001-indicator-prompt-v1/  # 比赛文件夹
│   │   ├── report.md             # 人类可读报告
│   │   ├── data.json             # 完整数据（净值、交易、日志）
│   │   └── config.json           # 比赛配置（参数、提示词版本）
│   └── 002-indicator-prompt-v2/
│       ├── report.md
│       ├── data.json
│       └── config.json
└── 2026-02-21/
    └── ...
```

---

## 📊 比赛记录列表

| 日期 | 编号 | 比赛名称 | 参赛者 | 胜者 | 备注 |
|------|------|----------|--------|------|------|
| 2026-02-20 | 001 | Indicator Prompt V1 | DCA / Lite / Indicator / Strategy | ? | 旧提示词（RSI 30/70规则） |
| 2026-02-20 | 002 | Indicator Prompt V2 | DCA / Lite / Indicator / Strategy | ? | 新提示词（自主判断趋势） |

---

## 🔍 关键结论

### 2026-02-20

- **发现**：Lite（数据少）反而胜出
- **原因**：Indicator/Strategy 被 RSI 30/70 规则限制，错过震荡行情机会
- **改进**：移除硬性规则，让 LLM 自主判断趋势

---

## 📈 如何对比历史比赛

```bash
# 查看某场比赛详情
cat docs/arena-history/2026-02-20/001-indicator-prompt-v1/report.md

# 对比两场比赛的配置差异
diff docs/arena-history/2026-02-20/001-indicator-prompt-v1/config.json \
     docs/arena-history/2026-02-20/002-indicator-prompt-v2/config.json
```
