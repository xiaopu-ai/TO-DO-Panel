# Harness 工程学习指南

> 本文基于 Anthropic 官方文档、得物/腾讯等企业实践、以及开源社区（Trail of Bits、awesome-claude-code 等）的最佳实践整理而成。

## 一、什么是 Harness？

Harness（直译"线束"）是 **包裹在 AI 模型外面的约束和反馈系统**。

类比：AI 模型是引擎，Harness 是整辆车——方向盘、刹车、仪表盘、安全带。
引擎再强，没有 Harness 就是失控的动力。

**来自实证**：LangChain 团队在 Terminal Bench 2.0 测试中，纯靠优化 Harness（不换模型），提升了 13.7 个百分点。这证明 **Harness 的质量决定了 AI 编程的可靠性**。

## 二、五层架构

```
┌─────────────────────────────────────────────┐
│              你的自然语言指令                   │
├─────────────────────────────────────────────┤
│  CLAUDE.md     │ 大脑：项目规则和上下文          │  ← 每次对话都读
│  Skills        │ 剧本：可复用的工作流程          │  ← 按需加载
│  Hooks         │ 自动机：自动执行的质量门禁       │  ← 无需AI判断
│  Settings      │ 围栏：权限和安全边界            │  ← 硬性限制
│  Memory        │ 记忆：跨会话持久化信息          │  ← 自动积累
├─────────────────────────────────────────────┤
│              Claude AI 模型                    │
├─────────────────────────────────────────────┤
│              工具系统（43+ tools）              │
└─────────────────────────────────────────────┘
```

## 三、文件结构全解

```
项目根目录/
├── CLAUDE.md                    # 🧠 核心配置（团队共享，提交到 git）
├── CLAUDE.local.md              # 🔒 个人覆盖（gitignore，不提交）
├── docs/
│   ├── conventions.md           # 📐 编码规范详情（被 CLAUDE.md @import）
│   ├── workflow.md              # 🔄 工作流详情（被 CLAUDE.md @import）
│   └── PRD.md                   # 📋 产品需求文档（由 /prd skill 生成）
├── .claude/
│   ├── settings.json            # 🔧 权限+Hooks（团队共享，提交到 git）
│   ├── settings.local.json      # 🔒 个人权限覆盖（gitignore）
│   ├── agents/                  # 🤖 自定义子 Agent
│   │   └── code-reviewer.md     #    代码审查 Agent（只读，不改代码）
│   ├── skills/                  # 📚 自定义 Skills
│   │   ├── prd/
│   │   │   └── SKILL.md         #    /prd → 生成 PRD 文档
│   │   └── qa-checklist/
│   │       └── SKILL.md         #    /qa-checklist → 质量自检
│   ├── hooks/                   # ⚡ Hook 脚本
│   │   ├── block-dangerous.sh   #    拦截 rm -rf 等危险命令
│   │   └── auto-format.sh       #    写文件后自动运行 Prettier
│   └── rules/                   # 📏 路径级规则（按目录条件加载）
│       └── api-rules.md         #    只在编辑 API 文件时生效
├── .gitignore                   # 排除 node_modules, .env 等
└── HARNESS-GUIDE.md             # 📘 就是这份文件
```

## 四、各组件详解

### 4.1 CLAUDE.md —— "大脑"

**核心原则**：
- 控制在 **100 行以内**（超过 80 行遵循度下降）
- 每行通过 **"删掉会犯错吗"** 测试
- 用 `@path/to/file` 引用详细内容，保持主文件精简
- HTML 注释 `<!-- -->` 会被 Claude 跳过，适合写给人看的说明

**该放什么**：
| ✅ 放 | ❌ 不放 |
|-------|--------|
| Claude 猜不到的命令 | Claude 读代码就能知道的 |
| 与默认不同的规范 | 语言通用的标准实践 |
| 项目特有的架构决策 | 详细的 API 文档（用链接） |
| 具体的 NEVER 清单 | "写干净的代码"这类模糊要求 |

**NEVER 清单**的重要性：
得物团队实测，加入明确的 NEVER 清单后，Claude 违规率从 ~15% 降到 <2%。
明确的禁止比模糊的鼓励有效 10 倍。

**自我改进循环**：
```
Claude 犯错 → 你纠正 → 让 Claude 在 NEVER 列表加规则 → 你审核
```
这样 CLAUDE.md 会随时间越来越"聪明"。

### 4.2 Settings.json —— "围栏"

**三层优先级**（从高到低）：
1. deny → 绝对禁止，无法覆盖
2. ask → 需要你确认
3. allow → 自动放行

**deny 规则是安全底线**。即使 CLAUDE.md 里没有写，deny 规则也能拦截危险操作。

**为什么需要 `$schema`**：
加上 `"$schema": "https://json.schemastore.org/claude-code-settings.json"` 后，
VS Code / Cursor 会提供自动补全和校验，避免写错配置。

**settings.local.json**：
个人覆盖配置，自动被 gitignore。适合放个人权限（如 `git push`）。

### 4.3 Hooks —— "自动机"

**核心理念**：能自动化的不靠 AI 自觉。

| Hook 事件 | 触发时机 | 常见用途 |
|-----------|---------|---------|
| PreToolUse | 工具执行前 | 拦截危险命令 |
| PostToolUse | 工具执行后 | 自动格式化、类型检查 |
| Stop | Claude 完成时 | 检查是否有遗漏 |
| Notification | 需要输入时 | 桌面通知 |

