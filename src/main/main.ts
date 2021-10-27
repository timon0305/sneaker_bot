import { autoUpdater } from 'electron-updater';
import { app, ipcMain as ipc, globalShortcut, shell, clipboard } from 'electron';
import _ from 'lodash';
import currentProcesses from 'current-processes';

import { v4 } from 'uuid';
import { version } from '../../package.json';
import { dashboard_url } from './config/setting.json';

import UserSession from './helpers/user-session';
import autoSolve from './harvester/autosolve';
import BrowserManager from './managers/browser-task-manager';
import windowManager from './helpers/main-window';
import profileManager from './managers/profile-manager';
import settingsManager from './managers/settings-manager';
import proxyManager from './managers/proxy-manager';
import taskManager from './managers/task-manager';
import apiManager from './managers/api-manager';
import accountPoolManager from './managers/account-pool-manager';
import shippingRateManager from './managers/shipping-rate-manager';
import analyticsManager from './managers/analytics-manager';
import harvesterManager from './managers/harvester-manager';
import captchaManager from './harvester/captcha-harvester';
import logsManager from './managers/logs-manager';
import * as DdSolver from '../../helpers/Datadome_Solveflow';

import { ITaskData } from './interfaces/index';
import mainWindow from './helpers/main-window';

if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = 'production';
const THREE_MINUTES = 180000;

function scanProcesses(): void {
  currentProcesses.get((err, processes) => {
    const sorted = _.sortBy(processes, 'cpu');
    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i].name.toLowerCase() === 'charles' || sorted[i].name.toLowerCase() === 'wireshark' || sorted[i].name.toLowerCase() === 'fiddler') {
        console.log('fuck out of here');
        app.quit();
      }
    }
  });
}
function checkProcesses(starting = false): void {
  if (process.env.NODE_ENV === 'development') return;
  try {
    // If the bot is starting we check every 3 minutes
    if (starting) {
      setInterval(() => {
        scanProcesses();
      }, THREE_MINUTES);
      // If it's not starting then we check whenever we make an api call, start task, etc
    } else {
      scanProcesses();
    }
  } catch (error) {
    console.log(error);
  }
}
const shouldNotQuit = app.requestSingleInstanceLock();
if (!shouldNotQuit) {
  app.quit();
}
app.on('ready', async () => {
  /*
   * Initialize profiles, settings, and proxies
   */
  profileManager.initProfiles();
  settingsManager.initSettings();
  accountPoolManager.initAccountPools();
  shippingRateManager.initShippingRates();
  analyticsManager.initAnalytics();
  proxyManager.initProxies();
  logsManager.initLogs();
  harvesterManager.initHarvesters();
  BrowserManager.createTaskWindow();

  if (process.env.NODE_ENV === 'development') {
    await windowManager.createMainWindow();
  } else {
    const key = settingsManager.getKey();
    if (!key || key === '') {
      checkProcesses(true);
      await windowManager.createAuthWindow();
    } else if (await apiManager.checkKey(key)) {
      checkProcesses(true);
      await windowManager.createMainWindow();
      try {
        await apiManager.keySession(key);
      } catch (error) {}
    } else {
      checkProcesses(true);
      await windowManager.createAuthWindow();
    }
  }

  // const key = settingsManager.getKey();
  // if (!key || key === '') {
  //   checkProcesses(true);
  //   await windowManager.createAuthWindow();
  // } else if (await apiManager.checkKey(key)) {
  //   checkProcesses(true);
  //   await windowManager.createMainWindow();
  //   try {
  //     createRichPresense();
  //     await apiManager.keySession(key);
  //   } catch (error) {}
  // } else {
  //   checkProcesses(true);
  //   await windowManager.createAuthWindow();
  // }
  autoSolve.setAutoSolve();
  autoSolve.initAutoSolve();

  globalShortcut.register('Alt+Q', () => {
    windowManager.showMain();
    windowManager.openQt();
  });
});
// Necessary for captcha auto click
app.commandLine.appendSwitch('disable-site-isolation-trials');

