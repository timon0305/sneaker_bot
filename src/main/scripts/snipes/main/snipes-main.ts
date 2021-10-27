/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/interface-name-prefix */
/* eslint-disable no-param-reassign */
/* eslint-disable max-len */
/* eslint-disable vars-on-top */
/* eslint-disable no-var */
/* eslint-disable eqeqeq */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable no-await-in-loop */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import _ from 'underscore';
import Tough from 'tough-cookie';
import MainBot from '../../main-classes/main-bot';
import Cheerio from 'cheerio';

import taskStatus from '../../../helpers/task-status';
import taskColors from '../../../helpers/task-colors';

import SnipesRequests from './snipes-requests';
import { ITaskData, IProfile } from '../../../interfaces/index';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface IMainCheckpoints {
  'Set px cookies': boolean;
  'Pre carting': boolean;
  'Found product': boolean;
  'Found size': boolean;
  'Finished monitor': boolean;
  'Found size id': boolean;
  'Added to cart': boolean;
  'Got csrf token': boolean;
  'Submitted shipping': boolean;
  'Submitted billing': boolean;
  'Proceeded to payment': boolean;
}
interface IDefaultURL {
  originURL: string;
  baseURL: string;
  removeCartURL: string;
  monitorLink: string;
  atcLink: string;
  csrfLink: string;
  shipping: {
    link: string;
    id: string;
  };
  paymentLink: string;
  submitLink: string;
  promoLink: string;
}
class SnipesMain extends MainBot {
  taskData: ITaskData;
  profile: IProfile;
  errorDelay: number;
  requests: SnipesRequests;
  mainCheckpoints: IMainCheckpoints;
  productData: any;
  checkoutData: any;
  preCartData: any;
  productPage: any;
  foundSizes: any;
  defaultURL: IDefaultURL;
  mode: string;
  taskType: string;
  $: any;
  constructor(taskData: ITaskData, profile: IProfile, proxies, type: string) {
    super(taskData, proxies);
    this.taskData = taskData;
    this.profile = profile;
    this.proxies = proxies;
    this.taskType = type;

    this.requests = new SnipesRequests(taskData, proxies);

    this.errorDelay = this.taskData.retryDelay;

    this.mainCheckpoints = {
      'Set px cookies': false,
      'Pre carting': false,
      'Found product': false,
      'Found size': false,
      'Finished monitor': false,
      'Found size id': false,
      'Added to cart': false,
      'Got csrf token': false,
      'Submitted shipping': false,
      'Submitted billing': false,
      'Proceeded to payment': false,
    };
    this.productData = {
      name: '',
      productID: '',
      optionID: '',
      size: '',
      sizeID: '',
      color: '',
      colorID: '',
      imageURL: '',
      price: '',
      available: false,
      isRelease: false,
      releaseDate: '',
      releaseTime: '',
    };
    this.checkoutData = {
      shipmentUUID: '',
      pliUUID: '',
      csrfToken: '',
    };
    this.preCartData = {
      url: '',
      pid: '',
      size: '',
    };
    this.productPage = {};
    this.foundSizes = {};
    this.defaultURL = {
      originURL: '',
      baseURL: '',
      removeCartURL: '',
      monitorLink: '',
      atcLink: '',
      csrfLink: '',
      shipping: {
        link: '',
        id: '',
      },
      paymentLink: '',
      submitLink: '',
    };
    this.mode = '';
    this.setDefaultURLs();
  }
  async setPXCookies(): Promise<void> {
    if (this.stopped) return;
    try {
      this.log('info', this.taskData.id, 'Setting PX');
      this.sendStatus('Setting PX', taskColors.yellow);
      const pxPayload = await this.requests.preparePx(this.defaultURL.baseURL);
      const response = await this.requests.sendPxData(pxPayload.body.payload, this.defaultURL.baseURL);
      const vidValue = response.body.do.find((val) => val.includes('vid|'));
      if (vidValue) {
        const vid = new Tough.Cookie({
          key: '_pxvid',
          value: vidValue.split('|')[1],
          domain: this.defaultURL.originURL,
          path: '/',
        });
        this.requests.cookieJar.setCookie(vid.toString(), `${this.defaultURL.baseURL}/`);
      }
      const px3Payload = {
        uuid: pxPayload.body.uuid,
        timestamp: pxPayload.body.timestamp,
        doVals: response.body.do,
      };
      const pxPayload2 = await this.requests.preparePx3(px3Payload, this.defaultURL.baseURL);
      const response2 = await this.requests.sendPxData(pxPayload2.body.payload, this.defaultURL.baseURL);
      var px3Value = response2.body.do.find((val) => val.includes('_px3|'));
      if (!px3Value) {
        this.log('fatal', this.taskData.id, 'Error setting PX cookies! No response.');
        this.sendStatus('Setting PX error', taskColors.red);
        await this.pause(this.errorDelay);
        await this.setPXCookies();
        return;
      }
      // eslint-disable-next-line prefer-destructuring
      px3Value = px3Value.split('_px3|330|')[1].split('|')[0];
      const px = new Tough.Cookie({
        key: '_px3',
        value: px3Value,
        domain: this.defaultURL.originURL,
        path: '/',
      });
      this.requests.cookieJar.setCookie(px.toString(), `${this.defaultURL.baseURL}/`);
      this.mainCheckpoints['Set px cookies'] = true;
    } catch (error) {
      await this.handleError(error.message, error, this.setPXCookies);
    }
  }
  async getProduct(pid): Promise<void> {
    if (this.stopped) return;
    try {
      const response = await this.requests.getProductData(this.defaultURL.monitorLink, pid, this.defaultURL.originURL);
      this.productPage = response.body.product;
      if (!this.productPage) {
        this.log('fatal', this.taskData.id, `Cloudfare error: ${response.statusCode} \n ${response.body}`);
        this.sendStatus(`Cloudfare error. ${response.statusCode}`, taskColors.red);
        await this.pause(this.errorDelay);
        await this.getProduct(pid);
      }
      this.productData.available = response.body.product.available;
      this.productData.isRelease = response.body.product.isRelease;
      this.productData.releaseDate = response.body.product.custom.releaseDateUTC;

      this.productData.name = this.productPage.productName;
      this.productData.productID = this.productPage.id;
      this.productData.imageURL = this.productPage.images[0].pdp.srcM;
      this.productData.price = this.productPage.price.sales.formatted;

      const allColorData = this.productPage.variationAttributes.find((item) => item.attributeId == 'color');
      const colorData = allColorData.values.find((value) => value.selectable == true);
      this.productData.color = colorData.displayValue;
      this.productData.colorID = colorData.pid;
      this.productData.url = this.defaultURL.baseURL + colorData.url.split('?')[0];

      const sizeData = this.productPage.variationAttributes.find((item) => item.attributeId === 'size');
      this.productData.optionID = sizeData.id;
      this.foundSizes = sizeData.values;
      if (!this.mainCheckpoints['Pre carting']) {
        this.sendStatus(taskStatus.foundProduct, taskColors.yellow, this.productData.name);
        this.sendToast(this.productData.imageURL, this.productData.url, this.productData.name, 'Found product!', 'blue');
      }
      this.mainCheckpoints['Found product'] = true;
    } catch (error) {
      await this.handleError(error.message, error, this.getProduct);
    }
  }
  async getSize(taskSize): Promise<void> {
    if (!this.mainCheckpoints['Found product'] || !this.foundSizes.length || this.stopped) return;
    try {
      const sizes = this.foundSizes;
      if (this.taskData.sizes.indexOf('random') !== -1 || taskSize.includes('random')) {
        const randomInStockSizes = sizes.filter((product) => product.selectable == true);
        if (!randomInStockSizes.length) return;
        if (randomInStockSizes[0].displayValue === 'One size') {
          this.productData.size = 'N/A';
          if (!this.mainCheckpoints['Pre carting']) {
            this.log('info', this.taskData.id, `Selected size: ${this.productData.size}`);
            this.sendStatus(taskStatus.selectedSize, taskColors.yellow);
          }
          this.mainCheckpoints['Found size'] = true;
          this.mainCheckpoints['Finished monitor'] = true;
          return;
        }
        const randomSizeNumber = this.randomNumber(0, randomInStockSizes.length - 1);
        const pickedSize = randomInStockSizes[randomSizeNumber];
        this.productData.size = pickedSize.displayValue;
        if (!this.mainCheckpoints['Pre carting']) {
          this.log('info', this.taskData.id, `Selected size: ${this.productData.size}`);
          this.sendStatus(taskStatus.selectedSize, taskColors.yellow);
        }
        this.mainCheckpoints['Found size'] = true;
        this.mainCheckpoints['Finished monitor'] = true;
        return;
      }
      const allSizes = sizes.filter((size) => taskSize.includes(size.displayValue) == true);

      const inStockSizes = allSizes.filter((product) => product.selectable == true);

      if (!inStockSizes.length) return;
      const randomProduct = Math.floor(Math.random() * inStockSizes.length);
      const pickedSize = inStockSizes[randomProduct];

      this.productData.size = pickedSize.displayValue;
      if (!this.mainCheckpoints['Pre carting']) {
        this.log('info', this.taskData.id, `Selected size: ${this.productData.size}`);
        this.sendStatus(taskStatus.selectedSize, taskColors.yellow);
      }
      this.mainCheckpoints['Found size'] = true;
      this.mainCheckpoints['Finished monitor'] = true;
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error getting size: ${error.stack}`);
      await this.handleError(error.message, error, this.getSize);
    }
  }
  async checkStock(pid): Promise<void> {
    if (this.mainCheckpoints['Found size'] || this.stopped) return;
    try {
      const response = await this.requests.getProductData(this.defaultURL.monitorLink, pid, this.defaultURL.originURL);
      this.productPage = response.body.product;
      const sizeData = this.productPage.variationAttributes.find((item) => item.attributeId === 'size');
      this.foundSizes = sizeData.values;
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error checking stock: ${error.stack}`);
      await this.handleError(error.message, error, this.checkStock);
    }
  }
  async monitor(pid, taskSize): Promise<void> {
    if (this.mainCheckpoints['Finished monitor'] || this.stopped) return;
    try {
      // eslint-disable-next-line consistent-return
      return new Promise<void>(async (resolve) => {
        await this.getProduct(pid);
        if (!this.mainCheckpoints['Pre carting']) {
          this.sendStatus(taskStatus.monitoring, taskColors.yellow);
          this.log('info', this.taskData.id, 'Monitoring...');
        }
        while (!this.mainCheckpoints['Found product'] && !this.stopped) {
          if (this.stopped) break;
          await this.pause(this.taskData.retryDelay);
          await this.getProduct(pid);
        }
        if (!this.mainCheckpoints['Pre carting']) {
          this.log('info', this.taskData.id, `Found Product: ${this.productData.name}`);
        }
        await this.getSize(taskSize);
        if (!this.mainCheckpoints['Found size'] && !this.stopped && !this.mainCheckpoints['Pre carting']) {
          this.sendStatus(taskStatus.restock, taskColors.yellow);
          this.log('info', this.taskData.id, 'Waiting for restock...');
        }
        while (!this.mainCheckpoints['Found size'] && !this.stopped) {
          await this.pause(this.taskData.retryDelay);
          await this.checkStock(pid);
          await this.getSize(taskSize);
        }
        await this.getSizeID();
        if (!this.stopped && (!this.productData || !this.productData.available || this.productData.isRelease)) {
          this.sendStatus(taskStatus.waitingRelease, taskColors.yellow);
          this.log('info', this.taskData.id, 'Waiting for release...');
        }
        while (!this.stopped && (!this.productData || !this.productData.available || this.productData.isRelease)) {
          if (!this.productData.available) {
            const response = await this.requests.getProductData(this.defaultURL.monitorLink, pid, this.defaultURL.originURL);
            this.productData.available = response.body.product.available;
          } else {
            const currentDate = new Date();
            const releaseDate = new Date(this.productData.releaseDate);
            if (currentDate.getTime() >= releaseDate.getTime()) {
              this.productData.isRelease = false;
              break;
            }
          }
          await this.pause(this.taskData.retryDelay);
        }
        if (this.mainCheckpoints['Finished monitor']) {
          resolve();
        }
      });
    } catch (error) {
      this.log('fatal', this.taskData.id, `Monitor error: ${error.stack}`);
      await this.handleError(error.message, error, this.monitor);
    }
  }

  async getSafeProduct(url): Promise<void> {
    if (this.stopped) return;
    try {
      const response = await this.requests.getSafeProductData(url, this.defaultURL.originURL);
      this.productPage = response.body;
      this.$ = Cheerio.load(response.body);
      if (!this.productPage) {
        this.log('fatal', this.taskData.id, `Cloudfare error: ${response.statusCode} \n ${response.body}`);
        this.sendStatus(`Cloudfare error. ${response.statusCode}`, taskColors.red);
        await this.pause(this.errorDelay);
        await this.getProduct(url);
      }
      const productInfo = JSON.parse(this.$('[type="application/ld+json"]').html());
      if (!productInfo) {
        this.log('fatal', this.taskData.id, `Find product data error: ${response.statusCode} \n ${response.body}`);
        this.sendStatus(`Find product data error. ${response.statusCode}`, taskColors.red);
        await this.pause(this.errorDelay);
        await this.getProduct(url);
      }
      // eslint-disable-next-line prefer-destructuring
      this.productData.productID = this.$('div.js-product-details').data('variation-group-id');
      const atcInfo = this.$('button.js-btn-add-to-cart');
      this.productData.isRelease = !atcInfo.data('title-added');
      this.productData.available = true;
      if (this.productData.isRelease) this.productData.releaseDate = this.$('button.js-btn-release').data('release-date');

      this.productData.name = productInfo.name;
      this.productData.imageURL = this.$(`img[title="${this.productData.name}"]`)
        .eq(0)
        .data('src');
      this.productData.price = `${productInfo.offers.price}`;
      this.productData.url = this.taskData.monitorInput;

      // eslint-disable-next-line prefer-destructuring
      this.productData.optionID = this.$('a[data-attr-id="size"]')
        .data('href')
        .split(`chosen=size&dwvar_${this.productData.productID}_`)[1]
        .split('=')[0];
      if (!this.mainCheckpoints['Pre carting']) {
        this.sendStatus(taskStatus.foundProduct, taskColors.yellow, this.productData.name);
        this.sendToast(this.productData.imageURL, this.productData.url, this.productData.name, 'Found product!', 'blue');
      }
      this.mainCheckpoints['Found product'] = true;
    } catch (error) {
      this.log('fatal', this.taskData.id, `Get safe product error: ${error.stack}`);
      await this.handleError(error.message, error, this.getSafeProduct);
    }
  }
  async getSafeSize(taskSize): Promise<void> {
    if (!this.mainCheckpoints['Found product'] || this.stopped) return;
    try {
      const sizes = this.$('span.b-swatch-value--orderable');
      if (this.taskData.sizes.indexOf('random') !== -1 || taskSize.includes('random')) {
        if (!sizes.length) return;
        if (sizes.eq(0).displayValue === 'One size') {
          this.productData.size = 'N/A';
          if (!this.mainCheckpoints['Pre carting']) {
            this.log('info', this.taskData.id, `Selected size: ${this.productData.size}`);
            this.sendStatus(taskStatus.selectedSize, taskColors.yellow);
          }
          this.mainCheckpoints['Found size'] = true;
          this.mainCheckpoints['Finished monitor'] = true;
          return;
        }
        const randomSizeNumber = this.randomNumber(0, sizes.length - 1);
        const pickedSize = sizes.eq(randomSizeNumber);
        this.productData.size = pickedSize.data('attr-value');
        if (!this.mainCheckpoints['Pre carting']) {
          this.log('info', this.taskData.id, `Selected size: ${this.productData.size}`);
          this.sendStatus(taskStatus.selectedSize, taskColors.yellow);
        }
        this.mainCheckpoints['Found size'] = true;
        this.mainCheckpoints['Finished monitor'] = true;
        return;
      }
      // eslint-disable-next-line array-callback-return
      const inStockSizes = sizes.filter((i, el) => taskSize.includes(this.$(el).attr('data-attr-value')) == true);

      if (!inStockSizes.length) return;
      const randomProduct = Math.floor(Math.random() * inStockSizes.length);
      const pickedSize = inStockSizes.eq(randomProduct);

      this.productData.size = pickedSize.data('attr-value');
      if (!this.mainCheckpoints['Pre carting']) {
        this.log('info', this.taskData.id, `Selected size: ${this.productData.size}`);
        this.sendStatus(taskStatus.selectedSize, taskColors.yellow);
      }
      this.mainCheckpoints['Found size'] = true;
      this.mainCheckpoints['Finished monitor'] = true;
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error getting size: ${error.stack}`);
      await this.handleError(error.message, error, this.getSize);
    }
  }
  async checkSafeStock(url): Promise<void> {
    if (this.mainCheckpoints['Found size'] || this.stopped) return;
    try {
      const response = await this.requests.getSafeProductData(url, this.defaultURL.originURL);
      this.productPage = response.body;
      this.$ = Cheerio.load(response.body);
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error checking stock: ${error.stack}`);
      await this.handleError(error.message, error, this.checkStock);
    }
  }
  async safeMonitor(url, taskSize): Promise<void> {
    if (this.mainCheckpoints['Finished monitor'] || this.stopped) return;
    try {
      // eslint-disable-next-line consistent-return
      return new Promise<void>(async (resolve) => {
        await this.getSafeProduct(url);
        if (!this.mainCheckpoints['Pre carting']) {
          this.sendStatus(taskStatus.monitoring, taskColors.yellow);
          this.log('info', this.taskData.id, 'Monitoring...');
        }
        while (!this.mainCheckpoints['Found product'] && !this.stopped) {
          if (this.stopped) break;
          await this.pause(this.taskData.retryDelay);
          await this.getProduct(url);
        }
        if (!this.mainCheckpoints['Pre carting']) {
          this.log('info', this.taskData.id, `Found Product: ${this.productData.name}`);
        }
        if (!this.stopped && (!this.productData || !this.productData.available || this.productData.isRelease)) {
          this.sendStatus(taskStatus.waitingRelease, taskColors.yellow);
          this.log('info', this.taskData.id, 'Waiting for release...');
        }
        while (!this.stopped && (!this.productData || !this.productData.available || this.productData.isRelease)) {
          await this.pause(this.taskData.retryDelay);

          if (!this.productData.available) {
            const response = await this.requests.getSafeProductData(url, this.defaultURL.originURL);
            this.productData.available = response.body.includes('b-swatch-value--orderable');
          } else {
            const currentDate = new Date();
            const releaseDate = new Date(this.productData.releaseDate);
            if (currentDate.getTime() >= releaseDate.getTime()) {
              this.productData.isRelease = false;
              break;
            }
          }
        }
        await this.getSafeSize(taskSize);
        if (!this.mainCheckpoints['Found size'] && !this.stopped && !this.mainCheckpoints['Pre carting']) {
          this.sendStatus(taskStatus.restock, taskColors.yellow);
          this.log('info', this.taskData.id, 'Waiting for restock...');
        }
        while (!this.mainCheckpoints['Found size'] && !this.stopped) {
          await this.pause(this.taskData.retryDelay);
          await this.checkSafeStock(url);
          await this.getSize(taskSize);
        }
        await this.getSizeID();
        if (this.mainCheckpoints['Finished monitor']) {
          resolve();
        }
      });
    } catch (error) {
      this.log('fatal', this.taskData.id, `Monitor error: ${error.stack}`);
      await this.handleError(error.message, error, this.monitor);
    }
  }

  async getSizeID(): Promise<void> {
    if (this.mainCheckpoints['Found size id'] || !this.mainCheckpoints['Finished monitor'] || this.stopped) return;
    try {
      if (!this.mainCheckpoints['Pre carting']) {
        this.sendStatus(taskStatus.gettingSizeId, taskColors.yellow);
        this.log('info', this.taskData.id, taskStatus.gettingSizeId);
      }
      const response = await this.requests.getSizeIDRequest(this.productData.url, this.productData.productID, this.productData.size, this.defaultURL.baseURL, this.defaultURL.originURL);
      if (!response.body.product || !response.body.product.id) return;
      this.productData.sizeID = response.body.product.id;
      this.mainCheckpoints['Found size id'] = true;
      if (!this.mainCheckpoints['Pre carting']) {
        this.log('info', this.taskData.id, `Got Size ID: ${this.productData.sizeID}`);
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Monitor error: ${error.stack}`);
      await this.handleError(error.message, error, this.getSizeID);
    }
  }
  async addToCart(): Promise<void> {
    if (!this.mainCheckpoints['Finished monitor'] || !this.mainCheckpoints['Found size id'] || this.stopped) return;
    try {
      if (!this.mainCheckpoints['Pre carting']) {
        this.sendStatus(taskStatus.carting, taskColors.yellow);
        this.log('info', this.taskData.id, 'Adding to cart');
      }
      const atcForm = {
        pid: this.productData.sizeID,
        options: `[{"optionId":"${this.productData.optionID}", "selectedValueId":"${this.productData.sizeID}"}]`,
        quantity: '1',
      };
      // console.log(atcForm);
      const response = await this.requests.atcRequest(this.defaultURL.atcLink, atcForm, this.defaultURL.originURL, this.productData.url);
      if (response.body.error === false && response.statusCode === 200) {
        this.checkoutData.shipmentUUID = response.body.cart.items[0].shipmentUUID;
        this.checkoutData.pliUUID = response.body.pliUUID;
        this.mainCheckpoints['Added to cart'] = true;
        if (!this.mainCheckpoints['Pre carting']) this.log('info', this.taskData.id, 'Added to Cart!');
      } else if (response.body.error === true && response.statusCode === 200) {
        this.log('info', this.taskData.id, 'Product OOS...');
        this.sendStatus(taskStatus.cartingFailedOOS, taskColors.red);
        await this.pause(this.taskData.monitorDelay);
        await this.addToCart();
      } else {
        console.log(response.body);
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Add to cart error: ${error.stack}`);
      await this.handleError(error.message, error, this.addToCart);
    }
  }
  async genCSRF(): Promise<void> {
    if (!this.mainCheckpoints['Added to cart'] || this.stopped) return;
    try {
      if (!this.mainCheckpoints['Pre carting']) {
        this.sendStatus(taskStatus.gettingCSRF, taskColors.yellow);
        this.log('info', this.taskData.id, 'Getting CSRF token');
      }
      const response = await this.requests.genCSRFRequest(this.defaultURL.csrfLink, this.defaultURL.originURL);
      if (!response.body.csrf || !response.body.csrf.token) {
        this.log('fatal', this.taskData.id, 'Failed to get CSRF Token...');
        await this.pause(this.errorDelay);
        await this.genCSRF();
      }
      this.checkoutData.csrfToken = response.body.csrf.token;
      this.mainCheckpoints['Got csrf token'] = true;
      if (!this.mainCheckpoints['Pre carting']) {
        this.log('info', this.taskData.id, `Got CSRF Token: ${this.checkoutData.csrfToken}`);
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Failed to Get CSRF Token: ${error.stack}`);
      await this.handleError(error.message, error, this.genCSRF);
    }
  }
  async submitShipping(): Promise<void> {
    if (!this.mainCheckpoints['Got csrf token'] || this.stopped) return;
    try {
      this.sendStatus(taskStatus.submittingShipping, taskColors.yellow);
      this.log('info', this.taskData.id, taskStatus.submittingShipping);
      const payload = this.getShippingPayload();
      const response = await this.requests.checkoutPostRequest(this.defaultURL.shipping.link, payload, 'shipping', this.defaultURL.baseURL, this.defaultURL.originURL);
      if ((response.body.order && response.body.order.shippable == false) || this.profile.shipping.countrycode.toLowerCase() != this.taskData.site.toLowerCase()) {
        this.log('fatal', this.taskData.id, 'Invalid Address');
        this.sendStatus(taskStatus.invalidAddress, taskColors.red);
        this.stopped = true;
      } else if (response.body.order && response.body.order.shippable && !response.body.error) {
        this.log('info', this.taskData.id, 'Submitted Shipping');
        this.mainCheckpoints['Submitted shipping'] = true;
      } else {
        this.log('fatal', this.taskData.id, 'Failed to Submit Shipping...');
        this.sendStatus(taskStatus.submittingShippingError, taskColors.red);
        await this.pause(this.errorDelay);
        await this.submitShipping();
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Submit shipping error: ${error.stack}`);
      await this.handleError(error.message, error, this.submitShipping);
    }
  }
  async submitBilling(): Promise<void> {
    if (!this.mainCheckpoints['Submitted shipping'] || this.stopped) return;
    try {
      this.sendStatus(taskStatus.submittingBilling, taskColors.yellow);
      const payload = this.getBillingPayload();
      const response = await this.requests.checkoutPostRequest(this.defaultURL.paymentLink, payload, 'payment', this.defaultURL.baseURL, this.defaultURL.originURL);
      if (response.body.paymentMethod && response.body.paymentMethod.value == this.mode && !response.body.error) {
        this.log('info', this.taskData.id, 'Submitted Billing');
        this.mainCheckpoints['Submitted billing'] = true;
      } else {
        this.log('fatal', this.taskData.id, 'Failed to Submit Billing...');
        this.sendStatus(taskStatus.submittingBillingError, taskColors.red);
        await this.pause(this.errorDelay);
        await this.submitBilling();
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Submit billing error: ${error.stack}`);
      await this.handleError(error.message, error, this.submitBilling);
    }
  }
  async submitPromoCode(previousStep): Promise<void> {
    if (!this.mainCheckpoints[previousStep] || this.taskData.promoCode === '' || this.stopped) return;
    try {
      this.sendStatus('Submitting promo code', taskColors.yellow);
      const response = await this.requests.promoCodeRequest(this.defaultURL.promoLink, this.taskData.promoCode, this.checkoutData.csrfToken, this.defaultURL.originURL);
      if (response.body.totals && response.body.totals.discounts[0].valid && !response.body.error) {
        this.log('info', this.taskData.id, 'Submitted Promo Code');
        this.productData.price = response.body.totals.grandTotal;
      } else {
        this.log('fatal', this.taskData.id, 'Invalid promo code...');
        this.sendStatus('Invalid promo code', taskColors.red);
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Submit promo code error: ${error.stack}`);
      await this.handleError(error.message, error, this.submitPromoCode);
    }
  }
  async placeOrder(previousStep): Promise<void> {
    if (!this.mainCheckpoints[previousStep] || this.stopped) return;
    try {
      this.sendStatus(taskStatus.proceedingPayment, taskColors.yellow);
      this.log('info', this.taskData.id, 'Proceeding to payment');
      const response = await this.requests.checkoutPostRequest(this.defaultURL.submitLink, { '': '' }, 'placeOrder', this.defaultURL.baseURL, this.defaultURL.originURL);
      if (response.body.continueUrl && !response.body.error) {
        // this.log('info', this.taskData.id, `Placed Order!\nContinue URL: ${response.body.continueUrl}\nCancel URL: ${this.defaultURL.baseURL}${response.body.cancelUrl}`);
        this.log('info', this.taskData.id, `Proceeded to Payment! - ${this.productData.name}`);
        this.log('info', this.taskData.id, `Checkout URL: ${response.body.continueUrl}`);
        this.checkoutData.cardURL = response.body.continueUrl;
        this.mainCheckpoints['Submitted order'] = true;
        if (this.mode == 'Sofort' || this.mode == 'Paypal') {
          const finalMode = this.mode == 'Sofort' ? 'Bank' : 'PayPal';
          const finalType = this.taskType == 'safe' ? 'Safe' : 'Normal';
          this.sendStatus(finalMode === 'Bank' ? taskStatus.successBank : taskStatus.successPaypal, taskColors.green);
          this.log('success', this.taskData.id, `${finalMode} Checkout Success`);
          this.sendWebhook({
            purchaseType: 'bankPayment',
            productName: this.productData.name,
            image: this.productData.imageURL,
            site: this.taskData.siteName,
            size: this.productData.size,
            price: this.productData.price,
            profile: this.profile.profilename,
            paymentURL: this.checkoutData.cardURL,
            mode: `${finalMode} - ${finalType}`,
          });
          if (finalMode === 'PayPal') {
            this.sendPaypalData(
              // eslint-disable-next-line no-underscore-dangle
              this.requests.cookieJar._jar.store.idx,
              this.checkoutData.cardURL,
              this.taskData.profile,
              this.productData.size,
              this.taskData.siteName,
            );
          }
          this.saveCheckout({
            date: this.getFormattedDate(),
            type: 'checkout',
            productName: this.productData.name,
            productImage: this.productData.imageURL,
            size: this.productData.size,
            mode: `${finalMode} - ${finalType}`,
            delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.errorDelay],
            captchaBypass: false,
            taskGroup: this.taskData.groupName,
            site: this.taskData.siteName,
            price: this.productData.price,
            profile: this.profile.profilename,
            monitorInput: this.taskData.monitorInput,
          });
          this.stopped = true;
        }
        return;
      }
      this.log('fatal', this.taskData.id, 'Failed to Proceed to Payment');
      this.sendStatus(taskStatus.proceedingPaymentError, taskColors.red);
      await this.pause(this.errorDelay);
      await this.placeOrder(previousStep);
    } catch (error) {
      this.log('fatal', this.taskData.id, `Proceed to payment error: ${error.stack}`);
      await this.handleError(error.message, error, this.placeOrder);
    }
  }
  async startMainTask(mode): Promise<void> {
    /* Pre-Cart Code */
    // await this.getPreCartProduct();
    // await this.monitor(this.preCartData.pid, this.preCartData.size);
    this.mode = mode;
    await this.setPXCookies();
    if (this.taskData.preRelease) {
      this.mainCheckpoints['Pre carting'] = true;
      this.sendStatus(taskStatus.preCarting, taskColors.yellow);
      await this.monitor(this.preCartData.pid, this.preCartData.size);
      await this.addToCart();
      await this.genCSRF();
      await this.submitShipping();
      await this.submitBilling();
      await this.requests.removeFromCart(this.defaultURL.removeCartURL, this.productData.sizeID, this.checkoutData.pliUUID, this.defaultURL.baseURL, this.defaultURL.originURL);
      await this.resetTaskInfo();
      this.mainCheckpoints['Pre carting'] = false;
    }
    while (!this.stopped && !this.mainCheckpoints['Submitted order']) {
      try {
        this.log('info', this.taskData.id, 'Beginning Checkout');
        this.sendStatus(taskStatus.beginningCheckout, taskColors.yellow);
        await this.monitor(this.taskData.monitorInput, this.taskData.sizes);
        console.time('TIMER');
        await this.addToCart();
        if (!this.taskData.preRelease) {
          await this.genCSRF();
          await this.submitShipping();
          await this.submitBilling();
          await this.submitPromoCode('Submitted billing');
          await this.placeOrder('Submitted billing');
        } else {
          await this.submitPromoCode('Added to cart');
          await this.placeOrder('Added to cart');
        }
        console.timeEnd('TIMER');
      } catch (error) {
        this.log('fatal', this.taskData.id, `Main task error: ${error.stack}`);
        await this.handleError(error.message, error, this.startMainTask);
      }
    }
  }
  async startSafeTask(mode): Promise<void> {
    /* Pre-Cart Code */
    // await this.getPreCartProduct();
    // await this.monitor(this.preCartData.pid, this.preCartData.size);
    this.mode = mode;
    await this.setPXCookies();
    if (this.taskData.preRelease) {
      this.mainCheckpoints['Pre carting'] = true;
      this.sendStatus(taskStatus.preCarting, taskColors.yellow);
      await this.safeMonitor(this.preCartData.pid, this.preCartData.size);
      await this.addToCart();
      await this.genCSRF();
      await this.submitShipping();
      await this.submitBilling();
      await this.requests.removeFromCart(this.defaultURL.removeCartURL, this.productData.sizeID, this.checkoutData.pliUUID, this.defaultURL.baseURL, this.defaultURL.originURL);
      await this.resetTaskInfo();
      this.mainCheckpoints['Pre carting'] = false;
    }
    while (!this.stopped && !this.mainCheckpoints['Submitted order']) {
      try {
        this.log('info', this.taskData.id, 'Beginning Checkout');
        this.sendStatus(taskStatus.beginningCheckout, taskColors.yellow);
        await this.safeMonitor(this.taskData.monitorInput, this.taskData.sizes);
        console.time('TIMER');
        await this.addToCart();
        if (!this.taskData.preRelease) {
          await this.genCSRF();
          await this.submitShipping();
          await this.submitBilling();
          await this.submitPromoCode('Submitted billing');
          await this.placeOrder('Submitted billing');
        } else {
          await this.submitPromoCode('Added to cart');
          await this.placeOrder('Added to cart');
        }
        console.timeEnd('TIMER');
      } catch (error) {
        this.log('fatal', this.taskData.id, `Main task error: ${error.stack}`);
        await this.handleError(error.message, error, this.startMainTask);
      }
    }
  }
  async startTask(): Promise<void> {
    this.log('info', this.taskData.id, 'Starting');
    while (!this.stopped && !this.mainCheckpoints['Submitted order']) {
      try {
        const mode = this.taskData.checkoutType.includes('bank') ? 'Sofort' : 'Paypal';
        console.log('Task Type: ' + this.taskType);
        if (this.taskType === 'safe') await this.startSafeTask(mode);
        else await this.startMainTask(mode);
      } catch (error) {
        this.log('fatal', this.taskData.id, `Task error: ${error.stack}`);
        await this.handleError(error.message, error, this.startTask);
      }
    }
  }
  getShippingPayload(): object {
    let shipAddress = this.profile.shipping.address.replace(/[0-9]/g, '');
    if (shipAddress[shipAddress.length - 1] == ' ') shipAddress = shipAddress.substring(0, shipAddress.length - 1);
    if (shipAddress[0] == ' ') shipAddress = shipAddress.substring(1, shipAddress.length);
    const shipSuite = this.profile.shipping.address.replace(/\D/g, '');
    var billing;
    if (this.profile.usebilling) {
      billing = this.profile.billing;
    } else {
      billing = this.profile.shipping;
    }
    let billAddress = billing.address.replace(/[0-9]/g, '');
    if (billAddress[billAddress.length - 1] == ' ') billAddress = billAddress.substring(0, billAddress.length - 1);
    if (billAddress[0] == ' ') billAddress = billAddress.substring(1, billAddress.length);
    const billSuite = billing.address.replace(/\D/g, '');
    const payload = {
      originalShipmentUUID: this.checkoutData.shipmentUUID,
      shipmentUUID: this.checkoutData.shipmentUUID,
      dwfrm_shipping_shippingAddress_shippingMethodID: this.defaultURL.shipping.id,
      'address-selector': 'new',
      dwfrm_shipping_shippingAddress_addressFields_title: 'Herr',
      dwfrm_shipping_shippingAddress_addressFields_firstName: this.profile.firstname,
      dwfrm_shipping_shippingAddress_addressFields_lastName: this.profile.lastname,
      dwfrm_shipping_shippingAddress_addressFields_postalCode: this.profile.shipping.zip,
      dwfrm_shipping_shippingAddress_addressFields_city: this.profile.shipping.city,
      dwfrm_shipping_shippingAddress_addressFields_street: shipAddress,
      dwfrm_shipping_shippingAddress_addressFields_suite: shipSuite,
      dwfrm_shipping_shippingAddress_addressFields_address1: `${shipAddress}, ${shipSuite}`,
      dwfrm_shipping_shippingAddress_addressFields_address2: this.profile.shipping.apt,
      dwfrm_shipping_shippingAddress_addressFields_phone: this.profile.phone,
      dwfrm_shipping_shippingAddress_addressFields_countryCode: this.taskData.site,
      dwfrm_shipping_shippingAddress_shippingAddressUseAsBillingAddress: 'true',
      dwfrm_billing_billingAddress_addressFields_title: 'Herr',
      dwfrm_billing_billingAddress_addressFields_firstName: this.profile.firstname,
      dwfrm_billing_billingAddress_addressFields_lastName: this.profile.lastname,
      dwfrm_billing_billingAddress_addressFields_postalCode: billing.zip,
      dwfrm_billing_billingAddress_addressFields_city: billing.city,
      dwfrm_billing_billingAddress_addressFields_street: billAddress,
      dwfrm_billing_billingAddress_addressFields_suite: billSuite,
      dwfrm_billing_billingAddress_addressFields_address1: `${billAddress}, ${billSuite}`,
      dwfrm_billing_billingAddress_addressFields_address2: billing.apt,
      dwfrm_billing_billingAddress_addressFields_countryCode: this.taskData.site,
      dwfrm_billing_billingAddress_addressFields_phone: this.profile.phone,
      dwfrm_contact_email: this.profile.email,
      dwfrm_contact_phone: this.profile.phone,
      csrf_token: this.checkoutData.csrfToken,
    };
    return payload;
  }
  getBillingPayload(): object {
    const payload = {
      dwfrm_billing_paymentMethod: this.mode,
      dwfrm_giftCard_cardNumber: '',
      dwfrm_giftCard_pin: '',
      csrf_token: this.checkoutData.csrfToken,
    };
    return payload;
  }
  setDefaultURLs(): void {
    // eslint-disable-next-line default-case
    switch (this.taskData.site) {
      case 'ES':
        this.preCartData.pid = '00013801782570';
        this.preCartData.size = 'random';
        this.defaultURL.originURL = 'www.snipes.es';
        this.defaultURL.baseURL = 'https://www.snipes.es';
        this.defaultURL.removeCartURL = 'https://www.snipes.es/on/demandware.store/Sites-snse-SOUTH-Site/es_ES/Cart-RemoveProductLineItem';
        this.defaultURL.monitorLink = 'https://www.snipes.es/on/demandware.store/Sites-snse-SOUTH-Site/es_ES/Product-Variation';
        this.defaultURL.atcLink = 'https://www.snipes.es/on/demandware.store/Sites-snse-SOUTH-Site/es_ES/Cart-AddProduct?format=ajax';
        this.defaultURL.csrfLink = 'https://www.snipes.es/on/demandware.store/Sites-snse-SOUTH-Site/es_ES/CSRF-Generate';
        this.defaultURL.shipping.link = 'https://www.snipes.es/on/demandware.store/Sites-snse-SOUTH-Site/es_ES/CheckoutShippingServices-SubmitShipping?format=ajax';
        this.defaultURL.shipping.id = 'home-delivery_es';
        this.defaultURL.paymentLink = 'https://www.snipes.es/on/demandware.store/Sites-snse-SOUTH-Site/es_ES/CheckoutServices-SubmitPayment?format=ajax';
        this.defaultURL.submitLink = 'https://www.snipes.es/on/demandware.store/Sites-snse-SOUTH-Site/es_ES/CheckoutServices-PlaceOrder?format=ajax';
        this.defaultURL.promoLink = 'https://www.snipes.es/on/demandware.store/Sites-snse-SOUTH-Site/es_ES/Cart-AddCoupon?format=ajax';
        break;
      case 'DE':
        this.preCartData.pid = '00013801782570';
        this.preCartData.size = 'random';
        this.defaultURL.originURL = 'www.snipes.com';
        this.defaultURL.baseURL = 'https://www.snipes.com';
        this.defaultURL.removeCartURL = 'https://www.snipes.com/on/demandware.store/Sites-snse-DE-AT-Site/de_DE/Cart-RemoveProductLineItem';
        this.defaultURL.monitorLink = 'https://www.snipes.com/on/demandware.store/Sites-snse-SOUTH-Site/en_ES/Product-Variation';
        this.defaultURL.atcLink = 'https://www.snipes.com/add-product?format=ajax';
        this.defaultURL.csrfLink = 'https://www.snipes.com/on/demandware.store/Sites-snse-DE-AT-Site/de_DE/CSRF-Generate';
        this.defaultURL.shipping.link = 'https://www.snipes.com/on/demandware.store/Sites-snse-DE-AT-Site/de_DE/CheckoutShippingServices-SubmitShipping?format=ajax';
        this.defaultURL.shipping.id = 'home-delivery';
        this.defaultURL.paymentLink = 'https://www.snipes.com/on/demandware.store/Sites-snse-DE-AT-Site/de_DE/CheckoutServices-SubmitPayment?format=ajax';
        this.defaultURL.submitLink = 'https://www.snipes.com/on/demandware.store/Sites-snse-DE-AT-Site/de_DE/CheckoutServices-PlaceOrder?format=ajax';
        this.defaultURL.promoLink = 'https://www.snipes.com/on/demandware.store/Sites-snse-DE-AT-Site/de_DE/Cart-AddCoupon?format=ajax';
        break;
      case 'BE':
        this.preCartData.pid = '00013801782570';
        this.preCartData.size = 'random';
        this.defaultURL.originURL = 'www.snipes.be';
        this.defaultURL.baseURL = 'https://www.snipes.be';
        this.defaultURL.removeCartURL = 'https://www.snipes.be/on/demandware.store/Sites-snse-NL-BE-Site/nl_BE/Cart-RemoveProductLineItem';
        this.defaultURL.monitorLink = 'https://www.snipes.be/on/demandware.store/Sites-snse-NL-BE-Site/nl_BE/Product-Variation';
        this.defaultURL.atcLink = 'https://www.snipes.be/on/demandware.store/Sites-snse-NL-BE-Site/nl_BE/Cart-AddProduct?format=ajax';
        this.defaultURL.csrfLink = 'https://www.snipes.be/on/demandware.store/Sites-snse-NL-BE-Site/nl_BE/CSRF-Generate';
        this.defaultURL.shipping.link = 'https://www.snipes.be/on/demandware.store/Sites-snse-NL-BE-Site/nl_BE/CheckoutShippingServices-SubmitShipping?format=ajax';
        this.defaultURL.shipping.id = 'home-delivery_be';
        this.defaultURL.paymentLink = 'https://www.snipes.be/on/demandware.store/Sites-snse-NL-BE-Site/nl_BE/CheckoutServices-SubmitPayment?format=ajax';
        this.defaultURL.submitLink = 'https://www.snipes.be/on/demandware.store/Sites-snse-NL-BE-Site/nl_BE/CheckoutServices-PlaceOrder?format=ajax';
        this.defaultURL.promoLink = 'https://www.snipes.be/on/demandware.store/Sites-snse-NL-BE-Site/nl_BE/Cart-AddCoupon?format=ajax';
        break;
      case 'FR':
        this.preCartData.pid = '00013801782570';
        this.preCartData.size = 'random';
        this.defaultURL.originURL = 'www.snipes.fr';
        this.defaultURL.baseURL = 'https://www.snipes.fr';
        this.defaultURL.removeCartURL = 'https://www.snipes.fr/on/demandware.store/Sites-snse-FR-Site/fr_FR/Cart-RemoveProductLineItem';
        this.defaultURL.monitorLink = 'https://www.snipes.fr/on/demandware.store/Sites-snse-FR-Site/fr_FR/Product-Variation';
        this.defaultURL.atcLink = 'https://www.snipes.fr/on/demandware.store/Sites-snse-FR-Site/fr_FR/Cart-AddProduct?format=ajax';
        this.defaultURL.csrfLink = 'https://www.snipes.fr/on/demandware.store/Sites-snse-FR-Site/fr_FR/CSRF-Generate';
        this.defaultURL.shipping.link = 'https://www.snipes.fr/on/demandware.store/Sites-snse-FR-Site/fr_FR/CheckoutShippingServices-SubmitShipping?format=ajax';
        this.defaultURL.shipping.id = 'home-delivery_fr';
        this.defaultURL.paymentLink = 'https://www.snipes.fr/on/demandware.store/Sites-snse-FR-Site/fr_FR/CheckoutServices-SubmitPayment?format=ajax';
        this.defaultURL.submitLink = 'https://www.snipes.fr/on/demandware.store/Sites-snse-FR-Site/fr_FR/CheckoutServices-PlaceOrder?format=ajax';
        this.defaultURL.promoLink = 'https://www.snipes.fr/on/demandware.store/Sites-snse-FR-Site/fr_FR/Cart-AddCoupon?format=ajax';
        break;
      case 'NL':
        this.preCartData.pid = '00013801782570';
        this.preCartData.size = 'random';
        this.defaultURL.originURL = 'www.snipes.nl';
        this.defaultURL.baseURL = 'https://www.snipes.nl';
        this.defaultURL.removeCartURL = 'https://www.snipes.nl/on/demandware.store/Sites-snse-NL-BE-Site/nl_NL/Cart-RemoveProductLineItem';
        this.defaultURL.monitorLink = 'https://www.snipes.nl/on/demandware.store/Sites-snse-NL-BE-Site/nl_NL/Product-Variation';
        this.defaultURL.atcLink = 'https://www.snipes.nl/on/demandware.store/Sites-snse-NL-BE-Site/nl_NL/Cart-AddProduct?format=ajax';
        this.defaultURL.csrfLink = 'https://www.snipes.nl/on/demandware.store/Sites-snse-NL-BE-Site/nl_NL/CSRF-Generate';
        this.defaultURL.shipping.link = 'https://www.snipes.nl/on/demandware.store/Sites-snse-NL-BE-Site/nl_NL/CheckoutShippingServices-SubmitShipping?format=ajax';
        this.defaultURL.shipping.id = 'home-delivery_nl';
        this.defaultURL.paymentLink = 'https://www.snipes.nl/on/demandware.store/Sites-snse-NL-BE-Site/nl_NL/CheckoutServices-SubmitPayment?format=ajax';
        this.defaultURL.submitLink = 'https://www.snipes.nl/on/demandware.store/Sites-snse-NL-BE-Site/nl_NL/CheckoutServices-PlaceOrder?format=ajax';
        this.defaultURL.promoLink = 'https://www.snipes.nl/on/demandware.store/Sites-snse-NL-BE-Site/nl_NL/Cart-AddCoupon?format=ajax';
        break;
      case 'IT':
        this.preCartData.pid = '00013801782570';
        this.preCartData.size = 'random';
        this.defaultURL.originURL = 'www.snipes.it';
        this.defaultURL.baseURL = 'https://www.snipes.it';
        this.defaultURL.removeCartURL = 'https://www.snipes.it/on/demandware.store/Sites-snse-SOUTH-Site/it_IT/Cart-RemoveProductLineItem';
        this.defaultURL.monitorLink = 'https://www.snipes.it/on/demandware.store/Sites-snse-SOUTH-Site/it_IT/Product-Variation';
        this.defaultURL.monitorLink = 'https://www.snipes.it/on/demandware.store/Sites-snse-SOUTH-Site/it_IT/Cart-AddProduct?format=ajax';
        this.defaultURL.csrfLink = 'https://www.snipes.it/on/demandware.store/Sites-snse-SOUTH-Site/it_IT/CSRF-Generate';
        this.defaultURL.shipping.link = 'https://www.snipes.it/on/demandware.store/Sites-snse-SOUTH-Site/it_IT/CheckoutShippingServices-SubmitShipping?format=ajax';
        this.defaultURL.shipping.id = 'home-delivery_it';
        this.defaultURL.paymentLink = 'https://www.snipes.it/on/demandware.store/Sites-snse-SOUTH-Site/it_IT/CheckoutServices-SubmitPayment?format=ajax';
        this.defaultURL.submitLink = 'https://www.snipes.it/on/demandware.store/Sites-snse-SOUTH-Site/it_IT/CheckoutServices-PlaceOrder?format=ajax';
        this.defaultURL.promoLink = 'https://www.snipes.it/on/demandware.store/Sites-snse-SOUTH-Site/it_IT/Cart-AddCoupon?format=ajax';
        break;
    }
  }
  resetTaskInfo(): void {
    for (let i = 0; i < Object.keys(this.mainCheckpoints).length; i++) {
      this.mainCheckpoints[Object.keys(this.mainCheckpoints)[i]] = false;
    }
    for (let i = 0; i < Object.keys(this.productData).length; i++) {
      if (typeof this.productData[Object.keys(this.productData)[i]] == 'boolean') {
        this.productData[Object.keys(this.productData)[i]] = false;
      } else {
        this.productData[Object.keys(this.productData)[i]] = '';
      }
    }
    this.productPage = {};
    this.foundSizes = {};
  }
  // eslint-disable-next-line class-methods-use-this
  randomNumber(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  async handleError(message, error, method): Promise<void> {
    if (this.stopped) return;
    if (message.indexOf('tunneling socket could not be established') !== -1 || message.indexOf('EPROTO') !== -1 || message.indexOf('socket hang up') !== -1) {
      this.log('fatal', this.taskData.id, `Proxy error: ${message}`);
      this.sendStatus(taskStatus.proxyError, taskColors.red);
      // Switch proxy
      this.rotateProxy();
      await this.pause(this.errorDelay);
      // Call the method that threw the error
      await method.bind(this)();
      return;
    }
    if (error.statusCode == 410) {
      this.log('fatal', this.taskData.id, `Product not found: ${message}`);
      this.sendStatus(`${taskStatus.productNotFound}`, taskColors.red);
      this.stopped = true;
      return;
    }
    if (error.statusCode === 429) {
      this.log('fatal', this.taskData.id, `${taskStatus.proxyBanned} ${error.statusCode} \n ${message}`);
      this.sendStatus(`${taskStatus.proxyBanned} ${error.statusCode}`, taskColors.red);
      // Switch proxy
      this.rotateProxy();
      await this.pause(this.errorDelay);
      // Call the method that threw the error
      await method.bind(this)();
      return;
    }
    // Todo: handle px captcha
    if (error.statusCode === 403) {
      this.log('fatal', this.taskData.id, `Blocked by PX \n ${message}`);
      this.sendStatus(`${taskStatus.pxBlocked} ${error.statusCode}`, taskColors.red);
      // Switch proxy
      this.rotateProxy();
      await this.pause(this.errorDelay);
      // Call the method that threw the error
      await method.bind(this)();
      return;
    }
    if (message.indexOf('ESOCKETTIMEDOUT') !== -1 || message.indexOf('Too many requests') !== -1) {
      this.log('fatal', this.taskData.id, `Timeout ${error.statusCode}`);
      this.sendStatus(taskStatus.timeout, taskColors.red);
      // Switch proxy
      this.rotateProxy();
      await this.pause(this.errorDelay);
      // Call the method that threw the error
      await method.bind(this)();
      return;
    }
    this.sendStatus(`${taskStatus.taskError} ${error.statusCode ? error.statusCode : ''}`, taskColors.red);
    this.log('fatal', this.taskData.id, `Task error, retrying: ${message}`);
    // Switch proxy
    this.rotateProxy();
    await this.pause(this.errorDelay);
    // Call the method that threw the error
    await method.bind(this)();
  }
  rotateProxy(): void {
    this.requests.saveProxy();
  }
}
export default SnipesMain;
