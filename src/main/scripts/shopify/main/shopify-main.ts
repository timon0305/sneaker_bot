/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import _ from 'underscore';
import MainBot from '../../main-classes/main-bot';

import ShopifyRequests from './shopify-requests';
import ShopifyMonitor from './shopify-monitor';
import { ITaskData, IProfile } from '../../../interfaces/index';
// import monitorManager from '../../../managers/monitor-manager';

class ShopifyMain extends MainBot {
  taskData: ITaskData;
  profile: IProfile;
  refreshRate: any;
  requests: ShopifyRequests;
  FIVE_MINUTES: number;
  // monitor: ShopifyMonitor;
  constructor(taskData: ITaskData, profile: IProfile, proxies) {
    super(taskData, proxies);
    this.taskData = taskData;
    this.profile = profile;
    this.proxies = proxies;

    this.requests = new ShopifyRequests(taskData, proxies);
    this.FIVE_MINUTES = 300000;

    // this.monitor = monitorManager.getMonitor(this.taskData.id);
  }
  refreshCheckoutUrl(url: string): void {
    if (this.refreshRate) {
      clearInterval(this.refreshRate);
    }
    this.refreshRate = setInterval(async () => {
      try {
        await this.requests.getChromeHeaders(url, null);
      } catch (error) {
        this.log('fatal', this.taskData.id, `Error refreshing checkout url, ${error}`);
      }
    }, this.FIVE_MINUTES);
  }
  // eslint-disable-next-line class-methods-use-this
  randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  // eslint-disable-next-line class-methods-use-this
  shopifyUrlEncoded(obj, keys = true) {
    const string = Object.keys(obj)
      .map((k) => `${encodeURIComponent(k)}=${keys ? encodeURIComponent(obj[k]) : ''}`)
      .join('&');
    string
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/%20/g, '+')
      .replace(/%2520/g, '+');
    return string;
  }
  // eslint-disable-next-line class-methods-use-this
  getAccountFromPool(accountPool: string[]): string[] {
    const randomAccount = accountPool[Math.floor(Math.random() * accountPool.length)];
    return randomAccount.split(':');
  }
}
export default ShopifyMain;
