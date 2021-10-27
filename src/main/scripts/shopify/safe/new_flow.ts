/* eslint-disable no-await-in-loop */
import { EventEmitter } from 'events';
import { RequestError, Response } from 'got';
import cheerio from 'cheerio';
import {
  ShopifyProduct,
  Checkpoints,
  BrowserData,
  CaptchaData,
  ShippingPayload,
  LoginPayload,
  CheckoutData,
  CheckpointPayload,
  CheckoutPayload,
  TaskState,
  CartPayload,
  CustomerPayload,
} from './types';

import ShopifyMain from '../main/shopify-main';
import monitorManager from '../../../managers/monitor-manager';
import ShopifyMonitor from '../main/new-monitor';
import ShopifySafeRequests from './new_flow_requests';

import { ITaskData, IProfile } from '../../../interfaces/index';
import taskStatus from '../../../helpers/task-status';
import taskColors from '../../../helpers/task-colors';
import ICaptchaRequest from '../../../interfaces/ICaptchaRequest';
import { extractTokenFromCheckoutUrl, getAuthTokenFromBody, arrayToObject, organizeBrowserData, organizeTokens, shopifyUrlEncoded, extractCdtFromCheckoutUrl } from './functions';

class ShopifySafe extends ShopifyMain {
  product: ShopifyProduct;
  safeRequests: ShopifySafeRequests;
  monitor: ShopifyMonitor;
  emitter: EventEmitter;
  browserData: BrowserData;
  captchaData: CaptchaData;
  checkpoints: Checkpoints;
  taskState: TaskState;
  customerPayload: CustomerPayload;
  shippingPayload: ShippingPayload;
  checkoutData: CheckoutData;
  scrapedForm: {
    [key: string]: string;
  };
  cardPayload: { credit_card: { number: string; verification_value: string; name: string; month: string; year: string } };
  paymentPayload: any;

  constructor(taskData: ITaskData, profile: IProfile, proxies) {
    // Initialize parent class
    super(taskData, profile, proxies);

    // Set up checkout data
    this.checkoutData = {
      url: null,
      token: null,
      paymentID: null,
    };

    // Set up task state
    this.taskState = {
      restock: {
        active: false,
        restockUrl: '',
      },
      queue: {
        active: false,
        ctd: '',
      },
      checkpoint: {
        active: false,
      },
    };

    // Set up task info
    this.taskData = taskData;
    this.profile = profile;
    this.product = null;

    // Set up request class and monitor
    this.safeRequests = new ShopifySafeRequests(taskData, proxies);
    this.monitor = monitorManager.getMonitor(this.taskData.id);

    // Set up events
    this.emitter = new EventEmitter();
    this.emitter.addListener(`PRODUCT_FOUND_${this.taskData.id}`, this.setProduct);

    // Set up captcha info
    this.captchaData = {
      required: false,
      token: null,
      sitekey: null,
      session: null,
      cookies: null,
    };

    // Set up extra scraped form
    this.scrapedForm = {};

    // Set up shipping payload
    this.shippingPayload = {};

    // Initialize false checkpoints
    this.checkpoints = {
      LOADED_HOMEPAGE: false,
      LOGGED_IN: false,
      CREATED_CHECKOUT: false,
      ADD_TO_CART: false,
      SOLVED_CHECKPOINT: false,
      PROCEEDED_TO_CHECKOUT: false,
      SUBMITTED_CUSTOMER_INFO: false,
      GOT_SHIPPING_RATE: false,
      SUBMITTED_SHIPPING_RATE: false,
      GOT_PAYMENT_PAGE: false,
      SUBMITTED_PAYMENT: false,
    };
    this.browserData = {
      'checkout[client_details][browser_width]': 1920,
      'checkout[client_details][browser_height]': 1080,
      'checkout[client_details][javascript_enabled]': 1,
      'checkout[client_details][color_depth]': 24,
      'checkout[client_details][java_enabled]': false,
      'checkout[client_details][browser_tz]': 240,
    };
    this.setCustomerPayload();
    this.setPaymentPayload();
    this.setCardPayload();
  }

  /** Task Loop */
  async startTask(): Promise<void> {
    try {
      this.log('info', this.taskData.id, 'Starting Shopify safe task');
      await this.login();

      await this.loadHomepage();

      // Todo: add preload and default mode to front end
      await this.createCheckout();

      await this.proceedToCheckout();

      await this.submitCustomer();

      await this.getShippingRate();

      await this.submitShipping();

      await this.getPaymentPage();

      await this.submitPayment();
    } catch (error) {
      this.handleError(error, this.startTask);
    }
  }

  /**
   *
   *
   * @param {string} [redirectUrl]
   * @returns {Promise<void>}
   * @memberof ShopifySafe
   */
  async login(redirectUrl?: string): Promise<void> {
    if (this.stopped || !this.taskData.requireLogin || this.checkpoints.LOGGED_IN) return;
    try {
      // Initialize login payload form
      const payload: LoginPayload = {
        form_type: 'customer_login',
        utf8: '✓',
        'customer[email]': this.taskData.email,
        'customer[password]': this.taskData.password,
        return_url: redirectUrl || '/account',
      };

      // Uses a random account if accountpool is enabled
      if (this.taskData.useAccountPool) {
        const [randomEmail, randomPassword] = this.getAccountFromPool(this.taskData.accountPool);
        payload['customer[email]'] = randomEmail;
        payload['customer[password]'] = randomPassword;
      }

      // Send login request
      const response = await this.safeRequests.login(payload);

      if (response.statusCode !== 200) {
        // Unknown login error if status code not 200, retry after delay
        this.sendStatus('Login error', taskColors.red);
        this.log('fatal', this.taskData.id, `Login error: ${response.statusCode}`);
        await this.pause(this.taskData.retryDelay);
        await this.login();
      } else if (response.body.includes('Invalid login credentials.')) {
        this.sendStatus('Invalid login', taskColors.yellow);
        this.log('info', this.taskData.id, 'Invalid login');
        this.stopped = true;
      } else if (response.body.includes('sitekey')) {
        // Found captcha on login, trying to solve and repost login data
        this.log('info', this.taskData.id, 'Waiting for captcha to login');
        this.getCaptchaData(response.body);

        // Wait for captcha token to be filled by harvester
        await this.waitForCaptcha(
          {
            site: `http://${new URL(this.taskData.site).host}`,
            sitekey: this.captchaData.sitekey,
            taskID: this.taskData.id,
            harvesterType: this.harvesterTypes.shopify,
          },
          'login',
        );

        payload['g-recaptcha-response'] = this.captchaData.token;

        try {
          // Send login request
          const { body } = await this.safeRequests.login(payload);

          const siteKeyInPageResponse = body.includes('sitekey');

          if (!siteKeyInPageResponse) {
            this.log('info', this.taskData.id, 'Logged in after captcha verication');
            this.checkpoints.LOGGED_IN = true;
            // Token was used to we have to restart state to null
            this.resetCaptchaData();
          }
        } catch (error) {
          this.log('fatal', this.taskData.id, 'Error verifying captcha login');
          await this.handleError(error, this.login);
        }
      } else {
        this.log('info', this.taskData.id, 'logged in');
        this.sendStatus('Logged in', taskColors.yellow);
        this.checkpoints.LOGGED_IN = true;
        // Token was used to we have to restart state to null
        this.resetCaptchaData();
      }
    } catch (error) {
      await this.handleError(error, this.login);
    }
  }