// Proxy Login Event
app.on('login', (event, webContents, request, authInfo, callback) => {
  const harvester = Object.values(captchaManager.captchaWindows).find((h) => h.proxy && h.proxy.proxyURL.includes(authInfo.host));
  event.preventDefault();
  callback(harvester.proxy.username, harvester.proxy.username);
});
app.on('activate', () => !windowManager && windowManager.createMainWindow());
app.on('window-all-closed', () => {
  app.exit();
  process.exit(0);
});
app.on('before-quit', (event) => {
  event.preventDefault();
  ipc.emit('quit');
});
ipc.on('show-me', () => windowManager.showMain());
ipc.on('quit', () => {
  UserSession.finishSession().then(() => {
    taskManager.stopAll();
    settingsManager.saveTasks();
    settingsManager.saveTasks();
    autoSolve.cancelAllTokenRequests();
    taskManager.killWorkers();
    app.exit();
    process.exit(0);
  });
});
ipc.on('minimize', () => windowManager.hideWindow());
ipc.on('maxamize', () => windowManager.maximize());

ipc.on('login-key', async (e, key) => {
  // await windowManager.createMainWindow();
  checkProcesses();
  if (await apiManager.activateKey(key)) {
    await windowManager.closeAuthWindow();
    settingsManager.setKey(key);
    await windowManager.createMainWindow();
    await apiManager.keySession(key);
  } else {
    windowManager.sendStatusToLogin('Key invalid or needs to be deactivated.');
  }
});

/**
 * CAPTCHA EVENTS
 */
ipc.on('addHarvester', async (e, data) => {
  await captchaManager.createWindow({
    harvesterName: data.harvesterName,
    harvesterType: data.harvesterType,
    harvesterID: v4(),
    proxy: data.proxy,
  });
});

ipc.on('delHarvester', async (e, harvester) => {
  harvesterManager.delHarvester(harvester);
});

ipc.on('setProxy', (e, harvester, proxy) => {
  captchaManager.setHarvesterProxy({
    name: harvester.harvesterName,
    type: harvester.harvesterType,
    proxy,
  });
});
ipc.on('openLogin', async (e, harvester) => {
  await captchaManager.launchLoginWindow({ name: harvester.harvesterName, type: harvester.harvesterType });
});
ipc.on('launchHarvester', (e, harvester) => {
  captchaManager.launchHarvester({ name: harvester.harvesterName, type: harvester.harvesterType });
});
/*
 * TASKS EVENTS
 */
ipc.on('task-created', (e, data: ITaskData) => taskManager.addTask(data));
ipc.on('start-task', async (e, data: ITaskData) => {
  checkProcesses();
  const profile = profileManager.getProfile(data.profile);
  const proxies = data.proxies !== 'localhost' ? proxyManager.getProxyGroup(data.proxies) : null;
  await taskManager.startTask(data.id, profile, proxies);
});
ipc.on('getTasks', () => settingsManager.sendTasks());

ipc.on('start-all-tasks', () => taskManager.startAll());
ipc.on('stop-all-tasks', async () => taskManager.stopAll());
ipc.on('stop-task', (e, data: ITaskData) => taskManager.stopTask(data.id));
ipc.on('delete-task', async (e, data: ITaskData) => taskManager.deleteTask(data.id));
ipc.on('edit-all-tasks', (e, data) => {
  taskManager.massEditAll(data);
});
ipc.on('task-edited', (e, taskData) => {
  taskManager.updateOneInactiveTask(taskData);
});

ipc.on('export-tasks', () => {
  settingsManager.exportTasks();
});
ipc.on('import-tasks', (e, filePath) => {
  settingsManager.importTasks(filePath);
});
/*
 * AUTO UPDATER
 */

async function updateCheck(): Promise<void> {
  autoUpdater.autoDownload = false;

  autoUpdater.checkForUpdates();
  const updateMessage = (message, err = null) => {
    if (err) {
      console.log(err);
      windowManager.sendUpdateMessage('update:anerror');
      return;
    }
    windowManager.sendUpdateMessage(message);
  };
  const available = (info) => {
    updateMessage('update:avail');
    setTimeout(() => {
      windowManager.sendUpdateMessage('update:showModal', info);
    }, 700);
  };
  autoUpdater.on('update-available', available);

  const notavailable = (info) => {
    updateMessage('update:not-avail');
    ipc.emit('update:ADecision', 'event', 'ignore');
  };
  autoUpdater.on('update-not-available', notavailable);

  const anerror = (err) => {
    updateMessage('update:anerror', err);
    ipc.emit('update:ADecision', 'event', 'ignore');
    ipc.emit('update:installDecision', 'event', 'ignore');
  };
  autoUpdater.on('error', anerror);

  const progression = (progressObj) => {
    const percent = Math.trunc(progressObj.percent);
    windowManager.sendUpdatePercent(percent);
    if (progressObj.percent === '100') autoUpdater.removeListener('download-progress', progression);
  };
  autoUpdater.on('download-progress', progression);

  ipc.once('update:ADecision', (e, decision) => {
    const actualDecision = decision || e;
    if (actualDecision === 'ignore') {
      autoUpdater.removeListener('update-available', available);
      autoUpdater.removeListener('update-not-available', notavailable);
      autoUpdater.removeListener('error', anerror);
      autoUpdater.removeListener('download-progress', progression);
    } else {
      autoUpdater.downloadUpdate();
      windowManager.sendUpdateMessage('update:downloading');
    }
  });

  ipc.once('update:installDecision', (e, decision) => {
    const actualDecision = decision || e;
    if (actualDecision === 'ignore') {
      autoUpdater.removeListener('update-available', available);
      autoUpdater.removeListener('update-not-available', notavailable);
      autoUpdater.removeListener('error', anerror);
      autoUpdater.removeListener('download-progress', progression);
    } else {
      taskManager.stopAll();
      settingsManager.saveTasks();
      autoSolve.cancelAllTokenRequests();
      autoUpdater.quitAndInstall();
      app.quit();
    }
  });

  const installation = () => {
    windowManager.sendUpdateDownloaded();
  };
  autoUpdater.on('update-downloaded', installation);
}

