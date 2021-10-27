/* eslint-disable camelcase */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/interface-name-prefix */
/* eslint-disable no-await-in-loop */
import Events from 'events';
import cheerio from 'cheerio';
import fs from 'fs';

import ShopifyMain from '../main/shopify-main';
import ShopifyAdvancedRequests from './shopify-advanced-requests';
import ShopifyMonitor from '../main/new-monitor';
import monitorManager from '../../../managers/monitor-manager';

import shopifySiteKeys from '../../../helpers/shopify-keys';

import taskStatus from '../../../helpers/task-status';
import taskColors from '../../../helpers/task-colors';

import { ITaskData, IProfile, ICaptchaRequest } from '../../../interfaces/index';

class ShopifyAdvanced extends ShopifyMain {
  monitor: ShopifyMonitor;
  emitter: Events.EventEmitter;
  advancedRequests: ShopifyAdvancedRequests;
  checkpoints: {
    'Logged in': boolean;
    'Created checkout': boolean;
    'Added to cart': boolean;
    'Got shipping rate': boolean;
    'Pre carted': boolean;
    'Submitted order': boolean;
    Success: boolean;
  };
  captchaToken: string;
  captchaSession: string;
  captchaSitekey: string;
  foundProduct: {
    size?: string;
    variant?: string | string[] | number;
    special?: { dsmHash?: string; key?: string; value?: string };
    price?: string;
    image?: string;
    name?: string;
  };
  apiKey: any;
  customerPayload: object;
  checkoutURL: string;
  checkoutToken: string;
  taskProperties: {
    splitCheckout: boolean;
    productBody: any;
    shippingRequired: boolean | null;
    useRandomCartVariant: boolean;
    triedPreCart: boolean;
  };
  cardPayload: { credit_card: { number: string; verification_value: string; name: string; month: string; year: string } };
  paymentPayload: any;
  cardSession: NodeJS.Timeout;
  shippingRate: string;
  paymentResponse: any;
  orderPayload: {
    _method: string;
    authenticity_token: string;
    complete: number;
    button: string;
    'checkout[client_details][browser_height]': string;
    'checkout[client_details][browser_width]': string;
    'checkout[client_details][javascript_enabled]': number;
  };
  taskState: { paymentSubmission: number; restockMode: boolean; processing: boolean };
  constructor(taskData: ITaskData, profile: IProfile, proxies) {
    super(taskData, profile, proxies);
    this.taskData = taskData;
    this.profile = profile;

    this.monitor = monitorManager.getMonitor(this.taskData.id);

    this.emitter = new Events.EventEmitter();

    this.advancedRequests = new ShopifyAdvancedRequests(taskData, proxies);

    this.checkpoints = {
      'Logged in': false,
      'Created checkout': false,
      'Pre carted': false,
      'Added to cart': false,
      'Got shipping rate': false,
      'Submitted order': false,
      Success: false,
    };
    this.taskProperties = {
      shippingRequired: null,
      splitCheckout: false,
      productBody: null,
      useRandomCartVariant: true,
      triedPreCart: false,
    };
    this.captchaToken = null;
    this.captchaSitekey = null;

    this.foundProduct = null;
    this.checkoutURL = null;
    this.checkoutToken = null;
    this.shippingRate = null;
    this.paymentResponse = null;
    this.emitter.addListener(`product-found-${this.taskData.id}`, (product) => {
      this.foundProduct = product;
    });
    this.taskState = {
      restockMode: false,
      paymentSubmission: 0,
      processing: false,
    };

    this.apiKey = shopifySiteKeys[this.taskData.site] ? shopifySiteKeys[this.taskData.site].key : undefined;
    this.setCustomer();
    this.setPaymentPayload();
    this.setCardPayload();
    this.setOrderPayload();
  }
  /**
   * Gets api key required for accessing protected endpoints
   */
  async getApiKey(): Promise<void> {
    if (!this.taskData.custom || this.checkpoints['Got api key'] || this.stopped) return;
    while (this.apiKey === undefined && !this.stopped) {
      try {
        const response = await this.requests.getEndpoint(`${this.taskData.site}/payments/config`);
        const configBody = JSON.parse(response.body);
        this.apiKey = configBody.paymentInstruments.accessToken;
        this.log('info', this.taskData.id, `Custom site api token: ${this.apiKey}`);
        this.checkpoints['Got api key'] = true;
      } catch (error) {
        this.log('fatal', this.taskData.id, `Error getting api key: ${error.message}`);
        await this.handleError(error, this.getApiKey);
      }
    }
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
      let response = await this.advancedRequests.login(payload);
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
        await this.waitForCaptcha({
          site: new URL(this.taskData.site).host,
          sitekey: this.captchaSitekey,
          taskID: this.taskData.id,
        });
        payload['g-recaptcha-response'] = this.captchaToken;
        try {
          response = await this.advancedRequests.login(payload);
          if (response.body.indexOf('sitekey') === -1) {
            this.log('info', this.taskData.id, 'Logged in after captcha verication');
            this.checkpoints['Logged in'] = true;
            this.captchaToken = null;
          }
        } catch (err) {
          this.log('fatal', this.taskData.id, 'Error verifying captcha login');
          await this.handleError(err, this.login);
        }
      } else {
        this.log('info', this.taskData.id, 'logged in');
        this.sendStatus('Logged in', taskColors.yellow);
        this.checkpoints['Logged in'] = true;
        this.captchaToken = null;
      }
    } catch (error) {
      await this.handleError(error, this.login);
    }
  }
  getCaptchaData(body: any): void {
    const sitekey = body
      .match(/sitekey.+/)[0]
      .split('sitekey:')[1]
      .split('"')[1];
    this.captchaSitekey = sitekey;
  }
  async waitQueue(): Promise<any> {
    if (this.checkoutURL.indexOf('poll') === -1 || this.stopped) {
      return;
    }
    let location = this.checkoutURL;
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
        if (typeof pollResponse.headers.location === 'undefined') {
          pollResponse = await this.advancedRequests.pollQueue(location, this.apiKey);
        } else {
          location = pollResponse.headers.location.indexOf('https') !== -1 ? pollResponse.headers.location : this.taskData.site + pollResponse.headers.location;
        }
      } catch (error) {
        await this.handleError(error, this.waitQueue);
      }
      await this.pause(5000);
    }
    this.log('info', this.taskData.id, 'Passed queue');
    this.setCheckoutRequirements(JSON.parse(pollResponse.body));
    this.checkpoints['Created checkout'] = true;
    // eslint-disable-next-line consistent-return
    return pollResponse;
  }
  /**
   * Creates a new payment ID every 15 minutes
   */
  async startCardSession(): Promise<void> {
    if (this.stopped) return;
    this.paymentPayload.s = await this.getPaymentID();
    this.cardSession = setInterval(async () => {
      if (this.stopped) {
        clearInterval(this.cardSession);
        return;
      }
      this.log('info', this.taskData.id, 'Refreshed card session');
      this.paymentPayload.s = await this.getPaymentID();
    }, 1200000);
  }
  /**
   * @returns Payment ID
   */
  async getPaymentID(): Promise<string> {
    if (this.stopped) return;
    try {
      const response = await this.advancedRequests.getPaymentID(this.cardPayload, 'https://checkout.shopifycs.com/');
      switch (response.statusCode) {
        case 200:
          // eslint-disable-next-line consistent-return
          return response.body.id;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response getting payment ID - ${response.statusCode}: ${JSON.stringify(response.body)}`);
          break;
      }
    } catch (error) {
      await this.handleError(error, this.getPaymentID);
    }
  }
  async preCart(): Promise<void> {
    if (this.stopped || this.taskProperties.triedPreCart) return;
    try {
      const cartPayload = {
        id: this.foundProduct.variant,
        quantity: 1,
      };
      const response = await this.advancedRequests.addToCartFrontend(cartPayload, null);
      switch (response.statusCode) {
        case 200:
          this.log('info', this.taskData.id, 'Pre-carted');
          this.taskProperties.productBody = JSON.parse(response.body);
          this.taskProperties.shippingRequired = this.taskProperties.productBody.requires_shipping;
          this.checkpoints['Pre carted'] = true;
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected pre-cart variant - ${response.statusCode}: ${response.body}`);
          this.taskProperties.triedPreCart = true;
          break;
      }
    } catch (error) {
      await this.handleError(error, this.preCart);
    }
  }
  async combineCheckout(): Promise<void> {
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
      this.log('info', this.taskData.id, 'Combining checkout');
      this.sendStatus('Combining checkout', taskColors.yellow);
      const response = await this.advancedRequests.addToCart(this.checkoutToken, newCartPayload, this.apiKey);
      if (!this.checkCart(response.body)) {
        this.log('warning', this.taskData.id, `Could not combine checkout - ${response.statusCode}, adding to cart`);
        await this.addToCart();
      } else {
        this.checkpoints['Added to cart'] = true;
        this.log('info', this.taskData.id, 'Added to cart');
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error combining checkout: ${error}`);
      await this.handleError(error, this.combineCheckout);
    }
  }
  /**
   * Attemps to create checkout URL.
   * - If we already have variant (variant mode) then we can add the item to the checkout object
   */
  async createCheckout(): Promise<void> {
    if (this.stopped || this.checkpoints['Created checkout']) return;
    this.sendStatus(taskStatus.creatingCheckout, taskColors.yellow);
    this.log('info', this.taskData.id, 'Creating checkout');
    const payload = JSON.parse(JSON.stringify(this.customerPayload));
    if (this.taskData.monitorType === 'variant' && !this.taskProperties.splitCheckout) {
      payload.checkout.email = this.profile.email;
      payload.checkout.line_items = [
        {
          variant_id: this.foundProduct.variant,
          quantity: 1,
        },
      ];
    }
    try {
      const response = await this.advancedRequests.createCheckout(payload, this.apiKey);
      switch (response.statusCode) {
        case 202:
        case 201:
          this.setCheckoutRequirements(response.body);
          // If we got here, there was no error pre carting and we proceed to set all the task propeties
          if (this.taskData.monitorType === 'variant' && !this.taskProperties.splitCheckout) {
            if (response.body.checkout && response.body.checkout.line_items.length > 0 && !this.stopped) {
              this.log('info', this.taskData.id, 'Pre-carted from checkout');
              // eslint-disable-next-line prefer-destructuring
              this.taskProperties.productBody = response.body.checkout.line_items[0];
              this.taskProperties.shippingRequired = response.body.checkout.requires_shipping;
              this.checkpoints['Added to cart'] = true;
              this.checkpoints['Pre carted'] = true;
            }
          }
          this.refreshCheckoutUrl(this.checkoutURL);
          this.log('info', this.taskData.id, `Created checkout url: ${this.checkoutURL}`);
          this.checkpoints['Created checkout'] = true;
          break;
        case 401:
        case 400:
          this.sendStatus(taskStatus.password, taskColors.yellow);
          this.log('info', this.taskData.id, 'Password page creating checkout');
          await this.pause(this.taskData.monitorDelay);
          await this.createCheckout();
          break;
        case 303:
          if (!response.headers.location) {
            this.log('fatal', this.taskData.id, `Error going to queue: ${JSON.stringify(response.body)}`);
            await this.pause(this.taskData.retryDelay);
            await this.createCheckout();
            return;
          }
          this.log('info', this.taskData.id, 'Entering queue');
          this.checkoutURL = response.headers.location;
          await this.waitQueue();
          break;
        case 422:
          this.log('warning', this.taskData.id, 'Could not create checkout with user variant, pre-carting');
          this.taskProperties.splitCheckout = true;
          await Promise.all([this.createCheckout(), this.preCart()]);
          await this.combineCheckout();
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response creating checkout - ${response.statusCode}: ${JSON.stringify(response.body)}`);
          this.advancedRequests.saveProxy();
          await this.pause(this.taskData.retryDelay);
          await this.createCheckout();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.createCheckout);
    }
  }
  async addToCart(): Promise<void> {
    if (this.stopped || this.checkpoints['Added to cart']) return;
    try {
      this.sendStatus(this.taskState.restockMode ? 'Waiting for restock' : taskStatus.carting, taskColors.yellow, this.foundProduct.name ? this.foundProduct.name : this.foundProduct.variant);
      this.log('info', this.taskData.id, `${this.taskState.restockMode ? 'Waiting for restock' : 'Adding to cart'}`);
      const response = await this.advancedRequests.addToCart(this.checkoutToken, this.cartPayload(), this.apiKey);
      switch (response.statusCode) {
        case 200:
        case 202:
          if (!this.checkCart(response.body)) {
            this.log('fatal', this.taskData.id, `Error adding to cart: ${JSON.stringify(response.body)}`);
            await this.pause(this.taskData.retryDelay);
            await this.addToCart();
            return;
          }
          this.checkpoints['Added to cart'] = true;
          this.foundProduct.image = response.body.checkout.line_items[0].image_url;
          this.foundProduct.price = response.body.checkout.line_items[0].price;
          this.foundProduct.name = response.body.checkout.line_items[0].title;
          break;
        case 422:
          /**
           * - If random size then we can pick a new variant every time we try to cart again
           * - Make this a mode?
           */
          if (this.taskData.sizes.includes('random') && this.taskProperties.useRandomCartVariant) {
            const newVariant = await this.monitor.getRandomVariant(this.foundProduct.variant);
            if (typeof newVariant === 'undefined') {
              this.log('warning', this.taskData.id, 'Could not find random cart variant');
              // In this case we couldnt find any other product variant
              this.taskProperties.useRandomCartVariant = false;
              await this.addToCart();
              return;
            }
            this.foundProduct.variant = newVariant;
            await this.pause(this.taskData.retryDelay);
            await this.addToCart();
            return;
          }
          if (!this.taskProperties.triedPreCart) {
            await this.preCart();
            await this.combineCheckout();
            if (this.checkpoints['Added to cart']) return;
          }
          this.taskState.restockMode = true;
          await this.pause(this.taskData.retryDelay);
          await this.addToCart();
          break;
        case 404:
          if (this.taskData.monitorType === 'variant') {
            this.log('info', this.taskData.id, 'Waiting for product');
            this.sendStatus(taskStatus.waitingProduct, taskColors.yellow);
            await this.pause(this.taskData.retryDelay);
            await this.addToCart();
            return;
          }
          this.log('fatal', this.taskData.id, 'Invalid variant');
          this.sendStatus(taskStatus.variantError, taskColors.red);
          await this.pause(this.taskData.retryDelay);
          await this.addToCart();
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response adding to cart - ${response.statusCode}: ${JSON.stringify(response.body)}`);
          this.sendStatus(taskStatus.cartingError, taskColors.red);
          this.advancedRequests.saveProxy();
          await this.pause(this.taskData.retryDelay);
          await this.addToCart();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.addToCart);
    }
  }
  async getShippingRate(): Promise<void> {
    if (this.stopped || !this.checkpoints['Added to cart'] || this.checkpoints['Got shipping rate']) return;
    if (this.taskData.useShippingRate) {
      this.shippingRate = this.taskData.shippingRate;
      return;
    }
    try {
      const response = await this.advancedRequests.getShippinRates(this.checkoutToken, this.apiKey);
      const shippingRates = JSON.parse(response.body);
      if (shippingRates.shipping_rates && shippingRates.shipping_rates.length > 0) {
        this.shippingRate = shippingRates.shipping_rates[0].id;
        this.paymentPayload['checkout[shipping_rate][id]'] = this.shippingRate;
        this.checkpoints['Got shipping rate'] = true;
      } else {
        this.log('info', this.taskData.id, 'Getting shipping rate');
        this.sendStatus('Getting shipping rate', taskColors.yellow);
        await this.pause(500);
        await this.getShippingRate();
      }
    } catch (error) {
      await this.handleError(error, this.getShippingRate);
    }
  }
  async submitOrder(): Promise<void> {
    if (this.stopped || this.taskState.processing) return;
    try {
      if (!this.taskState.restockMode && !this.taskState.processing) {
        this.log('info', this.taskData.id, 'Submitting order');
        this.sendStatus(taskStatus.submittingOrder, taskColors.yellow);
      } else {
        const status = this.taskState.processing ? 'Processing' : `Waiting for restock (${this.taskState.paymentSubmission})`;
        this.log('info', this.taskData.id, status);
        this.sendStatus(status, taskColors.yellow);
      }
      const payload = JSON.parse(JSON.stringify(this.paymentPayload));
      this.paymentResponse = await this.advancedRequests.patchCheckoutFrontEnd(this.checkoutURL, payload, this.apiKey);
      switch (this.paymentResponse.statusCode) {
        case 200:
          this.checkpoints['Submitted order'] = true;
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response submitting order - ${this.paymentResponse.statusCode}: ${this.paymentResponse.body}`);
          this.advancedRequests.saveProxy();
          await this.pause(this.taskData.retryDelay);
          await this.submitOrder();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.submitOrder);
    }
  }
  async handleCheckout(): Promise<void> {
    if (this.stopped || !this.checkpoints['Submitted order']) return;
    const responseBody = this.paymentResponse.body;
    try {
      if (responseBody.match(/Calculating Taxes|step = "review"|The total of your order has changed/)) {
        this.sendStatus(taskStatus.caculatingTaxes, taskColors.yellow);
        this.log('info', this.taskData.id, 'Calculating taxes');
        const $ = cheerio.load(responseBody);
        const payload = JSON.parse(JSON.stringify(this.orderPayload));
        payload.authenticity_token =
          $('.edit_checkout')
            .find('[name="authenticity_token"]')
            .attr('value') || '';
        payload['checkout[total_price]'] = $('#checkout_total_price').attr('value') || '';
        await this.submitNewOrder(payload);
      } else if (responseBody.match(/cart has been updated and the previous shipping rate/)) {
        this.log('info', this.taskData.id, 'Submitting order with new shipping rate');
        this.stopped = true;
      } else if (responseBody.match(/step = "payment_method"/)) {
        this.log('info', this.taskData.id, 'Submit payment again');
        const $ = cheerio.load(responseBody);
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
        this.log('warning', this.taskData.id, $($('p[class="notice__text"]')[0]).text());
        this.paymentPayload['checkout[payment_gateway]'] = $('[name="checkout[payment_gateway]"]').attr('value');
        this.checkpoints['Submitted order'] = false;
        await this.startCardSession();
      } else if (
        responseBody.toLowerCase().match(/out of stock/) ||
        this.paymentResponse.request.path.match(/stock_problems/) ||
        (this.paymentResponse.headers.location && this.paymentResponse.headers.location.match(/stock_problems/))
      ) {
        // Create session and wait for delay at the same time
        await Promise.all([this.startCardSession(), this.pause(this.taskData.monitorDelay)]);
        this.checkpoints['Submitted order'] = false;
        this.taskState.restockMode = true;
        this.taskState.paymentSubmission += 1;
      } else if (responseBody.match(/sitekey/)) {
        this.log('warning', this.taskData.id, 'Submitting order with captcha token');
        await this.submitCaptchaOrder(responseBody);
      } else if (this.paymentResponse.request.path.indexOf('processing') !== -1 || (this.paymentResponse.headers.location && this.paymentResponse.headers.location.indexOf('processing') !== -1)) {
        this.taskState.processing = true;
        this.log('info', this.taskData.id, 'Processing');
        this.sendStatus(taskStatus.processing, taskColors.yellow);
        await this.pollCheckoutBackend();
        return;
      } else {
        this.log('fatal', this.taskData.id, `Unexpected response handling payment - ${this.paymentResponse.statusCode}: ${responseBody}`);
        this.advancedRequests.saveProxy();
        await this.pause(this.taskData.retryDelay);
        return;
      }
    } catch (error) {
      await this.handleError(error, this.handleCheckout);
    }
  }
  async pollCheckoutBackend(): Promise<void> {
    if (this.stopped) return;
    try {
      let payments = [];
      // eslint-disable-next-line no-mixed-operators
      while (!this.stopped) {
        if (this.stopped) break;
        const response = await this.advancedRequests.getCheckout(this.checkoutToken, this.apiKey);
        payments = JSON.parse(response.body).payments;
        if (payments.length === 0) {
          this.log('fatal', this.taskData.id, 'Payment failed');
        }
        if (payments[payments.length - 1].payment_processing_error_message) {
          this.log('fatal', this.taskData.id, `Declined: ${payments[payments.length - 1].payment_processing_error_message}`);
          this.sendStatus(taskStatus.declined, taskColors.red);
          this.checkpoints['Submitted payment'] = false;
          this.taskState.paymentSubmission += 1;
          this.sendWebhook({
            purchaseType: 'decline',
            productName: this.foundProduct.name,
            image: this.foundProduct.image,
            site: this.taskData.siteName,
            size: this.foundProduct.size,
            profile: this.profile.profilename,
            price: this.foundProduct.price,
            mode: 'Advanced',
          });
          this.saveCheckout({
            date: this.getFormattedDate(),
            type: 'decline',
            productName: this.foundProduct.name,
            productImage: this.foundProduct.image,
            size: this.foundProduct.size,
            mode: 'Advanced',
            delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
            captchaBypass: false,
            taskGroup: this.taskData.groupName,
            site: this.taskData.siteName,
            profile: this.profile.profilename,
            monitorInput: this.taskData.monitorInput,
            price: this.foundProduct.price,
          });
          this.stopped = true;
        }
        if (this.stopped) return;
        if (payments[payments.length - 1].transaction && !this.stopped) {
          if (payments[payments.length - 1].transaction.status === 'failure' && !this.stopped) {
            if (payments[payments.length - 1].transaction.message.indexOf('card was declined')) {
              this.sendStatus(taskStatus.declined, taskColors.red);
              this.log('info', this.taskData.id, 'Declined');
              this.sendWebhook({
                purchaseType: 'decline',
                productName: this.foundProduct.name,
                image: this.foundProduct.image,
                site: this.taskData.siteName,
                size: this.foundProduct.size,
                profile: this.profile.profilename,
                price: this.foundProduct.price,
                mode: 'Advanced',
              });
              this.saveCheckout({
                date: this.getFormattedDate(),
                type: 'decline',
                productName: this.foundProduct.name,
                productImage: this.foundProduct.image,
                size: this.foundProduct.size,
                mode: 'Advanced',
                delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
                captchaBypass: false,
                taskGroup: this.taskData.groupName,
                site: this.taskData.siteName,
                profile: this.profile.profilename,
                monitorInput: this.taskData.monitorInput,
                price: this.foundProduct.price,
              });
              this.taskState.paymentSubmission += 1;
              this.stopped = true;
            } else {
              this.sendStatus(taskStatus.failed, taskColors.red);
              this.log('fatal', this.taskData.id, 'Payment failed');
              this.taskState.paymentSubmission += 1;
            }
          } else if (payments[payments.length - 1].transaction.status === null) {
            payments[payments.length - 1].transaction = null;
          } else {
            this.sendStatus(taskStatus.success, taskColors.green);
            this.log('success', this.taskData.id, 'Success');
            this.checkpoints.Success = true;
            this.sendWebhook({
              purchaseType: 'success',
              productName: this.foundProduct.name,
              image: this.foundProduct.image,
              site: this.taskData.siteName,
              size: this.foundProduct.size,
              profile: this.profile.profilename,
              price: this.foundProduct.price,
              mode: 'Advanced',
            });
            this.saveCheckout({
              date: this.getFormattedDate(),
              type: 'checkout',
              productName: this.foundProduct.name,
              productImage: this.foundProduct.image,
              size: this.foundProduct.size,
              mode: 'Advanced',
              delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
              captchaBypass: false,
              taskGroup: this.taskData.groupName,
              site: this.taskData.siteName,
              profile: this.profile.profilename,
              monitorInput: this.taskData.monitorInput,
              price: this.foundProduct.price,
            });
            this.stopped = true;
          }
        } else if (payments[payments.length - 1].checkout.order) {
          this.sendStatus(taskStatus.success, taskColors.green);
          this.log('success', this.taskData.id, 'Success');
          this.sendWebhook({
            purchaseType: 'success',
            productName: this.foundProduct.name,
            image: this.foundProduct.image,
            site: this.taskData.siteName,
            size: this.foundProduct.size,
            profile: this.profile.profilename,
            price: this.foundProduct.price,
            mode: 'Advanced',
          });
          this.saveCheckout({
            date: this.getFormattedDate(),
            type: 'checkout',
            productName: this.foundProduct.name,
            productImage: this.foundProduct.image,
            size: this.foundProduct.size,
            mode: 'Advanced',
            delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
            captchaBypass: false,
            taskGroup: this.taskData.groupName,
            site: this.taskData.siteName,
            profile: this.profile.profilename,
            monitorInput: this.taskData.monitorInput,
            price: this.foundProduct.price,
          });
          this.checkpoints.Success = true;
          this.stopped = true;
        }
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error pooling checkout from backend ${error}`);
      await this.handleCheckout();
    }
  }
  async submitNewOrder(payload: any): Promise<void> {
    if (this.stopped) return;
    try {
      this.paymentResponse = await this.advancedRequests.patchCheckoutFrontEnd(this.checkoutURL, payload, this.apiKey);
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error submitting new order: ${error.message}`);
      await this.pause(this.taskData.retryDelay);
      await this.submitNewOrder(payload);
    }
  }
  /**
   * Submits order with a new shipping rate
   */
  async submitNewRate() {}
  /**
   * Submits order with a captcha token
   * @param body Payment response body
   */
  async submitCaptchaOrder(body: any): Promise<void> {
    if (this.stopped) return;
    try {
      const $ = cheerio.load(body);
      const sitekey = body
        .match(/sitekey.+/)[0]
        .split('sitekey:')[1]
        .split('"')[1];
      const authToken =
        $('.edit_checkout')
          .find('[name="authenticity_token"]')
          .attr('value') || '';
      const payload = JSON.parse(JSON.stringify(this.orderPayload));
      payload.authenticity_token = authToken;
      await this.waitForCaptcha({
        site: `http://${new URL(this.taskData.site).host}`,
        sitekey,
        taskID: this.taskData.id,
        harvesterType: this.harvesterTypes.shopify,
      });
      payload['g-recaptcha-response'] = this.captchaToken;
      this.captchaToken = null;
      // eslint-disable-next-line consistent-return
      return this.submitNewOrder(payload);
    } catch (error) {
      await this.handleError(error, this.submitCaptchaOrder);
    }
  }
  async attempCheckout(): Promise<void> {
    if (!this.foundProduct.variant || this.stopped) return;
    await this.addToCart();
    await this.getShippingRate();
    await this.submitOrder();
    await this.handleCheckout();
    // this.stopped = true;
  }
  async startTask(): Promise<void> {
    try {
      this.log('info', this.taskData.id, 'Starting Shopify advanced task');
      // If site is cutom, we get the api key
      if (this.taskData.custom && this.apiKey === undefined) {
        await this.getApiKey();
      }
      // The monitor will set the variant and stop the monitor
      if (this.taskData.monitorType === 'variant') {
        await this.monitor.startMonitor(this.emitter);
      }
      await Promise.all([this.createCheckout(), this.startCardSession(), this.login()]);
      await this.monitor.startMonitor(this.emitter);
      while (!this.stopped || !this.checkpoints.Success) {
        if (this.stopped || this.checkpoints.Success) break;
        await this.attempCheckout();
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error in main task: ${error}`);
    }
  }
  async waitForCaptcha(captchaData: ICaptchaRequest): Promise<any> {
    this.log('info', this.taskData.id, 'Waiting for captcha');
    this.sendStatus(taskStatus.waitingCaptcha, taskColors.blue);
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
  /**
   * @returns Cart paylod
   */
  cartPayload(): any {
    return {
      checkout: {
        email: this.profile.email,
        line_items: [{ variant_id: this.foundProduct.variant, quantity: 1, properties: '' }],
        client_details: {
          browser_width: '1920',
          browser_height: '1080',
        },
      },
    };
  }
  /**
   * Checks if an item was successfully added to cart
   * @param checkoutObject Add to cart response
   */
  checkCart(checkoutObject): boolean {
    // check if we have an item in the line_items
    if ((!checkoutObject.checkout || !checkoutObject.checkout.line_items || checkoutObject.checkout.line_items.length === 0) && !this.stopped) {
      return false;
    }
    return true;
  }
  /**
   * Handles errors and retrys method
   * @param error Error thrown by method
   * @param method Method to call again
   */
  async handleError(error, method: Function): Promise<void> {
    if (this.stopped) return;
    const { message } = error;
    // Check for proxy error
    if (this.proxyErrors.test(message)) {
      this.log('fatal', this.taskData.id, `Proxy error - ${message}`);
      this.sendStatus(taskStatus.proxyError, taskColors.red);
      this.advancedRequests.saveProxy();
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
      // Check for timeout error
    } else if (this.timeoutErrors.test(message)) {
      this.log('fatal', this.taskData.id, `Timeout error - ${message} ${error.statusCode ? error.statusCode : ''}`);
      this.sendStatus(taskStatus.timeout, taskColors.red);
      this.advancedRequests.saveProxy();
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
    } else if (error.statusCode === 401) {
      this.log('warning', this.taskData.id, `Password page (unhandled): ${method.name}`);
      this.sendStatus(taskStatus.password, taskColors.yellow);
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
    } else {
      this.sendStatus(`${taskStatus.taskError} ${error.statusCode ? `${error.statusCode}` : ''}`, taskColors.red);
      this.log('fatal', this.taskData.id, `Task error, retrying - ${error.stack}`);
      this.advancedRequests.saveProxy();
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
    }
  }
  /**
   * Sets customer information
   */
  setCustomer(): void {
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
  /**
   * Sets payment payload
   */
  setPaymentPayload(): void {
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
    paymentPayload['checkout[client_details][browser_width]'] = '1920';
    paymentPayload['checkout[client_details][browser_height]'] = '1080';
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
    if (this.taskData.siteName.includes('Stussy')) {
      paymentPayload['checkout[email_or_phone]'] = this.profile.email;
    }
    this.paymentPayload = paymentPayload;
  }
  /** Sets order payload */
  setOrderPayload(): void {
    this.orderPayload = {
      _method: 'patch',
      authenticity_token: '',
      complete: 1,
      button: '',
      'checkout[client_details][browser_height]': '1920',
      'checkout[client_details][browser_width]': '1080',
      'checkout[client_details][javascript_enabled]': 1,
    };
  }
  /**
   * Sets card payload
   */
  setCardPayload(): void {
    const payload = {
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
  /**
   * Sets the Checkout URL and the Checkout token
   * @param checkoutData createCheckout response body
   */
  setCheckoutRequirements(checkoutData: any): void {
    this.checkoutURL = checkoutData.checkout.web_url;
    this.checkoutToken = checkoutData.checkout.token;
  }
}

export default ShopifyAdvanced;
