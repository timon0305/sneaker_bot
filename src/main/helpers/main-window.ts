import * as path from 'path';
import * as url from 'url';
import { BrowserWindow, dialog, ipcMain, app } from 'electron';

import settingsManager from '../managers/settings-manager';
import taskManager from '../managers/task-manager';

let mainWindow: BrowserWindow;
let authWindow: BrowserWindow;
const sentToasts = [];
async function createAuthWindow(): Promise<void> {
  authWindow = new BrowserWindow({
    width: 700,
    height: 400,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
    },
    maxHeight: 400,
    maxWidth: 700,
    minHeight: 400,
    minWidth: 700,
  });

  authWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, '/authwindow/auth.html'),
      protocol: 'file',
      slashes: true,
    }),
  );
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1290,
    height: 726,
    minWidth: 1290,
    minHeight: 726,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.resolve(__dirname, '..', 'renderer-preload.js'),
    },
    show: false,
  });

  mainWindow.setMenu(null);
  // mainWindow.webContents.openDevTools();

  if (process.env.NODE_ENV !== 'production') {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1';
    await mainWindow.loadURL('http://localhost:2003');
  } else {
    await mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '..', '..', 'index.html'),
        protocol: 'file:',
        slashes: true,
      }),
    );
  }
  mainWindow.on('close', () => {
    ipcMain.emit('quit');
  });
}

function showMain(): void {
  mainWindow.show();
}

function closeMainWindow(): void {
  mainWindow.hide();
  ipcMain.emit('quit');
}

async function sendStatus(id, status, color): Promise<void> {
  mainWindow.webContents.send('updateTask', { id, status, color });
}
async function sendStatusWithName(id, status, color, productName): Promise<void> {
  mainWindow.webContents.send('updateTask', {
    id,
    status,
    color,
    productName,
  });
}

async function sendToast(toastData): Promise<void> {
  if (sentToasts.includes(toastData.name)) return;
  sentToasts.push(toastData.name);
  mainWindow.webContents.send('productMessage', toastData);
}

async function sendNotif(notifData): Promise<void> {
  mainWindow.webContents.send('notifyMessage', notifData);
}

async function sendProfiles(profiles, groups): Promise<void> {
  mainWindow.webContents.send('sendProfiles', profiles, groups);
}

async function sendSettings(settings): Promise<void> {
  mainWindow.webContents.send('sendSettings', settings);
}

async function sendProxies(proxies): Promise<void> {
  mainWindow.webContents.send('sendProxies', proxies);
}

async function closeAuthWindow(): Promise<void> {
  authWindow.hide();
  authWindow = null;
}

function hideWindow(): void {
  mainWindow.minimize();
}

function maximize(): void {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
}

async function sendUpdateMessage(message, info = null): Promise<void> {
  mainWindow.webContents.send(message, info);
  if (message === 'update:avail') {
    setTimeout(async () => {
      const options = {
        buttons: ['Yes', 'No'],
        defaultId: 0,
        title: 'New AIO Update',
        message: 'Would you like to download the new  AIO update?',
        detail: 'Please note that if you click No, the new update will still be installed after you quit  AIO.',
        icon: path.join(__dirname, '..', '..', 'renderer/assets/logo.png'),
      };
      const dialogResult = await dialog.showMessageBox(mainWindow, options);
      if (dialogResult.response === 0) {
        ipcMain.emit('update:ADecision', 'download');
      } else {
        ipcMain.emit('update:ADecision', 'ignore');
        mainWindow.webContents.send('update:reset');
      }
    }, 1200);
  }
}

async function sendUpdatePercent(message): Promise<void> {
  mainWindow.webContents.send('update:percent', message);
}

async function sendUpdateDownloaded(): Promise<void> {
  mainWindow.webContents.send('update:downloaded');
  setTimeout(async () => {
    const options = {
      buttons: ['Yes', 'No'],
      defaultId: 0,
      title: 'New ',
      message: 'An updated version of AIO has been downloaded. Would you like to quit and install now?',
      detail: 'Please note that if you click No, the new update will still be installed after you quit  AIO.',
      icon: path.join(__dirname, '..', '..', 'renderer/assets/logo.png'),
    };
    const dialogResult = await dialog.showMessageBox(mainWindow, options);
    if (dialogResult.response === 0) {
      ipcMain.emit('update:installDecision', 'install');
    } else {
      ipcMain.emit('update:installDecision', 'ignore');
      mainWindow.webContents.send('update:reset');
    }
  }, 1200);
}

async function sendStatusToLogin(message): Promise<void> {
  authWindow.webContents.send('loginMessage', message);
}

function sendTasks(tasks): void {
  mainWindow.webContents.send('sendTasks', tasks);
}

function openQt(): void {
  mainWindow.webContents.send('quickTask');
}

function sendAccountPools(accounts): void {
  mainWindow.webContents.send('updateAccountPools', accounts);
}

function sendShippingRates(rates): void {
  mainWindow.webContents.send('updateShippingRates', rates);
}
function sendNewTaskData(taskData, fromMassEdit): void {
  console.log('update task in front end');
  mainWindow.webContents.send('massEditTask', taskData, fromMassEdit);
}

function sendAnalytics(analytics): void {
  mainWindow.webContents.send('updateAnalytics', analytics);
}

function sendHarvesters(harvesters): void {
  // console.log(harvesters);
  mainWindow.webContents.send('setHarvesters', harvesters);
}
function sendAnalyticsData(analytics): void {
  mainWindow.webContents.send('sendAnalytics', analytics);
}

function importProfiles(profiles, groups): void {
  mainWindow.webContents.send('importProfiles', profiles, groups);
}

function sendCheckoutCout(): void {
  console.log('sending checkout count');
  mainWindow.webContents.send('countCheckout');
}
function sendDisconnectMessage(): void {
  mainWindow.webContents.send('disconnect-bot');
}

function sendAutosaveMessage(): void {
  mainWindow.webContents.send('send-autosave');
}

export default {
  createMainWindow,
  sendStatus,
  sendProfiles,
  sendSettings,
  sendProxies,
  sendStatusWithName,
  hideWindow,
  maximize,
  createAuthWindow,
  closeAuthWindow,
  sendUpdateMessage,
  sendUpdatePercent,
  sendUpdateDownloaded,
  sendCheckoutCount: sendCheckoutCout,
  sendStatusToLogin,
  sendTasks,
  sendToast,
  sendNotif,
  showMain,
  openQt,
  sendAccountPools,
  sendShippingRates,
  sendAnalytics,
  sendHarvesters,
  sendAnalyticsData,
  sendNewTaskData,
  importProfiles,
  closeMainWindow,
  sendDisconnectMessage,
  sendAutosaveMessage,
};
