# INS-005: 将 Arena 竞技场与交易策略 Skill 化的架构洞察

## 1. 核心背景
在 CTS (Crypto Trading System) 的开发过程中，为了实现多智能体（Multi-Agent）的高效协作与竞争，识别到有必要将“环境准入”与“交易逻辑”从硬编码中解耦，转化为符合 AI Agent 认知标准的 **Skills**。

## 2. 深度洞察

### 2.1 Arena 作为“协议型 Skill” (Protocol Skill)
*   **定义**：竞技场不再仅仅是一个代码运行环境，而是一套 **Agent 准入协议**。
*   **内容**：封装 `arena-participant-protocol`。包含 K 线数据格式、账户状态接口、下单动作规范及比赛规则（如手续费、爆仓逻辑）。
*   **价值**：新 Agent 只要学习该 Skill，即可零成本理解并参与竞技。

### 2.2 策略作为“能力型 Skill” (Capability Skill)
*   **定义**：将交易策略（Grid, DCA, Moving Average 等）封装为 **Agent 的认知插件**。
*   **内容**：包含策略的数学原理、适用行情说明、底层执行代码参考。
*   **价值**：
    *   **动态解耦**：允许 LLM 参赛者根据市场状态实时加载不同的策略 Skill。
    *   **自我进化**：Agent 可以通过阅读策略 Skill 的代码进行自我优化或 Bug 修复。

## 3. 执行建议
1.  **标准化**：制定符合 Anthropic Skills 标准的 `SKILL.md` 模板。
2.  **模块化**：优先将 `GridContestant` 的核心逻辑提取为第一个策略 Skill 示例。
3.  **文档化**：在 `docs/COLLABORATION_GUIDE.md` 中补充关于如何贡献新 Skill 的说明。
