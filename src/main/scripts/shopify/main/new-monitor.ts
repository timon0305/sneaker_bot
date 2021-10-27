/* eslint-disable no-case-declarations */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
import EventEmitter from 'events';
import cheerio from 'cheerio';
import MainMonitor from '../../main-classes/main-monitor';
import ShopifyRequests from './shopify-requests';

import { ITaskData } from '../../../interfaces/index';

import taskStatus from '../../../helpers/task-status';
import taskColors from '../../../helpers/task-colors';

class ShopifyMonitor extends MainMonitor {
  emitter: EventEmitter.EventEmitter;
  requests: ShopifyRequests;
  lastRequest: number;
  productURL: string;
  product: {
    size?: string;
    variant?: string;
    price?: string;
    image?: string;
    name?: string;
    special?: { dsmHash?: string; cartForm?: any };
  };
  preloadProduct: { url: string; variant: string };
  webhookData: { name: string; image: string; size: string };
  checkpoints: { 'Found product': boolean };
  firstRequest: boolean;
  monitorProduct: any;
  startedMonitor: boolean;
  constructor(taskData: ITaskData, proxies) {
    super(taskData, proxies);
    this.taskData = taskData;
    this.proxies = proxies;

    this.requests = new ShopifyRequests(taskData, proxies);

    this.lastRequest = 0;

    this.productURL = null;
    this.product = null;
    this.preloadProduct = null;

    this.checkpoints = {
      'Found product': false,
    };
    this.firstRequest = true;
    this.startedMonitor = false;
  }
  /**
   * Gets the /products.json endpoint for any given shopify site
   */
  async jsonMonitor(): Promise<void> {
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Monitoring');
    this.sendStatus(taskStatus.monitoring, taskColors.yellow);
    try {
      if (this.productURL) {
        if (this.taskData.site.includes('dover')) {
          await this.getHtmlProduct();
          return;
        }
        await this.getProductData();
        return;
      }
      this.firstRequest = false;
      let foundProduct;
      let products = [];
      const keywordGroups = this.taskData.monitorInput;
      this.lastRequest = Date.now();
      const response = await this.requests.getEndpoint(`${this.taskData.site}/products.json?page=-${Math.floor(Math.random() * (999999999 - 0 + 1) + 0)}`);
      switch (response.statusCode) {
        case 200:
          products = JSON.parse(response.body).products;
          foundProduct = products.find((p) => this.validateShopifyKeywords(p.title.toLowerCase(), keywordGroups));
          if (typeof foundProduct !== 'undefined') {
            this.productURL = `${this.taskData.site}/products/${foundProduct.handle}`;
            this.monitorProduct = foundProduct;
            this.log('info', this.taskData.id, `Product URL: ${this.productURL}`);
            await this.getCartForm();
            await this.getVariant();
          }
          break;
        case 401:
          this.sendStatus(taskStatus.password, taskColors.yellow);
          this.log('info', this.taskData.id, 'Password page while searching products');
          await this.pause(this.taskData.monitorDelay - (Date.now() - this.lastRequest));
          break;
        default:
          this.log('info', this.taskData.id, `Unexpected response monitoring - ${response.statusCode}: ${response.body}`);
          await this.pause(this.taskData.retryDelay);
          this.requests.saveProxy();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.jsonMonitor);
    }
  }
  /**
   * Gets product url endpoint .js or .json
   * @param json If set to true we request the .json endpoint instead of the .js
   */
  async getProductData(json = false): Promise<void> {
    if (this.stopped) return;
    try {
      this.log('info', this.taskData.id, 'Getting product');
      const endpoint = `${this.productURL}.${json ? 'json' : 'js'}?page=_${Math.floor(Math.random() * (999999999 - 0 + 1) + 0)}`;
      this.lastRequest = Date.now();
      const response = await this.requests.getEndpoint(endpoint);
      switch (response.statusCode) {
        case 200:
          this.monitorProduct = JSON.parse(response.body);
          this.product = {};
          this.product.image = `https:${this.monitorProduct.featured_image}`;
          this.product.name = this.monitorProduct.title;
          this.sendToast(this.product.image, this.product.image, this.product.name, 'Found product!', 'blue');
          await this.getCartForm();
          await this.getVariant();
          break;
        case 404:
          if (this.productURL) {
            this.log('info', this.taskData.id, 'Waiting for product');
            this.sendStatus(taskStatus.waitingProduct, taskColors.yellow);
            await this.pause(this.taskData.monitorDelay - (Date.now() - this.lastRequest));
            await this.getProductData();
          }
          break;
        case 401:
          this.sendStatus(taskStatus.password, taskColors.yellow);
          this.log('info', this.taskData.id, 'Password page while getting product');
          await this.pause(this.taskData.monitorDelay - (Date.now() - this.lastRequest));
          await this.getProductData();
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected product response: ${response.statusCode}: ${response.body}`);
          await this.pause(this.taskData.retryDelay);
          this.requests.saveProxy();
          await this.getProductData(true);
          break;
      }
      this.stopped = true;
    } catch (error) {
      await this.handleError(error, this.getProductData);
    }
  }
  /**
   * Special way to monitor DSM
   */
  async dsmMonitor(): Promise<void> {
    if (this.stopped) return;
    this.log('info', this.taskData.id, 'Monitoring');
    this.sendStatus(taskStatus.monitoring, taskColors.yellow);
    try {
      if (this.productURL) {
        await this.getHtmlProduct();
        return;
      }
      const keywordGroups = this.taskData.monitorInput;
      this.lastRequest = Date.now();
      const response = await this.requests.getEndpoint(this.taskData.site);
      this.firstRequest = false;
      const $ = cheerio.load(response.body);
      const products = $('[class="grid-view-item__link"]');
      for (let i = 0; i < products.length; i += 1) {
        const product = products[i];
        const urlPath = $(product).attr('href');
        const title = $(product).find('.grid-view-item__title')[0].firstChild.nodeValue;
        if (this.validateShopifyKeywords(title.toLowerCase(), keywordGroups)) {
          this.productURL = `${this.taskData.site}${urlPath}`;
          await this.getHtmlProduct();
        }
      }
    } catch (error) {
      await this.handleError(error, this.dsmMonitor);
    }
  }
  async getDsmHash(body: string | Buffer): Promise<void> {
    if (this.stopped) return;
    try {
      if (this.taskData.siteName === 'DSM US') {
        const hashValidation = /\$\(\s*atob\(\s*'PGlucHV0IHR5cGU9ImhpZGRlbiIgbmFtZT0icHJvcGVydGllc1tfSEFTSF0iIC8\+'\s*\)\s*\)\s*\.val\(\s*'(.+)'\s*\)/;
        if (typeof body === 'string') {
          this.product = { ...this.product };
          this.product.special = { ...this.product.special };
          const hash = body.match(hashValidation)[1];
          this.product.special.dsmHash = hash;
          this.log('info', this.taskData.id, `Got DSM US hash: ${hash}`);
        }
      } else if (this.taskData.siteName === 'DSM') {
        // Todo: get dsm uk hash
        this.stopped = true;
      } else {
        // dsm jp & sg are the same
        const $ = cheerio.load(body);
        const url = $("[src*='custom.js']").attr('src');
        console.log(url);
      }
    } catch (error) {
      await this.handleError(error, this.getDsmHash);
    }
  }
  /**
   * Gets random in stock variant used for pre-load mode
   */
  async getPreloadVariant(): Promise<void> {
    try {
      this.log('info', this.taskData.id, 'Getting random instock variant');
      this.lastRequest = Date.now();
      const response = await this.requests.getEndpoint(`${this.taskData.site}/products.json`);
      switch (response.statusCode) {
        case 200:
          const allProducts = JSON.parse(response.body).products;
          const inStockProduct = allProducts.find((product) => product.variants[0].available === true);
          if (typeof inStockProduct === 'undefined') {
            this.sendStatus('Variant not available', taskColors.yellow);
            this.log('warning', this.taskData.id, 'Pre-load variant not available');
            await this.pause(this.taskData.monitorDelay - (Date.now() - this.lastRequest));
            await this.getPreloadVariant();
          }
          const variant = inStockProduct.variants.find((v) => v.available === true).id;
          this.preloadProduct = { url: `${this.taskData.site}/products/${inStockProduct.handle}`, variant };
          return;
        case 401:
          this.sendStatus(taskStatus.password, taskColors.yellow);
          this.log('info', this.taskData.id, 'Password page while searching pre-load variant');
          await this.pause(this.taskData.monitorDelay - (Date.now() - this.lastRequest));
          await this.getPreloadVariant();
          break;
        default:
          this.log('fatal', this.taskData.id, `Unexpected response getting pre-load product ${response.statusCode} ${response.body}`);
          this.requests.saveProxy();
          await this.pause(this.taskData.retryDelay);
          await this.getPreloadVariant();
          break;
      }
    } catch (error) {
      await this.handleError(error, this.getPreloadVariant);
    }
  }
  async getHtmlProduct(): Promise<any> {
    if (this.stopped) return;
    this.sendStatus(taskStatus.gettingProperties, taskColors.yellow);
    this.log('info', this.taskData.id, 'Getting properties');
    try {
      this.lastRequest = Date.now();
      const response = await this.requests.getChromeHeaders(this.productURL, 'https://www.google.com/');
      if (response.statusCode === 404) {
        this.log('info', this.taskData.id, 'Waiting for product');
        this.sendStatus(taskStatus.waitingProduct, taskColors.yellow);
        await this.pause(this.taskData.monitorDelay - (Date.now() - this.lastRequest));
        await this.getHtmlProduct();
      }
      this.monitorProduct = this.getProductDataHTML(response.body, this.taskData.siteName);
      if (this.taskData.site.includes('dover')) {
        await this.getDsmHash(response.body);
      }
      await this.getVariant();
    } catch (error) {
      await this.handleError(error, this.getHtmlProduct);
    }
  }
  /**
   * Sets product from html values
   * @param responseBody Product page body
   * @param site Site being monitored
   */
  getProductDataHTML(responseBody, site): void {
    const $ = cheerio.load(responseBody);
    let productData;
    if (site.includes('Kith')) {
      productData = $('script[data-product-json]')[0].children[0].data;
    } else {
      const metaIdx = responseBody.indexOf('var meta');
      const metaBody = responseBody.substring(metaIdx);
      const openObject = metaBody.indexOf('{');
      const endLineIndex = metaBody.indexOf(';');
      productData = metaBody.substring(openObject, endLineIndex);
    }
    productData = JSON.parse(productData);
    if (productData.product) {
      productData = productData.product;
    }
    return productData;
  }
  async getVariant(): Promise<void> {
    const { variants } = this.monitorProduct;
    if (this.taskData.sizes.includes('random')) {
      // Check if there is a random in stock variant
      const inStockVariants = variants.filter((variant) => variant.available === true);
      if (inStockVariants.length > 0) {
        const randomVariant = inStockVariants[Math.floor(Math.random() * inStockVariants.length)];
        this.log('info', this.taskData.id, `Random in stock variant found: ${randomVariant.id}`);
        this.product = {
          ...this.product,
          size: randomVariant.title,
          variant: randomVariant.id,
          name: randomVariant.name,
        };
        this.sendProduct();
      } else {
        // If there isnt then we pick a random variant
        const randomVariant = variants[Math.floor(Math.random() * variants.length)];
        this.log('info', this.taskData.id, `Random variant found (OOS): ${randomVariant.id}`);
        this.product = {
          ...this.product,
          size: randomVariant.title,
          variant: randomVariant.id,
          name: randomVariant.name,
        };
        this.sendProduct();
      }
    } else {
      await this.getSpecificVariant();
    }
  }
  async getSpecificVariant(): Promise<void> {
    const sizesWanted = this.taskData.sizes;
    // Pick a random size from the sizes wanted
    const randomSize = sizesWanted[Math.floor(Math.random() * sizesWanted.length)].toLocaleLowerCase();
    const { variants } = this.monitorProduct;
    const foundVariant = variants.find((variant) => this.checkVariant(variant, randomSize));
    if (typeof foundVariant !== 'undefined') {
      this.product = { ...this.product, size: foundVariant.title, variant: foundVariant.id };
      this.log('info', this.taskData.id, `Found product: ${JSON.stringify(this.product)}`);
      this.sendProduct();
    }
  }
  // If there is no way we can get a random variant with this, then we keep returning the parameter variant
  async getRandomVariant(variant: number): Promise<number> {
    if (this.stopped) return;
    try {
      // Test: Should we cache this.monitorProduct to avoid banning?
      const response = await this.requests.getEndpoint(`${this.taskData.site}/products.json`);
      const foundVariant = this.getRandomProductVariant(JSON.parse(response.body), variant);
      if (typeof foundVariant !== 'undefined') {
        return foundVariant;
      }
      // If we cant find a variant with a variant then we return undefined to not call this method again.
      return undefined;
    } catch (error) {
      await this.handleError(error, this.getRandomVariant);
    }
  }
  /**
   * Get a random variant using a previously had variant as reference to find it
   * @param response Products endpoint response
   * @param variant Variant the task already has
   */
  getRandomProductVariant(response: any, variant: number): number {
    const foundProduct = response.products.find((product) => product.variants.find((v) => v.id === variant));
    if (typeof foundProduct === 'undefined') {
      this.log('info', this.taskData.id, 'Could not find any related products');
      return undefined;
    }
    const foundVariant = foundProduct.variants[Math.floor(Math.random() * foundProduct.variants.length)].id;
    this.log('info', this.taskData.id, `Task using variant: ${foundVariant}`);
    return foundVariant;
  }
  /**
   * Gets extra cart parameters
   */
  async getCartForm(): Promise<void> {
    if (this.stopped || this.taskData.siteType.includes('advanced')) return;
    try {
      this.sendStatus(taskStatus.gettingProperties, taskColors.yellow);
      this.log('info', this.taskData.id, 'Getting properties');
      const response = await this.requests.getChromeHeaders(this.productURL, 'https://www.google.com/');
      const $ = cheerio.load(response.body, { normalizeWhitespace: true, xmlMode: false });
      const scrapedForm = {};
      $('form[action*="add"] input, textarea, select, button').each((i, element) => {
        const key = $(element).attr('name') || '';
        const value = $(element).attr('value') || '';
        if (key && !key.match(/id|quantity|add|option-0/)) {
          scrapedForm[key] = value;
        }
      });
      this.product = { ...this.product };
      this.product.special = { ...this.product.special };
      this.product.special.cartForm = scrapedForm;
      this.log('info', this.taskData.id, `Scraped propeties: ${JSON.stringify(scrapedForm)}`);
    } catch (error) {
      await this.handleError(error, this.getCartForm);
    }
  }
  // Todo: Figure this shit out LOL
  monitorVariant(variant: any): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        this.lastRequest = Date.now();
        const response = await this.requests.getEndpoint(`${this.productURL}.js`);
        switch (response.statusCode) {
          case 200: {
            const { variants } = JSON.parse(response.body);
            const inStock = variants.find((v) => v.id === variant && v.available === true);
            if (typeof inStock !== 'undefined') {
              this.log('info', this.taskData.id, `Variant in stock: ${variant}`);
              resolve();
            }
            this.sendStatus(taskStatus.restock, taskColors.yellow);
            this.log('info', this.taskData.id, 'Waiting for restock');
            await this.pause(this.taskData.monitorDelay - (Date.now() - this.lastRequest));
            await this.monitorVariant(variant);
            break;
          }
          default:
            this.log('fatal', this.taskData.id, `Unexpected monitor response: ${response.statusCode}`);
            break;
        }
      } catch (error) {
        await this.handleError(error, this.monitorVariant);
      }
    });
  }
  /**
   * Gets specific size from variants
   * @param variant Shopify product variant
   * @param sizesWanted Random size picked from sizes wanted array
   */
  checkVariant(variant: any, sizeWanted: string): boolean {
    let title = '';
    if (typeof variant !== 'string') {
      const possibleTitles = Object.entries(variant).filter((value) => value[0].includes('option') || value[0].includes('title'));
      const foundTitle = possibleTitles.find((value) => typeof value[1] === 'string' && /^[a-zA-Z0-9]+$/g.test(value[1]));
      // If all possible titles have an unwanted character
      if (typeof foundTitle === 'undefined') {
        title = variant.title;
      } else {
        [, title] = foundTitle as [string, string];
      }
    } else {
      title = variant.toLocaleLowerCase();
    }
    if (this.checkSizes(title.toLocaleLowerCase(), sizeWanted)) {
      return true;
    }
    return false;
  }
  /**
   * Matches the correct size for shopify
   * @param title Shopify size title
   * @param sizeWanted
   */
  checkSizes(title: string, sizeWanted: string): boolean {
    const shopifySize = this.shopifySizes[sizeWanted];
    // Shoe sizing
    if (typeof shopifySize === 'undefined') {
      if (title.includes(sizeWanted)) {
        return true;
      }
      return false;
    }
    // Clothes sizing
    const matchingSize = shopifySize.find((size: string) => title === size);
    if (typeof matchingSize !== 'undefined') {
      return true;
    }
    /**
     * If for some reason we dont find the size wanted
     */
    if (typeof matchingSize === 'undefined' && typeof shopifySize === 'undefined') {
      if (title.includes(sizeWanted)) {
        return true;
      }
    }
    return false;
  }
  async startMonitor(emitter: EventEmitter.EventEmitter): Promise<void> {
    if (this.checkpoints['Found product'] || this.stopped || this.startedMonitor) return;
    this.log('info', this.taskData.id, 'Starting monitor');
    this.emitter = emitter;
    this.setMonitorMode();
    this.startedMonitor = true;
    while (!this.stopped || !this.checkpoints['Found product']) {
      if (this.stopped || this.checkpoints['Found product']) break;
      try {
        await this.pause(this.firstRequest ? 0 : this.taskData.monitorDelay - (Date.now() - this.lastRequest));
        if (this.taskData.site.includes('dover')) {
          await this.dsmMonitor();
        } else {
          await this.jsonMonitor();
        }
      } catch (error) {
        await this.handleError(error, this.startMonitor);
      }
    }
  }
  setMonitorMode(): void {
    switch (this.taskData.monitorType) {
      case 'url':
        this.productURL = this.taskData.monitorInput as string;
        break;
      case 'variant':
        this.product = { size: 'Variant', variant: this.taskData.monitorInput as string };
        this.webhookData = {
          name: `${this.taskData.monitorInput}`,
          image: 'https://i.imgur.com/qVgUmBB.png',
          size: 'Variant',
        };
        this.log('info', this.taskData.id, `Found product: ${JSON.stringify(this.product)}`);
        this.sendProduct();
        break;
      case 'keywords':
        break;
      default:
        this.log('fatal', this.taskData.id, 'Cannot find that monitor mode');
        break;
    }
  }
  /**
   * Emits the product found event to sent product to task and stops monitor
   */
  sendProduct(): void {
    this.emitter.emit(`PRODUCT_FOUND_${this.taskData.id}`, this.product);
    this.checkpoints['Found product'] = true;
    this.monitorManager.stopMonitor(this.taskData.id, this.taskData, this.proxies);
  }
  async handleError(error, method: Function): Promise<void> {
    if (this.stopped) return;
    const { message } = error;
    // Check for proxy error
    if (this.proxyErrors.test(message)) {
      this.log('fatal', this.taskData.id, `Proxy error - ${message}`);
      this.sendStatus(taskStatus.proxyError, taskColors.red);
      this.requests.saveProxy();
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
      // Check for timeout error
    } else if (this.timeoutErrors.test(message)) {
      this.log('fatal', this.taskData.id, `Timeout error - ${message} ${error.statusCode ? error.statusCode : ''}`);
      this.sendStatus(taskStatus.timeout, taskColors.red);
      this.requests.saveProxy();
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
    } else if (error.statusCode === 401) {
      this.log('warning', this.taskData.id, `Password page (unhandled): ${method.name}`);
      this.sendStatus(taskStatus.password, taskColors.yellow);
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
    } else {
      this.sendStatus(`Monitor error, retrying ${error.statusCode ? `${error.statusCode}` : ''}`, taskColors.red);
      this.log('fatal', this.taskData.id, `Monitor error, retrying - ${error.stack}`);
      this.requests.saveProxy();
      await this.pause(this.taskData.retryDelay);
      await method.bind(this)();
    }
  }
}
export default ShopifyMonitor;
