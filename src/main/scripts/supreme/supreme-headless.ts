// /* eslint-disable no-underscore-dangle */
// /* eslint-disable @typescript-eslint/camelcase */
// /* eslint-disable @typescript-eslint/interface-name-prefix */
// /* eslint-disable no-await-in-loop */
// import EventEmitter from 'events';
// import * as Puppeteer from 'puppeteer';
// import puppeteer from 'puppeteer-extra';
// import pluginStealth from 'puppeteer-extra-plugin-stealth';
// import MainBot from '../main-classes/main-bot';
// import SupremeRequests from './supreme-requests';
// import monitorManager from '../../managers/monitor-manager';

// import taskColors from '../../helpers/task-colors';
// import taskStatus from '../../helpers/task-status';
// import {ITaskData, ISupremeProduct, IProfile, ICaptchaRequest} from '../../interfaces/index';

// interface ITaskCheckpoints {
//   'Browser setup complete': boolean;
//   'Prepared session': boolean;
//   'Found product': boolean;
//   'Selected color': boolean;
//   'Added to cart': boolean;
//   'Submitted order': boolean;
// }
// const SITEKEY = '6LeWwRkUAAAAAOBsau7KpuC9AV-6J8mhw4AjC3Xz';
// const xd = pluginStealth();
// xd.enabledEvasions.delete('chrome.runtime');
// class SupremeHeadlessBot extends MainBot {
//   monitor: any;
//   taskData: ITaskData;
//   taskCheckpoints: ITaskCheckpoints;
//   emitter: EventEmitter;
//   requests: SupremeRequests;
//   profile: IProfile;
//   formData: any;
//   cartPayload: any;
//   product: ISupremeProduct;
//   captchaToken: any;
//   paymentRetrys: number;
//   countrycode: string;
//   errorDelay: number;
//   serverTicket: string;
//   deviceID: string;
//   cardinalID: string;
//   cardType: string;
//   transactionToken: string;

//   sizeSelectorName: string;
//   slug: string;
//   addressCookie: any;
//   addressPayload: string;
//   puppeteerParams: object;
//   region: string;
//   countryCode: string;
//   executablePath: string;
//   browser: Puppeteer.Browser;
//   page: Puppeteer.Page;
//   retryCookies: any;
//   // captchaToken: string;
//   constructor(taskData: ITaskData, profile: IProfile, proxies: any) {
//     super(taskData, proxies);
//     this.taskCheckpoints = {
//       'Browser setup complete': false,
//       'Prepared session': false,
//       'Found product': false,
//       'Selected color': false,
//       'Added to cart': false,
//       'Submitted order': false,
//     };

//     this.region = '';
//     this.countryCode = '';
//     this.sizeSelectorName = '';
//     this.slug = '';
//     this.addressCookie = {};
//     this.addressPayload = '';
//     this.executablePath = puppeteer.executablePath().replace('app.asar', 'app.asar.unpacked');
//     this.puppeteerParams = [
//       '--no-sandbox',
//       '--disable-gpu',
//       '--disable-infobars',
//       '--window-size=1000,700',
//       '--disable-dev-shm-usage',
//       '--disable-setuid-sandbox',
//       '--ignore-certifcate-errors',
//       // '--auto-open-devtools-for-tabs',
//       '--ignore-certifcate-errors-spki-list',
//     ];

//     this.monitor = monitorManager.getMonitor(taskData.id);

//     this.emitter = new EventEmitter();
//     this.emitter.on(`product-found-${this.taskData.id}`, this.saveProduct.bind(this));
//     this.requests = new SupremeRequests(taskData, proxies);

//     this.profile = profile;

//     this.formData = [];

//     this.paymentRetrys = 1;
//     this.captchaToken = '';
//     this.errorDelay = this.taskData.retryDelay;

//     /* Puppeteer Setup */
//     puppeteer.use(pluginStealth());
//     // this.browser = {};
//     // this.page = {};

