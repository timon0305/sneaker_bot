/* eslint-disable consistent-return */
/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
import Events from 'events';
import cheerio from 'cheerio';
import _ from 'underscore';

import ShopifyMain from '../main/shopify-main';
import monitorManager from '../../../managers/monitor-manager';
import ShopifyMonitor from '../main/new-monitor';
import ShopifySafeRequests from './new-safe-requests';

import { ITaskData, IProfile, ICaptchaRequest } from '../../../interfaces/index';
import taskStatus from '../../../helpers/task-status';
import taskColors from '../../../helpers/task-colors';
/**
 * Ideas:
 * - Instead of waiting for restock on the checkout page wait until variant is in stock in /product.json?
 *
 */
class ShopifySafe extends ShopifyMain {
  monitor: ShopifyMonitor;
  emitter: Events.EventEmitter;
  safeRequests: ShopifySafeRequests;
  checkpoints: {
    'Logged in': boolean;
    'Solved checkpoint': boolean;
    'Got homepage': boolean;
    'Created checkout': boolean;
    'Added to cart': boolean;
    'Proceeded to checkout': boolean;
    'Submitted customer': boolean;
    'Got shipping rate': boolean;
    'Submitted shipping': boolean;
    'Got payment page': boolean;
  };
  captchaToken: string;
  captchaSession: string;
  captchaSitekey: string;
  checkoutURL: string;
  checkoutToken: string;
  foundProduct: {
    size?: string;
    variant?: string | string[] | number;
    special?: { dsmHash?: string; cartForm?: any };
    price?: string;
    image?: string;
    name?: string;
  };
  browserWidth: number;
  browserHeight: number;
  customerPayload: any;
  scrapedForm: any;
  requiresCaptcha: boolean;
  browserData: {
    'checkout[client_details][browser_width]': number;
    'checkout[client_details][browser_height]': number;
    'checkout[client_details][javascript_enabled]': number;
    'checkout[client_details][color_depth]': number;
    'checkout[client_details][java_enabled]': boolean;
    'checkout[client_details][browser_tz]': number;
  };
  shippingPayload: {
    _method: string;
    authenticity_token: string;
    previous_step: string;
    step: string;
    'checkout[shipping_rate][id]': string;
  };
  paymentPage: any;
  paymentPayload: any;
  cardPayload: { credit_card: { number: string; verification_value: string; name: string; month: string; year: string } };
  orderPayload: any;
  taskState: { restock: { active: boolean; restockURL: string } };
  constructor(taskData: ITaskData, profile: IProfile, proxies) {
    super(taskData, profile, proxies);
    this.taskData = taskData;
    this.profile = profile;

    this.monitor = monitorManager.getMonitor(this.taskData.id);

    this.emitter = new Events.EventEmitter();

    this.safeRequests = new ShopifySafeRequests(taskData, proxies);

    this.checkpoints = {
      'Logged in': false,
      'Got homepage': false,
      'Solved checkpoint': false,
      'Created checkout': false,
      'Added to cart': false,
      'Proceeded to checkout': false,
      'Submitted customer': false,
      'Got shipping rate': false,
      'Submitted shipping': false,
      'Got payment page': false,
    };
    this.taskState = {
      restock: {
        active: false,
        restockURL: '',
      },
    };

    this.captchaToken = null;
    this.captchaSession = null;
    this.captchaSitekey = null;
    this.requiresCaptcha = false;

    this.checkoutURL = null;
    this.checkoutToken = null;

    this.foundProduct = null;

    this.paymentPage = null;

    this.emitter.addListener(`product-found-${this.taskData.id}`, (product) => {
      this.foundProduct = product;
    });
    this.browserHeight = this.randomNumber(600, 1400);
    this.browserWidth = this.randomNumber(500, 800);

    this.setCustomerPayload();
    this.setShippingPayload();
    this.setPaymentPayload();
    this.setOrderPayload();
    this.setBrowserData();
    this.setCardPayload();
  }
  async login(redirectURL = null): Promise<void> {
    if (this.stopped || this.checkpoints['Logged in'] || !this.taskData.requireLogin) return;
    try {
      const payload = {
        form_type: 'customer_login',
        utf8: '✓',
        'customer[email]': '',
        'customer[password]': '',
        return_url: redirectURL || '/account',
      };
      if (this.taskData.useAccountPool) {
        const randomAccount = this.getAccountFromPool(this.taskData.accountPool);
        // eslint-disable-next-line prefer-destructuring
        payload['customer[email]'] = randomAccount[0];
        // eslint-disable-next-line prefer-destructuring
        payload['customer[password]'] = randomAccount[1];
      }
      console.log(payload);
      let response = await this.safeRequests.login(payload);
      if (response.statusCode !== 200) {
        this.sendStatus('Login error', taskColors.red);
        this.log('fatal', this.taskData.id, `Login error: ${response.statusCode}`);
        await this.pause(this.taskData.retryDelay);
        await this.login();
      }
      if (response.body.includes('Invalid login credentials.')) {
        this.sendStatus('Invalid login', taskColors.yellow);
        this.log('info', this.taskData.id, 'Invalid login');
        this.stopped = true;
      } else if (response.body.includes('sitekey')) {
        this.log('info', this.taskData.id, 'Waiting for captcha to login');
        this.getCaptchaData(response.body);
        await this.waitForCaptcha(
          {
            site: `http://${new URL(this.taskData.site).host}`,
            sitekey: this.captchaSitekey,
            taskID: this.taskData.id,
            harvesterType: this.harvesterTypes.shopify,
          },
          'login',
        );
        payload['g-recaptcha-response'] = this.captchaToken;
        try {
          response = await this.safeRequests.login(payload);
          if (response.body.indexOf('sitekey') === -1) {
            this.log('info', this.taskData.id, 'Logged in after captcha verication');
            this.checkpoints['Logged in'] = true;
            this.resetCaptchaData();
          }
        } catch (err) {
          this.log('fatal', this.taskData.id, 'Error verifying captcha login');
          await this.handleError(err, this.login, 'login');
        }
      } else {
        this.log('info', this.taskData.id, 'logged in');
        this.sendStatus('Logged in', taskColors.yellow);
        this.checkpoints['Logged in'] = true;
        this.resetCaptchaData();
      }
    } catch (error) {
      await this.handleError(error, this.login, 'login');
    }
  }
  async waitQueue(): Promise<any> {
    this.log('info', this.taskData.id, `Checkout URL entering queue: ${this.checkoutURL}`);
    const currentTaskLocation = this.checkoutURL.includes('?step=contact_information') ? this.checkoutURL.replace('?step=contact_information', '') : this.checkoutURL;
    let currenStatusCode = 202;
    let queueResponse;
    // 5s because this is what shopify does
    const queueDelay = 5000;
    while (currenStatusCode === 202 && !this.stopped) {
      try {
        this.log('info', this.taskData.id, 'Queue');
        this.sendStatus(taskStatus.queue, taskColors.blue);
        await this.pause(queueDelay);
        queueResponse = await this.safeRequests.pollQueue(currentTaskLocation);
        if (this.stopped) return;
        currenStatusCode = queueResponse.statusCode;
        if (currenStatusCode === 200) {
          queueResponse = await this.safeRequests.getCheckoutAfterQueue(currentTaskLocation);
          const url = new URL(queueResponse.headers.location || queueResponse.headers.location);
          this.checkoutURL = url.origin + url.pathname;
          this.checkoutToken = url.pathname.substring(url.pathname.indexOf('/checkouts/') + 11);
          if (this.monitor.startedMonitor && !this.foundProduct) {
            /**
             * In the case we queue and monitor at the same time, if the monitor is still
             * trying to find the product we reset the monitor status
             */
            this.monitor.lastStatus = '';
          }
          this.log('info', this.taskData.id, `Passed queue, new checkout url: ${this.checkoutURL}`);
          break;
        }
      } catch (error) {
        await this.handleError(error, this.waitQueue, 'waitQueue');
      }
    }
    // eslint-disable-next-line consistent-return
    return queueResponse;
  }
  /**
   * If we create checkout and there is a queue active we can start the monitor
   * and also enter queue at the same time
   */
  async queueAndMonitor(): Promise<void> {
    if (!this.checkoutURL.match(/queue|throttle/) || this.stopped) return;
    try {
      if (this.checkoutURL.match(/queue|throttle/)) {
        this.log('info', this.taskData.id, 'Entering queue');
        await Promise.all([this.waitQueue(), this.prepareTask()]);
      }
    } catch (error) {
      await this.handleError(error, this.queueAndMonitor, 'queueAndMonitor');
    }
  }
  async waitForRestockInPage(): Promise<any> {
    try {
      let currentPage = await this.requests.getEndpoint(this.taskState.restock.restockURL);
      const { path } = currentPage.request;
      while ((path.indexOf('stock_problems') !== -1 || path.indexOf('checkout') === -1) && !this.stopped) {
        this.sendStatus(taskStatus.restock, taskColors.yellow);
        this.log('info', this.taskData.id, 'Waiting for restock');
        await this.pause(this.taskData.monitorDelay);
        currentPage = await this.requests.getEndpoint(this.taskState.restock.restockURL);
      }
      this.log('info', this.taskData.id, 'Finished restock monitor');
      return currentPage;
    } catch (error) {
      await this.handleError(error, this.waitForRestockInPage, 'waitForRestockInPage');
    }
  }
  async solveCheckpoint(referer: string, token: string): Promise<void> {
    if (this.stopped || this.checkpoints['Solved checkpoint']) return;
    const captchaUrl = new URL(this.taskData.site);
    try {
      await this.waitForCaptcha(
        {
          site: `http://${captchaUrl.host}${captchaUrl.pathname}`,
          sitekey: this.captchaSitekey,
          session: this.captchaSession,
          taskID: this.taskData.id,
          harvesterType: this.harvesterTypes.shopify,
        },
        'checkpoint',
      );
      const checkpointPayload = {
        authenticity_token: token,
        'g-recaptcha-response': this.captchaToken,
        commit: '',
      };
      this.sendStatus('Solving checkpoint', taskColors.yellow);
      this.log('info', this.taskData.id, 'Solving checkpoint');
      const response = await this.safeRequests.solveCheckpoint(this.shopifyUrlEncoded(checkpointPayload), referer);
      if (!response.headers.location.includes('checkout') && !response.headers.location.includes('queue')) {
        this.log('fatal', this.taskData.id, `Checkpoint not solved, retrying. ${response.headers.location}`);
        this.checkCheckoutURL();
        return;
      }
      this.checkoutURL = response.headers.location;
      const url = new URL(this.checkoutURL);
      this.checkoutToken = url.pathname.substring(url.pathname.indexOf('/checkouts/') + 11);
      this.log('info', this.taskData.id, `Created checkout url: ${this.checkoutURL}`);
      await this.queueAndMonitor();
      this.resetCaptchaData();
      this.checkpoints['Solved checkpoint'] = true;
    } catch (error) {
      await this.handleError(error, this.solveCheckpoint, 'solveCheckpoint');
    }
  }
  /**
   * Gets main site home page with google as referer
   */
  async getHomePage(): Promise<void> {
    if (this.stopped || this.checkpoints['Got homepage']) return;
    try {
      const response = await this.safeRequests.getChromeHeaders(this.taskData.site, 'https://www.google.com/');
      switch (response.statusCode) {
        case 200:
          this.log('info', this.taskData.id, 'Got home page');
          this.checkpoints['Got homepage'] = true;
          break;
        case 401:
          // In this case we dont need to keep checking if the password page still up or not
          this.log('warning', this.taskData.id, 'Password page while trying to get home page');
          this.checkpoints['Got homepage'] = true;
          break;
        default:
          this.requests.saveProxy();
          this.log('fatal', this.taskData.id, `Unknown home page response: ${response.body}`);
          break;
      }
    } catch (error) {
      await this.handleError(error, this.getHomePage, 'getHomePage');
    }
  }
  /**
   * Start monitor and get any special properties sites require
   */
  async prepareTask(): Promise<void> {
    if (this.stopped || this.foundProduct) return;
    try {
      await this.monitor.startMonitor(this.emitter);
    } catch (error) {
      await this.handleError(error, this.prepareTask, 'prepareTask');
    }
  }
  async createCheckout(): Promise<void> {
    if (this.stopped || this.checkpoints['Created checkout']) return;
    try {
      if (this.taskData.site.includes('dover')) {
        // after getting the product create checkout url without preload
        await this.prepareTask();
        return;
      }
      // Todo: add non-preload and pre-load modes to front end
      await this.createCheckoutPreload();
      // await this.createCheckoutFast();
    } catch (error) {
      await this.handleError(error, this.createCheckout, 'createCheckout');
    }
  }
  /**
   * Creates a checkout url with a random in stock variant
   */
  async createCheckoutPreload(): Promise<void> {
    if (this.stopped || this.checkpoints['Created checkout']) return;
    try {
      this.log('info', this.taskData.id, 'Creating pre-load checkout');
      this.sendStatus(taskStatus.creatingCheckout, taskColors.yellow);
      const preloadProduct = await this.monitor.getPreloadVariant();
      // If there are no other variants in stock then we create the checkout url without it
      if (typeof preloadProduct === 'undefined') {
        this.log('warning', this.taskData.id, 'Creating checkout without preload variant');
        await this.createCheckoutFast();
        return;
      }
      await this.preCart();
      this.setShopifyCookies();
      // Parallelly create checkout and monitor
      await Promise.all([this.proceedToCheckout(), this.prepareTask()]);
      await this.removePreCart();
      if (this.checkoutURL) {
        this.checkpoints['Created checkout'] = true;
      }
    } catch (error) {
      await this.handleError(error, this.createCheckoutPreload, 'createCheckoutPreload');
    }
  }
  /**
   * Creates checkout without preload variant
   */
  async createCheckoutFast(): Promise<void> {
    if (this.stopped || this.checkpoints['Created checkout']) return;
    try {
      let response = await this.safeRequests.createCheckout();
      switch (response.statusCode) {
        case 302:
          if (response.request.href.includes('checkpoint')) {
            this.getCaptchaData(response.body);
            this.log('warning', this.taskData.id, 'Checkpoint found');
            await this.solveCheckpoint(response.request.href, this.getAuthToken(response.body));
          }
          this.checkoutURL = response.headers.location;
          if (this.checkoutURL.includes('throttle')) {
            response = await this.waitQueue();
          }
          // eslint-disable-next-line no-case-declarations
          const url = new URL(this.checkoutURL);
          this.checkoutToken = url.pathname.substring(url.pathname.indexOf('/checkouts/') + 11);
          this.log('info', this.taskData.id, `Created checkout url: ${this.checkoutURL}`);
          await this.checkCheckoutURL();
          this.checkpoints['Created checkout'] = true;
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response creating checkout - ${response.statusCode}: ${response.body}`);
          this.safeRequests.saveProxy();
          await this.pause(this.taskData.retryDelay);
          await this.createCheckoutFast();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.createCheckoutFast);
    }
  }
  /**
   * Carts the preload product
   */
  async preCart(): Promise<void> {
    if (this.stopped || this.checkpoints['Created checkout']) return;

    console.log('this.monitor.preloadProduct.url');
    console.log(this.monitor.preloadProduct.url);
    console.log('this.monitor.preloadProduct.variant');
    console.log(this.monitor.preloadProduct.variant);

    try {
      const response = await this.safeRequests.preCart(this.monitor.preloadProduct.url, this.monitor.preloadProduct.variant);
      switch (response.statusCode) {
        case 200:
          this.log('info', this.taskData.id, 'Pre-loaded product');
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response pre-loading: ${response.statusCode}`);
          await this.monitor.getPreloadVariant();
          await this.pause(this.taskData.retryDelay);
          await this.preCart();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.preCart, 'preCart');
    }
  }
  async removePreCart(): Promise<void> {
    if (this.stopped || this.checkpoints['Created checkout']) return;
    try {
      await this.safeRequests.removePreCart(`${this.taskData.site}/cart`);
      const response = await this.safeRequests.getXML(`${this.taskData.site}/cart.json`, this.safeRequests.currentProxy, this.checkoutURL);
      switch (response.statusCode) {
        case 200:
          if (!response.body) {
            this.log('fatal', this.taskData.id, `Error removing pre-load product: ${response.statusCode}`);
            break;
          }
          this.log('info', this.taskData.id, 'Removed pre-load product');
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response: ${response.body}`);
          break;
      }
    } catch (error) {
      await this.handleError(error, this.removePreCart, 'removePreCart');
    }
  }
  /**
   * Gets the checkout url if it doesnt exist or goes to the checkout page
   */
  async proceedToCheckout(): Promise<void> {
    if (this.stopped || this.checkpoints['Proceeded to checkout']) return;
    try {
      // Todo: !this.checkoutURL && mode === 'preload'
      if (!this.checkoutURL) {
        console.log('here 1-1');
        const payload = await this.proceedToCheckoutPayload(this.monitor.preloadProduct.variant);
        console.log('here 1-2');
        const response = await this.safeRequests.proceedToCheckout(/* this.shopifyUrlEncoded( */ payload /* ) */);
        console.log('here 1-3');
        if (response.headers.location.includes('checkpoint')) {
          console.log('here 1-4');
          this.getCaptchaData(response.body);
          console.log('here 1-5');
          this.log('warning', this.taskData.id, 'Checkpoint found');
          await this.solveCheckpoint(response.headers.location, this.getAuthToken(response.body));
          console.log('here 1-6');
          return;
        }
        console.log('here 2-1');
        this.checkoutURL = response.headers.location;
        await this.checkCheckoutURL();
        console.log('here 2-2');
        const url = new URL(this.checkoutURL);
        this.checkoutToken = url.pathname.substring(url.pathname.indexOf('/checkouts/') + 11);
        this.log('info', this.taskData.id, `Created checkout url: ${this.checkoutURL}`);
        console.log('here 3');
        await this.queueAndMonitor();
      } else {
        console.log('here 4');
        if (this.checkoutURL.includes('throttle')) {
          await this.waitQueue();
        }
        await this.checkCheckoutURL();
        console.log('here 5');
        this.log('info', this.taskData.id, 'Proceeding to checkout');
        this.sendStatus(taskStatus.proceedingCeckout, taskColors.yellow);
        this.safeRequests.cookieJar.setCookie('checkout_locale=en', this.taskData.site);
        this.setCartTimeStampCookie();
        if (this.stopped) return;
        let response = await this.safeRequests.getChromeHeaders(`${this.checkoutURL}?step=contact_information`, `${this.taskData.site}/cart`);
        console.log('here 6');
        if (response.redirectUrls.includes('checkpoint')) {
          this.getCaptchaData(response.body);
          const location = response.redirectUrls[response.redirectUrls.reverse().reduce((a, v, i) => (v.indexOf('checkpoint') !== -1 ? Math.abs(i - response.redirectUrls.length + 1) : a), -1)];
          this.log('warning', this.taskData.id, 'Checkpoint found after creating checkout');
          await this.solveCheckpoint(location, this.getAuthToken(response.body));
          // Todo: should we submit customer info after this?
          console.log('here 7');
          await this.proceedToCheckout();
          return;
        }
        console.log('here 8');
        if (response.redirectUrls.includes('stock_problems')) {
          console.log('here 8-1');
          this.checkoutURL = response.redirectUrls[response.redirectUrls.reverse().reduce((a, v, i) => (v.indexOf('stock_problems') !== -1 ? Math.abs(i - response.redirectUrls.length + 1) : a), -1)];
          this.taskState.restock.active = true;
          this.taskState.restock.restockURL = `${this.checkoutURL}?step=contact_information`;
          response = await this.waitForRestockInPage();
          return;
        }
        console.log('here 9');
        if (response.request.requestUrl.includes('throttle')) {
          console.log('here 9-1');
          response = await this.waitQueue();
        }
        console.log('here 10');
        if (response.body && response.body.includes('sitekey')) {
          console.log('here 10-1');
          this.getCaptchaData(response.body);
          this.requiresCaptcha = true;
        }
        console.log('here 11');
        this.setCheckoutCookies();
        console.log(response.body);
        console.log(response.redirectUrls);
        this.customerPayload.authenticity_token = this.getAuthToken(response.body);
        this.customerPayload = this.scrapePayload('form:has(input[id=checkout_shipping_address_first_name])', response.body, this.customerPayload);
        console.log('here 12');
        this.checkpoints['Proceeded to checkout'] = true;
      }
    } catch (error) {
      await this.handleError(error, this.proceedToCheckout, 'proceedToCheckout');
    }
  }
  async addToCart(): Promise<void> {
    if (this.stopped || this.checkpoints['Added to cart']) return;
    try {
      this.log('info', this.taskData.id, 'Adding to cart');
      this.sendStatus(taskStatus.carting, taskColors.yellow, this.foundProduct.name);
      const payload = this.cartPayload(this.foundProduct.variant as number);
      const response = await this.safeRequests.addToCart(this.shopifyUrlEncoded(payload), this.monitor.productURL);
      switch (response.statusCode) {
        case 200:
          this.setProductData(response);
          this.sendStatus(taskStatus.carting, taskColors.yellow, this.foundProduct.name);
          break;
        case 422:
          this.log('info', this.taskData.id, 'OOS, retrying');
          this.sendStatus(taskStatus.oos, taskColors.yellow);
          // await this.monitor.monitorVariant(this.foundProduct.variant);
          await this.pause(this.taskData.monitorDelay);
          await this.addToCart();
          break;
        case 400:
          // If we already have the product (variant mode) then keep trying to atc
          if (this.foundProduct) {
            this.log('info', this.taskData.id, 'Waiting for product');
            this.sendStatus(taskStatus.waitingProduct, taskColors.yellow);
          }
          await this.pause(this.taskData.monitorDelay);
          await this.addToCart();
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected ATC response: ${response.statusCode}`);
          await this.pause(this.taskData.retryDelay);
          this.safeRequests.saveProxy();
          await this.addToCart();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.addToCart, 'addToCart');
    }
  }
  async submitCustomer(): Promise<void> {
    if (this.stopped || !this.checkpoints['Proceeded to checkout'] || this.checkpoints['Submitted customer']) return;
    try {
      this.sendStatus(taskStatus.submittingInformation, taskColors.yellow);
      this.log('info', this.taskData.id, 'Submitting information');
      // Make a copy of the payload we currently have
      const payload = JSON.parse(JSON.stringify(this.customerPayload));
      const captchaURL = new URL(this.checkoutURL);

      if (this.requiresCaptcha) {
        await this.waitForCaptcha(
          {
            site: `http://${captchaURL.host}${captchaURL.pathname}`,
            sitekey: this.captchaSitekey,
            session: this.captchaSession,
            taskID: this.taskData.id,
            harvesterType: this.harvesterTypes.shopifyCheckout,
          },
          'checkout',
        );
        payload['g-recaptcha-response'] = this.captchaToken;
      }
      const encodedCustomer = this.encodeCustomer(payload);
      if (this.stopped) return;
      // For visual puposes we send this status again
      this.sendStatus(taskStatus.submittingInformation, taskColors.yellow);
      let response = await this.safeRequests.patchEndpoint(`${this.checkoutURL}?step=contact_information`, encodedCustomer, this.safeRequests.currentProxy);
      if (response.request.requestUrl.includes('stock_problems')) {
        this.log('info', this.taskData.id, 'Product went OOS and customer infomation page');
        this.taskState.restock.active = true;
        this.taskState.restock.restockURL = `${this.checkoutURL}?step=contact_information`;
        response = await this.waitForRestockInPage();
        return;
      }
      if (response.request.requestUrl.includes('throttle')) {
        response = await this.waitQueue();
        return;
      }

      const captchaValidationFailed = response.body.includes('Captcha validation failed. Please try again.');
      const contactInformationMessage = response.request.requestUrl.includes('contact_information');
      const requiresShippingMethod = !response.request.requestUrl.includes('shipping_method');

      if (captchaValidationFailed || (contactInformationMessage && requiresShippingMethod)) {
        this.log('warning', this.taskData.id, 'Back at customer information page, retrying');
        this.customerPayload.authenticity_token = this.getAuthToken(response.body);
        // this.submittedCaptcha = false;
        await this.submitCustomer();
      }
      this.shippingPayload.authenticity_token = this.getAuthToken(response.body);
      this.shippingPayload = this.scrapePayload('form:has(input[id^=checkout_shipping_rate_id])', response.body, this.shippingPayload);
      this.resetCaptchaData();
      this.checkpoints['Submitted customer'] = true;
    } catch (error) {
      await this.handleError(error, this.submitCustomer, 'submitCustomer');
    }
  }
  async getShippingRate(): Promise<void> {
    if (this.stopped || this.checkpoints['Got shipping rate']) return;
    if (this.taskData.useShippingRate) {
      this.log('info', this.taskData.id, `Using task shipping rate: ${this.taskData.shippingRate}`);
      this.shippingPayload['checkout[shipping_rate][id]'] = this.taskData.shippingRate;
    }
    try {
      this.log('info', this.taskData.id, 'Getting shipping rate');
      this.sendStatus(taskStatus.waitingRates, taskColors.yellow);
      const rateData = {
        'shipping_address[zip]': this.customerPayload['checkout[shipping_address][zip]'],
        'shipping_address[country]': this.customerPayload['checkout[shipping_address][country]'],
        'shipping_address[province]': this.customerPayload['checkout[shipping_address][province]'],
      };
      const encodedPayload = this.shopifyUrlEncoded(rateData);
      const response = await this.safeRequests.getShippingRate(encodedPayload);
      if (response.body.includes('is not supported')) {
        this.sendStatus('Country not supported', taskColors.red);
        this.log('fatal', this.taskData.id, 'Country not supported, stopping task');
        this.stopped = true;
        return;
      }
      const rates = JSON.parse(response.body).shipping_rates[0];
      this.shippingPayload['checkout[shipping_rate][id]'] = `${rates.source}-${encodeURI(rates.code)}-${rates.price}`;
      this.checkpoints['Got shipping rate'] = true;
    } catch (error) {
      await this.handleError(error, this.getShippingRate, 'getShippingRate');
    }
  }
  async submitShipping(): Promise<void> {
    if (this.stopped || !this.checkpoints['Submitted customer'] || this.checkpoints['Submitted shipping']) return;
    try {
      this.sendStatus(taskStatus.submittingShipping, taskColors.yellow);
      this.log('info', this.taskData.id, 'Submitting shipping');
      const payload = this.encodeShipping();
      // Set payment page to use extract data
      this.paymentPage = await this.safeRequests.patchEndpoint(`${this.checkoutURL}?previous_step=contact_information&step=shipping_information`, payload, this.safeRequests.currentProxy);
      if (this.paymentPage.request.path.includes('throttle')) {
        this.paymentPage = await this.waitQueue();
      }
      if (this.paymentPage.request.path.includes('stock_problems')) {
        this.taskState.restock.active = true;
        this.taskState.restock.restockURL = `${this.checkoutURL}?previous_step=shipping_information&step=payment_method`;
        this.paymentPage = await this.waitForRestockInPage();
      }

      const responseIncludesShippingMethodQuestion = this.paymentPage.request.path.includes('shipping_method');
      const responseIsNotPaymentMethodPage = !this.paymentPage.request.path.includes('payment_method');

      if (responseIncludesShippingMethodQuestion && responseIsNotPaymentMethodPage) {
        this.log('warning', this.taskData.id, 'Back at shipping page');
        this.shippingPayload.authenticity_token = this.getAuthToken(this.paymentPage.body);
        await this.pause(this.taskData.retryDelay);
      }
      this.checkpoints['Submitted shipping'] = true;
    } catch (error) {
      await this.handleError(error, this.submitShipping, 'submitShipping');
    }
  }
  async getPaymentPage(): Promise<void> {
    if (this.stopped || !this.checkpoints['Submitted shipping'] || this.checkpoints['Got payment page']) return;
    try {
      this.log('info', this.taskData.id, 'Getting payment page');
      this.sendStatus('Getting payment page', taskColors.yellow);
      if (!this.paymentPage || (this.paymentPage && !this.paymentPage.body)) {
        this.log('warning', this.taskData.id, 'Payment page not available, retrying');
        this.sendStatus('Getting payment page', taskColors.yellow);
        this.paymentPage = await this.safeRequests.getChromeHeaders(
          `${this.checkoutURL}?previous_step=shipping_method&step=payment_method`,
          `${this.checkoutURL}?previous_step=contact_information&step=shipping_information`,
        );
        await this.getPaymentPage();
      }
      while (this.paymentPage.body.includes('Calculating taxes')) {
        if (this.stopped) return;
        this.log('info', this.taskData.id, 'Calculating taxes');
        this.sendStatus(taskStatus.caculatingTaxes, taskColors.yellow);
        this.paymentPage = await this.safeRequests.getXML(`${this.checkoutURL}?step=payment_method`, null, `${this.checkoutURL}?previous_step=shipping_method&step=payment_method`);
      }
      if (this.paymentPage.request.path.includes('stock_problems')) {
        this.taskState.restock.active = true;
        this.taskState.restock.restockURL = `${this.checkoutURL}?previous_step=shipping_information&step=payment_method`;
        this.paymentPage = await this.waitForRestockInPage();
      }
      this.paymentPayload = this.scrapePayload('form:has(input[id=s])', this.paymentPage.body, this.paymentPayload);
      const $ = cheerio.load(this.paymentPage.body);
      this.paymentPayload.authenticity_token = this.getAuthToken(this.paymentPage.body);
      this.paymentPayload['checkout[total_price]'] = $('#checkout_total_price').attr('value');

      if ($('#checkout_vault_phone').length > 0) {
        this.paymentPayload['checkout[vault_phone]'] = $('#checkout_vault_phone').attr('value');
      } else {
        delete this.paymentPayload['checkout[vault_phone]'];
      }
      if ($('#checkout_credit_card_vault').length <= 0) {
        delete this.paymentPayload['checkout[credit_card][vault]'];
      }
      // Todo: if paypal mode, then set the payment gateway as the paypal gateway value
      this.paymentPayload['checkout[payment_gateway]'] = $('[name="checkout[payment_gateway]"]').attr('value');
      this.checkpoints['Got payment page'] = true;
    } catch (error) {
      await this.handleError(error, this.getPaymentPage, 'getPaymentPage');
    }
  }
  async submitPayment(): Promise<void> {
    if (this.stopped || !this.checkpoints['Got payment page']) return;
    this.log('info', this.taskData.id, 'Submitting payment');
    this.sendStatus(taskStatus.submittingPayment, taskColors.yellow);
    try {
      const paymentSession = await this.getPaymentSession();
      const payload = this.encodePayment(paymentSession);
      if (this.stopped) return;
      let response = await this.safeRequests.patchEndpoint(`${this.checkoutURL}?previous_step=shipping_method&step=payment_method`, payload);
      if (response.request.requestUrl.includes('throttle')) {
        this.log('info', this.taskData.id, `Updated checkout url: ${response.headers.location}`);
        this.checkoutURL = response.headers.location;
        response = await this.waitQueue();
      }
      if (response.body.toLocaleLowerCase().includes('captcha validation failed. please try again.')) {
        // console.log('captcha validation failed');
        this.checkpoints['Got payment page'] = false;
        this.checkpoints['Submitted customer'] = false;
        return;
      }

      const responseReturnedTechnicalError = response.body.includes('can’t be processed for technical reasons');
      const wrongCode = response.statusCode === 429;
      const responseStuckOnProcessing = wrongCode && !response.headers.location.includes('processing');
      const wrongPaymentDetailsResponse = response.body.includes('Your payment details couldn’t be verified.');

      if (responseReturnedTechnicalError || responseStuckOnProcessing || wrongPaymentDetailsResponse) {
        this.log('fatal', this.taskData.id, 'Payment blocked');
        this.sendStatus('Payment blocked', taskColors.red);
        this.stopped = true;
      }
      // if (!response.request.requestUrl.includes('processing')) {
      //   await this.handleShopifyError(response);
      //   return;
      // }
      // After we handle all the possible smalls we try to get the order status
      await this.getOrder(response.headers.location);
    } catch (error) {
      await this.handleError(error, this.submitPayment, 'submitPayment');
    }
  }
  async getOrder(url: string): Promise<void> {
    // Todo: figure out a way to send the checkout to our db when the link still has 'processing' and the task is stopped
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Processing');
    this.sendStatus(taskStatus.processing, taskColors.yellow);
    let response = await this.requests.getEndpoint(url);
    while (response.headers.location.includes('processing')) {
      this.log('info', this.taskData.id, 'Processing');
      this.sendStatus(taskStatus.processing, taskColors.yellow);
      await this.pause(this.taskData.monitorDelay);
      response = await this.safeRequests.getChromeHeaders(`${this.checkoutURL}/processing?from_processsing_page=1`, url);
    }
    if (response.body.toLowerCase().includes('step = "payment_method')) {
      const $ = cheerio.load(response.body);
      const message = $($('p[class="notice__text"]')[0]).text();
      this.log('fatal', this.taskData.id, message);
      this.sendStatus(taskStatus.declined, taskColors.red);
      this.sendWebhook({
        purchaseType: 'decline',
        price: this.foundProduct.price,
        productName: this.foundProduct.name,
        image: this.foundProduct.image,
        site: this.taskData.siteName,
        size: this.monitor.product.size,
        profile: this.profile.profilename,
        mode: 'Safe',
      });
      this.saveCheckout({
        date: this.getFormattedDate(),
        type: 'decline',
        productName: this.foundProduct.name,
        productImage: this.foundProduct.image,
        size: this.monitor.product.size,
        mode: 'Safe',
        delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
        captchaBypass: false,
        taskGroup: this.taskData.groupName,
        site: this.taskData.siteName,
        price: this.foundProduct.price,
        profile: this.profile.profilename,
        monitorInput: this.taskData.monitorInput,
      });
      this.stopped = true;
    } else if (response.request.requestUrl.includes('thank_you')) {
      this.log('success', this.taskData.id, 'Success');
      this.sendStatus(taskStatus.success, taskColors.green);
      this.sendWebhook({
        price: this.foundProduct.price,
        purchaseType: 'success',
        productName: this.foundProduct.name,
        image: this.foundProduct.image,
        site: this.taskData.siteName,
        size: this.monitor.product.size,
        profile: this.profile.profilename,
        mode: 'Safe',
      });
      this.saveCheckout({
        date: this.getFormattedDate(),
        type: 'checkout',
        productName: this.foundProduct.name,
        productImage: this.foundProduct.image,
        size: this.monitor.product.size,
        mode: 'Safe',
        delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
        captchaBypass: false,
        taskGroup: this.taskData.groupName,
        site: this.taskData.siteName,
        price: this.foundProduct.price,
        profile: this.profile.profilename,
        monitorInput: this.taskData.monitorInput,
      });
      this.stopped = true;
    } else {
      this.log('warning', this.taskData.id, `Error processing, redirecting: ${response.headers.location}`);
      await this.checkProcessingURL(response.headers.location);
    }
  }
  async startTask(): Promise<void> {
    this.log('info', this.taskData.id, 'Starting Shopify safe task');
    while (!this.stopped) {
      if (this.stopped) break;
      try {
        await this.login();

        await this.getHomePage();
        // Todo: add preload and default mode to front end
        await this.createCheckout();

        await this.prepareTask();

        await this.addToCart();

        await this.proceedToCheckout();

        await this.submitCustomer();

        await this.getShippingRate();

        await this.submitShipping();

        await this.getPaymentPage();

        await this.submitPayment();
        // this.stopped = true;
      } catch (error) {
        await this.handleError(error, this.startTask, 'startTask');
      }
    }
  }
  /**
   * Gets the special captcha session and sitekey
   * @param body Response body
   */
  getCaptchaData(body: string): void {
    const captchaSessionRegex = /s:\s'.+/gm;
    if (captchaSessionRegex.test(body)) {
      // eslint-disable-next-line prefer-destructuring
      this.captchaSession = body
        .match(captchaSessionRegex)[0]
        .split('s:')[1]
        .split("'")[1];
    }
    // .*<noscript>.*<iframe\s.*src=.*\?k=(.*)"><\/iframe>
    // this.captchaSitekey = body
    //   .match(/sitekey.+/)[0]
    //   .split('sitekey:')[1]
    //   .split('"')[1];
    // eslint-disable-next-line prefer-destructuring
    this.captchaSitekey = body.match(/.*<noscript>.*<iframe\s.*src=.*\?k=(.*)"><\/iframe>/)[1];
  }
  /**
   * Gets auth token for any given page
   * @param body Response body
   */
  getAuthToken(body: string): string {
    const $ = cheerio.load(body);
    return $("input[name='authenticity_token']")[0].attribs.value;
  }

  getCaptchaStatus(captchaType: string): string {
    if (captchaType === 'checkpoint') {
      return 'Checkpoint captcha';
    }
    if (captchaType === 'checkout') {
      return 'Checkout captcha';
    }
    return 'Waiting for captcha';
  }

  waitForCaptcha(captchaData: ICaptchaRequest, captchaType: string): Promise<unknown> {
    const status = this.getCaptchaStatus(captchaType);

    this.log('info', this.taskData.id, status);
    this.sendStatus(status, taskColors.blue);
    this.getCaptchaToken(captchaData);
    return new Promise((resolve) => {
      setInterval(() => {
        if (this.captchaToken) {
          resolve();
        }
      }, 333);
    });
  }
  saveCaptchaToken(token: string): void {
    if (token) {
      this.captchaToken = token;
    }
  }
  resetCaptchaData(): void {
    this.captchaSession = null;
    this.captchaSitekey = null;
    this.captchaToken = null;
  }
  /**
   * Sets all the cookies that request promise doesnt give us
   */
  setShopifyCookies(): void {
    this.safeRequests.cookieJar.setCookie(`_shopify_fs=${encodeURIComponent(new Date(Date.now() - this.randomNumber(10000, 15000)).toISOString())}`, this.taskData.site);
    this.safeRequests.cookieJar.setCookie(`_shopify_sa_t=${encodeURIComponent(new Date().toISOString())}`, this.taskData.site);
    this.safeRequests.cookieJar.setCookie(`_shopify_sa_t=${encodeURIComponent(new Date().toISOString())}`, this.taskData.site);
    this.safeRequests.cookieJar.setCookie('_shopify_sa_p=', this.taskData.site);
    this.safeRequests.cookieJar.setCookie('_shopify_sa_p=', this.taskData.site);
    this.safeRequests.cookieJar.setCookie('acceptedCookies=yes', this.taskData.site);
    this.safeRequests.cookieJar.setCookie('_landing_page=/', this.taskData.site);
    this.safeRequests.cookieJar.setCookie('sig-shopify=true', this.taskData.site);
    this.safeRequests.cookieJar.setCookie(`_shopify_country=${this.profile.shipping.country.replace(/ /g, '+')}`, this.taskData.site);
    this.safeRequests.cookieJar.setCookie(`_orig_referrer=${encodeURIComponent(this.taskData.site)}`, this.taskData.site);
  }
  setCartTimeStampCookie(): void {
    const cartCookie = _.findWhere(this.safeRequests.cookieJar.getCookies(this.taskData.site), {
      key: 'cart_ts',
    });
    this.safeRequests.cookieJar.setCookie(
      `cart_ts=${cartCookie ? parseInt(cartCookie.value, 10) - this.randomNumber(35, 40) : Math.floor(Date.now() / 1000) - this.randomNumber(40, 50)}`,
      this.taskData.site,
    );
  }
  setCheckoutCookies(): void {
    const { host } = new URL(this.taskData.site);

    const shopifyScookie = this.safeRequests.cookieJar.getCookiesSync(host).find((c) => c.key === '_shopify_s');

    const shopifyYcookie = this.safeRequests.cookieJar.getCookiesSync(host).find((c) => c.key === '_shopify_y');

    if (shopifyScookie) {
      this.safeRequests.cookieJar.setCookie(`_s=${shopifyScookie.value}`, this.taskData.site);
      this.safeRequests.cookieJar.setCookie(`_y=${shopifyYcookie.value}`, this.taskData.site);
    }
    this.safeRequests.cookieJar.setCookie(`hide_shopify_pay_for_checkout=${this.checkoutToken}`, this.taskData.site);
    this.safeRequests.cookieJar.setCookie(`tracked_start_checkout=${this.checkoutToken}`, this.taskData.site);
  }
  setBrowserData(): void {
    this.browserData = {
      'checkout[client_details][browser_width]': this.browserWidth,
      'checkout[client_details][browser_height]': this.browserHeight,
      'checkout[client_details][javascript_enabled]': 1,
      'checkout[client_details][color_depth]': 24,
      'checkout[client_details][java_enabled]': false,
      'checkout[client_details][browser_tz]': 240,
    };
  }
  async proceedToCheckoutPayload(variant: string): Promise<object> {
    let updatesKey = 'updates[]';
    let checkoutMsg = '';
    let note = '';
    const payload: any = {};
    if (this.taskData.siteName.includes('Palace')) {
      updatesKey = `updates[${variant}]`;
      checkoutMsg = 'Checkout';
      note = await this.getPalaceNote();
      payload.terms = 'on';
    }
    payload.checkout = checkoutMsg;
    payload.note = note;
    payload[updatesKey] = 1;
    return payload;
  }
  /**
   * Gets the special note required to create checkout for palace
   */
  async getPalaceNote(): Promise<string> {
    try {
      this.log('info', this.taskData.id, 'Getting palace note');
      this.sendStatus(taskStatus.gettingProperties, taskColors.yellow);
      const response = await this.safeRequests.getChromeHeaders(`${this.taskData.site}/cart`, this.taskData.site);
      const $ = cheerio.load(response.body);
      return $('[name="note"]').attr('value');
    } catch (error) {
      await this.handleError(error, this.getPalaceNote, 'getPalaceNote');
    }
  }
  cartPayload(variant: number): any {
    let cartPayload = {
      id: variant,
      quantity: 1,
      ...this.foundProduct.special.cartForm,
    };
    if (this.taskData.siteName === 'Kith') {
      cartPayload = {
        id: variant,
        quantity: 1,
        'option-0': _.findWhere(this.monitor.monitorProduct.variants, { id: this.foundProduct.variant }).title,
        ...this.foundProduct.special.cartForm,
      };
    }
    if (this.taskData.siteName === 'DSM US') {
      cartPayload = {
        id: variant,
        quantity: 1,
        'properties[_hash]': this.foundProduct.special.dsmHash,
      };
    }
    // if (this.taskData.siteName === 'DSM US') {
    //   const payload = `------WebKitFormBoundary3W4jVbixXeAFxGbG\r\nContent-Disposition: form-data; name="id"\r\n\r\n${variant}\r\n------WebKitFormBoundary3W4jVbixXeAFxGbG\r\nContent-Disposition: form-data; name="add"\r\n\r\n\r\n------WebKitFormBoundary3W4jVbixXeAFxGbG\r\nContent-Disposition: form-data; name="properties[_hash]"\r\n\r\n${this.foundProduct.special.dsmHash}\r\n------WebKitFormBoundary3W4jVbixXeAFxGbG--`;
    //   return payload;
    // }
    return cartPayload;
  }
  async getPaymentSession(): Promise<string> {
    try {
      const referer = `https://deposit.us.shopifycs.com/sessions?identifier=${this.checkoutToken}&location=${encodeURIComponent(
        `${this.checkoutURL}?previous_step=shipping_method&step=payment_method&dir=ltr&fonts[]=Roboto`,
      )}`;
      const { body } = await this.safeRequests.getPaymentSession(JSON.stringify(this.cardPayload), referer);
      return (body as { id: string }).id;
    } catch (error) {
      await this.handleError(error, this.getPaymentSession, 'getPaymentSession');
    }
  }
  /**
   * Converts an array to an object
   * @param array 0 indices are keys, 1 indicies are values
   */
  arrayToObject(array: string | any[]): {} {
    const obj = {};
    for (let i = 0; i < array.length; i += 1) {
      const key = array[i][0];
      const value = array[i][1];
      obj[key] = value;
    }
    return obj;
  }
  /**
   * Organizes bot proctection tokens in the correct order
   * @param extraValues Object containing bot protection tokens
   */
  organizeTokens(extraValues): any {
    const data = Object.entries(extraValues);
    if (!data.find((t) => t[0].includes('-count'))) {
      return extraValues;
    }
    const fsCountValue = data.find((t) => t[0].includes('-count'));
    const cleanArray = data.filter((t) => !t[0].includes('-count'));
    cleanArray.push(fsCountValue);
    return this.arrayToObject(cleanArray);
  }
  /**
   * Organizes the broswer data in the correct order
   * @param browserData Broswer data (this.browserData)
   */
  organizeBroswerData(browserData): any {
    const organizedBroswerArray = [];
    const data = Object.entries(browserData);
    for (let i = 0; i < data.length; i += 1) {
      const entry = data[i];
      // Captcha key shold always be the firs key
      if (entry[0] === 'g-recaptcha-response') {
        organizedBroswerArray[0] = ['g-recaptcha-response', entry[1]];
      } else {
        organizedBroswerArray[i] = [entry[0], entry[1]];
      }
    }
    return this.arrayToObject(organizedBroswerArray);
  }
  /**
   * Encodes customer information payload in the correct order
   * @param payload Customer payload
   */
  encodeCustomer(payload: any): object {
    const { profile } = this;
    const emptyCustomerPayload = {};
    const customerPayload = {};
    const baseData = {
      _method: 'patch',
      authenticity_token: payload.authenticity_token,
      previous_step: 'contact_information',
      step: 'shipping_method',
      'checkout[email]': profile.email,
      'checkout[buyer_accepts_marketing]': 0,
    };
    // Make a copy of the browser data;
    const browserData = JSON.parse(JSON.stringify(this.browserData));
    if (payload['g-recaptcha-response']) {
      browserData['g-recaptcha-response'] = payload['g-recaptcha-response'];
    }
    let extraPayload = {};
    const extraScrapedKeys = Object.keys(this.scrapedForm);
    // console.log(this.scrapedForm);
    // console.log(this.customerPayload);
    // eslint-disable-next-line no-restricted-syntax
    for (const key of extraScrapedKeys) {
      const keyNotRecaptcha = key !== 'g-recaptcha-response';
      const keyNotMethod = key !== 'method';
      const keyNotStep = key !== 'step';
      const keyNotAuthToken = key !== 'authenticity_token';

      if (keyNotRecaptcha && keyNotMethod && keyNotStep && keyNotAuthToken) {
        if (key.includes('checkout[client_details')) {
          browserData[key] = this.scrapedForm[key] === undefined ? '' : this.scrapedForm[key];
        } else if (key.includes('checkout[')) {
          customerPayload[key] = this.scrapedForm[key] === undefined ? '' : this.scrapedForm[key];
        } else {
          extraPayload[key] = this.scrapedForm[key] === undefined ? '' : this.scrapedForm[key];
        }
      }
    }
    if (extraPayload === {}) {
      extraPayload = this.scrapedForm;
    }
    customerPayload['checkout[shipping_address][first_name]'] = profile.firstname;
    customerPayload['checkout[shipping_address][last_name]'] = profile.lastname;
    customerPayload['checkout[shipping_address][address1]'] = profile.shipping.address;
    customerPayload['checkout[shipping_address][address2]'] = profile.shipping.apt || '';
    customerPayload['checkout[shipping_address][city]'] = profile.shipping.city;
    customerPayload['checkout[shipping_address][country]'] = profile.shipping.country;
    customerPayload['checkout[shipping_address][province]'] = profile.shipping.state;
    customerPayload['checkout[shipping_address][zip]'] = profile.shipping.zip;
    customerPayload['checkout[shipping_address][phone]'] = profile.phone;
    // For some reason shopify requires a copy of the customer paylod to be empty
    emptyCustomerPayload['checkout[shipping_address][first_name]'] = '';
    emptyCustomerPayload['checkout[shipping_address][last_name]'] = '';
    emptyCustomerPayload['checkout[shipping_address][address1]'] = '';
    emptyCustomerPayload['checkout[shipping_address][address2]'] = '';
    emptyCustomerPayload['checkout[shipping_address][city]'] = '';
    emptyCustomerPayload['checkout[shipping_address][country]'] = '';
    emptyCustomerPayload['checkout[shipping_address][province]'] = '';
    emptyCustomerPayload['checkout[shipping_address][zip]'] = '';
    emptyCustomerPayload['checkout[shipping_address][phone]'] = '';
    if (this.taskData.siteName.toLocaleLowerCase().includes('packer') || this.taskData.siteName.includes('Stussy')) {
      delete customerPayload['checkout[email]'];
      customerPayload['checkout[email_or_phone]'] = profile.email;
    }
    if (customerPayload['checkout[buyer_accepts_marketing]']) {
      delete customerPayload['checkout[buyer_accepts_marketing]'];
    }
    const additionalBotProtectionParams = Object.keys(extraPayload).length !== 0 ? this.organizeTokens(extraPayload) : undefined;
    const checkoutTokenCount = extraPayload[`${this.checkoutToken}-count`]
      ? {
          [`${this.checkoutToken}-count`]: 'fs_count',
        }
      : undefined;
    return {
      ...baseData,
      'checkout[buyer_accepts_marketing]': 1,
      ...emptyCustomerPayload,
      ...customerPayload,
      ...additionalBotProtectionParams,
      ...checkoutTokenCount,
      ...this.organizeBroswerData(browserData),
      'checkout[remember_me]': 1,
    };
  }
  /**
   * Encodes shipping information payload in the correct order
   */
  encodeShipping(): object {
    const shippingPayload = {};
    const extraValues = {};
    const browserData = JSON.parse(JSON.stringify(this.browserData));
    const baseData = {
      _method: 'patch',
      authenticity_token: this.shippingPayload.authenticity_token,
      previous_step: 'shipping_method',
      step: 'payment_method',
      'checkout[shipping_rate][id]': this.shippingPayload['checkout[shipping_rate][id]'],
    };

    const extraScrapedKeys = Object.keys(this.scrapedForm);
    // console.log(this.scrapedForm);
    // eslint-disable-next-line no-restricted-syntax
    for (const key of extraScrapedKeys) {
      if (!baseData[key] || browserData[key]) {
        if (key.includes('checkout[client_details')) {
          browserData[key] = this.scrapedForm[key] === undefined ? '' : this.scrapedForm[key];
        } else if (key.includes('checkout[')) {
          shippingPayload[key] = this.scrapedForm[key] === undefined ? '' : this.scrapedForm[key];
        } else {
          extraValues[key] = this.scrapedForm[key] === undefined ? '' : this.scrapedForm[key];
        }
      }
    }
    const checkoutTokenCount = extraValues[`${this.checkoutToken}-count`]
      ? {
          [`${this.checkoutToken}-count`]: 'fs_count',
        }
      : undefined;
    const extraValuesObject = Object.keys(extraValues).length !== 0 ? this.organizeTokens(extraValues) : undefined;
    return {
      ...baseData,
      ...extraValuesObject,
      ...checkoutTokenCount,
      ...this.organizeBroswerData(browserData),
    };
  }
  /**
   * Encodes payment payload in the correct order
   */
  encodePayment(session: any): object {
    const baseData = {
      _method: 'patch',
      authenticity_token: this.paymentPayload.authenticity_token,
      previous_step: 'payment_method',
      step: '',
      s: session,
    };
    const browserData = JSON.parse(JSON.stringify(this.browserData));
    const extraValues = {};
    let paymentData = [
      ['checkout[payment_gateway]', this.paymentPayload['checkout[payment_gateway]']],
      ['checkout[credit_card][vault]', 'false'],
      ['checkout[different_billing_address]', this.profile.usebilling ? this.profile.usebilling.toString() : 'false'],
      ['checkout[remember_me]', 'false'],
      ['checkout[total_price]', this.paymentPayload['checkout[total_price]']],
    ];
    if (this.paymentPayload['checkout[vault_phone]']) {
      paymentData = paymentData.splice(3, 0, ['checkout[vault_phone]', this.paymentPayload['checkout[vault_phone]']]);
    }
    if (this.scrapedForm.complete) {
      paymentData.push(['complete', '1']);
    }
    const extraScrapedKeys = Object.keys(this.scrapedForm);
    // console.log(this.scrapedForm);
    // eslint-disable-next-line no-restricted-syntax
    for (const key of extraScrapedKeys) {
      const keyInPaymentPayload = !this.paymentPayload[key] || (this.paymentPayload[key] && key.includes('-count'));
      const keyInBaseData = !baseData[key];
      const keyIncludesCheckout = !key.includes('checkout[');
      const keyIncludesStep = !key.includes('step');

      if (keyInPaymentPayload && keyInBaseData && keyIncludesCheckout && keyIncludesStep) {
        extraValues[key] = this.scrapedForm[key];
      }
    }
    const extraValuesObject = Object.keys(extraValues).length !== 0 ? this.organizeTokens(extraValues) : undefined;
    const checkoutTokenCount = extraValues[`${this.checkoutToken}-count`]
      ? {
          [`${this.checkoutToken}-count`]: 'fs_count',
        }
      : undefined;
    // queryString = queryString.replace(/step=&checkout%5Bremember_me%5D=0/, 'checkout%5Bremember_me%5D=0').trim();
    return {
      ...baseData,
      ...extraValuesObject,
      ...checkoutTokenCount,
      ...this.arrayToObject(paymentData),
      ...this.organizeBroswerData(browserData),
    };
  }
  /**
   * Sets all the values required for webhook and checkouts db
   */
  setProductData(response): void {
    if (this.stopped || this.taskData.siteName.includes('DSM')) return;
    const data = JSON.parse(response.body);
    const price = (data.final_price / 100).toFixed(2).toString();
    this.foundProduct.image = data.image;
    this.foundProduct.name = data.title;
    this.foundProduct.price = price;
  }

  /**
   * Scrapes extra values for the shopify payload. Bot protection included.
   * @param query Search query for the payload desired
   * @param checkoutPage Current checkout page
   * @param payload Current payload
   */
  scrapePayload(query: string, checkoutPage: string, payload): any {
    const $ = cheerio.load(checkoutPage);
    let scrapedForm = {};
    const scrapedBpForm = {};
    $(query)
      .find('input')
      .each((i, elem) => {
        const key = elem.attribs.name;
        const { value } = elem.attribs;
        const { disabled } = elem.attribs;

        const isInputDisabled = disabled !== undefined || disabled !== 'disabled';
        const keyIsFieldsRedirect = key !== 'hosted_fields_redirect' && !key.includes('field_');
        const isRememberMeInput = keyIsFieldsRedirect && !key.includes('checkout[billing_address]');

        if (isInputDisabled && isRememberMeInput) {
          scrapedForm[key] = key === 'checkout[remember_me]' ? 0 : value;
        }
      });
    $(`#fs_${this.checkoutToken}`)
      .find('textarea')
      .each((i, elem) => {
        scrapedBpForm[elem.attribs.name] = elem.attribs.value || '';
      });
    if (Object.keys(scrapedBpForm).length > 0) {
      scrapedBpForm[`${this.checkoutToken}-count`] = Object.keys(scrapedBpForm).length;
      scrapedForm = Object.assign(scrapedForm, scrapedBpForm);
    }
    this.scrapedForm = scrapedForm;
    return Object.assign(scrapedForm, payload);
  }

  setCustomerPayload(): void {
    const { profile } = this;
    const customerInformation: any = {};
    customerInformation._method = 'patch';
    customerInformation.authenticity_token = '';
    customerInformation.previous_step = 'contact_information';
    customerInformation.step = 'shipping_method';
    customerInformation['checkout[email]'] = profile.email;
    customerInformation['checkout[shipping_address][first_name]'] = profile.firstname;
    customerInformation['checkout[shipping_address][last_name]'] = profile.lastname;
    customerInformation['checkout[shipping_address][address1]'] = profile.shipping.address;
    customerInformation['checkout[shipping_address][address2]'] = profile.shipping.apt;
    customerInformation['checkout[shipping_address][city]'] = profile.shipping.city;
    customerInformation['checkout[shipping_address][country]'] = profile.shipping.country;
    customerInformation['checkout[shipping_address][province]'] = profile.shipping.state;
    customerInformation['checkout[shipping_address][zip]'] = profile.shipping.zip;
    customerInformation['checkout[shipping_address][phone]'] = profile.phone;
    customerInformation['checkout[client_details][browser_width]'] = this.browserWidth;
    customerInformation['checkout[client_details][browser_height]'] = this.browserHeight;
    customerInformation['checkout[client_details][javascript_enabled]'] = 1;
    this.customerPayload = customerInformation;
  }
  setShippingPayload(): void {
    const shippingPayload = {
      _method: 'patch',
      authenticity_token: '',
      previous_step: 'shipping_method',
      step: 'payment_method',
      'checkout[shipping_rate][id]': '',
    };
    this.shippingPayload = shippingPayload;
  }
  setPaymentPayload(): void {
    const paymentInformation: any = {};
    const { profile } = this;

    paymentInformation._method = 'patch';
    paymentInformation.authenticity_token = '';
    paymentInformation.previous_step = 'payment_method';
    paymentInformation.step = '';
    paymentInformation.s = '';
    paymentInformation['checkout[payment_gateway]'] = '';
    paymentInformation['checkout[credit_card][vault]'] = 'false';
    paymentInformation['checkout[different_billing_address]'] = profile.usebilling ? profile.usebilling.toString() : 'false';
    paymentInformation['checkout[remember_me]'] = 0;
    paymentInformation['checkout[vault_phone]'] = profile.phone;
    paymentInformation['checkout[total_price]'] = '';
    paymentInformation.complete = '1';
    paymentInformation['checkout[client_details][browser_width]'] = this.browserWidth;
    paymentInformation['checkout[client_details][browser_height]'] = this.browserHeight;
    paymentInformation['checkout[client_details][javascript_enabled]'] = 1;
    if (profile.usebilling) {
      paymentInformation['checkout[billing_address][first_name]'] = profile.usebilling ? profile.firstname : profile.firstname;
      paymentInformation['checkout[billing_address][last_name]'] = profile.usebilling ? profile.lastname : profile.lastname;
      paymentInformation['checkout[billing_address][address1]'] = profile.usebilling ? profile.billing.address : profile.shipping.address;
      paymentInformation['checkout[billing_address][address2]'] = profile.usebilling ? profile.billing.apt : profile.shipping.apt || '';
      paymentInformation['checkout[billing_address][city]'] = profile.usebilling ? profile.billing.city : profile.shipping.city || '';
      paymentInformation['checkout[billing_address][country]'] = profile.usebilling ? profile.billing.country : profile.shipping.country;
      paymentInformation['checkout[billing_address][province]'] = profile.usebilling ? profile.billing.state : '';
      paymentInformation['checkout[billing_address][zip]'] = profile.usebilling ? profile.billing.zip : profile.shipping.zip;
      paymentInformation['checkout[billing_address][phone]'] = profile.phone;
    }
    this.paymentPayload = paymentInformation;
  }
  setCardPayload(): void {
    const { profile } = this;
    const expDate = profile.expdate.split('/');
    const month = expDate[0];
    const year = expDate[1];
    this.cardPayload = {
      credit_card: {
        number: profile.cardnumber,
        verification_value: profile.cvv,
        name: profile.cardholdername,
        month,
        year,
      },
    };
  }
  setOrderPayload(): void {
    this.orderPayload = {
      _method: 'patch',
      authenticity_token: '',
      complete: 1,
      button: '',
      'checkout[client_details][browser_height]': this.browserHeight,
      'checkout[client_details][browser_width]': this.browserWidth,
      'checkout[client_details][javascript_enabled]': 1,
    };
  }
  /**
   * Handles edge cases errors with the checkout URL
   */
  async checkCheckoutURL(): Promise<void> {
    if (this.stopped) return;
    try {
      if (this.checkoutURL.includes('login')) {
        if (this.checkoutURL.includes('checkout_url')) {
          this.log('warning', this.taskData.id, 'Creating checkout url after login error');
          this.checkpoints['Logged in'] = false;
          const url = new URL(this.checkoutURL);
          this.checkoutToken = url.pathname.substring(url.pathname.indexOf('/checkouts/') + 11);
          this.checkoutURL = decodeURIComponent(url.search.split('?checkout_url=')[1]);
          await this.login(this.checkoutURL.replace(this.taskData.site, ''));
          this.resetCaptchaData();
          // await this.proceedToCheckout();
          return;
        }
        this.sendStatus('Account needed', taskColors.red);
        this.log('fatal', this.taskData.id, 'Account needed');
        this.stopped = true;
      } else if (!this.checkoutURL.match(/queue|throttle|checkouts/)) {
        this.log('warning', this.taskData.id, `Invalid checkout url: ${this.checkoutURL}`);
        this.checkoutURL = null;
        this.checkoutToken = null;
        this.checkpoints['Generated checkout'] = false;
        this.resetCaptchaData();
        await this.pause(this.taskData.retryDelay);
        await this.createCheckout();
      }
    } catch (error) {
      await this.handleError(error, this.checkCheckoutURL, 'checkCheckoutURL');
    }
  }

  async checkProcessingURL(url: string): Promise<void> {
    if (this.stopped) return;
    try {
      if (url.match(/paypal/)) {
        this.log('success', this.taskData.id, 'Success');
        this.sendStatus(taskStatus.success, taskColors.green);
        this.sendWebhook({
          price: this.foundProduct.price,
          purchaseType: 'success',
          productName: this.foundProduct.name,
          image: this.foundProduct.image,
          site: this.taskData.siteName,
          size: this.monitor.product.size,
          profile: this.profile.profilename,
          mode: 'Safe',
        });
        this.saveCheckout({
          date: this.getFormattedDate(),
          type: 'checkout',
          productName: this.foundProduct.name,
          productImage: this.foundProduct.image,
          size: this.monitor.product.size,
          mode: 'Safe',
          delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
          captchaBypass: false,
          taskGroup: this.taskData.groupName,
          site: this.taskData.siteName,
          price: this.foundProduct.price,
          profile: this.profile.profilename,
          monitorInput: this.taskData.monitorInput,
        });
        this.sendPaypalData(this.safeRequests.cookieJar, url, this.profile.profilename, this.monitor.product.size, this.taskData.siteName);
        this.stopped = true;
      } else if (url.match(/checkpoint/)) {
        this.log('warning', this.taskData.id, 'Checkpoint after checkout, solving');
        this.checkoutURL = null;
        this.checkoutToken = null;
        this.checkpoints['Generated checkout'] = false;
        this.resetCaptchaData();
        await this.pause(this.taskData.retryDelay);
        await this.createCheckout();
      } else {
        this.log('info', this.taskData.id, `Unexpected processing url: ${url}`);
        this.stopped = true;
      }
    } catch (error) {
      await this.handleError(error, this.checkProcessingURL, 'checkProcessingURL');
    }
  }
  /**
   * Handles errors and retrys method
   * @param error Error thrown by method
   * @param method Method to call again
   */
  async handleError(error, method: Function, parentFunction?: string): Promise<void> {
    if (this.stopped) return;

    const errorPrefix = parentFunction ? `[${parentFunction}] ` : '';

    const { message } = error;
    // Check for proxy error
    if (this.proxyErrors.test(message)) {
      this.log('fatal', this.taskData.id, `${errorPrefix}Proxy error - ${message}`);
      this.sendStatus(taskStatus.proxyError, taskColors.red);
      this.safeRequests.saveProxy();
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
      // Check for timeout error
    } else if (this.timeoutErrors.test(message)) {
      this.log('fatal', this.taskData.id, `${errorPrefix}Timeout error - ${message} ${error.statusCode ? error.statusCode : ''}`);
      this.sendStatus(taskStatus.timeout, taskColors.red);
      this.safeRequests.saveProxy();
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
    } else if (error.statusCode === 401) {
      this.log('warning', this.taskData.id, `${errorPrefix}Password page (unhandled): ${method.name}`);
      this.sendStatus(taskStatus.password, taskColors.yellow);
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
    } else {
      this.sendStatus(`${taskStatus.taskError} ${error.statusCode ? `${error.statusCode}` : ''}`, taskColors.red);
      this.log('fatal', this.taskData.id, `${errorPrefix}Task error, retrying - ${error.stack}`);
      this.safeRequests.saveProxy();
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
    }
  }
}
export default ShopifySafe;