ipc.on('checkForUpdates', () => {
  checkProcesses();
  updateCheck();
});

/*
 * PROFILES EVENTS
 */
ipc.on('profile-created', (e, profileData) => profileManager.saveProfile(profileData));
ipc.on('getProfiles', () => profileManager.sendProfiles());
ipc.on('delete-profile', (e, index) => profileManager.deleteProfile(index));
ipc.on('update-profile', (e, profileData, index) => profileManager.updateProfile(profileData, index));
ipc.on('create-profile-group', (e, groupData) => profileManager.saveGroup(groupData));
ipc.on('delete-profile-group', (e, index) => profileManager.deleteGroup(index));
ipc.on('update-profile-group', (e, groupData, index) => profileManager.updateGroup(groupData, index));
ipc.on('import-profiles', (e, filePath) => profileManager.importProfiles(filePath));
ipc.on('export-profiles', () => profileManager.exportProfiles());

/*
 * SETTINGS EVENTS
 */
ipc.on('getFileData', () => {
  accountPoolManager.sendPools();
  shippingRateManager.sendRates();
  analyticsManager.sendAnalytics();
  harvesterManager.sendHarvesters();
});
ipc.on('get-settings', () => settingsManager.sendSettings());
ipc.on('send-test', (e, webhook) => settingsManager.sendTestWebhook(webhook));
ipc.on('set-settings', (e, data) => settingsManager.setSettings(data));
ipc.on('toggle-aycd', () => {
  settingsManager.toggleAutosolve();
});

/*
 * PROXY EVENTS
 */
ipc.on('get-proxies', () => proxyManager.sendProxies());
ipc.on('create-proxy-group', (e, data) => proxyManager.updateGroups(data));

/**
 * ACCOUNT POOLS EVENTS
 */
ipc.on('addAccountList', (e, newPool) => {
  accountPoolManager.updatePools(newPool);
});
ipc.on('editAccountList', (e, index, pool) => {
  accountPoolManager.editPool(index, pool);
});
ipc.on('deleteAccountList', (e, index) => {
  accountPoolManager.deletePool(index);
});

/**
 * SHIPPING RATE EVENTS
 */
ipc.on('addShippingRate', async (e, shippingRateData) => {
  await shippingRateManager.newShippingRate(shippingRateData);
});
ipc.on('editShippingRate', (e, index, shippingRateData) => {
  shippingRateManager.editShippingRate(index, shippingRateData);
});
ipc.on('deleteShippingRate', (e, index) => {
  shippingRateManager.deleteShippingRate(index);
});

ipc.on('clear-declines', () => {
  analyticsManager.clearDeclines();
});
/**
 * SETTINGS EVENTS
 */
ipc.on('send-logs', async (e, logId) => {
  clipboard.writeText(logId.toString());
  logsManager.sendLogs(logId);
});

ipc.on('deactivate', async () => {
  checkProcesses();
  apiManager.deactivateKey(settingsManager.getKey());
  settingsManager.setKey('');
  windowManager.closeMainWindow();
  ipc.emit('quit');
});

ipc.on('open-dash', () => {
  shell.openExternal(`${dashboard_url}`);
});

ipc.on('getAnalytics', () => {
  apiManager.getAnalytics(settingsManager.getKey());
});

ipc.on('shareSetup', (e, setupData) => {
  settingsManager.sendSetupWebhook(setupData);
});
