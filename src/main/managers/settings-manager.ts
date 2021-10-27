import * as path from 'path';
import * as fs from 'fs';
import { app, shell, dialog } from 'electron';
import rp from 'request-promise-native';
import { version } from '../../../package.json';
import mainWindow from '../helpers/main-window';
import taskManager from '../managers/task-manager';
import { admin_webhook, icon_url } from '../config/setting.json';
import { IWebhook } from '../interfaces/index';
import { all } from 'q';

const userDataPath = app.getPath('userData');
const adminHook = admin_webhook;
const successHook = admin_webhook;

let allSettings: any = {
  key: '',
  webhook: '',
  qtSizes: ['random'],
  qtProfiles: ['Example'],
  qtMonitorDelay: 2500,
  qtCheckoutDelay: 1500,
  qtProxyList: 'localhost',
  sendDeclines: true,
  tasks: [],
  qtNumTasks: 5,
  qtSupremeRegion: 'US',
  qtShippingRate: '',
  asAccessToken: '',
  asAPIkey: '',
  useAutoSolve: false,
  userAvatar: '',
  username: '',
};
const settingsFile = path.join(userDataPath, 'settings.json');

/**
 * Gets the saved settings
 */
function getSettings(): void {
  const settingsString = fs.readFileSync(settingsFile).toString();
  const settingsConfig = JSON.parse(settingsString);
  allSettings = { ...settingsConfig };
  if (allSettings.tasks.length > 0) {
    const { tasks } = allSettings;
    tasks.forEach((task) => {
      taskManager.addTask(task);
    });
  }
}

function getKey(): string {
  return allSettings.key ? allSettings.key : '';
}

/**
 * Initializes settings file. If it doesnt exist, it makes one.
 */
function initSettings(): void {
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(
      settingsFile,
      JSON.stringify({
        key: '',
        webhook: '',
        qtSizes: ['random'],
        qtProfiles: ['Example'],
        qtMonitorDelay: 2500,
        qtCheckoutDelay: 1500,
        qtProxyList: 'localhost',
        sendDeclines: true,
        tasks: [],
        qtNumTasks: 5,
        qtSupremeRegion: 'US',
        asAccessToken: '',
        asAPIkey: '',
        useAutoSolve: false,
      }),
      'utf8',
    );
    console.log('Created settings file');
  } else {
    getSettings();
  }
}

function setSettings(newSettings): void {
  allSettings.webhook = newSettings.webhook;
  allSettings.sendDeclines = newSettings.sendDeclines;
  allSettings.qtProfiles = newSettings.qtProfiles;
  allSettings.qtSizes = newSettings.qtSizes;
  allSettings.qtProxyList = newSettings.qtProxyList;
  allSettings.qtMonitorDelay = newSettings.qtMonitorDelay;
  allSettings.qtCheckoutDelay = newSettings.qtCheckoutDelay;
  allSettings.qtShippingRate = newSettings.qtShippingRate;
  allSettings.qtNumTasks = newSettings.qtNumTasks;
  allSettings.qtSupremeRegion = newSettings.qtSupremeRegion;
  allSettings.asAccessToken = newSettings.asAccessToken;
  allSettings.asAPIkey = newSettings.asAPIkey;
  allSettings.useAutoSolve = newSettings.useAutoSolve;
  fs.writeFileSync(settingsFile, JSON.stringify(allSettings), 'utf8');
  mainWindow.sendAutosaveMessage();
}

function setKey(key): void {
  allSettings.key = key;
  fs.writeFileSync(settingsFile, JSON.stringify(allSettings), 'utf8');
}

function setUserData(data): void {
  allSettings.userAvatar = data.photo_url;
  allSettings.username = data.username;
  fs.writeFileSync(settingsFile, JSON.stringify(allSettings), 'utf8');
}

