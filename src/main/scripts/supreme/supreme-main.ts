/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/interface-name-prefix */
/* eslint-disable no-await-in-loop */
import EventEmitter from 'events';
import cheerio from 'cheerio';
import Tough from 'tough-cookie';
import MainBot from '../main-classes/main-bot';
import SupremeRequests from './supreme-requests';
import monitorManager from '../../managers/monitor-manager';

import taskColors from '../../helpers/task-colors';
import taskStatus from '../../helpers/task-status';
import { ITaskData, ISupremeProduct, IProfile, ICaptchaRequest } from '../../interfaces/index';
import Ticket from './supreme-ticket';
import SupremeMonitor from './supreme-monitor';

interface ITaskCheckpoints {
  'Got atc form': boolean;
  'Added to cart': boolean;
  'Got checkout form': boolean;
  'Checked out': boolean;
  'Waited delay': boolean;
}
const getStyle = "size.get('style').get('id')";
const getID = "size.get('id')";
const SITEKEY = '6LeWwRkUAAAAAOBsau7KpuC9AV-6J8mhw4AjC3Xz';

class SupremeBot extends MainBot {
  monitor: SupremeMonitor;
  taskData: ITaskData;
  taskCheckpoints: ITaskCheckpoints;
  $: any;
  emitter: EventEmitter;
  requests: SupremeRequests;
  profile: IProfile;
  formData: any;
  cartPayload: any;
  product: ISupremeProduct;
  captchaToken: any;
  paymentRetrys: number;
  countrycode: string;
  errorDelay: number;
  serverTicket: string;
  deviceID: string;
  cardinalID: string;
  cardType: string;
  transactionToken: string;
  cartTicket: any;
  localTicket: Ticket;
  atcTimestamp: number;
  totalDelay: number;
  calledCaptcha: boolean;
  // captchaToken: string;
  constructor(taskData: ITaskData, profile: IProfile, proxies: any) {
    super(taskData, proxies);
    // this.$ = cheerio.load('');
    this.taskCheckpoints = {
      'Got atc form': false,
      'Added to cart': false,
      'Got checkout form': false,
      'Checked out': false,
      'Waited delay': false,
    };

    this.monitor = monitorManager.getMonitor(taskData.id);

    this.emitter = new EventEmitter();
    this.emitter.on(`product-found-${this.taskData.id}`, this.saveProduct.bind(this));
    this.requests = new SupremeRequests(taskData, proxies);

    this.profile = profile;

    this.formData = [];

    this.paymentRetrys = 1;
    this.captchaToken = '';
    this.errorDelay = this.taskData.retryDelay;
    this.calledCaptcha = false;
    this.saveCountryCode();
    this.saveCardType();
  }
  waitForProduct() {
    if (this.stopped || !this.product) return;
    // eslint-disable-next-line consistent-return
    return new Promise((resolve) => {
      if (this.product) {
        return resolve();
      }
    });
  }
  async getCardinalID(): Promise<void> {
    if (this.stopped) return;
    try {
      const encodedSizeID = encodeURIComponent(encodeURIComponent(`{"${this.product.sizeID}":1}`));
      const cardinalResponse = await this.requests.getTotals(this.countrycode, encodedSizeID);
      const $ = cheerio.load(cardinalResponse.body);

      const JWT = $('#jwt_cardinal').val();
      const cardinalBody = await this.requests.initCardinal(this.cardinalPayload(JWT));
      const cardinalJWT = cardinalBody.body.CardinalJWT;

      const decoded = Buffer.from(cardinalJWT, 'base64').toString('utf8');
      // eslint-disable-next-line prefer-destructuring
      this.deviceID = decoded
        .split('"orgUnitId"')[1]
        .split(',"tmEventType"')[0]
        .split('"')[1];
      // eslint-disable-next-line prefer-destructuring
      this.cardinalID = decoded.split('"ReferenceId":"')[1].split('"')[0];
      this.log('info', this.taskData.id, `Cardinal ID: ${this.cardinalID}`);
      await this.requests.geoCardinalBrowser(this.geoCardinalPayload(this.deviceID, this.cardinalID));
    } catch (error) {
      await this.handleError(error.message, error, this.getCardinalID);
    }
  }
  async handleCheckout3ds(token: any): Promise<void> {
    try {
      const payload = {
        creq: token,
        threeDSSessionData: Buffer.from(this.cardinalID, 'utf8').toString('base64'),
      };
      const response = await this.requests.get3ds(payload);
      const transactionToken = response.body
        .match(/token:\s'.+'/g)[0]
        .split('token:')[1]
        .split("'")[1];
      this.transactionToken = transactionToken;
      this.log('info', this.taskData.id, `3DS Transaction token: ${this.transactionToken}`);
      await this.waitVerification();
    } catch (error) {
      await this.handleError(error.message, error, this.handleCheckout3ds);
    }
  }
  async waitVerification(): Promise<void> {
    if (this.stopped) return;
    try {
      let response = await this.requests.getChallenge(this.transactionToken);
      while (
        JSON.stringify(response.body)
          .toString()
          .includes('pending')
      ) {
        this.log('info', this.taskData.id, 'Waiting for verification');
        await this.pause(1000);
        response = await this.requests.getChallenge(this.transactionToken);
      }
      if (
        JSON.stringify(response.body)
          .toString()
          .includes('declined')
      ) {
        this.log('info', this.taskData.id, 'Transaction cancelled');
        this.sendStatus('Transaction cancelled', taskColors.red);
        this.stopped = true;
      } else {
        await this.submitCardinalCheckout();
      }
    } catch (error) {
      await this.handleError(error.message, error, this.waitVerification);
    }
  }
  async submitCardinalCheckout(): Promise<void> {
    try {
      const payload = this.paymentPayload();
      if (this.formData) {
        this.formData.forEach((input) => {
          payload[input.name] = input.value;
        });
      }
      payload.credit_card.brand = this.cardType;
      payload.cardinal_id = this.cardinalID;
      const response = await this.requests.submitPaymentCardinal(payload, this.product.slug);
      if (
        response.body.status.toLowerCase() === 'cardinal_queued' ||
        JSON.stringify(response.body)
          .toString()
          .includes('cardinal_queued')
      ) {
        await this.processPayment();
      } else {
        this.log('fatal', this.taskData.id, `Unexpected response submitting cardinal: ${response.body}`);
      }
    } catch (error) {
      await this.handleError(error.message, error, this.submitCardinalCheckout);
    }
  }
  async getCookies(): Promise<void> {
    if (this.stopped) return;

    try {
      this.sendStatus('Getting cookie', taskColors.yellow);
      this.log('info', this.taskData.id, 'Getting cookie');

      // this.localTicket = new Ticket(this);
      // await this.localTicket.start();
    } catch (error) {
      await this.handleError(error.message, error, this.getCookies);
    }
  }
  async getMobileTotals(): Promise<void> {
    try {
      const encodedSizeID = encodeURIComponent(encodeURIComponent(`{"${this.product.sizeID}":1}`));
      const response = await this.requests.getTotals(this.countrycode, encodedSizeID);
      const priceRegex = /<span class="field" id="total">.+<\/span>/g;
      if (priceRegex.test(response.body)) {
        this.product.price = response.body.match(/<span class="field" id="total">.+<\/span>/g);
        // eslint-disable-next-line prefer-destructuring
        this.product.price = this.product.price[0].split('<span class="field" id="total">')[1].split('</span>')[0];
      }
      this.log('info', this.taskData.id, `Total response: ${response.body}`);
    } catch (error) {
      await this.handleError(error.message, error, this.getMobileTotals);
    }
  }
  async addToCart(): Promise<void> {
    if (this.stopped || !this.product || this.taskCheckpoints['Added to cart']) return;
    try {
      this.log('info', this.taskData.id, 'Adding to cart');
      this.sendStatus(taskStatus.carting, taskColors.yellow);
      this.requests.cookieJar.setCookie(`lastVisitedFragment=products/${this.product.productID}`, 'https://www.supremenewyork.com');
      this.requests.cookieJar.setCookie(`shoppingSessionId=${new Date().getTime()}`, 'https://www.supremenewyork.com');
      await this.getCookies();
      await this.getCartPayload();
      this.atcTimestamp = Date.now();
      const response = await this.requests.addToCart(this.product.productID, this.cartPayload);
      if (!response.body) {
        this.log('fatal', this.taskData.id, `Error carting: ${response.body}`);
        this.sendStatus(taskStatus.cartError, taskColors.red);
        await this.pause(this.taskData.retryDelay);
        await this.addToCart();
      }
      if (!response.body.toLowerCase().includes('"in_stock":true')) {
        this.sendStatus(taskStatus.restock, taskColors.yellow);
        this.log('info', this.taskData.id, 'Waiting for restock, adding to cart...');
        await this.pause(this.taskData.retryDelay);
        await this.addToCart();
        return;
      }
      if (this.taskData.siteName.includes('EU') && this.taskData.use3ds) {
        this.log('warning', this.taskData.id, 'Resolving cardinal');
        await this.getCardinalID();
      }
      this.taskCheckpoints['Added to cart'] = true;
    } catch (error) {
      await this.handleError(error.message, error, this.addToCart);
    }
  }
  async checkoutForm(): Promise<void> {
    if (this.stopped || this.taskCheckpoints['Got checkout form'] || !this.taskCheckpoints['Added to cart']) return;
    try {
      this.log('info', this.taskData.id, 'Getting form');
      this.sendStatus(taskStatus.supremeCheckoutForm, taskColors.yellow);
      const response = await this.requests.getCheckoutForm();
      this.$ = cheerio.load(response.body);
      const checkoutForm = this.$('#checkoutViewTemplate').html();
      this.$ = cheerio.load(checkoutForm);
      const inputs = this.$('input').serializeArray();
      inputs.forEach((input) => {
        this.formData.push(input);
      });
      this.log('info', this.taskData.id, `Checkout form: ${this.formData}`);
      this.taskCheckpoints['Got checkout form'] = true;
    } catch (error) {
      await this.handleError(error.message, error, this.checkoutForm);
    }
  }
  async submitPayment(): Promise<void> {
    if (this.stopped || !this.taskCheckpoints['Got checkout form']) return;
    try {
      this.sendStatus(`${taskStatus.submittingPayment} ${this.paymentRetrys > 1 ? this.paymentRetrys : ''}`, taskColors.yellow);
      const cookie = new Tough.Cookie({
        key: 'lastVisitedFragment',
        value: 'checkout',
        domain: 'www.supremenewyork.com',
        path: '/',
      });
      this.requests.cookieJar.setCookie(cookie.toString(), 'https://www.supremenewyork.com');
      const payload = await this.paymentPayload();
      const totalDelay = this.taskData.checkoutDelay - (Date.now() - this.atcTimestamp);

      const cartCookie = this.requests.cookieJar._jar.store.idx['www.supremenewyork.com']['/'].cart ? this.requests.cookieJar._jar.store.idx['www.supremenewyork.com']['/'].cart : null;
      const pureCartCookie = this.requests.cookieJar._jar.store.idx['www.supremenewyork.com']['/'].pure_cart;
      const sessionCookie = this.requests.cookieJar._jar.store.idx['supremenewyork.com']['/']._supreme_sess;
      if (this.stopped) return;
      this.log('info', this.taskData.id, `Jar: ${this.requests.cookieJar}`);
      this.log('info', this.taskData.id, `Waiting for delay: ${Math.sign(totalDelay) === -1 ? '0' : totalDelay}`);
      this.sendStatus(taskStatus.waitingDelay, taskColors.yellow);
      await this.pause(totalDelay);
      const response = await this.requests.submitPayment(payload);

      if (!response.body.status) {
        this.log('fatal', this.taskData.id, `Could not find payment status: ${response.statusCode}`);
        await this.pause(this.taskData.retryDelay);
        await this.submitPayment();
        return;
      }
      const paymentStatus = response.body.status.toLowerCase();
      if (paymentStatus === 'outofstock') {
        this.calledCaptcha = false;
        this.taskCheckpoints['Added to cart'] = false;
        await this.addToCart();
      } else if (paymentStatus === 'dup') {
        this.sendStatus(taskStatus.supremeDuplicate, taskColors.red);
        this.log('info', this.taskData.id, 'Duplicate order');
        this.stopped = true;
      } else if (paymentStatus === 'failed') {
        if (this.paymentRetrys <= 7) {
          this.sendStatus(`${taskStatus.submittingPayment} ${this.paymentRetrys}`, taskColors.yellow);
          this.log('info', this.taskData.id, `Submitting payment ${this.paymentRetrys}`);
          await this.pause(500);
          if (cartCookie) {
            this.requests.cookieJar.setCookie(cartCookie, this.taskData.site);
          }
          this.requests.cookieJar.setCookie(pureCartCookie, this.taskData.site);
          this.requests.cookieJar.setCookie(sessionCookie, this.taskData.site.replace(/www/, ''));
          this.paymentRetrys += 1;
          await this.submitPayment();
        } else {
          this.sendStatus('Failed to queue', taskColors.red);
          this.log('fatal', this.taskData.id, 'Failed to queue');
          this.stopped = true;
        }
      } else if (paymentStatus === 'queued') {
        this.product.slug = response.body.slug;
        this.log('info', this.taskData.id, 'Queued');
        this.sendStatus(taskStatus.queue, taskColors.yellow);
        await this.processPayment();
      }
    } catch (error) {
      await this.handleError(error.message, error, this.submitPayment);
    }
  }
  async processPayment(): Promise<void> {
    if (this.stopped) {
      return;
    }
    try {
      this.captchaToken = '';
      this.sendStatus(taskStatus.processing, taskColors.yellow);
      this.log('info', this.taskData.id, 'Processing');
      const response = await this.requests.paymentResult(this.product.slug);
      if (!response.body.status) {
        this.sendStatus(taskStatus.processingError, taskColors.red);
        this.log('fatal', this.taskData.id, `Error in payment queue, ${response.body}`);
      }

      if (response.body.status === 'queued') {
        this.sendStatus(taskStatus.processing, taskColors.yellow);
        this.log('info', this.taskData.id, 'Processing');
        await this.pause(this.taskData.monitorDelay);
        await this.processPayment();
      } else if (response.body.status === 'failed') {
        if ((response.body.page && response.body.page.toLowerCase().includes('card payment error')) || (response.body.page && response.body.page.toLowerCase().includes('due to high traffic'))) {
          this.sendStatus('Payment failed', taskColors.red);
          this.log('fatal', this.taskData.id, 'Payment failed');
          this.sendWebhook({
            site: this.taskData.siteName,
            size: this.product.sizeName,
            purchaseType: 'decline',
            image: this.product.image,
            productName: this.product.name,
            color: this.taskData.productColor,
            profile: this.profile.profilename,
            price: this.product.price,
            mode: 'Default',
            admin: 'Hard decline',
          });
          this.taskCheckpoints['Added to cart'] = false;
          this.calledCaptcha = false;
          await this.startTask();
          return;
        }
        this.sendStatus(taskStatus.declined, taskColors.red);
        this.log('info', this.taskData.id, 'Declined');
        this.sendWebhook({
          site: this.taskData.siteName,
          size: this.product.sizeName,
          purchaseType: 'decline',
          image: this.product.image,
          productName: this.product.name,
          color: this.taskData.productColor,
          profile: this.profile.profilename,
          price: this.product.price,
          mode: 'Default',
          admin: 'Normal decline',
        });
        this.saveCheckout({
          date: this.getFormattedDate(),
          type: 'decline',
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
        this.taskCheckpoints['Added to cart'] = false;
        this.calledCaptcha = false;
        await this.startTask();
      } else if (response.body.status === 'paid') {
        this.sendStatus(taskStatus.success, taskColors.green);
        this.log('info', this.taskData.id, 'Success');
        this.sendWebhook({
          site: this.taskData.siteName,
          size: this.product.sizeName,
          purchaseType: 'success',
          image: this.product.image,
          productName: this.product.name,
          color: this.taskData.productColor,
          profile: this.profile.profilename,
          price: this.product.price,
          mode: 'Default',
          admin: 'Success',
        });
        this.saveCheckout({
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
        this.stopped = true;
      } else if (response.body.status === 'cca') {
        this.log('info', this.taskData.id, 'Waiting for verification');
        this.sendStatus('Waiting for verification', taskColors.blue);
        // const decodedToken = JSON.parse(Buffer.from(response.body.payload, 'base64').toString('utf8'));
        await this.handleCheckout3ds(response.body.payload);
      } else if (response.body.status === 'cardinal_queued') {
        this.sendStatus(taskStatus.processing, taskColors.yellow);
        this.log('info', this.taskData.id, 'Processing');
        await this.pause(this.taskData.monitorDelay);
        await this.processPayment();
      }
    } catch (error) {
      await this.handleError(error.message, error, this.processPayment);
    }
  }
  async startTask(): Promise<void> {
    await this.monitor.startMonitor(this.emitter);
    while (!this.stopped || !this.taskCheckpoints['Checked out']) {
      if (this.stopped) {
        break;
      }
      await this.waitForProduct();
      await this.addToCart();
      await this.getMobileTotals();
      await this.checkoutForm();
      await this.submitPayment();
    }
  }
  saveProduct(product: ISupremeProduct): void {
    if (product) {
      this.product = product;
    }
  }
  saveCaptchaToken(token: string): void {
    if (token) {
      this.captchaToken = token;
    }
  }
  /**
   * Utils
   */
  async supremeCaptcha(): Promise<void> {
    if (this.calledCaptcha) return;
    try {
      this.log('info', this.taskData.id, 'Waiting for captcha');
      this.sendStatus(taskStatus.waitingCaptcha, taskColors.blue);
      await this.waitForCaptcha({
        taskID: this.taskData.id,
        site: 'http://www.supremenewyork.com/checkout',
        sitekey: SITEKEY,
        harvesterType: this.harvesterTypes.supreme,
      });
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error getting captcha: ${error.stack}`);
    }
  }
  async getCartPayload(): Promise<void> {
    if (this.taskCheckpoints['Got atc form']) {
      return;
    }
    try {
      const cartPayload: any = {};
      let cartScript = '';
      if (this.taskData.siteName === 'Supreme EU') {
        cartPayload.style = this.product.colorID;
        cartPayload.size = this.product.sizeID;
        cartPayload.qty = this.taskData.quantity ? this.taskData.quantity : '1';
        this.cartPayload = cartPayload;
        return;
      }
      const response = await this.requests.getScript(this.product.mobileScript);
      const scripts = response.body.split('addSize');
      for (let i = 0; i < scripts.length; i += 1) {
        const script = scripts[i];
        if (script.match(/add\.json/)) {
          cartScript = script
            .split('$.ajax(')[1]
            .split('data')[1]
            .substr(1)
            .split('{')[1]
            .split('}')[0]
            .split(',');
          break;
        }
      }
      for (let i = 0; i < cartScript.length; i += 1) {
        const key = cartScript[i].split(':');
        key[0] = key[0].replace(/\s/g, '');
        key[1] = key[1].replace(/\s/g, '');
        // eslint-disable-next-line prefer-destructuring
        cartPayload[key[0]] = key[1];
      }
      cartPayload.s = this.product.sizeID;
      cartPayload.st = this.product.colorID;
      cartPayload.qty = this.taskData.quantity ? this.taskData.quantity : '1';
      const allPayload = Object.entries(cartPayload);
      for (let p = 0; p < allPayload.length; p += 1) {
        const cartKey: any = allPayload[p];
        if (this.isEval(cartKey[0])) {
          if (cartKey[1].indexOf(getStyle) !== -1 || cartKey[1].indexOf(getID) !== -1) {
            cartKey[1] = cartKey[1].replace("size.get('id')", this.product.sizeID.toString()).replace("size.get('style').get('id')", this.product.colorID.toString());
            // eslint-disable-next-line prefer-destructuring
            cartPayload[cartKey[0]] = cartKey[1];
            // eslint-disable-next-line no-eval
            cartPayload[cartKey[0]] = eval(cartPayload[cartKey[0]]);
          }
        }
      }
      this.taskCheckpoints['Got atc form'] = true;
      this.cartPayload = cartPayload;
    } catch (error) {
      await this.handleError(error.message, error, this.getCartPayload);
    }
  }
  // eslint-disable-next-line class-methods-use-this
  isEval(cartPayloadKey): boolean {
    if (cartPayloadKey === 's' || cartPayloadKey === 'st' || cartPayloadKey === 'qty') {
      return false;
    }
    return true;
  }
  async paymentPayload(): Promise<string> {
    const payload: any = {};
    const { profile } = this;
    const paymentProfile = profile.usebilling ? profile.billing : profile.shipping;

    const cardExp = profile.expdate.split('/');
    this.formData.splice(14, 0, { name: 'order[billing_state]', value: paymentProfile.state });
    this.formData.splice(15, 0, { name: 'order[billing_country]', value: this.countrycode });
    this.formData.splice(16, 0, { name: 'credit_card[month]', value: cardExp[0] });
    this.formData.splice(17, 0, { name: 'credit_card[year]', value: `20${cardExp[1]}` });
    // console.log(this.formData);
    this.formData.forEach((input) => {
      payload[input.name] = input.value;
    });
    if (this.taskData.siteName.includes('EU')) {
      payload.credit_card.brand = this.cardType;
      if (this.taskData.use3ds) {
        payload.cardinal_id = this.cardinalID;
      }
      await this.supremeCaptcha();
      this.calledCaptcha = true;
    }
    if (this.taskData.captchaBypass) {
      this.captchaToken = undefined;
    } else {
      await this.supremeCaptcha();
      this.calledCaptcha = true;
    }
    payload['order[bn]'] = profile.cardholdername;
    payload['order[email]'] = profile.email;
    payload['order[tel]'] = profile.phone;
    payload['order[billing_address]'] = paymentProfile.address;
    payload['order[billing_address_2]'] = paymentProfile.apt;
    payload['order[billing_zip]'] = paymentProfile.zip;
    payload['order[billing_city]'] = paymentProfile.city;
    payload['credit_card[meknk]'] = profile.cvv;
    payload.riearmxa = profile.cardnumber;
    payload['g-recaptcha-response'] = this.captchaToken;
    payload['cookie-sub'] = encodeURIComponent(`{"${this.product.sizeID}":1}`);
    return this.encodePayload(payload).replace(/&order%5Bterms%5D=0/, '&order%5Bterms%5D=0&order%5Bterms%5D=1');
  }
  saveCountryCode(): void {
    const { profile } = this;
    let paymentProfile: any = {};
    if (profile.usebilling) {
      paymentProfile = profile.billing;
    } else {
      paymentProfile = profile.shipping;
    }
    // eslint-disable-next-line no-nested-ternary
    const countrycode = paymentProfile.countrycode === 'US' ? 'USA' : paymentProfile.countrycode === 'CA' ? 'CANADA' : paymentProfile.countrycode;
    this.countrycode = countrycode;
  }
  // eslint-disable-next-line class-methods-use-this
  saveCardType(): void {
    const supremeCardTypes = {
      Visa: 'visa',
      Amex: 'american_express',
      Mastercard: 'master',
      Discover: 'discover',
    };
    if (supremeCardTypes[this.profile.cardtype]) {
      this.cardType = supremeCardTypes[this.profile.cardtype];
    }
  }
  async waitForCaptcha(captchaData: ICaptchaRequest): Promise<unknown> {
    this.log('info', this.taskData.id, 'Waiting for captcha');
    this.sendStatus(taskStatus.waitingCaptcha, taskColors.blue);
    this.getCaptchaToken(captchaData);
    // eslint-disable-next-line consistent-return
    return new Promise((resolve) => {
      setInterval(() => {
        if (this.captchaToken !== '') {
          resolve();
        }
      }, 200);
    });
  }
  rotateProxy(): void {
    this.requests.saveProxy();
  }
  // eslint-disable-next-line class-methods-use-this
  cardinalPayload(JWT): any {
    return {
      BrowserPayload: {
        Order: {
          OrderDetails: {},
          Consumer: {
            BillingAddress: {},
            ShippingAddress: {},
            Account: {},
          },
          Cart: [],
          Token: {},
          Authorization: {},
          Options: {},
          CCAExtension: {},
        },
        SupportsAlternativePayments: {
          cca: true,
          hostedFields: false,
          applepay: false,
          discoverwallet: false,
          wallet: false,
          paypal: false,
          visacheckout: false,
        },
      },
      Client: {
        Agent: 'SongbirdJS',
        Version: '1.30.1',
      },
      ConsumerSessionId: null,
      ServerJWT: `${JWT}`,
    };
  }
  // eslint-disable-next-line class-methods-use-this
  geoCardinalPayload(deviceID, referenceID): string {
    const payload = {
      BinConfigIdentifiers: null,
      Cookies: { Legacy: true, LocalStorage: true, SessionStorage: true },
      DeviceChannel: 'Browser',
      Extended: {
        Browser: {
          Adblock: false,
          AvailableJsFonts: [
            'Arial',
            'Arial Hebrew',
            'Arial Rounded MT Bold',
            'Courier',
            'Courier New',
            'Georgia',
            'Helvetica',
            'Helvetica Neue',
            'Palatino',
            'Times',
            'Times New Roman',
            'Trebuchet MS',
            'Verdana',
          ],
          DoNotTrack: 'unknown',
          JavaEnabled: false,
        },
        Device: {
          ColorDepth: 32,
          Cpu: 'unknown',
          Platform: 'iPhone',
          TouchSupport: { MaxTouchPoints: 0, OnTouchStartAvailable: true, TouchEventCreationSuccessful: true },
        },
      },
      Fingerprint: 'db553f1c512faff91f943ac6dc914cfc',
      FingerprintingTime: 203,
      FingerprintDetails: { Version: '1.5.1' },
      Language: 'en-US',
      Latitude: null,
      Longitude: null,
      OrgUnitId: deviceID,
      Origin: 'Songbird',
      Plugins: [],
      ReferenceId: referenceID,
      Referrer: 'https://www.supremenewyork.com/mobile/',
      Screen: {
        FakedResolution: false,
        Ratio: 2.1653333333333333,
        Resolution: '812x375',
        UsableResolution: '812x375',
        CCAScreenSize: '01',
      },
      ThreatMetrixEnabled: 'false',
      ThreatMetrixEventType: 'PAYMENT',
      ThreatMetrixAlias: 'Default',
      ThreeDSServerTransId: null,
      TimeOffset: -60,
      UserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.5 Mobile/15E148 Safari/604.1',
      UserAgentDetails: { FakedOS: false, FakedBrowser: false },
      BinSessionId: null,
    };
    return JSON.stringify(payload).toString();
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
    if (error.message.indexOf('ESOCKETTIMEDOUT') !== -1) {
      this.log('fatal', this.taskData.id, 'Timeout');
      this.sendStatus(taskStatus.timeout, taskColors.red);
      // Switch proxy
      this.rotateProxy();
      await this.pause(this.errorDelay);
      // Call the method that threw the error
      await method.bind(this)();
      return;
    }
    this.sendStatus(`${taskStatus.taskError} ${error.statusCode ? `${error.statusCode}` : ''}`, taskColors.red);
    this.log('fatal', this.taskData.id, `Task error, retrying: ${error.stack}`);
    // Switch proxy
    this.rotateProxy();
    await this.pause(this.errorDelay);
    // Call the method that threw the error
    await method.bind(this)();
  }
  // eslint-disable-next-line class-methods-use-this
  encodePayload(obj, keys = true): string {
    const string = Object.keys(obj)
      .map((k) => `${encodeURIComponent(k)}=${keys ? encodeURIComponent(obj[k]) : ''}`)
      .join('&');
    return string;
  }
}

export default SupremeBot;
