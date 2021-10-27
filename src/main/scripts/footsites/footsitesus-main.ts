/* eslint-disable no-await-in-loop */
import { uuid } from 'uuidv4';
import MainBot from '../main-classes/main-bot';
import { ITaskData, IProfile } from '../../interfaces/index';
import rp from '../tls-client/wrapper';
import taskStatus from '../../helpers/task-status';
import taskColors from '../../helpers/task-colors';
import adyenGenerator, * as adyen from '../../helpers/adyenGenerator';

class FootsitesUS extends MainBot {
  profile: IProfile;
  csrf: string;
  picked: boolean;
  product: object;
  jar: object;
  foundProduct: {
    size?: string;
    variant?: string | string[] | number;
    special?: { dsmHash?: string; cartForm?: any };
    price?: string;
    image?: string;
    name?: string;
  };
  site: string;
  cartid: string;
  currentProxy: string | null;
  proxyGroup: any;
  solvedDatadome: any;
  constructor(taskData: ITaskData, profile: IProfile, proxies: any) {
    super(taskData, proxies);
    this.cartid = '';
    this.jar = {};
    this.site = taskData.site.toLowerCase();
    this.picked = false;
    this.foundProduct = { name: '', variant: '', price: '', image: '' };
    if (typeof taskData.monitorInput === 'string') {
      this.foundProduct.name = taskData.monitorInput;
    } else {
      this.foundProduct.name = taskData.monitorInput.join(', ');
    }
    this.csrf = '';
    this.taskData = taskData;
    this.currentProxy = null;
    this.profile = profile;
    this.proxyGroup = proxies;
    this.solvedDatadome = null;
    this.setProxy();
  }

