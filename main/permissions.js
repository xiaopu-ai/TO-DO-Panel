'use strict';

// 权限引导的数据模型（纯函数，无 Electron 依赖）。
// 每一项说明「为什么要」「缺了会怎样」，并把系统状态折算成界面上唯一的下一步动作。

const SETTINGS_URLS = {
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  'screen-recording': 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
  automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
};

const PERMISSIONS = [
  {
    id: 'accessibility',
    title: '辅助功能',
    reason: '切换到「当前窗口」里的任意窗口、控制汽水音乐播放、把剪贴板历史粘贴回原应用。',
    required: true,
  },
  {
    id: 'screen-recording',
    title: '屏幕录制',
    reason: '读取其他应用的窗口标题。不会录制或保存屏幕内容；缺少时「当前窗口」列表为空。',
    required: true,
    needsRelaunch: true,
  },
  {
    id: 'microphone',
    title: '麦克风',
    reason: '快速录音与实时转写。只在你点击录音后才开始采集。',
    required: false,
  },
  {
    id: 'camera',
    title: '摄像头',
    reason: '首页「镜子」。只在你点击镜子后才打开，离开首页或收起即释放。',
    required: false,
  },
  {
    id: 'automation',
    title: '自动化（系统事件）',
    reason: '向其他应用发送按键。系统没有提供查询接口，会在第一次用到时询问一次。',
    required: false,
    queryable: false,
  },
];

// 系统状态 → 界面状态：
//   granted  已开启
//   prompt   还没问过，可以直接弹系统授权框（一次点击完成）
//   settings 已被拒绝 / 系统不提供授权框，只能去系统设置里手动打开
//   unknown  系统不提供查询
function resolvePermissionState(item, systemStatus) {
  if (item.queryable === false) return 'unknown';
  if (systemStatus === 'granted') return 'granted';
  if (systemStatus === 'not-determined' && (item.id === 'microphone' || item.id === 'camera')) return 'prompt';
  return 'settings';
}

function buildPermissionList(statuses = {}) {
  return PERMISSIONS.map((item) => {
    const state = resolvePermissionState(item, statuses[item.id]);
    return {
      id: item.id,
      title: item.title,
      reason: item.reason,
      required: item.required === true,
      needsRelaunch: item.needsRelaunch === true,
      state,
      actionLabel: state === 'granted' ? '' : state === 'prompt' ? '允许' : '打开设置',
    };
  });
}

function missingRequiredPermissions(statuses = {}) {
  return buildPermissionList(statuses)
    .filter((item) => item.required && item.state !== 'granted')
    .map((item) => item.id);
}

function permissionSettingsUrl(id) {
  return Object.prototype.hasOwnProperty.call(SETTINGS_URLS, id) ? SETTINGS_URLS[id] : null;
}

module.exports = {
  PERMISSIONS,
  buildPermissionList,
  missingRequiredPermissions,
  permissionSettingsUrl,
  resolvePermissionState,
};