//     this.saveCountryCode();
//     this.saveCardType();
//     this.setRegionValues();
//   }
//   // eslint-disable-next-line class-methods-use-this
//   async prepareSession(): Promise<void> {
//     if (this.stopped || this.taskCheckpoints['Prepared session'] || !this.taskCheckpoints['Browser setup complete']) {
//       return;
//     }
//     try {
//       this.log('info', this.taskData.id, 'Preparing session');
//       this.sendStatus(taskStatus.prepare, taskColors.yellow);
//       const exdate = new Date();
//       exdate.setDate(exdate.getDate() + 365);
//       const addressCookie = {
//         name: 'address',
//         value: encodeURIComponent(this.addressPayload).replace(/%7C/g, '|'),
//         url: 'https://www.supremenewyork.com',
//         domain: 'www.supremenewyork.com',
//         path: '/',
//         expires: exdate / 1000,
//       };
//       this.addressCookie = addressCookie;
//       await this.page.setCookie(addressCookie);
//       this.taskCheckpoints['Prepared session'] = true;
//     } catch (error) {
//       this.log('fatal', this.taskData.id, `Error preparing session: ${error.message}`);
//       await this.handleError(error.message, error, this.prepareSession);
//     }
//   }
//   async addToCart(): Promise<void> {
//     if (this.stopped || !this.product) {
//       return;
//     }
//     try {
//       this.log('info', this.taskData.id, 'Adding to cart');
//       this.sendStatus(taskStatus.carting, taskColors.yellow);
//       this.page.goto(
//         `https://www.supremenewyork.com/shop/${this.taskData.category.replace(/\//g, '_')}/${this.product.productID}/${
//           this.product.colorID
//         }`,
//       );
//       if (this.product.sizeName !== 'N/A') {
//         const selectSize = await this.handleInput(this.sizeSelectorName, this.product.sizeID, true);
//         if (!selectSize) throw new Error('Unable to select size.');
//       }
//       await this.click('[name="commit"]');
//       await this.page.waitForSelector('#cart', {visible: true});
//       this.taskCheckpoints['Added to cart'] = true;
//       await Promise.all([this.page.waitForNavigation({waitUntil: 'load'}), this.click('.checkout')]);
//     } catch (error) {
//       this.sendStatus(`${taskStatus.cartingError}. ${error.statusCode}`, taskColors.red);
//       await this.handleError(error.message, error, this.addToCart);
//     }
//   }
//   async submitPayment(resubmitting = false): Promise<boolean> {
//     if (this.stopped || !this.taskCheckpoints['Added to cart']) {
//       return;
//     }
//     try {
//       this.sendStatus(taskStatus.submittingPayment, taskColors.yellow);
//       this.log('info', this.taskData.id, 'Handling payment details');
//       if (resubmitting) {
//         this.log('info', this.taskData.id, `Retrying checkout ${this.paymentRetrys}`);
//         this.sendStatus(`Retrying checkout ${this.paymentRetrys}`, taskColors.yellow);

//         this.captchaToken = '';
//         this.page = await this.browser.newPage();
//         await this.page.setRequestInterception(true);
//         this.page.on('request', request => {
//           request.continue();
//         });
//         this.page.on('response', this.beginProcessPayment.bind(this));

//         await this.page.setCookie(this.addressCookie);

//         this.log('info', this.taskData.id, 'Loading checkout page');
//         if (this.retryCookies) {
//           const cartCookies = this.retryCookies.filter(cookie =>
//             ['pure_cart', 'cart', '_supreme_sess'].includes(cookie.name),
//           );
//           await this.page.setCookie(...cartCookies);
//         }
//         const result = await this.page.goto('https://www.supremenewyork.com/checkout');
//         if (result.url() === 'https://www.supremenewyork.com/shop') {
//           await this.addToCart();
//         }
//       }

//       await this.page.waitForSelector('#checkout_form');

