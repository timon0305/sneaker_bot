import MainBot from '../main-classes/main-bot';
import { ITaskData, IProfile } from '../../interfaces/index';
import rp from '../tls-client/wrapper';
import taskStatus from '../../helpers/task-status';
import taskColors from '../../helpers/task-colors';
import adyenGenerator, * as adyen from '../../helpers/adyenGenerator';
import * as DdSolver from '../../helpers/Datadome_Solveflow';
import threeDSHandler from '../../helpers/3DSHandler';

class FootlockerEU extends MainBot {
  profile: IProfile;
  csrf: string;
  picked: boolean;
  product: object;
  jar: object;
  threeDSform: object;
  foundProduct: {
    size?: string;
    variant?: string | string[] | number;
    special?: { dsmHash?: string; cartForm?: any };
    price?: string;
    image?: string;
    name?: string;
  };
  region: string;
  proxy: string;
  cartid: string;
  currentProxy: string | null;
  proxyGroup: any;
  constructor(taskData: ITaskData, profile: IProfile, proxies: any) {
    super(taskData, proxies);
    this.cartid = '';
    this.jar = {};
    this.region = taskData.site.toLowerCase();
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
    this.setProxy();
  }
  // eslint-disable-next-line class-methods-use-this
  async startTask() {
    // console.log(this.profile);
    console.log(this.taskData);
    this.pollQueue();
  }
  async pollQueue() {
    if (this.stopped) return;
    this.sendStatus('Getting queue status', taskColors.yellow, this.foundProduct.name);
    this.log('info', this.taskData.id, 'Getting queue status');
    const options = {
      method: 'GET',
      uri: `https://www.footlocker.${this.region}/product/~/${this.taskData.monitorInput}.html`,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        Connection: 'keep-alive',
        Host: 'www.footlocker.${this.region}',
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
    await rp(options).then(async (resp) => {
      switch (resp.statusCode) {
        case 200:
          this.log('info', this.taskData.id, 'Passed queue');
          await this.generateSession();
          break;
        case 403:
          this.handleDatadome(resp.body, this.pollQueue);
          break;
        case 502:
          this.log('fatal', this.taskData.id, 'Proxy Error');
          this.sendStatus(taskStatus.proxyError, taskColors.red, this.taskData.monitorInput);
          break;
        case 503:
          this.log('info', this.taskData.id, 'Waiting in queue');
          this.sendStatus(taskStatus.queue, taskColors.orange, this.taskData.monitorInput);
          setTimeout(() => {
            this.pollQueue();
          }, 30000);
          break;
        default:
          console.log(resp.statusCode);
      }
    });
  }

  async generateSession() {
    if (this.stopped) return;
    this.sendStatus('Generating Session', taskColors.yellow, this.foundProduct.name);
    this.log('info', this.taskData.id, 'Generating Session');
    const options = {
      method: 'GET',
      uri: `https://www.footlocker.${this.region}/api/v3/session?timestamp=${Date.now()}`,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        Connection: 'keep-alive',
        Host: `www.footlocker.${this.region}`,
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
    await rp(options).then(async (resp) => {
      switch (resp.statusCode) {
        case 200:
          var obj = JSON.parse(resp.body);
          if (obj.success) {
            this.csrf = obj.data.csrfToken;
            await this.getStock();
          } else {
            setTimeout(this.generateSession, this.taskData.retryDelay);
          }
          break;
        case 403:
          this.handleDatadome(resp.body, this.generateSession);
          break;
        case 502:
          this.log('fatal', this.taskData.id, 'Proxy Error');
          this.sendStatus(taskStatus.proxyError, taskColors.red, this.foundProduct.name);
          break;
        case 429:
          this.log('fatal', this.taskData.id, 'Rate limited');
          this.sendStatus('Rate limited', taskColors.red, this.foundProduct.name);
          setTimeout(() => {
            this.generateSession();
          }, this.taskData.retryDelay);
          break;
        case 503:
          this.log('info', this.taskData.id, 'Waiting in queue');
          this.sendStatus(taskStatus.queue, taskColors.orange, this.foundProduct.name);
          setTimeout(() => {
            this.pollQueue();
          }, this.taskData.monitorDelay);
          break;
      }
    });
  }

  async getStock() {
    if (this.stopped) return;
    this.sendStatus('Getting stock', taskColors.yellow, this.foundProduct.name);
    this.log('info', this.taskData.id, 'Getting stock');
    const options = {
      method: 'GET',
      uri: `https://www.footlocker.${this.region}/api/products/pdp/${this.taskData.monitorInput}?timestamp=${Date.now()}`,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        Connection: 'keep-alive',
        Host: `www.footlocker.${this.region}`,
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
    await rp(options).then(async (resp) => {
      switch (resp.statusCode) {
        case 200:
          var obj = JSON.parse(resp.body);
          this.foundProduct.name = obj.name;
          this.foundProduct.image = `https://images.footlocker.com/is/image/FLEU/${this.taskData.monitorInput}_01?wid=400&hei=400`;
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
          break;
        case 403:
          this.handleDatadome(resp.body, this.getStock);
          break;
        case 502:
          this.log('fatal', this.taskData.id, 'Proxy Error');
          this.sendStatus(taskStatus.proxyError, taskColors.red, this.foundProduct.name);
          break;
        case 503:
          this.log('info', this.taskData.id, 'Waiting in queue');
          this.sendStatus(taskStatus.queue, taskColors.orange, this.foundProduct.name);
          setTimeout(this.pollQueue, this.taskData.monitorDelay);
          break;
        case 429:
          this.log('info', this.taskData.id, 'Rate Limited');
          this.sendStatus('Rate limited', taskColors.red, this.foundProduct.name);
          break;
        case 400:
          this.sendStatus(taskStatus.variantError, taskColors.red, this.foundProduct.name);
          this.log('fatal', this.taskData.id, 'Product pulled');
          setTimeout(this.pollQueue, 30000);
          break;
        default:
          console.log(resp.statusCode);
      }
    });
  }
  async addToCart() {
    if (this.stopped) return;
    if (this.taskData.mode === 'api') await this.GenDatadome();
    this.sendStatus(taskStatus.carting, taskColors.yellow, this.foundProduct.name);
    const options = {
      method: 'POST',
      body: `{"productQuantity":1,"productId":"${this.foundProduct.variant}"}`,
      uri: `https://www.footlocker.${this.region}/api/users/carts/current/entries?timestamp=${Date.now()}`,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-type': 'application/json',
        Host: `www.footlocker.${this.region}`,
        Origin: `https://www.footlocker.${this.region}`,
        Pragma: 'no-cache',
        Referer: `https://www.footlocker.${this.region}/product/-/${this.taskData.monitorInput}.html`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
        'x-csrf-token': this.csrf,
        'x-fl-productid': this.foundProduct.variant,
        'x-fl-request-id': '', // uuid()
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    await rp(options).then(async (resp) => {
      switch (resp.statusCode) {
        case 200:
          this.log('info', this.taskData.id, 'Added to cart');
          var obj = JSON.parse(resp.body);
          this.cartid = obj.guid;
          await this.submitEmail();
          break;
        case 403:
          this.handleDatadome(resp.body, this.addToCart);
          break;
        case 502:
          this.log('fatal', this.taskData.id, 'Proxy Error');
          this.sendStatus(taskStatus.proxyError, taskColors.red, this.foundProduct.name);
          break;
        case 503:
          this.log('info', this.taskData.id, 'Waiting in queue');
          this.sendStatus(taskStatus.queue, taskColors.orange, this.foundProduct.name);
          setTimeout(this.pollQueue, this.taskData.monitorDelay);
          break;
        case 531:
          this.log('fatal', this.taskData.id, 'OOS');
          this.sendStatus(taskStatus.cartingFailedOOS, taskColors.red, this.foundProduct.name);
          break;
        case 429:
          this.log('fatal', this.taskData.id, 'Rate limited');
          this.sendStatus('Rate limited', taskColors.red, this.foundProduct.name);
          setTimeout(this.addToCart, this.taskData.retryDelay);
          break;
        default:
          console.log(resp.body);
          this.log('fatal', this.taskData.id, `UNEXCEPTED : ${resp.statusCode}`);
          this.sendStatus(`UNEXCEPTED : ${resp.statusCode}`, taskColors.red, this.foundProduct.name);
          break;
      }
    });
  }
  async submitEmail() {
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Submitting email');
    this.sendStatus('Submitting email', taskColors.yellow, this.foundProduct.name);
    const options = {
      method: 'PUT',
      uri: `https://www.footlocker.${this.region}/api/users/carts/current/email/aoxresell@gmail.${this.region}?timestamp=${Date.now()}`,
      headers: {
        accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'content-type': 'application/json',
        Host: 'www.footlocker.${this.region}',
        Origin: `https://www.footlocker.${this.region}`,
        Pragma: 'no-cache',
        Referer: `https://www.footlocker.${this.region}/product/-/${this.taskData.monitorInput}.html`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
        'x-csrf-token': this.csrf,
        'x-fl-request-id': '', // uuid(),
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    await rp(options).then(async (resp) => {
      switch (resp.statusCode) {
        case 200:
          await this.submitShipping();
          break;
        case 403:
          this.handleDatadome(resp.body, this.submitEmail);
          break;
        case 502:
          this.log('fatal', this.taskData.id, 'Proxy Error');
          this.sendStatus(taskStatus.proxyError, taskColors.red, this.foundProduct.name);
          break;
        case 503:
          this.log('info', this.taskData.id, 'Waiting in queue');
          this.sendStatus(taskStatus.queue, taskColors.orange, this.foundProduct.name);
          setTimeout(this.pollQueue, this.taskData.monitorDelay);
          break;
        case 429:
          this.log('fatal', this.taskData.id, 'Rate limited');
          this.sendStatus('Rate limited', taskColors.red, this.foundProduct.name);
          setTimeout(this.submitEmail, this.taskData.retryDelay);
          break;
        default:
          console.log(resp.statusCode);
          break;
      }
    });
  }
  async submitShipping() {
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Submitting Shipping');
    this.sendStatus(taskStatus.submittingShipping, taskColors.yellow, this.foundProduct.name);
    const options = {
      method: 'POST',
      uri: `https://www.footlocker.${this.region}/api/users/carts/current/addresses/shipping?timestamp=${Date.now()}`,
      body: `{"shippingAddress":{"setAsDefaultBilling":false,"setAsDefaultShipping":false,"firstName":"${this.profile.firstname}","lastName":"${this.profile.lastname}","email":"${this.profile.email}","phone":"${this.profile.phone}","country":{"isocode":"${this.profile.shipping.countrycode}","name":"${this.profile.shipping.country}"},"billingAddress":false,"defaultAddress":false,"id":null,"line1":"${this.profile.shipping.address}","postalCode":"${this.profile.shipping.zip}","setAsBilling":true,"shippingAddress":true,"town":"${this.profile.shipping.city}","visibleInAddressBook":false,"type":"default"}}`,
      headers: {
        accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'content-type': 'application/json',
        Host: `www.footlocker.${this.region}`,
        Origin: `https://www.footlocker.${this.region}`,
        Pragma: 'no-cache',
        Referer: `https://www.footlocker.${this.region}/product/-/${this.taskData.monitorInput}.html`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
        'x-csrf-token': this.csrf,
        'x-fl-request-id': '', // uuid(),
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    await rp(options).then(async (resp) => {
      switch (resp.statusCode) {
        case 201:
          await this.submitBilling();
          break;
        case 403:
          this.handleDatadome(resp.body, this.submitShipping);
          break;
        case 502:
          this.log('fatal', this.taskData.id, 'Proxy Error');
          this.sendStatus(taskStatus.proxyError, taskColors.red, this.foundProduct.name);
          break;
        case 503:
          this.log('info', this.taskData.id, 'Waiting in queue');
          this.sendStatus(taskStatus.queue, taskColors.orange, this.foundProduct.name);
          setTimeout(this.pollQueue, this.taskData.monitorDelay);
          break;
        case 429:
          this.log('fatal', this.taskData.id, 'Rate limited');
          this.sendStatus('Rate limited', taskColors.red, this.foundProduct.name);
          setTimeout(this.submitShipping, this.taskData.retryDelay);
          break;
        default:
          console.log(resp.statusCode);
          break;
      }
    });
  }

  async submitBilling() {
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Submitting billing');
    this.sendStatus(taskStatus.submittingBilling, taskColors.yellow, this.foundProduct.name);
    const options = {
      method: 'POST',
      uri: `https://www.footlocker.${this.region}/api/users/carts/current/set-billing?timestamp=${Date.now()}`,
      body: `{"setAsDefaultBilling":false,"setAsDefaultShipping":false,"firstName":"${this.profile.firstname}","lastName":"${this.profile.lastname}","email":"${this.profile.lastname}","phone":"${this.profile.phone}","country":{"isocode":"${this.profile.shipping.countrycode}","name":"${this.profile.shipping.country}"},"billingAddress":false,"defaultAddress":false,"id":null,"line1":"${this.profile.shipping.address}","postalCode":"${this.profile.shipping.zip}","setAsBilling":false,"shippingAddress":true,"town":"${this.profile.shipping.city}","visibleInAddressBook":false,"type":"default"}`,
      headers: {
        accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'content-type': 'application/json',
        Host: `www.footlocker.${this.region}`,
        Origin: `https://www.footlocker.${this.region}`,
        Pragma: 'no-cache',
        Referer: `https://www.footlocker.${this.region}/product/-/${this.taskData.monitorInput}.html`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
        'x-csrf-token': this.csrf,
        'x-fl-productid': this.foundProduct.variant,
        'x-fl-request-id': '', // uuid(),
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    await rp(options).then(async (resp) => {
      switch (resp.statusCode) {
        case 200:
          await this.placeOrder();
          break;
        case 403:
          this.handleDatadome(resp.body, this.submitBilling);
          break;
        case 502:
          this.log('fatal', this.taskData.id, 'Proxy Error');
          this.sendStatus(taskStatus.proxyError, taskColors.red, this.foundProduct.name);
          break;
        case 429:
          this.log('fatal', this.taskData.id, 'Rate limited');
          this.sendStatus('Rate limited', taskColors.red, this.foundProduct.name);
          setTimeout(this.submitBilling, this.taskData.retryDelay);
          break;
        case 503:
          this.log('info', this.taskData.id, 'Waiting in queue');
          this.sendStatus(taskStatus.queue, taskColors.orange, this.foundProduct.name);
          setTimeout(this.pollQueue, this.taskData.monitorDelay);
          break;
        default:
          console.log(resp.statusCode);
          break;
      }
    });
  }
  async placeOrder() {
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Placing order');
    this.sendStatus('Placing order', taskColors.orange, this.foundProduct.name);
    const key =
      '10001|B6D07BD544BD5759FA13F1972F229EDFD76D2E39EC209797FC6A6A6B9F3388DD70255D83369FC6A10A9E3DDC90968345D62D73793B480C59458BA5C7E0EFBADC81DAE4060079064C556B4324C9EEA8D26EBB9011BBD8F769A6E463F2D078621ABC1432393FAECE489A68D85A0176A58E7292CB36E124305EB098DFB89C24AD58A27F7A21329DA2FE401199D5952C630340535785323E56F2B72AB8F18EA05DBA7A811C7A83B4B661358B6CCC338498F6BA10C9A16408FD33A231CC00EEE5A9397D92ECF3D616D44A687062833B5BF91EED57E3129B98B559192D65B787AE5A230A86D4ACF23C485318095DC4C589D1E990809BB2B74F0EDD3225FD3A64D89DD1';
    const CardData = adyenGenerator.default(key, {
      number: this.profile.cardnumber,
      month: this.profile.expdate.split('/')[0],
      year: `20${this.profile.expdate.split('/')[1]}`,
      ccv: this.profile.cvv,
    });

    const payload = {
      preferredLanguage: 'en',
      termsAndCondition: true,
      deviceId: '',
      cartId: this.cartid,
      encryptedCardNumber: CardData.encryptedCardNumber,
      encryptedExpiryMonth: CardData.encryptedExpiryMonth,
      encryptedExpiryYear: CardData.encryptedExpiryYear,
      encryptedSecurityCode: CardData.encryptedSecurityCode,
      paymentMethod: 'CREDITCARD',
      returnUrl: `https://www.footlocker.${this.region}/adyen/checkout`,
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
      uri: `https://www.footlocker.${this.region}/api/users/orders/adyen?timestamp=${Date.now()}`,
      body: JSON.stringify(payload),
      headers: {
        accept: 'application/json',
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'content-type': 'application/json',
        origin: `https://www.footlocker.${this.region}`,
        referer: `https://www.footlocker.${this.region}/checkout`,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
        'x-api-lang': 'en-GB',
        'x-csrf-token': this.csrf,
        'x-fl-request-id': '', // uuid()
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    await rp(options).then(async (resp) => {
      switch (resp.statusCode) {
        case 200:
          var obj = JSON.parse(resp.body);
          if (obj.action != undefined) {
            this.threeDSform = obj;
            this.sendWebhook({
              purchaseType: '3ds',
              price: this.foundProduct.price,
              productName: this.foundProduct.name,
              image: this.foundProduct.image,
              site: this.taskData.siteName,
              size: this.foundProduct.size,
              profile: this.profile.profilename,
              mode: 'Default',
            });
            this.log('info', this.taskData.id, 'Waiting for 3DS !');
            this.sendStatus('Waiting for 3DS', taskColors.blue, this.foundProduct.name);
            const threeDS = new threeDSHandler(obj.md, obj.paReq, obj.termUrl);
            const r = await threeDS.Handle();
            switch (r) {
              case 'error':
                this.log('fatal', this.taskData.id, 'Error Handling 3DS');
                this.sendStatus('3DS Error', taskColors.red, this.foundProduct.name);
                break;
              case 'expired':
                this.log('fatal', this.taskData.id, '3DS Verification Expired');
                this.sendStatus('3DS Expired', taskColors.red, this.foundProduct.name);
                break;
              case 'success':
                console.log(r);
                this.post3Ds();
                break;
              default:
                break;
            }
          } else {
            this.log('success', this.taskData.id, 'Successful checkout !');
            this.sendStatus(taskStatus.success, taskColors.green, this.foundProduct.name);
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
          }
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
          this.log('fatal', this.taskData.id, 'Card declined');
          this.sendStatus('Card declined', taskColors.red, this.foundProduct.name);
          break;
        case 403:
          this.handleDatadome(resp.body, this.placeOrder);
          break;
        case 429:
          this.log('fatal', this.taskData.id, 'Rate limited');
          this.sendStatus('Rate limited', taskColors.red, this.foundProduct.name);
          setTimeout(this.placeOrder, this.taskData.retryDelay);
          break;
        case 502:
          this.log('fatal', this.taskData.id, 'Proxy Error');
          this.sendStatus(taskStatus.proxyError, taskColors.red, this.foundProduct.name);
          break;
        case 503:
          this.log('info', this.taskData.id, 'Waiting in queue');
          this.sendStatus(taskStatus.queue, taskColors.orange, this.foundProduct.name);
          setTimeout(this.pollQueue, this.taskData.monitorDelay);
          break;
      }
    });
  }

  async post3Ds() {
    this.log('info', this.taskData.id, 'posting 3DS !');
    this.sendStatus('Received 3DS Anwser', taskColors.yellow, this.foundProduct.name);
    const options = {
      method: 'POST',
      uri: `https://www.footlocker.${this.region}/api/users/orders/completePayment?timestamp=${Date.now()}`,
      body: `{"cartId":"${this.cartid}","md":"${this.threeDSform['md']}","paRes":"${this.threeDSform['paRes']}","paymentData":"${this.threeDSform['action']['paymentData']}","paymentMethod": "CREDITCARD"}`,
      headers: {
        accept: 'application/json',
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6',
        'content-type': 'application/json',
        origin: `https://www.footlocker.${this.region}`,
        referer: `https://www.footlocker.${this.region}/checkout`,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
        'x-api-lang': 'en-GB',
        'x-csrf-token': this.csrf,
        'x-fl-request-id': '', // uuid()
      },
      jar: this.jar,
      proxy: this.currentProxy,
    };
    await rp(options).then(async (resp) => {
      switch (resp.statusCode) {
        case 200:
          this.log('success', this.taskData.id, 'Successful checkout !');
          this.sendStatus(taskStatus.success, taskColors.green, this.foundProduct.name);
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
          this.log('fatal', this.taskData.id, 'Card declined');
          this.sendStatus('Card declined', taskColors.red, this.foundProduct.name);
          break;
        case 403:
          this.handleDatadome(resp.body, this.post3Ds);
          break;
      }
    });
  }

  async GenDatadome() {
    this.log('fatal', this.taskData.id, 'Generating Datadome');
    this.sendStatus('Generating Datadome', taskColors.yellow, this.foundProduct.name);
    try {
      let resp = await rp({
        method: 'POST',
        uri: 'https://us-qweqwe.herokuapp.com/api/v1/datadome',
        headers: { 'content-type': 'application/json' },
        body: `{"x-auth":"qweqwe","ddjskey":"A55FBF4311ED6F1BF9911EB71931D5"}`,
      });
      if (!resp['success']) {
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
          Origin: `https://footlocker.${this.region}`,
          Referer: `https://www.footlocker.${this.region}/`,
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
        },
        proxy: this.currentProxy,
      });
      this.jar['datadome'] = resp['cookie'].split('datadome=')[1].split(';')[0];
    } catch (_) {
      return;
    }
  }

  async handleDatadome(body: string, callback: Function): Promise<void> {
    this.log('fatal', this.taskData.id, 'Solving Datadome');
    this.sendStatus('Solving Datadome', taskColors.yellow, this.foundProduct.name);
    const d = new DdSolver.default('2d067982bd0fbec5e8b0b048d18e27e8', this.jar['datadome'], body, this.currentProxy, `https://footlocker.${this.region}/`, true, this.taskData.id);
    const res = await d.Solve();
    if (res != 'error') {
      await this.pause(this.taskData.retryDelay);
      await callback.bind(this)();
    } else {
      this.log('fatal', this.taskData.id, 'Banned');
      this.sendStatus(taskStatus.proxyBanned, taskColors.red, this.foundProduct.name);
    }
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
    console.log(this.currentProxy);
  }
}
export default FootlockerEU;