function sendSettings(): void {
  mainWindow.sendSettings(allSettings);
}
function exportTasks(): void {
  const tasks = [];
  let index = 0;
  Object.keys(taskManager.tasks).map((id) => {
    tasks.push(taskManager.tasks[id]);
    delete tasks[index].active;
    delete tasks[index].pid;
    delete tasks[index].status;
    delete tasks[index].color;
    index += 1;
  });

  const tasksFileData = { tasks };

  const options = {
    title: 'Save Tasks',
    defaultPath: 'tasks.json',
    buttonLabel: 'Save Tasks',
    filters: [{ name: '.json', extensions: ['json'] }],
  };

  dialog.showSaveDialog(options).then((filename) => {
    fs.writeFileSync(filename.filePath, JSON.stringify(tasksFileData), 'utf-8');
  });
}
function importTasks(filePath): void {
  const openFile = fs.readFileSync(filePath, 'utf8');
  const tasksFile = JSON.parse(openFile);
  const { tasks } = tasksFile;
  tasks.forEach((task) => {
    taskManager.addTask(task);
  });
  mainWindow.sendTasks(tasks);
}
function saveTasks(): void {
  const tasks = [];
  Object.keys(taskManager.tasks).map((id) => {
    delete taskManager.tasks[id].active;
    delete taskManager.tasks[id].pid;
    delete taskManager.tasks[id].status;
    delete taskManager.tasks[id].color;
    tasks.push(taskManager.tasks[id]);
  });
  allSettings.tasks = tasks;
  fs.writeFileSync(settingsFile, JSON.stringify(allSettings), 'utf8');
}
function autoSolveActive(): boolean {
  if (allSettings.asAccessToken && allSettings.asAPIkey && allSettings.useAutoSolve) {
    return true;
  }
  return false;
}
function toggleAutosolve(): void {
  if (allSettings.useAutoSolve === true) {
    allSettings.useAutoSolve = false;
  } else {
    allSettings.useAutoSolve = true;
  }
}
// eslint-disable-next-line consistent-return
function getAutoSolveKeys(): { accesToken: string; apiKey: string } {
  if (allSettings.asAccessToken && allSettings.asAPIkey) {
    return { accesToken: allSettings.asAccessToken, apiKey: allSettings.asAPIkey };
  }
  return null;
}
async function sendTasks(): Promise<void> {
  mainWindow.sendTasks(allSettings.tasks);
}

