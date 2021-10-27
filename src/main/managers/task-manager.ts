/* eslint-disable no-case-declarations */
/* eslint-disable no-await-in-loop */
import os from 'os';
import * as cp from 'child_process';
import * as path from 'path';

import mainWindow from '../helpers/main-window';

import BrowserManager from './browser-task-manager';
import profileManager from './profile-manager';
import captchaManager from '../harvester/captcha-harvester';
import settingsManager from './settings-manager';
import analyticsManager from './analytics-manager';
import logsManager from './logs-manager';
import { IProfile, ITaskData, IDatadomeRequest } from '../interfaces/index';
import proxyManager from './proxy-manager';
import logger from '../helpers/logger';
import paypalWindows from '../helpers/paypal-windows';
import taskColors from '../helpers/task-colors';
import apiManager from './api-manager';
import UserSession from '../helpers/user-session';
import DatadomeSolver from '../helpers/Datadome_Solveflow';

class TaskManager {
  tasks: any;
  editedTasks: any;
  workers: any;
  shopifyModes: Array<string>;
  browserManager: any;
  scheduledTasks: any;
  constructor() {
    this.tasks = {};
    this.editedTasks = {};
    this.scheduledTasks = {};
    this.workers = [];
    this.shopifyModes = ['shopify-advanced', 'shopify-safe'];
    this.browserManager = BrowserManager;
    this.initWorkers();
    this.initWorkerListeners();
  }
  // eslint-disable-next-line class-methods-use-this
  pause(time: number): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }
  initWorkerListeners(): void {
    this.workers.forEach((worker) => {
      worker.process.on('message', async (message) => {
        switch (message.type) {
          case 'task-status':
            if (message.productName) {
              mainWindow.sendStatusWithName(message.id, message.status, message.color, message.productName);
              return;
            }
            mainWindow.sendStatus(message.id, message.status, message.color);
            break;
          case 'get-captcha':
            await captchaManager.getCaptcha(message.captchaData);
            break;
          case 'cancel-captcha':
            captchaManager.stopHarvesting(message.taskID);
            break;
          case 'get-datadome':
            const datadomeRequest: IDatadomeRequest = message.datadomeData;
            const DatadomeHandler = new DatadomeSolver(
              datadomeRequest.apiKey,
              datadomeRequest.DatadomeCookie,
              datadomeRequest.body,
              datadomeRequest.proxi,
              datadomeRequest.Domain,
              datadomeRequest.Debug,
              datadomeRequest.taskID,
            );
            const taskWorker = this.getWorker(this.tasks[datadomeRequest.taskID].pid);
            const response = await DatadomeHandler.Solve();
            if (response !== 'error') {
              taskWorker.process.send({ type: 'send-datadome', cookie: response, taskID: datadomeRequest.taskID });
            } else {
              taskWorker.process.send({
                type: 'send-datadome',
                cookie: response,
                taskID: datadomeRequest.taskID,
                banned: true,
              });
            }
            break;
          case 'webhook':
            settingsManager.sendWebhook(message.webhookData);
            break;
          case 'toast':
            mainWindow.sendToast(message.toastData);
            break;
          case 'new-task-object':
            // eslint-disable-next-line no-case-declarations
            const taskPID = this.tasks[message.taskData.id].pid;
            this.tasks[message.taskData.id] = { ...message.taskData, pid: taskPID, active: true };
            this.editedTasks[message.taskData.id] = { ...message.taskData, pid: taskPID, active: true };
            mainWindow.sendNewTaskData(this.tasks[message.taskData.id], true);
            break;
          case 'log-message':
            logsManager.logMessage(message.log);
            break;
          case 'save-checkout':
            analyticsManager.updateAnalytics(message.checkout);
            await apiManager.addCheckout(message.checkout);
            break;
          case 'new-paypal-window':
            paypalWindows.createWindow(message.jar, message.profile, message.size, message.region, message.paypalUrl, message.taskID);
            break;
          default:
            logger.fatal(`Couldnt find message: ${message}`);
            break;
        }
      });
    });
  }

  // Create all worker processes
  initWorkers(): void {
    for (let i = 0; i < os.cpus().length; i += 1) {
      const process = cp.fork(path.join(__dirname, '../managers/process-task-manager.js'));
      this.workers.push({ pid: process.pid, taskCount: 0, process });
    }
  }
  async killWorkers(): Promise<void> {
    await this.workers.forEach((worker) => {
      process.kill(worker.pid);
    });
  }

  // Gets the worker with the least amount of tasks
  getSmallestWorker(): any {
    let smallest = this.workers[0];
    for (let i = 0; i < this.workers.length; i += 1) {
      const worker = this.workers[i];
      if (worker.taskCount < smallest.taskCount) smallest = worker;
    }
    return smallest;
  }

  // Get worker by PID
  getWorker(pid: number): any {
    return this.workers.find((worker) => worker.pid === pid);
  }

  // Start task by ID
  async startTask(id: number, profile, proxies: any): Promise<void> {
    if (this.tasks[id].active) {
      return;
    }
    const task = this.tasks[id];
    if (task.isScheduled) {
      logger.info(`Started timer for task: ${id}`);
      this.scheduledTasks[id] = { waiting: true };
      await this.scheduleTask(id);
    }
    if (this.tasks[id].siteType === 'supreme' && this.tasks[id].headlessMode) {
      await this.browserManager.startTask(task, profile, proxies);
      this.tasks[task.id] = { ...this.tasks[task.id], active: true };
    } else {
      const worker = this.getSmallestWorker();
      worker.taskCount += 1;
      // await this.pause(100);
      worker.process.send({ type: 'start-task', taskData: task, profile, proxies });
      this.tasks[task.id] = { ...this.tasks[task.id], pid: worker.pid, active: true };
      mainWindow.sendStatus(task.id, 'Starting', '#ffde46');
    }
    UserSession.activateUser(settingsManager.getKey());
  }

  // Stop task by ID
  stopTask(id): void {
    if (this.tasks[id].siteType === 'supreme' && this.tasks[id].headlessMode) {
      BrowserManager.stopTask(this.tasks[id]);
      this.tasks[id].active = false;
      return;
    }
    if (this.scheduledTasks[id] && this.scheduledTasks[id].waiting) {
      this.scheduledTasks[id].waiting = false;
    }
    if (!this.tasks[id].active) return;
    const worker = this.getWorker(this.tasks[id].pid ? this.tasks[id].pid : this.editedTasks[id].pid);
    worker.process.send({ type: 'stop-task', id, sendStatus: true });
    worker.taskCount -= 1;
    this.tasks[id].active = false;
  }
  deleteTask(id): void {
    if (!this.tasks[id].active) {
      delete this.tasks[id];
      return;
    }
    this.tasks[id].active = false;
    if (this.tasks[id].siteType === 'supreme' && this.tasks[id].headlessMode) {
      this.browserManager.deleteTask(this.tasks[id]);
    } else {
      const worker = this.getWorker(this.tasks[id].pid);
      worker.process.send({ type: 'stop-task-no-status', id });
      worker.taskCount -= 1;
    }
    logger.warning(`Deleted task: ${id}`);
    delete this.tasks[id];
  }

  // Start all tasks
  startAll(): void {
    Object.keys(this.tasks).forEach((id) => {
      const profile = profileManager.getProfile(this.tasks[id].profile);
      const proxyGroup = this.tasks[id].proxies !== 'localhost' ? proxyManager.getProxyGroup(this.tasks[id].proxies) : null;
      this.startTask(parseInt(id, 10), profile, proxyGroup);
    });
  }

  // Add task
  addTask(task: ITaskData): void {
    this.tasks[task.id] = task;
  }

  // Stop all tasks
  async stopAll(): Promise<void> {
    Object.keys(this.tasks).forEach(async (id) => {
      await this.stopTask(id);
    });
  }
  sendCaptcha(pid: number, taskID: number, token: string, cookies = null): void {
    const worker = this.getWorker(pid);
    worker.process.send({ type: 'send-captcha', token, taskID, cookies });
  }
  massEditAll(newData): void {
    Object.keys(this.tasks).forEach((id) => {
      this.massEdit(id, newData);
    });
  }
  massEdit(id, newData): void {
    // If its not active then only change the task object and return
    if (!this.tasks[id].active) {
      this.editInactiveTask(id, newData);
      mainWindow.sendNewTaskData(this.tasks[id], true);
      return;
    }
    const worker = this.getWorker(this.tasks[id].pid);
    worker.process.send({ type: 'mass-edit-all', id, newData });
  }
  updateTaskObject(newTaskData): void {
    const taskPID = this.tasks[newTaskData.id].pid;
    this.tasks[newTaskData.id] = { ...newTaskData, pid: taskPID, active: true };
    mainWindow.sendNewTaskData(this.tasks[newTaskData.id], false);
  }
  updateOneInactiveTask(taskData: ITaskData): void {
    this.tasks[taskData.id] = { ...taskData };
  }
  // Used when we mass edit but the task is not active yet
  editInactiveTask(id, newData): void {
    // All tasks monitor delay
    if (newData.specificIds.map(String).includes(id.toString())) {
      if (newData.monitorDelay && !newData.siteType) {
        this.tasks[id].monitorDelay = parseInt(newData.monitorDelay, 10);
      }
      if (newData.monitorInput && newData.monitorType === 'keywords' && !newData.siteType) {
        this.tasks[id].monitorInput = newData.monitorInput;
      }
      if (newData.sizes && !newData.siteType) {
        this.tasks[id].sizes = newData.sizes;
      }
      // Checkout delay is only needed for supreme
      if (newData.checkoutDelay && this.tasks[id].siteType === 'supreme') {
        logger.warning(`Changed all supreme checkout delays to: ${newData.checkoutDelay}`);
        this.tasks[id].checkoutDelay = newData.checkoutDelay;
      }
      // Shopify mass edit handler
      if (newData.siteType && newData.siteType.includes('shopify') && this.tasks[id].siteType.includes('shopify')) {
        if (newData.monitorInput && newData.monitorType === 'url' && this.tasks[id].siteType.includes('shopify')) {
          const currentSiteHost = new URL(this.tasks[id].site).host;
          const newSiteHost = new URL(newData.monitorInput).host;
          // Only change if the new url belongs to the same site
          if (currentSiteHost === newSiteHost) {
            logger.warning(`Changing all ${currentSiteHost} tasks to url: ${newData.monitorInput}`);
            this.tasks[id].monitorInput = newData.monitorInput;
            this.tasks[id].monitorType = newData.monitorType;
          }
        } else if (newData.monitorInput && newData.monitorType === 'variant' && this.tasks[id].siteType.includes('shopify')) {
          logger.warning(`Changing all shopify tasks to variant: ${newData.monitorInput}`);
          this.tasks[id].monitorInput = newData.monitorInput;
          this.tasks[id].monitorType = 'variant';
        } else if (newData.monitorInput && newData.monitorType === 'keywords' && this.tasks[id].siteType.includes('shopify')) {
          const keywords = newData.monitorInput.split(',');
          this.tasks[id].monitorInput = keywords;
          this.tasks[id].monitorType = 'keywords';
        }
        // Only change delays for shopify
        if (newData.monitorDelay && (this.tasks[id].siteType === 'shopify-safe' || this.tasks[id].siteType === 'shopify-advanced')) {
          logger.warning(`Changing all shopify delays to: ${newData.monitorDelay}`);
          this.tasks[id].monitorDelay = parseInt(newData.monitorDelay, 10);
        }
        // Only change sizes for shopify
        if (newData.sizes && (this.tasks[id].siteType === 'shopify-safe' || this.tasks[id].siteType === 'shopify-advanced')) {
          this.tasks[id].sizes = newData.sizes;
        }
      }
      // Supreme mass edit handler
      if (newData.siteType && newData.siteType.includes('supreme') && this.tasks[id].siteType.includes('supreme')) {
        // If mass edit is only keywords
        if (newData.monitorInput && newData.monitorType === 'keywords' && this.tasks[id].siteType.includes('supreme')) {
          const keywords = newData.monitorInput.split(',');
          this.tasks[id].monitorInput = keywords;
        }
        // Only change delays for supreme
        if (newData.monitorDelay && this.tasks[id].siteType === 'supreme' && this.tasks[id].siteType.includes('supreme')) {
          logger.warning(`Changing all supreme delays to: ${newData.monitorDelay}`);
          this.tasks[id].monitorDelay = parseInt(newData.monitorDelay, 10);
        }
        // Only change sizes for supreme
        if (newData.sizes && this.tasks[id].siteType === 'supreme' && this.tasks[id].siteType.includes('supreme')) {
          this.tasks[id].sizes = newData.sizes;
        }
      }
    }
  }
  scheduleTask(id): Promise<void> {
    return new Promise(async (resolve) => {
      const scheduledDate = new Date(this.tasks[id].scheduledTime);
      const scheduledSeconds = scheduledDate.getSeconds() === 0 ? '00' : scheduledDate.getSeconds();
      mainWindow.sendStatus(id, `Waiting until ${scheduledDate.getHours()}:${scheduledDate.getMinutes()}:${scheduledSeconds}`, taskColors.yellow);
      logger.info('Waiting for timer');
      while (new Date() < new Date(this.tasks[id].scheduledTime) || new Date() > new Date(this.tasks[id].scheduledTime)) {
        if (!this.scheduledTasks[id].waiting) {
          logger.info(`Aborted timer for task: ${id}`);
          mainWindow.sendStatus(id, 'Stopped', taskColors.red);
          break;
        }
        if (new Date() >= new Date(this.tasks[id].scheduledTime)) {
          return resolve();
        }
        await this.pause(333);
      }
    });
  }
}

export default new TaskManager();
