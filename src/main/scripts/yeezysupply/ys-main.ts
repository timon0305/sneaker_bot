import path from 'path';
import moment from 'moment';
import { BrowserWindow, session } from 'electron';

import { ITaskData, IProfile } from '../../interfaces/index';
import MainBot from '../main-classes/main-bot';

import { CHROME_VERSIONS } from './constants';
import utils from './utils';

function getProductId(taskData: ITaskData): string {
  const url = taskData.monitorInput;
  return url.split('/')[4];
}

class YeezySupplyBot extends MainBot {
  window: BrowserWindow;
  profile: IProfile;
  visible: boolean;
  chromeVersion: string;
  taskSetup: any;
  constructor(taskData: ITaskData, profile: IProfile, proxies: any) {
    super(taskData, proxies);
    this.window = null;
    this.profile = profile;
    this.visible = false;
  }

  async startTask(): Promise<void> {
    const timestamp = moment()
      .unix()
      .toString(10);
    const self = this;
    this.window = new BrowserWindow({
      width: 550,
      height: 750,
      resizable: true,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: false,
        enableRemoteModule: false,
        session: session.fromPartition(timestamp),
        preload: path.join(__dirname, 'preload/ys-preload.js'),
      },
      show: false,
    });

    this.setUserAgent();

    this.window.on('page-title-updated', function(e) {
      self.window.webContents.send('setInitValues', self.profile, self.taskData.id, getProductId(self.taskData));
      e.preventDefault();
    });

    this.switchToProxy();

    this.window.on('close', (event) => {
      event.preventDefault();
      this.window.hide();
    });

    this.window.webContents.openDevTools();

    this.window.loadURL(this.taskData.monitorInput as string);
    // this.window.loadURL('https://recaptcha-demo.appspot.com/recaptcha-v3-request-scores.php');
  }

  setUserAgent(): void {
    let userAgent = '';
    const platform = process.platform;
    if (platform === 'darwin') {
      userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.64 Safari/537.36';
    } else if (platform === 'win32') {
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.64 Safari/537.36';
    }
    if (userAgent) this.window.webContents.setUserAgent(userAgent);
  }

  switchToProxy(): void {
    if (this.proxies && this.proxies.proxies && this.proxies.proxies.length > 0) {
      const proxyList = this.proxies.proxies;
      const proxyUrl = proxyList[utils.randomInt(0, proxyList.length - 1)];
      const proxyConfig = utils.parseProxyUrl(proxyUrl);
      this.window.webContents.session.setProxy({
        proxyRules: proxyConfig.proxyAddress,
        pacScript: null,
        proxyBypassRules: null,
      });
      this.window.webContents.proxy = {
        username: proxyConfig.proxyUser,
        password: proxyConfig.proxyPassword,
      };
      this.window.setTitle(this.chromeVersion + ': ' + proxyConfig.proxyPassword);
      this.sendLogs(`Switched to proxy: ${proxyConfig.proxyPassword}`);
    }
    this.window.webContents.send('proxySwitched');
  }

  async stopTask(): Promise<void> {
    this.window.destroy();
    this.log('warning', this.taskData.id, 'Task stopped');
  }

  async deleteTask(): Promise<void> {
    this.window.destroy();
    this.log('warning', this.taskData.id, 'Task deleted');
  }

  sendLogs(text: string): void {
    if (text) console.log(`${this.taskData.id}: ${text}`);
  }
}
export default YeezySupplyBot;
