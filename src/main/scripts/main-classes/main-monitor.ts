/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable import/no-cycle */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable class-methods-use-this */
import logger from '../../helpers/logger';
import MonitorManager from '../../managers/monitor-manager';

import { ITaskStatus, ITaskData } from '../../interfaces/index';

class MainMonitor {
  proxies: any;
  taskData: ITaskData;
  monitorManager: any;
  stopped: boolean;
  lastStatus: string;
  shopifySizes: { xxs: string[]; xs: string[]; s: string[]; m: string[]; l: string[]; xl: string[]; xxl: string[] };
  proxyErrors: RegExp;
  timeoutErrors: RegExp;
  constructor(taskData: ITaskData, proxies: any) {
    this.taskData = taskData;
    this.proxies = proxies;
    this.monitorManager = MonitorManager;
    this.stopped = false;
    this.lastStatus = '';
    this.shopifySizes = {
      xxs: ['xxs'],
      xs: ['xs', 'extra small'],
      s: ['s', 'small'],
      m: ['m', 'medium'],
      l: ['l', 'large'],
      xl: ['xl', 'extra large', 'x-large'],
      xxl: ['xxl'],
    };
    this.proxyErrors = /ECONNRESET|ENOTFOUND|ECONNREFUSED|EPROTO/;
    this.timeoutErrors = /Too many requests|Page temporarily unavailable|ESOCKETTIMEDOUT|ETIMEDOUT/;
  }
  stopMonitor() {
    this.stopped = true;
    this.log('warning', this.taskData.id, 'Monitor stopped');
  }
  // eslint-disable-next-line class-methods-use-this
  sendStatus(status: string, color: string, productName = null) {
    // if (this.lastStatus === status) {
    //   return;
    // }
    this.lastStatus = status;
    process.send({ type: 'task-status', id: this.taskData.id, status, color, productName });
  }
  sendToast(image, link, name, message, color) {
    process.send({ type: 'toast', toastData: { image, link, name, message, color } });
  }
  // eslint-disable-next-line class-methods-use-this
  pause(time: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, time);
    });
  }
  log(type: string, id: number, message: any) {
    logger[type](`[monitor-${id}]: ${message}`);
    process.send({ type: 'log-message', log: `[monitor-${id}]: ${message}` });
  }
  // eslint-disable-next-line consistent-return
  validateSupremeKeywords(title: string, keywords: Array<string>) {
    let positiveKeywords = 0;
    let keywordsFound = 0;
    for (let i = 0; i < keywords.length; i += 1) {
      const keyword = keywords[i];
      if (keyword.charAt(0) === '+') {
        positiveKeywords += 1;
        if (title.toLowerCase().includes(keyword.substr(1).toLowerCase())) {
          keywordsFound += 1;
        }
      } else if (title.toLowerCase().includes(keyword.substr(1).toLowerCase())) {
        return false;
      }
    }
    if (keywordsFound === positiveKeywords) {
      return true;
    }
  }
  // eslint-disable-next-line consistent-return
  validateShopifyKeywords(title: string, keywords: any) {
    let positiveKeywords = 0;
    let keywordsFound = 0;
    for (let i = 0; i < keywords.length; i += 1) {
      const keyword = keywords[i];
      if (keyword.indexOf('+') !== -1) {
        positiveKeywords += 1;
        if (
          title.indexOf(
            keyword
              .toLocaleLowerCase()
              .replace(/\+/, '')
              .trim(),
          ) !== -1
        ) {
          keywordsFound += 1;
        }
      } else if (keyword.indexOf('-') !== -1) {
        if (
          title.indexOf(
            keyword
              .toLocaleLowerCase()
              .replace(/-/, '')
              .trim(),
          ) !== -1
        ) {
          return false;
        }
      }
    }
    if (keywordsFound === positiveKeywords) {
      return true;
    }
  }
}
export default MainMonitor;
