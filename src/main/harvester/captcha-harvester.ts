/* eslint-disable class-methods-use-this */
import { BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import express from 'express';
import { v4 } from 'uuid';
import { IWindowCreation, ICaptchaRequest } from '../interfaces/index';
import logger from '../helpers/logger';
import harvesterManager from '../managers/harvester-manager';
import taskManager from '../managers/task-manager';
import mainWindow from '../helpers/main-window';
import settingsManager from '../managers/settings-manager';
import autoSolve from './autosolve';

interface CaptchaHarvester {
  window?: BrowserWindow;
  harvesterID: string;
  harvesterType: string;
  harvesterName: string;
  blocked?: boolean;
  site?: string;
  proxy?: { username: string; password: string; proxyURL: string } | null;
  supremeHeadlessOnly?: boolean;
}
interface CaptchaWindows {
  [name: string]: CaptchaHarvester;
}

/**
 * TODO
 * - Send captcha token to task ✅
 * - Set harvester window proxy ✅
 * - Set login window proxy ✅
 * - Reset captcha window after a task is stopped when waiting for captcha
 * - Youtube/Google login in the same session ✅
 * - Check queue after creating a captcha window ✅
 */
class CaptchaManager {
  captchaWindows: CaptchaWindows;
  htmlPaths: { shopify: string; supreme: string; yeezy: string; shopifyCheckout: string };
  PROXY_BYPASS: string;
  proxyRules: { shopify: string; supreme: string; yeezy: string; shopifyCheckout: string };
  captchaServer: any;
  captchaQueues: { shopify: ICaptchaRequest[]; shopifyCheckout: ICaptchaRequest[]; supreme: ICaptchaRequest[] };
  PROXY_PORTS: { SHOPIFY: number; YEEZY: number; SUPREME: number };
  htmlPathsByPort: { 5875: string; 5877: string; 5876: string };
  windowAgent: string;
  constructor() {
    this.PROXY_PORTS = {
      SHOPIFY: 5875,
      YEEZY: 5876,
      SUPREME: 5877,
    };
    this.PROXY_BYPASS = '*unpkg.com;*google.com*;*youtube.com*;*gstatic.com*';
    this.captchaWindows = {};
    this.windowAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36';
    this.htmlPaths = {
      shopify: path.join(__dirname, 'shopify.html'),
      shopifyCheckout: path.join(__dirname, 'shopify.html'),
      supreme: path.join(__dirname, 'supreme.html'),
      yeezy: path.join(__dirname, 'yeezy.html'),
    };
    this.htmlPathsByPort = {
      5875: this.htmlPaths.shopify,
      5876: this.htmlPaths.yeezy,
      5877: this.htmlPaths.supreme,
    };
    this.proxyRules = {
      shopify: `http=127.0.0.1:${this.PROXY_PORTS.SHOPIFY}`,
      shopifyCheckout: `http=127.0.0.1:${this.PROXY_PORTS.SHOPIFY}`,
      supreme: `http=127.0.0.1:${this.PROXY_PORTS.SUPREME}`,
      yeezy: `http=127.0.0.1:${this.PROXY_PORTS.YEEZY}`,
    };
    this.captchaQueues = {
      shopify: [],
      shopifyCheckout: [],
      supreme: [],
    };
    this.createServers();
    this.setListeners();
  }
  /**
   * Creates a captcha window
   * @param windowData Object containing harvester ID, name, and type
   */
  async createWindow(windowData: IWindowCreation): Promise<void> {
    const windowOptions = {
      width: 400,
      height: 600,
      resizable: false,
      webPreferences: {
        allowRunningInsecureContent: true,
        nodeIntegration: true,
        session: session.fromPartition(`persist:captcha-session-${windowData.harvesterID}`),
        webSecurity: false,
      },
      show: false,
      frame: windowData.harvesterType === 'shopify',
    };
    this.captchaWindows[windowData.harvesterID] = {
      window: new BrowserWindow(windowOptions),
      harvesterID: windowData.harvesterID,
      harvesterName: windowData.harvesterName,
      harvesterType: windowData.harvesterType,
      proxy: windowData.proxy,
      blocked: false,
    };

    const { window } = this.captchaWindows[windowData.harvesterID];
    await window.webContents.session.setProxy({
      proxyRules: this.proxyRules[windowData.harvesterType],
      pacScript: '',
      proxyBypassRules: this.PROXY_BYPASS,
    });
    await window.webContents.loadFile(this.htmlPaths[windowData.harvesterType]);
    window.webContents.send('harvester-set-values', {
      loadingCaptcha: false,
      name: this.captchaWindows[windowData.harvesterID].harvesterName,
      type: this.captchaWindows[windowData.harvesterID].harvesterType,
      harvesterID: windowData.harvesterID,
    });
    window.on('close', (event) => {
      event.preventDefault();
      window.hide();
    });
    harvesterManager.addHarvester({
      harvesterID: windowData.harvesterID,
      harvesterName: windowData.harvesterName,
      harvesterType: windowData.harvesterType,
      proxy: windowData.proxy,
    });
    this.checkQueue();
  }
  async replaceCaptchaWindow(parentWindow: BrowserWindow, replacedHarvester: CaptchaHarvester) {
    const newWindow = new BrowserWindow({
      width: 400,
      height: 600,
      resizable: false,
      webPreferences: {
        allowRunningInsecureContent: true,
        nodeIntegration: true,
        session: session.fromPartition(`new-session-${v4()}`),
        webSecurity: false,
      },
      show: false,
      frame: false,
      parent: parentWindow,
    });
    this.captchaWindows[replacedHarvester.harvesterID].window = newWindow;
    this.captchaWindows[replacedHarvester.harvesterID].supremeHeadlessOnly = true;
    const { window } = this.captchaWindows[replacedHarvester.harvesterID];
    await window.webContents.session.setProxy({
      proxyRules: this.proxyRules[replacedHarvester.harvesterType],
      pacScript: '',
      proxyBypassRules: this.PROXY_BYPASS,
    });
    await window.webContents.loadFile(this.htmlPaths[replacedHarvester.harvesterType]);
    window.webContents.send('harvester-set-values', {
      loadingCaptcha: false,
      name: this.captchaWindows[replacedHarvester.harvesterID].harvesterName,
      type: this.captchaWindows[replacedHarvester.harvesterID].harvesterType,
      harvesterID: replacedHarvester.harvesterID,
    });
  }
  /**
   * Creates proxy server for captcha harvesters
   */
  createServers(): void {
    const { SHOPIFY } = this.PROXY_PORTS;
    const { SUPREME } = this.PROXY_PORTS;
    const { YEEZY } = this.PROXY_PORTS;

    const supremeServer = express();
    const shopifyServer = express();
    const yeezyServer = express();

    supremeServer.get('/*', (req, res) => res.sendFile(this.htmlPathsByPort[SUPREME]));
    supremeServer
      .listen(SUPREME, () => {
        logger.success('Supreme captcha server running');
      })
      .on('error', (error) => {
        console.log(error);
      });

    shopifyServer.get('/*', (req, res) => res.sendFile(this.htmlPathsByPort[SHOPIFY]));
    shopifyServer
      .listen(SHOPIFY, () => {
        logger.success('Shopify captcha server running');
      })
      .on('error', (error) => {
        console.log(error);
      });

    yeezyServer.get('/*', (req, res) => res.sendFile(this.htmlPathsByPort[YEEZY]));
    yeezyServer
      .listen(YEEZY, () => {
        // logger.success('Yeezy captcha server running');
      })
      .on('error', (error) => {
        console.log(error);
      });
  }
  /**
   * Gets a harvester with name as reference
   * @param name Harvester name
   */
  getHarvesterWithName(name: string): CaptchaHarvester {
    return Object.values(this.captchaWindows).find((h) => h.harvesterName === name);
  }
  /**
   * Checks if a proxy is in a valid format
   * @param proxy Proxy to be checked
   */
  validateProxy(proxy: string): boolean {
    if (!proxy) return false;
    const validation = /\b((?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?):\d{2,5}(:\w+:\w+)?\b/;
    if (proxy.match(validation) === null) {
      return false;
    }
    return true;
  }
  /**
   * Checks captcha types queue and calls captcha method
   */
  checkQueue(): void {
    const queues = Object.values(this.captchaQueues);
    queues.forEach(async (queue) => {
      const captchaRequest = queue.shift();
      if (typeof captchaRequest !== 'undefined') {
        console.log('Loading captcha from queue');
        await this.getCaptcha(captchaRequest);
      }
    });
  }
  /**
   * Requests a captcha
   * @param captchaRequest Captcha request containing sitekey, site, captcha type, etc
   */
  async getCaptcha(captchaRequest: ICaptchaRequest): Promise<void> {
    // console.log(settingsManager.autoSolveActive());
    if (settingsManager.autoSolveActive()) {
      autoSolve.sendTokenRequest(captchaRequest);
      return;
    }
    if (captchaRequest.datadome) {
      await this.getDatadomeCaptcha(captchaRequest);
    }
    // First we get an array of available windows with the same harvester type being requested
    const availableWindows = Object.values(this.captchaWindows).filter((harvester) => !harvester.blocked && captchaRequest.harvesterType === harvester.harvesterType);
    // If there are are any available windows
    if (availableWindows.length > 0) {
      // Second we try to find a window with the same site
      let harvester = availableWindows.find((w) => w.site === captchaRequest.site);
      if (typeof harvester === 'undefined') {
        [harvester] = availableWindows;
      }
      // We block the window and set the site it's solving for
      harvester.blocked = true;
      harvester.site = captchaRequest.site;
      if (!harvester.window.isVisible()) {
        harvester.window.show();
      }
      if (captchaRequest.harvesterType === 'shopify') {
        await this.loadCheckpoint(harvester, captchaRequest);
        return;
      }
      if (new URL(harvester.window.webContents.getURL()).host !== new URL(captchaRequest.site).host) {
        // If the harvester site is not the same then we have to reload the harvester window
        await this.getCaptchaReload(harvester, captchaRequest);
        return;
      }
      // If the sites are the same then we call the captcha without reloading the harvester window
      await this.getCaptchaNormal(harvester, captchaRequest);
    } else {
      // logger.warning(`Captcha request for: ${captchaRequest.site} queued`);
      // If there are no available windows we push the captcha request to the captcha type queue
      this.captchaQueues[captchaRequest.harvesterType].push(captchaRequest);
    }
  }
  /**
   * Requests a captcha and reloads the site
   * @param harvester Captcha harvester
   * @param captchaRequest Captcha request containing sitekey, site, captcha type, etc
   */
  async getCaptchaReload(harvester: CaptchaHarvester, captchaRequest: ICaptchaRequest): Promise<void> {
    const proxyURL = await harvester.window.webContents.session.resolveProxy(harvester.window.webContents.getURL());
    if (proxyURL !== 'DIRECT' && proxyURL !== this.proxyRules[harvester.harvesterType]) {
      await harvester.window.webContents.session.setProxy({
        proxyRules: this.proxyRules[harvester.harvesterType],
      });
    }
    harvester.window.focus();
    harvester.window.webContents.loadURL(harvester.site, { userAgent: this.windowAgent }).then(async () => {
      if (harvester.proxy && harvester.proxy.proxyURL) {
        await harvester.window.webContents.session.setProxy({
          proxyRules: harvester.proxy.proxyURL,
        });
      }
      // Sends name and harvester type after reloading the harvester window
      harvester.window.webContents.send('harvester-set-values', {
        loadingCaptcha: true,
        name: harvester.harvesterName,
        type: harvester.harvesterType,
        harvesterID: harvester.harvesterID,
        taskID: captchaRequest.taskID,
        sitekey: captchaRequest.sitekey,
        specialSession: captchaRequest.session,
      });
      harvester.window.webContents.send('harvester-load-captcha', captchaRequest);
    });
  }
  /**
   * Requests a captcha without reloading the site
   * @param harvester Captcha harvester
   * @param captchaRequest Captcha request containing sitekey, site, captcha type, etc
   */
  async getCaptchaNormal(harvester: CaptchaHarvester, captchaRequest: ICaptchaRequest): Promise<void> {
    harvester.window.focus();
    if (harvester.proxy && harvester.proxy.proxyURL) {
      await harvester.window.webContents.session.setProxy({
        proxyRules: harvester.proxy.proxyURL,
      });
    }
    harvester.window.webContents.send('harvester-set-values', {
      loadingCaptcha: true,
      name: harvester.harvesterName,
      type: harvester.harvesterType,
      harvesterID: harvester.harvesterID,
      taskID: captchaRequest.taskID,
      sitekey: captchaRequest.sitekey,
      specialSession: captchaRequest.session,
    });
    harvester.window.webContents.send('harvester-load-captcha', captchaRequest);
  }
  async getDatadomeCaptcha(captchaRequest: ICaptchaRequest): Promise<void> {
    console.log('getting datadomee captcha');
    const availableWindows = Object.values(this.captchaWindows).filter((harvester) => !harvester.blocked && harvester.harvesterType === 'shopifyCheckout');
    if (availableWindows.length > 0) {
      const [harvester] = availableWindows;
      harvester.blocked = true;
      if (!harvester.window.isVisible()) {
        harvester.window.show();
      }
      await harvester.window.webContents.loadURL(captchaRequest.site);
      harvester.window.moveTop();
      harvester.window.focus();
      // If the harvester has a proxy
      if (harvester.proxy && harvester.proxy.proxyURL) {
        await harvester.window.webContents.session.setProxy({
          proxyRules: harvester.proxy.proxyURL,
        });
      }
      // Set harvester values
      harvester.window.webContents.send('harvester-set-values', {
        loadingCaptcha: true,
        name: harvester.harvesterName,
        type: harvester.harvesterType,
        harvesterID: harvester.harvesterID,
        taskID: captchaRequest.taskID,
        sitekey: captchaRequest.sitekey,
        datadomeSolver: true,
      });
      harvester.window.webContents.send('harvester-load-captcha', captchaRequest);
    } else {
      this.captchaQueues[captchaRequest.harvesterType].push(captchaRequest);
    }
  }
  async loadCheckpoint(harvester: CaptchaHarvester, captchaRequest: ICaptchaRequest): Promise<void> {
    let loadedFrame = false;
    // Remove our harvesting local proxy
    await harvester.window.webContents.session.setProxy({
      proxyRules: '',
      pacScript: '',
      proxyBypassRules: '',
    });
    captchaRequest.cookies.forEach(async (cookie) => {
      await harvester.window.webContents.session.cookies.set({
        name: cookie.key,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        url: captchaRequest.site,
      });
    });
    harvester.window.webContents.loadURL(captchaRequest.site.replace(/http/, 'https'), { userAgent: this.windowAgent }).then(async () => {
      harvester.window.webContents.on('did-frame-finish-load', async () => {
        if (loadedFrame) return;
        loadedFrame = true;
        await harvester.window.webContents.executeJavaScript(`
            const {remote, ipcRenderer} = require('electron');
            const responseInput = document.querySelector('.g-recaptcha-response');
            const taskID = ${captchaRequest.taskID};
            const waitingLoop = setInterval(() => {
              if (responseInput && responseInput.value) {
                document.querySelector('#main > div > div > div > form > p > button').click();
                // ipcRenderer.send('manual-checkpoint-captcha-solved', {token: responseInput.value, cookies: document.cookie, taskID, harvesterID: '${harvester.harvesterID}'});
                clearInterval(waitingLoop);
              }
            }, 333);
        `);
      });
      harvester.window.webContents.on('will-redirect', async (event, url) => {
        const cookies = await harvester.window.webContents.session.cookies.get({});
        console.log(url);
        console.log(cookies);
        event.preventDefault();
      });
    });
  }
  /**
   * Opens a child login window under the harvester session
   * @param harvester Captcha harvester
   */
  async openLoginWindow(harvester: CaptchaHarvester): Promise<void> {
    const loginWindow = new BrowserWindow({
      title: 'Youtube login',
      resizable: true,
      width: 500,
      height: 500,
      show: false,
      webPreferences: {
        session: session.fromPartition(`persist:captcha-session-${this.getHarvesterWithName(harvester.harvesterName).harvesterID}`),
      },
    });
    loginWindow.once('ready-to-show', () => {
      loginWindow.show();
      loginWindow.focus();
    });
    await loginWindow.loadURL(
      'https://accounts.google.com/signin/v2/identifier?hl=en&service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Ffeature%3Dsign_in_button%26hl%3Den%26app%3Ddesktop%26next%3D%252F%26action_handle_signin%3Dtrue&passive=true&uilel=3&flowName=GlifWebSignIn&flowEntry=ServiceLogin',
      { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:58.0) Gecko/20100101 Firefox/58.0' },
    );
    if (harvester.proxy && harvester.proxy.proxyURL) {
      harvester.window.webContents.session.setProxy({
        proxyRules: harvester.proxy.proxyURL,
      });
    }
  }
  /**
   * Creates harvesters from saved harvester file
   * @param harvesters Array with captcha harvester objects
   */
  loadHarvesters(harvesters: CaptchaHarvester[]): void {
    harvesters.forEach(async (harvester) => {
      await this.createWindow({
        harvesterID: harvester.harvesterID,
        harvesterName: harvester.harvesterName,
        harvesterType: harvester.harvesterType,
        proxy: harvester.proxy,
      });
    });
  }
  /**
   * Set electron ipc listeners to get captcha position and send token
   */
  setListeners(): void {
    ipcMain.on('harvester-send-token', (e, captchaResponse) => {
      if (captchaResponse.datadomeSolver) {
        this.captchaWindows[captchaResponse.harvesterID].blocked = false;
        ipcMain.emit(`datadome-solved-${captchaResponse.taskID}`, {
          token: captchaResponse.token,
          taskID: captchaResponse.taskID,
        });
        this.checkQueue();
        return;
      }
      const taskID = `${captchaResponse.taskID}`;
      const task = taskManager.tasks[taskID];
      this.captchaWindows[captchaResponse.harvesterID].blocked = false;
      taskManager.sendCaptcha(task.pid, captchaResponse.taskID, captchaResponse.token);
      this.checkQueue();
    });
    ipcMain.on('manual-checkpoint-captcha-solved', async (e, captchaResponse) => {
      const taskID = `${captchaResponse.taskID}`;
      const task = taskManager.tasks[taskID];
      const harvesterID = captchaResponse.harvesterID.split("'")[0];
      this.captchaWindows[harvesterID].blocked = false;
      await this.captchaWindows[harvesterID].window.webContents.session.setProxy({
        proxyRules: this.proxyRules.shopify,
        pacScript: '',
        proxyBypassRules: this.PROXY_BYPASS,
      });
      await this.captchaWindows[harvesterID].window.webContents.loadFile(this.htmlPaths.shopify);
      this.captchaWindows[harvesterID].window.webContents.send('harvester-set-values', {
        loadingCaptcha: false,
        name: this.captchaWindows[harvesterID].harvesterName,
        type: this.captchaWindows[harvesterID].harvesterType,
        harvesterID,
      });
      taskManager.sendCaptcha(task.pid, captchaResponse.taskID, captchaResponse.token, captchaResponse.cookies);
      this.checkQueue();
    });
    ipcMain.on('harvester-captcha-position', (e, harvesterID) => {
      const { window } = this.captchaWindows[harvesterID];
      const bounds = window.getBounds();
      e.returnValue = bounds;
    });
    ipcMain.on('harvester-unblock', (e, harvesterID) => {
      this.captchaWindows[harvesterID].blocked = false;
    });
    ipcMain.on('datadome-captcha', async (captchaData) => {
      console.log('get datadome captcha');
      await this.getDatadomeCaptcha(captchaData as any);
    });
  }
  /**
   * Launches a Harvester
   * @param data Harvester name and type
   */
  launchHarvester(data: { name: string; type: string }): void {
    const harvester = this.getHarvesterWithName(data.name);
    if (harvester.harvesterType === data.type) {
      harvester.window.show();
    }
  }
  /**
   * Launches a Harvester login window
   * @param data Harvester name and type
   */
  async launchLoginWindow(data: { name: string; type: string }): Promise<void> {
    const harvester = this.getHarvesterWithName(data.name);
    if (harvester.harvesterType === data.type) {
      await this.openLoginWindow(harvester);
    }
  }
  /**
   * Set a proxy for a harvester window
   * @param data Harvester name and type
   */
  setHarvesterProxy(data: { name: string; type: string; proxy: string }): void {
    const harvester = this.getHarvesterWithName(data.name);
    if (!this.validateProxy(data.proxy)) {
      // If there is already a proxy set and we receive an empty proxy then we erase de proxy
      if (harvester.proxy && harvester.proxy.proxyURL) {
        if (!data.proxy) {
          this.captchaWindows[harvester.harvesterID].proxy = {
            proxyURL: '',
            username: '',
            password: '',
          };
        }
        harvesterManager.updateHarvester(this.captchaWindows[harvester.harvesterID]);
        return;
      }
      mainWindow.sendNotif({ title: 'Uh oh!', message: 'Invalid proxy.', color: 'red' });
      return;
    }
    const splittedProxy = data.proxy.split(':');
    const { 0: domain, 1: port } = splittedProxy;
    this.captchaWindows[harvester.harvesterID].proxy = {
      proxyURL: `http=${domain}:${port}`,
      username: '',
      password: '',
    };
    if (splittedProxy.length === 4) {
      // That means we got user:pass
      const { 2: username, 3: password } = splittedProxy;
      this.captchaWindows[harvester.harvesterID].proxy.username = username;
      this.captchaWindows[harvester.harvesterID].proxy.password = password;
    }
    harvesterManager.updateHarvester(this.captchaWindows[harvester.harvesterID]);
    mainWindow.sendNotif({ title: 'Success', message: `New proxy set for ${data.name}`, color: 'blue' });
  }
  /**
   * Stops and removes and active captcha in a harvester solving for the received task id
   * @param taskID Task ID
   */
  stopHarvesting(taskID: number): void {
    Object.values(this.captchaWindows).forEach((harvester) => {
      harvester.window.webContents.send('harvester-stop-captcha', taskID);
    });
  }
}

export default new CaptchaManager();
