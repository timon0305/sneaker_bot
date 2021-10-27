/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-bitwise */
/* eslint-disable default-case */
/* eslint-disable no-restricted-globals */

import { performance } from 'perf_hooks';
import SupremeBot from './supreme-main';

export default class Go {
  encoder: TextEncoder;
  decoder: TextDecoder;
  logLine: Array<number>;
  _callbackTimeouts: any;
  _nextCallbackTimeoutID: any;
  importObject: any;
  // exited: boolean;
  _inst: any;
  _values: any;
  _callbackShutdown: any;
  _refs: any;
  _resolveExitPromise: any;
  _pendingEvent: any;
  _resolveCallbackPromise: () => void;
  task: SupremeBot;

  constructor(task) {
    this.task = task;
    this._callbackTimeouts = new Map();
    this._nextCallbackTimeoutID = 1;
    this.encoder = new TextEncoder('utf-8');
    this.decoder = new TextDecoder('utf-8');
    this.logLine = [];

    const timeOrigin = Date.now() - performance.now();

    this.importObject = {
      wasi_unstable: {
        fd_write: (fd, addr, d, f) => {
          if (fd === 1) {
            for (fd = 0; fd < d; fd++) {
              let k = addr + 8 * fd;
              const ptr = this.dataView.getUint32(k + 0, true);
              k = this.dataView.getUint32(k + 4, true);

              for (let i = 0; i < k; i++) {
                let c = this.dataView.getUint8(ptr + i);
                c = parseInt(this.decoder.decode(new Uint8Array(this.logLine)), 10);
                this.logLine = [];

                if (c !== 13) {
                  if (c === 10) {
                    console.log(c);
                  } else {
                    this.logLine.push(c);
                  }
                }
              }
            }
          } else {
            console.error('invalid file descriptor:', fd);
          }

          this.dataView.setUint32(f, 0, true);
          return 0;
        },
      },
      env: {
        // fun ticks float64
        'runtime.ticks': () => {
          const ticks = timeOrigin + performance.now();
          // console.log('runtime.ticks: [', ticks, ']');
          return ticks;
        },
        // func sleepTicks(timeout float64)
        'runtime.sleepTicks': (timeout) => {
          // console.log('Running runtime.sleepTicks.');
          if (this.exited) return;
          // timeout += 9000; // uncomment if you want to use a longer timeout.
          setTimeout(this._inst.exports.go_scheduler, timeout);
        },
        // func stringVal(value string) ref
        'syscall/js.stringVal': (ret_ptr, value_ptr, value_len) => {
          const s = this.utilLoadString(value_ptr, value_len);
          // console.log('syscall/js.stringVal: ', s);
          this.utilStoreValue(ret_ptr, s);
        },
        // func valueGet(v ref, p string) ref
        'syscall/js.valueGet': (retval, v_addr, p_ptr, p_len) => {
          const prop = this.utilLoadString(p_ptr, p_len);
          const value = this.utilLoadValue(v_addr);
          const result = Reflect.get(value, prop);

          // console.log('syscall/js.valueGet: [', prop, value, result, ']');

          this.utilStoreValue(retval, result);
        },

        // func valueSet(v ref, p string, x ref)
        'syscall/js.valueSet': (v_addr, p_ptr, p_len, x_addr) => {
          const target = this.utilLoadValue(v_addr);
          const propertyKey = this.utilLoadString(p_ptr, p_len);
          const value = this.utilLoadValue(x_addr);
          // console.log('syscall/js.valueSet: [', target, propertyKey, value, ']');

          Reflect.set(target, propertyKey, value);
        },
        // func valueIndex(v ref, i int) ref
        'syscall/js.valueIndex': (ret_addr, v_addr, i) => {
          // console.log('Running syscall/js.valueIndex.');

          this.utilStoreValue(ret_addr, Reflect.get(this.utilLoadValue(v_addr), i));
        },
        // valueSetIndex(v ref, i int, x ref)
        'syscall/js.valueSetIndex': (v_addr, i, x_addr) => {
          // console.log('Running syscall/js.valueSetIndex.');

          Reflect.set(this.utilLoadValue(v_addr), i, this.utilLoadValue(x_addr));
        },
        // func valueCall(v ref, m string, args []ref) (ref, bool)
        'syscall/js.valueCall': (ret_addr, v_addr, m_ptr, m_len, args_ptr, args_len, args_cap) => {
          const target = this.utilLoadValue(v_addr);
          const propertyKey = this.utilLoadString(m_ptr, m_len);
          const args = this.utilloadSliceOfValues(args_ptr, args_len, args_cap);
          // console.log('syscall/js.valueCall: [', propertyKey, args, ']');
          try {
            const m = Reflect.get(target, propertyKey);
            this.utilStoreValue(ret_addr, Reflect.apply(m, target, args));
            this.dataView.setUint8(ret_addr + 8, 1);
          } catch (err) {
            this.utilStoreValue(ret_addr, err);
            this.dataView.setUint8(ret_addr + 8, 0);
          }
        },
        // func valueInvoke(v ref, args []ref) (ref, bool)
        'syscall/js.valueInvoke': (ret_addr, v_addr, args_ptr, args_len, args_cap) => {
          try {
            const v = this.utilLoadValue(v_addr);
            const args = this.utilloadSliceOfValues(args_ptr, args_len, args_cap);
            // console.log('syscall/js.valueInvoke:  [', v, args, ']');

            this.utilStoreValue(ret_addr, Reflect.apply(v, undefined, args));
            this.dataView.setUint8(ret_addr + 8, 1);
          } catch (err) {
            this.utilStoreValue(ret_addr, err);
            this.dataView.setUint8(ret_addr + 8, 0);
          }
        },
        // func valueNew(v ref, args []ref) (ref, bool)
        'syscall/js.valueNew': (ret_addr, v_addr, args_ptr, args_len, args_cap) => {
          const v = this.utilLoadValue(v_addr);
          const args = this.utilloadSliceOfValues(args_ptr, args_len, args_cap);

          // console.log('syscall/js.valueNew: [', v, args, ']');

          try {
            this.utilStoreValue(ret_addr, Reflect.construct(v, args));
            this.dataView.setUint8(ret_addr + 8, 1);
          } catch (err) {
            this.utilStoreValue(ret_addr, err);
            this.dataView.setUint8(ret_addr + 8, 0);
          }
        },

        // func valueLength(v ref) int
        'syscall/js.valueLength': (v_addr) => {
          const { length } = this.utilLoadValue(v_addr);
          // console.log('syscall/js.valueLength: [', length, ']');

          return length;
        },
        // valuePrepareString(v ref) (ref, int)
        'syscall/js.valuePrepareString': (ret_addr, v_addr) => {
          const s = String(this.utilLoadValue(v_addr));
          const str = this.encoder.encode(s);
          // console.log('syscall/js.valuePrepareString: [', s, str, ']');
          this.utilStoreValue(ret_addr, str);
          this.utilSetInt64(ret_addr + 8, str.length);
        },
        // valueLoadString(v ref, b []byte)
        'syscall/js.valueLoadString': (v_addr, slice_ptr, slice_len, slice_cap) => {
          const str = this.utilLoadValue(v_addr);
          // console.log('syscall/js.valueLoadString: [', str, ']');
          this.utilLoadSlice(slice_ptr, slice_len, slice_cap).set(str);
        },
      },
    };
  }