  /**
   * Initial function to load the product page with included google headers
   *
   * @returns {Promise<void>}
   * @memberof ShopifySafe
   */
  async loadHomepage(): Promise<void> {
    if (this.stopped || this.checkpoints.LOADED_HOMEPAGE) return;

    try {
      const response = await this.safeRequests.loadHomepageWithReferer(this.taskData.site, 'https://www.google.com/');

      switch (response.statusCode) {
        case 200:
          this.log('info', this.taskData.id, 'Got home page');
          this.checkpoints.LOADED_HOMEPAGE = true;
          break;
        case 401: // 401 statuscode means password page is up
          this.log('warning', this.taskData.id, 'Password page while trying to get home page');
          this.checkpoints.LOADED_HOMEPAGE = true;
          break;
        default:
          this.requests.saveProxy();
          this.log('fatal', this.taskData.id, `Unknown home page response: ${response.body}`);
          break;
      }
    } catch (error) {
      this.handleError(error, this.loadHomepage);
    }
  }

  async prepareTaskAndStartMonitor(): Promise<void> {
    if (this.stopped || this.product) return;
    try {
      await this.monitor.startMonitor(this.emitter);
    } catch (error) {
      await this.handleError(error, this.prepareTaskAndStartMonitor);
    }
  }

  async addToCart(): Promise<void> {
    if (this.stopped || this.checkpoints.ADD_TO_CART) return;
    try {
      this.log('info', this.taskData.id, 'Adding to cart');
      this.sendStatus(taskStatus.carting, taskColors.yellow, this.monitor.product.name);
      const payload = this.createCartPayload(this.monitor.product.variant as string);
      const { statusCode, body, headers } = await this.safeRequests.addToCart(payload, this.monitor.productURL);
      switch (statusCode) {
        case 200:
          this.setProductData(body);
          this.sendStatus(taskStatus.carting, taskColors.yellow, this.monitor.product.name);
          headers['set-cookie'].forEach(async (cookie) => {
            await this.safeRequests.cookieJar.setCookie(`${cookie}`, this.taskData.site);
          });
          break;
        case 422:
          this.log('info', this.taskData.id, 'OOS, retrying');
          this.sendStatus(taskStatus.oos, taskColors.yellow);
          await this.pause(this.taskData.monitorDelay);
          await this.addToCart();
          break;
        case 400:
          // If we already have the product (variant mode) then keep trying to atc
          if (this.product) {
            this.log('info', this.taskData.id, 'Waiting for product');
            this.sendStatus(taskStatus.waitingProduct, taskColors.yellow);
          }

          await this.pause(this.taskData.monitorDelay);
          await this.addToCart();
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected ATC response: ${statusCode}`);
          await this.pause(this.taskData.retryDelay);
          this.safeRequests.saveProxy();
          await this.addToCart();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.addToCart);
    }
  }

  async createCheckout(): Promise<void> {
    if (this.stopped || this.checkpoints.CREATED_CHECKOUT) return;
    try {
      if (this.taskData.site.includes('dover')) {
        // after getting the product create checkout url without preload
        await this.prepareTaskAndStartMonitor();
      } else {
        //  TODO: PRELOAD MODE
        await this.createCheckoutPreload();
        await this.prepareTaskAndStartMonitor();
        await this.addToCart();
        // TODO: FAST MODE
        // await this.prepareTaskAndStartMonitor();
        // await this.addToCart();
        // this.createCheckoutFast();
      }
    } catch (error) {
      await this.handleError(error, this.createCheckout);
    }
  }
  /**
   * Creates checkout without preload variant
   *
   * @returns {Promise<void>}
   * @memberof ShopifySafe
   */
  async createCheckoutFast(): Promise<void> {
    if (this.stopped || this.checkpoints.CREATED_CHECKOUT) return;
    try {
      this.log('info', this.taskData.id, 'Creating checkout with fast method');
      this.stopped = true;
      // const { statusCode, body, requestUrl, headers } = await this.safeRequests.createCheckout();
      // switch (statusCode) {
      //   case 302:
      //     if (requestUrl.includes('checkpoint')) {
      //       console.log('checkpoint needed fast');
      //       this.stopped = true;
      //       // this.getCaptchaData(body);
      //       // this.log('warning', this.taskData.id, 'Checkpoint found');
      //       // await this.solveCheckpoint(requestUrl, getAuthTokenFromBody(body));
      //     }

      //     this.checkoutData.url = headers.location;
      //     if (this.checkoutData.url.includes('throttle')) {
      //       await this.waitQueue();
      //     }
      //     this.checkoutData.token = extractTokenFromCheckoutUrl(this.checkoutData.url);

      //     this.log('info', this.taskData.id, `Created checkout url: ${this.checkoutData.url}`);
      //     await this.checkCheckoutURL();
      //     break;

      //   default:
      //     this.log('fatal', this.taskData.id, `Unexpected response creating checkout - ${statusCode}: ${body}`);
      //     this.safeRequests.saveProxy();

      //     await this.pause(this.taskData.retryDelay);
      //     await this.createCheckoutFast();
      //     break;
      // }
    } catch (error) {
      await this.handleError(error, this.createCheckoutFast);
    }
  }

  /**
   * Creates a checkout url with a random in stock variant
   *
   * @returns {Promise<void>}
   * @memberof ShopifySafe
   */
  async createCheckoutPreload(): Promise<void> {
    if (this.stopped || this.checkpoints.CREATED_CHECKOUT) return;
    try {
      this.log('info', this.taskData.id, 'Creating pre-load checkout');
      await this.monitor.getPreloadVariant();
      // If there are no other variants in stock then we create the checkout url without it
      await this.preCart();
      this.setShopifyCookies();
      await this.proceedToCheckoutForCheckoutUrl();
      await this.removePreCart();
      if (this.checkoutData.url) {
        this.checkpoints.CREATED_CHECKOUT = true;
      }
    } catch (error) {
      await this.handleError(error, this.createCheckoutPreload, 'createCheckoutPreload');
    }
  }

  /**
   * Carts the preload product
   *
   * @returns {Promise<void>}
   * @memberof ShopifySafe
   */
  async preCart(): Promise<void> {
    if (this.stopped) return;
    try {
      this.log('info', this.taskData.id, 'Pre-loading');
      this.sendStatus('Pre-loading', taskColors.yellow);
      const { headers, statusCode } = await this.safeRequests.preCart(this.monitor.preloadProduct.url, this.monitor.preloadProduct.variant);
      switch (statusCode) {
        case 200:
          this.log('info', this.taskData.id, 'Pre-loaded product');
          headers['set-cookie'].forEach(async (cookie) => {
            await this.safeRequests.cookieJar.setCookie(`${cookie}`, this.taskData.site);
          });
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response pre-loading: ${statusCode}`);
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
    if (this.stopped) return;
    try {
      await this.safeRequests.removePreCart(`${this.taskData.site}/cart`);
      const { statusCode, body } = await this.safeRequests.getXML(`${this.taskData.site}/cart.json`, this.checkoutData.url);
      switch (statusCode) {
        case 200:
          if (!body) {
            this.log('fatal', this.taskData.id, `Error removing pre-load product: ${statusCode}`);
            break;
          }
          this.log('info', this.taskData.id, 'Removed pre-load product');
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response: ${body}`);
          break;
      }
    } catch (error) {
      await this.handleError(error, this.removePreCart, 'removePreCart');
    }
  }

  async proceedToCheckoutForCheckoutUrl(): Promise<void> {
    if (this.stopped) return;
    try {
      this.sendStatus(taskStatus.creatingCheckout, taskColors.yellow);
      this.log('info', this.taskData.id, 'Creating checkout url');
      const { statusCode, headers } = await this.safeRequests.getCheckout(this.monitor.preloadProduct.url);
      switch (statusCode) {
        case 302:
          if (headers.location.match(/checkpoint/)) {
            this.log('warning', this.taskData.id, 'Checkpoint active');
            this.taskState.checkpoint.active = true;
          }
          this.checkoutData.url = headers.location;
          if (this.checkoutData.url.match(/queue|throttle/)) {
            await this.waitQueue();
            return;
          }
          this.checkoutData.token = extractTokenFromCheckoutUrl(this.checkoutData.url);
          this.log('info', this.taskData.id, `Created checkout url: ${this.checkoutData.url}`);
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected error getting checkout url: ${statusCode}`);
          await this.pause(this.taskData.retryDelay);
          await this.proceedToCheckoutForCheckoutUrl();
          return;
      }
    } catch (error) {
      await this.handleError(error, this.proceedToCheckout);
    }
  }
  async solveCheckpoint(referer: string, token?: string): Promise<void> {
    if (this.stopped || this.checkpoints.SOLVED_CHECKPOINT) return;
    try {
      this.sendStatus('Solving checkpoint', taskColors.yellow);
      this.log('info', this.taskData.id, 'Solving checkpoint');
      const { body } = await this.safeRequests.getCheckpoint(referer);
      const cookies = await this.safeRequests.cookieJar.getCookies(this.taskData.site);
      this.getCaptchaData(body);
      await this.waitForCaptcha(
        {
          cookies,
          site: `http://${new URL(this.taskData.site).host}/checkpoint`,
          taskID: this.taskData.id,
          sitekey: this.captchaData.sitekey,
          harvesterType: this.harvesterTypes.shopify,
        },
        'checkpoint',
      );
      this.captchaData.cookies.forEach(async (cookie) => {
        await this.safeRequests.cookieJar.setCookie(`${cookie}`, this.taskData.site);
      });
      const checkpointPayload = {
        authenticity_token: getAuthTokenFromBody(body),
        'g-recaptcha-response': this.captchaData.token,
        data_via: 'cookie',
        commit: '',
      };
      const { headers } = await this.safeRequests.solveCheckpoint(this.shopifyUrlEncoded(checkpointPayload), referer);
      console.log(headers);
      this.stopped = true;
      // this.checkoutData.url = response.headers.location;
      // this.checkoutData.token = extractTokenFromCheckoutUrl(this.checkoutData.url);

      // this.log('info', this.taskData.id, `Created checkout url: ${this.checkoutData.url}`);

      // await this.queueAndMonitor();
      // this.resetCaptchaData();
      // this.checkpoints.SOLVED_CHECKPOINT = true;
    } catch (error) {
      await this.handleError(error, this.solveCheckpoint);
    }
  }