//       this.log('info', this.taskData.id, 'Entering card info');
//       await this.page.waitForSelector('#cart-cc');
//       await this.handlePayment();

//       if (this.taskData.captchaBypass || this.taskData.restockMode) {
//         this.captchaToken = undefined;
//       } else {
//         await this.waitForCaptcha({
//           taskID: this.taskData.id,
//           site: 'http://www.supremenewyork.com/checkout',
//           sitekey: SITEKEY,
//           harvesterType: this.harvesterTypes.supreme,
//         });
//       }

//       // get price for api
//       this.product.price = await this.page.evaluate("(() => document.querySelector('#total').innerText)()");

//       this.retryCookies = await this.page.cookies('https://www.supremenewyork.com/');
//       if (this.taskData.checkoutDelay && !this.taskCheckpoints['Waited delay'] && !this.taskData.restockMode) {
//         this.log('info', this.taskData.id, `Waiting for delay: ${this.taskData.checkoutDelay}`);
//         this.sendStatus(taskStatus.waitingDelay, taskColors.yellow);
//         this.taskCheckpoints['Waited delay'] = true;
//         await this.pause(this.taskData.checkoutDelay);
//       }

//       if (!this.stopped) {
//         this.log('info', this.taskData.id, 'Submitting order');
//         this.sendStatus(taskStatus.submittingOrder, taskColors.yellow);
//         await this.click('[name="commit"]');
//         let captchaToken;
//         if (this.captchaToken === undefined) {
//           captchaToken = this.captchaToken;
//         } else {
//           captchaToken = `"${this.captchaToken}"`;
//         }
//         await this.page.evaluate(`(async () => {
//           document.getElementById('g-recaptcha-response').innerHTML = ${captchaToken};
//           captchaDone = true;
//           if (${captchaToken} === undefined) {
//             $(".g-recaptcha").remove();
//             $("#g-recaptcha-response").remove();
//             var iframes = document.querySelectorAll('iframe');
//             for (var i = 0; i < iframes.length; i++) {
//                 iframes[i].parentNode.removeChild(iframes[i]);
//             }
//           }
//           checkoutAfterCaptcha();
//         })()`);
//         await this.pause(500);
//         if ((await this.page.$('#no_store_credit')) !== null) {
//           if (this.taskData.useStoreCredit) {
//             await this.page.evaluate(`(async () => {
//             $('#store_credit_id').val($(this).attr('store_credit_id'));
//             })()`);
//           }
//           await this.page.evaluate(`(async () => {
//             $.rails.enableFormElements($('form#checkout_form'));
//             checkoutJsonCall();
//           })()`);
//         }
//         this.taskCheckpoints['Submitted order'] = true;
//       } else {
//         this.log('info', this.taskData.id, 'Submission aborted, task stopped');
//       }
//     } catch (error) {
//       this.sendStatus(`${taskStatus.submitPaymentError} ${error.statusCode ? error.statusCode : ''}`, taskColors.red);
//       this.log('fatal', this.taskData.id, `${taskStatus.submitPaymentError}: ${error.stack}`);
//       await this.pause(this.errorDelay);
//       await this.submitPayment();
//     }
//   }
//   async processPayment(): Promise<void> {
//     if (this.stopped) {
//       return;
//     }
//     try {
//       this.sendStatus(taskStatus.processing, taskColors.yellow);
//       this.log('info', this.taskData.id, 'Processing');
//       const response = await this.requests.paymentResult(this.product.slug);
//       if (!response.body.status) {
//         this.sendStatus(taskStatus.processingError, taskColors.red);
//         this.log('fatal', this.taskData.id, `Error in payment queue, ${response.body}`);
//       }
//       if (response.body.status === 'queued') {
//         this.sendStatus(taskStatus.processing, taskColors.yellow);
//         this.log('info', this.taskData.id, 'Processing');
//         await this.pause(this.taskData.monitorDelay);
//         await this.processPayment();
//       } else if (response.body.status === 'failed') {
//         this.sendStatus(taskStatus.declined, taskColors.red);
//         this.log('info', this.taskData.id, 'Declined');
//         this.sendWebhook({
//           site: this.taskData.siteName,
//           size: this.product.sizeName,
//           purchaseType: 'decline',
//           image: this.product.image,
//           productName: this.product.name,
//           color: this.taskData.productColor,
//           profile: this.profile.profilename,
//           mode: 'Headless',
//         });
//         this.saveCheckout({
//           date: this.getFormattedDate(),
//           type: 'decline',
//           productName: this.product.name,
//           productImage: this.product.image,
//           size: this.product.sizeName,
//           mode: 'Headless',
//           delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
//           captchaBypass: this.taskData.captchaBypass,
//           taskGroup: this.taskData.groupName,
//           site: this.taskData.siteName,
//           price: this.product.price,
//           profile: this.profile.profilename,
//           monitorInput: this.taskData.monitorInput,
//         });
//         this.browser.close();
//         this.stopped = true;
//       } else if (response.body.status === 'paid') {
//         this.sendStatus(taskStatus.success, taskColors.green);
//         this.log('info', this.taskData.id, 'Success');
//         this.sendWebhook({
//           site: this.taskData.siteName,
//           size: this.product.sizeName,
//           purchaseType: 'success',
//           image: this.product.image,
//           productName: this.product.name,
//           color: this.taskData.productColor,
//           profile: this.profile.profilename,
//           mode: 'Headless',
//         });
//         this.saveCheckout({
//           date: this.getFormattedDate(),
//           type: 'checkout',
//           productName: this.product.name,
//           productImage: this.product.image,
//           size: this.product.sizeName,
//           mode: 'Headless',
//           delays: [this.taskData.monitorDelay, this.taskData.checkoutDelay, this.taskData.retryDelay],
//           captchaBypass: this.taskData.captchaBypass,
//           taskGroup: this.taskData.groupName,
//           site: this.taskData.siteName,
//           price: this.product.price,
//           profile: this.profile.profilename,
//           monitorInput: this.taskData.monitorInput,
//         });
//         this.browser.close();
//         this.stopped = true;
//       } else if (response.body.status === 'cardinal_queued') {
//         this.sendStatus(taskStatus.processing, taskColors.yellow);
//         this.log('info', this.taskData.id, 'Processing');
//         await this.pause(this.taskData.monitorDelay);
//         await this.processPayment();
//       } else if (response.body.status === 'canada') {
//         this.sendStatus(`${taskStatus.declined}: Canada Error`, taskColors.red);
//         this.log('info', this.taskData.id, 'Declined: Canada Error');
//         this.browser.close();
//         this.stopped = true;
//       } else if (response.body.status === 'blocked_country') {
//         this.sendStatus('Invalid Country', taskColors.red);
//         this.log('info', this.taskData.id, 'Invalid Country');
//         this.browser.close();
//         this.stopped = true;
//       } else if (response.body.status === 'blacklisted') {
//         this.sendStatus('Address Blacklisted', taskColors.red);
//         this.log('info', this.taskData.id, 'Address Blacklisted');
//         this.browser.close();
//         this.stopped = true;
//       }
//     } catch (error) {
//       this.sendStatus(`${taskStatus.processingError} ${error.statusCode ? error.statusCode : ''}`, taskColors.red);
//       await this.handleError(error.message, error, this.processPayment);
//     }
//   }
//   async handleFailure(response): Promise<void> {
//     if (this.stopped) return;
//     try {
//       if (!response.status) {
//         this.log('fatal', this.taskData.id, `Could not find payment status: ${response.statusCode}`);
//         this.sendStatus('Process failure error', taskColors.red);
//         this.browser.close();
//         this.stopped = true;
//       }
//       const paymentStatus = response.status.toLowerCase();
//       if (paymentStatus === 'outofstock') {
//         this.log('info', this.taskData.id, 'Out of stock');
//         this.sendStatus(taskStatus.oos, taskColors.red);
//         this.browser.close();
//         this.stopped = true;
//       } else if (paymentStatus === 'dup') {
//         this.sendStatus(taskStatus.supremeDuplicate, taskColors.red);
//         this.log('info', this.taskData.id, 'Duplicate order');
//         this.browser.close();
//         this.stopped = true;
//       } else if (paymentStatus === 'failed') {
//         if (this.paymentRetrys <= 7) {
//           await this.pause(500);
//           this.paymentRetrys += 1;
//           await this.page.close();
//           await this.submitPayment(true);
//         } else {
//           this.sendStatus(taskStatus.failedToQueue, taskColors.red);
//           this.log('fatal', this.taskData.id, 'Failed to queue');
//           this.browser.close();
//           this.stopped = true;
//         }
//       }
//     } catch (error) {
//       this.sendStatus('Handle failure error', taskColors.red);
//       this.log('fatal', this.taskData.id, `Handle failure error: ${error.stack}`);
//       if (error.stack.includes('No resource with given identifier found')) {
//         this.stopped = true;
//         this.sendStatus('Duplicate Order', taskColors.red);
//       }
//       await this.pause(this.errorDelay);
//       await this.handleFailure(response);
//     }
//   }
//   async beginProcessPayment(response): Promise<void> {
//     try {
//       if (response.url() !== 'https://www.supremenewyork.com/checkout.json') return;
//       const outcome = await response.json();
//       if (!outcome) {
//         await this.handleFailure({status: 'failed'});
//         return;
//       }
//       if (outcome.status === 'queued') {
//         this.sendStatus(taskStatus.processing, taskColors.yellow);
//         this.log('info', this.taskData.id, `Processing... Slug: ${outcome.slug}`);
//         this.product.slug = outcome.slug;
//         await this.processPayment();
//       } else {
//         await this.handleFailure(outcome);
//       }
//     } catch (error) {
//       if (error.stack.includes('Protocol error (Network.getResponseBody)')) {
//         this.log('fatal', this.taskData.id, 'Process payment error: Duplicate Order');
//         await this.handleFailure({status: 'dup'});
//         return;
//       }
//       this.log('fatal', this.taskData.id, `Process payment error: ${error.stack}`);
//       await this.pause(this.errorDelay);
//       await this.beginProcessPayment(response);
//     }
//   }
//   async startTask(): Promise<void> {
//     await this.setupBrowser();
//     await this.prepareSession();
//     await this.page.setRequestInterception(true);
//     this.page.on('request', request => {
//       request.continue();
//     });
//     this.page.on('response', this.beginProcessPayment.bind(this));