  async run(instance, customGlobal) {
    this._inst = instance;
    this._values = [
      // TODO: garbage collection
      NaN,
      0,
      null,
      true,
      false,
      customGlobal, // switched from global to customGlobal
      this._inst.exports.memory,
      this,
    ];
    this._refs = new Map();
    this._callbackShutdown = false;
    // this.exited = false;

    // new DataView(this.memoryBuffer);

    while (true) {
      const callbackPromise = new Promise((resolve) => {
        this._resolveCallbackPromise = () => {
          if (this.exited) {
            throw new Error('bad callback: Go program has already exited');
          }
          setTimeout(resolve, 0); // make sure it is asynchronous
        };
      });
      this._inst.exports._start();
      if (this.exited) {
        break;
      }
      await callbackPromise;
    }
  }

  get exited() {
    return this.task.stopped;
  }

  get memoryBuffer() {
    return this._inst.exports.memory.buffer;
  }

  get dataView() {
    return new DataView(this.memoryBuffer);
  }

  _resume() {
    if (this.exited) {
      throw new Error('Go program has already exited');
    }
    this._inst.exports.resume();
    if (this.exited) {
      this._resolveExitPromise();
    }
  }

  /* _makeFuncWrapper(id) {
    const go = this;
    return function () {
      const event = { id, this: this, args: arguments };
      go._pendingEvent = event;
      go._resume();
      return event.result;
    };
  } */

  utilSetInt64(addr, v) {
    this.dataView.setUint32(addr + 0, v, true);
    this.dataView.setUint32(addr + 4, Math.floor(v / 4294967296), true);
  }

  utilLoadValue(addr) {
    const f = this.dataView.getFloat64(addr, true);
    if (f === 0) {
      return undefined;
    }
    if (!isNaN(f)) {
      return f;
    }

    const id = this.dataView.getUint32(addr, true);
    return this._values[id];
  }

  utilStoreValue(addr, v) {
    const nanHead = 0x7ff80000;

    if (typeof v === 'number') {
      if (isNaN(v)) {
        this.dataView.setUint32(addr + 4, nanHead, true);
        this.dataView.setUint32(addr, 0, true);
        return;
      }
      if (v === 0) {
        this.dataView.setUint32(addr + 4, nanHead, true);
        this.dataView.setUint32(addr, 1, true);
        return;
      }
      this.dataView.setFloat64(addr, v, true);
      return;
    }

    switch (v) {
      case undefined:
        this.dataView.setFloat64(addr, 0, true);
        return;
      case null:
        this.dataView.setUint32(addr + 4, nanHead, true);
        this.dataView.setUint32(addr, 2, true);
        return;
      case true:
        this.dataView.setUint32(addr + 4, nanHead, true);
        this.dataView.setUint32(addr, 3, true);
        return;
      case false:
        this.dataView.setUint32(addr + 4, nanHead, true);
        this.dataView.setUint32(addr, 4, true);
        return;
    }

    let ref = this._refs.get(v);

    if (ref === undefined) {
      ref = this._values.length;
      this._values.push(v);
      this._refs.set(v, ref);
    }

    let typeFlag = 0;
    switch (typeof v) {
      case 'string':
        typeFlag = 1;
        break;
      case 'symbol':
        typeFlag = 2;
        break;
      case 'function':
        typeFlag = 3;
        break;
    }
    this.dataView.setUint32(addr + 4, nanHead | typeFlag, true);
    this.dataView.setUint32(addr, ref, true);
  }

  utilLoadSlice(array, len, cap) {
    return new Uint8Array(this.memoryBuffer, array, len);
  }

  utilloadSliceOfValues(array, len, cap) {
    const a = new Array(len);
    for (let i = 0; i < len; i++) {
      a[i] = this.utilLoadValue(array + i * 8);
    }
    return a;
  }

  utilLoadString(addr, length) {
    const value = this.decoder.decode(new DataView(this.memoryBuffer, addr, length));
    return value;
  }
}
