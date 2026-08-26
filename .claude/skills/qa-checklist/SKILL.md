<!-- ============================================================
  📘 Skill：QA 检查清单
  ============================================================
  当需要对完成的功能做质量检查时使用。
  与 /qa skill 不同，这个是轻量级的手动检查清单，
  不需要启动浏览器，适合快速自检。
  ============================================================ -->
---
name: qa-checklist
description: 当用户说"检查一下""自检""质量检查""上线前检查"时触发，生成并执行 QA 检查清单
allowed-tools: Read Grep Glob Bash(npx tsc*) Bash(npx eslint*) Bash(npm test*)
---

# QA 检查清单

对当前项目执行以下检查，汇报结果。

## 自动检查（立即执行）

### 1. TypeScript 类型检查
```bash
npx tsc --noEmit
```
报告错误数量和位置。

### 2. ESLint 检查
```bash
npx eslint . --ext .ts,.tsx,.js,.jsx,.vue
```
报告 error 和 warning 数量。

### 3. 测试
```bash
npm test -- --passWithNoTests
```
报告通过/失败/跳过的测试数量。

## 手动检查（扫描代码）

### 4. 安全检查
- [ ] 搜索硬编码的密钥/token：`grep -r "sk-\|api_key\|password\|secret" src/`
- [ ] 检查 .env 文件是否在 .gitignore 中
- [ ] 检查是否有 console.log 残留在生产代码中

### 5. 代码质量
- [ ] 搜索 `any` 类型使用：`grep -r ": any" src/`
- [ ] 搜索 TODO/FIXME：`grep -r "TODO\|FIXME\|HACK" src/`
- [ ] 检查是否有超过 200 行的文件

### 6. 用户体验
- [ ] 检查所有表单是否有 loading 状态
- [ ] 检查空状态是否有友好提示
- [ ] 检查图片是否有 alt 属性

## 输出格式

```
✅ 通过的检查项
❌ 失败的检查项（附带具体位置和建议修复方式）
⚠️ 需要人工确认的项
```
