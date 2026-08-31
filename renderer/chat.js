(function initChatPanel() {
  const Domain = window.NotchDomain;
  if (!Domain) return;

  const CHAT_ROLES_KEY = 'notch-chat-roles-v1';
  const CHAT_SESSIONS_KEY = 'notch-chat-sessions-v1';
  const CHAT_ACTIVE_ROLE_KEY = 'notch-chat-active-role-v1';
  const CHAT_ACTIVE_SESSION_KEY = 'notch-chat-active-session-v1';

  const roleList = document.getElementById('chat-role-list');
  const sessionList = document.getElementById('chat-session-list');
  const messagesEl = document.getElementById('chat-messages');
  const composer = document.getElementById('chat-composer');
  const input = document.getElementById('chat-input');
  const sendButton = document.getElementById('chat-send');
  const statusEl = document.getElementById('chat-status');
  const roleCount = document.getElementById('chat-role-count');
  const sessionCount = document.getElementById('chat-session-count');
  const currentRoleEl = document.getElementById('chat-current-role');
  const currentSessionEl = document.getElementById('chat-current-session');
  const saveNoteButton = document.getElementById('chat-save-note');
  const clearSessionButton = document.getElementById('chat-clear-session');
  const roleEditor = document.getElementById('chat-role-editor');
  const roleEditorTitle = document.getElementById('chat-role-editor-title');
  const roleNameInput = document.getElementById('chat-role-name');
  const rolePromptInput = document.getElementById('chat-role-prompt');
  const roleDeleteButton = document.getElementById('chat-role-delete');
  const roleSaveButton = document.getElementById('chat-role-save');
  const roleNewButton = document.getElementById('chat-role-new');
  const sessionNewButton = document.getElementById('chat-session-new');
  const roleEditorClose = document.getElementById('chat-role-editor-close');
  const homeMessages = document.getElementById('home-chat-messages');
  const homeComposer = document.getElementById('home-chat-composer');
  const homeInput = document.getElementById('home-chat-input');
  const homeRoleSelect = document.getElementById('home-chat-role');
  const homeOpenButton = document.getElementById('home-chat-open');

  if (!roleList || !messagesEl || !composer) return;

  let roles = Domain.normalizeChatRoles(null);
  let sessions = [];
  let activeRoleId = '';
  let activeSessionId = '';
  let editingRoleId = '';
  let editingMessageIndex = -1;
  let sending = false;
  let composing = false;
  let streamRequestId = '';
  let streamBuffer = '';
  let streamRenderTimer = null;
  let unsubscribeChunk = null;

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed == null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // ignore quota
    }
  }

  function loadState() {
    roles = Domain.normalizeChatRoles(readJson(CHAT_ROLES_KEY, null));
    sessions = Domain.normalizeChatSessions(readJson(CHAT_SESSIONS_KEY, []));
    activeRoleId = String(localStorage.getItem(CHAT_ACTIVE_ROLE_KEY) || roles[0]?.id || '');
    if (!roles.some((role) => role.id === activeRoleId)) activeRoleId = roles[0]?.id || '';
    activeSessionId = String(localStorage.getItem(CHAT_ACTIVE_SESSION_KEY) || '');
    const roleSessions = sessions.filter((session) => session.roleId === activeRoleId);
    if (!roleSessions.some((session) => session.id === activeSessionId)) {
      activeSessionId = roleSessions[0]?.id || '';
    }
  }

  function persistState() {
    writeJson(CHAT_ROLES_KEY, roles);
    writeJson(CHAT_SESSIONS_KEY, sessions);
    if (activeRoleId) localStorage.setItem(CHAT_ACTIVE_ROLE_KEY, activeRoleId);
    if (activeSessionId) localStorage.setItem(CHAT_ACTIVE_SESSION_KEY, activeSessionId);
    else localStorage.removeItem(CHAT_ACTIVE_SESSION_KEY);
    document.dispatchEvent(new CustomEvent('notch:chat-updated'));
  }

  function currentRole() {
    return roles.find((role) => role.id === activeRoleId) || null;
  }

  function currentSession() {
    return sessions.find((session) => session.id === activeSessionId) || null;
  }

  function setStatus(text, tone = '') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  function renderMarkdown(target, text) {
    if (!target) return;
    if (window.NotchMarkdown?.buildPreview) {
      target.replaceChildren(window.NotchMarkdown.buildPreview(text));
      return;
    }
    target.textContent = text;
  }

  function copyText(text) {
    const value = String(text || '');
    if (!value) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => setStatus('已复制')).catch(() => {
        setStatus('复制失败', 'error');
      });
      return;
    }
    setStatus('当前环境不支持复制', 'error');
  }

  function ensureSession() {
    if (currentSession()) return currentSession();
    if (!activeRoleId) return null;
    sessions = Domain.createChatSession(sessions, activeRoleId, Date.now());
    activeSessionId = sessions[0]?.id || '';
    persistState();
    return currentSession();
  }

  function renderRoles() {
    if (roleCount) roleCount.textContent = `${roles.length} 个`;
    roleList.replaceChildren();
    roles.forEach((role) => {
      const row = document.createElement('div');
      row.className = `chat-role-item${role.id === activeRoleId ? ' active' : ''}`;
      row.dataset.roleId = role.id;
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'chat-role-select';
      select.dataset.roleId = role.id;
      const name = document.createElement('strong');
      name.textContent = role.name;
      const prompt = document.createElement('span');
      prompt.textContent = role.systemPrompt;
      select.append(name, prompt);
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'chat-role-edit';
      edit.dataset.editRoleId = role.id;
      edit.setAttribute('aria-label', `编辑 ${role.name}`);
      edit.textContent = '编辑';
      row.append(select, edit);
      roleList.append(row);
    });

    if (homeRoleSelect) {
      const previous = homeRoleSelect.value;
      homeRoleSelect.replaceChildren();
      roles.forEach((role) => {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = role.name;
        homeRoleSelect.append(option);
      });
      homeRoleSelect.value = roles.some((role) => role.id === previous)
        ? previous
        : activeRoleId;
    }
  }

  function renderSessions() {
    const roleSessions = sessions.filter((session) => session.roleId === activeRoleId);
    if (sessionCount) sessionCount.textContent = `${roleSessions.length} 条`;
    sessionList.replaceChildren();
    if (!roleSessions.length) {
      const empty = document.createElement('div');
      empty.className = 'chat-empty-hint';
      empty.textContent = '点「新对话」开始';
      sessionList.append(empty);
      return;
    }
    roleSessions.forEach((session) => {
      const row = document.createElement('div');
      row.className = `chat-session-item${session.id === activeSessionId ? ' active' : ''}`;
      row.dataset.sessionId = session.id;
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'chat-session-select';
      select.dataset.sessionId = session.id;
      const title = document.createElement('strong');
      title.textContent = session.title || '未命名对话';
      const meta = document.createElement('span');
      meta.textContent = `${session.messages.length} 条消息`;
      select.append(title, meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chat-session-delete';
      remove.dataset.deleteSessionId = session.id;
      remove.setAttribute('aria-label', '删除会话');
      remove.textContent = '×';
      row.append(select, remove);
      sessionList.append(row);
    });
  }

  function createMessageActions(message, index) {
    const actions = document.createElement('div');
    actions.className = 'chat-bubble-actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'chat-action-btn';
    copy.dataset.copyIndex = String(index);
    copy.textContent = '复制';
    actions.append(copy);
    if (message.role === 'user') {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'chat-action-btn';
      edit.dataset.editIndex = String(index);
      edit.textContent = '编辑';
      actions.append(edit);
    }
    return actions;
  }

  function renderMessages() {
    const role = currentRole();
    const session = currentSession();
    if (currentRoleEl) currentRoleEl.textContent = role ? role.name : '选择角色开始对话';
    if (currentSessionEl) {
      currentSessionEl.textContent = session
        ? (session.title || '新对话')
        : '尚未开始会话';
    }
    const hasMessages = Boolean(session && session.messages.length);
    if (saveNoteButton) saveNoteButton.disabled = !hasMessages || sending;
    if (clearSessionButton) clearSessionButton.disabled = !session || sending;
    if (sendButton) sendButton.disabled = sending || !role;
    if (input) input.disabled = sending || !role;

    messagesEl.replaceChildren();
    if (!role) {
      const empty = document.createElement('div');
      empty.className = 'chat-empty';
      empty.innerHTML = '<strong>还没有角色</strong><p>先新建一个角色，再开始提问。</p>';
      messagesEl.append(empty);
      renderHomeMessages();
      return;
    }
    if (!session || !session.messages.length) {
      const empty = document.createElement('div');
      empty.className = 'chat-empty';
      empty.innerHTML = `<strong></strong><p></p>`;
      empty.querySelector('strong').textContent = role.name;
      empty.querySelector('p').textContent = role.systemPrompt;
      messagesEl.append(empty);
      renderHomeMessages();
      return;
    }

    session.messages.forEach((message, index) => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble chat-bubble-${message.role}`;
      bubble.dataset.messageIndex = String(index);
      const label = document.createElement('span');
      label.className = 'chat-bubble-label';
      label.textContent = message.role === 'assistant' ? role.name : '我';
      bubble.append(label);

      if (editingMessageIndex === index && message.role === 'user') {
        const editor = document.createElement('div');
        editor.className = 'chat-inline-editor';
        const area = document.createElement('textarea');
        area.rows = 3;
        area.value = message.content;
        area.className = 'chat-inline-textarea';
        const row = document.createElement('div');
        row.className = 'chat-inline-actions';
        const resend = document.createElement('button');
        resend.type = 'button';
        resend.className = 'workspace-button primary compact';
        resend.dataset.resendIndex = String(index);
        resend.textContent = '从此发送';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'workspace-button compact';
        cancel.dataset.cancelEdit = '1';
        cancel.textContent = '取消';
        row.append(cancel, resend);
        editor.append(area, row);
        bubble.append(editor);
      } else {
        const body = document.createElement('div');
        body.className = 'chat-bubble-body md-preview';
        renderMarkdown(body, message.content);
        bubble.append(body, createMessageActions(message, index));
      }
      messagesEl.append(bubble);
    });

    if (sending) {
      const pending = document.createElement('div');
      pending.className = 'chat-bubble chat-bubble-assistant is-streaming';
      pending.id = 'chat-streaming-bubble';
      const label = document.createElement('span');
      label.className = 'chat-bubble-label';
      label.textContent = role.name;
      const body = document.createElement('div');
      body.className = 'chat-bubble-body md-preview';
      body.id = 'chat-streaming-body';
      if (streamBuffer) renderMarkdown(body, streamBuffer);
      else body.textContent = '正在生成…';
      pending.append(label, body);
      messagesEl.append(pending);
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
    renderHomeMessages();
  }

  function renderHomeMessages() {
    if (!homeMessages) return;
    const role = currentRole();
    const session = currentSession();
    homeMessages.replaceChildren();
    if (!role) {
      homeMessages.innerHTML = '<div class="home-chat-empty">先创建角色</div>';
      return;
    }
    const messages = session?.messages || [];
    if (!messages.length && !sending) {
      homeMessages.innerHTML = `<div class="home-chat-empty">${role.name} · 开始提问</div>`;
      return;
    }
    messages.slice(-4).forEach((message) => {
      const row = document.createElement('div');
      row.className = `home-chat-line home-chat-line-${message.role}`;
      const mark = document.createElement('strong');
      mark.textContent = message.role === 'assistant' ? role.name : '我';
      const text = document.createElement('span');
      text.textContent = message.content.replace(/\s+/g, ' ').slice(0, 120);
      row.append(mark, text);
      homeMessages.append(row);
    });
    if (sending) {
      const row = document.createElement('div');
      row.className = 'home-chat-line home-chat-line-assistant';
      row.innerHTML = `<strong>${role.name}</strong><span>${streamBuffer ? streamBuffer.replace(/\s+/g, ' ').slice(0, 120) : '正在生成…'}</span>`;
      homeMessages.append(row);
    }
    homeMessages.scrollTop = homeMessages.scrollHeight;
  }

  function renderAll() {
    renderRoles();
    renderSessions();
    renderMessages();
  }

  function scheduleStreamRender() {
    if (streamRenderTimer) return;
    streamRenderTimer = setTimeout(() => {
      streamRenderTimer = null;
      const body = document.getElementById('chat-streaming-body');
      if (body) renderMarkdown(body, streamBuffer || '正在生成…');
      renderHomeMessages();
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 40);
  }

  function openRoleEditor(roleId = '') {
    editingRoleId = String(roleId || '');
    const role = roles.find((item) => item.id === editingRoleId);
    if (roleEditorTitle) roleEditorTitle.textContent = role ? '编辑角色' : '新建角色';
    if (roleNameInput) roleNameInput.value = role ? role.name : '';
    if (rolePromptInput) rolePromptInput.value = role ? role.systemPrompt : '';
    if (roleDeleteButton) roleDeleteButton.hidden = !role;
    if (roleEditor) roleEditor.hidden = false;
    roleNameInput?.focus();
  }

  function closeRoleEditor() {
    editingRoleId = '';
    if (roleEditor) roleEditor.hidden = true;
  }

  async function requestAssistantReply() {
    const role = currentRole();
    const session = currentSession();
    if (!role || !session || !window.notchAPI?.chatComplete) {
      setStatus(window.notchAPI?.chatComplete ? '请先选择角色' : '当前环境不支持对话 API', 'error');
      return;
    }

    sending = true;
    editingMessageIndex = -1;
    streamBuffer = '';
    streamRequestId = `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setStatus('正在流式生成…');
    renderAll();

    if (unsubscribeChunk) unsubscribeChunk();
    unsubscribeChunk = window.notchAPI.onChatChunk?.((payload) => {
      if (!payload || payload.requestId !== streamRequestId) return;
      streamBuffer += String(payload.delta || '');
      scheduleStreamRender();
    }) || null;

    const history = (session.messages || []).map((item) => ({
      role: item.role,
      content: item.content,
    }));
    const result = await window.notchAPI.chatComplete({
      requestId: streamRequestId,
      systemPrompt: role.systemPrompt,
      messages: history,
    }).catch(() => ({ ok: false, error: 'request_failed' }));

    if (unsubscribeChunk) {
      unsubscribeChunk();
      unsubscribeChunk = null;
    }
    if (streamRenderTimer) {
      clearTimeout(streamRenderTimer);
      streamRenderTimer = null;
    }

    sending = false;
    const finalText = String(result?.content || streamBuffer || '').trim();
    streamBuffer = '';
    streamRequestId = '';

    if (!result?.ok || !finalText) {
      const map = {
        not_configured: '请先在设置中配置 DeepSeek / LLM API Key',
        timeout: '请求超时，请稍后重试',
        empty_response: '模型返回为空',
        invalid_endpoint: 'API 地址无效',
      };
      setStatus(map[result?.error] || `对话失败：${result?.error || 'unknown'}`, 'error');
      renderAll();
      return;
    }

    sessions = Domain.appendChatMessage(
      sessions,
      activeSessionId,
      { role: 'assistant', content: finalText },
      Date.now()
    );
    persistState();
    setStatus('回复完成。可复制单条消息，或保存到笔记。');
    renderAll();
  }

  async function sendMessage(rawText, options = {}) {
    const text = String(rawText || '').trim();
    if (!text || sending) return;
    const role = currentRole();
    if (!role) {
      setStatus('请先选择或创建角色', 'error');
      return;
    }

    let session = ensureSession();
    if (!session) return;

    if (Number.isInteger(options.replaceIndex) && options.replaceIndex >= 0) {
      sessions = Domain.replaceChatFromIndex(
        sessions,
        session.id,
        options.replaceIndex,
        text,
        Date.now()
      );
    } else {
      sessions = Domain.appendChatMessage(sessions, session.id, { role: 'user', content: text }, Date.now());
    }
    persistState();
    if (input) input.value = '';
    if (homeInput) homeInput.value = '';
    editingMessageIndex = -1;
    await requestAssistantReply();
  }

  roleList.addEventListener('click', (event) => {
    const editId = event.target.closest('[data-edit-role-id]')?.dataset.editRoleId;
    if (editId) {
      openRoleEditor(editId);
      return;
    }
    const roleId = event.target.closest('[data-role-id]')?.dataset.roleId;
    if (!roleId || roleId === activeRoleId) return;
    activeRoleId = roleId;
    const roleSessions = sessions.filter((session) => session.roleId === activeRoleId);
    activeSessionId = roleSessions[0]?.id || '';
    persistState();
    closeRoleEditor();
    renderAll();
  });

  sessionList.addEventListener('click', (event) => {
    const deleteId = event.target.closest('[data-delete-session-id]')?.dataset.deleteSessionId;
    if (deleteId) {
      sessions = Domain.deleteChatSession(sessions, deleteId);
      if (activeSessionId === deleteId) {
        activeSessionId = sessions.find((session) => session.roleId === activeRoleId)?.id || '';
      }
      persistState();
      renderAll();
      return;
    }
    const sessionId = event.target.closest('[data-session-id]')?.dataset.sessionId;
    if (!sessionId || sessionId === activeSessionId) return;
    activeSessionId = sessionId;
    persistState();
    renderAll();
  });

  messagesEl.addEventListener('click', (event) => {
    const copyIndex = event.target.closest('[data-copy-index]')?.dataset.copyIndex;
    if (copyIndex != null) {
      const message = currentSession()?.messages[Number(copyIndex)];
      if (message) copyText(message.content);
      return;
    }
    const editIndex = event.target.closest('[data-edit-index]')?.dataset.editIndex;
    if (editIndex != null) {
      editingMessageIndex = Number(editIndex);
      renderMessages();
      messagesEl.querySelector('.chat-inline-textarea')?.focus();
      return;
    }
    if (event.target.closest('[data-cancel-edit]')) {
      editingMessageIndex = -1;
      renderMessages();
      return;
    }
    const resendIndex = event.target.closest('[data-resend-index]')?.dataset.resendIndex;
    if (resendIndex != null) {
      const area = event.target.closest('.chat-inline-editor')?.querySelector('textarea');
      sendMessage(area?.value || '', { replaceIndex: Number(resendIndex) });
    }
  });

  roleNewButton?.addEventListener('click', () => openRoleEditor(''));
  roleEditorClose?.addEventListener('click', closeRoleEditor);
  sessionNewButton?.addEventListener('click', () => {
    if (!activeRoleId) {
      setStatus('请先创建角色', 'error');
      return;
    }
    sessions = Domain.createChatSession(sessions, activeRoleId, Date.now());
    activeSessionId = sessions[0]?.id || '';
    persistState();
    renderAll();
    input?.focus();
  });

  roleSaveButton?.addEventListener('click', () => {
    const name = String(roleNameInput?.value || '').trim();
    const prompt = String(rolePromptInput?.value || '').trim();
    if (!name || !prompt) {
      setStatus('角色名称和提示词不能为空', 'error');
      return;
    }
    const previousId = editingRoleId;
    roles = Domain.upsertChatRole(roles, {
      id: previousId,
      name,
      systemPrompt: prompt,
    }, Date.now());
    if (!previousId) activeRoleId = roles[0]?.id || activeRoleId;
    else activeRoleId = previousId;
    persistState();
    closeRoleEditor();
    setStatus('角色已保存');
    renderAll();
  });

  roleDeleteButton?.addEventListener('click', () => {
    if (!editingRoleId) return;
    if (roles.length <= 1) {
      setStatus('至少保留一个角色', 'error');
      return;
    }
    roles = Domain.deleteChatRole(roles, editingRoleId);
    sessions = sessions.filter((session) => session.roleId !== editingRoleId);
    if (activeRoleId === editingRoleId) activeRoleId = roles[0]?.id || '';
    activeSessionId = sessions.find((session) => session.roleId === activeRoleId)?.id || '';
    persistState();
    closeRoleEditor();
    setStatus('角色已删除');
    renderAll();
  });

  clearSessionButton?.addEventListener('click', () => {
    const session = currentSession();
    if (!session) return;
    sessions = sessions.map((item) => (
      item.id === session.id
        ? { ...item, messages: [], title: '', updatedAt: Date.now() }
        : item
    ));
    sessions = Domain.normalizeChatSessions(sessions);
    persistState();
    setStatus('会话已清空');
    renderAll();
  });

  saveNoteButton?.addEventListener('click', () => {
    const role = currentRole();
    const session = currentSession();
    if (!role || !session || !session.messages.length) return;
    const content = Domain.formatChatSessionMarkdown(session, role.name);
    const note = window.NotchNotes?.saveFromChat?.({
      title: session.title || `${role.name} 对话`,
      content,
      roleName: role.name,
    });
    if (note) {
      setStatus(`已保存到笔记分组「${note.group}」，可在笔记页预览排版或编辑 Markdown`);
      if (typeof setActiveTab === 'function') setActiveTab('notes');
    }
  });

  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input?.value || '');
  });

  input?.addEventListener('compositionstart', () => { composing = true; });
  input?.addEventListener('compositionend', () => { composing = false; });
  input?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || composing) return;
    event.preventDefault();
    sendMessage(input.value);
  });

  homeComposer?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (homeRoleSelect?.value && homeRoleSelect.value !== activeRoleId) {
      activeRoleId = homeRoleSelect.value;
      const roleSessions = sessions.filter((session) => session.roleId === activeRoleId);
      activeSessionId = roleSessions[0]?.id || '';
      persistState();
    }
    sendMessage(homeInput?.value || '');
  });

  homeRoleSelect?.addEventListener('change', () => {
    const roleId = homeRoleSelect.value;
    if (!roleId || roleId === activeRoleId) return;
    activeRoleId = roleId;
    const roleSessions = sessions.filter((session) => session.roleId === activeRoleId);
    activeSessionId = roleSessions[0]?.id || '';
    persistState();
    renderAll();
  });

  homeOpenButton?.addEventListener('click', () => {
    if (typeof setActiveTab === 'function') setActiveTab('chat');
  });

  loadState();
  if (!readJson(CHAT_ROLES_KEY, null)) writeJson(CHAT_ROLES_KEY, roles);
  persistState();
  renderAll();
  setStatus('流式输出已开启。单条可复制；用户消息可编辑后从此节点重发。');
})();