  async startTask() {
    this.pollQueue();
  }
  async pollQueue(): Promise<void> {
    if (this.stopped) return;
    this.sendStatus('Getting Queue Status', taskColors.yellow, this.foundProduct.name);
    this.log('info', this.taskData.id, 'Getting queue status');
    const options = {
      method: 'GET',
      uri: `https://${this.site}/product/~/${this.taskData.monitorInput}.html`,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        Connection: 'keep-alive',
        Host: `${this.site}`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    const { statusCode, body } = await rp(options);
    if (statusCode === 503) {
      this.log('info', this.taskData.id, 'Waiting in queue');
      this.sendStatus(taskStatus.queue, taskColors.orange);
      await this.pause(this.taskData.retryDelay);
      await this.pollQueue();
    } else if (statusCode !== 200) {
      await this.handleError(this.pollQueue, null, statusCode, body, false, null);
    }
    this.log('info', this.taskData.id, 'Passed queue');
    await this.generateSession();
  }
  async generateSession(): Promise<void> {
    if (this.stopped) return;
    this.sendStatus('Generating Session', taskColors.yellow, this.foundProduct.name);
    this.log('info', this.taskData.id, 'Generating Session');
    const options = {
      method: 'GET',
      uri: `https://${this.site}/api/v3/session?timestamp=${Date.now()}`,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        Connection: 'keep-alive',
        Host: `${this.site}`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    const { statusCode, body } = await rp(options);

    if (statusCode !== 200) {
      await this.handleError(this.generateSession, null, statusCode, body);
      return;
    }
    const responseObj = JSON.parse(body);
    if (responseObj.success) {
      this.csrf = responseObj.data.csrfToken;
      await this.getStock();
    } else {
      await this.handleError(this.generateSession, `Unexpected response generating session: ${JSON.stringify(responseObj)}`, null, null);
    }
  }
  async getStock(): Promise<void> {
    if (this.stopped) return;
    this.sendStatus('Getting stock', taskColors.yellow, this.foundProduct.name);
    this.log('info', this.taskData.id, 'Getting stock');
    const options = {
      method: 'GET',
      uri: `https://${this.site}/api/products/pdp/${this.taskData.monitorInput}?timestamp=${Date.now()}`,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        Connection: 'keep-alive',
        Host: `${this.site}`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    const { statusCode, body } = await rp(options);

    if (statusCode !== 200) {
      await this.handleError(this.getStock, null, statusCode, body);
      return;
    }
    const obj = JSON.parse(body);
    this.foundProduct.name = obj.name;
    this.foundProduct.image = obj.images[0].variations[2].url;
    for (const i in obj.sellableUnits) {
      if (this.taskData.sizes.includes(obj.sellableUnits[i].attributes[0].value) || (this.taskData.sizes.includes('random') && obj.sellableUnits[i].stockLevelStatus == 'inStock')) {
        this.foundProduct.size = obj.sellableUnits[i].attributes[0].value;
        if (obj.sellableUnits[i].stockLevelStatus != 'inStock') {
          setTimeout(() => {
            this.getStock();
          }, 5000);
        } else {
          this.foundProduct.price = obj.sellableUnits[i].price.formattedOriginalPrice;
          this.foundProduct.variant = obj.sellableUnits[i].code;
          if (!this.picked) {
            this.sendStatus(taskStatus.selectedSize, taskColors.yellow, this.foundProduct.name);
            this.picked = true;
            await this.addToCart();
          }
        }
      }
    }
  }
  async addToCart(): Promise<void> {
    if (this.stopped) return;
    if (this.taskData.mode === 'api') {
      await this.genAkamai();
      await this.GenDatadome();
    }
    this.log('info', this.taskData.id, 'Adding to cart');
    this.sendStatus(taskStatus.carting, taskColors.yellow, this.foundProduct.name);
    const options = {
      method: 'POST',
      body: `{"productQuantity":1,"productId":"${this.foundProduct.variant}"}`,
      uri: `https://${this.site}/api/users/carts/current/entries?timestamp=${Date.now()}`,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-type': 'application/json',
        Host: `${this.site}`,
        Origin: `https://${this.site}`,
        Pragma: 'no-cache',
        Referer: `https://${this.site}/product/-/${this.taskData.monitorInput}.html`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
        'x-csrf-token': this.csrf,
        'x-fl-productid': this.foundProduct.variant,
        'x-fl-request-id': uuid(),
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    const { statusCode, body } = await rp(options);

    if (statusCode !== 200) {
      await this.handleError(this.addToCart, null, statusCode, body, false, 20000);
      return;
    }
    this.log('info', this.taskData.id, 'Added to cart');
    const cartData = JSON.parse(body);
    this.cartid = cartData.guid;
    await this.submitEmail();
  }
  async submitEmail(): Promise<void> {
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Submitting email');
    this.sendStatus('Submitting email', taskColors.yellow, this.foundProduct.name);
    const options = {
      method: 'PUT',
      uri: `https://${this.site}/api/users/carts/current/email/${this.profile.email}?timestamp=${Date.now()}`,
      headers: {
        accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'content-type': 'application/json',
        Host: `${this.site}`,
        Origin: `https://${this.site}`,
        Pragma: 'no-cache',
        Referer: `https://${this.site}/product/-/${this.taskData.monitorInput}.html`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
        'x-csrf-token': this.csrf,
        'x-fl-request-id': uuid(),
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    const { statusCode, body } = await rp(options);
    if (statusCode !== 200) {
      await this.handleError(this.submitEmail, null, statusCode, body, true, null);
      return;
    }
    await this.submitShipping();
  }
  async submitShipping(): Promise<void> {
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Submitting Shipping');
    this.sendStatus(taskStatus.submittingShipping, taskColors.yellow, this.foundProduct.name);
    const options = {
      method: 'POST',
      uri: `https://${this.site}/api/users/carts/current/addresses/shipping?timestamp=${Date.now()}`,
      body: `{"shippingAddress":{"setAsDefaultBilling":false,"setAsDefaultShipping":false,"firstName":"${this.profile.firstname}","lastName":"${this.profile.lastname}","email":"${this.profile.email}","phone":"${this.profile.phone}","billingAddress":false,"country":{"isocode":"${this.profile.shipping.countrycode}","name":"${this.profile.shipping.country}"},"defaultAddress":false,"id":null,"region":{"countryIso":"${this.profile.shipping.countrycode}","isocode":"${this.profile.shipping.countrycode}-${this.profile.shipping.state}","isocodeShort":"${this.profile.shipping.state}","name":"${this.profile.shipping.stateName}"},"setAsBilling":true,"shippingAddress":true,"visibleInAddressBook":false,"type":"default","LoqateSearch":"","postalCode":"${this.profile.shipping.zip}","town":"${this.profile.shipping.city}","regionFPO":null,"line1":"${this.profile.shipping.address}","recordType":" "}}`,
      headers: {
        accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'content-type': 'application/json',
        Host: `${this.site}`,
        Origin: `https://${this.site}`,
        Pragma: 'no-cache',
        Referer: `https://${this.site}/product/-/${this.taskData.monitorInput}.html`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
        'x-csrf-token': this.csrf,
        'x-fl-request-id': uuid(),
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    const { statusCode, body } = await rp(options);
    if (statusCode === 400) {
      this.log('fatal', this.taskData.id, `Failed to submit shipping: ${body}`);
      await this.pause(this.taskData.retryDelay);
      await this.submitShipping();
    } else if (statusCode !== 201) {
      await this.handleError(this.submitShipping, null, statusCode, body, true, null);
    }
    await this.submitBilling();
  }
  async submitBilling(): Promise<void> {
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Submitting billing');
    this.sendStatus(taskStatus.submittingBilling, taskColors.yellow, this.foundProduct.name);
    // Handle status 400 to submit billing again
    const options = {
      method: 'POST',
      uri: `https://${this.site}/api/users/carts/current/set-billing?timestamp=${Date.now()}`,
      body: `{"setAsDefaultBilling":false,"setAsDefaultShipping":false,"firstName":"${this.profile.firstname}","lastName":"${this.profile.lastname}","email":"${this.profile.email}","phone":"${this.profile.phone}","billingAddress":false,"country":{"isocode":"${this.profile.shipping.countrycode}","name":"${this.profile.shipping.country}"},"defaultAddress":false,"id":null,"region":{"countryIso":"${this.profile.shipping.countrycode}","isocode":"${this.profile.shipping.countrycode}-${this.profile.shipping.state}","isocodeShort":"${this.profile.shipping.state}","name":"${this.profile.shipping.stateName}"},"setAsBilling":false,"shippingAddress":true,"visibleInAddressBook":false,"type":"default","LoqateSearch":"","postalCode":"${this.profile.shipping.zip}","town":"${this.profile.shipping.city}","regionFPO":null,"line1":"${this.profile.shipping.address}","recordType":" "}`,
      headers: {
        accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'content-type': 'application/json',
        Host: `${this.site}`,
        Origin: `https://${this.site}`,
        Pragma: 'no-cache',
        Referer: `https://${this.site}/product/-/${this.taskData.monitorInput}.html`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
        'x-csrf-token': this.csrf,
        'x-fl-productid': this.foundProduct.variant,
        'x-fl-request-id': uuid(),
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    const { statusCode, body } = await rp(options);

    if (statusCode === 400) {
      this.log('fatal', this.taskData.id, `Failed to submit billing: ${body}`);
      await this.pause(this.taskData.retryDelay);
      await this.submitBilling();
      return;
    }
    if (statusCode !== 200) {
      await this.handleError(this.submitBilling, null, statusCode, body, false, null);
    }
    await this.placeOrder();
  }
  async placeOrder(): Promise<void> {
    if (this.stopped) return;
    if (this.taskData.mode === 'api') {
      await this.genAkamai();
    }
    this.log('info', this.taskData.id, 'Placing order');
    this.sendStatus('Placing order', taskColors.orange, this.foundProduct.name);
    const key =
      '10001|A237060180D24CDEF3E4E27D828BDB6A13E12C6959820770D7F2C1671DD0AEF4729670C20C6C5967C664D18955058B69549FBE8BF3609EF64832D7C033008A818700A9B0458641C5824F5FCBB9FF83D5A83EBDF079E73B81ACA9CA52FDBCAD7CD9D6A337A4511759FA21E34CD166B9BABD512DB7B2293C0FE48B97CAB3DE8F6F1A8E49C08D23A98E986B8A995A8F382220F06338622631435736FA064AEAC5BD223BAF42AF2B66F1FEA34EF3C297F09C10B364B994EA287A5602ACF153D0B4B09A604B987397684D19DBC5E6FE7E4FFE72390D28D6E21CA3391FA3CAADAD80A729FEF4823F6BE9711D4D51BF4DFCB6A3607686B34ACCE18329D415350FD0654D';
    const CardData = adyenGenerator.default(key, {
      number: this.profile.cardnumber,
      month: this.profile.expdate.split('/')[0],
      year: `20${this.profile.expdate.split('/')[1]}`,
      ccv: this.profile.cvv,
    });

    const payload = {
      preferredLanguage: 'en',
      termsAndCondition: false,
      deviceId: '',
      cartId: this.cartid,
      encryptedCardNumber: CardData.encryptedCardNumber,
      encryptedExpiryMonth: CardData.encryptedExpiryMonth,
      encryptedExpiryYear: CardData.encryptedExpiryYear,
      encryptedSecurityCode: CardData.encryptedSecurityCode,
      paymentMethod: 'CREDITCARD',
      returnUrl: `https://${this.site}/adyen/checkout`,
      browserInfo: {
        screenWidth: 1920,
        screenHeight: 1080,
        colorDepth: 24,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
        timeZoneOffset: -120,
        language: 'fr-FR',
        javaEnabled: false,
      },
    };
    const options = {
      method: 'POST',
      uri: `https://${this.site}/api/users/orders?timestamp=${Date.now()}`,
      body: JSON.stringify(payload),
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'content-type': 'application/json',
        origin: `https://${this.site}`,
        referer: `https://${this.site}/checkout`,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
        'x-csrf-token': this.csrf,
        'x-fl-request-id': uuid(),
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    const { statusCode, body } = await rp(options);
    switch (statusCode) {
      case 200:
        this.log('success', this.taskData.id, 'Successful checkout !');
        this.sendStatus(taskStatus.success, taskColors.green);
        this.sendWebhook({
          purchaseType: 'success',
          price: this.foundProduct.price,
          productName: this.foundProduct.name,
          image: this.foundProduct.image,
          site: this.taskData.siteName,
          size: this.foundProduct.size,
          profile: this.profile.profilename,
          mode: this.taskData.mode === 'api' ? 'Api Safe' : 'Fast',
        });
        break;
      case 400:
        this.sendWebhook({
          purchaseType: 'decline',
          price: this.foundProduct.price,
          productName: this.foundProduct.name,
          image: this.foundProduct.image,
          site: this.taskData.siteName,
          size: this.foundProduct.size,
          profile: this.profile.profilename,
          mode: this.taskData.mode === 'api' ? 'Api Safe' : 'Fast',
        });
        this.log('fatal', this.taskData.id, 'Card declines');
        this.sendStatus('Card declined', taskColors.red);
        break;
      default:
        await this.handleError(this.placeOrder, null, statusCode, body, false, null);
        break;
    }
  }
  async genAkamai(): Promise<void> {
    if (this.site === 'www.footlocker.com') {
      this.log('info', this.taskData.id, 'Generating Akamai');
      this.sendStatus('Generating Akamai', taskColors.yellow, this.foundProduct.name);
      try {
        let resp = await rp({
          method: 'POST',
          uri: 'https://us-qweqwe.herokuapp.com/api/v1/akamai',
          headers: { 'content-type': 'application/json' },
          body: '{"x-auth":"heqwewqeqweliwqeox_dev"}',
        });
        resp = JSON.parse(resp.body);
        this.jar._abck = resp.cookie;
      } catch (ex) {}
    }
  }
  async GenDatadome(): Promise<void> {
    this.log('info', this.taskData.id, 'Generating Datadome');
    this.sendStatus('Generating Datadome', taskColors.yellow, this.foundProduct.name);
    try {
      let resp = await rp({
        method: 'POST',
        form: undefined,
        uri: 'https://us-qwewqe.herokuapp.com/api/v1/datadome',
        headers: { 'content-type': 'application/json' },
        body: '{"x-auth":"qwewqe","ddjskey":"A55FBF4311ED6F1BF9911EB71931D5"}',
        jar: undefined,
        proxy: undefined,
      });
      resp = JSON.parse(resp.body);
      if (!resp.success) {
        return;
      }
      resp = await rp({
        uri: 'https://api-js.datadome.co/js/',
        headers: {
          Accept: '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
          Connection: 'keep-alive',
          'Content-type': 'application/x-www-form-urlencoded',
          Host: 'api-js.datadome.co',
          Origin: `https://${this.site}`,
          Referer: `https://${this.site}/`,
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
        },
        proxy: this.currentProxy,
      });
      this.jar.datadome = resp.cookie.split('datadome=')[1].split(';')[0];
    } catch (_) {}
  }
  async handleDatadome(body: string, callback: Function): Promise<void> {
    if (this.stopped) return;
    this.log('fatal', this.taskData.id, 'Solving Datadome');
    this.sendStatus('Solving Datadome', taskColors.yellow, this.foundProduct.name);
    this.getSolvedDatadome({
      apiKey: '2d067982bd0fbec5e8b0b048d18e27e8',
      DatadomeCookie: this.jar.datadome,
      body,
      proxi: this.currentProxy,
      Domain: this.site,
      Debug: true,
      taskID: this.taskData.id,
    });
    await this.waitForDatadome();
    if (this.solvedDatadome.banned) {
      this.sendStatus('Banned', taskColors.red);
      this.log('fatal', this.taskData.id, 'Banned');
      this.setProxy();
      this.stopped = true;
      await this.pause(this.taskData.retryDelay);
      this.solvedDatadome = null;
      await callback.bind(this)();
    }
    this.jar.datadome = this.solvedDatadome;
    await this.pause(this.taskData.retryDelay);
    await callback.bind(this)();
    this.solvedDatadome = null;
  }
  waitForDatadome(): Promise<void> {
    return new Promise((resolve) => {
      setInterval(() => {
        if (this.solvedDatadome) {
          resolve();
        }
      }, 333);
    });
  }
  setSolvedDatadome(datadome: string, banned: boolean): void {
    this.solvedDatadome = { banned, datadome };
  }
  setProxy(): void {
    if (this.proxies === null) {
      this.currentProxy = null;
      return;
    }
    const randomProxy = this.proxyGroup.proxies[Math.floor(Math.random() * this.proxyGroup.proxies.length)].split(':');
    if (!randomProxy[2] && !randomProxy[3]) {
      this.currentProxy = `http://${randomProxy[0]}:${randomProxy[1]}`;
      return;
    }
    this.currentProxy = `http://${randomProxy[2]}:${randomProxy[3]}@${randomProxy[0]}:${randomProxy[1]}`;
  }
  async handleError(callback: Function, error?: any | null, statusCode?: number | null, datadomeBody?: string | null, returnToQueue?: boolean | null, specialDelay?: number | null): Promise<void> {
    try {
      // If we are handling an expected status code
      if (statusCode) {
        switch (statusCode) {
          case 403:
            if (datadomeBody) {
              this.log('warning', this.taskData.id, 'Starting datadome solver');
              await this.handleDatadome(datadomeBody, callback);
              break;
            }
            this.log('fatal', this.taskData.id, 'Blocked, retrying');
            break;
          case 502:
            this.log('fatal', this.taskData.id, 'Proxy Error');
            this.sendStatus(taskStatus.proxyError, taskColors.red, this.foundProduct.name);
            this.setProxy();
            break;
          case 429:
            this.log('fatal', this.taskData.id, 'Rate limited');
            this.sendStatus('Rate limited', taskColors.red);
            this.setProxy();
            break;
          case 503:
            this.log('info', this.taskData.id, 'Waiting in queue');
            this.sendStatus('Waiting in queue', taskColors.blue);
            if (returnToQueue) {
              await this.pause(specialDelay || this.taskData.retryDelay);
              await this.pollQueue();
              break;
            }
            await this.pause(specialDelay || this.taskData.retryDelay);
            await callback.bind(this)();
            break;
          case 531:
            this.log('fatal', this.taskData.id, 'OOS');
            this.sendStatus(taskStatus.cartingFailedOOS, taskColors.red);
            break;
          case 400:
            this.log('info', this.taskData.id, 'Product pulled');
            this.sendStatus('Product pulled', taskColors.red);
            await this.pause(specialDelay || this.taskData.retryDelay);
            await this.pollQueue();
            break;
          default:
            this.sendStatus(`Unexpected status code: ${statusCode},`, taskColors.red);
            this.log('fatal', this.taskData.id, `[${callback.name}] - Unexpected status code: ${statusCode}`);
            this.setProxy();
            break;
        }
        await this.pause(specialDelay || this.taskData.retryDelay);
        await callback.bind(this)();
        return;
      }
      this.log('fatal', this.taskData.id, `[${callback.name}] - Task error, retrying: ${error}`);
      await this.pause(specialDelay || this.taskData.retryDelay);
      await callback.bind(this)();
    } catch (err) {
      this.log('fatal', this.taskData.id, `[${callback.name}] - Unexpected error: ${err}`);
      await this.pause(specialDelay || this.taskData.retryDelay);
      await this.handleError(error, callback, statusCode);
    }
  }
}
export default FootsitesUS;
