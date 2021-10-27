import { ipcMain, BrowserWindow, session } from 'electron';
import got, { Response } from 'got';
import { CookieJar } from 'tough-cookie';
import path from 'path';
import { v4 } from 'uuid';
import SupremeMonitor from './new-monitor';
import ApiManager from '../../../managers/api-manager';
import SettingsManager from '../../../managers/settings-manager';
import CaptchaHarvester from '../../../harvester/captcha-harvester';
import LogManager from '../../../managers/logs-manager';
import taskColors from '../../../helpers/task-colors';
import { CartResponse, CheckoutResponse, StatusResponse } from './types';
import { ITaskData, IProfile } from '../../../interfaces/index';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export default class SupremeHybrid extends SupremeMonitor {
  task: {
    mainWindow: BrowserWindow;
    taskWindow: BrowserWindow;
    userAgent: string;
    cookieJar: CookieJar;
    cartButtonBounds?: { x: number; y: number };
    form?: Array<Array<any>>;
    checkoutForm?: Array<Array<any>>;
    slug?: string;
  };
  taskData: ITaskData;
  userAgent: string;
  stopped: boolean;
  captchaData: { sitekey: string | null; token: string | null };
  profile: IProfile;
  constructor(taskData: ITaskData, profile: IProfile, proxies: any, mainWindow: BrowserWindow) {
    super(taskData, proxies);
    this.stopped = false;
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36';
    this.taskData = taskData;
    this.profile = profile;
    this.task = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36',
      mainWindow,
      taskWindow: null,
      cookieJar: new CookieJar(),
    };
    this.captchaData = {
      sitekey: null,
      token: null,
    };
    ipcMain.once('atc-requierements', (e, atcRequirements: { bounds: { x: number; y: number }; form: Array<Array<any>> }) => {
      this.task.cartButtonBounds = atcRequirements.bounds;
      this.task.form = atcRequirements.form;
    });
    ipcMain.once('payment-requierements', (e, paymentRequirements: { form: Array<Array<any>>; sitekey: string }) => {
      this.task.checkoutForm = paymentRequirements.form;
      this.captchaData.sitekey = paymentRequirements.sitekey;
    });
    ipcMain.once('harvester-browser-token', (captchaResponse: { token: string; taskID: number }) => {
      if (this.taskData.id === captchaResponse.taskID) {
        this.captchaData.token = captchaResponse.token;
      }
    });
  }
  async startTask(): Promise<void> {
    try {
      await this.prepareTask();
      await this.addToCart();
      await this.submitPayment();
    } catch (error) {
      console.log(error.stack);
    }
  }
  // eslint-disable-next-line class-methods-use-this
  createTaskWindow(): BrowserWindow {
    return new BrowserWindow({
      width: 550,
      height: 750,
      resizable: true,
      webPreferences: {
        plugins: true,
        webgl: true,
        nodeIntegration: true,
        webSecurity: false,
        allowRunningInsecureContent: true,
        preload: path.join(__dirname, 'preload.js'),
        session: session.fromPartition(`task-${this.taskData.id}-${v4()}`),
        images: true,
      },
      parent: this.task.mainWindow,
      show: false,
    });
  }
  async prepareTask(): Promise<void> {
    try {
      this.sendStatus('Preparing task', taskColors.yellow);
      LogManager.logMessage('Preparing task', this.taskData.id);
      this.task.taskWindow = this.createTaskWindow();
      await this.task.taskWindow.webContents.session.clearStorageData({ storages: ['cookies'] });
      this.task.taskWindow.webContents.userAgent = this.task.userAgent;
      await this.task.taskWindow.loadURL(`https://www.supremenewyork.com/shop/all/${this.taskData.category === 'new' ? '' : this.taskData.category}`);
      // this.task.taskWindow.webContents.openDevTools();
      await this.monitorMobile();
    } catch (error) {
      LogManager.logMessage(`Unexpected error preparing task: ${error}`);
      await this.pause(this.taskData.retryDelay);
      await this.prepareTask();
    }
  }
  async addToCart(): Promise<void> {
    if (this.stopped) return;
    try {
      if (this.product.productOOS) {
        await this.monitorOneProduct();
      }
      LogManager.logMessage('Adding to cart', this.taskData.id);
      this.sendStatus('Adding to cart', taskColors.yellow);
      await this.task.taskWindow.loadURL(`https://www.supremenewyork.com/shop/${this.taskData.category.replace(/\//g, '_')}/${this.product.id}/${this.product.colorId}`);
      await this.task.taskWindow.webContents.executeJavaScript(`
      const {remote, ipcRenderer} = require('electron');
      const formValues = [];
      const buttonBounds = document.querySelector('[name="commit"]').getBoundingClientRect();
      const atcForm = new FormData(document.querySelector('form'));
      for (const pair of atcForm.entries()) {
        const formValue = [pair[0], pair[1]];
        formValues.push(formValue);
      }
      ipcRenderer.send('atc-requierements', {bounds: {x: buttonBounds.x, y: buttonBounds.y}, form: formValues});
    `);
      const atcUrl = `https://www.supremenewyork.com/shop/${this.product.id}/add.json`;
      const cartData = this.getCartPayload();
      const response: CartResponse = await this.task.taskWindow.webContents.executeJavaScript(
        `
      fetch("${atcUrl}", {
        "headers": {
          "accept": "*/*",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "x-csrf-token": "${cartData.token}",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest"
        },
        "referrer": "https://www.supremenewyork.com/shop/accessories/b3h1uc6ty/bxd1pzhyu",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": "${cartData.payload}",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
      }).then(response => response.json());
    `,
        true,
      );
      if (!response.success) {
        const cookies = await this.task.taskWindow.webContents.session.cookies.get({});
        LogManager.logMessage(`Failed to cart. response: ${JSON.stringify(response)}, cookies: ${JSON.stringify(cookies)}`, this.taskData.id, 'fatal');
        this.sendStatus('Cart error', taskColors.red);
        await this.pause(this.taskData.retryDelay);
        await this.addToCart();
      }
    } catch (error) {
      LogManager.logMessage(`Unexpected error adding to cart: ${error}`, this.taskData.id, 'fatal');
      await this.pause(this.taskData.retryDelay);
      await this.addToCart();
    }
  }
  async submitPayment(): Promise<void> {
    if (this.stopped) return;
    try {
      LogManager.logMessage('Checking out', this.taskData.id);
      this.sendStatus('Checking out', taskColors.yellow);
      await this.task.taskWindow.loadURL('https://www.supremenewyork.com/checkout');
      await this.task.taskWindow.webContents.executeJavaScript(`
      const {remote, ipcRenderer} = require('electron');
      const checkoutFormValues = [];
      const checkoutForm = new FormData(document.querySelector('form'));
      const captchaSitekey = document.querySelector('.g-recaptcha').getAttribute('data-sitekey');
      for (const pair of checkoutForm.entries()) {
        const formValue = [pair[0], pair[1]];
        checkoutFormValues.push(formValue);
      }
      ipcRenderer.send('payment-requierements', {form: checkoutFormValues, sitekey: captchaSitekey});
    `);
      const token = await this.waitForCaptcha();
      const checkoutData = this.getCheckoutPayload(token);
      LogManager.logMessage('Submitting payment', this.taskData.id);
      this.sendStatus('Submitting payment', taskColors.yellow);
      const response: CheckoutResponse = await this.task.taskWindow.webContents.executeJavaScript(
        `
        fetch("https://www.supremenewyork.com/checkout.json", {
          "headers": {
            "accept": "*/*",
            "accept-language": "en",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-csrf-token": "${checkoutData.token}",
            "x-requested-with": "XMLHttpRequest"
          },
          "referrer": "https://www.supremenewyork.com/checkout",
          "referrerPolicy": "strict-origin-when-cross-origin",
          "body": "${checkoutData.payload}",
          "method": "POST",
          "mode": "cors",
          "credentials": "include"
        }).then(checkoutResponse => checkoutResponse.json());
      `,
        true,
      );
      this.captchaData.token = null;
      if (response.status !== 'queued') {
        const cookies = await this.task.taskWindow.webContents.session.cookies.get({});
        LogManager.logMessage(`Failed to submit payment. response: ${JSON.stringify(response)}, cookies: ${JSON.stringify(cookies)}`, this.taskData.id, 'fatal');
        this.sendStatus('Checkout error', taskColors.red);
        await this.pause(this.taskData.retryDelay);
        await this.submitPayment();
        return;
      }
      this.task.slug = response.slug;
      await this.pollStatus();
    } catch (error) {
      LogManager.logMessage(`Unexpected error submitting payment ${error.stack}`, this.taskData.id, 'fatal');
      await this.pause(this.taskData.retryDelay);
      await this.submitPayment();
    }
  }
  async pollStatus(): Promise<void> {
    if (this.stopped) return;
    try {
      LogManager.logMessage('Processing', this.taskData.id);
      this.sendStatus('Processing', taskColors.yellow);
      const { body }: Response<StatusResponse> = await got(`https://www.supremenewyork.com/checkout/${this.task.slug}/status.json`, {
        headers: this.mobileHeaders,
        json: true,
      });
      const status = body.status.toLowerCase();
      switch (status) {
        case 'queued':
          await this.pause(this.taskData.retryDelay);
          await this.pollStatus();
          break;
        case 'dup':
          LogManager.logMessage('Duplicate', this.taskData.id);
          this.sendStatus('Duplicate', taskColors.yellow);
          this.stopped = true;
          break;
        case 'failed':
          if (body.page.toLowerCase().includes('due to high traffic')) {
            this.sendStatus('Payment error', taskColors.red);
            LogManager.logMessage('High traffic error', this.taskData.id, 'fatal');
            SettingsManager.sendWebhook({
              site: this.taskData.siteName,
              size: this.product.sizeName,
              purchaseType: 'decline',
              image: this.product.image,
              productName: this.product.name,
              color: this.taskData.productColor,
              profile: this.profile.profilename,
              price: `${this.product.price}`,
              mode: 'Headless',
              admin: 'High traffic decline',
            });
            await this.addToCart();
            await this.submitPayment();
            break;
          } else {
            this.sendStatus('Declined', taskColors.red);
            LogManager.logMessage('Declined', this.taskData.id, 'fatal');
            await ApiManager.addCheckout({
              date: this.getFormattedDate(),
              type: 'decline',
              productName: this.product.name,
              productImage: this.product.image,
              size: this.product.sizeName,
              mode: 'Headless',
              delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
              captchaBypass: this.taskData.captchaBypass,
              taskGroup: this.taskData.groupName,
              site: this.taskData.siteName,
              price: this.product.price,
              profile: this.profile.profilename,
              monitorInput: this.taskData.monitorInput,
            });
            SettingsManager.sendWebhook({
              site: this.taskData.siteName,
              size: this.product.sizeName,
              purchaseType: 'decline',
              image: this.product.image,
              productName: this.product.name,
              color: this.taskData.productColor,
              profile: this.profile.profilename,
              price: `${this.product.price}`,
              mode: 'Headless',
              admin: 'Normal decline',
            });
            await this.addToCart();
            await this.submitPayment();
          }
          break;
        case 'paid':
          this.sendStatus('Success', taskColors.green);
          LogManager.logMessage('Success', this.taskData.id, 'success');
          SettingsManager.sendWebhook({
            site: this.taskData.siteName,
            size: this.product.sizeName,
            purchaseType: 'success',
            image: this.product.image,
            productName: this.product.name,
            color: this.taskData.productColor,
            profile: this.profile.profilename,
            price: `${this.product.price}`,
            mode: 'Headless',
            admin: 'Success',
          });
          ApiManager.addCheckout({
            date: this.getFormattedDate(),
            type: 'checkout',
            productName: this.product.name,
            productImage: this.product.image,
            size: this.product.sizeName,
            mode: 'Default',
            delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
            captchaBypass: this.taskData.captchaBypass,
            taskGroup: this.taskData.groupName,
            site: this.taskData.siteName,
            price: this.product.price,
            profile: this.profile.profilename,
            monitorInput: this.taskData.monitorInput,
          });
          break;
        default:
          LogManager.logMessage(`Unexpected payment status: ${JSON.stringify(body)}`, this.taskData.id, 'fatal');
          await this.pause(this.taskData.retryDelay);
          await this.pollStatus();
          break;
      }
    } catch (error) {
      LogManager.logMessage(`Unexpected error polling status ${error.stack}`, this.taskData.id, 'fatal');
      await this.pause(this.taskData.retryDelay);
      await this.pollStatus();
    }
  }
  sendAtcEvents(): void {
    this.task.taskWindow.webContents.sendInputEvent({
      type: 'mouseMove',
      x: this.task.cartButtonBounds.x + 30,
      y: this.task.cartButtonBounds.y - 80,
    });
    this.task.taskWindow.webContents.sendInputEvent({
      type: 'mouseDown',
      x: this.task.cartButtonBounds.x,
      y: this.task.cartButtonBounds.y,
      clickCount: 1,
      button: 'left',
    });
    this.task.taskWindow.webContents.sendInputEvent({
      type: 'mouseUp',
      x: this.task.cartButtonBounds.x,
      y: this.task.cartButtonBounds.y,
      clickCount: 1,
      button: 'left',
    });
  }
  getCartPayload(): { payload: string; token: string } {
    const { form } = this.task;
    const payload: any = {};
    for (let i = 0; i < form.length; i += 1) {
      const formValue = form[i];
      payload[formValue[0]] = formValue[1];
    }
    payload.st = this.product.colorId;
    payload.s = this.product.sizeId;
    return { payload: this.encodePayload(payload), token: payload.authenticity_token };
  }
  getCheckoutPayload(captchaToken: string): { payload: string; token: string } {
    const { checkoutForm } = this.task;
    const payload: any = {};
    for (let i = 0; i < checkoutForm.length; i += 1) {
      const formValue = checkoutForm[i];
      payload[formValue[0]] = formValue[1];
    }
    const cardExp = this.profile.expdate.split('/');
    payload['order[billing_name]'] = this.profile.cardholdername;
    payload['order[email]'] = this.profile.email;
    payload['order[tel]'] = this.profile.phone;
    payload['order[billing_address]'] = this.profile.shipping.address;
    payload['order[billing_address_2]'] = this.profile.shipping.address2 ? this.profile.shipping.address2 : '';
    payload['order[billing_zip]'] = this.profile.shipping.zip;
    payload['order[billing_city]'] = this.profile.shipping.city;
    payload['order[billing_state]'] = this.profile.shipping.state;
    payload['order[billing_country]'] = 'USA';
    payload['credit_card[type]'] = 'credit card';
    payload['credit_card[month]'] = cardExp[0];
    payload.riearmxa = this.profile.cardnumber;
    payload['credit_card[year]'] = `20${cardExp[1]}`;
    payload['credit_card[meknk]'] = this.profile.cvv;
    payload['g-recaptcha-response'] = captchaToken;
    return {
      payload: this.encodePayload(payload).replace(/&order%5Bterms%5D=0/, '&order%5Bterms%5D=0&order%5Bterms%5D=1'),
      token: payload.authenticity_token,
    };
  }
  async waitForCaptcha(): Promise<string> {
    this.sendStatus('Waiting for captcha', taskColors.blue);
    await CaptchaHarvester.getCaptcha({
      taskID: this.taskData.id,
      site: 'http://www.supremenewyork.com/checkout',
      sitekey: '6LeWwRkUAAAAAOBsau7KpuC9AV-6J8mhw4AjC3Xz',
      harvesterType: 'supreme',
      supremeHeadless: true,
    });
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.captchaData.token) {
          clearInterval(interval);
          resolve(this.captchaData.token);
        }
      }, 333);
    });
  }
  // eslint-disable-next-line class-methods-use-this
  encodePayload(obj, keys = true): string {
    const string = Object.keys(obj)
      .map((k) => `${encodeURIComponent(k)}=${keys ? encodeURIComponent(obj[k]) : ''}`)
      .join('&');
    return string;
  }
  sendStatus(status: string, color: string): void {
    ipcMain.emit('hybrid-task-status', { taskID: this.taskData.id, status, color });
  }
  // eslint-disable-next-line class-methods-use-this
  getFormattedDate(): string {
    const date = new Date();
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }
  stopTask() {
    this.stopped = true;
    this.task.taskWindow.destroy();
  }
}
