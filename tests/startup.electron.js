const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, screen } = require('electron');
const windowLayers = new WeakMap();
const setAlwaysOnTop = BrowserWindow.prototype.setAlwaysOnTop;
BrowserWindow.prototype.setAlwaysOnTop = function (flag, level, ...args) {
  windowLayers.set(this, { flag, level });
  return setAlwaysOnTop.call(this, flag, level, ...args);
};
const profile = process.env.TODO_TEST_USER_DATA;
app.commandLine.appendSwitch('user-data-dir', profile);
// The production bootstrap may inspect encrypted legacy settings on this Mac.
// Use Chromium's test keychain so a regression test never prompts for user keys.
if (process.platform === 'darwin') app.commandLine.appendSwitch('use-mock-keychain');
fs.writeFileSync(path.join(profile, 'workspace.json'), JSON.stringify({version:1, localStorage:{
  'notch-home-note':'Recovered workspace note',
  'notch-recordings':JSON.stringify([{id:'startup-recording',createdAt:1788709776699,durationMs:1558,transcript:'',audioPath:'recordings/retained.webm',mimeType:'audio/webm',title:'Saved recording',category:'未分类'}]),
}}));
const errors = [];
setTimeout(() => { console.error('Production startup timed out', errors); app.exit(1); }, 25000);
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (details) => {
    if (details.level === 'error') errors.push(`${details.message} (${details.sourceId}:${details.lineNumber})`);
  });
  contents.once('did-finish-load', () => {
    if (!contents.getURL().endsWith('/renderer/index.html')) return;
    setTimeout(async () => {
      try {
        const state = await contents.executeJavaScript(`({home:!!window.NotchHome,workspace:!!window.NotchWorkspace,note:document.getElementById('home-note').value,recordings:document.querySelectorAll('.recording-item').length})`);
        assert.deepEqual(errors, []);
        assert.deepEqual(state, {home:true,workspace:true,note:'Recovered workspace note',recordings:1});
        console.log('Production workspace recovery checks passed');
        if (process.platform === 'darwin') {
          const window = BrowserWindow.fromWebContents(contents);
          assert.deepEqual(windowLayers.get(window), { flag: true, level: 'screen-saver' });
          for (const mode of ['expanded', 'collapsed', 'expanded']) {
            await contents.executeJavaScript(`window.notchAPI.setMode(${JSON.stringify(mode)})`);
            const bounds = window.getBounds();
            const display = screen.getDisplayMatching(bounds);
            assert.equal(window.isAlwaysOnTop(), true);
            assert.deepEqual(windowLayers.get(window), {
              flag: true, level: mode === 'expanded' ? 'floating' : 'screen-saver',
            });
            assert.equal(bounds.y, mode === 'expanded' ? display.workArea.y : display.bounds.y);
            if (mode === 'expanded') assert.ok(bounds.y + bounds.height <= display.workArea.y + display.workArea.height);
          }
          console.log('Production Mac panel layer and menu-bar clearance checks passed');
        }
        app.quit();
      } catch (error) { console.error(error); app.exit(1); }
    }, 2000);
  });
});
require('../main.js');
