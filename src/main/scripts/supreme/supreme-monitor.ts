/* eslint-disable no-await-in-loop */
import _ from 'underscore';
// eslint-disable-next-line import/no-cycle
import MainMonitor from '../main-classes/main-monitor';
import SupremeRequests from './supreme-requests';
import logger from '../../helpers/logger';
import taskColors from '../../helpers/task-colors';
import { ITaskData, ISupremeProduct } from '../../interfaces/index';
import taskStatus from '../../helpers/task-status';

interface IMonitorCheckpoints {
  'Product found': boolean;
  'Style found': boolean;
  'Finished monitor': boolean;
}

class SupremeMonitor extends MainMonitor {
  monitorCheckpoints: IMonitorCheckpoints;
  firstRequest: boolean;
  taskData: ITaskData;
  requests: SupremeRequests;
  errorDelay: number;
  mobileStock: Record<string, any>;
  desktopStock: Record<string, any>;
  mergedStock: Record<string, any>;
  productData: any;
  foundSizes: any;
  emitter: any;
  stylesFromUrl: Record<string, any>;
  constructor(taskData: ITaskData, proxies: any) {
    super(taskData, proxies);
    this.monitorCheckpoints = {
      'Product found': false,
      'Style found': false,
      'Finished monitor': false,
    };
    this.firstRequest = true;
    this.taskData = taskData;
    this.requests = new SupremeRequests(taskData, proxies);
    this.errorDelay = 1000;

    this.mobileStock = {};
    this.desktopStock = {};
    this.mergedStock = {};

    this.productData = {};

    this.foundSizes = {};
  }
  async getProductUrl(productUrl: string) {
    try {
      // temporary until url is a string
      const tempUrl = productUrl[0].split('+')[1];
      const response = await this.requests.getProductData(`${tempUrl}.json`);
      const { styles } = response.body;
      this.stylesFromUrl = styles;
      await Promise.all([this.getStyles()]);
    } catch (error) {
      await this.handleError(error.message, error, this.getProductUrl);
    }
  }
  async getMobile(): Promise<void> {
    if (this.stopped) return;
    try {
      const response = await this.requests.getMobileStock();
      this.mobileStock = response.body;
      this.log('info', this.taskData.id, 'Got mobile stock');
    } catch (error) {
      await this.handleError(error.message, error, this.getMobile);
    }
  }
  async getDesktop(): Promise<void> {
    if (this.stopped) return;
    try {
      const response = await this.requests.getDesktopStock();
      this.desktopStock = response.body;
      this.log('info', this.taskData.id, 'Got desktop stock');
    } catch (error) {
      await this.handleError(error.message, error, this.getDesktop);
    }
  }
  async mergeStock(): Promise<void> {
    if (this.stopped) return;
    try {
      await Promise.all([this.getMobile(), this.getDesktop()]);
      _.extend(this.mergedStock, this.mobileStock, this.desktopStock);
    } catch (error) {
      await this.handleError(error.message, error, this.mergeStock);
    }
  }
  async getScriptURL(): Promise<void> {
    if (this.stopped || this.taskData.restockMode) return;
    try {
      const response = await this.requests.getMainPage();

      const script = response.body.match(/d17ol771963kd3\.cloudfront\.net\/assets\/mobile-[^">]*/g)[1];

      const ticketMatch = new RegExp(/ ("|')(.*\.wasm)\1/g).exec(response.body);
      let ticketWasm;

      if (ticketMatch && ticketMatch.length > 1) {
        ticketWasm = ticketMatch[2];
      }

      if (!ticketWasm) {
        ticketWasm = 'https://www.supremenewyork.com/ticket.wasm'; // default wasm
      }

      if (ticketWasm && ticketWasm.endsWith('.wasm')) {
        this.log('info', this.taskData.id, `Found ticket wasm url ${ticketWasm}`);
        this.productData.ticketWasm = ticketWasm;
      }

      this.productData.mobileScript = `https://${script}`;
      this.log('info', this.taskData.id, 'Got mobile script');
    } catch (error) {
      await this.handleError(error.message, error, this.getScriptURL);
    }
  }
  async getProduct(): Promise<void> {
    if (this.stopped || this.monitorCheckpoints['Product found']) {
      return;
    }
    if (this.taskData.urlMode) {
      this.log('info', this.taskData.id, 'Getting product url');
      this.monitorCheckpoints['Product found'] = true;
      await this.getScriptURL();
      await this.getProductUrl(this.taskData.monitorInput);
      return;
    }
    try {
      this.sendStatus(taskStatus.monitoring, taskColors.yellow);
      this.firstRequest = false;
      await this.getScriptURL();
      if (this.stopped) return;
      await Promise.all([this.mergeStock()]);
      const category = this.mergedStock.products_and_categories[this.taskData.category];
      const keywords = this.taskData.monitorInput;
      for (let i = 0; i < category.length; i += 1) {
        const product = category[i];
        if (this.validateSupremeKeywords(product.name, keywords)) {
          // If product is found here, then we should update all the monitors that have the same keywords/site
          this.sendStatus(taskStatus.foundProduct, taskColors.yellow, product.name);
          this.monitorCheckpoints['Product found'] = true;
          this.productData.productID = product.id;
          this.productData.productURL = `https://www.supremenewyork.com/shop/${product.id}`;
          this.productData.name = product.name;
          // this.monitorManager.updateSupremeMonitors(this.productData);
          await Promise.all([this.getStyles()]);
          break;
        }
      }
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error getting product: ${error}`);
      await this.pause(this.errorDelay);
    }
  }
  async getStyles(): Promise<void> {
    if (this.stopped || this.monitorCheckpoints['Finished monitor'] || !this.monitorCheckpoints['Product found']) {
      return;
    }
    try {
      const response = this.stylesFromUrl ? null : await this.requests.getProductData(`${this.productData.productURL}.json`);
      const styles = this.stylesFromUrl ? this.stylesFromUrl : response.body.styles;
      if (this.taskData.productColor.toLocaleLowerCase() === 'any') {
        const randomColor = styles[Math.floor(Math.random() * styles.length)];
        this.foundSizes = randomColor.sizes;
        this.productData.image = `https:${randomColor.mobile_zoomed_url}`;
        this.productData.colorID = randomColor.id;
        if (!this.taskData.restockMode) {
          this.sendToast(this.productData.image, null, this.productData.name, 'Found product!', 'blue');
        }
        await Promise.all([this.getSizes()]);
        return;
      }
      const colors = styles.filter((style) => style.name.toLocaleLowerCase().includes(this.taskData.productColor.toLocaleLowerCase()));
      if (!colors.length) {
        this.sendStatus(taskStatus.supremeInvalidColor, taskColors.red);
        this.log('fatal', this.taskData.id, 'Invalid color');
        this.monitorManager.stopMonitor(this.taskData.id, this.taskData, this.proxies);
        return;
      }
      this.foundSizes = colors[0].sizes;
      this.productData.image = `https:${colors[0].mobile_zoomed_url}`;
      this.productData.colorID = colors[0].id;
      if (!this.taskData.restockMode) {
        this.sendToast(this.productData.image, null, this.productData.name, 'Found product!', 'blue');
      }
      await Promise.all([this.getSizes()]);
    } catch (error) {
      await this.handleError(error.message, error, this.getStyles);
    }
  }
  async getSizes(): Promise<void> {
    if (this.stopped) return;
    try {
      const sizesWanted = this.taskData.sizes;
      const sizes = this.foundSizes;
      if (this.taskData.sizes.indexOf('random') !== -1) {
        const randomInStockSizes = sizes.filter((product) => product.stock_level > 0);
        if (!randomInStockSizes.length) {
          this.log('info', this.taskData.id, 'Waiting for restock');
          this.sendStatus(taskStatus.restock, taskColors.yellow);
          await this.pause(this.taskData.monitorDelay);
          this.taskData.urlMode ? await this.getProduct() : await Promise.all([this.getStyles()]);
        }
        if (this.stopped) return;
        if (randomInStockSizes[0].name === 'N/A') {
          this.productData.sizeID = randomInStockSizes[0].id;
          this.productData.sizeName = 'N/A';
          this.log('info', this.taskData.id, `Selected size: ${this.productData.sizeName}`);
          this.monitorCheckpoints['Finished monitor'] = true;
          this.emitter.emit(`product-found-${this.taskData.id}`, this.productData);
          this.monitorManager.stopMonitor(this.taskData.id, this.taskData, this.proxies);
          return;
        }
        const randomSizeNumber = Math.floor(Math.random() * randomInStockSizes.length);
        const pickedSize = randomInStockSizes[randomSizeNumber];
        this.productData.sizeID = pickedSize.id;
        this.productData.sizeName = pickedSize.name;
        this.log('info', this.taskData.id, `Selected size: ${this.productData.sizeName}`);
        this.monitorCheckpoints['Finished monitor'] = true;
        this.emitter.emit(`product-found-${this.taskData.id}`, this.productData);
        this.monitorManager.stopMonitor(this.taskData.id, this.taskData, this.proxies);
        return;
      }
      const allSizes = [];
      for (let i = 0; i < sizes.length; i += 1) {
        const size = sizes[i];
        if (this.checkForSizes(size.name.toLocaleLowerCase(), sizesWanted)) {
          allSizes.push({ sizeID: size.id, name: size.name, stock: size.stock_level });
        }
      }
      const inStockSizes = allSizes.filter((product) => product.stock > 0);

      if (!inStockSizes.length) {
        this.sendStatus(taskStatus.restock, taskColors.yellow);
        this.log('info', this.taskData.id, 'Waiting for restock');
        await this.pause(this.taskData.monitorDelay);
        if (this.stopped) return;
        this.taskData.urlMode ? await this.getProduct() : await Promise.all([this.getStyles()]);
      }
      const randomProduct = Math.floor(Math.random() * inStockSizes.length);
      const pickedSize = inStockSizes[randomProduct];

      this.productData.sizeID = pickedSize.sizeID;
      this.productData.sizeName = pickedSize.name;
      this.log('info', this.taskData.id, `Selected size: ${this.productData.sizeName}`);
      this.monitorCheckpoints['Finished monitor'] = true;
      this.emitter.emit(`product-found-${this.taskData.id}`, this.productData);
      this.monitorManager.stopMonitor(this.taskData.id, this.taskData, this.proxies);
    } catch (error) {
      this.log('fatal', this.taskData.id, `Error getting sizes: ${error}`);
      await this.pause(this.errorDelay);
    }
  }
  async startMonitor(emitter): Promise<void> {
    if (this.stopped) {
      return;
    }
    logger.info(`Started monitor for task: ${this.taskData.id}`);
    this.emitter = emitter;
    while (!this.stopped || !this.monitorCheckpoints['Finished monitor']) {
      try {
        if (this.stopped) {
          break;
        }
        await this.pause(this.firstRequest ? 0 : this.taskData.monitorDelay);
        await this.getProduct();
      } catch (error) {
        console.log(`Error from main task loop: ${error}`);
      }
    }
  }
  // eslint-disable-next-line class-methods-use-this
  checkForSizes(size, sizesWanted): boolean {
    for (let i = 0; i < sizesWanted.length; i += 1) {
      const wanted = sizesWanted[i];
      if (size === wanted) {
        return true;
      }
    }
    return false;
  }
  async handleError(message, error, method): Promise<any> {
    if (
      message.indexOf('tunneling socket could not be established') !== -1 ||
      message.indexOf('EPROTO') !== -1 ||
      message.indexOf('socket hang up') !== -1 ||
      message.indexOf('Client network socket disconnected before secure TLS connection was established') !== -1
    ) {
      this.log('fatal', this.taskData.id, `Proxy error: ${message}`);
      this.sendStatus(taskStatus.proxyError, taskColors.red);
      // Switch proxy
      this.requests.saveProxy();
      await this.pause(this.errorDelay);
      this.sendStatus(taskStatus.monitoring, taskColors.yellow);
      // Call the method that threw the error
      await method.bind(this)();
      return;
    }
    if (error.statusCode === 429) {
      this.sendStatus(`${taskStatus.proxyBanned} ${error.statusCode}`, taskColors.red);
      // Switch proxy
      this.requests.saveProxy();
      return;
    }
    if (error.message.indexOf('ESOCKETTIMEDOUT') !== -1) {
      this.log('fatal', this.taskData.id, `Timeout ${message}`);
      this.sendStatus(taskStatus.timeout, taskColors.red);
      // Switch proxy
      this.requests.saveProxy();
      await this.pause(this.errorDelay);
      this.sendStatus(taskStatus.monitoring, taskColors.yellow);
      // Call the method that threw the error
      await method.bind(this)();
      return;
    }
    this.sendStatus(taskStatus.taskError, taskColors.red);
    this.log('fatal', this.taskData.id, `Error: ${method.name}: ${message}`);
    // Switch proxy
    this.requests.saveProxy();
    await this.pause(this.errorDelay);
    this.sendStatus(taskStatus.monitoring, taskColors.yellow);
    // Call the method that threw the error
    await method.bind(this)();
  }
}
export default SupremeMonitor;
