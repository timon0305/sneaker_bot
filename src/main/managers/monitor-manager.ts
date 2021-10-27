/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */
import logger from '../helpers/logger';

import SupremeMonitor from '../scripts/supreme/supreme-monitor';
import ShopifyMonitor from '../scripts/shopify/main/new-monitor';

import { ITaskData } from '../interfaces/index';

interface MonitorManager {
  monitors: any;
}
const monitors = {
  'shopify-advanced': {
    create(data: ITaskData, proxies: any): ShopifyMonitor {
      return new ShopifyMonitor(data, proxies);
    },
  },
  'shopify-safe': {
    create(data: ITaskData, proxies: any): ShopifyMonitor {
      return new ShopifyMonitor(data, proxies);
    },
  },
  supreme: {
    create(data: ITaskData, proxies: any): SupremeMonitor {
      return new SupremeMonitor(data, proxies);
    },
  },
};
class MonitorManager implements MonitorManager {
  monitors: any;
  constructor() {
    this.monitors = {};
  }
  createMonitor(site: string, taskData: ITaskData, proxies: any): void {
    if (!monitors[site]) {
      logger.fatal(`Monitor for site ${site} doesnt exist`);
      return;
    }
    if (this.monitors[taskData.id]) {
      // logger.info(`Created another monitor for: ${site}, attached to task: ${taskData.id}`);
      // delete this.monitors[taskData.id];
      this.monitors[taskData.id] = monitors[site].create(taskData, proxies);
      return;
    }
    this.monitors[taskData.id] = monitors[site].create(taskData, proxies);
    // logger.info(`Created monitor for: ${site}, attached to task: ${taskData.id}`);
  }
  // eslint-disable-next-line consistent-return
  getMonitor(taskID: number): any {
    return this.monitors[taskID];
  }
  getAllMonitors(): any {
    return this.monitors;
  }
  stopMonitor(taskID: number, taskData: ITaskData, proxies: any): void {
    this.monitors[taskID].stopMonitor();
    this.monitors[taskID] = monitors[taskData.siteType].create(taskData, proxies);
  }
  resetLastStatus(taskID): void {
    this.monitors[taskID].lastStatus = '';
  }
  // Only used for shopify
  editShopifyUrl(taskID, url): void {
    this.monitors[taskID].productURL = url;
  }
  editShopifyVariant(taskID): void {
    this.monitors[taskID].setMonitorMode();
  }
}
export default new MonitorManager();
