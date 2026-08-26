#!/bin/bash
# ============================================================
# 📘 自动格式化 Hook（PostToolUse 阶段）
# ============================================================
# 触发时机：Claude 每次写入或编辑文件之后
# 工作原理：读取被修改的文件路径，对支持的文件类型运行 Prettier
#
# 为什么需要这个？
# - Claude 生成的代码格式可能不一致（缩进、分号、引号）
# - 自动格式化保证整个项目风格统一
# - 比在 CLAUDE.md 里写格式规则更可靠（Hooks > 指令）
# - 来自 Anthropic 官方推荐的 Starter Hook
# ============================================================

# 从 stdin 读取 Claude 传入的 JSON
INPUT=$(cat)

# 提取被操作的文件路径
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # Write 工具用 file_path，Edit 工具也用 file_path
    print(data.get('tool_input', {}).get('file_path', ''))
except:
    print('')
" 2>/dev/null)

# 如果没有文件路径，跳过
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

# 只格式化支持的文件类型
case "$FILE_PATH" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.scss|*.html|*.md|*.vue|*.svelte)
        # 检查 prettier 是否可用
        if command -v npx &> /dev/null && [ -f "node_modules/.bin/prettier" ]; then
            npx prettier --write "$FILE_PATH" 2>/dev/null
        fi
        ;;
esac

# 格式化是增强功能，失败不应阻塞 Claude
exit 0
