const assert = require('node:assert/strict');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

async function main() {
  await app.whenReady();
  const window = new BrowserWindow({
    width: 200,
    height: 38,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
  });

  try {
    await window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    window.show();
    window.focus();
    window.webContents.focus();
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const focusStyle = await window.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const notch = document.getElementById('notch');
        requestAnimationFrame(() => {
          const notchStyle = getComputedStyle(notch);
          const dotStyle = getComputedStyle(notch.querySelector('.notch-dot'));
          resolve({
            active: document.activeElement === notch,
            focusVisible: notch.matches(':focus-visible'),
            outlineStyle: notchStyle.outlineStyle,
            outlineWidth: notchStyle.outlineWidth,
            dotBoxShadow: dotStyle.boxShadow,
          });
        });
      })
    `);

    assert.equal(focusStyle.active, true, '折叠条应能通过键盘获得焦点');
    assert.equal(focusStyle.focusVisible, true, '键盘焦点应保持可见提示');
    assert.equal(
      focusStyle.outlineStyle,
      'none',
      `折叠外壳不能画焦点描边，当前为 ${focusStyle.outlineWidth} ${focusStyle.outlineStyle}`
    );
    assert.notEqual(focusStyle.dotBoxShadow, 'none', '焦点提示应转移到中间抓握条');
  } finally {
    window.destroy();
  }
}

main().then(
  () => app.quit(),
  (error) => {
    console.error(error);
    app.exit(1);
  }
);