**退出码含义**：
- `exit 0` → 放行
- `exit 2` → 拦截（PreToolUse）或强制继续（Stop）

**设计原则**（来自中文社区）：
越靠近安全/强制执行的逻辑，越应该用确定性的 shell 脚本；
越靠近智能判断的逻辑，可以用 prompt 类型的 hook（让 AI 判断）。

### 4.4 Skills —— "剧本"

**vs CLAUDE.md 的关键区别**：
- CLAUDE.md 内容每次对话都加载，占用常驻 context
- Skill 内容只在调用时加载，用完后在压缩时可以释放

**什么时候创建 Skill**：
当你发现自己在对话中反复粘贴同样的指令时 → 提取为 Skill。

**Skill 内容生命周期**：
1. 用户调用 /skill-name 或 Claude 自动触发
2. SKILL.md 内容注入到对话 context
3. Claude 按照 Skill 指令执行
4. 对话压缩时，保留前 5,000 tokens，其余释放

### 4.5 自定义 Agent —— "分身"

**三种内置 Agent**：
| Agent | 模型 | 能力 | 用途 |
|-------|------|------|------|
| Explore | Haiku（最快最便宜） | 只读 | 快速搜索/浏览代码 |
| Plan | 继承主模型 | 只读 | 规划实现方案 |
| general-purpose | 继承主模型 | 全部工具 | 复杂多步骤任务 |

**自定义 Agent 的价值**：
- 限定工具范围 → 更安全（如审查 Agent 只读不写）
- 限定模型 → 更省钱（子 Agent 用 Sonnet，主 Agent 用 Opus）
- 固定指令 → 更一致（不需要每次重复说明）

**省钱技巧**：
在 settings.json 中设置 `"CLAUDE_CODE_SUBAGENT_MODEL": "claude-sonnet-4-6"`，
子 Agent 用 Sonnet 运行（比 Opus 便宜约 60%），主 Agent 保持 Opus。

### 4.6 路径级规则 —— "条件加载"

**原理**：只在 Claude 读取匹配路径的文件时，才加载对应规则。

**适用场景**：
- `api-rules.md` → 编辑 API 路由时加载安全和格式规则
- `test-rules.md` → 编辑测试文件时加载测试编写规范
- `db-rules.md` → 编辑数据库操作时加载防注入规则

比把所有规则塞进 CLAUDE.md 更精准，更省 context。

## 五、使用流程

### 新项目启动

```bash
# 1. 复制模板
cp -r harness实践/ my-new-project/
cd my-new-project/

# 2. 初始化
git init

# 3. 编辑 CLAUDE.md —— 填写项目名、技术栈、命令等占位符

# 4. 创建项目
npm create vite@latest . -- --template react-ts  # 或其他脚手架

# 5. 安装格式化工具（让 auto-format hook 生效）
npm install -D prettier

# 6. 开始 vibe coding
claude  # 启动 Claude Code
```

### 日常开发

```
你：描述一个功能
  ↓
Claude：分析需求 → 拆分任务 → 子 Agent 开发
  ↓ （PostToolUse hook 自动格式化每个文件）
  ↓ （PreToolUse hook 拦截危险命令）
Claude：自测 → 你验收 → git commit
  ↓ （Stop hook 检查是否有遗漏）
你：继续下一个功能 或 /qa-checklist 自检
```

### 迭代优化

随着使用，不断完善你的 harness：
1. Claude 犯错 → 加 NEVER 规则
2. 反复粘贴同样的指令 → 提取为 Skill
3. 总是要手动格式化 → 加 Hook
4. 某类文件有特殊规范 → 加路径级规则

## 六、成本控制技巧

1. **子 Agent 降级**：主 Agent 用 Opus，子 Agent 用 Sonnet（省 ~60%）
2. **及时清理 context**：不相关的任务之间用 `/clear`
3. **并行而非串行**：多个独立任务用子 Agent 并行，而不是在一个长对话里做
4. **精准的 CLAUDE.md**：越精准的指令 = 越少的试错 = 越少的 token 消耗

## 七、参考资源

### 官方文档
- [Claude Code 最佳实践](https://code.claude.com/docs/en/best-practices)
- [Memory 系统](https://code.claude.com/docs/en/memory)
- [Hooks 指南](https://code.claude.com/docs/en/hooks-guide)
- [Skills 指南](https://code.claude.com/docs/en/skills)
- [子 Agent 指南](https://code.claude.com/docs/en/sub-agents)

### 社区资源
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — 最全的资源汇总
- [claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) — 实操指南
- [Trail of Bits 安全配置](https://github.com/trailofbits/claude-code-config) — 安全最佳实践
- [claude-md-templates](https://github.com/abhishekray07/claude-md-templates) — CLAUDE.md 模板集

### 中文资源
- [Harness 工程深度解析](https://zhuanlan.zhihu.com/p/2023367495260587380) — 知乎架构分析
- [得物 Claude Code 实践](https://zhuanlan.zhihu.com/p/1999439952606431131) — 企业级案例
- [Vibe Coding 最佳实践](https://github.com/tukuaiai/vibe-coding-cn/wiki/) — 中文 Wiki
- [50 条核心规则](https://tonybai.com/2026/01/25/claude-code-official-best-practices-50-core-rules/) — Tony Bai 整理
