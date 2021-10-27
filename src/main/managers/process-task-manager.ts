/* eslint-disable max-len */
/* eslint-disable no-case-declarations */
/* eslint-disable no-await-in-loop */
import logger from '../helpers/logger';
// BOT SCRIPTS
import monitorManager from './monitor-manager';
import noMonitor from '../helpers/no-monitor';
import ShopifyAdvanced from '../scripts/shopify/advanced/new-advanced';
import ShopifySafe from '../scripts/shopify/safe/new-safe';
import ShopifySafeNewFlow from '../scripts/shopify/safe/new_flow';
import SupremeBot from '../scripts/supreme/supreme-main';
import FootlockerEU from '../scripts/footsites/footlockereu-main';
import FootlockerUS from '../scripts/footsites/footsitesus-main';
//import SupremeHeadlessBot from '../scripts/supreme/supreme-headless';
// Interfaces
import { ITaskData } from '../interfaces/index';

const scripts = {
  'shopify-advanced': {
    create(data: ITaskData, profile: any, proxies: any): ShopifyAdvanced {
      return new ShopifyAdvanced(data, profile, proxies);
    },
  },
  'shopify-safe': {
    create(data: ITaskData, profile: any, proxies: any): ShopifySafeNewFlow {
      return new ShopifySafeNewFlow(data, profile, proxies);
    },
  },
  supreme: {
    create(data: ITaskData, profile: any, proxies): SupremeBot {
      return new SupremeBot(data, profile, proxies);
    },
  },
  footlocker_eu: {
    create(data: ITaskData, profile: any, proxies: any): FootlockerEU {
      return new FootlockerEU(data, profile, proxies);
    },
  },
  footsites: {
    create(data: ITaskData, profile: any, proxies): FootlockerUS {
      return new FootlockerUS(data, profile, proxies);
    },
  },
};
class ProcessTaskManager {
  bots: any;
  constructor() {
    this.bots = {};
    this.initProcessListener();
  }
  initProcessListener(): void {
    process.on('message', (message) => {
      switch (message.type) {
        case 'start-task':
          if (!noMonitor[message.taskData.siteType]) {
            monitorManager.createMonitor(message.taskData.siteType, message.taskData, message.proxies);
          }
          const siteType = message.taskData.siteType === 'supreme' && message.taskData.headlessMode ? 'supreme-headless' : message.taskData.siteType;
          this.bots[message.taskData.id] = scripts[siteType].create(message.taskData, message.profile, message.proxies);
          this.bots[message.taskData.id].startTask();
          break;
        case 'stop-task':
          this.bots[message.id].stopTask(message.sendStatus);
          // delete this.bots[message.id];
          break;
        case 'send-captcha':
          // logger.info(`Sending captcha to task-${message.taskID}`);
          this.bots[message.taskID].saveCaptchaToken(message.token, message.cookies);
          break;
        case 'send-datadome':
          this.bots[message.taskID].setSolvedDatadome(message.cookie, message.banned);
          break;
        case 'mass-edit-all':
          // logger.info(`Mass editing all tasks, new data: ${JSON.stringify(message.newData)}`);
          this.bots[message.id].updateTask(message.newData);
          break;
        case 'stop-task-no-status':
          this.bots[message.id].stopTask(false);
          break;
        default:
          break;
      }
    });
    process.on('uncaughtException', (err) => {
      if (err.name === 'AssertionError') {
        /**
         * The majority of the time this is cause by the tunnel-agent library,
         * solved: https://github.com/request/tunnel-agent/issues/43
         */
        logger.warning('Assertion error');
      } else {
        logger.fatal(`Process error: ${err}`);
      }
    });
  }
}

export default new ProcessTaskManager();