  async checkCheckoutURL(): Promise<void> {
    if (this.stopped) return;
    try {
      if (this.checkoutData.url.includes('login')) {
        if (this.checkoutData.url.includes('checkout_url')) {
          this.log('warning', this.taskData.id, 'Creating checkout url after login error');
          this.checkpoints.LOGGED_IN = false;

          const { search } = new URL(this.checkoutData.url);

          this.checkoutData = {
            url: decodeURIComponent(search.split('?checkout_url=')[1]),
            token: extractTokenFromCheckoutUrl(this.checkoutData.url),
          };

          await this.login(this.checkoutData.url.replace(this.taskData.site, ''));

          this.resetCaptchaData();
          // await this.proceedToCheckout();
          return;
        }
        this.sendStatus('Account needed', taskColors.red);
        this.log('fatal', this.taskData.id, 'Account needed');
        this.stopped = true;
      } else if (!this.checkoutData.url.match(/queue|throttle|checkouts/)) {
        this.log('warning', this.taskData.id, `Invalid checkout url: ${this.checkoutData.url}`);
        this.checkoutData = {
          url: null,
          token: null,
        };

        this.checkpoints.CREATED_CHECKOUT = false;

        this.resetCaptchaData();
        await this.pause(this.taskData.retryDelay);
        await this.createCheckout();
      } else {
        this.checkpoints.CREATED_CHECKOUT = true;
      }
    } catch (error) {
      await this.handleError(error, this.checkCheckoutURL);
    }
  }

  /**
   * If we create checkout and there is a queue active we can start the monitor
   * and also enter queue at the same time
   */
  async queueAndMonitor(): Promise<void> {
    if (this.stopped || !this.checkoutData.url.match(/queue|throttle/)) return;
    try {
      this.log('info', this.taskData.id, 'Entering queue');
      await Promise.all([this.waitQueue(), this.prepareTaskAndStartMonitor()]);
    } catch (error) {
      await this.handleError(error, this.queueAndMonitor);
    }
  }

