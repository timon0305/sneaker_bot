/* eslint-disable class-methods-use-this */
import monitorManager from '../../managers/monitor-manager';
import noMonitor from '../../helpers/no-monitor';
import taskColors from '../../helpers/task-colors';
import logger from '../../helpers/logger';

import { ITaskStatus, ITaskData, ICaptchaRequest, IWebhook, IDatadomeRequest } from '../../interfaces/index';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
class MainBot {
  taskData: ITaskData;
  stopped: boolean;
  proxies: any;
  lastStatus: string;
  proxyErrors: RegExp;
  timeoutErrors: RegExp;
  harvesterTypes: { shopify: string; supreme: string; shopifyCheckout: string };
  constructor(taskData: ITaskData, proxies: any) {
    this.taskData = taskData;
    this.proxies = proxies;
    this.stopped = false;
    this.proxyErrors = /ECONNRESET|ENOTFOUND|ECONNREFUSED|EPROTO/;
    this.timeoutErrors = /Too many requests|Page temporarily unavailable|ESOCKETTIMEDOUT|ETIMEDOUT/;
    this.harvesterTypes = {
      shopify: 'shopify',
      supreme: 'supreme',
      shopifyCheckout: 'shopifyCheckout',
    };
  }
  // eslint-disable-next-line class-methods-use-this
  sendStatus(status: string, color: string, productName = null): void {
    // We dont need to keep sending a status if the last status is the same as the last one
    if (this.lastStatus === status && !productName) {
      return;
    }
    this.lastStatus = status;
    process.send({ type: 'task-status', id: this.taskData.id, status, color, productName });
  }
  getFormattedDate(): string {
    const date = new Date();
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }
  /**
   * @param sendStatus Set to true when the task is being deleted
   */
  stopTask(sendStatus: boolean): void {
    this.stopped = true;
    if (sendStatus) {
      this.sendStatus('Stopped', taskColors.red);
    }
    this.log('warning', this.taskData.id, 'Task stopped');
    if (!noMonitor[this.taskData.siteType]) monitorManager.stopMonitor(this.taskData.id, this.taskData, this.proxies);
    this.cancelCaptcha(this.taskData.id);
  }
  // eslint-disable-next-line class-methods-use-this
  pause(time: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, time);
    });
  }
  // eslint-disable-next-line class-methods-use-this
  log(type: string, id: number, message: any): void {
    logger[type](`[task-${id}]: ${message}`);
    process.send({ type: 'log-message', log: `[task-${id}]: ${message}` });
  }
  saveCheckout(checkout: object): void {
    process.send({ type: 'save-checkout', checkout });
  }
  getCaptchaToken(captchaData: ICaptchaRequest): void {
    process.send({ type: 'get-captcha', captchaData });
  }
  getSolvedDatadome(datadomeData: IDatadomeRequest): void {
    process.send({ type: 'get-datadome', datadomeData });
  }
  cancelCaptcha(taskID: number): void {
    process.send({ type: 'cancel-captcha', taskID });
  }
  sendWebhook(webhookData: IWebhook): void {
    process.send({ type: 'webhook', webhookData });
  }
  sendNewTaskObject(taskData: ITaskData): void {
    process.send({ type: 'new-task-object', taskData });
  }
  sendLogs(text: string): void {
    process.send({ type: 'save-logs', text });
  }
  sendPaypalData(jar: any, paypalUrl: string, profile: string, size: string, region: string): void {
    process.send({ type: 'new-paypal-window', jar, paypalUrl, profile, size, region, taskID: this.taskData.id });
  }
  sendToast(image, link, name, message, color): void {
    process.send({ type: 'toast', toastData: { image, link, name, message, color } });
  }
  updateTask(newData): void {
    // If current task id matches one of the ids wanted
    if (newData.specificIds.map(String).indexOf(this.taskData.id.toString()) !== -1) {
      this.lastStatus = '';
      monitorManager.resetLastStatus(this.taskData.id);
      // Promise.resolve(this.pause());
      // All tasks monitor delay
      if (newData.monitorDelay && !newData.siteType) {
        logger.warning(`Changing all delays: ${newData.monitorDelay}`);
        this.taskData.monitorDelay = parseInt(newData.monitorDelay, 10);
        this.sendNewTaskObject(this.taskData);
      }
      // All tasks keywords
      if (newData.monitorInput && newData.monitorType === 'keywords' && !newData.siteType) {
        this.taskData.monitorInput = newData.monitorInput;
        this.sendNewTaskObject(this.taskData);
      }
      // All tasks sizes
      if (newData.sizes && !newData.siteType) {
        this.taskData.sizes = newData.sizes;
        this.sendNewTaskObject(this.taskData);
      }
      // Checkout delay is only needed for supreme
      if (newData.checkoutDelay && this.taskData.siteType === 'supreme') {
        logger.warning(`Changed all supreme checkout delays to: ${newData.checkoutDelay}`);
        this.taskData.checkoutDelay = newData.checkoutDelay;
        this.sendNewTaskObject(this.taskData);
      }
      // Shopify mass edit handler
      if (newData.siteType && newData.siteType.includes('shopify')) {
        if (newData.monitorInput && newData.monitorType === 'url' && (this.taskData.siteType === 'shopify-safe' || this.taskData.siteType === 'shopify-advanced')) {
          const currentSiteHost = new URL(this.taskData.site).host;
          const newSiteHost = new URL(newData.monitorInput).host;
          // Only change if the new url belongs to the same site
          if (currentSiteHost === newSiteHost) {
            logger.warning(`Changing all ${currentSiteHost} tasks to url: ${newData.monitorInput}`);
            this.taskData.monitorInput = newData.monitorInput;
            this.taskData.monitorType = newData.monitorType;
            monitorManager.editShopifyUrl(this.taskData.id, newData.monitorInput);
            this.sendNewTaskObject(this.taskData);
          }
        } else if (newData.monitorInput && newData.monitorType === 'variant' && (this.taskData.siteType === 'shopify-safe' || this.taskData.siteType === 'shopify-advanced')) {
          logger.warning(`Changing all shopify tasks to variant: ${newData.monitorInput}`);
          this.taskData.monitorInput = newData.monitorInput;
          this.taskData.monitorType = 'variant';
          monitorManager.editShopifyVariant(this.taskData.id);
          this.sendNewTaskObject(this.taskData);
        } else if (newData.monitorInput && newData.monitorType === 'keywords' && (this.taskData.siteType === 'shopify-safe' || this.taskData.siteType === 'shopify-advanced')) {
          console.log('updating shopifu keywords');
          const keywords = newData.monitorInput.split(',');
          this.taskData.monitorInput = keywords;
          this.taskData.monitorType = 'keywords';
          this.sendNewTaskObject(this.taskData);
        }
        // Only change delays for shopify
        if (newData.monitorDelay && (this.taskData.siteType === 'shopify-safe' || this.taskData.siteType === 'shopify-advanced')) {
          logger.warning(`Changing all shopify delays to: ${newData.monitorDelay}`);
          this.taskData.monitorDelay = parseInt(newData.monitorDelay, 10);
          this.sendNewTaskObject(this.taskData);
        }
        // Only change sizes for shopify
        if (newData.sizes && (this.taskData.siteType === 'shopify-safe' || this.taskData.siteType === 'shopify-advanced')) {
          this.taskData.sizes = newData.sizes;
          this.sendNewTaskObject(this.taskData);
        }
      }
      // Supreme mass edit handler
      if (newData.siteType && newData.siteType.includes('supreme') && this.taskData.siteType === 'supreme') {
        // If mass edit is only keywords
        if (newData.monitorInput && newData.monitorType === 'keywords') {
          const keywords = newData.monitorInput.split(',');
          this.taskData.monitorInput = keywords;
          this.sendNewTaskObject(this.taskData);
        }
        // Only change delays for supreme
        if (newData.monitorDelay && this.taskData.siteType === 'supreme') {
          logger.warning(`Changing all supreme delays to: ${newData.monitorDelay}`);
          this.taskData.monitorDelay = parseInt(newData.monitorDelay, 10);
          this.sendNewTaskObject(this.taskData);
        }
        // Only change sizes for supreme
        if (newData.sizes && this.taskData.siteType === 'supreme') {
          this.taskData.sizes = newData.sizes;
          this.sendNewTaskObject(this.taskData);
        }
      }
    }
  }
}
export default MainBot;
