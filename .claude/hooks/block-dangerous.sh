#!/bin/bash
# ============================================================
# 📘 危险命令拦截 Hook（PreToolUse 阶段）
# ============================================================
# 触发时机：Claude 每次要执行 Bash 命令之前
# 工作原理：从 stdin 读取 JSON，提取命令内容，匹配危险模式
# 退出码：0 = 放行，2 = 拦截（Claude 会看到错误信息）
#
# 为什么需要这个？
# - settings.json 的 deny 规则是静态匹配，可能被变体绕过
# - 这个脚本做更灵活的模式匹配，是第二道防线
# - 来自 Trail of Bits 的安全实践
# ============================================================

# 从 stdin 读取 Claude 传入的 JSON
INPUT=$(cat)

# 提取要执行的命令
COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('command', ''))
except:
    print('')
" 2>/dev/null)

# 如果提取失败，放行（不阻塞正常工作）
if [ -z "$COMMAND" ]; then
    exit 0
fi

# 危险模式列表
DANGEROUS_PATTERNS=(
    "rm -rf /"           # 删除根目录
    "rm -rf ~"           # 删除主目录
    "rm -rf \."          # 删除当前目录所有内容
    "> /dev/sda"         # 覆写磁盘
    "mkfs\."             # 格式化磁盘
    ":(){ :|:& };:"      # fork 炸弹
    "dd if="             # 磁盘写入
    "curl.*|.*bash"      # 下载并执行
    "wget.*|.*bash"      # 下载并执行
    "chmod -R 777"       # 过度开放权限
    "git push.*--force"  # 强制推送
    "git push.*-f "      # 强制推送缩写
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if echo "$COMMAND" | grep -qiE "$pattern"; then
        echo "🚫 危险命令被拦截: $COMMAND"
        echo "匹配到的危险模式: $pattern"
        echo "如果确实需要执行，请手动在终端运行。"
        exit 2
    fi
done

# 检查是否在向 main/master 分支直接推送
if echo "$COMMAND" | grep -qE "git push.*(main|master)"; then
    echo "⚠️ 检测到直接推送到 main/master 分支"
    echo "建议使用 Pull Request 流程。"
    echo "如果确实需要，请手动在终端执行。"
    exit 2
fi

# 所有检查通过，放行
exit 0