  async waitQueue(): Promise<void> {
    if (this.stopped) return null;
    try {
      this.taskState.queue.active = true;
      this.taskState.queue.ctd = extractCdtFromCheckoutUrl(this.checkoutData.url);
      this.log('info', this.taskData.id, `Checkout URL entering queue: ${this.checkoutData.url}`);
      // Replace incase url includes contact information step
      const currentTaskLocation = this.checkoutData.url.replace('?step=contact_information', '');
      this.log('info', this.taskData.id, 'Queue');
      this.sendStatus(taskStatus.queue, taskColors.blue);
      await this.resolveQueue(currentTaskLocation);
      const { headers } = await this.safeRequests.getCheckoutAfterQueue(currentTaskLocation);
      const checkoutCookie = headers['set-cookie'].find((h) => h.includes('checkouts'));
      if (typeof checkoutCookie === 'undefined') {
        this.log('fatal', this.taskData.id, 'Unexpected queue error, retrying');
        await this.waitQueue();
      }
      const checkoutPath = checkoutCookie
        .split(';')
        .find((x) => x.includes('path'))
        .split('=')[1];
      this.checkoutData.url = `${this.taskData.site}${checkoutPath}`;
      this.checkoutData.token = extractTokenFromCheckoutUrl(this.checkoutData.url);
      this.log('info', this.taskData.id, `Checkout url after queue: ${this.checkoutData.url}`);
      return null;
    } catch (error) {
      await this.handleError(error, this.waitQueue);
      return null;
    }
  }

  async resolveQueue(currentTaskLocation: string): Promise<void> {
    if (this.stopped) return null;
    try {
      const queueDelay = 5000;
      let queueResponse: Response<string> = null;
      let currenStatusCode = 202;
      while (currenStatusCode === 202 && !this.stopped) {
        this.log('info', this.taskData.id, 'Queue');
        this.sendStatus(taskStatus.queue, taskColors.blue);
        await this.pause(queueDelay);
        queueResponse = await this.safeRequests.pollQueue(currentTaskLocation);
        currenStatusCode = queueResponse.statusCode;
        if (currenStatusCode === 200) {
          this.log('info', this.taskData.id, 'Passed queue');
          break;
        }
      }
      return null;
    } catch (error) {
      await this.handleError(error, this.resolveQueue);
      return null;
    }
  }

  /**
   * Gets the checkout url if it doesnt exist or goes to the checkout page
   */
  async proceedToCheckout(): Promise<void> {
    if (this.stopped || this.checkpoints.PROCEEDED_TO_CHECKOUT) return;
    try {
      if (this.checkoutData.url.includes('checkpoint')) {
        await this.solveCheckpoint(this.checkoutData.url);
      }
      await this.checkCheckoutURL();
      this.log('info', this.taskData.id, 'Proceeding to checkout');
      this.sendStatus(taskStatus.proceedingCeckout, taskColors.yellow);
      await this.safeRequests.cookieJar.setCookie('checkout_locale=en', this.taskData.site);
      this.setCartTimeStampCookie();
      if (this.stopped) return;
      let response = await this.safeRequests.loadHomepageWithReferer(`${this.checkoutData.url}?step=contact_information`, `${this.taskData.site}/cart`);
      if (response.redirectUrls.includes('checkpoint')) {
        this.getCaptchaData(response.body);
        const location = response.redirectUrls[response.redirectUrls.reverse().reduce((a, v, i) => (v.indexOf('checkpoint') !== -1 ? Math.abs(i - response.redirectUrls.length + 1) : a), -1)];
        this.log('warning', this.taskData.id, 'Checkpoint found after creating checkout');
        await this.solveCheckpoint(location, getAuthTokenFromBody(response.body));
        await this.proceedToCheckout();
        return;
      }

      if (response.redirectUrls.includes('stock_problems')) {
        this.log('info', this.taskData.id, 'Product went OOS at customer page');
        this.checkoutData.url = response.redirectUrls[response.redirectUrls.reverse().reduce((a, v, i) => (v.includes('stock_problems') ? Math.abs(i - response.redirectUrls.length + 1) : a), -1)];
        this.taskState.restock.active = true;
        this.taskState.restock.restockUrl = `${this.checkoutData.url}?step=contact_information`;
        response = await this.waitForRestockInPageRecursive();
        return;
      }
      if (response.request.requestUrl.includes('throttle')) {
        this.log('warning', this.taskData.id, 'Task being redirected to queue');
        await this.waitQueue();
      }
      if (response.body && response.body.includes('sitekey')) {
        this.log('warning', this.taskData.id, 'Task needs a captcha token for checkout');
        this.getCaptchaData(response.body);
        this.captchaData.required = true;
      }
      this.setCheckoutCookies();
      this.customerPayload.authenticity_token = getAuthTokenFromBody(response.body);
      this.customerPayload = this.scrapePayload('form:has(input[id=checkout_shipping_address_first_name])', response.body, this.customerPayload);
      this.checkpoints.PROCEEDED_TO_CHECKOUT = true;
    } catch (error) {
      await this.handleError(error, this.proceedToCheckout, 'proceedToCheckout');
    }
  }

  async waitForRestockInPageRecursive(): Promise<Response<string>> {
    if (this.stopped) return null;
    try {
      let currentPage = await this.safeRequests.getEndpoint(this.taskState.restock.restockUrl);
      const { path } = currentPage.request;

      if (!this.stopped && (!path.includes('stock_problems') || !path.includes('checkout'))) {
        this.sendStatus(taskStatus.restock, taskColors.yellow);
        this.log('info', this.taskData.id, 'Waiting for restock');

        await this.pause(this.taskData.monitorDelay);
        currentPage = await this.requests.getEndpoint(this.taskState.restock.restockUrl);
      } else {
        return this.waitForRestockInPageRecursive();
      }

      this.log('info', this.taskData.id, 'Finished restock monitor');
      return currentPage;
    } catch (error) {
      await this.handleError(error, this.waitForRestockInPageRecursive);
      return null;
    }
  }

