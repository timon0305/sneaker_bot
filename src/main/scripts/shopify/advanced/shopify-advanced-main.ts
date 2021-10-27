/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/interface-name-prefix */
/* eslint-disable no-await-in-loop */
import EventEmitter from 'events';
import cheerio from 'cheerio';

import ShopifyMain from '../main/shopify-main';
import ShopifyAdvancedRequests from './shopify-advanced-requests';
import ShopifyMonitor from '../main/new-monitor';
import monitorManager from '../../../managers/monitor-manager';

import shopifySiteKeys from '../../../helpers/shopify-keys';

import taskStatus from '../../../helpers/task-status';
import taskColors from '../../../helpers/task-colors';

import { ITaskData, IProfile, ICaptchaRequest } from '../../../interfaces/index';

interface ICheckpoints {
  Restock: boolean;
  'Got api key': boolean;
  'Logged in': boolean;
  'Created checkout': boolean;
  'Pre carted': boolean;
  'Added to cart': boolean;
  'Got shipping rate': boolean;
  'Submitted payment': boolean;
  Success: boolean;
}
class ShopifyAdvanced extends ShopifyMain {
  emitter: EventEmitter.EventEmitter;
  product: any;
  errorDelay: number;
  checkpoints: ICheckpoints;
  apiKey: string;
  customerPayload: any;
  splitCheckout: boolean;
  advancedRequests: ShopifyAdvancedRequests;
  checkoutUrl: string;
  checkoutToken: string;
  needsShipping: boolean;
  productResponse: any;
  triedPreCart: boolean;
  browserWidth: number;
  browserHeight: number;
  invalidAtcCodes: string[];
  cardPayload: any;
  checkoutSessionID: string;
  paymentPayload: any;
  shippingRate: string;
  paymentResponse: any;
  orderPayload: any;
  paymentSubmissions: number;
  captchaToken: string;
  cardRefresh: any;
  submittedCatpchaOrder: boolean;
  monitor: ShopifyMonitor;
  constructor(taskData: ITaskData, profile: IProfile, proxies: any) {
    super(taskData, profile, proxies);
    this.taskData = taskData;
    this.profile = profile;
    this.proxies = proxies;

    this.monitor = monitorManager.getMonitor(this.taskData.id);
    this.emitter = new EventEmitter.EventEmitter();
    this.emitter.on(`product-found-${this.taskData.id}`, this.saveProduct.bind(this));

    this.advancedRequests = new ShopifyAdvancedRequests(taskData, proxies);

    this.errorDelay = this.taskData.retryDelay;

    this.checkpoints = {
      Restock: false,
      'Got api key': false,
      'Logged in': false,
      'Created checkout': false,
      'Pre carted': false,
      'Added to cart': false,
      'Got shipping rate': false,
      'Submitted payment': false,
      Success: false,
    };
    this.browserWidth = this.randomNumber(600, 1400);
    this.browserHeight = this.randomNumber(300, 800);

    this.saveCustomerInformation();
    this.saveCardPayload();
    this.savePaymentPayload();
    this.saveOrderPayload();

    this.splitCheckout = false;
    this.invalidAtcCodes = ['400', '401', '404'];

    this.paymentSubmissions = 0;
    this.captchaToken = '';
    this.apiKey = shopifySiteKeys[this.taskData.site] ? shopifySiteKeys[this.taskData.site].key : undefined;
  }
  async login(): Promise<any> {
    if (this.stopped || this.checkpoints['Logged in'] || !this.taskData.requireLogin) return;
    console.log(this.taskData);
    try {
      const payload = {
        form_type: 'customer_login',
        'customer[email]': '',
        'customer[password]': '',
      };
      if (this.taskData.useAccountPool) {
        const randomAccount = this.getAccountFromPool(this.taskData.accountPool);
        // eslint-disable-next-line prefer-destructuring
        payload['customer[email]'] = randomAccount[0];
        // eslint-disable-next-line prefer-destructuring
        payload['customer[password]'] = randomAccount[1];
      } else if (this.taskData.requireLogin && !this.taskData.useAccountPool) {
        console.log('here');
        payload['customer[email]'] = this.taskData.email;
        payload['customer[password]'] = this.taskData.password;
      }
      let response = await this.advancedRequests.login(payload);
      if (this.stopped) return;
      if (response.body.indexOf('Invalid login credentials.') !== -1) {
        this.log('fatal', this.taskData.id, 'Invalid login');
        this.stopped = true;
      } else if (response.body.indexOf('sitekey') !== -1) {
        this.log('info', this.taskData.id, 'Waiting for captcha to login');
        const sitekey = this.getSitekey(response.body);
        await this.waitForCaptcha({
          site: new URL(this.taskData.site).host,
          sitekey,
          taskID: this.taskData.id,
        });
        payload['g-recaptcha-response'] = this.captchaToken;
        try {
          response = await this.advancedRequests.login(payload);
          if (response.body.indexOf('sitekey') === -1) {
            this.log('info', this.taskData.id, 'Logged in after captcha verication');
            this.checkpoints['Logged in'] = true;
          }
        } catch (err) {
          this.log('fatal', this.taskData.id, 'Error verifying captcha login');
          await this.handleError(err.message, err, this.login);
        }
      } else {
        this.log('info', this.taskData.id, 'Logged in');
        this.checkpoints['Logged in'] = true;
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error loggin in ${error}`);
      await this.handleError(error.message, error, this.login);
    }
  }
  async startCardSession(): Promise<void> {
    if (this.stopped) return;
    try {
      await this.createPaymentSession(this.cardPayload);
      this.paymentPayload.s = this.checkoutSessionID;
      if (this.cardRefresh) {
        clearInterval(this.cardRefresh);
      }
      this.cardRefresh = setInterval(async () => {
        try {
          this.log('info', this.taskData.id, 'Refreshed card session');
          await this.createPaymentSession(this.cardPayload);
          this.paymentPayload.s = this.checkoutSessionID;
        } catch (err) {
          this.log('fatal', this.taskData.id, `Error refreshing card session: ${err}`);
          await this.pause(this.errorDelay);
        }
      }, 1200000);
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error generating card session: ${error}`);
      await this.handleError(error.message, error, this.startCardSession);
    }
  }
  async createPaymentSession(payload): Promise<void> {
    try {
      const response = await this.advancedRequests.getPaymentID(payload, 'https://checkout.shopifycs.com/');
      this.checkoutSessionID = response.body.id;
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error creating payment session ${error}`);
      await this.handleError(error.message, error, this.createPaymentSession);
    }
  }
  async preCart(): Promise<void> {
    if (this.stopped) return;
    try {
      const cartPayload = {
        id: this.product.variant,
        quantity: 1,
      };
      const response = await this.advancedRequests.addToCartFrontend(cartPayload, null);
      this.productResponse = JSON.parse(response.body);
      this.needsShipping = this.productResponse.requires_shipping;
      this.checkpoints['Pre carted'] = true;
    } catch (error) {
      if (error.message.includes('Cannot find variant')) {
        this.log('warning', this.taskData.id, 'Cant pre cart, attempt regular atc method');
        this.triedPreCart = true;
        return;
      }
      this.log('fatal', this.taskData.id, `Error pre carting: ${error}`);
      await this.handleError(error.message, error, this.preCart);
    }
  }
  async mergeCheckout(): Promise<void> {
    if (!this.checkpoints['Pre carted'] || this.checkpoints['Added to cart'] || this.stopped) return;
    const siteHost = new URL(this.taskData.site).host;

    // eslint-disable-next-line no-underscore-dangle
    const cartToken = this.advancedRequests.cookieJar._jar.store.idx[siteHost]['/'].cart.value;
    // console.log(`Site host: ${siteHost}, cookie: ${cartToken}`);
    const newCartPayload = {
      checkout: {
        cart_token: cartToken,
        email: this.profile.email,
      },
    };
    try {
      this.log('info', this.taskData.id, 'Merging checkout');
      this.sendStatus(taskStatus.mergingCheckout, taskColors.yellow);
      const response = await this.advancedRequests.addToCart(this.checkoutToken, newCartPayload, this.apiKey);
      if (!this.checkCart(response.body)) {
        this.log('warning', this.taskData.id, `Continue regular atc ${response.statusCode}`);
        this.stopped = true;
      } else {
        this.checkpoints['Added to cart'] = true;
        this.log('info', this.taskData.id, 'Added to cart');
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error merging checkout: ${error}`);
      await this.handleError(error.message, error, this.mergeCheckout);
    }
  }
  async waitQueue(): Promise<any> {
    if (this.checkoutUrl.indexOf('poll') === -1 || this.stopped) {
      return;
    }
    let location = this.checkoutUrl;
    let status = 202;
    let pollResponse;
    while (status === 202 && !this.stopped) {
      try {
        if (this.stopped) break;
        this.log('info', this.taskData.id, 'Queue');
        this.sendStatus(taskStatus.queue, taskColors.blue);
        if (location.indexOf('_ctd_update') === -1) {
          location += '&_ctd_update=';
        }
        pollResponse = await this.advancedRequests.pollQueue(location, this.apiKey);
        status = pollResponse.statusCode;
        location = pollResponse.headers.location.indexOf('https') !== -1 ? pollResponse.headers.location : this.taskData.site + pollResponse.headers.location;
      } catch (error) {
        await this.handleError(error.message, error, this.waitQueue);
      }
      await this.pause(this.errorDelay);
    }
    this.log('info', this.taskData.id, 'Passed queue');
    this.saveCheckoutInformation(JSON.parse(pollResponse.body));
    this.checkpoints['Created checkout'] = true;
    // eslint-disable-next-line consistent-return
    return pollResponse;
  }
  async createCheckout(): Promise<void> {
    if (this.stopped || this.checkpoints['Created checkout']) return;
    this.sendStatus(taskStatus.creatingCheckout, taskColors.yellow);
    this.log('info', this.taskData.id, 'Creating checkout');
    const payload = JSON.parse(JSON.stringify(this.customerPayload));
    if (this.taskData.monitorType === 'variant' && !this.splitCheckout) {
      payload.checkout.email = this.profile.email;
      payload.checkout.line_items = [
        {
          variant_id: this.product.variant,
          quantity: 1,
        },
      ];
    }
    try {
      const response = await this.advancedRequests.createCheckout(payload, this.apiKey);
      if (this.stopped) return;
      const checkoutData = response.body;
      this.saveCheckoutInformation(checkoutData);
      if (this.taskData.monitorType === 'variant' && !this.splitCheckout) {
        if (response.body.checkout && response.body.checkout.line_items.length > 0 && !this.stopped) {
          // eslint-disable-next-line prefer-destructuring
          this.productResponse = response.body.checkout.line_items[0];
          this.needsShipping = response.body.checkout.requires_shipping;
          this.checkpoints['Added to cart'] = true;
          this.checkpoints['Pre carted'] = true;
        }
      }
      this.refreshCheckoutUrl(this.checkoutUrl);
      this.sendStatus(taskStatus.creatingCheckout, taskColors.yellow);
      this.log('info', this.taskData.id, `Created checkout url: ${this.checkoutUrl}`);
      this.checkpoints['Created checkout'] = true;
    } catch (error) {
      if (error.message.includes('not_enough_in_stock') || error.message.includes('invalid')) {
        this.log('warning', this.taskData.id, 'Cannot create checkout with user variant, split checkout');
        this.splitCheckout = true;
        await Promise.all([this.createCheckout(), this.preCart()]);
        await this.mergeCheckout();
      } else if (error.statusCode === 401 || error.statusCode === 400) {
        this.log('info', this.taskData.id, 'Password page');
        await this.pause(this.taskData.monitorDelay);
      } else if (error.statusCode === 303 && error.response.headers.location) {
        this.checkoutUrl = error.response.headers.location;
        await this.waitQueue();
      } else {
        await this.handleError(error.message, error, this.createCheckout);
      }
    }
  }
  async addToCart(): Promise<void> {
    if (this.stopped || this.checkpoints['Added to cart']) return;
    try {
      const payload = this.cartPayload();
      this.log('info', this.taskData.id, 'Adding to cart');
      this.sendStatus(taskStatus.carting, taskColors.yellow);
      const response = await this.advancedRequests.addToCart(this.checkoutToken, payload, this.apiKey);
      if (!this.checkCart(response.body)) {
        this.sendStatus(taskStatus.cartError, taskColors.red);
        this.log('fatal', this.taskData.id, `Error adding to cart: ${response.statusCode}`);
        await this.pause(this.errorDelay);
        return;
      }
      this.log('info', this.taskData.id, 'Added to cart');
      this.checkpoints['Added to cart'] = true;
    } catch (error) {
      if ((error.message.includes('not_enough_in_stock') || error.message.includes('Cannot find variant') || error.message.includes('is invalid')) && this.stopped === false) {
        if (this.taskData.monitorType === 'variant' && this.taskData.sizes.indexOf('random') !== -1) {
          /**
           * We should start a new restock monitor here becasue if we might get blocked
           * faster if we try to ATC too many times
           */
          this.sendStatus(taskStatus.restock, taskColors.yellow);
          this.log('info', this.taskData.id, 'Waiting for restock, here omg');
          await this.pause(this.errorDelay);
          await this.addToCart();
        } else if (!this.triedPreCart) {
          await this.preCart();
          await this.mergeCheckout();
          if (this.checkpoints['Added to cart']) {
            // eslint-disable-next-line no-useless-return
            return;
          }
        } else {
          // Make a new restock monitor here? bc task can get 429 easier
          this.log('info', this.taskData.id, 'Waiting for restock');
          await this.pause(this.errorDelay);
          await this.addToCart();
        }
      } else {
        await this.handleError(error.message, error, this.addToCart);
      }
    }
  }
  async getShippingRates(): Promise<void> {
    if (this.stopped || !this.checkpoints['Added to cart'] || this.checkpoints['Got shipping rate']) {
      return;
    }
    if (this.taskData.useShippingRate) {
      this.shippingRate = this.taskData.shippingRate;
      this.checkpoints['Got shipping rate'] = true;
      return;
    }
    try {
      const response = await this.advancedRequests.getShippinRates(this.checkoutToken, this.apiKey);
      const shippingRates = JSON.parse(response.body);
      if (shippingRates.shipping_rates && shippingRates.shipping_rates.length > 0) {
        this.shippingRate = shippingRates.shipping_rates[0].id;
        this.checkpoints['Got shipping rate'] = true;
        this.log('info', this.taskData.id, 'Got shipping rate');
        this.sendStatus(taskStatus.gotRates, taskColors.yellow);
      } else {
        this.log('info', this.taskData.id, 'Waiting for rates');
        this.sendStatus(taskStatus.waitingRates, taskColors.yellow);
        await this.pause(500);
        await this.getShippingRates();
      }
    } catch (error) {
      await this.handleError(error.message, error, this.getShippingRates);
    }
  }
  async submitPayment(): Promise<void> {
    if (this.stopped) return;
    if (!this.checkoutSessionID) {
      await this.createPaymentSession(this.cardPayload);
      this.paymentPayload.s = this.checkoutSessionID;
    }
    if (!this.shippingRate) {
      await this.getShippingRates();
      this.paymentPayload['checkout[shipping_rate][id]'] = this.shippingRate;
    }
    this.paymentPayload['checkout[shipping_rate][id]'] = this.shippingRate;
    const payload = JSON.parse(JSON.stringify(this.paymentPayload));
    try {
      if (this.stopped) return;
      this.paymentResponse = await this.advancedRequests.patchCheckoutFrontEnd(this.checkoutUrl, payload, this.apiKey);
      if (this.paymentResponse && this.paymentResponse.statusCode === 200) {
        this.sendStatus(`${taskStatus.submittingPayment} ${this.paymentSubmissions === 0 ? '' : this.paymentSubmissions}`, taskColors.yellow);
        this.log('info', this.taskData.id, 'Submitting payment');
        this.checkpoints['Submitted payment'] = true;
      }
    } catch (error) {
      await this.handleError(error.message, error, this.submitPayment);
    }
  }
  async handlePayment(): Promise<void> {
    if (!this.checkpoints['Submitted payment'] || this.stopped) return;
    try {
      if (
        this.paymentResponse.body.indexOf('Calculating Taxes') !== -1 ||
        this.paymentResponse.body.indexOf('step = "review"') !== -1 ||
        this.paymentResponse.body.indexOf('The total of your order has changed. Review the order summary before you continue.') !== -1
      ) {
        this.sendStatus(taskStatus.caculatingTaxes, taskColors.yellow);
        this.log('info', this.taskData.id, 'Calculating taxes');
        const $ = cheerio.load(this.paymentResponse.body);
        const payload = JSON.parse(JSON.stringify(this.orderPayload));
        try {
          payload.authenticity_token =
            $('.edit_checkout')
              .find('[name="authenticity_token"]')
              .attr('value') || '';
          payload['checkout[total_price]'] = $('#checkout_total_price').attr('value') || '';
          // eslint-disable-next-line no-empty
        } catch (e) {}
        await this.submitNewOrder(payload);
      } else if (this.paymentResponse.body.toLowerCase().indexOf('your cart has been updated and the previous shipping rate isn’t valid') !== -1) {
        this.log('info', this.taskData.id, 'Submit order with new shipping rate');
        await this.newShippingRateOrder();
      } else if (this.paymentResponse.body.toLowerCase().indexOf('step = "payment_method"') !== -1) {
        const $ = cheerio.load(this.paymentResponse.body);
        this.paymentPayload.authenticity_token = $("input[name='authenticity_token']")[0].attribs.value;
        this.paymentPayload['checkout[total_price]'] = $('#checkout_total_price').attr('value');
        if ($('#checkout_vault_phone').length > 0) {
          this.paymentPayload['checkout[vault_phone]'] = $('#checkout_vault_phone').attr('value');
        } else {
          delete this.paymentPayload['checkout[vault_phone]'];
        }
        if ($('#checkout_credit_card_vault').length <= 0) {
          delete this.paymentPayload['checkout[credit_card][vault]'];
        }
        console.log($($('p[class="notice__text"]')[0]).text());
        this.paymentPayload['checkout[payment_gateway]'] = $('[name="checkout[payment_gateway]"]').attr('value');
        await this.startCardSession();
        this.checkpoints['Submitted payment'] = false;
        await this.submitPayment();
      } else if (
        this.paymentResponse.body.toLowerCase().indexOf('out of stock') !== -1 ||
        this.paymentResponse.request.path.indexOf('stock_problems') !== -1 ||
        (this.paymentResponse.headers.location && this.paymentResponse.headers.location.indexOf('stock_problems') !== -1)
      ) {
        /**
         * If restock mode > keep making a new payment session > await delay > submit order
         */
        const waitToResolve = [this.startCardSession()];
        waitToResolve.push(this.pause(this.taskData.monitorDelay));
        await Promise.all(waitToResolve);
        this.checkpoints['Submitted payment'] = false;
        this.paymentSubmissions += 1;
        await this.submitPayment();
      } else if (this.paymentResponse.request.path.indexOf('processing') !== -1 || (this.paymentResponse.headers.location && this.paymentResponse.headers.location.indexOf('processing') !== -1)) {
        this.sendStatus(taskStatus.processing, taskColors.yellow);
        this.log('info', this.taskData.id, 'Processing');
        return;
      } else if (this.paymentResponse.request.path.indexOf('/account/login') !== -1) {
        this.sendStatus('Login needed', taskColors.red);
        this.log('fatal', this.taskData.id, 'Login needed');
        this.stopped = true;
      } else if (this.paymentResponse.body.includes('sitekey')) {
        const $ = cheerio.load(this.paymentResponse.body);
        console.log(this.paymentResponse.request.path);
        this.log('warning', this.taskData.id, 'Captcha needed');
        await this.newOrderCaptcha(
          this.getSitekey(this.paymentResponse.body),
          $('.edit_checkout')
            .find('[name="authenticity_token"]')
            .attr('value') || '',
        );
      } else if (this.paymentResponse.body.indexOf('attributes[sp_suspicious]=false') !== -1 && !this.orderPayload['checkout[attributes][sp_token]']) {
        console.log('submit suspicious order');
        this.stopped = true;
      } else {
        this.log('fatal', this.taskData.id, 'Something else');
        console.log(this.paymentResponse.body);
        this.stopped = true;
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error handling payment ${error.message}`);
      await this.startCardSession();
      this.checkpoints['Submitted payment'] = false;
      await this.pause(this.errorDelay);
      await this.submitPayment();
    }
  }
  async pollCheckoutBackend(): Promise<void> {
    if (this.stopped || this.checkpoints.Success) return;
    try {
      let payments = [];
      // eslint-disable-next-line no-mixed-operators
      while (payments.length === 0 || (payments[payments.length - 1].transaction === null && !payments[payments.length - 1].checkout.order && !this.stopped)) {
        if (this.stopped) {
          return;
        }
        const response = await this.advancedRequests.getCheckout(this.checkoutToken, this.apiKey);
        payments = JSON.parse(response.body).payments;
        if (payments.length === 0) {
          this.log('fatal', this.taskData.id, 'Payment failed');
        }
        if (payments[payments.length - 1].payment_processing_error_message) {
          this.log('fatal', this.taskData.id, `Checkout error ${payments[payments.length - 1].payment_processing_error_message}`);
          this.checkpoints['Submitted payment'] = false;
          this.paymentSubmissions += 1;
          this.sendWebhook({
            purchaseType: 'decline',
            productName: this.monitor.webhookData.name,
            image: this.monitor.webhookData.image,
            site: this.taskData.siteName,
            size: this.product.size ? this.product.size : this.monitor.webhookData.size,
            profile: this.profile.profilename,
            mode: 'Advanced',
          });
          this.saveCheckout({
            date: this.getFormattedDate(),
            type: 'decline',
            productName: this.monitor.webhookData.name,
            productImage: this.monitor.webhookData.image,
            size: this.product.size ? this.product.size : this.monitor.webhookData.size,
            mode: 'Advanced',
            delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
            captchaBypass: false,
            taskGroup: this.taskData.groupName,
            site: this.taskData.siteName,
            profile: this.profile.profilename,
            monitorInput: this.taskData.monitorInput,
          });
          await this.startCardSession();
          await this.submitPayment();
        }
        if (this.stopped) return;
        if (payments[payments.length - 1].transaction && !this.stopped) {
          if (payments[payments.length - 1].transaction.status === 'failure' && !this.stopped) {
            if (payments[payments.length - 1].transaction.message.indexOf('card was declined')) {
              this.sendStatus(taskStatus.declined, taskColors.red);
              this.log('info', this.taskData.id, 'Declined');
              this.sendWebhook({
                purchaseType: 'decline',
                productName: this.monitor.webhookData.name,
                image: this.monitor.webhookData.image,
                site: this.taskData.siteName,
                size: this.product.size ? this.product.size : this.monitor.webhookData.size,
                profile: this.profile.profilename,
                mode: 'Advanced',
              });
              this.saveCheckout({
                date: this.getFormattedDate(),
                type: 'decline',
                productName: this.monitor.webhookData.name,
                productImage: this.monitor.webhookData.image,
                size: this.product.size ? this.product.size : this.monitor.webhookData.size,
                mode: 'Advanced',
                delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
                captchaBypass: false,
                taskGroup: this.taskData.groupName,
                site: this.taskData.siteName,
                profile: this.profile.profilename,
                monitorInput: this.taskData.monitorInput,
              });
              this.paymentSubmissions += 1;
            } else {
              this.sendStatus(taskStatus.failed, taskColors.red);
              this.log('fatal', this.taskData.id, 'Payment failed');
              this.paymentSubmissions += 1;
            }
          } else if (payments[payments.length - 1].transaction.status === null) {
            payments[payments.length - 1].transaction = null;
          } else {
            this.sendStatus(taskStatus.success, taskColors.green);
            this.log('success', this.taskData.id, 'Success');
            this.checkpoints.Success = true;
            this.sendWebhook({
              purchaseType: 'success',
              productName: this.monitor.webhookData.name,
              image: this.monitor.webhookData.image,
              site: this.taskData.siteName,
              size: this.product.size ? this.product.size : this.monitor.webhookData.size,
              profile: this.profile.profilename,
              mode: 'Advanced',
            });
            this.saveCheckout({
              date: this.getFormattedDate(),
              type: 'checkout',
              productName: this.monitor.webhookData.name,
              productImage: this.monitor.webhookData.image,
              size: this.product.size ? this.product.size : this.monitor.webhookData.size,
              mode: 'Advanced',
              delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
              captchaBypass: false,
              taskGroup: this.taskData.groupName,
              site: this.taskData.siteName,
              profile: this.profile.profilename,
              monitorInput: this.taskData.monitorInput,
            });
            this.stopped = true;
          }
        } else if (payments[payments.length - 1].checkout.order) {
          this.sendStatus(taskStatus.success, taskColors.green);
          this.log('success', this.taskData.id, 'Success');
          this.sendWebhook({
            purchaseType: 'success',
            productName: this.monitor.webhookData.name,
            image: this.monitor.webhookData.image,
            site: this.taskData.siteName,
            size: this.product.size ? this.product.size : this.monitor.webhookData.size,
            profile: this.profile.profilename,
            mode: 'Advanced',
          });
          this.saveCheckout({
            date: this.getFormattedDate(),
            type: 'checkout',
            productName: this.monitor.webhookData.name,
            productImage: this.monitor.webhookData.image,
            size: this.product.size ? this.product.size : this.monitor.webhookData.size,
            mode: 'Advanced',
            delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
            captchaBypass: false,
            taskGroup: this.taskData.groupName,
            site: this.taskData.siteName,
            profile: this.profile.profilename,
            monitorInput: this.taskData.monitorInput,
          });
          this.checkpoints.Success = true;
          this.stopped = true;
        }
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error pooling checkout from backend ${error}`);
      await this.handlePayment();
    }
  }
  async attemptCheckout(): Promise<void> {
    if (this.stopped) {
      return;
    }
    try {
      await this.addToCart();
      await this.getShippingRates();
      if (!this.paymentResponse) {
        await this.submitPayment();
      }
      await this.handlePayment();
      await this.pollCheckoutBackend();
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error attempting checkout: ${error}`);
      await this.pause(this.errorDelay);
    }
  }
  async submitNewOrder(payload): Promise<void> {
    try {
      this.log('info', this.taskData.id, 'Submitting order');
      this.sendStatus(taskStatus.submittingOrder, taskColors.yellow);
      this.paymentResponse = await this.advancedRequests.patchCheckoutFrontEnd(this.checkoutUrl, payload, this.apiKey);
    } catch (error) {
      await this.handleError(error.message, error, this.submitNewOrder);
    }
  }
  async newShippingRateOrder(): Promise<void> {
    delete this.shippingRate;
    const payload = JSON.parse(JSON.stringify(this.orderPayload));
    const $ = cheerio.load(this.paymentResponse.body);
    payload.authenticity_token = $("input[name='authenticity_token']")[0].attribs.value;
    if ($('.radio-wrapper').attr('data-shipping-method')) {
      payload['checkout[shipping_rate][id]'] = $('.radio-wrapper').attr('data-shipping-method');
    } else {
      await this.getShippingRates();
      console.log(`New shipping rate: ${this.shippingRate}`);
      payload['checkout[shipping_rate][id]'] = this.shippingRate;
    }
    return this.submitNewOrder(payload);
  }
  async newOrderCaptcha(sitekey, authToken): Promise<void> {
    const payload = JSON.parse(JSON.stringify(this.orderPayload));
    payload.authenticity_token = authToken;
    await this.waitForCaptcha({
      site: new URL(this.taskData.site).host,
      sitekey,
      taskID: this.taskData.id,
    });
    payload['g-recaptcha-response'] = this.captchaToken;
    payload.authenticity_token = authToken;
    this.submittedCatpchaOrder = true;
    return this.submitNewOrder(payload);
  }
  async startTask(): Promise<void> {
    this.log('info', this.taskData.id, 'Starting advanced task');
    // If site is cutom, we get the api key
    if (this.taskData.custom && this.apiKey === undefined) {
      await this.getApiKey();
    }
    // The monitor will stop once it checks that it is in variant mode and it'll set the product variant
    if (this.taskData.monitorType === 'variant') {
      await this.monitor.startMonitor(this.emitter);
    }
    await Promise.all([this.createCheckout(), this.login(), this.startCardSession()]);
    await this.monitor.startMonitor(this.emitter);
    while (!this.stopped || !this.checkpoints.Success) {
      if (this.stopped || this.checkpoints.Success) {
        break;
      }
      await this.waitForProduct();
      await this.attemptCheckout();
    }
  }
  // Utils
  saveProduct(shopifyProduct): void {
    if (shopifyProduct) {
      this.log('info', this.taskData.id, `Received product: ${JSON.stringify(shopifyProduct)}`);
      this.product = shopifyProduct;
    }
  }
  waitForProduct(): Promise<void> {
    if (!this.product) {
      return;
    }
    // eslint-disable-next-line consistent-return
    return new Promise((resolve) => {
      if (this.product) {
        resolve();
      }
    });
  }
  saveCustomerInformation(): void {
    const { profile } = this;
    const customerInfo: any = {};
    customerInfo.checkout = {};
    customerInfo.checkout.shipping_address = {};
    customerInfo.checkout.billing_address = {};
    customerInfo.checkout.secret = true;
    customerInfo.checkout.shipping_address.address1 = profile.shipping.address;
    customerInfo.checkout.shipping_address.address2 = profile.shipping.apt || '';
    customerInfo.checkout.shipping_address.city = profile.shipping.city;
    customerInfo.checkout.shipping_address.country = profile.shipping.country;
    customerInfo.checkout.shipping_address.first_name = profile.firstname;
    customerInfo.checkout.shipping_address.last_name = profile.lastname;
    customerInfo.checkout.shipping_address.phone = profile.phone;
    customerInfo.checkout.shipping_address.province = profile.shipping.state;
    customerInfo.checkout.shipping_address.state = profile.shipping.state;
    customerInfo.checkout.shipping_address.zip = profile.shipping.zip;
    // billing
    customerInfo.checkout.billing_address.address1 = profile.usebilling ? profile.billing.address : profile.shipping.address;
    customerInfo.checkout.billing_address.address2 = profile.usebilling ? profile.billing.apt : profile.shipping.apt || '';
    customerInfo.checkout.billing_address.city = profile.usebilling ? profile.billing.city : profile.shipping.city;
    customerInfo.checkout.billing_address.country = profile.usebilling ? profile.billing.country : profile.shipping.country;
    customerInfo.checkout.billing_address.first_name = profile.usebilling ? profile.firstname : profile.firstname;
    customerInfo.checkout.billing_address.last_name = profile.usebilling ? profile.lastname : profile.lastname;
    customerInfo.checkout.billing_address.phone = profile.usebilling ? profile.phone : profile.phone;
    customerInfo.checkout.billing_address.province = profile.usebilling ? profile.billing.state : profile.shipping.state;
    customerInfo.checkout.billing_address.state = profile.usebilling ? profile.billing.state : profile.shipping.state;
    customerInfo.checkout.billing_address.zip = profile.usebilling ? profile.billing.zip : profile.shipping.zip;
    this.customerPayload = customerInfo;
  }
  saveCheckoutInformation(checkoutData): void {
    this.checkoutUrl = checkoutData.checkout.web_url;
    this.checkoutToken = checkoutData.checkout.token;
  }
  saveCardPayload(): void {
    const payload: any = {
      credit_card: {
        number: this.profile.cardnumber,
        verification_value: this.profile.cvv,
        name: this.profile.cardholdername,
        month: this.profile.expdate.split('/')[0],
        year: this.profile.expdate.split('/')[1],
      },
    };
    this.cardPayload = payload;
  }
  savePaymentPayload(): void {
    const { profile } = this;
    const paymentPayload: any = {};
    // eslint-disable-next-line no-underscore-dangle
    paymentPayload._method = 'patch';
    paymentPayload.authenticity_token = '';
    paymentPayload.previous_step = 'payment_method';
    paymentPayload.step = '';
    paymentPayload.s = '';
    paymentPayload['checkout[credit_card][vault]'] = 'false';
    paymentPayload['checkout[different_billing_address]'] = profile.usebilling ? profile.usebilling.toString() : 'false';
    paymentPayload['checkout[remember_me]'] = '0';
    paymentPayload['checkout[vault_phone]'] = profile.phone;
    paymentPayload.complete = '1';
    paymentPayload.button = '';
    paymentPayload['checkout[client_details][browser_width]'] = this.browserWidth.toString();
    paymentPayload['checkout[client_details][browser_height]'] = this.browserHeight.toString();
    paymentPayload['checkout[client_details][javascript_enabled]'] = '1';
    if (profile.usebilling) {
      paymentPayload['checkout[billing_address][first_name]'] = profile.usebilling ? profile.firstname : profile.firstname;
      paymentPayload['checkout[billing_address][last_name]'] = profile.usebilling ? profile.lastname : profile.lastname;
      paymentPayload['checkout[billing_address][address1]'] = profile.usebilling ? profile.billing.address : profile.shipping.address;
      paymentPayload['checkout[billing_address][address2]'] = profile.usebilling ? profile.billing.apt : profile.shipping.apt || '';
      paymentPayload['checkout[billing_address][city]'] = profile.usebilling ? profile.billing.city : profile.shipping.city || '';
      paymentPayload['checkout[billing_address][country]'] = profile.usebilling ? profile.billing.country : profile.shipping.country;
      paymentPayload['checkout[billing_address][province]'] = profile.usebilling ? profile.billing.state : '';
      paymentPayload['checkout[billing_address][zip]'] = profile.usebilling ? profile.billing.zip : profile.shipping.zip;
      paymentPayload['checkout[billing_address][phone]'] = profile.phone;
    }
    this.paymentPayload = paymentPayload;
  }
  saveOrderPayload(): void {
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
  cartPayload(): any {
    const payload: any = {};
    payload.checkout = {};
    payload.checkout.email = this.profile.email;
    payload.checkout.line_items = [];
    const lineItem: any = {};
    lineItem.variant_id = this.product.variant;
    lineItem.quantity = 1;
    lineItem.properties = '';
    payload.checkout.line_items.push(lineItem);
    payload.checkout.client_details = {
      browser_width: this.browserWidth,
      browser_height: this.browserHeight,
    };
    return payload;
  }
  checkCart(checkoutObject): boolean {
    // check if we have an item in the line_items
    if ((!checkoutObject.checkout || !checkoutObject.checkout.line_items || checkoutObject.checkout.line_items.length === 0) && !this.stopped) {
      return false;
    }
    return true;
  }
  async waitForCaptcha(captchaData: ICaptchaRequest): Promise<any> {
    this.sendStatus(taskStatus.waitingCaptcha, taskColors.blue);
    this.getCaptchaToken(captchaData);
    return new Promise((resolve) => {
      setInterval(() => {
        if (this.captchaToken !== '') {
          resolve();
        }
      }, 200);
    });
  }
  saveCaptchaToken(token: string): void {
    if (token) {
      this.captchaToken = token;
    }
  }
  // eslint-disable-next-line class-methods-use-this
  getSitekey(body): any {
    return body
      .match(/sitekey.+/)[0]
      .split('sitekey:')[1]
      .split('"')[1];
  }
  async getApiKey(): Promise<void> {
    if (!this.taskData.custom || this.checkpoints['Got api key'] || this.stopped) return;
    while (this.apiKey === undefined && !this.stopped) {
      try {
        const response = await this.requests.getEndpoint(`${this.taskData.site}payments/config`);
        const configBody = JSON.parse(response.body);
        this.apiKey = configBody.paymentInstruments.accessToken;
        this.log('info', this.taskData.id, `Custom site api token: ${this.apiKey}`);
        this.checkpoints['Got api key'] = true;
      } catch (error) {
        this.log('fatal', this.taskData.id, `Error getting api key: ${error.message}`);
        await this.handleError(error.message, error, this.getApiKey);
      }
    }
  }
  async handleError(message, error, method): Promise<void> {
    if (this.stopped) return;
    if (
      message.indexOf('tunneling socket could not be established') !== -1 ||
      message.indexOf('EPROTO') !== -1 ||
      message.indexOf('socket hang up') !== -1 ||
      message.indexOf('Client network socket disconnected before secure TLS connection was established') !== -1
    ) {
      this.log('fatal', this.taskData.id, `Proxy error: ${message}`);
      this.sendStatus(taskStatus.proxyError, taskColors.red);
      // Switch proxy
      this.rotateProxy();
      await this.pause(this.errorDelay);
      // Call the method that threw the error
      await method.bind(this)();
      return;
    }
    if (error.statusCode === 429) {
      this.log('fatal', this.taskData.id, `Proxy banned: ${message}`);
      this.sendStatus(`${taskStatus.proxyBanned} ${error.statusCode}`, taskColors.red);
      // Switch proxy
      this.rotateProxy();
      await this.pause(this.errorDelay);
      // Call the method that threw the error
      await method.bind(this)();
      return;
    }
    if (message.indexOf('ESOCKETTIMEDOUT') !== -1 || message.indexOf('Too many requests') !== -1 || message.indexOf('Page temporarily unavailable') !== -1) {
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
    this.log('fatal', this.taskData.id, `Task error, retrying (${method.name}): ${message}`);
    // Switch proxy
    this.rotateProxy();
    await this.pause(this.errorDelay);
    // Call the method that threw the error
    await method.bind(this)();
  }
  rotateProxy(): void {
    this.advancedRequests.saveProxy();
  }
}
export default ShopifyAdvanced;