//     await this.monitor.startMonitor(this.emitter);
//     while (!this.stopped || !this.taskCheckpoints['Checked out']) {
//       try {
//         if (this.stopped) break;
//         await this.addToCart();
//         await this.submitPayment();
//         if (this.taskCheckpoints['Submitted order']) break;
//       } catch (error) {
//         this.log('fatal', this.taskData.id, `Main task error: ${error.stack}`);
//         await this.handleError(error.message, error, this.startTask);
//       }
//     }
//     // this.browser.close();
//   }
//   async setupBrowser(): Promise<void> {
//     if (this.stopped || this.taskCheckpoints['Browser setup complete']) return;
//     this.browser = await puppeteer.launch({
//       executablePath: this.executablePath,
//       ignoreHTTPSErrors: true,
//       headless: true,
//       args: this.puppeteerParams,
//     });
//     this.page = await this.browser.newPage();
//     // if (this.useProxy && this.currentProxy.proxyUser) {
//     //   await this.page.authenticate({
//     //     username: this.currentProxy.proxyUser,
//     //     password: this.currentProxy.proxyPass,
//     //   });
//     // }
//     this.taskCheckpoints['Browser setup complete'] = true;
//   }
//   async click(selector): Promise<void> {
//     await this.page.waitForSelector(selector, {visible: true});
//     await this.page.click(selector);
//   }
//   async handleInput(selector, value, selectInput = false): Promise<boolean> {
//     try {
//       if (selector === '[name="size"]' || selector === '[name="s"]') {
//         await this.page.waitForSelector(selector);
//       } else {
//         await this.page.waitForSelector(selector, {visible: true});
//       }
//       await this.page.click(selector);
//       if (selectInput) {
//         await this.page.select(selector, value.toString());
//       } else {
//         await this.page.type(selector, value.toString());
//       }
//       return true;
//     } catch (error) {
//       this.log('fatal', this.taskData.id, `Unable to handle selector: ${selector}, error: ${error.stack}`);
//       this.sendStatus(taskStatus.handleInputError, taskColors.red);
//       return false;
//     }
//   }
//   async handlePayment(): Promise<void> {
//     try {
//       if (this.region === 'JP' || this.region === 'EU') {
//         await this.handleInput('[name="credit_card[type]"]', this.cardType, true);
//       }
//       if (this.region === 'CANADA') {
//         await this.handleInput('[name="order[billing_state]"]', this.profile.shipping.state, true);
//       }
//       if (this.region === 'JP' || this.region === 'EU') {
//         await this.handleInput('[name="credit_card[cnb]"]', this.profile.cardnumber);
//       } else {
//         await this.handleInput('[name="riearmxa"]', this.profile.cardnumber);
//       }
//       await this.handleInput('[name="credit_card[month]"]', this.profile.expdate.split('/')[0], true);
//       await this.handleInput('[name="credit_card[year]"]', `20${this.profile.expdate.split('/')[1]}`, true);
//       if (this.region === 'JP') {
//         await this.handleInput('[name="credit_card[vval]"]', this.profile.cvv);
//       } else {
//         await this.handleInput('[placeholder="CVV"]', this.profile.cvv);
//       }
//       await this.click('#order_terms');
//     } catch (error) {
//       this.log('fatal', this.taskData.id, `Unable to handle payment: ${error.stack}`);
//       this.sendStatus(taskStatus.handlePaymentError, taskColors.red);
//       await this.handleError(error.message, error, this.handlePayment);
//     }
//   }
//   saveProduct(product: ISupremeProduct): void {
//     if (product) {
//       this.product = product;
//     }
//   }
//   saveCaptchaToken(token: string): void {
//     if (token) {
//       this.captchaToken = token;
//     }
//   }
//   /**
//    * Utils
//    */
//   setRegionValues() {
//     this.region = this.taskData.siteName.split('Supreme ')[1];
//     switch (this.profile.shipping.countrycode) {
//       case 'US': {
//         this.countryCode = 'USA';
//         break;
//       }
//       case 'MX': {
//         this.countryCode = 'MEXICO';
//         break;
//       }
//       case 'CA': {
//         this.countryCode = 'CANADA';
//         break;
//       }
//       default: {
//         this.countryCode = this.profile.shipping.countrycode;
//         break;
//       }
//     }
//     switch (this.region) {
//       case 'US': {
//         this.addressPayload = `${this.profile.cardholdername}|${this.profile.shipping.address}|${this.profile.shipping.apt}|${this.profile.shipping.city}|${this.profile.shipping.state}|${this.profile.shipping.zip}|${this.countryCode}|${this.profile.email}|${this.profile.phone}`;
//         break;
//       }
//       case 'EU': {
//         this.addressPayload = `${this.profile.cardholdername}|${this.profile.shipping.address}|${this.profile.shipping.apt}||${this.profile.shipping.city}|${this.profile.shipping.state}|${this.profile.shipping.zip}|${this.countryCode}|${this.profile.email}|${this.profile.phone}`;
//         break;
//       }
//       case 'JP': {
//         this.addressPayload = `${this.profile.cardholdername}|${this.profile.shipping.address}|${this.profile.shipping.city}|${this.profile.shipping.state}|${this.profile.shipping.zip}|${this.profile.email}|${this.profile.phone}`;
//         break;
//       }
//       default: {
//         this.addressPayload = `${this.profile.cardholdername}|${this.profile.shipping.address}|${this.profile.shipping.apt}|${this.profile.shipping.city}|${this.profile.shipping.state}|${this.profile.shipping.zip}|${this.countryCode}|${this.profile.email}|${this.profile.phone}`;
//         break;
//       }
//     }
//     this.sizeSelectorName = this.region === 'EU' || this.region === 'JP' ? '[name="size"]' : '[name="s"]';
//   }
//   // eslint-disable-next-line class-methods-use-this
//   saveCountryCode(): void {
//     const {profile} = this;
//     let paymentProfile: any = {};
//     if (profile.usebilling) {
//       paymentProfile = profile.billing;
//     } else {
//       paymentProfile = profile.shipping;
//     }
//     // eslint-disable-next-line no-nested-ternary
//     const countrycode =
//       paymentProfile.countrycode === 'US'
//         ? 'USA'
//         : paymentProfile.countrycode === 'CA'
//         ? 'CANADA'
//         : paymentProfile.countrycode;
//     this.countrycode = countrycode;
//   }
//   // eslint-disable-next-line class-methods-use-this
//   saveCardType(): void {
//     const supremeCardTypes = {
//       Visa: 'visa',
//       Amex: 'american_express',
//       Mastercard: 'master',
//       Discover: 'discover',
//     };
//     if (supremeCardTypes[this.profile.cardtype]) {
//       this.cardType = supremeCardTypes[this.profile.cardtype];
//       console.log(`Card type: ${this.cardType}`);
//     }
//   }
//   async waitForCaptcha(captchaData: ICaptchaRequest): Promise<unknown> {
//     this.sendStatus(taskStatus.waitingCaptcha, taskColors.blue);
//     this.getCaptchaToken(captchaData);
//     return new Promise(resolve => {
//       setInterval(() => {
//         if (this.captchaToken !== '') {
//           resolve();
//         }
//       }, 200);
//     });
//   }
//   rotateProxy(): void {
//     this.requests.saveProxy();
//   }
//   async handleError(message, error, method): Promise<void> {
//     if (this.stopped) return;
//     if (
//       message.indexOf('tunneling socket could not be established') !== -1 ||
//       message.indexOf('EPROTO') !== -1 ||
//       message.indexOf('socket hang up') !== -1
//     ) {
//       this.log('fatal', this.taskData.id, `Proxy error: ${message}`);
//       this.sendStatus(taskStatus.proxyError, taskColors.red);
//       // Switch proxy
//       this.rotateProxy();
//       await this.pause(this.errorDelay);
//       // Call the method that threw the error
//       await method.bind(this)();
//       return;
//     }
//     if (error.statusCode === 429) {
//       this.sendStatus(`${taskStatus.proxyBanned} ${error.statusCode}`, taskColors.red);
//       // Switch proxy
//       this.rotateProxy();
//       await this.pause(this.errorDelay);
//       // Call the method that threw the error
//       await method.bind(this)();
//       return;
//     }
//     if (error.message.indexOf('ESOCKETTIMEDOUT') !== -1) {
//       this.log('fatal', this.taskData.id, `Timeout ${message}`);
//       this.sendStatus(taskStatus.timeout, taskColors.red);
//       // Switch proxy
//       this.rotateProxy();
//       await this.pause(this.errorDelay);
//       // Call the method that threw the error
//       await method.bind(this)();
//       return;
//     }
//     this.sendStatus(taskStatus.taskError, taskColors.red);
//     this.log('fatal', this.taskData.id, `Error: ${method.name}: ${error.stack}`);
//     console.log(method);
//     // Switch proxy
//     this.rotateProxy();
//     await this.pause(this.errorDelay);
//     // Call the method that threw the error
//     await method.bind(this)();
//   }
// }

// export default SupremeHeadlessBot;