  async submitCustomer(): Promise<void> {
    if (this.stopped || !this.checkpoints.PROCEEDED_TO_CHECKOUT || this.checkpoints.SUBMITTED_CUSTOMER_INFO) return;
    try {
      let response: any;
      this.sendStatus(taskStatus.submittingInformation, taskColors.yellow);
      this.log('info', this.taskData.id, 'Submitting information');
      // Make a copy of the payload we currently have
      const payload = JSON.parse(JSON.stringify(this.customerPayload));

      const captchaUrlParsed = new URL(this.checkoutData.url);

      if (this.captchaData.required) {
        await this.waitForCaptcha(
          {
            site: `http://${captchaUrlParsed.host}${captchaUrlParsed.pathname}`,
            sitekey: this.captchaData.sitekey,
            session: this.captchaData.session,
            taskID: this.taskData.id,
            harvesterType: this.harvesterTypes.shopifyCheckout,
          },
          'checkout',
        );
        payload['g-recaptcha-response'] = this.captchaData.token;
      }
      const encodedCustomer = this.encodeCustomer(payload);
      if (this.stopped) return;
      // For visual puposes we send this status again
      this.sendStatus(taskStatus.submittingInformation, taskColors.yellow);
      const { statusCode, headers, request } = await this.safeRequests.patchEndpoint(`${this.checkoutData.url}?step=contact_information`, encodedCustomer, this.safeRequests.currentProxy);
      switch (statusCode) {
        case 302:
          // If there is another location other than the shipping page we proceed to check for errors
          if (headers.location.indexOf('?previous_step=contact_information&step=shipping_method') === -1) {
            await this.customerPageCheckRequestURL(request.requestUrl);
          }
          this.log('info', this.taskData.id, 'Getting shipping page');
          response = await this.safeRequests.loadHomepageWithReferer(
            `${this.checkoutData.url}?previous_step=contact_information&step=shipping_method`,
            `${this.checkoutData.url}?previous_step=contact_information`,
          );
          this.shippingPayload.authenticity_token = getAuthTokenFromBody(response.body);
          this.shippingPayload = this.scrapePayload('form:has(input[id^=checkout_shipping_rate_id])', response.body, this.shippingPayload);
          this.resetCaptchaData();
          this.checkpoints.SUBMITTED_CUSTOMER_INFO = true;
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response sending customer: ${statusCode}, location: ${headers.location}`);
          break;
      }
      // const captchaValidationFailed = response.body.includes('Captcha validation failed. Please try again.');
      // const contactInformationMessage = response.request.requestUrl.includes('contact_information');
      // const requiresShippingMethod = !response.request.requestUrl.includes('shipping_method');
      // if (captchaValidationFailed || (contactInformationMessage && requiresShippingMethod)) {
      //   this.log('warning', this.taskData.id, 'Back at customer information page, retrying');
      //   this.customerPayload.authenticity_token = getAuthTokenFromBody(response.body);
      //   // this.submittedCaptcha = false;
      //   await this.submitCustomer();
      // }
      // // this.stopped = true;
    } catch (error) {
      await this.handleError(error, this.submitCustomer);
    }
  }

  async getShippingRate(): Promise<void> {
    if (this.stopped || this.checkpoints.GOT_SHIPPING_RATE) return;

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

      const encodedPayload = shopifyUrlEncoded(rateData);
      const response = await this.safeRequests.getShippingRate(encodedPayload);
      if (response.body.includes('is not supported')) {
        this.sendStatus('Country not supported', taskColors.red);
        this.log('fatal', this.taskData.id, 'Country not supported, stopping task');
        this.stopped = true;
        return;
      }
      const rates = JSON.parse(response.body).shipping_rates[0];
      this.shippingPayload['checkout[shipping_rate][id]'] = `${rates.source}-${encodeURI(rates.code)}-${rates.price}`;
      this.checkpoints.GOT_SHIPPING_RATE = true;
    } catch (error) {
      await this.handleError(error, this.getShippingRate);
    }
  }
  async submitShipping(): Promise<void> {
    if (this.stopped || this.checkpoints.SUBMITTED_SHIPPING_RATE) return;
    try {
      this.sendStatus(taskStatus.submittingShipping, taskColors.yellow);
      this.log('info', this.taskData.id, 'Submitting shipping');
      const { statusCode, headers } = await this.safeRequests.patchEndpoint(`${this.checkoutData.url}?previous_step=contact_information&step=shipping_information`, this.encodeShipping());
      switch (statusCode) {
        case 302:
          if (headers.location.indexOf('?previous_step=shipping_method&step=payment_method') === -1) {
            // TODO: handle errors
            this.stopped = true;
            return;
          }
          this.checkpoints.SUBMITTED_SHIPPING_RATE = true;
          break;
        default:
          break;
      }
      // Set payment page to use extract data
      // this.paymentPage = await this.safeRequests.patchEndpoint(`${this.checkoutURL}?previous_step=contact_information&step=shipping_information`, payload, this.safeRequests.currentProxy);
      // if (this.paymentPage.request.path.includes('throttle')) {
      //   this.paymentPage = await this.waitQueue();
      // }
      // if (this.paymentPage.request.path.includes('stock_problems')) {
      //   this.taskState.restock.active = true;
      //   this.taskState.restock.restockURL = `${this.checkoutURL}?previous_step=shipping_information&step=payment_method`;
      //   this.paymentPage = await this.waitForRestockInPage();
      // }

      // const responseIncludesShippingMethodQuestion = this.paymentPage.request.path.includes('shipping_method');
      // const responseIsNotPaymentMethodPage = !this.paymentPage.request.path.includes('payment_method');

      // if (responseIncludesShippingMethodQuestion && responseIsNotPaymentMethodPage) {
      //   this.log('warning', this.taskData.id, 'Back at shipping page');
      //   this.shippingPayload.authenticity_token = this.getAuthToken(this.paymentPage.body);
      //   await this.pause(this.taskData.retryDelay);
      // }
    } catch (error) {
      await this.handleError(error, this.submitShipping, 'submitShipping');
    }
  }
  async getPaymentPage(): Promise<void> {
    if (this.stopped || !this.checkpoints.SUBMITTED_SHIPPING_RATE || this.checkpoints.GOT_PAYMENT_PAGE) return;
    try {
      this.log('info', this.taskData.id, 'Getting payment page');
      this.sendStatus('Getting payment page', taskColors.yellow);
      let response = await this.safeRequests.loadHomepageWithReferer(
        `${this.checkoutData.url}?previous_step=shipping_method&step=payment_method`,
        `${this.checkoutData.url}?previous_step=contact_information&step=shipping_method`,
      );
      while (response.body.includes('Calculating taxes')) {
        if (this.stopped) return;
        this.log('info', this.taskData.id, 'Calculating taxes');
        this.sendStatus(taskStatus.caculatingTaxes, taskColors.yellow);
        // eslint-disable-next-line no-await-in-loop
        response = await this.safeRequests.getXML(`${this.checkoutData.url}?step=payment_method`, `${this.checkoutData.url}?previous_step=shipping_method&step=payment_method`);
      }
      this.paymentPayload = this.scrapePayload('form:has(input[id=s])', response.body, this.paymentPayload);
      const $ = cheerio.load(response.body);
      this.paymentPayload.authenticity_token = getAuthTokenFromBody(response.body);
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
      this.checkpoints.GOT_PAYMENT_PAGE = true;
    } catch (error) {
      await this.handleError(error, this.getPaymentPage);
    }
  }
  async submitPayment(): Promise<void> {
    if (this.stopped || !this.checkpoints.GOT_PAYMENT_PAGE) return;
    try {
      this.log('info', this.taskData.id, 'Submitting payment');
      this.sendStatus('Submitting payment', taskColors.yellow);
      this.checkoutData.paymentID = await this.getPaymentSession();
      const { statusCode, body, headers } = await this.safeRequests.patchEndpoint(`${this.checkoutData.url}?previous_step=shipping_method&step=payment_method`, this.encodePayment());
      switch (statusCode) {
        case 302:
          console.log(headers.location);
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response submitting payment - ${statusCode}: ${body}`);
          this.safeRequests.saveProxy();
          await this.pause(this.taskData.retryDelay);
          await this.submitPayment();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.submitPayment);
    }
  }

  /** ************************************
   *
   *         CAPTCHA FUNCTIONS
   *
   * *********************************** */

  resetCaptchaData(): void {
    this.captchaData = {
      required: this.captchaData.required,
      session: null,
      sitekey: null,
      token: null,
    };
  }
  saveCaptchaToken(token: string, cookies = null): void {
    if (token) {
      this.captchaData.token = token;
      if (cookies) {
        this.captchaData.cookies = cookies.split(';');
      }
    }
  }
  private async waitForCaptcha(captchaRequest: ICaptchaRequest, captchaType: string): Promise<void> {
    let status: string;

    switch (captchaType) {
      case 'checkpoint':
        status = 'Checkpoint captcha';
        break;
      case 'checkout':
        status = 'Checkout captcha';
        break;
      default:
        status = 'Waiting for captcha';
        break;
    }

    this.log('info', this.taskData.id, status);
    this.sendStatus(status, taskColors.blue);

    this.getCaptchaToken(captchaRequest);

    return new Promise((resolve) => {
      setInterval((): void => {
        if (this.captchaData.token) resolve();
      }, 100);
    });
  }

  private getCaptchaData(body: string): void {
    // Scrape sitekey from body
    const [, captchaSitekey] = body.match(/.*<noscript>.*<iframe\s.*src=.*\?k=(.*)"><\/iframe>/);

    let captchaSession = null;

    const captchaSessionRegex = /s:\s'.+/gm;

    // Scrape session from body
    if (captchaSessionRegex.test(body)) {
      const [sessionPart] = body.match(captchaSessionRegex);
      const [, captchaSessionRaw] = sessionPart.split('s:');
      [, captchaSession] = captchaSessionRaw.split("'");
    }

    this.captchaData.session = captchaSession;
    this.captchaData.sitekey = captchaSitekey;

    // .*<noscript>.*<iframe\s.*src=.*\?k=(.*)"><\/iframe>
    // this.captchaSitekey = body
    //   .match(/sitekey.+/)[0]
    //   .split('sitekey:')[1]
    //   .split('"')[1];
  }

  /** ************************************
   *
   *         UTILITY FUNCTIONS
   *
   * *********************************** */

  setProduct(product: ShopifyProduct): void {
    // TODO: Check if we correctly receive the variant from the monitor
    this.product = product;
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
    customerInformation['checkout[client_details][browser_width]'] = '1920';
    customerInformation['checkout[client_details][browser_height]'] = '1080';
    customerInformation['checkout[client_details][javascript_enabled]'] = 1;
    this.customerPayload = customerInformation;
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
    paymentInformation['checkout[client_details][browser_width]'] = '1920';
    paymentInformation['checkout[client_details][browser_height]'] = '1080';
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

  createCartPayload(variant: string): CartPayload {
    let cartPayload: CartPayload = {
      id: variant,
      quantity: '1',
      ...this.monitor.product.special.cartForm,
    };
    if (this.taskData.siteName === 'Kith') {
      const variantTitle = this.monitor.monitorProduct.variants.find((v) => v.id === this.monitor.product.variant).title;

      cartPayload = {
        id: variant,
        quantity: '1',
        'option-0': variantTitle,
        ...this.monitor.product.special.cartForm,
      };
    } else if (this.taskData.siteName === 'DSM US') {
      cartPayload = {
        id: variant,
        quantity: '1',
        'properties[_hash]': this.monitor.product.special.dsmHash,
      };
    }
    // if (this.taskData.siteName === 'DSM US') {
    // eslint-disable-next-line max-len
    //   const payload = `------WebKitFormBoundary3W4jVbixXeAFxGbG\r\nContent-Disposition: form-data; name="id"\r\n\r\n${variant}\r\n------WebKitFormBoundary3W4jVbixXeAFxGbG\r\nContent-Disposition: form-data; name="add"\r\n\r\n\r\n------WebKitFormBoundary3W4jVbixXeAFxGbG\r\nContent-Disposition: form-data; name="properties[_hash]"\r\n\r\n${this.foundProduct.special.dsmHash}\r\n------WebKitFormBoundary3W4jVbixXeAFxGbG--`;
    //   return payload;
    // }
    return cartPayload;
  }

  /**
   * Scrapes extra values for the shopify payload. Bot protection included.
   *
   * @param {string} query Search query for the payload desired
   * @param {string} checkoutPage Current checkout page
   * @param {(CustomerPayload | PaymentPayload | ShippingPayload)} payload Current payload
   * @returns {*}
   * @memberof ShopifySafe
   */
  scrapePayload(query: string, checkoutPage: string, payload: CustomerPayload | PaymentPayload | ShippingPayload): CustomerPayload | PaymentPayload | ShippingPayload {
    const $ = cheerio.load(checkoutPage);
    let scrapedForm = {};
    const scrapedBpForm = {};
    $(query)
      .find('input')
      .each((_, elem) => {
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

    $(`#fs_${this.checkoutData.token}`)
      .find('textarea')
      .each((i, elem) => {
        scrapedBpForm[elem.attribs.name] = elem.attribs.value || '';
      });

    if (Object.keys(scrapedBpForm).length > 0) {
      scrapedBpForm[`${this.checkoutData.token}-count`] = Object.keys(scrapedBpForm).length;
      scrapedForm = Object.assign(scrapedForm, scrapedBpForm);
    }

    this.scrapedForm = scrapedForm;
    return Object.assign(scrapedForm, payload);
  }

  /**
   * Encodes the customer information payload in the correct order
   * @param payload Customer payload
   */
  encodeCustomer(payload: any): string {
    const customerPayload: any = {};
    const baseData = {
      _method: 'patch',
      authenticity_token: payload.authenticity_token,
      previous_step: 'contact_information',
      step: 'shipping_method',
      'checkout[email]': this.profile.email,
      'checkout[buyer_accepts_marketing]': 0,
    };
    // Make a copy of the browser data;
    const browserData = JSON.parse(JSON.stringify(this.browserData));
    if (payload['g-recaptcha-response']) {
      browserData['g-recaptcha-response'] = payload['g-recaptcha-response'];
    }
    let extraPayload = {};
    const extraScrapedKeys = Object.keys(this.scrapedForm);
    extraScrapedKeys.forEach((key) => {
      const keyNotRecaptcha = key !== 'g-recaptcha-response';
      const keyNotMethod = key !== '_method';
      const keyNotStep = key !== 'step';
      const keyNotPrevious = key !== 'previous_step';
      const keyNotAuthToken = key !== 'authenticity_token';
      if (keyNotRecaptcha && keyNotMethod && keyNotStep && keyNotAuthToken && keyNotPrevious) {
        if (key.includes('checkout[client_details')) {
          browserData[key] = this.scrapedForm[key] === undefined ? '' : this.scrapedForm[key];
        } else if (key.includes('checkout[')) {
          customerPayload[key] = this.scrapedForm[key] === undefined ? '' : this.scrapedForm[key];
        } else {
          extraPayload[key] = this.scrapedForm[key] === undefined ? '' : this.scrapedForm[key];
        }
      }
    });

    if (extraPayload === {}) {
      extraPayload = this.scrapedForm;
    }

    customerPayload['checkout[shipping_address][first_name]'] = this.profile.firstname;
    customerPayload['checkout[shipping_address][last_name]'] = this.profile.lastname;
    customerPayload['checkout[shipping_address][address1]'] = this.profile.shipping.address;
    customerPayload['checkout[shipping_address][address2]'] = this.profile.shipping.apt || '';
    customerPayload['checkout[shipping_address][city]'] = this.profile.shipping.city;
    customerPayload['checkout[shipping_address][country]'] = this.profile.shipping.country;
    customerPayload['checkout[shipping_address][province]'] = this.profile.shipping.state;
    customerPayload['checkout[shipping_address][zip]'] = this.profile.shipping.zip;
    customerPayload['checkout[shipping_address][phone]'] = this.profile.phone;
    if (this.taskData.siteName.toLocaleLowerCase().includes('packer') || this.taskData.siteName.includes('Stussy')) {
      delete customerPayload['checkout[email]'];
      customerPayload['checkout[email_or_phone]'] = this.profile.email;
    }
    if (customerPayload['checkout[buyer_accepts_marketing]']) {
      delete customerPayload['checkout[buyer_accepts_marketing]'];
    }
    delete customerPayload['checkout[email]'];
    let shopifyQuery = `${this.shopifyUrlEncoded(baseData)}&${encodeURIComponent('checkout[buyer_accepts_marketing]')}=1`;
    // Add the same payload two times
    shopifyQuery += `&${this.shopifyUrlEncoded(customerPayload)}&${this.shopifyUrlEncoded(customerPayload)}`;
    // Check if there are any bot protection tokens
    shopifyQuery += `&${Object.keys(extraPayload).length !== 0 ? this.shopifyUrlEncoded(organizeTokens(extraPayload)) : ''}`;
    // Add the same -count key twice
    shopifyQuery += `&${extraPayload[`${this.checkoutData.token}-count`] ? `${this.checkoutData.token}-count=fs_count` : ''}`;
    // Finally add the browser data
    shopifyQuery += `&${this.shopifyUrlEncoded(organizeBrowserData(browserData))}`;
    shopifyQuery = shopifyQuery
      .replace(/step=&checkout%5Bremember_me%5D=0/, 'step=&checkout%5Bremember_me%5D=0&checkout%5Bremember_me%5D=1')
      .replace(/%2520/g, '+')
      .replace(/%20/g, '+')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/&&&/g, '&');
    return shopifyQuery;
  }

  /**
   * Encodes the shipping information payload in the correct order
   */
  encodeShipping(): string {
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
    let encodedPayload = `${this.shopifyUrlEncoded(baseData)}`;
    encodedPayload += `&${Object.keys(extraValues).length !== 0 ? this.shopifyUrlEncoded(organizeTokens(extraValues)) : ''}`;
    encodedPayload += `&${extraValues[`${this.checkoutData.token}-count`] ? `${this.checkoutData.token}-count=fs_count` : ''}`;
    encodedPayload += `&${this.shopifyUrlEncoded(organizeBrowserData(browserData))}`;
    return encodedPayload
      .replace(/\+/g, '%2520')
      .replace(/%20/g, '+')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  }
  /**
   * Encodes the payment payload in the correct order
   */
  encodePayment(): string {
    const baseData = {
      _method: 'patch',
      authenticity_token: this.paymentPayload.authenticity_token,
      previous_step: 'payment_method',
      step: '',
      s: this.checkoutData.paymentID,
    };
    const browserData = JSON.parse(JSON.stringify(this.browserData));
    const extraValues = {};
    const paymentData = [
      ['checkout[payment_gateway]', this.paymentPayload['checkout[payment_gateway]']],
      ['checkout[credit_card][vault]', 'false'],
      ['checkout[different_billing_address]', this.profile.usebilling ? this.profile.usebilling.toString() : 'false'],
      ['checkout[remember_me]', 'false'],
      ['checkout[total_price]', this.paymentPayload['checkout[total_price]']],
    ];
    if (this.paymentPayload['checkout[vault_phone]']) {
      paymentData.splice(4, 0, ['checkout[vault_phone]', this.paymentPayload['checkout[vault_phone]']]);
    }
    if (this.paymentPayload.complete) {
      paymentData.push(['complete', '1']);
    }
    const extraScrapedKeys = Object.keys(this.scrapedForm);
    extraScrapedKeys.forEach((key: string) => {
      if (key.includes('-count') && !baseData[key] && !key.includes('checkout[') && !key.includes('step')) {
        extraValues[key] = this.scrapedForm[key];
      }
    });
    let queryString = `${this.shopifyUrlEncoded(baseData)}`;
    queryString += `&${Object.keys(extraValues).length !== 0 ? this.shopifyUrlEncoded(organizeTokens(extraValues)) : ''}`;
    queryString += `${extraValues[`${this.checkoutData.token}-count`] ? `&${this.checkoutData.token}-count=fs_count` : ''}`;
    queryString += `${this.shopifyUrlEncoded(arrayToObject(paymentData))}`;
    queryString += `&${this.shopifyUrlEncoded(organizeBrowserData(browserData))}`;
    return queryString
      .replace(/&checkout%5Bremember_me%5D=false/, '&checkout%5Bremember_me%5D=false&checkout%5Bremember_me%5D=0')
      .replace(/%2520/g, '+')
      .replace(/%20/g, '+')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  }
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

  async setCartTimeStampCookie(): Promise<void> {
    const currentCookies = await this.safeRequests.cookieJar.getCookies(this.taskData.site);
    const cartCookie = currentCookies.find((c) => c.key === 'cart_ts');

    this.safeRequests.cookieJar.setCookie(
      `cart_ts=${cartCookie ? parseInt(cartCookie.value, 10) - this.randomNumber(35, 40) : Math.floor(Date.now() / 1000) - this.randomNumber(40, 50)}`,
      this.taskData.site,
    );
  }
  // eslint-disable-next-line consistent-return
  async getPaymentSession(): Promise<string> {
    try {
      const referer = `https://deposit.us.shopifycs.com/sessions?identifier=${this.checkoutData.token}&location=${encodeURIComponent(
        `${this.checkoutData.url}?previous_step=shipping_method&step=payment_method&dir=ltr&fonts[]=Roboto`,
      )}`;
      const { body, statusCode } = await this.safeRequests.getPaymentSession(JSON.stringify(this.cardPayload), referer);
      switch (statusCode) {
        case 200:
          if (body && body.id) {
            return body.id;
          }
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response getting payment session - ${statusCode}: ${body}`);
          this.safeRequests.saveProxy();
          await this.pause(this.taskData.retryDelay);
          await this.getPaymentSession();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.getPaymentSession);
    }
  }

  /**
   * Sets all the values required for webhook and checkouts db
   *
   * @param {string} responseBody
   * @returns {void}
   * @memberof ShopifySafe
   */
  setProductData(responseBody: string): void {
    if (this.stopped || this.taskData.siteName.includes('DSM')) return;
    const json = JSON.parse(responseBody);
    this.monitor.product.price = (json.final_price / 100).toFixed(2).toString();
  }

  setCheckoutCookies(): void {
    const { host } = new URL(this.taskData.site);

    const shopifyScookie = this.safeRequests.cookieJar.getCookiesSync(host).find((c) => c.key === '_shopify_s');

    const shopifyYcookie = this.safeRequests.cookieJar.getCookiesSync(host).find((c) => c.key === '_shopify_y');

    if (shopifyScookie) {
      this.safeRequests.cookieJar.setCookie(`_s=${shopifyScookie.value}`, this.taskData.site);
      this.safeRequests.cookieJar.setCookie(`_y=${shopifyYcookie.value}`, this.taskData.site);
    }

    this.safeRequests.cookieJar.setCookie(`hide_shopify_pay_for_checkout=${this.checkoutData.token}`, this.taskData.site);
    this.safeRequests.cookieJar.setCookie(`tracked_start_checkout=${this.checkoutData.token}`, this.taskData.site);
  }

  async proceedToCheckoutPayload(variant: string): Promise<object> {
    const payload: CheckoutPayload = {
      checkout: '',
      note: '',
    };
    let updatesKey = 'updates[]';

    if (this.taskData.siteName.includes('Palace')) {
      payload.note = await this.getPalaceNote();
      payload.checkout = 'Checkout';
      payload.terms = 'on';
      updatesKey = `updates[${variant}]`;
    }

    payload[updatesKey] = '1';
    return payload;
  }

  /**
   * Gets the special note required to create checkout for palace
   *
   * @returns {Promise<string>}
   * @memberof ShopifySafe
   */
  async getPalaceNote(): Promise<string> {
    try {
      this.log('info', this.taskData.id, 'Getting palace note');
      this.sendStatus(taskStatus.gettingProperties, taskColors.yellow);

      const { body } = await this.safeRequests.loadHomepageWithReferer(`${this.taskData.site}/cart`, this.taskData.site);
      const $ = cheerio.load(body);
      return $('[name="note"]').attr('value');
    } catch (error) {
      await this.handleError(error, this.getPalaceNote);
      return null;
    }
  }

  /** ************************************
   *
   *         ERROR HANDLER
   *
   * *********************************** */

  /**
   * Handles errors and retrys the function specified
   * @param error Error thrown by method
   * @param method Method to call again
   */
  async handleError(error: Error | RequestError, retryFunction: Function, ...retryFunctionArguments: any): Promise<unknown> {
    if (this.stopped) return;
    try {
      const { message } = error;
      this.log('fatal', this.taskData.id, `[${retryFunction.name}] - ${message}`);
      if (this.proxyErrors.test(message)) {
        // Check for proxy error
        this.log('fatal', this.taskData.id, `[${retryFunction.name}] Proxy error - ${message}`);
        this.sendStatus(taskStatus.proxyError, taskColors.red);
        this.safeRequests.saveProxy();
      } else if (this.timeoutErrors.test(message)) {
        // Check for timeout error
        const errorResponse = (error as RequestError).response;
        this.log('fatal', this.taskData.id, `[${retryFunction.name}] Timeout error - ${message} ${errorResponse.statusCode || ''}`);
        this.sendStatus(taskStatus.timeout, taskColors.red);
        this.safeRequests.saveProxy();
      } else if ((error as RequestError).response.statusCode === 401) {
        // Checks for password page
        this.log('warning', this.taskData.id, `[${retryFunction.name}] Password page (unhandled): ${retryFunction.name}`);
        this.sendStatus(taskStatus.password, taskColors.yellow);
      } else {
        const { statusCode } = (error as RequestError).response;
        this.sendStatus(`${taskStatus.taskError} ${statusCode || ''}`, taskColors.red);
        this.log('fatal', this.taskData.id, `[${retryFunction.name}] Task error, retrying - ${error.stack}`);
        this.safeRequests.saveProxy();
      }

      await this.pause(this.taskData.retryDelay);
      await retryFunction.bind(this)(...retryFunctionArguments);
    } catch (err) {}
  }
  /**
   * Check the redirect
   * @param requestURL Response url
   */
  async customerPageCheckRequestURL(requestURL: string): Promise<void> {
    if (this.stopped) return;
    try {
      if (requestURL.includes('stock_problems')) {
        this.log('warning', this.taskData.id, 'Product went OOS and customer infomation page');
        this.taskState.restock.active = true;
        this.taskState.restock.restockUrl = `${this.checkoutData.url}?step=contact_information`;
        // TODO: Wait for restock in page method
        this.stopped = true;
      } else if (requestURL.includes('throttle')) {
        this.log('warning', this.taskData.id, 'Task entered queue in customer information page');
        await this.waitQueue();
      } else {
        this.log('fatal', this.taskData.id, `Unexpected request url (customer page): ${requestURL}`);
      }
    } catch (error) {
      // await this.handleError(error, )
    }
  }
}
export default ShopifySafe;
