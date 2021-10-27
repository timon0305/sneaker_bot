import { randomFillSync, createHash } from 'crypto';
// import requestPromise from 'request-promise-native';

import Go from './supreme-go';
import SupremeBot from './supreme-main';

// let lastWasm: string;
// let cachedWasm: ArrayBuffer;
// const lastWasm: Map<string, string> = new Map();
// const wasmCache: Map<string, WebAssembly.Module> = new Map();

export default class Ticket {
  customGlobal: any;
  customFS: any;
  go: Go;
  ticketWasm: string;
  region: string;

  task: SupremeBot;

  constructor(task: SupremeBot) {
    this.task = task;

    if (!task.requests.cookieJar) {
      console.error('Missing cookie jar.');
    }

    this.ticketWasm = task.product.ticketWasm;
    /* this.region = region;

    if (!lastWasm.has(this.region)) {
      lastWasm.set(this.region, this.ticketWasm);
    } */

    let outputBuf = '';

    const document = {
      get cookie() {
        // const str = ;
        // console.log(str);
        return task.requests.cookieJar._jar.getCookieStringSync('https://www.supremenewyork.com');
      },

      set cookie(value) {
        task.requests.cookieJar.setCookie(value, 'https://www.supremenewyork.com');
      },
    };

    const window = {
      get document() {
        return document;
      },

      get crypto() {
        return {
          getRandomValues: randomFillSync,
        };
      },
    };

    const navigator = {
      userAgent: task.requests.userAgent, // User agent should be the same for all the requests (ATC and Checkout)
    };

    this.customFS = {
      constants: { O_WRONLY: -1, O_RDWR: -1, O_CREAT: -1, O_TRUNC: -1, O_APPEND: -1, O_EXCL: -1 }, // unused
      writeSync(fd, buf) {
        outputBuf += this.decoder.decode(buf);
        const nl = outputBuf.lastIndexOf('\n');
        if (nl !== -1) {
          console.log(outputBuf.substr(0, nl));
          outputBuf = outputBuf.substr(nl + 1);
        }
        return buf.length;
      },
      write(fd, buf, offset, length, position, callback) {
        if (offset !== 0 || length !== buf.length || position !== null) {
          throw new Error('not implemented');
        }
        const n = this.writeSync(fd, buf);
        callback(null, n);
      },
      open(path, flags, mode, callback) {
        const err = new Error('not implemented');
        err.code = 'ENOSYS';
        callback(err);
      },
      read(fd, buffer, offset, length, position, callback) {
        const err = new Error('not implemented');
        err.code = 'ENOSYS';
        callback(err);
      },
      fsync(fd, callback) {
        callback(null);
      },
    };

    this.customGlobal = {
      Array,
      Object,
      Uint8Array,
      document,
      window,
      fs: this.customFS,
      navigator,
    };

    this.go = new Go(task);
  }

  async start() {
    /* if (wasmCache.has(this.region)) {
      console.log('Using cached wasm');
    } */

    /* if (!wasmCache.has(this.region) || lastWasm.get(this.region) !== this.ticketWasm) {
      const response = await requestPromise.get(this.ticketWasm, {
        encoding: null,
      });

      wasmCache.set(this.region, response);
    } */
    // wasmCache

    // if (!lastWasm.get(this.ticketWasm)) {}
    // const response2 = await requestPromise.get(this.ticketWasm, {
    //   encoding: null,
    // });
    // console.log(createHash('sha1').update(response2.body).digest('hex'));
    const response = await this.task.requests.getTicketWasm(this.ticketWasm);
    // console.log(response);
    // this.task.log('info', this.task.taskData.id, `Loading ticket with hash ${createHash('sha1').update(response.body).digest('hex')}`);
    // const wasm = wasmCache.get(hash);

    if (response && response.body) {
      const module = await WebAssembly.compile(response.body);
      const instance = await WebAssembly.instantiate(module, this.go.importObject);

      this.go.run(instance, this.customGlobal);
    }
  }
}