async function sendTestWebhook(testHook): Promise<void> {
  const embeds = [
    {
      title: 'Test webhook!',
      color: 3984990,
      description: `${new Date().toLocaleString()}`,
      author: {
        name: 'Sole Destroyer | Test Webhook',
        // url: 'https://discordapp.com',
        icon_url: icon_url,
      },
      footer: {
        text: `Sole Destroyer v${version}`,
        icon_url: icon_url,
      },
    },
  ];
  const options = {
    method: 'POST',
    uri: testHook,
    json: {
      username: allSettings.username !== '' ? allSettings.username : 'Sole',
      avatar_url: allSettings.username !== '' ? allSettings.userAvatar : icon_url,
      embeds,
    },
  };
  try {
    await rp(options);
  } catch (error) {}
}
function buildEmbed(webhookData: IWebhook, admin = false): any {
  const embeds = [
    {
      color: webhookData.purchaseType === 'decline' ? 13515836 : webhookData.purchaseType === '3ds' ? 2674860 : 3984990,
      description: `${!admin ? new Date().toLocaleString() : new Date().toUTCString()}`,
      author: {
        name: `Heliox AIO | ${webhookData.purchaseType === 'decline' ? 'Purchase Declined ❌' : webhookData.purchaseType === '3ds' ? 'Waiting 3DS Comfirmation ⏱️' : 'Purchase Success ✔️'}`,
        // url: 'https://discordapp.com',
        icon_url: 'https://i.ibb.co/dmjd1Xq/Unicorn-Face-1-F984.png',
      },
      footer: {
        text: `Heliox AIO v${version}`,
        icon_url: 'https://i.ibb.co/dmjd1Xq/Unicorn-Face-1-F984.png',
      },
      thumbnail: {
        url: webhookData.image ? webhookData.image : null,
      },
      fields: [
        {
          name: 'Product',
          value: `${webhookData.productName}`,
          inline: false,
        },
        {
          name: 'Site',
          value: `${webhookData.site}`,
          inline: true,
        },
        {
          name: 'Profile',
          value: `||${webhookData.profile}||`,
          inline: true,
        },
        {
          name: 'Size',
          value: `${webhookData.size}`,
          inline: true,
        },
        {
          name: 'Mode',
          value: `${webhookData.mode}`,
          inline: true,
        },
        {
          name: 'Price',
          value: `${webhookData.price}`,
          inline: true,
        },
      ],
    },
  ];
  if (webhookData.color && webhookData.color !== '') {
    embeds[0].fields.push({ name: 'Color', inline: true, value: webhookData.color });
  }
  if (webhookData.purchaseType === 'bankPayment') {
    embeds[0].fields.push({
      name: 'URGENT: Payment URL',
      inline: false,
      value: `[Click here to proceed to payment!](${webhookData.paymentURL})`,
    });
  }
  if (admin) {
    embeds[0].fields.push({ name: 'Reason', inline: true, value: webhookData.admin ? webhookData.admin : 'None' });
    embeds[0].fields.push({ name: 'User', inline: false, value: `||${allSettings.key ? allSettings.key : 'None'}||` });
  }

  return {
    username: 'Heliox',
    avatar_url: 'https://i.imgur.com/pxxznJG.png',
    embeds,
  };
}
async function sendAdminWebhook(webhookData: IWebhook): Promise<void> {
  const options = {
    method: 'POST',
    uri: adminHook,
    json: buildEmbed(webhookData, true),
  };
  try {
    await rp(options);
  } catch (error) {
    console.log(error.message);
  }
  if (webhookData.purchaseType === 'success') {
    options.uri = successHook;
    try {
      await rp(options);
    } catch (error) {
      console.log(error.message);
    }
  }
}
async function sendWebhook(webhookData: IWebhook): Promise<void> {
  if (!allSettings.webhook || !allSettings.sendDeclines) {
    await sendAdminWebhook(webhookData);
    return;
  }
  const options = {
    method: 'POST',
    uri: allSettings.webhook,
    json: buildEmbed(webhookData),
  };
  try {
    await rp(options);
    await sendAdminWebhook(webhookData);
  } catch (error) {
    console.log(error.message);
  }
}

async function sendSetupWebhook(setupData): Promise<void> {
  const embeds = [
    {
      title: 'Success Setup',
      color: 3653359,
      author: {
        name: 'Sole Destroyer',
        icon_url: icon_url,
      },
      footer: {
        text: `Sole Destroyer v${version}`,
        icon_url: icon_url,
      },
      thumbnail: {
        url: setupData.item.imageUrl,
      },
      fields: [
        {
          name: 'Product',
          value: `${setupData.item.name}`,
          inline: false,
        },
        {
          name: 'Site',
          value: `${setupData.item.site}`,
          inline: false,
        },
        {
          name: 'Mode',
          value: `${setupData.details.task.mode}`,
          inline: false,
        },
        {
          name: 'Monitor Input',
          value: `${setupData.details.task.monitorInput}`,
          inline: false,
        },
        {
          name: 'Monitor Delay',
          value: `${setupData.details.task.monitorDelay}`,
          inline: false,
        },
        {
          name: 'Error Delay',
          value: `${setupData.details.task.errorDelay}`,
          inline: false,
        },
      ],
    },
  ];
  const options = {
    method: 'POST',
    uri: admin_webhook,
    json: {
      username: allSettings.username !== '' ? allSettings.username : 'Sole',
      avatar_url: allSettings.username !== '' ? allSettings.userAvatar : icon_url,
      embeds,
    },
  };
  try {
    await rp(options);
    // await sendAdminWebhook(webhookData);
  } catch (error) {
    console.log(error.message);
  }
}

export default {
  initSettings,
  allSettings,
  setSettings,
  sendSettings,
  sendTestWebhook,
  sendWebhook,
  getAutoSolveKeys,
  toggleAutosolve,
  autoSolveActive,
  getKey,
  saveTasks,
  sendTasks,
  setKey,
  setUserData,
  exportTasks,
  importTasks,
  sendSetupWebhook,
};
