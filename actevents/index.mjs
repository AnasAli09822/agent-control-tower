import { createRequire as __WEBPACK_EXTERNAL_createRequire } from "module";
/******/ var __webpack_modules__ = ({

/***/ 5072:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
// This is an empty module that is served up when outside of a workerd environment
// See the `exports` field in package.json
exports["default"] = {};
//# sourceMappingURL=empty.js.map

/***/ }),

/***/ 839:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



//Parse method copied from https://github.com/brianc/node-postgres
//Copyright (c) 2010-2014 Brian Carlson (brian.m.carlson@gmail.com)
//MIT License

//parses a connection string
function parse(str, options = {}) {
  //unix socket
  if (str.charAt(0) === '/') {
    const config = str.split(' ')
    return { host: config[0], database: config[1] }
  }

  // Check for empty host in URL

  const config = Object.create(null)
  let result
  let dummyHost = false
  if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(str)) {
    // Ensure spaces are encoded as %20
    str = encodeURI(str).replace(/%25(\d\d)/g, '%$1')
  }

  try {
    try {
      result = new URL(str, 'postgres://base')
    } catch (e) {
      // The URL is invalid so try again with a dummy host
      result = new URL(str.replace('@/', '@___DUMMY___/'), 'postgres://base')
      dummyHost = true
    }
  } catch (err) {
    // Remove the input from the error message to avoid leaking sensitive information
    err.input && (err.input = '*****REDACTED*****')
    throw err
  }

  // We'd like to use Object.fromEntries() here but Node.js 10 does not support it
  for (const entry of result.searchParams.entries()) {
    config[entry[0]] = entry[1]
  }

  config.user = config.user || decodeURIComponent(result.username)
  config.password = config.password || decodeURIComponent(result.password)

  if (result.protocol == 'socket:') {
    config.host = decodeURI(result.pathname)
    config.database = result.searchParams.get('db')
    config.client_encoding = result.searchParams.get('encoding')
    return config
  }
  const hostname = dummyHost ? '' : result.hostname
  if (!config.host) {
    // Only set the host if there is no equivalent query param.
    config.host = decodeURIComponent(hostname)
  } else if (hostname && /^%2f/i.test(hostname)) {
    // Only prepend the hostname to the pathname if it is not a URL encoded Unix socket host.
    result.pathname = hostname + result.pathname
  }
  if (!config.port) {
    // Only set the port if there is no equivalent query param.
    config.port = result.port
  }

  const pathname = result.pathname.slice(1) || null
  config.database = pathname ? decodeURI(pathname) : null

  if (config.ssl === 'true' || config.ssl === '1') {
    config.ssl = true
  }

  if (config.ssl === '0') {
    config.ssl = false
  }

  if (config.sslcert || config.sslkey || config.sslrootcert || config.sslmode) {
    config.ssl = {}
  }

  // sslnegotiation=direct implies SSL is in use (libpq requires sslmode>=require),
  // so enable SSL if the connection string did not otherwise configure it.
  if (config.sslnegotiation === 'direct' && config.ssl === undefined) {
    config.ssl = true
  }

  // Only try to load fs if we expect to read from the disk
  const fs = config.sslcert || config.sslkey || config.sslrootcert ? __nccwpck_require__(9896) : null

  if (config.sslcert) {
    config.ssl.cert = fs.readFileSync(config.sslcert).toString()
  }

  if (config.sslkey) {
    config.ssl.key = fs.readFileSync(config.sslkey).toString()
  }

  if (config.sslrootcert) {
    config.ssl.ca = fs.readFileSync(config.sslrootcert).toString()
  }

  if (options.useLibpqCompat && config.uselibpqcompat) {
    throw new Error('Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.')
  }

  if (config.uselibpqcompat === 'true' || options.useLibpqCompat) {
    switch (config.sslmode) {
      case 'disable': {
        config.ssl = false
        break
      }
      case 'prefer': {
        config.ssl.rejectUnauthorized = false
        break
      }
      case 'require': {
        if (config.sslrootcert) {
          // If a root CA is specified, behavior of `sslmode=require` will be the same as that of `verify-ca`
          config.ssl.checkServerIdentity = function () {}
        } else {
          config.ssl.rejectUnauthorized = false
        }
        break
      }
      case 'verify-ca': {
        if (!config.ssl.ca) {
          throw new Error(
            'SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security.'
          )
        }
        config.ssl.checkServerIdentity = function () {}
        break
      }
      case 'verify-full': {
        break
      }
    }
  } else {
    switch (config.sslmode) {
      case 'disable': {
        config.ssl = false
        break
      }
      case 'prefer':
      case 'require':
      case 'verify-ca':
      case 'verify-full': {
        if (config.sslmode !== 'verify-full') {
          deprecatedSslModeWarning(config.sslmode)
        }
        break
      }
      case 'no-verify': {
        config.ssl.rejectUnauthorized = false
        break
      }
    }
  }

  return config
}

// convert pg-connection-string ssl config to a ClientConfig.ConnectionOptions
function toConnectionOptions(sslConfig) {
  const connectionOptions = Object.entries(sslConfig).reduce((c, [key, value]) => {
    // we explicitly check for undefined and null instead of `if (value)` because some
    // options accept falsy values. Example: `ssl.rejectUnauthorized = false`
    if (value !== undefined && value !== null) {
      c[key] = value
    }

    return c
  }, Object.create(null))

  return connectionOptions
}

// convert pg-connection-string config to a ClientConfig
function toClientConfig(config) {
  const poolConfig = Object.entries(config).reduce((c, [key, value]) => {
    if (key === 'ssl') {
      const sslConfig = value

      if (typeof sslConfig === 'boolean') {
        c[key] = sslConfig
      }

      if (typeof sslConfig === 'object') {
        c[key] = toConnectionOptions(sslConfig)
      }
    } else if (value !== undefined && value !== null) {
      if (key === 'port') {
        // when port is not specified, it is converted into an empty string
        // we want to avoid NaN or empty string as a values in ClientConfig
        if (value !== '') {
          const v = parseInt(value, 10)
          if (isNaN(v)) {
            throw new Error(`Invalid ${key}: ${value}`)
          }

          c[key] = v
        }
      } else {
        c[key] = value
      }
    }

    return c
  }, Object.create(null))

  return poolConfig
}

// parses a connection string into ClientConfig
function parseIntoClientConfig(str) {
  return toClientConfig(parse(str))
}

function deprecatedSslModeWarning(sslmode) {
  if (!deprecatedSslModeWarning.warned && typeof process !== 'undefined' && process.emitWarning) {
    deprecatedSslModeWarning.warned = true
    process.emitWarning(`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=${sslmode}'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.`)
  }
}

module.exports = parse

parse.parse = parse
parse.toClientConfig = toClientConfig
parse.parseIntoClientConfig = parseIntoClientConfig


/***/ }),

/***/ 3572:
/***/ ((module) => {



// selected so (BASE - 1) * 0x100000000 + 0xffffffff is a safe integer
var BASE = 1000000;

function readInt8(buffer) {
	var high = buffer.readInt32BE(0);
	var low = buffer.readUInt32BE(4);
	var sign = '';

	if (high < 0) {
		high = ~high + (low === 0);
		low = (~low + 1) >>> 0;
		sign = '-';
	}

	var result = '';
	var carry;
	var t;
	var digits;
	var pad;
	var l;
	var i;

	{
		carry = high % BASE;
		high = high / BASE >>> 0;

		t = 0x100000000 * carry + low;
		low = t / BASE >>> 0;
		digits = '' + (t - BASE * low);

		if (low === 0 && high === 0) {
			return sign + digits + result;
		}

		pad = '';
		l = 6 - digits.length;

		for (i = 0; i < l; i++) {
			pad += '0';
		}

		result = pad + digits + result;
	}

	{
		carry = high % BASE;
		high = high / BASE >>> 0;

		t = 0x100000000 * carry + low;
		low = t / BASE >>> 0;
		digits = '' + (t - BASE * low);

		if (low === 0 && high === 0) {
			return sign + digits + result;
		}

		pad = '';
		l = 6 - digits.length;

		for (i = 0; i < l; i++) {
			pad += '0';
		}

		result = pad + digits + result;
	}

	{
		carry = high % BASE;
		high = high / BASE >>> 0;

		t = 0x100000000 * carry + low;
		low = t / BASE >>> 0;
		digits = '' + (t - BASE * low);

		if (low === 0 && high === 0) {
			return sign + digits + result;
		}

		pad = '';
		l = 6 - digits.length;

		for (i = 0; i < l; i++) {
			pad += '0';
		}

		result = pad + digits + result;
	}

	{
		carry = high % BASE;
		t = 0x100000000 * carry + low;
		digits = '' + t % BASE;

		return sign + digits + result;
	}
}

module.exports = readInt8;


/***/ }),

/***/ 2041:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {


const EventEmitter = (__nccwpck_require__(4434).EventEmitter)

const NOOP = function () {}

const removeWhere = (list, predicate) => {
  const i = list.findIndex(predicate)

  return i === -1 ? undefined : list.splice(i, 1)[0]
}

class IdleItem {
  constructor(client, idleListener, timeoutId) {
    this.client = client
    this.idleListener = idleListener
    this.timeoutId = timeoutId
  }
}

class PendingItem {
  constructor(callback) {
    this.callback = callback
  }
}

function throwOnDoubleRelease() {
  throw new Error('Release called on client which has already been released to the pool.')
}

function promisify(Promise, callback) {
  if (callback) {
    return { callback: callback, result: undefined }
  }
  let rej
  let res
  const cb = function (err, client) {
    err ? rej(err) : res(client)
  }
  const result = new Promise(function (resolve, reject) {
    res = resolve
    rej = reject
  }).catch((err) => {
    // replace the stack trace that leads to `TCP.onStreamRead` with one that leads back to the
    // application that created the query
    Error.captureStackTrace(err)
    throw err
  })
  return { callback: cb, result: result }
}

function makeIdleListener(pool, client) {
  return function idleListener(err) {
    err.client = client

    client.removeListener('error', idleListener)
    client.on('error', () => {
      pool.log('additional client error after disconnection due to error', err)
    })
    pool._remove(client)
    // TODO - document that once the pool emits an error
    // the client has already been closed & purged and is unusable
    pool.emit('error', err, client)
  }
}

class Pool extends EventEmitter {
  constructor(options, Client) {
    super()
    this.options = Object.assign({}, options)

    if (options != null && 'password' in options) {
      // "hiding" the password so it doesn't show up in stack traces
      // or if the client is console.logged
      Object.defineProperty(this.options, 'password', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: options.password,
      })
    }
    if (options != null && options.ssl && options.ssl.key) {
      // "hiding" the ssl->key so it doesn't show up in stack traces
      // or if the client is console.logged
      Object.defineProperty(this.options.ssl, 'key', {
        enumerable: false,
      })
    }

    this.options.max = this.options.max || this.options.poolSize || 10
    this.options.min = this.options.min || 0
    this.options.maxUses = this.options.maxUses || Infinity
    this.options.allowExitOnIdle = this.options.allowExitOnIdle || false
    this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0
    this.log = this.options.log || function () {}
    this.Client = this.options.Client || Client || (__nccwpck_require__(5264).Client)
    this.Promise = this.options.Promise || global.Promise

    if (typeof this.options.idleTimeoutMillis === 'undefined') {
      this.options.idleTimeoutMillis = 10000
    }

    this._clients = []
    this._idle = []
    this._expired = new WeakSet()
    this._pendingQueue = []
    this._endCallback = undefined
    this.ending = false
    this.ended = false
  }

  _promiseTry(f) {
    const Promise = this.Promise
    if (typeof Promise.try === 'function') {
      return Promise.try(f)
    }
    return new Promise((resolve) => resolve(f()))
  }

  _isFull() {
    return this._clients.length >= this.options.max
  }

  _isAboveMin() {
    return this._clients.length > this.options.min
  }

  _pulseQueue() {
    this.log('pulse queue')
    if (this.ended) {
      this.log('pulse queue ended')
      return
    }
    if (this.ending) {
      this.log('pulse queue on ending')
      if (this._idle.length) {
        this._idle.slice().map((item) => {
          this._remove(item.client)
        })
      }
      if (!this._clients.length) {
        this.ended = true
        this._endCallback()
      }
      return
    }

    // if we don't have any waiting, do nothing
    if (!this._pendingQueue.length) {
      this.log('no queued requests')
      return
    }
    // if we don't have any idle clients and we have no more room do nothing
    if (!this._idle.length && this._isFull()) {
      return
    }
    const pendingItem = this._pendingQueue.shift()
    if (this._idle.length) {
      const idleItem = this._idle.pop()
      clearTimeout(idleItem.timeoutId)
      const client = idleItem.client
      client.ref && client.ref()
      const idleListener = idleItem.idleListener

      return this._acquireClient(client, pendingItem, idleListener, false)
    }
    if (!this._isFull()) {
      return this.newClient(pendingItem)
    }
    throw new Error('unexpected condition')
  }

  _remove(client, callback) {
    const removed = removeWhere(this._idle, (item) => item.client === client)

    if (removed !== undefined) {
      clearTimeout(removed.timeoutId)
    }

    this._clients = this._clients.filter((c) => c !== client)
    const context = this
    client.end(() => {
      context.emit('remove', client)

      if (typeof callback === 'function') {
        callback()
      }
    })
  }

  connect(cb) {
    if (this.ending) {
      const err = new Error('Cannot use a pool after calling end on the pool')
      return cb ? cb(err) : this.Promise.reject(err)
    }

    const response = promisify(this.Promise, cb)
    const result = response.result

    // if we don't have to connect a new client, don't do so
    if (this._isFull() || this._idle.length) {
      // if we have idle clients schedule a pulse immediately
      if (this._idle.length) {
        process.nextTick(() => this._pulseQueue())
      }

      if (!this.options.connectionTimeoutMillis) {
        this._pendingQueue.push(new PendingItem(response.callback))
        return result
      }

      const queueCallback = (err, res, done) => {
        clearTimeout(tid)
        response.callback(err, res, done)
      }

      const pendingItem = new PendingItem(queueCallback)

      // set connection timeout on checking out an existing client
      const tid = setTimeout(() => {
        // remove the callback from pending waiters because
        // we're going to call it with a timeout error
        removeWhere(this._pendingQueue, (i) => i.callback === queueCallback)
        pendingItem.timedOut = true
        response.callback(new Error('timeout exceeded when trying to connect'))
      }, this.options.connectionTimeoutMillis)

      if (tid.unref) {
        tid.unref()
      }

      this._pendingQueue.push(pendingItem)
      return result
    }

    this.newClient(new PendingItem(response.callback))

    return result
  }

  newClient(pendingItem) {
    const client = new this.Client(this.options)
    this._clients.push(client)
    const idleListener = makeIdleListener(this, client)

    this.log('checking client timeout')

    // connection timeout logic
    let tid
    let timeoutHit = false
    if (this.options.connectionTimeoutMillis) {
      tid = setTimeout(() => {
        if (client.connection) {
          this.log('ending client due to timeout')
          timeoutHit = true
          client.connection.stream.destroy()
        } else if (!client.isConnected()) {
          this.log('ending client due to timeout')
          timeoutHit = true
          // force kill the node driver, and let libpq do its teardown
          client.end()
        }
      }, this.options.connectionTimeoutMillis)
    }

    this.log('connecting new client')
    client.connect((err) => {
      if (tid) {
        clearTimeout(tid)
      }
      client.on('error', idleListener)
      if (err) {
        this.log('client failed to connect', err)
        // remove the dead client from our list of clients
        this._clients = this._clients.filter((c) => c !== client)
        if (timeoutHit) {
          err = new Error('Connection terminated due to connection timeout', { cause: err })
        }

        // this client won’t be released, so move on immediately
        this._pulseQueue()

        if (!pendingItem.timedOut) {
          pendingItem.callback(err, undefined, NOOP)
        }
      } else {
        this.log('new client connected')

        if (this.options.onConnect) {
          this._promiseTry(() => this.options.onConnect(client)).then(
            () => {
              this._afterConnect(client, pendingItem, idleListener)
            },
            (hookErr) => {
              this._clients = this._clients.filter((c) => c !== client)
              client.end(() => {
                this._pulseQueue()
                if (!pendingItem.timedOut) {
                  pendingItem.callback(hookErr, undefined, NOOP)
                }
              })
            }
          )
          return
        }

        return this._afterConnect(client, pendingItem, idleListener)
      }
    })
  }

  _afterConnect(client, pendingItem, idleListener) {
    if (this.options.maxLifetimeSeconds !== 0) {
      const maxLifetimeTimeout = setTimeout(() => {
        this.log('ending client due to expired lifetime')
        this._expired.add(client)
        const idleIndex = this._idle.findIndex((idleItem) => idleItem.client === client)
        if (idleIndex !== -1) {
          this._acquireClient(
            client,
            new PendingItem((err, client, clientRelease) => clientRelease()),
            idleListener,
            false
          )
        }
      }, this.options.maxLifetimeSeconds * 1000)

      maxLifetimeTimeout.unref()
      client.once('end', () => clearTimeout(maxLifetimeTimeout))
    }

    return this._acquireClient(client, pendingItem, idleListener, true)
  }

  // acquire a client for a pending work item
  _acquireClient(client, pendingItem, idleListener, isNew) {
    if (isNew) {
      this.emit('connect', client)
    }

    this.emit('acquire', client)

    client.release = this._releaseOnce(client, idleListener)

    client.removeListener('error', idleListener)

    if (!pendingItem.timedOut) {
      if (isNew && this.options.verify) {
        this.options.verify(client, (err) => {
          if (err) {
            client.release(err)
            return pendingItem.callback(err, undefined, NOOP)
          }

          pendingItem.callback(undefined, client, client.release)
        })
      } else {
        pendingItem.callback(undefined, client, client.release)
      }
    } else {
      if (isNew && this.options.verify) {
        this.options.verify(client, client.release)
      } else {
        client.release()
      }
    }
  }

  // returns a function that wraps _release and throws if called more than once
  _releaseOnce(client, idleListener) {
    let released = false

    return (err) => {
      if (released) {
        throwOnDoubleRelease()
      }

      released = true
      this._release(client, idleListener, err)
    }
  }

  // release a client back to the poll, include an error
  // to remove it from the pool
  _release(client, idleListener, err) {
    client.on('error', idleListener)

    client._poolUseCount = (client._poolUseCount || 0) + 1

    this.emit('release', err, client)

    // TODO(bmc): expose a proper, public interface _queryable and _ending
    if (err || this.ending || !client._queryable || client._ending || client._poolUseCount >= this.options.maxUses) {
      if (client._poolUseCount >= this.options.maxUses) {
        this.log('remove expended client')
      }

      return this._remove(client, this._pulseQueue.bind(this))
    }

    const isExpired = this._expired.has(client)
    if (isExpired) {
      this.log('remove expired client')
      this._expired.delete(client)
      return this._remove(client, this._pulseQueue.bind(this))
    }

    // idle timeout
    let tid
    if (this.options.idleTimeoutMillis && this._isAboveMin()) {
      tid = setTimeout(() => {
        if (this._isAboveMin()) {
          this.log('remove idle client')
          this._remove(client, this._pulseQueue.bind(this))
        }
      }, this.options.idleTimeoutMillis)

      if (this.options.allowExitOnIdle) {
        // allow Node to exit if this is all that's left
        tid.unref()
      }
    }

    if (this.options.allowExitOnIdle) {
      client.unref()
    }

    this._idle.push(new IdleItem(client, idleListener, tid))
    this._pulseQueue()
  }

  query(text, values, cb) {
    // guard clause against passing a function as the first parameter
    if (typeof text === 'function') {
      const response = promisify(this.Promise, text)
      setImmediate(function () {
        return response.callback(new Error('Passing a function as the first parameter to pool.query is not supported'))
      })
      return response.result
    }

    // allow plain text query without values, but callback
    if (typeof values === 'function') {
      cb = values
      values = undefined
    }
    const response = promisify(this.Promise, cb)
    cb = response.callback

    this.connect((err, client) => {
      if (err) {
        return cb(err)
      }

      let clientReleased = false
      const onError = (err) => {
        if (clientReleased) {
          return
        }
        clientReleased = true
        client.release(err)
        cb(err)
      }

      client.once('error', onError)
      this.log('dispatching query')
      try {
        client.query(text, values, (err, res) => {
          this.log('query dispatched')
          client.removeListener('error', onError)
          if (clientReleased) {
            return
          }
          clientReleased = true
          client.release(err)
          if (err) {
            return cb(err)
          }
          return cb(undefined, res)
        })
      } catch (err) {
        client.release(err)
        return cb(err)
      }
    })
    return response.result
  }

  end(cb) {
    this.log('ending')
    if (this.ending) {
      const err = new Error('Called end on pool more than once')
      return cb ? cb(err) : this.Promise.reject(err)
    }
    this.ending = true
    const promised = promisify(this.Promise, cb)
    this._endCallback = promised.callback
    this._pulseQueue()
    return promised.result
  }

  get waitingCount() {
    return this._pendingQueue.length
  }

  get idleCount() {
    return this._idle.length
  }

  get expiredCount() {
    return this._clients.reduce((acc, client) => acc + (this._expired.has(client) ? 1 : 0), 0)
  }

  get totalCount() {
    return this._clients.length
  }
}
module.exports = Pool


/***/ }),

/***/ 2950:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BufferReader = void 0;
class BufferReader {
    constructor(offset = 0) {
        this.offset = offset;
        this.buffer = Buffer.allocUnsafe(0);
        // TODO(bmc): support non-utf8 encoding?
        this.encoding = 'utf-8';
    }
    setBuffer(offset, buffer) {
        this.offset = offset;
        this.buffer = buffer;
    }
    int16() {
        const result = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return result;
    }
    byte() {
        const result = this.buffer[this.offset];
        this.offset++;
        return result;
    }
    int32() {
        const result = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return result;
    }
    uint32() {
        const result = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return result;
    }
    string(length) {
        const result = this.buffer.toString(this.encoding, this.offset, this.offset + length);
        this.offset += length;
        return result;
    }
    cstring() {
        const start = this.offset;
        let end = start;
        // eslint-disable-next-line no-empty
        while (this.buffer[end++]) { }
        this.offset = end;
        return this.buffer.toString(this.encoding, start, end - 1);
    }
    bytes(length) {
        const result = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
    }
}
exports.BufferReader = BufferReader;
//# sourceMappingURL=buffer-reader.js.map

/***/ }),

/***/ 5590:
/***/ ((__unused_webpack_module, exports) => {


//binary data writer tuned for encoding binary specific to the postgres binary protocol
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Writer = void 0;
class Writer {
    constructor(size = 256) {
        this.size = size;
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(size);
    }
    ensure(size) {
        const remaining = this.buffer.length - this.offset;
        if (remaining < size) {
            const oldBuffer = this.buffer;
            // exponential growth factor of around ~ 1.5
            // https://stackoverflow.com/questions/2269063/buffer-growth-strategy
            const newSize = oldBuffer.length + (oldBuffer.length >> 1) + size;
            this.buffer = Buffer.allocUnsafe(newSize);
            oldBuffer.copy(this.buffer);
        }
    }
    addInt32(num) {
        this.ensure(4);
        this.buffer[this.offset++] = (num >>> 24) & 0xff;
        this.buffer[this.offset++] = (num >>> 16) & 0xff;
        this.buffer[this.offset++] = (num >>> 8) & 0xff;
        this.buffer[this.offset++] = (num >>> 0) & 0xff;
        return this;
    }
    addInt16(num) {
        this.ensure(2);
        this.buffer[this.offset++] = (num >>> 8) & 0xff;
        this.buffer[this.offset++] = (num >>> 0) & 0xff;
        return this;
    }
    addCString(string) {
        if (!string) {
            this.ensure(1);
        }
        else {
            const len = Buffer.byteLength(string);
            this.ensure(len + 1); // +1 for null terminator
            this.buffer.write(string, this.offset, 'utf-8');
            this.offset += len;
        }
        this.buffer[this.offset++] = 0; // null terminator
        return this;
    }
    addString(string = '') {
        const len = Buffer.byteLength(string);
        this.ensure(len);
        this.buffer.write(string, this.offset);
        this.offset += len;
        return this;
    }
    // Write an Int32 byte-length prefix immediately followed by the string's UTF-8
    // bytes. Postgres' Bind wire format prefixes every parameter with its length,
    // and doing it in one method computes Buffer.byteLength ONCE — the previous
    // `addInt32(Buffer.byteLength(s)).addString(s)` pairing scanned the string
    // three times (byteLength for the prefix, byteLength again inside addString,
    // then the encode), which is costly for large text parameters.
    addInt32PrefixedString(string) {
        const len = Buffer.byteLength(string);
        this.ensure(4 + len);
        const buffer = this.buffer;
        let offset = this.offset;
        buffer[offset++] = (len >>> 24) & 0xff;
        buffer[offset++] = (len >>> 16) & 0xff;
        buffer[offset++] = (len >>> 8) & 0xff;
        buffer[offset++] = (len >>> 0) & 0xff;
        buffer.write(string, offset, 'utf-8');
        this.offset = offset + len;
        return this;
    }
    add(otherBuffer) {
        this.ensure(otherBuffer.length);
        otherBuffer.copy(this.buffer, this.offset);
        this.offset += otherBuffer.length;
        return this;
    }
    join(code) {
        if (code) {
            this.buffer[this.headerPosition] = code;
            //length is everything in this packet minus the code
            const length = this.offset - (this.headerPosition + 1);
            this.buffer.writeInt32BE(length, this.headerPosition + 1);
        }
        return this.buffer.slice(code ? 0 : 5, this.offset);
    }
    flush(code) {
        const result = this.join(code);
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(this.size);
        return result;
    }
    clear() {
        this.offset = 5;
        this.headerPosition = 0;
    }
}
exports.Writer = Writer;
//# sourceMappingURL=buffer-writer.js.map

/***/ }),

/***/ 8016:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DatabaseError = exports.serialize = void 0;
exports.parse = parse;
const messages_1 = __nccwpck_require__(6694);
Object.defineProperty(exports, "DatabaseError", ({ enumerable: true, get: function () { return messages_1.DatabaseError; } }));
const serializer_1 = __nccwpck_require__(6378);
Object.defineProperty(exports, "serialize", ({ enumerable: true, get: function () { return serializer_1.serialize; } }));
const parser_1 = __nccwpck_require__(7701);
function parse(stream, callback) {
    const parser = new parser_1.Parser();
    stream.on('data', (buffer) => parser.parse(buffer, callback));
    return new Promise((resolve) => stream.on('end', () => resolve()));
}
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 6694:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NoticeMessage = exports.DataRowMessage = exports.CommandCompleteMessage = exports.ReadyForQueryMessage = exports.NotificationResponseMessage = exports.BackendKeyDataMessage = exports.AuthenticationMD5Password = exports.ParameterStatusMessage = exports.ParameterDescriptionMessage = exports.RowDescriptionMessage = exports.Field = exports.CopyResponse = exports.CopyDataMessage = exports.DatabaseError = exports.copyDone = exports.emptyQuery = exports.replicationStart = exports.portalSuspended = exports.noData = exports.closeComplete = exports.bindComplete = exports.parseComplete = void 0;
exports.parseComplete = {
    name: 'parseComplete',
    length: 5,
};
exports.bindComplete = {
    name: 'bindComplete',
    length: 5,
};
exports.closeComplete = {
    name: 'closeComplete',
    length: 5,
};
exports.noData = {
    name: 'noData',
    length: 5,
};
exports.portalSuspended = {
    name: 'portalSuspended',
    length: 5,
};
exports.replicationStart = {
    name: 'replicationStart',
    length: 4,
};
exports.emptyQuery = {
    name: 'emptyQuery',
    length: 4,
};
exports.copyDone = {
    name: 'copyDone',
    length: 4,
};
class DatabaseError extends Error {
    constructor(message, length, name) {
        super(message);
        this.length = length;
        this.name = name;
    }
}
exports.DatabaseError = DatabaseError;
class CopyDataMessage {
    constructor(length, chunk) {
        this.length = length;
        this.chunk = chunk;
        this.name = 'copyData';
    }
}
exports.CopyDataMessage = CopyDataMessage;
class CopyResponse {
    constructor(length, name, binary, columnCount) {
        this.length = length;
        this.name = name;
        this.binary = binary;
        this.columnTypes = new Array(columnCount);
    }
}
exports.CopyResponse = CopyResponse;
class Field {
    constructor(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, format) {
        this.name = name;
        this.tableID = tableID;
        this.columnID = columnID;
        this.dataTypeID = dataTypeID;
        this.dataTypeSize = dataTypeSize;
        this.dataTypeModifier = dataTypeModifier;
        this.format = format;
    }
}
exports.Field = Field;
class RowDescriptionMessage {
    constructor(length, fieldCount) {
        this.length = length;
        this.fieldCount = fieldCount;
        this.name = 'rowDescription';
        this.fields = new Array(this.fieldCount);
    }
}
exports.RowDescriptionMessage = RowDescriptionMessage;
class ParameterDescriptionMessage {
    constructor(length, parameterCount) {
        this.length = length;
        this.parameterCount = parameterCount;
        this.name = 'parameterDescription';
        this.dataTypeIDs = new Array(this.parameterCount);
    }
}
exports.ParameterDescriptionMessage = ParameterDescriptionMessage;
class ParameterStatusMessage {
    constructor(length, parameterName, parameterValue) {
        this.length = length;
        this.parameterName = parameterName;
        this.parameterValue = parameterValue;
        this.name = 'parameterStatus';
    }
}
exports.ParameterStatusMessage = ParameterStatusMessage;
class AuthenticationMD5Password {
    constructor(length, salt) {
        this.length = length;
        this.salt = salt;
        this.name = 'authenticationMD5Password';
    }
}
exports.AuthenticationMD5Password = AuthenticationMD5Password;
class BackendKeyDataMessage {
    constructor(length, processID, secretKey) {
        this.length = length;
        this.processID = processID;
        this.secretKey = secretKey;
        this.name = 'backendKeyData';
    }
}
exports.BackendKeyDataMessage = BackendKeyDataMessage;
class NotificationResponseMessage {
    constructor(length, processId, channel, payload) {
        this.length = length;
        this.processId = processId;
        this.channel = channel;
        this.payload = payload;
        this.name = 'notification';
    }
}
exports.NotificationResponseMessage = NotificationResponseMessage;
class ReadyForQueryMessage {
    constructor(length, status) {
        this.length = length;
        this.status = status;
        this.name = 'readyForQuery';
    }
}
exports.ReadyForQueryMessage = ReadyForQueryMessage;
class CommandCompleteMessage {
    constructor(length, text) {
        this.length = length;
        this.text = text;
        this.name = 'commandComplete';
    }
}
exports.CommandCompleteMessage = CommandCompleteMessage;
class DataRowMessage {
    constructor(length, fields) {
        this.length = length;
        this.fields = fields;
        this.name = 'dataRow';
        this.fieldCount = fields.length;
    }
}
exports.DataRowMessage = DataRowMessage;
class NoticeMessage {
    constructor(length, message) {
        this.length = length;
        this.message = message;
        this.name = 'notice';
    }
}
exports.NoticeMessage = NoticeMessage;
//# sourceMappingURL=messages.js.map

/***/ }),

/***/ 7701:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Parser = void 0;
const messages_1 = __nccwpck_require__(6694);
const buffer_reader_1 = __nccwpck_require__(2950);
// every message is prefixed with a single byte
const CODE_LENGTH = 1;
// every message has an int32 length which includes itself but does
// NOT include the code in the length
const LEN_LENGTH = 4;
const HEADER_LENGTH = CODE_LENGTH + LEN_LENGTH;
// A placeholder for a `BackendMessage`’s length value that will be set after construction.
const LATEINIT_LENGTH = -1;
const emptyBuffer = Buffer.allocUnsafe(0);
class Parser {
    constructor(opts) {
        this.buffer = emptyBuffer;
        this.bufferLength = 0;
        this.bufferOffset = 0;
        this.reader = new buffer_reader_1.BufferReader();
        if ((opts === null || opts === void 0 ? void 0 : opts.mode) === 'binary') {
            throw new Error('Binary mode not supported yet');
        }
        this.mode = (opts === null || opts === void 0 ? void 0 : opts.mode) || 'text';
    }
    parse(buffer, callback) {
        this.mergeBuffer(buffer);
        const bufferFullLength = this.bufferOffset + this.bufferLength;
        let offset = this.bufferOffset;
        while (offset + HEADER_LENGTH <= bufferFullLength) {
            // code is 1 byte long - it identifies the message type
            const code = this.buffer[offset];
            // length is 1 Uint32BE - it is the length of the message EXCLUDING the code
            const length = this.buffer.readUInt32BE(offset + CODE_LENGTH);
            const fullMessageLength = CODE_LENGTH + length;
            if (fullMessageLength + offset <= bufferFullLength) {
                const message = this.handlePacket(offset + HEADER_LENGTH, code, length, this.buffer);
                callback(message);
                offset += fullMessageLength;
            }
            else {
                break;
            }
        }
        if (offset === bufferFullLength) {
            // No more use for the buffer
            this.buffer = emptyBuffer;
            this.bufferLength = 0;
            this.bufferOffset = 0;
        }
        else {
            // Adjust the cursors of remainingBuffer
            this.bufferLength = bufferFullLength - offset;
            this.bufferOffset = offset;
        }
    }
    mergeBuffer(buffer) {
        if (this.bufferLength > 0) {
            const newLength = this.bufferLength + buffer.byteLength;
            const newFullLength = newLength + this.bufferOffset;
            if (newFullLength > this.buffer.byteLength) {
                // We can't concat the new buffer with the remaining one
                let newBuffer;
                if (newLength <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) {
                    // We can move the relevant part to the beginning of the buffer instead of allocating a new buffer
                    newBuffer = this.buffer;
                }
                else {
                    // Allocate a new larger buffer
                    let newBufferLength = this.buffer.byteLength * 2;
                    while (newLength >= newBufferLength) {
                        newBufferLength *= 2;
                    }
                    newBuffer = Buffer.allocUnsafe(newBufferLength);
                }
                // Move the remaining buffer to the new one
                this.buffer.copy(newBuffer, 0, this.bufferOffset, this.bufferOffset + this.bufferLength);
                this.buffer = newBuffer;
                this.bufferOffset = 0;
            }
            // Concat the new buffer with the remaining one
            buffer.copy(this.buffer, this.bufferOffset + this.bufferLength);
            this.bufferLength = newLength;
        }
        else {
            this.buffer = buffer;
            this.bufferOffset = 0;
            this.bufferLength = buffer.byteLength;
        }
    }
    handlePacket(offset, code, length, bytes) {
        const { reader } = this;
        // NOTE: This undesirably retains the buffer in `this.reader` if the `parse*Message` calls below throw. However, those should only throw in the case of a protocol error, which normally results in the reader being discarded.
        reader.setBuffer(offset, bytes);
        let message;
        switch (code) {
            case 50 /* MessageCodes.BindComplete */:
                message = messages_1.bindComplete;
                break;
            case 49 /* MessageCodes.ParseComplete */:
                message = messages_1.parseComplete;
                break;
            case 51 /* MessageCodes.CloseComplete */:
                message = messages_1.closeComplete;
                break;
            case 110 /* MessageCodes.NoData */:
                message = messages_1.noData;
                break;
            case 115 /* MessageCodes.PortalSuspended */:
                message = messages_1.portalSuspended;
                break;
            case 99 /* MessageCodes.CopyDone */:
                message = messages_1.copyDone;
                break;
            case 87 /* MessageCodes.ReplicationStart */:
                message = messages_1.replicationStart;
                break;
            case 73 /* MessageCodes.EmptyQuery */:
                message = messages_1.emptyQuery;
                break;
            case 68 /* MessageCodes.DataRow */:
                message = parseDataRowMessage(reader);
                break;
            case 67 /* MessageCodes.CommandComplete */:
                message = parseCommandCompleteMessage(reader);
                break;
            case 90 /* MessageCodes.ReadyForQuery */:
                message = parseReadyForQueryMessage(reader);
                break;
            case 65 /* MessageCodes.NotificationResponse */:
                message = parseNotificationMessage(reader);
                break;
            case 82 /* MessageCodes.AuthenticationResponse */:
                message = parseAuthenticationResponse(reader, length);
                break;
            case 83 /* MessageCodes.ParameterStatus */:
                message = parseParameterStatusMessage(reader);
                break;
            case 75 /* MessageCodes.BackendKeyData */:
                message = parseBackendKeyData(reader);
                break;
            case 69 /* MessageCodes.ErrorMessage */:
                message = parseErrorMessage(reader, 'error');
                break;
            case 78 /* MessageCodes.NoticeMessage */:
                message = parseErrorMessage(reader, 'notice');
                break;
            case 84 /* MessageCodes.RowDescriptionMessage */:
                message = parseRowDescriptionMessage(reader);
                break;
            case 116 /* MessageCodes.ParameterDescriptionMessage */:
                message = parseParameterDescriptionMessage(reader);
                break;
            case 71 /* MessageCodes.CopyIn */:
                message = parseCopyInMessage(reader);
                break;
            case 72 /* MessageCodes.CopyOut */:
                message = parseCopyOutMessage(reader);
                break;
            case 100 /* MessageCodes.CopyData */:
                message = parseCopyData(reader, length);
                break;
            default:
                return new messages_1.DatabaseError('received invalid response: ' + code.toString(16), length, 'error');
        }
        reader.setBuffer(0, emptyBuffer);
        message.length = length;
        return message;
    }
}
exports.Parser = Parser;
const parseReadyForQueryMessage = (reader) => {
    const status = reader.string(1);
    return new messages_1.ReadyForQueryMessage(LATEINIT_LENGTH, status);
};
const parseCommandCompleteMessage = (reader) => {
    const text = reader.cstring();
    return new messages_1.CommandCompleteMessage(LATEINIT_LENGTH, text);
};
const parseCopyData = (reader, length) => {
    const chunk = reader.bytes(length - 4);
    return new messages_1.CopyDataMessage(LATEINIT_LENGTH, chunk);
};
const parseCopyInMessage = (reader) => parseCopyMessage(reader, 'copyInResponse');
const parseCopyOutMessage = (reader) => parseCopyMessage(reader, 'copyOutResponse');
const parseCopyMessage = (reader, messageName) => {
    const isBinary = reader.byte() !== 0;
    const columnCount = reader.int16();
    const message = new messages_1.CopyResponse(LATEINIT_LENGTH, messageName, isBinary, columnCount);
    for (let i = 0; i < columnCount; i++) {
        message.columnTypes[i] = reader.int16();
    }
    return message;
};
const parseNotificationMessage = (reader) => {
    const processId = reader.int32();
    const channel = reader.cstring();
    const payload = reader.cstring();
    return new messages_1.NotificationResponseMessage(LATEINIT_LENGTH, processId, channel, payload);
};
const parseRowDescriptionMessage = (reader) => {
    const fieldCount = reader.int16();
    const message = new messages_1.RowDescriptionMessage(LATEINIT_LENGTH, fieldCount);
    for (let i = 0; i < fieldCount; i++) {
        message.fields[i] = parseField(reader);
    }
    return message;
};
const parseField = (reader) => {
    const name = reader.cstring();
    const tableID = reader.uint32();
    const columnID = reader.int16();
    const dataTypeID = reader.uint32();
    const dataTypeSize = reader.int16();
    const dataTypeModifier = reader.int32();
    const mode = reader.int16() === 0 ? 'text' : 'binary';
    return new messages_1.Field(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, mode);
};
const parseParameterDescriptionMessage = (reader) => {
    const parameterCount = reader.int16();
    const message = new messages_1.ParameterDescriptionMessage(LATEINIT_LENGTH, parameterCount);
    for (let i = 0; i < parameterCount; i++) {
        // OIDs are unsigned, same as dataTypeID in parseField above
        message.dataTypeIDs[i] = reader.uint32();
    }
    return message;
};
const parseDataRowMessage = (reader) => {
    const fieldCount = reader.int16();
    const fields = new Array(fieldCount);
    for (let i = 0; i < fieldCount; i++) {
        const len = reader.int32();
        // a -1 for length means the value of the field is null
        fields[i] = len === -1 ? null : reader.string(len);
    }
    return new messages_1.DataRowMessage(LATEINIT_LENGTH, fields);
};
const parseParameterStatusMessage = (reader) => {
    const name = reader.cstring();
    const value = reader.cstring();
    return new messages_1.ParameterStatusMessage(LATEINIT_LENGTH, name, value);
};
const parseBackendKeyData = (reader) => {
    const processID = reader.int32();
    const secretKey = reader.int32();
    return new messages_1.BackendKeyDataMessage(LATEINIT_LENGTH, processID, secretKey);
};
const parseAuthenticationResponse = (reader, length) => {
    const code = reader.int32();
    // TODO(bmc): maybe better types here
    const message = {
        name: 'authenticationOk',
        length,
    };
    switch (code) {
        case 0: // AuthenticationOk
            break;
        case 3: // AuthenticationCleartextPassword
            if (message.length === 8) {
                message.name = 'authenticationCleartextPassword';
            }
            break;
        case 5: // AuthenticationMD5Password
            if (message.length === 12) {
                message.name = 'authenticationMD5Password';
                const salt = reader.bytes(4);
                return new messages_1.AuthenticationMD5Password(LATEINIT_LENGTH, salt);
            }
            break;
        case 10: // AuthenticationSASL
            {
                message.name = 'authenticationSASL';
                message.mechanisms = [];
                let mechanism;
                do {
                    mechanism = reader.cstring();
                    if (mechanism) {
                        message.mechanisms.push(mechanism);
                    }
                } while (mechanism);
            }
            break;
        case 11: // AuthenticationSASLContinue
            message.name = 'authenticationSASLContinue';
            message.data = reader.string(length - 8);
            break;
        case 12: // AuthenticationSASLFinal
            message.name = 'authenticationSASLFinal';
            message.data = reader.string(length - 8);
            break;
        default:
            throw new Error('Unknown authenticationOk message type ' + code);
    }
    return message;
};
const parseErrorMessage = (reader, name) => {
    const fields = {};
    let fieldType = reader.string(1);
    while (fieldType !== '\0') {
        fields[fieldType] = reader.cstring();
        fieldType = reader.string(1);
    }
    const messageValue = fields.M;
    const message = name === 'notice'
        ? new messages_1.NoticeMessage(LATEINIT_LENGTH, messageValue)
        : new messages_1.DatabaseError(messageValue, LATEINIT_LENGTH, name);
    message.severity = fields.S;
    message.code = fields.C;
    message.detail = fields.D;
    message.hint = fields.H;
    message.position = fields.P;
    message.internalPosition = fields.p;
    message.internalQuery = fields.q;
    message.where = fields.W;
    message.schema = fields.s;
    message.table = fields.t;
    message.column = fields.c;
    message.dataType = fields.d;
    message.constraint = fields.n;
    message.file = fields.F;
    message.line = fields.L;
    message.routine = fields.R;
    return message;
};
//# sourceMappingURL=parser.js.map

/***/ }),

/***/ 6378:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.serialize = void 0;
const buffer_writer_1 = __nccwpck_require__(5590);
const writer = new buffer_writer_1.Writer();
const startup = (opts) => {
    // protocol version
    writer.addInt16(3).addInt16(0);
    for (const key of Object.keys(opts)) {
        writer.addCString(key).addCString(opts[key]);
    }
    writer.addCString('client_encoding').addCString('UTF8');
    const bodyBuffer = writer.addCString('').flush();
    // this message is sent without a code
    const length = bodyBuffer.length + 4;
    return new buffer_writer_1.Writer().addInt32(length).add(bodyBuffer).flush();
};
const requestSsl = () => {
    const response = Buffer.allocUnsafe(8);
    response.writeInt32BE(8, 0);
    response.writeInt32BE(80877103, 4);
    return response;
};
const password = (password) => {
    return writer.addCString(password).flush(112 /* code.startup */);
};
const sendSASLInitialResponseMessage = function (mechanism, initialResponse) {
    // 0x70 = 'p'
    writer.addCString(mechanism).addInt32PrefixedString(initialResponse);
    return writer.flush(112 /* code.startup */);
};
const sendSCRAMClientFinalMessage = function (additionalData) {
    return writer.addString(additionalData).flush(112 /* code.startup */);
};
const query = (text) => {
    return writer.addCString(text).flush(81 /* code.query */);
};
const emptyArray = [];
const parse = (query) => {
    // expect something like this:
    // { name: 'queryName',
    //   text: 'select * from blah',
    //   types: ['int8', 'bool'] }
    // normalize missing query names to allow for null
    const name = query.name || '';
    if (name.length > 63) {
        console.error('Warning! Postgres only supports 63 characters for query names.');
        console.error('You supplied %s (%s)', name, name.length);
        console.error('This can cause conflicts and silent errors executing queries');
    }
    const types = query.types || emptyArray;
    const len = types.length;
    const buffer = writer
        .addCString(name) // name of query
        .addCString(query.text) // actual query text
        .addInt16(len);
    for (let i = 0; i < len; i++) {
        buffer.addInt32(types[i]);
    }
    return writer.flush(80 /* code.parse */);
};
const paramWriter = new buffer_writer_1.Writer();
const writeValues = function (values, valueMapper) {
    for (let i = 0; i < values.length; i++) {
        const mappedVal = valueMapper ? valueMapper(values[i], i) : values[i];
        if (mappedVal == null) {
            // add the param type (string) to the writer
            writer.addInt16(0 /* ParamType.STRING */);
            // write -1 to the param writer to indicate null
            paramWriter.addInt32(-1);
        }
        else if (mappedVal instanceof Buffer) {
            // add the param type (binary) to the writer
            writer.addInt16(1 /* ParamType.BINARY */);
            // add the buffer to the param writer
            paramWriter.addInt32(mappedVal.length);
            paramWriter.add(mappedVal);
        }
        else {
            // add the param type (string) to the writer
            writer.addInt16(0 /* ParamType.STRING */);
            // length prefix + UTF-8 bytes in one pass (Buffer.byteLength computed once)
            paramWriter.addInt32PrefixedString(mappedVal);
        }
    }
};
const bind = (config = {}) => {
    // normalize config
    const portal = config.portal || '';
    const statement = config.statement || '';
    const binary = config.binary || false;
    const values = config.values || emptyArray;
    const len = values.length;
    writer.addCString(portal).addCString(statement);
    writer.addInt16(len);
    try {
        writeValues(values, config.valueMapper);
    }
    catch (err) {
        writer.clear();
        paramWriter.clear();
        throw err;
    }
    writer.addInt16(len);
    writer.add(paramWriter.flush());
    // all results use the same format code
    writer.addInt16(1);
    // format code
    writer.addInt16(binary ? 1 /* ParamType.BINARY */ : 0 /* ParamType.STRING */);
    return writer.flush(66 /* code.bind */);
};
const emptyExecute = Buffer.from([69 /* code.execute */, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00, 0x00]);
const execute = (config) => {
    // this is the happy path for most queries
    if (!config || (!config.portal && !config.rows)) {
        return emptyExecute;
    }
    const portal = config.portal || '';
    const rows = config.rows || 0;
    const portalLength = Buffer.byteLength(portal);
    const len = 4 + portalLength + 1 + 4;
    // one extra bit for code
    const buff = Buffer.allocUnsafe(1 + len);
    buff[0] = 69 /* code.execute */;
    buff.writeInt32BE(len, 1);
    buff.write(portal, 5, 'utf-8');
    buff[portalLength + 5] = 0; // null terminate portal cString
    buff.writeUInt32BE(rows, buff.length - 4);
    return buff;
};
const cancel = (processID, secretKey) => {
    const buffer = Buffer.allocUnsafe(16);
    buffer.writeInt32BE(16, 0);
    buffer.writeInt16BE(1234, 4);
    buffer.writeInt16BE(5678, 6);
    buffer.writeInt32BE(processID, 8);
    buffer.writeInt32BE(secretKey, 12);
    return buffer;
};
const cstringMessage = (code, string) => {
    const stringLen = Buffer.byteLength(string);
    const len = 4 + stringLen + 1;
    // one extra bit for code
    const buffer = Buffer.allocUnsafe(1 + len);
    buffer[0] = code;
    buffer.writeInt32BE(len, 1);
    buffer.write(string, 5, 'utf-8');
    buffer[len] = 0; // null terminate cString
    return buffer;
};
const emptyDescribePortal = writer.addCString('P').flush(68 /* code.describe */);
const emptyDescribeStatement = writer.addCString('S').flush(68 /* code.describe */);
const describe = (msg) => {
    return msg.name
        ? cstringMessage(68 /* code.describe */, `${msg.type}${msg.name || ''}`)
        : msg.type === 'P'
            ? emptyDescribePortal
            : emptyDescribeStatement;
};
const close = (msg) => {
    const text = `${msg.type}${msg.name || ''}`;
    return cstringMessage(67 /* code.close */, text);
};
const copyData = (chunk) => {
    return writer.add(chunk).flush(100 /* code.copyFromChunk */);
};
const copyFail = (message) => {
    return cstringMessage(102 /* code.copyFail */, message);
};
const codeOnlyBuffer = (code) => Buffer.from([code, 0x00, 0x00, 0x00, 0x04]);
const flushBuffer = codeOnlyBuffer(72 /* code.flush */);
const syncBuffer = codeOnlyBuffer(83 /* code.sync */);
const endBuffer = codeOnlyBuffer(88 /* code.end */);
const copyDoneBuffer = codeOnlyBuffer(99 /* code.copyDone */);
const serialize = {
    startup,
    password,
    requestSsl,
    sendSASLInitialResponseMessage,
    sendSCRAMClientFinalMessage,
    query,
    parse,
    bind,
    execute,
    describe,
    close,
    flush: () => flushBuffer,
    sync: () => syncBuffer,
    end: () => endBuffer,
    copyData,
    copyDone: () => copyDoneBuffer,
    copyFail,
    cancel,
};
exports.serialize = serialize;
//# sourceMappingURL=serializer.js.map

/***/ }),

/***/ 3408:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

var textParsers = __nccwpck_require__(5541);
var binaryParsers = __nccwpck_require__(3219);
var arrayParser = __nccwpck_require__(7382);
var builtinTypes = __nccwpck_require__(3214);

exports.getTypeParser = getTypeParser;
exports.setTypeParser = setTypeParser;
exports.arrayParser = arrayParser;
exports.builtins = builtinTypes;

var typeParsers = {
  text: {},
  binary: {}
};

//the empty parse function
function noParse (val) {
  return String(val);
};

//returns a function used to convert a specific type (specified by
//oid) into a result javascript type
//note: the oid can be obtained via the following sql query:
//SELECT oid FROM pg_type WHERE typname = 'TYPE_NAME_HERE';
function getTypeParser (oid, format) {
  format = format || 'text';
  if (!typeParsers[format]) {
    return noParse;
  }
  return typeParsers[format][oid] || noParse;
};

function setTypeParser (oid, format, parseFn) {
  if(typeof format == 'function') {
    parseFn = format;
    format = 'text';
  }
  typeParsers[format][oid] = parseFn;
};

textParsers.init(function(oid, converter) {
  typeParsers.text[oid] = converter;
});

binaryParsers.init(function(oid, converter) {
  typeParsers.binary[oid] = converter;
});


/***/ }),

/***/ 7382:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

var array = __nccwpck_require__(3250);

module.exports = {
  create: function (source, transform) {
    return {
      parse: function() {
        return array.parse(source, transform);
      }
    };
  }
};


/***/ }),

/***/ 3219:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

var parseInt64 = __nccwpck_require__(3572);

var parseBits = function(data, bits, offset, invert, callback) {
  offset = offset || 0;
  invert = invert || false;
  callback = callback || function(lastValue, newValue, bits) { return (lastValue * Math.pow(2, bits)) + newValue; };
  var offsetBytes = offset >> 3;

  var inv = function(value) {
    if (invert) {
      return ~value & 0xff;
    }

    return value;
  };

  // read first (maybe partial) byte
  var mask = 0xff;
  var firstBits = 8 - (offset % 8);
  if (bits < firstBits) {
    mask = (0xff << (8 - bits)) & 0xff;
    firstBits = bits;
  }

  if (offset) {
    mask = mask >> (offset % 8);
  }

  var result = 0;
  if ((offset % 8) + bits >= 8) {
    result = callback(0, inv(data[offsetBytes]) & mask, firstBits);
  }

  // read bytes
  var bytes = (bits + offset) >> 3;
  for (var i = offsetBytes + 1; i < bytes; i++) {
    result = callback(result, inv(data[i]), 8);
  }

  // bits to read, that are not a complete byte
  var lastBits = (bits + offset) % 8;
  if (lastBits > 0) {
    result = callback(result, inv(data[bytes]) >> (8 - lastBits), lastBits);
  }

  return result;
};

var parseFloatFromBits = function(data, precisionBits, exponentBits) {
  var bias = Math.pow(2, exponentBits - 1) - 1;
  var sign = parseBits(data, 1);
  var exponent = parseBits(data, exponentBits, 1);

  if (exponent === 0) {
    return 0;
  }

  // parse mantissa
  var precisionBitsCounter = 1;
  var parsePrecisionBits = function(lastValue, newValue, bits) {
    if (lastValue === 0) {
      lastValue = 1;
    }

    for (var i = 1; i <= bits; i++) {
      precisionBitsCounter /= 2;
      if ((newValue & (0x1 << (bits - i))) > 0) {
        lastValue += precisionBitsCounter;
      }
    }

    return lastValue;
  };

  var mantissa = parseBits(data, precisionBits, exponentBits + 1, false, parsePrecisionBits);

  // special cases
  if (exponent == (Math.pow(2, exponentBits + 1) - 1)) {
    if (mantissa === 0) {
      return (sign === 0) ? Infinity : -Infinity;
    }

    return NaN;
  }

  // normale number
  return ((sign === 0) ? 1 : -1) * Math.pow(2, exponent - bias) * mantissa;
};

var parseInt16 = function(value) {
  if (parseBits(value, 1) == 1) {
    return -1 * (parseBits(value, 15, 1, true) + 1);
  }

  return parseBits(value, 15, 1);
};

var parseInt32 = function(value) {
  if (parseBits(value, 1) == 1) {
    return -1 * (parseBits(value, 31, 1, true) + 1);
  }

  return parseBits(value, 31, 1);
};

var parseFloat32 = function(value) {
  return parseFloatFromBits(value, 23, 8);
};

var parseFloat64 = function(value) {
  return parseFloatFromBits(value, 52, 11);
};

var parseNumeric = function(value) {
  var sign = parseBits(value, 16, 32);
  if (sign == 0xc000) {
    return NaN;
  }

  var weight = Math.pow(10000, parseBits(value, 16, 16));
  var result = 0;

  var digits = [];
  var ndigits = parseBits(value, 16);
  for (var i = 0; i < ndigits; i++) {
    result += parseBits(value, 16, 64 + (16 * i)) * weight;
    weight /= 10000;
  }

  var scale = Math.pow(10, parseBits(value, 16, 48));
  return ((sign === 0) ? 1 : -1) * Math.round(result * scale) / scale;
};

var parseDate = function(isUTC, value) {
  var sign = parseBits(value, 1);
  var rawValue = parseBits(value, 63, 1);

  // discard usecs and shift from 2000 to 1970
  var result = new Date((((sign === 0) ? 1 : -1) * rawValue / 1000) + 946684800000);

  if (!isUTC) {
    result.setTime(result.getTime() + result.getTimezoneOffset() * 60000);
  }

  // add microseconds to the date
  result.usec = rawValue % 1000;
  result.getMicroSeconds = function() {
    return this.usec;
  };
  result.setMicroSeconds = function(value) {
    this.usec = value;
  };
  result.getUTCMicroSeconds = function() {
    return this.usec;
  };

  return result;
};

var parseArray = function(value) {
  var dim = parseBits(value, 32);

  var flags = parseBits(value, 32, 32);
  var elementType = parseBits(value, 32, 64);

  var offset = 96;
  var dims = [];
  for (var i = 0; i < dim; i++) {
    // parse dimension
    dims[i] = parseBits(value, 32, offset);
    offset += 32;

    // ignore lower bounds
    offset += 32;
  }

  var parseElement = function(elementType) {
    // parse content length
    var length = parseBits(value, 32, offset);
    offset += 32;

    // parse null values
    if (length == 0xffffffff) {
      return null;
    }

    var result;
    if ((elementType == 0x17) || (elementType == 0x14)) {
      // int/bigint
      result = parseBits(value, length * 8, offset);
      offset += length * 8;
      return result;
    }
    else if (elementType == 0x19) {
      // string
      result = value.toString(this.encoding, offset >> 3, (offset += (length << 3)) >> 3);
      return result;
    }
    else {
      console.log("ERROR: ElementType not implemented: " + elementType);
    }
  };

  var parse = function(dimension, elementType) {
    var array = [];
    var i;

    if (dimension.length > 1) {
      var count = dimension.shift();
      for (i = 0; i < count; i++) {
        array[i] = parse(dimension, elementType);
      }
      dimension.unshift(count);
    }
    else {
      for (i = 0; i < dimension[0]; i++) {
        array[i] = parseElement(elementType);
      }
    }

    return array;
  };

  return parse(dims, elementType);
};

var parseText = function(value) {
  return value.toString('utf8');
};

var parseBool = function(value) {
  if(value === null) return null;
  return (parseBits(value, 8) > 0);
};

var init = function(register) {
  register(20, parseInt64);
  register(21, parseInt16);
  register(23, parseInt32);
  register(26, parseInt32);
  register(1700, parseNumeric);
  register(700, parseFloat32);
  register(701, parseFloat64);
  register(16, parseBool);
  register(1114, parseDate.bind(null, false));
  register(1184, parseDate.bind(null, true));
  register(1000, parseArray);
  register(1007, parseArray);
  register(1016, parseArray);
  register(1008, parseArray);
  register(1009, parseArray);
  register(25, parseText);
};

module.exports = {
  init: init
};


/***/ }),

/***/ 3214:
/***/ ((module) => {

/**
 * Following query was used to generate this file:

 SELECT json_object_agg(UPPER(PT.typname), PT.oid::int4 ORDER BY pt.oid)
 FROM pg_type PT
 WHERE typnamespace = (SELECT pgn.oid FROM pg_namespace pgn WHERE nspname = 'pg_catalog') -- Take only builting Postgres types with stable OID (extension types are not guaranted to be stable)
 AND typtype = 'b' -- Only basic types
 AND typelem = 0 -- Ignore aliases
 AND typisdefined -- Ignore undefined types
 */

module.exports = {
    BOOL: 16,
    BYTEA: 17,
    CHAR: 18,
    INT8: 20,
    INT2: 21,
    INT4: 23,
    REGPROC: 24,
    TEXT: 25,
    OID: 26,
    TID: 27,
    XID: 28,
    CID: 29,
    JSON: 114,
    XML: 142,
    PG_NODE_TREE: 194,
    SMGR: 210,
    PATH: 602,
    POLYGON: 604,
    CIDR: 650,
    FLOAT4: 700,
    FLOAT8: 701,
    ABSTIME: 702,
    RELTIME: 703,
    TINTERVAL: 704,
    CIRCLE: 718,
    MACADDR8: 774,
    MONEY: 790,
    MACADDR: 829,
    INET: 869,
    ACLITEM: 1033,
    BPCHAR: 1042,
    VARCHAR: 1043,
    DATE: 1082,
    TIME: 1083,
    TIMESTAMP: 1114,
    TIMESTAMPTZ: 1184,
    INTERVAL: 1186,
    TIMETZ: 1266,
    BIT: 1560,
    VARBIT: 1562,
    NUMERIC: 1700,
    REFCURSOR: 1790,
    REGPROCEDURE: 2202,
    REGOPER: 2203,
    REGOPERATOR: 2204,
    REGCLASS: 2205,
    REGTYPE: 2206,
    UUID: 2950,
    TXID_SNAPSHOT: 2970,
    PG_LSN: 3220,
    PG_NDISTINCT: 3361,
    PG_DEPENDENCIES: 3402,
    TSVECTOR: 3614,
    TSQUERY: 3615,
    GTSVECTOR: 3642,
    REGCONFIG: 3734,
    REGDICTIONARY: 3769,
    JSONB: 3802,
    REGNAMESPACE: 4089,
    REGROLE: 4096
};


/***/ }),

/***/ 5541:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

var array = __nccwpck_require__(3250)
var arrayParser = __nccwpck_require__(7382);
var parseDate = __nccwpck_require__(3337);
var parseInterval = __nccwpck_require__(4904);
var parseByteA = __nccwpck_require__(2878);

function allowNull (fn) {
  return function nullAllowed (value) {
    if (value === null) return value
    return fn(value)
  }
}

function parseBool (value) {
  if (value === null) return value
  return value === 'TRUE' ||
    value === 't' ||
    value === 'true' ||
    value === 'y' ||
    value === 'yes' ||
    value === 'on' ||
    value === '1';
}

function parseBoolArray (value) {
  if (!value) return null
  return array.parse(value, parseBool)
}

function parseBaseTenInt (string) {
  return parseInt(string, 10)
}

function parseIntegerArray (value) {
  if (!value) return null
  return array.parse(value, allowNull(parseBaseTenInt))
}

function parseBigIntegerArray (value) {
  if (!value) return null
  return array.parse(value, allowNull(function (entry) {
    return parseBigInteger(entry).trim()
  }))
}

var parsePointArray = function(value) {
  if(!value) { return null; }
  var p = arrayParser.create(value, function(entry) {
    if(entry !== null) {
      entry = parsePoint(entry);
    }
    return entry;
  });

  return p.parse();
};

var parseFloatArray = function(value) {
  if(!value) { return null; }
  var p = arrayParser.create(value, function(entry) {
    if(entry !== null) {
      entry = parseFloat(entry);
    }
    return entry;
  });

  return p.parse();
};

var parseStringArray = function(value) {
  if(!value) { return null; }

  var p = arrayParser.create(value);
  return p.parse();
};

var parseDateArray = function(value) {
  if (!value) { return null; }

  var p = arrayParser.create(value, function(entry) {
    if (entry !== null) {
      entry = parseDate(entry);
    }
    return entry;
  });

  return p.parse();
};

var parseIntervalArray = function(value) {
  if (!value) { return null; }

  var p = arrayParser.create(value, function(entry) {
    if (entry !== null) {
      entry = parseInterval(entry);
    }
    return entry;
  });

  return p.parse();
};

var parseByteAArray = function(value) {
  if (!value) { return null; }

  return array.parse(value, allowNull(parseByteA));
};

var parseInteger = function(value) {
  return parseInt(value, 10);
};

var parseBigInteger = function(value) {
  var valStr = String(value);
  if (/^\d+$/.test(valStr)) { return valStr; }
  return value;
};

var parseJsonArray = function(value) {
  if (!value) { return null; }

  return array.parse(value, allowNull(JSON.parse));
};

var parsePoint = function(value) {
  if (value[0] !== '(') { return null; }

  value = value.substring( 1, value.length - 1 ).split(',');

  return {
    x: parseFloat(value[0])
  , y: parseFloat(value[1])
  };
};

var parseCircle = function(value) {
  if (value[0] !== '<' && value[1] !== '(') { return null; }

  var point = '(';
  var radius = '';
  var pointParsed = false;
  for (var i = 2; i < value.length - 1; i++){
    if (!pointParsed) {
      point += value[i];
    }

    if (value[i] === ')') {
      pointParsed = true;
      continue;
    } else if (!pointParsed) {
      continue;
    }

    if (value[i] === ','){
      continue;
    }

    radius += value[i];
  }
  var result = parsePoint(point);
  result.radius = parseFloat(radius);

  return result;
};

var init = function(register) {
  register(20, parseBigInteger); // int8
  register(21, parseInteger); // int2
  register(23, parseInteger); // int4
  register(26, parseInteger); // oid
  register(700, parseFloat); // float4/real
  register(701, parseFloat); // float8/double
  register(16, parseBool);
  register(1082, parseDate); // date
  register(1114, parseDate); // timestamp without timezone
  register(1184, parseDate); // timestamp
  register(600, parsePoint); // point
  register(651, parseStringArray); // cidr[]
  register(718, parseCircle); // circle
  register(1000, parseBoolArray);
  register(1001, parseByteAArray);
  register(1005, parseIntegerArray); // _int2
  register(1007, parseIntegerArray); // _int4
  register(1028, parseIntegerArray); // oid[]
  register(1016, parseBigIntegerArray); // _int8
  register(1017, parsePointArray); // point[]
  register(1021, parseFloatArray); // _float4
  register(1022, parseFloatArray); // _float8
  register(1231, parseFloatArray); // _numeric
  register(1014, parseStringArray); //char
  register(1015, parseStringArray); //varchar
  register(1008, parseStringArray);
  register(1009, parseStringArray);
  register(1040, parseStringArray); // macaddr[]
  register(1041, parseStringArray); // inet[]
  register(1115, parseDateArray); // timestamp without time zone[]
  register(1182, parseDateArray); // _date
  register(1185, parseDateArray); // timestamp with time zone[]
  register(1186, parseInterval);
  register(1187, parseIntervalArray);
  register(17, parseByteA);
  register(114, JSON.parse.bind(JSON)); // json
  register(3802, JSON.parse.bind(JSON)); // jsonb
  register(199, parseJsonArray); // json[]
  register(3807, parseJsonArray); // jsonb[]
  register(3907, parseStringArray); // numrange[]
  register(2951, parseStringArray); // uuid[]
  register(791, parseStringArray); // money[]
  register(1183, parseStringArray); // time[]
  register(1270, parseStringArray); // timetz[]
};

module.exports = {
  init: init
};


/***/ }),

/***/ 5785:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const EventEmitter = (__nccwpck_require__(4434).EventEmitter)
const utils = __nccwpck_require__(1657)
const nodeUtils = __nccwpck_require__(9023)
const sasl = __nccwpck_require__(7665)
const TypeOverrides = __nccwpck_require__(6002)

const ConnectionParameters = __nccwpck_require__(2231)
const Query = __nccwpck_require__(4752)
const defaults = __nccwpck_require__(2228)
const Connection = __nccwpck_require__(6298)
const crypto = __nccwpck_require__(9761)

const activeQueryDeprecationNotice = nodeUtils.deprecate(
  () => {},
  'Client.activeQuery is deprecated and will be removed in pg@9.0'
)

const queryQueueDeprecationNotice = nodeUtils.deprecate(
  () => {},
  'Client.queryQueue is deprecated and will be removed in pg@9.0.'
)

const pgPassDeprecationNotice = nodeUtils.deprecate(
  () => {},
  'pgpass support is deprecated and will be removed in pg@9.0. ' +
    'You can provide an async function as the password property to the Client/Pool constructor that returns a password instead. Within this function you can call the pgpass module in your own code.'
)

const byoPromiseDeprecationNotice = nodeUtils.deprecate(
  () => {},
  'Passing a custom Promise implementation to the Client/Pool constructor is deprecated and will be removed in pg@9.0.'
)

const queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
  () => {},
  'Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead.'
)

function coerceNumberOrDefault(value, defaultValue) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : defaultValue
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : defaultValue
  }
  return defaultValue
}

class Client extends EventEmitter {
  constructor(config) {
    super()

    this.connectionParameters = new ConnectionParameters(config)
    this.user = this.connectionParameters.user
    this.database = this.connectionParameters.database
    this.port = this.connectionParameters.port
    this.host = this.connectionParameters.host

    // "hiding" the password so it doesn't show up in stack traces
    // or if the client is console.logged
    Object.defineProperty(this, 'password', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: this.connectionParameters.password,
    })

    this.replication = this.connectionParameters.replication

    const c = config || {}

    if (c.Promise) {
      byoPromiseDeprecationNotice()
    }
    this._Promise = c.Promise || global.Promise
    this._types = new TypeOverrides(c.types)
    this._ending = false
    this._ended = false
    this._connecting = false
    this._connected = false
    this._connectionError = false
    this._queryable = true
    this._activeQuery = null
    this._txStatus = null

    this.enableChannelBinding = Boolean(c.enableChannelBinding) // set true to use SCRAM-SHA-256-PLUS when offered
    this.scramMaxIterations = coerceNumberOrDefault(c.scramMaxIterations, sasl.DEFAULT_MAX_SCRAM_ITERATIONS)
    this.connection =
      c.connection ||
      new Connection({
        stream: c.stream,
        ssl: this.connectionParameters.ssl,
        sslNegotiation: this.connectionParameters.sslnegotiation,
        keepAlive: c.keepAlive || false,
        keepAliveInitialDelayMillis: c.keepAliveInitialDelayMillis || 0,
        encoding: this.connectionParameters.client_encoding || 'utf8',
      })
    this._queryQueue = []
    this._sentQueryQueue = []
    this.pipeline = Boolean(c.pipeline)
    this.binary = c.binary || defaults.binary
    this.processID = null
    this.secretKey = null
    this.ssl = this.connectionParameters.ssl || false
    this.sslNegotiation = this.connectionParameters.sslnegotiation || 'postgres'
    // As with Password, make SSL->Key (the private key) non-enumerable.
    // It won't show up in stack traces
    // or if the client is console.logged
    if (this.ssl && this.ssl.key) {
      Object.defineProperty(this.ssl, 'key', {
        enumerable: false,
      })
    }

    this._connectionTimeoutMillis = c.connectionTimeoutMillis || 0
  }

  get activeQuery() {
    activeQueryDeprecationNotice()
    return this._activeQuery
  }

  set activeQuery(val) {
    activeQueryDeprecationNotice()
    this._activeQuery = val
  }

  _getActiveQuery() {
    return this._activeQuery
  }

  _errorAllQueries(err) {
    const enqueueError = (query) => {
      process.nextTick(() => {
        query.handleError(err, this.connection)
      })
    }

    const activeQuery = this._getActiveQuery()
    if (activeQuery) {
      enqueueError(activeQuery)
      this._activeQuery = null
    }

    this._sentQueryQueue.forEach(enqueueError)
    this._sentQueryQueue.length = 0

    this._queryQueue.forEach(enqueueError)
    this._queryQueue.length = 0
  }

  _connect(callback) {
    const self = this
    const con = this.connection
    this._connectionCallback = callback

    if (this._connecting || this._connected) {
      const err = new Error('Client has already been connected. You cannot reuse a client.')
      process.nextTick(() => {
        callback(err)
      })
      return
    }
    this._connecting = true

    if (this._connectionTimeoutMillis > 0) {
      this.connectionTimeoutHandle = setTimeout(() => {
        con._ending = true
        con.stream.destroy(new Error('timeout expired'))
      }, this._connectionTimeoutMillis)

      if (this.connectionTimeoutHandle.unref) {
        this.connectionTimeoutHandle.unref()
      }
    }

    if (this.host && this.host.indexOf('/') === 0) {
      con.connect(this.host + '/.s.PGSQL.' + this.port)
    } else {
      con.connect(this.port, this.host)
    }

    // once connection is established send startup message
    con.on('connect', function () {
      if (self.ssl) {
        // With direct SSL negotiation the connection upgrades to TLS without an
        // SSLRequest packet, so the startup message is sent after 'sslconnect'.
        if (self.sslNegotiation !== 'direct') {
          con.requestSsl()
        }
      } else {
        con.startup(self.getStartupConf())
      }
    })

    con.on('sslconnect', function () {
      con.startup(self.getStartupConf())
    })

    this._attachListeners(con)

    con.once('end', () => {
      const error = this._ending ? new Error('Connection terminated') : new Error('Connection terminated unexpectedly')

      clearTimeout(this.connectionTimeoutHandle)
      this._errorAllQueries(error)
      this._ended = true

      if (!this._ending) {
        // if the connection is ended without us calling .end()
        // on this client then we have an unexpected disconnection
        // treat this as an error unless we've already emitted an error
        // during connection.
        if (this._connecting && !this._connectionError) {
          if (this._connectionCallback) {
            this._connectionCallback(error)
          } else {
            this._handleErrorEvent(error)
          }
        } else if (!this._connectionError) {
          this._handleErrorEvent(error)
        }
      }

      process.nextTick(() => {
        this.emit('end')
      })
    })
  }

  connect(callback) {
    if (callback) {
      this._connect(callback)
      return
    }

    return new this._Promise((resolve, reject) => {
      this._connect((error) => {
        if (error) {
          reject(error)
        } else {
          resolve(this)
        }
      })
    })
  }

  _attachListeners(con) {
    // password request handling
    con.on('authenticationCleartextPassword', this._handleAuthCleartextPassword.bind(this))
    // password request handling
    con.on('authenticationMD5Password', this._handleAuthMD5Password.bind(this))
    // password request handling (SASL)
    con.on('authenticationSASL', this._handleAuthSASL.bind(this))
    con.on('authenticationSASLContinue', this._handleAuthSASLContinue.bind(this))
    con.on('authenticationSASLFinal', this._handleAuthSASLFinal.bind(this))
    con.on('backendKeyData', this._handleBackendKeyData.bind(this))
    con.on('error', this._handleErrorEvent.bind(this))
    con.on('errorMessage', this._handleErrorMessage.bind(this))
    con.on('readyForQuery', this._handleReadyForQuery.bind(this))
    con.on('notice', this._handleNotice.bind(this))
    con.on('rowDescription', this._handleRowDescription.bind(this))
    con.on('dataRow', this._handleDataRow.bind(this))
    con.on('portalSuspended', this._handlePortalSuspended.bind(this))
    con.on('emptyQuery', this._handleEmptyQuery.bind(this))
    con.on('commandComplete', this._handleCommandComplete.bind(this))
    con.on('parseComplete', this._handleParseComplete.bind(this))
    con.on('copyInResponse', this._handleCopyInResponse.bind(this))
    con.on('copyData', this._handleCopyData.bind(this))
    con.on('notification', this._handleNotification.bind(this))
  }

  _getPassword(cb) {
    const con = this.connection
    if (typeof this.password === 'function') {
      this._Promise
        .resolve()
        .then(() => this.password(this.connectionParameters))
        .then((pass) => {
          if (pass !== undefined) {
            if (typeof pass !== 'string') {
              con.emit('error', new TypeError('Password must be a string'))
              return
            }
            this.connectionParameters.password = this.password = pass
          } else {
            this.connectionParameters.password = this.password = null
          }
          cb()
        })
        .catch((err) => {
          con.emit('error', err)
        })
    } else if (this.password !== null) {
      cb()
    } else {
      try {
        const pgPass = __nccwpck_require__(1269)
        pgPass(this.connectionParameters, (pass) => {
          if (undefined !== pass) {
            pgPassDeprecationNotice()
            this.connectionParameters.password = this.password = pass
          }
          cb()
        })
      } catch (e) {
        this.emit('error', e)
      }
    }
  }

  _handleAuthCleartextPassword(msg) {
    this._getPassword(() => {
      this.connection.password(this.password)
    })
  }

  _handleAuthMD5Password(msg) {
    this._getPassword(async () => {
      try {
        const hashedPassword = await crypto.postgresMd5PasswordHash(this.user, this.password, msg.salt)
        this.connection.password(hashedPassword)
      } catch (e) {
        this.emit('error', e)
      }
    })
  }

  _handleAuthSASL(msg) {
    this._getPassword(() => {
      try {
        this.saslSession = sasl.startSession(
          msg.mechanisms,
          this.enableChannelBinding && this.connection.stream,
          this.scramMaxIterations
        )
        this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism, this.saslSession.response)
      } catch (err) {
        this.connection.emit('error', err)
      }
    })
  }

  async _handleAuthSASLContinue(msg) {
    try {
      await sasl.continueSession(
        this.saslSession,
        this.password,
        msg.data,
        this.enableChannelBinding && this.connection.stream
      )
      this.connection.sendSCRAMClientFinalMessage(this.saslSession.response)
    } catch (err) {
      this.connection.emit('error', err)
    }
  }

  _handleAuthSASLFinal(msg) {
    try {
      sasl.finalizeSession(this.saslSession, msg.data)
      this.saslSession = null
    } catch (err) {
      this.connection.emit('error', err)
    }
  }

  _handleBackendKeyData(msg) {
    this.processID = msg.processID
    this.secretKey = msg.secretKey
  }

  _handleReadyForQuery(msg) {
    if (this._connecting) {
      this._connecting = false
      this._connected = true
      clearTimeout(this.connectionTimeoutHandle)

      // process possible callback argument to Client#connect
      if (this._connectionCallback) {
        this._connectionCallback(null, this)
        // remove callback for proper error handling
        // after the connect event
        this._connectionCallback = null
      }
      this.emit('connect')
    }
    const activeQuery = this._getActiveQuery()
    this._activeQuery = null
    this._txStatus = msg?.status ?? null
    this.readyForQuery = true
    if (activeQuery) {
      activeQuery.handleReadyForQuery(this.connection)
    }
    this._pulseQueryQueue()
  }

  // if we receive an error event or error message
  // during the connection process we handle it here
  _handleErrorWhileConnecting(err) {
    if (this._connectionError) {
      // TODO(bmc): this is swallowing errors - we shouldn't do this
      return
    }
    this._connectionError = true
    clearTimeout(this.connectionTimeoutHandle)
    if (this._connectionCallback) {
      return this._connectionCallback(err)
    }
    this.emit('error', err)
  }

  // if we're connected and we receive an error event from the connection
  // this means the socket is dead - do a hard abort of all queries and emit
  // the socket error on the client as well
  _handleErrorEvent(err) {
    if (this._connecting) {
      return this._handleErrorWhileConnecting(err)
    }
    this._queryable = false
    this._errorAllQueries(err)
    this.emit('error', err)
  }

  // handle error messages from the postgres backend
  _handleErrorMessage(msg) {
    if (this._connecting) {
      return this._handleErrorWhileConnecting(msg)
    }
    const activeQuery = this._getActiveQuery()

    if (!activeQuery) {
      this._handleErrorEvent(msg)
      return
    }

    this._activeQuery = null
    if (activeQuery.name) {
      delete this.connection.submittedNamedStatements[activeQuery.name]
    }
    activeQuery.handleError(msg, this.connection)
  }

  _handleRowDescription(msg) {
    const activeQuery = this._getActiveQuery()
    if (activeQuery == null) {
      const error = new Error('Received unexpected rowDescription message from backend.')
      this._handleErrorEvent(error)
      return
    }
    // delegate rowDescription to active query
    activeQuery.handleRowDescription(msg)
  }

  _handleDataRow(msg) {
    const activeQuery = this._getActiveQuery()
    if (activeQuery == null) {
      const error = new Error('Received unexpected dataRow message from backend.')
      this._handleErrorEvent(error)
      return
    }
    // delegate dataRow to active query
    activeQuery.handleDataRow(msg)
  }

  _handlePortalSuspended(msg) {
    const activeQuery = this._getActiveQuery()
    if (activeQuery == null) {
      const error = new Error('Received unexpected portalSuspended message from backend.')
      this._handleErrorEvent(error)
      return
    }
    // delegate portalSuspended to active query
    activeQuery.handlePortalSuspended(this.connection)
  }

  _handleEmptyQuery(msg) {
    const activeQuery = this._getActiveQuery()
    if (activeQuery == null) {
      const error = new Error('Received unexpected emptyQuery message from backend.')
      this._handleErrorEvent(error)
      return
    }
    // delegate emptyQuery to active query
    activeQuery.handleEmptyQuery(this.connection)
  }

  _handleCommandComplete(msg) {
    const activeQuery = this._getActiveQuery()
    if (activeQuery == null) {
      const error = new Error('Received unexpected commandComplete message from backend.')
      this._handleErrorEvent(error)
      return
    }
    // delegate commandComplete to active query
    activeQuery.handleCommandComplete(msg, this.connection)
  }

  _handleParseComplete() {
    const activeQuery = this._getActiveQuery()
    if (activeQuery == null) {
      const error = new Error('Received unexpected parseComplete message from backend.')
      this._handleErrorEvent(error)
      return
    }
    // if a prepared statement has a name and properly parses
    // we track that its already been executed so we don't parse
    // it again on the same client
    if (activeQuery.name) {
      this.connection.parsedStatements[activeQuery.name] = activeQuery.text
      delete this.connection.submittedNamedStatements[activeQuery.name]
    }
  }

  _handleCopyInResponse(msg) {
    const activeQuery = this._getActiveQuery()
    if (activeQuery == null) {
      const error = new Error('Received unexpected copyInResponse message from backend.')
      this._handleErrorEvent(error)
      return
    }
    activeQuery.handleCopyInResponse(this.connection)
  }

  _handleCopyData(msg) {
    const activeQuery = this._getActiveQuery()
    if (activeQuery == null) {
      const error = new Error('Received unexpected copyData message from backend.')
      this._handleErrorEvent(error)
      return
    }
    activeQuery.handleCopyData(msg, this.connection)
  }

  _handleNotification(msg) {
    this.emit('notification', msg)
  }

  _handleNotice(msg) {
    this.emit('notice', msg)
  }

  getStartupConf() {
    const params = this.connectionParameters

    const data = {
      user: params.user,
      database: params.database,
    }

    const appName = params.application_name || params.fallback_application_name
    if (appName) {
      data.application_name = appName
    }
    if (params.replication) {
      data.replication = '' + params.replication
    }
    if (params.statement_timeout) {
      data.statement_timeout = String(parseInt(params.statement_timeout, 10))
    }
    if (params.lock_timeout) {
      data.lock_timeout = String(parseInt(params.lock_timeout, 10))
    }
    if (params.idle_in_transaction_session_timeout) {
      data.idle_in_transaction_session_timeout = String(parseInt(params.idle_in_transaction_session_timeout, 10))
    }
    if (params.options) {
      data.options = params.options
    }

    return data
  }

  cancel(client, query) {
    if (client.activeQuery === query) {
      const con = this.connection

      if (this.host && this.host.indexOf('/') === 0) {
        con.connect(this.host + '/.s.PGSQL.' + this.port)
      } else {
        con.connect(this.port, this.host)
      }

      // once connection is established send cancel message
      con.on('connect', function () {
        con.cancel(client.processID, client.secretKey)
      })
    } else if (client._queryQueue.indexOf(query) !== -1) {
      client._queryQueue.splice(client._queryQueue.indexOf(query), 1)
    } else if (client._sentQueryQueue.indexOf(query) !== -1) {
      // Query already sent on wire — can't remove it without corrupting the
      // pipeline. No-op the callback so the result is silently discarded.
      query.callback = () => {}
    }
  }

  setTypeParser(oid, format, parseFn) {
    return this._types.setTypeParser(oid, format, parseFn)
  }

  getTypeParser(oid, format) {
    return this._types.getTypeParser(oid, format)
  }

  // escapeIdentifier and escapeLiteral moved to utility functions & exported
  // on PG
  // re-exported here for backwards compatibility
  escapeIdentifier(str) {
    return utils.escapeIdentifier(str)
  }

  escapeLiteral(str) {
    return utils.escapeLiteral(str)
  }

  _pulseQueryQueue() {
    if (this.pipeline) {
      this._pulsePipelinedQueryQueue()
      return
    }
    if (this.readyForQuery === true) {
      this._activeQuery = this._queryQueue.shift()
      const activeQuery = this._getActiveQuery()
      if (activeQuery) {
        this.readyForQuery = false
        this.hasExecuted = true

        const queryError = activeQuery.submit(this.connection)
        if (queryError) {
          process.nextTick(() => {
            activeQuery.handleError(queryError, this.connection)
            this.readyForQuery = true
            this._pulseQueryQueue()
          })
        }
      } else if (this.hasExecuted) {
        this._activeQuery = null
        this.emit('drain')
      }
    }
  }

  _pulsePipelinedQueryQueue() {
    if (!this._connected || !this._queryable) {
      return
    }
    while (this._queryQueue.length > 0) {
      const query = this._queryQueue.shift()
      this.hasExecuted = true
      const queryError = query.submit(this.connection)
      if (queryError) {
        process.nextTick(() => {
          query.handleError(queryError, this.connection)
        })
        continue
      }
      this._sentQueryQueue.push(query)
    }
    if (this.readyForQuery && !this._activeQuery && this._sentQueryQueue.length > 0) {
      this._activeQuery = this._sentQueryQueue.shift()
      this.readyForQuery = false
    }
    if (!this._activeQuery && this._sentQueryQueue.length === 0 && this._queryQueue.length === 0 && this.hasExecuted) {
      this.emit('drain')
    }
  }

  query(config, values, callback) {
    // can take in strings, config object or query object
    let query
    let result

    if (config == null) {
      throw new TypeError('Client was passed a null or undefined query')
    }

    if (typeof config.submit === 'function') {
      result = query = config
      if (!query.callback) {
        if (typeof values === 'function') {
          query.callback = values
        } else if (callback) {
          query.callback = callback
        }
      }
    } else {
      query = new Query(config, values, callback)
      if (!query.callback) {
        result = new this._Promise((resolve, reject) => {
          query.callback = (err, res) => (err ? reject(err) : resolve(res))
        }).catch((err) => {
          // replace the stack trace that leads to `TCP.onStreamRead` with one that leads back to the
          // application that created the query
          Error.captureStackTrace(err)
          throw err
        })
      } else if (typeof query.callback !== 'function') {
        throw new TypeError('callback is not a function')
      }
    }

    const readTimeout = config.query_timeout || this.connectionParameters.query_timeout
    if (readTimeout) {
      const queryCallback = query.callback || (() => {})

      const readTimeoutTimer = setTimeout(() => {
        const error = new Error('Query read timeout')

        process.nextTick(() => {
          query.handleError(error, this.connection)
        })

        queryCallback(error)

        // we already returned an error,
        // just do nothing if query completes
        query.callback = () => {}

        // Remove from queue (only safe if not yet sent)
        const index = this._queryQueue.indexOf(query)
        if (index > -1) {
          this._queryQueue.splice(index, 1)
        } else if (this.pipeline) {
          // Query already sent — the pipeline is blocked until it completes.
          // Destroy the connection to unblock all remaining pipelined queries.
          this.connection.stream.destroy()
          return
        }

        this._pulseQueryQueue()
      }, readTimeout)

      query.callback = (err, res) => {
        clearTimeout(readTimeoutTimer)
        queryCallback(err, res)
      }
    }

    if (this.binary && !query.binary) {
      query.binary = true
    }

    if (query._result && !query._result._types) {
      query._result._types = this._types
    }

    if (!this._queryable) {
      process.nextTick(() => {
        query.handleError(new Error('Client has encountered a connection error and is not queryable'), this.connection)
      })
      return result
    }

    if (this._ending) {
      process.nextTick(() => {
        query.handleError(new Error('Client was closed and is not queryable'), this.connection)
      })
      return result
    }

    if (this._queryQueue.length > 0 && !this.pipeline) {
      queryQueueLengthDeprecationNotice()
    }
    this._queryQueue.push(query)
    this._pulseQueryQueue()
    return result
  }

  ref() {
    this.connection.ref()
  }

  unref() {
    this.connection.unref()
  }

  getTransactionStatus() {
    return this._txStatus
  }

  end(cb) {
    this._ending = true

    // if we have never connected, then end is a noop, callback immediately
    if (!this.connection._connecting || this._ended) {
      if (cb) {
        cb()
        return
      } else {
        return this._Promise.resolve()
      }
    }

    if (!this._queryable) {
      // socket is dead — force close
      this.connection.stream.destroy()
    } else if (
      this.pipeline &&
      (this._getActiveQuery() || this._sentQueryQueue.length > 0 || this._queryQueue.length > 0)
    ) {
      // pipelined queries are already on the wire (or queued to send) and will
      // complete normally; wait for drain then do a graceful goodbye
      this.once('drain', () => this.connection.end())
    } else if (this._getActiveQuery()) {
      // non-pipeline: a hung query could block end forever — force disconnect
      this.connection.stream.destroy()
    } else {
      this.connection.end()
    }

    if (cb) {
      this.connection.once('end', cb)
    } else {
      return new this._Promise((resolve) => {
        this.connection.once('end', resolve)
      })
    }
  }
  get queryQueue() {
    queryQueueDeprecationNotice()
    return this._queryQueue
  }
}

// expose a Query constructor
Client.Query = Query

module.exports = Client


/***/ }),

/***/ 2231:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const dns = __nccwpck_require__(2250)

const defaults = __nccwpck_require__(2228)

const parse = (__nccwpck_require__(839).parse) // parses a connection string

const val = function (key, config, envVar) {
  if (config[key]) {
    return config[key]
  }

  if (envVar === undefined) {
    envVar = process.env['PG' + key.toUpperCase()]
  } else if (envVar === false) {
    // do nothing ... use false
  } else {
    envVar = process.env[envVar]
  }

  return envVar || defaults[key]
}

const readSSLConfigFromEnvironment = function () {
  switch (process.env.PGSSLMODE) {
    case 'disable':
      return false
    case 'prefer':
    case 'require':
    case 'verify-ca':
    case 'verify-full':
      return true
    case 'no-verify':
      return { rejectUnauthorized: false }
  }
  return defaults.ssl
}

// Convert arg to a string, surround in single quotes, and escape single quotes and backslashes
const quoteParamValue = function (value) {
  return "'" + ('' + value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}

const add = function (params, config, paramName) {
  const value = config[paramName]
  if (value !== undefined && value !== null) {
    params.push(paramName + '=' + quoteParamValue(value))
  }
}

class ConnectionParameters {
  constructor(config) {
    // if a string is passed, it is a raw connection string so we parse it into a config
    config = typeof config === 'string' ? parse(config) : config || {}

    // if the config has a connectionString defined, parse IT into the config we use
    // this will override other default values with what is stored in connectionString
    if (config.connectionString) {
      config = Object.assign({}, config, parse(config.connectionString))
    }

    this.user = val('user', config)
    this.database = val('database', config)

    if (this.database === undefined) {
      this.database = this.user
    }

    this.port = parseInt(val('port', config), 10)
    this.host = val('host', config)

    // "hiding" the password so it doesn't show up in stack traces
    // or if the client is console.logged
    Object.defineProperty(this, 'password', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: val('password', config),
    })

    this.binary = val('binary', config)
    this.options = val('options', config)

    this.ssl = typeof config.ssl === 'undefined' ? readSSLConfigFromEnvironment() : config.ssl

    if (typeof this.ssl === 'string') {
      if (this.ssl === 'true') {
        this.ssl = true
      }
    }
    // support passing in ssl=no-verify via connection string
    if (this.ssl === 'no-verify') {
      this.ssl = { rejectUnauthorized: false }
    }
    if (this.ssl && this.ssl.key) {
      Object.defineProperty(this.ssl, 'key', {
        enumerable: false,
      })
    }

    // How to negotiate SSL: 'postgres' (default, the traditional SSLRequest
    // handshake) or 'direct' (start the TLS handshake immediately on connect).
    this.sslnegotiation = val('sslnegotiation', config, 'PGSSLNEGOTIATION')
    if (this.sslnegotiation !== undefined && this.sslnegotiation !== 'postgres' && this.sslnegotiation !== 'direct') {
      throw new Error(
        `Invalid sslnegotiation value: "${this.sslnegotiation}". Valid values are "postgres" and "direct".`
      )
    }
    if (this.sslnegotiation === 'direct' && !this.ssl) {
      throw new Error('sslnegotiation=direct requires SSL to be enabled')
    }

    this.client_encoding = val('client_encoding', config)
    this.replication = val('replication', config)
    // a domain socket begins with '/'
    this.isDomainSocket = !(this.host || '').indexOf('/')

    this.application_name = val('application_name', config, 'PGAPPNAME')
    this.fallback_application_name = val('fallback_application_name', config, false)
    this.statement_timeout = val('statement_timeout', config, false)
    this.lock_timeout = val('lock_timeout', config, false)
    this.idle_in_transaction_session_timeout = val('idle_in_transaction_session_timeout', config, false)
    this.query_timeout = val('query_timeout', config, false)

    if (config.connectionTimeoutMillis === undefined) {
      this.connect_timeout = process.env.PGCONNECT_TIMEOUT || 0
    } else {
      this.connect_timeout = Math.floor(config.connectionTimeoutMillis / 1000)
    }

    if (config.keepAlive === false) {
      this.keepalives = 0
    } else if (config.keepAlive === true) {
      this.keepalives = 1
    }

    if (typeof config.keepAliveInitialDelayMillis === 'number') {
      this.keepalives_idle = Math.floor(config.keepAliveInitialDelayMillis / 1000)
    }
  }

  getLibpqConnectionString(cb) {
    const params = []
    add(params, this, 'user')
    add(params, this, 'password')
    add(params, this, 'port')
    add(params, this, 'application_name')
    add(params, this, 'fallback_application_name')
    add(params, this, 'connect_timeout')
    add(params, this, 'options')

    const ssl = typeof this.ssl === 'object' ? this.ssl : this.ssl ? { sslmode: this.ssl } : {}
    add(params, ssl, 'sslmode')
    add(params, ssl, 'sslca')
    add(params, ssl, 'sslkey')
    add(params, ssl, 'sslcert')
    add(params, ssl, 'sslrootcert')
    add(params, this, 'sslnegotiation')

    if (this.database) {
      params.push('dbname=' + quoteParamValue(this.database))
    }
    if (this.replication) {
      params.push('replication=' + quoteParamValue(this.replication))
    }
    if (this.host) {
      params.push('host=' + quoteParamValue(this.host))
    }
    if (this.isDomainSocket) {
      return cb(null, params.join(' '))
    }
    if (this.client_encoding) {
      params.push('client_encoding=' + quoteParamValue(this.client_encoding))
    }
    dns.lookup(this.host, function (err, address) {
      if (err) return cb(err, null)
      params.push('hostaddr=' + quoteParamValue(address))
      return cb(null, params.join(' '))
    })
  }
}

module.exports = ConnectionParameters


/***/ }),

/***/ 6298:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const EventEmitter = (__nccwpck_require__(4434).EventEmitter)

const { parse, serialize } = __nccwpck_require__(8016)
const stream = __nccwpck_require__(1326)
const { getStream } = stream

const flushBuffer = serialize.flush()
const syncBuffer = serialize.sync()
const endBuffer = serialize.end()

// TODO(bmc) support binary mode at some point
class Connection extends EventEmitter {
  constructor(config) {
    super()
    config = config || {}

    this.stream = config.stream || getStream(config.ssl)
    if (typeof this.stream === 'function') {
      this.stream = this.stream(config)
    }

    this._keepAlive = config.keepAlive
    this._keepAliveInitialDelayMillis = config.keepAliveInitialDelayMillis
    this.parsedStatements = {}
    this.submittedNamedStatements = {}
    this.ssl = config.ssl || false
    this.sslNegotiation = config.sslNegotiation || 'postgres'
    this._ending = false
    this._emitMessage = false
    const self = this
    this.on('newListener', function (eventName) {
      if (eventName === 'message') {
        self._emitMessage = true
      }
    })
  }

  connect(port, host) {
    const self = this

    this._connecting = true
    this.stream.setNoDelay(true)
    this.stream.connect(port, host)

    this.stream.once('connect', function () {
      if (self._keepAlive) {
        self.stream.setKeepAlive(true, self._keepAliveInitialDelayMillis)
      }
      self.emit('connect')
    })

    const reportStreamError = function (error) {
      // errors about disconnections should be ignored during disconnect
      if (self._ending && (error.code === 'ECONNRESET' || error.code === 'EPIPE')) {
        return
      }
      self.emit('error', error)
    }
    this.stream.on('error', reportStreamError)

    this.stream.on('close', function () {
      self.emit('end')
    })

    if (!this.ssl) {
      return this.attachListeners(this.stream)
    }

    // With direct SSL negotiation the TLS handshake starts immediately on the
    // raw socket, skipping the SSLRequest packet and the server's 'S'/'N' reply.
    if (this.sslNegotiation === 'direct') {
      return this.stream.once('connect', function () {
        self.upgradeToSSL(host, reportStreamError)
      })
    }

    this.stream.once('data', function (buffer) {
      const responseCode = buffer.toString('utf8')
      switch (responseCode) {
        case 'S': // Server supports SSL connections, continue with a secure connection
          break
        case 'N': // Server does not support SSL connections
          self.stream.end()
          return self.emit('error', new Error('The server does not support SSL connections'))
        default:
          // Any other response byte, including 'E' (ErrorResponse) indicating a server error
          self.stream.end()
          return self.emit('error', new Error('There was an error establishing an SSL connection'))
      }
      self.upgradeToSSL(host, reportStreamError)
    })
  }

  upgradeToSSL(host, reportStreamError) {
    const self = this
    const options = {
      socket: self.stream,
    }

    if (self.ssl !== true) {
      Object.assign(options, self.ssl)

      if ('key' in self.ssl) {
        options.key = self.ssl.key
      }
    }

    // Direct SSL negotiation requires ALPN so the server can confirm it is
    // speaking the PostgreSQL protocol over the TLS connection.
    if (self.sslNegotiation === 'direct') {
      options.ALPNProtocols = ['postgresql']
    }

    const net = __nccwpck_require__(9278)
    if (net.isIP && net.isIP(host) === 0) {
      options.servername = host
    }
    try {
      self.stream = stream.getSecureStream(options)
    } catch (err) {
      return self.emit('error', err)
    }
    self.attachListeners(self.stream)
    self.stream.on('error', reportStreamError)

    self.emit('sslconnect')
  }

  attachListeners(stream) {
    parse(stream, (msg) => {
      const eventName = msg.name === 'error' ? 'errorMessage' : msg.name
      if (this._emitMessage) {
        this.emit('message', msg)
      }
      this.emit(eventName, msg)
    })
  }

  requestSsl() {
    this.stream.write(serialize.requestSsl())
  }

  startup(config) {
    this.stream.write(serialize.startup(config))
  }

  cancel(processID, secretKey) {
    this._send(serialize.cancel(processID, secretKey))
  }

  password(password) {
    this._send(serialize.password(password))
  }

  sendSASLInitialResponseMessage(mechanism, initialResponse) {
    this._send(serialize.sendSASLInitialResponseMessage(mechanism, initialResponse))
  }

  sendSCRAMClientFinalMessage(additionalData) {
    this._send(serialize.sendSCRAMClientFinalMessage(additionalData))
  }

  _send(buffer) {
    if (!this.stream.writable) {
      return false
    }
    return this.stream.write(buffer)
  }

  query(text) {
    this._send(serialize.query(text))
  }

  // send parse message
  parse(query) {
    this._send(serialize.parse(query))
  }

  // send bind message
  bind(config) {
    this._send(serialize.bind(config))
  }

  // send execute message
  execute(config) {
    this._send(serialize.execute(config))
  }

  flush() {
    if (this.stream.writable) {
      this.stream.write(flushBuffer)
    }
  }

  sync() {
    this._ending = true
    this._send(syncBuffer)
  }

  ref() {
    this.stream.ref()
  }

  unref() {
    this.stream.unref()
  }

  end() {
    // 0x58 = 'X'
    this._ending = true
    if (!this._connecting || !this.stream.writable) {
      this.stream.end()
      return
    }
    return this.stream.write(endBuffer, () => {
      this.stream.end()
    })
  }

  close(msg) {
    this._send(serialize.close(msg))
  }

  describe(msg) {
    this._send(serialize.describe(msg))
  }

  sendCopyFromChunk(chunk) {
    this._send(serialize.copyData(chunk))
  }

  endCopyFrom() {
    this._send(serialize.copyDone())
  }

  sendCopyFail(msg) {
    this._send(serialize.copyFail(msg))
  }
}

module.exports = Connection


/***/ }),

/***/ 6738:
/***/ ((module) => {

function x509Error(msg, cert) {
  return new Error('SASL channel binding: ' + msg + ' when parsing public certificate ' + cert.toString('base64'))
}

function readASN1Length(data, index) {
  let length = data[index++]
  if (length < 0x80) return { length, index }

  const lengthBytes = length & 0x7f
  if (lengthBytes > 4) throw x509Error('bad length', data)

  length = 0
  for (let i = 0; i < lengthBytes; i++) {
    length = (length << 8) | data[index++]
  }

  return { length, index }
}

function readASN1OID(data, index) {
  if (data[index++] !== 0x6) throw x509Error('non-OID data', data) // 6 = OID

  const { length: OIDLength, index: indexAfterOIDLength } = readASN1Length(data, index)
  index = indexAfterOIDLength
  const lastIndex = index + OIDLength

  const byte1 = data[index++]
  let oid = ((byte1 / 40) >> 0) + '.' + (byte1 % 40)

  while (index < lastIndex) {
    // loop over numbers in OID
    let value = 0
    while (index < lastIndex) {
      // loop over bytes in number
      const nextByte = data[index++]
      value = (value << 7) | (nextByte & 0x7f)
      if (nextByte < 0x80) break
    }
    oid += '.' + value
  }

  return { oid, index }
}

function expectASN1Seq(data, index) {
  if (data[index++] !== 0x30) throw x509Error('non-sequence data', data) // 30 = Sequence
  return readASN1Length(data, index)
}

function signatureAlgorithmHashFromCertificate(data, index) {
  // read this thread: https://www.postgresql.org/message-id/17760-b6c61e752ec07060%40postgresql.org
  if (index === undefined) index = 0
  index = expectASN1Seq(data, index).index
  const { length: certInfoLength, index: indexAfterCertInfoLength } = expectASN1Seq(data, index)
  index = indexAfterCertInfoLength + certInfoLength // skip over certificate info
  index = expectASN1Seq(data, index).index // skip over signature length field
  const { oid, index: indexAfterOID } = readASN1OID(data, index)
  switch (oid) {
    // RSA
    case '1.2.840.113549.1.1.4':
      return 'MD5'
    case '1.2.840.113549.1.1.5':
      return 'SHA-1'
    case '1.2.840.113549.1.1.11':
      return 'SHA-256'
    case '1.2.840.113549.1.1.12':
      return 'SHA-384'
    case '1.2.840.113549.1.1.13':
      return 'SHA-512'
    case '1.2.840.113549.1.1.14':
      return 'SHA-224'
    case '1.2.840.113549.1.1.15':
      return 'SHA512-224'
    case '1.2.840.113549.1.1.16':
      return 'SHA512-256'
    // ECDSA
    case '1.2.840.10045.4.1':
      return 'SHA-1'
    case '1.2.840.10045.4.3.1':
      return 'SHA-224'
    case '1.2.840.10045.4.3.2':
      return 'SHA-256'
    case '1.2.840.10045.4.3.3':
      return 'SHA-384'
    case '1.2.840.10045.4.3.4':
      return 'SHA-512'
    // RSASSA-PSS: hash is indicated separately
    case '1.2.840.113549.1.1.10': {
      index = indexAfterOID
      index = expectASN1Seq(data, index).index
      if (data[index++] !== 0xa0) throw x509Error('non-tag data', data) // a0 = constructed tag 0
      index = readASN1Length(data, index).index // skip over tag length field
      index = expectASN1Seq(data, index).index // skip over sequence length field
      const { oid: hashOID } = readASN1OID(data, index)
      switch (hashOID) {
        // standalone hash OIDs
        case '1.2.840.113549.2.5':
          return 'MD5'
        case '1.3.14.3.2.26':
          return 'SHA-1'
        case '2.16.840.1.101.3.4.2.1':
          return 'SHA-256'
        case '2.16.840.1.101.3.4.2.2':
          return 'SHA-384'
        case '2.16.840.1.101.3.4.2.3':
          return 'SHA-512'
      }
      throw x509Error('unknown hash OID ' + hashOID, data)
    }
    // Ed25519 -- see https: return//github.com/openssl/openssl/issues/15477
    case '1.3.101.110':
    case '1.3.101.112': // ph
      return 'SHA-512'
    // Ed448 -- still not in pg 17.2 (if supported, digest would be SHAKE256 x 64 bytes)
    case '1.3.101.111':
    case '1.3.101.113': // ph
      throw x509Error('Ed448 certificate channel binding is not currently supported by Postgres')
  }
  throw x509Error('unknown OID ' + oid, data)
}

module.exports = { signatureAlgorithmHashFromCertificate }


/***/ }),

/***/ 7665:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {


const crypto = __nccwpck_require__(9761)
const { signatureAlgorithmHashFromCertificate } = __nccwpck_require__(6738)

// SASLprep (RFC 4013) — minimal in-tree implementation.
//
// Per RFC 5802 §2.2, the SCRAM-SHA-256 client must normalize the password via
// SASLprep before feeding it into PBKDF2. PostgreSQL's server applies the same
// SASLprep when computing the stored verifier, and libpq does the same client
// side, so passwords whose NFKC form differs from the raw form
// would otherwise authenticate against psql/libpq but fail against pg with `28P01`.
//
// We deliberately implement only the three steps that change the byte content:
//   1. RFC 3454 Table C.1.2 (non-ASCII space) → U+0020 SPACE.
//   2. RFC 3454 Table B.1 (commonly mapped to nothing) → empty.
//   3. NFKC normalization.
// We skip the prohibition (RFC 4013 §2.3) and bidi (RFC 3454 §6) checks.
// libpq is forgiving on those paths and Postgres's own SASLprep matches that
// leniency for legacy roles, so omitting the rejection logic keeps existing
// roles working without adding complexity.
function saslprep(password) {
  // RFC 3454 Table C.1.2 — non-ASCII space characters, mapped to U+0020.
  const nonAsciiSpace = /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g
  // RFC 3454 Table B.1 — "commonly mapped to nothing". The set intentionally
  // contains zero-width joiners and variation selectors — the very characters
  // ESLint's no-misleading-character-class warns about — because they combine
  // with their neighbors and the RFC strips them for that reason.
  // eslint-disable-next-line no-misleading-character-class
  const mappedToNothing = /[\u00AD\u034F\u1806\u180B\u180C\u180D\u200C\u200D\u2060\uFE00-\uFE0F\uFEFF]/g
  return password.replace(nonAsciiSpace, ' ').replace(mappedToNothing, '').normalize('NFKC')
}

const DEFAULT_MAX_SCRAM_ITERATIONS = 100000

function startSession(mechanisms, stream, scramMaxIterations = DEFAULT_MAX_SCRAM_ITERATIONS) {
  const candidates = ['SCRAM-SHA-256']
  if (stream) candidates.unshift('SCRAM-SHA-256-PLUS') // higher-priority, so placed first

  const mechanism = candidates.find((candidate) => mechanisms.includes(candidate))

  if (!mechanism) {
    throw new Error('SASL: Only mechanism(s) ' + candidates.join(' and ') + ' are supported')
  }

  if (mechanism === 'SCRAM-SHA-256-PLUS' && typeof stream.getPeerCertificate !== 'function') {
    // this should never happen if we are really talking to a Postgres server
    throw new Error('SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate')
  }

  const clientNonce = crypto.randomBytes(18).toString('base64')
  const gs2Header = mechanism === 'SCRAM-SHA-256-PLUS' ? 'p=tls-server-end-point' : stream ? 'y' : 'n'

  return {
    mechanism,
    clientNonce,
    response: gs2Header + ',,n=*,r=' + clientNonce,
    message: 'SASLInitialResponse',
    scramMaxIterations,
  }
}

async function continueSession(session, password, serverData, stream) {
  if (session.message !== 'SASLInitialResponse') {
    throw new Error('SASL: Last message was not SASLInitialResponse')
  }
  if (typeof password !== 'string') {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string')
  }
  if (password === '') {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string')
  }
  if (typeof serverData !== 'string') {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string')
  }

  const sv = parseServerFirstMessage(serverData)

  if (!sv.nonce.startsWith(session.clientNonce)) {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce')
  } else if (sv.nonce.length === session.clientNonce.length) {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short')
  }

  const scramMaxIterations =
    typeof session.scramMaxIterations === 'number' ? session.scramMaxIterations : DEFAULT_MAX_SCRAM_ITERATIONS
  // a value of 0 disables the iteration count check
  if (scramMaxIterations !== 0 && sv.iteration > scramMaxIterations) {
    throw new Error(
      'SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration count ' +
        sv.iteration +
        ' exceeds scramMaxIterations of ' +
        scramMaxIterations
    )
  }

  const clientFirstMessageBare = 'n=*,r=' + session.clientNonce
  const serverFirstMessage = 'r=' + sv.nonce + ',s=' + sv.salt + ',i=' + sv.iteration

  // without channel binding:
  let channelBinding = stream ? 'eSws' : 'biws' // 'y,,' or 'n,,', base64-encoded

  // override if channel binding is in use:
  if (session.mechanism === 'SCRAM-SHA-256-PLUS') {
    const peerCert = stream.getPeerCertificate().raw
    let hashName = signatureAlgorithmHashFromCertificate(peerCert)
    if (hashName === 'MD5' || hashName === 'SHA-1') hashName = 'SHA-256'
    const certHash = await crypto.hashByName(hashName, peerCert)
    const bindingData = Buffer.concat([Buffer.from('p=tls-server-end-point,,'), Buffer.from(certHash)])
    channelBinding = bindingData.toString('base64')
  }

  const clientFinalMessageWithoutProof = 'c=' + channelBinding + ',r=' + sv.nonce
  const authMessage = clientFirstMessageBare + ',' + serverFirstMessage + ',' + clientFinalMessageWithoutProof

  const saltBytes = Buffer.from(sv.salt, 'base64')
  const saltedPassword = await crypto.deriveKey(saslprep(password), saltBytes, sv.iteration)
  const clientKey = await crypto.hmacSha256(saltedPassword, 'Client Key')
  const storedKey = await crypto.sha256(clientKey)
  const clientSignature = await crypto.hmacSha256(storedKey, authMessage)
  const clientProof = xorBuffers(Buffer.from(clientKey), Buffer.from(clientSignature)).toString('base64')
  const serverKey = await crypto.hmacSha256(saltedPassword, 'Server Key')
  const serverSignatureBytes = await crypto.hmacSha256(serverKey, authMessage)

  session.message = 'SASLResponse'
  session.serverSignature = Buffer.from(serverSignatureBytes).toString('base64')
  session.response = clientFinalMessageWithoutProof + ',p=' + clientProof
}

function finalizeSession(session, serverData) {
  if (session.message !== 'SASLResponse') {
    throw new Error('SASL: Last message was not SASLResponse')
  }
  if (typeof serverData !== 'string') {
    throw new Error('SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string')
  }

  const { serverSignature } = parseServerFinalMessage(serverData)

  if (serverSignature !== session.serverSignature) {
    throw new Error('SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match')
  }
}

/**
 * printable       = %x21-2B / %x2D-7E
 *                   ;; Printable ASCII except ",".
 *                   ;; Note that any "printable" is also
 *                   ;; a valid "value".
 */
function isPrintableChars(text) {
  if (typeof text !== 'string') {
    throw new TypeError('SASL: text must be a string')
  }
  return text
    .split('')
    .map((_, i) => text.charCodeAt(i))
    .every((c) => (c >= 0x21 && c <= 0x2b) || (c >= 0x2d && c <= 0x7e))
}

/**
 * base64-char     = ALPHA / DIGIT / "/" / "+"
 *
 * base64-4        = 4base64-char
 *
 * base64-3        = 3base64-char "="
 *
 * base64-2        = 2base64-char "=="
 *
 * base64          = *base64-4 [base64-3 / base64-2]
 */
function isBase64(text) {
  return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(text)
}

function parseAttributePairs(text) {
  if (typeof text !== 'string') {
    throw new TypeError('SASL: attribute pairs text must be a string')
  }

  return new Map(
    text.split(',').map((attrValue) => {
      if (!/^.=/.test(attrValue)) {
        throw new Error('SASL: Invalid attribute pair entry')
      }
      const name = attrValue[0]
      const value = attrValue.substring(2)
      return [name, value]
    })
  )
}

function parseServerFirstMessage(data) {
  const attrPairs = parseAttributePairs(data)

  const nonce = attrPairs.get('r')
  if (!nonce) {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing')
  } else if (!isPrintableChars(nonce)) {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters')
  }
  const salt = attrPairs.get('s')
  if (!salt) {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing')
  } else if (!isBase64(salt)) {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64')
  }
  const iterationText = attrPairs.get('i')
  if (!iterationText) {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing')
  } else if (!/^[1-9][0-9]*$/.test(iterationText)) {
    throw new Error('SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count')
  }
  const iteration = parseInt(iterationText, 10)

  return {
    nonce,
    salt,
    iteration,
  }
}

function parseServerFinalMessage(serverData) {
  const attrPairs = parseAttributePairs(serverData)
  const error = attrPairs.get('e')
  const serverSignature = attrPairs.get('v')

  if (error) {
    throw new Error(`SASL: SCRAM-SERVER-FINAL-MESSAGE: server returned error: "${error}"`)
  }

  if (!serverSignature) {
    throw new Error('SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing')
  } else if (!isBase64(serverSignature)) {
    throw new Error('SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64')
  }
  return {
    serverSignature,
  }
}

function xorBuffers(a, b) {
  if (!Buffer.isBuffer(a)) {
    throw new TypeError('first argument must be a Buffer')
  }
  if (!Buffer.isBuffer(b)) {
    throw new TypeError('second argument must be a Buffer')
  }
  if (a.length !== b.length) {
    throw new Error('Buffer lengths must match')
  }
  if (a.length === 0) {
    throw new Error('Buffers cannot be empty')
  }
  return Buffer.from(a.map((_, i) => a[i] ^ b[i]))
}

module.exports = {
  startSession,
  continueSession,
  finalizeSession,
  DEFAULT_MAX_SCRAM_ITERATIONS,
}


/***/ }),

/***/ 9761:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const nodeCrypto = __nccwpck_require__(6982)

module.exports = {
  postgresMd5PasswordHash,
  randomBytes,
  deriveKey,
  sha256,
  hashByName,
  hmacSha256,
  md5,
}

/**
 * The Web Crypto API - grabbed from the Node.js library or the global
 * @type Crypto
 */
// eslint-disable-next-line no-undef
const webCrypto = nodeCrypto.webcrypto || globalThis.crypto
/**
 * The SubtleCrypto API for low level crypto operations.
 * @type SubtleCrypto
 */
const subtleCrypto = webCrypto.subtle
const textEncoder = new TextEncoder()

/**
 *
 * @param {*} length
 * @returns
 */
function randomBytes(length) {
  return webCrypto.getRandomValues(Buffer.alloc(length))
}

async function md5(string) {
  try {
    return nodeCrypto.createHash('md5').update(string, 'utf-8').digest('hex')
  } catch (e) {
    // `createHash()` failed so we are probably not in Node.js, use the WebCrypto API instead.
    // Note that the MD5 algorithm on WebCrypto is not available in Node.js.
    // This is why we cannot just use WebCrypto in all environments.
    const data = typeof string === 'string' ? textEncoder.encode(string) : string
    const hash = await subtleCrypto.digest('MD5', data)
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

// See AuthenticationMD5Password at https://www.postgresql.org/docs/current/static/protocol-flow.html
async function postgresMd5PasswordHash(user, password, salt) {
  const inner = await md5(password + user)
  const outer = await md5(Buffer.concat([Buffer.from(inner), salt]))
  return 'md5' + outer
}

/**
 * Create a SHA-256 digest of the given data
 * @param {Buffer} data
 */
async function sha256(text) {
  return await subtleCrypto.digest('SHA-256', text)
}

async function hashByName(hashName, text) {
  return await subtleCrypto.digest(hashName, text)
}

/**
 * Sign the message with the given key
 * @param {ArrayBuffer} keyBuffer
 * @param {string} msg
 */
async function hmacSha256(keyBuffer, msg) {
  const key = await subtleCrypto.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return await subtleCrypto.sign('HMAC', key, textEncoder.encode(msg))
}

/**
 * Derive a key from the password and salt
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {number} iterations
 */
async function deriveKey(password, salt, iterations) {
  const key = await subtleCrypto.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const params = { name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iterations }
  return await subtleCrypto.deriveBits(params, key, 32 * 8, ['deriveBits'])
}


/***/ }),

/***/ 2228:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



let user
try {
  user = process.platform === 'win32' ? process.env.USERNAME : process.env.USER
} catch {
  // ignore, e.g., Deno without --allow-env
}

module.exports = {
  // database host. defaults to localhost
  host: 'localhost',

  // database user's name
  user,

  // name of database to connect
  database: undefined,

  // database user's password
  password: null,

  // a Postgres connection string to be used instead of setting individual connection items
  // NOTE:  Setting this value will cause it to override any other value (such as database or user) defined
  // in the defaults object.
  connectionString: undefined,

  // database port
  port: 5432,

  // number of rows to return at a time from a prepared statement's
  // portal. 0 will return all rows at once
  rows: 0,

  // binary result mode
  binary: false,

  // Connection pool options - see https://github.com/brianc/node-pg-pool

  // number of connections to use in connection pool
  // 0 will disable connection pooling
  max: 10,

  // max milliseconds a client can go unused before it is removed
  // from the pool and destroyed
  idleTimeoutMillis: 30000,

  client_encoding: '',

  ssl: false,

  // SSL negotiation style: 'postgres' (traditional SSLRequest) or 'direct'
  sslnegotiation: undefined,

  application_name: undefined,

  fallback_application_name: undefined,

  options: undefined,

  parseInputDatesAsUTC: false,

  // max milliseconds any query using this connection will execute for before timing out in error.
  // false=unlimited
  statement_timeout: false,

  // Abort any statement that waits longer than the specified duration in milliseconds while attempting to acquire a lock.
  // false=unlimited
  lock_timeout: false,

  // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds
  // false=unlimited
  idle_in_transaction_session_timeout: false,

  // max milliseconds to wait for query to complete (client side)
  query_timeout: false,

  connect_timeout: 0,

  keepalives: 1,

  keepalives_idle: 0,
}

const pgTypes = __nccwpck_require__(3408)
// save default parsers
const parseBigInteger = pgTypes.getTypeParser(20, 'text')
const parseBigIntegerArray = pgTypes.getTypeParser(1016, 'text')

// parse int8 so you can get your count values as actual numbers
module.exports.__defineSetter__('parseInt8', function (val) {
  pgTypes.setTypeParser(20, 'text', val ? pgTypes.getTypeParser(23, 'text') : parseBigInteger)
  pgTypes.setTypeParser(1016, 'text', val ? pgTypes.getTypeParser(1007, 'text') : parseBigIntegerArray)
})


/***/ }),

/***/ 5264:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const Client = __nccwpck_require__(5785)
const defaults = __nccwpck_require__(2228)
const Connection = __nccwpck_require__(6298)
const Result = __nccwpck_require__(6875)
const utils = __nccwpck_require__(1657)
const Pool = __nccwpck_require__(2041)
const TypeOverrides = __nccwpck_require__(6002)
const { DatabaseError } = __nccwpck_require__(8016)
const { escapeIdentifier, escapeLiteral } = __nccwpck_require__(1657)

const poolFactory = (Client) => {
  return class BoundPool extends Pool {
    constructor(options) {
      super(options, Client)
    }
  }
}

const PG = function (clientConstructor) {
  this.defaults = defaults
  this.Client = clientConstructor
  this.Query = this.Client.Query
  this.Pool = poolFactory(this.Client)
  this._pools = []
  this.Connection = Connection
  this.types = __nccwpck_require__(3408)
  this.DatabaseError = DatabaseError
  this.TypeOverrides = TypeOverrides
  this.escapeIdentifier = escapeIdentifier
  this.escapeLiteral = escapeLiteral
  this.Result = Result
  this.utils = utils
}

let clientConstructor = Client

let forceNative = false
try {
  forceNative = !!process.env.NODE_PG_FORCE_NATIVE
} catch {
  // ignore, e.g., Deno without --allow-env
}

if (forceNative) {
  clientConstructor = __nccwpck_require__(7862)
}

module.exports = new PG(clientConstructor)

// lazy require native module...the native module may not have installed
Object.defineProperty(module.exports, "native", ({
  configurable: true,
  enumerable: false,
  get() {
    let native = null
    try {
      native = new PG(__nccwpck_require__(7862))
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        throw err
      }
    }

    // overwrite module.exports.native so that getter is never called again
    Object.defineProperty(module.exports, "native", ({
      value: native,
    }))

    return native
  },
}))


/***/ }),

/***/ 5631:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const nodeUtils = __nccwpck_require__(9023)
// eslint-disable-next-line
var Native
// eslint-disable-next-line no-useless-catch
try {
  // Wrap this `require()` in a try-catch to avoid upstream bundlers from complaining that this might not be available since it is an optional import
  Native = __nccwpck_require__(9797)
} catch (e) {
  throw e
}
const TypeOverrides = __nccwpck_require__(6002)
const EventEmitter = (__nccwpck_require__(4434).EventEmitter)
const util = __nccwpck_require__(9023)
const ConnectionParameters = __nccwpck_require__(2231)

const NativeQuery = __nccwpck_require__(9198)

const queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
  () => {},
  'Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead.'
)

const Client = (module.exports = function (config) {
  EventEmitter.call(this)
  config = config || {}

  this._Promise = config.Promise || global.Promise
  this._types = new TypeOverrides(config.types)

  this.native = new Native({
    types: this._types,
  })

  this._queryQueue = []
  this._ending = false
  this._connecting = false
  this._connected = false
  this._queryable = true
  this.pipeline = Boolean(config.pipeline)
  this._pipelineInFlight = false

  // keep these on the object for legacy reasons
  // for the time being. TODO: deprecate all this jazz
  const cp = (this.connectionParameters = new ConnectionParameters(config))
  if (config.nativeConnectionString) cp.nativeConnectionString = config.nativeConnectionString
  this.user = cp.user

  // "hiding" the password so it doesn't show up in stack traces
  // or if the client is console.logged
  Object.defineProperty(this, 'password', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: cp.password,
  })
  this.database = cp.database
  this.host = cp.host
  this.port = cp.port

  // a hash to hold named queries
  this.namedQueries = {}
})

Client.Query = NativeQuery

util.inherits(Client, EventEmitter)

Client.prototype._errorAllQueries = function (err) {
  const enqueueError = (query) => {
    process.nextTick(() => {
      query.native = this.native
      query.handleError(err)
    })
  }

  if (this._hasActiveQuery()) {
    enqueueError(this._activeQuery)
    this._activeQuery = null
  }

  this._queryQueue.forEach(enqueueError)
  this._queryQueue.length = 0
}

// connect to the backend
// pass an optional callback to be called once connected
// or with an error if there was a connection error
Client.prototype._connect = function (cb) {
  const self = this

  if (this._connecting) {
    process.nextTick(() => cb(new Error('Client has already been connected. You cannot reuse a client.')))
    return
  }

  this._connecting = true

  this.connectionParameters.getLibpqConnectionString(function (err, conString) {
    if (self.connectionParameters.nativeConnectionString) conString = self.connectionParameters.nativeConnectionString
    if (err) return cb(err)
    self.native.connect(conString, function (err) {
      if (err) {
        self.native.end()
        return cb(err)
      }

      // set internal states to connected
      self._connected = true

      // handle connection errors from the native layer
      self.native.on('error', function (err) {
        self._queryable = false
        self._errorAllQueries(err)
        self.emit('error', err)
      })

      self.native.on('notification', function (msg) {
        self.emit('notification', {
          channel: msg.relname,
          payload: msg.extra,
        })
      })

      // signal we are connected now
      self.emit('connect')
      self._pulseQueryQueue(true)

      cb(null, this)
    })
  })
}

Client.prototype.connect = function (callback) {
  if (callback) {
    this._connect(callback)
    return
  }

  return new this._Promise((resolve, reject) => {
    this._connect((error) => {
      if (error) {
        reject(error)
      } else {
        resolve(this)
      }
    })
  })
}

// send a query to the server
// this method is highly overloaded to take
// 1) string query, optional array of parameters, optional function callback
// 2) object query with {
//    string query
//    optional array values,
//    optional function callback instead of as a separate parameter
//    optional string name to name & cache the query plan
//    optional string rowMode = 'array' for an array of results
//  }
Client.prototype.query = function (config, values, callback) {
  let query
  let result
  let readTimeout
  let readTimeoutTimer
  let queryCallback

  if (config === null || config === undefined) {
    throw new TypeError('Client was passed a null or undefined query')
  } else if (typeof config.submit === 'function') {
    readTimeout = config.query_timeout || this.connectionParameters.query_timeout
    result = query = config
    // accept query(new Query(...), (err, res) => { }) style
    if (typeof values === 'function') {
      config.callback = values
    }
  } else {
    readTimeout = config.query_timeout || this.connectionParameters.query_timeout
    query = new NativeQuery(config, values, callback)
    if (!query.callback) {
      let resolveOut, rejectOut
      result = new this._Promise((resolve, reject) => {
        resolveOut = resolve
        rejectOut = reject
      }).catch((err) => {
        Error.captureStackTrace(err)
        throw err
      })
      query.callback = (err, res) => (err ? rejectOut(err) : resolveOut(res))
    }
  }

  if (readTimeout) {
    queryCallback = query.callback || (() => {})

    readTimeoutTimer = setTimeout(() => {
      const error = new Error('Query read timeout')

      process.nextTick(() => {
        query.handleError(error, this.connection)
      })

      queryCallback(error)

      // we already returned an error,
      // just do nothing if query completes
      query.callback = () => {}

      // Remove from queue
      const index = this._queryQueue.indexOf(query)
      if (index > -1) {
        this._queryQueue.splice(index, 1)
      }

      this._pulseQueryQueue()
    }, readTimeout)

    query.callback = (err, res) => {
      clearTimeout(readTimeoutTimer)
      queryCallback(err, res)
    }
  }

  if (!this._queryable) {
    query.native = this.native
    process.nextTick(() => {
      query.handleError(new Error('Client has encountered a connection error and is not queryable'))
    })
    return result
  }

  if (this._ending) {
    query.native = this.native
    process.nextTick(() => {
      query.handleError(new Error('Client was closed and is not queryable'))
    })
    return result
  }

  if (this._queryQueue.length > 0 && !this.pipeline) {
    queryQueueLengthDeprecationNotice()
  }

  this._queryQueue.push(query)
  this._pulseQueryQueue()
  return result
}

// disconnect from the backend server
Client.prototype.end = function (cb) {
  const self = this

  this._ending = true

  if (this._connecting && !this._connected) {
    this.once('connect', () => {
      this.end(() => {})
    })
  }
  let result
  if (!cb) {
    result = new this._Promise(function (resolve, reject) {
      cb = (err) => (err ? reject(err) : resolve())
    })
  }

  const doEnd = function () {
    self.native.end(function () {
      self._connected = false

      self._errorAllQueries(new Error('Connection terminated'))

      process.nextTick(() => {
        self.emit('end')
        if (cb) cb()
      })
    })
  }

  // If pipeline has in-flight or queued queries, wait for them to drain before closing
  if (this.pipeline && (this._pipelineInFlight || this._queryQueue.length > 0)) {
    this.once('drain', doEnd)
  } else {
    doEnd()
  }
  return result
}

Client.prototype._hasActiveQuery = function () {
  return this._activeQuery && this._activeQuery.state !== 'error' && this._activeQuery.state !== 'end'
}

Client.prototype._pulseQueryQueue = function (initialConnection) {
  if (!this._connected) {
    return
  }
  if (this.pipeline && !initialConnection) {
    return this._pulsePipelinedQueryQueue()
  }
  if (this._hasActiveQuery()) {
    return
  }
  const query = this._queryQueue.shift()
  if (!query) {
    if (!initialConnection) {
      this.emit('drain')
    }
    return
  }
  this._activeQuery = query
  query.submit(this)
  const self = this
  query.once('_done', function () {
    self._pulseQueryQueue()
  })
}

Client.prototype._pulsePipelinedQueryQueue = function () {
  if (!this._connected || this._pipelineInFlight) {
    return
  }
  if (this._queryQueue.length === 0) {
    if (this.hasExecuted) {
      this.emit('drain')
    }
    return
  }

  this._pipelineInFlight = true
  const self = this
  const queries = []
  const nativeQueries = []
  const utils = __nccwpck_require__(1657)

  while (this._queryQueue.length > 0) {
    const query = this._queryQueue.shift()
    this.hasExecuted = true
    nativeQueries.push(query)

    const values = query.values ? query.values.map(utils.prepareValue) : null
    const pipelineEntry = { text: query.text, name: query.name }
    if (values) {
      pipelineEntry.values = values
    }
    if (query.name && this.namedQueries[query.name]) {
      pipelineEntry._alreadyPrepared = true
    }
    queries.push(pipelineEntry)
  }

  this.native.pipeline(queries, function (err, results) {
    self._pipelineInFlight = false

    if (err) {
      // Total pipeline failure — error all queries
      for (let i = 0; i < nativeQueries.length; i++) {
        const q = nativeQueries[i]
        q.native = self.native
        q.handleError(err)
      }
      self._pulsePipelinedQueryQueue()
      return
    }

    // Deliver results to each query
    for (let i = 0; i < nativeQueries.length; i++) {
      const q = nativeQueries[i]
      const r = results[i]
      q.native = self.native

      if (r.err) {
        q.handleError(r.err)
      } else {
        // Track named queries on success
        if (q.name) {
          self.namedQueries[q.name] = q.text
        }
        q.state = 'end'
        q.emit('end', r.result)
        if (q.callback) {
          q.callback(null, r.result)
        }
      }

      setImmediate(function () {
        q.emit('_done')
      })
    }

    // Process any queries that arrived while we were reading
    self._pulsePipelinedQueryQueue()
  })
}

// attempt to cancel an in-progress query
Client.prototype.cancel = function (query) {
  if (this._activeQuery === query) {
    this.native.cancel(function () {})
  } else if (this._queryQueue.indexOf(query) !== -1) {
    this._queryQueue.splice(this._queryQueue.indexOf(query), 1)
  }
}

Client.prototype.ref = function () {}
Client.prototype.unref = function () {}

Client.prototype.setTypeParser = function (oid, format, parseFn) {
  return this._types.setTypeParser(oid, format, parseFn)
}

Client.prototype.getTypeParser = function (oid, format) {
  return this._types.getTypeParser(oid, format)
}

Client.prototype.isConnected = function () {
  return this._connected
}

Client.prototype.getTransactionStatus = function () {
  return this.native.getTransactionStatus()
}


/***/ }),

/***/ 7862:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {


module.exports = __nccwpck_require__(5631)


/***/ }),

/***/ 9198:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const EventEmitter = (__nccwpck_require__(4434).EventEmitter)
const util = __nccwpck_require__(9023)
const utils = __nccwpck_require__(1657)

const NativeQuery = (module.exports = function (config, values, callback) {
  EventEmitter.call(this)
  config = utils.normalizeQueryConfig(config, values, callback)
  this.text = config.text
  this.values = config.values
  this.name = config.name
  this.queryMode = config.queryMode
  this.callback = config.callback
  this.state = 'new'
  this._arrayMode = config.rowMode === 'array'

  // if the 'row' event is listened for
  // then emit them as they come in
  // without setting singleRowMode to true
  // this has almost no meaning because libpq
  // reads all rows into memory before returning any
  this._emitRowEvents = false
  this.on(
    'newListener',
    function (event) {
      if (event === 'row') this._emitRowEvents = true
    }.bind(this)
  )
})

util.inherits(NativeQuery, EventEmitter)

const errorFieldMap = {
  sqlState: 'code',
  statementPosition: 'position',
  messagePrimary: 'message',
  context: 'where',
  schemaName: 'schema',
  tableName: 'table',
  columnName: 'column',
  dataTypeName: 'dataType',
  constraintName: 'constraint',
  sourceFile: 'file',
  sourceLine: 'line',
  sourceFunction: 'routine',
}

NativeQuery.prototype.handleError = function (err) {
  // copy pq error fields into the error object
  const fields = this.native && this.native.pq.resultErrorFields()
  if (fields) {
    for (const key in fields) {
      const normalizedFieldName = errorFieldMap[key] || key
      err[normalizedFieldName] = fields[key]
    }
  }
  if (this.callback) {
    this.callback(err)
  } else {
    this.emit('error', err)
  }
  this.state = 'error'
}

NativeQuery.prototype.then = function (onSuccess, onFailure) {
  return this._getPromise().then(onSuccess, onFailure)
}

NativeQuery.prototype.catch = function (callback) {
  return this._getPromise().catch(callback)
}

NativeQuery.prototype._getPromise = function () {
  if (this._promise) return this._promise
  this._promise = new Promise(
    function (resolve, reject) {
      this._once('end', resolve)
      this._once('error', reject)
    }.bind(this)
  )
  return this._promise
}

NativeQuery.prototype.submit = function (client) {
  this.state = 'running'
  const self = this
  this.native = client.native
  client.native.arrayMode = this._arrayMode

  let after = function (err, rows, results) {
    client.native.arrayMode = false
    setImmediate(function () {
      self.emit('_done')
    })

    // handle possible query error
    if (err) {
      return self.handleError(err)
    }

    // emit row events for each row in the result
    if (self._emitRowEvents) {
      if (results.length > 1) {
        rows.forEach((rowOfRows, i) => {
          rowOfRows.forEach((row) => {
            self.emit('row', row, results[i])
          })
        })
      } else {
        rows.forEach(function (row) {
          self.emit('row', row, results)
        })
      }
    }

    // handle successful result
    self.state = 'end'
    self.emit('end', results)
    if (self.callback) {
      self.callback(null, results)
    }
  }

  if (process.domain) {
    after = process.domain.bind(after)
  }

  // named query
  if (this.name) {
    if (this.name.length > 63) {
      console.error('Warning! Postgres only supports 63 characters for query names.')
      console.error('You supplied %s (%s)', this.name, this.name.length)
      console.error('This can cause conflicts and silent errors executing queries')
    }
    const values = (this.values || []).map(utils.prepareValue)

    // check if the client has already executed this named query
    // if so...just execute it again - skip the planning phase
    if (client.namedQueries[this.name]) {
      if (this.text && client.namedQueries[this.name] !== this.text) {
        const err = new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`)
        return after(err)
      }
      return client.native.execute(this.name, values, after)
    }
    // plan the named query the first time, then execute it
    return client.native.prepare(this.name, this.text, values.length, function (err) {
      if (err) return after(err)
      client.namedQueries[self.name] = self.text
      return self.native.execute(self.name, values, after)
    })
  } else if (this.values) {
    if (!Array.isArray(this.values)) {
      const err = new Error('Query values must be an array')
      return after(err)
    }
    const vals = this.values.map(utils.prepareValue)
    client.native.query(this.text, vals, after)
  } else if (this.queryMode === 'extended') {
    client.native.query(this.text, [], after)
  } else {
    client.native.query(this.text, after)
  }
}


/***/ }),

/***/ 4752:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const { EventEmitter } = __nccwpck_require__(4434)

const Result = __nccwpck_require__(6875)
const utils = __nccwpck_require__(1657)

class Query extends EventEmitter {
  constructor(config, values, callback) {
    super()

    config = utils.normalizeQueryConfig(config, values, callback)

    this.text = config.text
    this.values = config.values
    this.rows = config.rows
    this.types = config.types
    this.name = config.name
    this.queryMode = config.queryMode
    this.binary = config.binary
    // use unique portal name each time
    this.portal = config.portal || ''
    this.callback = config.callback
    this._rowMode = config.rowMode
    if (process.domain && config.callback) {
      this.callback = process.domain.bind(config.callback)
    }
    this._result = new Result(this._rowMode, this.types)

    // potential for multiple results
    this._results = this._result
    this._canceledDueToError = false
  }

  requiresPreparation() {
    if (this.queryMode === 'extended') {
      return true
    }

    // named queries must always be prepared
    if (this.name) {
      return true
    }
    // always prepare if there are max number of rows expected per
    // portal execution
    if (this.rows) {
      return true
    }
    // don't prepare empty text queries
    if (!this.text) {
      return false
    }
    // prepare if there are values
    if (!this.values) {
      return false
    }
    return this.values.length > 0
  }

  _checkForMultirow() {
    // if we already have a result with a command property
    // then we've already executed one query in a multi-statement simple query
    // turn our results into an array of results
    if (this._result.command) {
      if (!Array.isArray(this._results)) {
        this._results = [this._result]
      }
      this._result = new Result(this._rowMode, this._result._types)
      this._results.push(this._result)
    }
  }

  // associates row metadata from the supplied
  // message with this query object
  // metadata used when parsing row results
  handleRowDescription(msg) {
    this._checkForMultirow()
    this._result.addFields(msg.fields)
    this._accumulateRows = this.callback || !this.listeners('row').length
  }

  handleDataRow(msg) {
    let row

    if (this._canceledDueToError) {
      return
    }

    try {
      row = this._result.parseRow(msg.fields)
    } catch (err) {
      this._canceledDueToError = err
      return
    }

    this.emit('row', row, this._result)
    if (this._accumulateRows) {
      this._result.addRow(row)
    }
  }

  handleCommandComplete(msg, connection) {
    this._checkForMultirow()
    this._result.addCommandComplete(msg)
    // need to sync after each command complete of a prepared statement
    // if we were using a row count which results in multiple calls to _getRows
    if (this.rows) {
      connection.sync()
    }
  }

  // if a named prepared statement is created with empty query text
  // the backend will send an emptyQuery message but *not* a command complete message
  // since we pipeline sync immediately after execute we don't need to do anything here
  // unless we have rows specified, in which case we did not pipeline the initial sync call
  handleEmptyQuery(connection) {
    if (this.rows) {
      connection.sync()
    }
  }

  handleError(err, connection) {
    // need to sync after error during a prepared statement
    if (this._canceledDueToError) {
      err = this._canceledDueToError
      this._canceledDueToError = false
    }
    // if callback supplied do not emit error event as uncaught error
    // events will bubble up to node process
    if (this.callback) {
      return this.callback(err)
    }
    this.emit('error', err)
  }

  handleReadyForQuery(con) {
    if (this._canceledDueToError) {
      return this.handleError(this._canceledDueToError, con)
    }
    if (this.callback) {
      try {
        this.callback(null, this._results)
      } catch (err) {
        process.nextTick(() => {
          throw err
        })
      }
    }
    this.emit('end', this._results)
  }

  submit(connection) {
    if (typeof this.text !== 'string' && typeof this.name !== 'string') {
      return new Error('A query must have either text or a name. Supplying neither is unsupported.')
    }
    const previous = connection.parsedStatements[this.name] || connection.submittedNamedStatements[this.name]
    if (this.text && previous && this.text !== previous) {
      return new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`)
    }
    if (this.values && !Array.isArray(this.values)) {
      return new Error('Query values must be an array')
    }
    if (this.requiresPreparation()) {
      // If we're using the extended query protocol we fire off several separate commands
      // to the backend. On some versions of node & some operating system versions
      // the network stack writes each message separately instead of buffering them together
      // causing the client & network to send more slowly. Corking & uncorking the stream
      // allows node to buffer up the messages internally before sending them all off at once.
      // note: we're checking for existence of cork/uncork because some versions of streams
      // might not have this (cloudflare?)
      connection.stream.cork && connection.stream.cork()
      try {
        this.prepare(connection)
      } finally {
        // while unlikely for this.prepare to throw, if it does & we don't uncork this stream
        // this client becomes unresponsive, so put in finally block "just in case"
        connection.stream.uncork && connection.stream.uncork()
      }
    } else {
      connection.query(this.text)
    }
    return null
  }

  hasBeenParsed(connection) {
    return this.name && (connection.parsedStatements[this.name] || connection.submittedNamedStatements[this.name])
  }

  handlePortalSuspended(connection) {
    this._getRows(connection, this.rows)
  }

  _getRows(connection, rows) {
    connection.execute({
      portal: this.portal,
      rows: rows,
    })
    // if we're not reading pages of rows send the sync command
    // to indicate the pipeline is finished
    if (!rows) {
      connection.sync()
    } else {
      // otherwise flush the call out to read more rows
      connection.flush()
    }
  }

  // http://developer.postgresql.org/pgdocs/postgres/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY
  prepare(connection) {
    // TODO refactor this poor encapsulation
    if (!this.hasBeenParsed(connection)) {
      connection.parse({
        text: this.text,
        name: this.name,
        types: this.types,
      })
      if (this.name) {
        connection.submittedNamedStatements[this.name] = this.text
      }
    }

    // because we're mapping user supplied values to
    // postgres wire protocol compatible values it could
    // throw an exception, so try/catch this section
    try {
      connection.bind({
        portal: this.portal,
        statement: this.name,
        values: this.values,
        binary: this.binary,
        valueMapper: utils.prepareValue,
      })
    } catch (err) {
      // we should close parse to avoid leaking connections
      connection.close({ type: 'S', name: this.name })
      connection.sync()

      this.handleError(err, connection)
      return
    }

    connection.describe({
      type: 'P',
      name: this.portal || '',
    })

    this._getRows(connection, this.rows)
  }

  handleCopyInResponse(connection) {
    connection.sendCopyFail('No source stream defined')
  }

  handleCopyData(msg, connection) {
    // noop
  }
}

module.exports = Query


/***/ }),

/***/ 6875:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const types = __nccwpck_require__(3408)

const matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/

// result object returned from query
// in the 'end' event and also
// passed as second argument to provided callback
class Result {
  constructor(rowMode, types) {
    this.command = null
    this.rowCount = null
    this.oid = null
    this.rows = []
    this.fields = []
    this._parsers = undefined
    this._types = types
    this.RowCtor = null
    this.rowAsArray = rowMode === 'array'
    if (this.rowAsArray) {
      this.parseRow = this._parseRowAsArray
    }
    this._prebuiltEmptyResultObject = null
  }

  // adds a command complete message
  addCommandComplete(msg) {
    let match
    if (msg.text) {
      // pure javascript
      match = matchRegexp.exec(msg.text)
    } else {
      // native bindings
      match = matchRegexp.exec(msg.command)
    }
    if (match) {
      this.command = match[1]
      if (match[3]) {
        // COMMAND OID ROWS
        this.oid = parseInt(match[2], 10)
        this.rowCount = parseInt(match[3], 10)
      } else if (match[2]) {
        // COMMAND ROWS
        this.rowCount = parseInt(match[2], 10)
      }
    }
  }

  _parseRowAsArray(rowData) {
    const row = new Array(rowData.length)
    for (let i = 0, len = rowData.length; i < len; i++) {
      const rawValue = rowData[i]
      if (rawValue !== null) {
        row[i] = this._parsers[i](rawValue)
      } else {
        row[i] = null
      }
    }
    return row
  }

  parseRow(rowData) {
    const row = { ...this._prebuiltEmptyResultObject }
    for (let i = 0, len = rowData.length; i < len; i++) {
      const rawValue = rowData[i]
      const field = this.fields[i].name
      if (rawValue !== null) {
        const v = this.fields[i].format === 'binary' ? Buffer.from(rawValue) : rawValue
        row[field] = this._parsers[i](v)
      } else {
        row[field] = null
      }
    }
    return row
  }

  addRow(row) {
    this.rows.push(row)
  }

  addFields(fieldDescriptions) {
    // clears field definitions
    // multiple query statements in 1 action can result in multiple sets
    // of rowDescriptions...eg: 'select NOW(); select 1::int;'
    // you need to reset the fields
    this.fields = fieldDescriptions
    if (this.fields.length) {
      this._parsers = new Array(fieldDescriptions.length)
    }

    const row = Object.create(null)

    for (let i = 0; i < fieldDescriptions.length; i++) {
      const desc = fieldDescriptions[i]
      row[desc.name] = null

      if (this._types) {
        this._parsers[i] = this._types.getTypeParser(desc.dataTypeID, desc.format || 'text')
      } else {
        this._parsers[i] = types.getTypeParser(desc.dataTypeID, desc.format || 'text')
      }
    }

    this._prebuiltEmptyResultObject = { ...row }
  }
}

module.exports = Result


/***/ }),

/***/ 1326:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { getStream, getSecureStream } = getStreamFuncs()

module.exports = {
  /**
   * Get a socket stream compatible with the current runtime environment.
   * @returns {Duplex}
   */
  getStream,
  /**
   * Get a TLS secured socket, compatible with the current environment,
   * using the socket and other settings given in `options`.
   * @returns {Duplex}
   */
  getSecureStream,
}

/**
 * The stream functions that work in Node.js
 */
function getNodejsStreamFuncs() {
  function getStream(ssl) {
    const net = __nccwpck_require__(9278)
    return new net.Socket()
  }

  function getSecureStream(options) {
    const tls = __nccwpck_require__(4756)
    return tls.connect(options)
  }
  return {
    getStream,
    getSecureStream,
  }
}

/**
 * The stream functions that work in Cloudflare Workers
 */
function getCloudflareStreamFuncs() {
  function getStream(ssl) {
    const { CloudflareSocket } = __nccwpck_require__(5072)
    return new CloudflareSocket(ssl)
  }

  function getSecureStream(options) {
    options.socket.startTls(options)
    return options.socket
  }
  return {
    getStream,
    getSecureStream,
  }
}

/**
 * Are we running in a Cloudflare Worker?
 *
 * @returns true if the code is currently running inside a Cloudflare Worker.
 */
function isCloudflareRuntime() {
  // Since 2022-03-21 the `global_navigator` compatibility flag is on for Cloudflare Workers
  // which means that `navigator.userAgent` will be defined.
  // eslint-disable-next-line no-undef
  if (typeof navigator === 'object' && navigator !== null && typeof navigator.userAgent === 'string') {
    // eslint-disable-next-line no-undef
    return navigator.userAgent === 'Cloudflare-Workers'
  }
  // In case `navigator` or `navigator.userAgent` is not defined then try a more sneaky approach
  if (typeof Response === 'function') {
    const resp = new Response(null, { cf: { thing: true } })
    if (typeof resp.cf === 'object' && resp.cf !== null && resp.cf.thing) {
      return true
    }
  }
  return false
}

function getStreamFuncs() {
  if (isCloudflareRuntime()) {
    return getCloudflareStreamFuncs()
  }
  return getNodejsStreamFuncs()
}


/***/ }),

/***/ 6002:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const types = __nccwpck_require__(3408)

function TypeOverrides(userTypes) {
  this._types = userTypes || types
  this.text = {}
  this.binary = {}
}

TypeOverrides.prototype.getOverrides = function (format) {
  switch (format) {
    case 'text':
      return this.text
    case 'binary':
      return this.binary
    default:
      return {}
  }
}

TypeOverrides.prototype.setTypeParser = function (oid, format, parseFn) {
  if (typeof format === 'function') {
    parseFn = format
    format = 'text'
  }
  this.getOverrides(format)[oid] = parseFn
}

TypeOverrides.prototype.getTypeParser = function (oid, format) {
  format = format || 'text'
  return this.getOverrides(format)[oid] || this._types.getTypeParser(oid, format)
}

module.exports = TypeOverrides


/***/ }),

/***/ 1657:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const defaults = __nccwpck_require__(2228)

const { isDate } = __nccwpck_require__(8253)

function escapeElement(elementRepresentation) {
  const escaped = elementRepresentation.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  return '"' + escaped + '"'
}

// convert a JS array to a postgres array literal
// uses comma separator so won't work for types like box that use
// a different array separator.
function arrayString(val) {
  let result = '{'
  for (let i = 0; i < val.length; i++) {
    if (i > 0) {
      result += ','
    }
    let item = val[i]
    if (item == null) {
      result += 'NULL'
    } else if (Array.isArray(item)) {
      result += arrayString(item)
    } else if (ArrayBuffer.isView(item)) {
      if (!(item instanceof Buffer)) {
        item = Buffer.from(item.buffer, item.byteOffset, item.byteLength)
      }
      result += '\\\\x' + item.toString('hex')
    } else {
      result += escapeElement(prepareValue(item))
    }
  }
  result += '}'
  return result
}

// converts values from javascript types
// to their 'raw' counterparts for use as a postgres parameter
// note: you can override this function to provide your own conversion mechanism
// for complex types, etc...
const prepareValue = function (val, seen) {
  // null and undefined are both null for postgres
  if (val == null) {
    return null
  }
  if (typeof val === 'object') {
    if (val instanceof Buffer) {
      return val
    }
    if (ArrayBuffer.isView(val)) {
      return Buffer.from(val.buffer, val.byteOffset, val.byteLength)
    }
    if (isDate(val)) {
      if (defaults.parseInputDatesAsUTC) {
        return dateToStringUTC(val)
      } else {
        return dateToString(val)
      }
    }
    if (Array.isArray(val)) {
      return arrayString(val)
    }

    return prepareObject(val, seen)
  }
  return val.toString()
}

function prepareObject(val, seen) {
  if (val && typeof val.toPostgres === 'function') {
    seen = seen || []
    if (seen.indexOf(val) !== -1) {
      throw new Error('circular reference detected while preparing "' + val + '" for query')
    }
    seen.push(val)

    return prepareValue(val.toPostgres(prepareValue), seen)
  }
  return JSON.stringify(val)
}

function dateToString(date) {
  let offset = -date.getTimezoneOffset()

  let year = date.getFullYear()
  const isBCYear = year < 1
  if (isBCYear) year = Math.abs(year) + 1 // negative years are 1 off their BC representation

  let ret =
    String(year).padStart(4, '0') +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0') +
    'T' +
    String(date.getHours()).padStart(2, '0') +
    ':' +
    String(date.getMinutes()).padStart(2, '0') +
    ':' +
    String(date.getSeconds()).padStart(2, '0') +
    '.' +
    String(date.getMilliseconds()).padStart(3, '0')

  if (offset < 0) {
    ret += '-'
    offset *= -1
  } else {
    ret += '+'
  }

  ret += String(Math.floor(offset / 60)).padStart(2, '0') + ':' + String(offset % 60).padStart(2, '0')
  if (isBCYear) ret += ' BC'
  return ret
}

function dateToStringUTC(date) {
  let year = date.getUTCFullYear()
  const isBCYear = year < 1
  if (isBCYear) year = Math.abs(year) + 1 // negative years are 1 off their BC representation

  let ret =
    String(year).padStart(4, '0') +
    '-' +
    String(date.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getUTCDate()).padStart(2, '0') +
    'T' +
    String(date.getUTCHours()).padStart(2, '0') +
    ':' +
    String(date.getUTCMinutes()).padStart(2, '0') +
    ':' +
    String(date.getUTCSeconds()).padStart(2, '0') +
    '.' +
    String(date.getUTCMilliseconds()).padStart(3, '0')

  ret += '+00:00'
  if (isBCYear) ret += ' BC'
  return ret
}

function normalizeQueryConfig(config, values, callback) {
  // can take in strings or config objects
  config = typeof config === 'string' ? { text: config } : config
  if (values) {
    if (typeof values === 'function') {
      config.callback = values
    } else {
      config.values = values
    }
  }
  if (callback) {
    config.callback = callback
  }
  return config
}

// Ported from PostgreSQL 9.2.4 source code in src/interfaces/libpq/fe-exec.c
const escapeIdentifier = function (str) {
  return '"' + str.replace(/"/g, '""') + '"'
}

const escapeLiteral = function (str) {
  let hasBackslash = false
  let escaped = "'"

  if (str == null) {
    return "''"
  }

  if (typeof str !== 'string') {
    return "''"
  }

  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (c === "'") {
      escaped += c + c
    } else if (c === '\\') {
      escaped += c + c
      hasBackslash = true
    } else {
      escaped += c
    }
  }

  escaped += "'"

  if (hasBackslash === true) {
    escaped = ' E' + escaped
  }

  return escaped
}

module.exports = {
  prepareValue: function prepareValueWrapper(value) {
    // this ensures that extra arguments do not get passed into prepareValue
    // by accident, eg: from calling values.map(utils.prepareValue)
    return prepareValue(value)
  },
  normalizeQueryConfig,
  escapeIdentifier,
  escapeLiteral,
}


/***/ }),

/***/ 9717:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



var path = __nccwpck_require__(6928)
  , Stream = (__nccwpck_require__(2203).Stream)
  , split = __nccwpck_require__(4211)
  , util = __nccwpck_require__(9023)
  , defaultPort = 5432
  , isWin = (process.platform === 'win32')
  , warnStream = process.stderr
;


var S_IRWXG = 56     //    00070(8)
  , S_IRWXO = 7      //    00007(8)
  , S_IFMT  = 61440  // 00170000(8)
  , S_IFREG = 32768  //  0100000(8)
;
function isRegFile(mode) {
    return ((mode & S_IFMT) == S_IFREG);
}

var fieldNames = [ 'host', 'port', 'database', 'user', 'password' ];
var nrOfFields = fieldNames.length;
var passKey = fieldNames[ nrOfFields -1 ];


function warn() {
    var isWritable = (
        warnStream instanceof Stream &&
          true === warnStream.writable
    );

    if (isWritable) {
        var args = Array.prototype.slice.call(arguments).concat("\n");
        warnStream.write( util.format.apply(util, args) );
    }
}


Object.defineProperty(module.exports, "isWin", ({
    get : function() {
        return isWin;
    } ,
    set : function(val) {
        isWin = val;
    }
}));


module.exports.warnTo = function(stream) {
    var old = warnStream;
    warnStream = stream;
    return old;
};

module.exports.getFileName = function(rawEnv){
    var env = rawEnv || process.env;
    var file = env.PGPASSFILE || (
        isWin ?
          path.join( env.APPDATA || './' , 'postgresql', 'pgpass.conf' ) :
          path.join( env.HOME || './', '.pgpass' )
    );
    return file;
};

module.exports.usePgPass = function(stats, fname) {
    if (Object.prototype.hasOwnProperty.call(process.env, 'PGPASSWORD')) {
        return false;
    }

    if (isWin) {
        return true;
    }

    fname = fname || '<unkn>';

    if (! isRegFile(stats.mode)) {
        warn('WARNING: password file "%s" is not a plain file', fname);
        return false;
    }

    if (stats.mode & (S_IRWXG | S_IRWXO)) {
        /* If password file is insecure, alert the user and ignore it. */
        warn('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less', fname);
        return false;
    }

    return true;
};


var matcher = module.exports.match = function(connInfo, entry) {
    return fieldNames.slice(0, -1).reduce(function(prev, field, idx){
        if (idx == 1) {
            // the port
            if ( Number( connInfo[field] || defaultPort ) === Number( entry[field] ) ) {
                return prev && true;
            }
        }
        return prev && (
            entry[field] === '*' ||
              entry[field] === connInfo[field]
        );
    }, true);
};


module.exports.getPassword = function(connInfo, stream, cb) {
    var pass;
    var lineStream = stream.pipe(split());

    function onLine(line) {
        var entry = parseLine(line);
        if (entry && isValidEntry(entry) && matcher(connInfo, entry)) {
            pass = entry[passKey];
            lineStream.end(); // -> calls onEnd(), but pass is set now
        }
    }

    var onEnd = function() {
        stream.destroy();
        cb(pass);
    };

    var onErr = function(err) {
        stream.destroy();
        warn('WARNING: error on reading file: %s', err);
        cb(undefined);
    };

    stream.on('error', onErr);
    lineStream
        .on('data', onLine)
        .on('end', onEnd)
        .on('error', onErr)
    ;

};


var parseLine = module.exports.parseLine = function(line) {
    if (line.length < 11 || line.match(/^\s+#/)) {
        return null;
    }

    var curChar = '';
    var prevChar = '';
    var fieldIdx = 0;
    var startIdx = 0;
    var endIdx = 0;
    var obj = {};
    var isLastField = false;
    var addToObj = function(idx, i0, i1) {
        var field = line.substring(i0, i1);

        if (! Object.hasOwnProperty.call(process.env, 'PGPASS_NO_DEESCAPE')) {
            field = field.replace(/\\([:\\])/g, '$1');
        }

        obj[ fieldNames[idx] ] = field;
    };

    for (var i = 0 ; i < line.length-1 ; i += 1) {
        curChar = line.charAt(i+1);
        prevChar = line.charAt(i);

        isLastField = (fieldIdx == nrOfFields-1);

        if (isLastField) {
            addToObj(fieldIdx, startIdx);
            break;
        }

        if (i >= 0 && curChar == ':' && prevChar !== '\\') {
            addToObj(fieldIdx, startIdx, i+1);

            startIdx = i+2;
            fieldIdx += 1;
        }
    }

    obj = ( Object.keys(obj).length === nrOfFields ) ? obj : null;

    return obj;
};


var isValidEntry = module.exports.isValidEntry = function(entry){
    var rules = {
        // host
        0 : function(x){
            return x.length > 0;
        } ,
        // port
        1 : function(x){
            if (x === '*') {
                return true;
            }
            x = Number(x);
            return (
                isFinite(x) &&
                  x > 0 &&
                  x < 9007199254740992 &&
                  Math.floor(x) === x
            );
        } ,
        // database
        2 : function(x){
            return x.length > 0;
        } ,
        // username
        3 : function(x){
            return x.length > 0;
        } ,
        // password
        4 : function(x){
            return x.length > 0;
        }
    };

    for (var idx = 0 ; idx < fieldNames.length ; idx += 1) {
        var rule = rules[idx];
        var value = entry[ fieldNames[idx] ] || '';

        var res = rule(value);
        if (!res) {
            return false;
        }
    }

    return true;
};



/***/ }),

/***/ 1269:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



var path = __nccwpck_require__(6928)
  , fs = __nccwpck_require__(9896)
  , helper = __nccwpck_require__(9717)
;


module.exports = function(connInfo, cb) {
    var file = helper.getFileName();
    
    fs.stat(file, function(err, stat){
        if (err || !helper.usePgPass(stat, file)) {
            return cb(undefined);
        }

        var st = fs.createReadStream(file);

        helper.getPassword(connInfo, st, cb);
    });
};

module.exports.warnTo = helper.warnTo;


/***/ }),

/***/ 3250:
/***/ ((__unused_webpack_module, exports) => {



exports.parse = function (source, transform) {
  return new ArrayParser(source, transform).parse()
}

class ArrayParser {
  constructor (source, transform) {
    this.source = source
    this.transform = transform || identity
    this.position = 0
    this.entries = []
    this.recorded = []
    this.dimension = 0
  }

  isEof () {
    return this.position >= this.source.length
  }

  nextCharacter () {
    var character = this.source[this.position++]
    if (character === '\\') {
      return {
        value: this.source[this.position++],
        escaped: true
      }
    }
    return {
      value: character,
      escaped: false
    }
  }

  record (character) {
    this.recorded.push(character)
  }

  newEntry (includeEmpty) {
    var entry
    if (this.recorded.length > 0 || includeEmpty) {
      entry = this.recorded.join('')
      if (entry === 'NULL' && !includeEmpty) {
        entry = null
      }
      if (entry !== null) entry = this.transform(entry)
      this.entries.push(entry)
      this.recorded = []
    }
  }

  consumeDimensions () {
    if (this.source[0] === '[') {
      while (!this.isEof()) {
        var char = this.nextCharacter()
        if (char.value === '=') break
      }
    }
  }

  parse (nested) {
    var character, parser, quote
    this.consumeDimensions()
    while (!this.isEof()) {
      character = this.nextCharacter()
      if (character.value === '{' && !quote) {
        this.dimension++
        if (this.dimension > 1) {
          parser = new ArrayParser(this.source.substr(this.position - 1), this.transform)
          this.entries.push(parser.parse(true))
          this.position += parser.position - 2
        }
      } else if (character.value === '}' && !quote) {
        this.dimension--
        if (!this.dimension) {
          this.newEntry()
          if (nested) return this.entries
        }
      } else if (character.value === '"' && !character.escaped) {
        if (quote) this.newEntry(true)
        quote = !quote
      } else if (character.value === ',' && !quote) {
        this.newEntry()
      } else {
        this.record(character.value)
      }
    }
    if (this.dimension !== 0) {
      throw new Error('array dimension not balanced')
    }
    return this.entries
  }
}

function identity (value) {
  return value
}


/***/ }),

/***/ 2878:
/***/ ((module) => {



var bufferFrom = Buffer.from || Buffer

module.exports = function parseBytea (input) {
  if (/^\\x/.test(input)) {
    // new 'hex' style response (pg >9.0)
    return bufferFrom(input.substr(2), 'hex')
  }
  var output = ''
  var i = 0
  while (i < input.length) {
    if (input[i] !== '\\') {
      output += input[i]
      ++i
    } else {
      if (/[0-7]{3}/.test(input.substr(i + 1, 3))) {
        output += String.fromCharCode(parseInt(input.substr(i + 1, 3), 8))
        i += 4
      } else {
        var backslashes = 1
        while (i + backslashes < input.length && input[i + backslashes] === '\\') {
          backslashes++
        }
        for (var k = 0; k < Math.floor(backslashes / 2); ++k) {
          output += '\\'
        }
        i += Math.floor(backslashes / 2) * 2
      }
    }
  }
  return bufferFrom(output, 'binary')
}


/***/ }),

/***/ 3337:
/***/ ((module) => {



var DATE_TIME = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/
var DATE = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/
var TIME_ZONE = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/
var INFINITY = /^-?infinity$/

module.exports = function parseDate (isoDate) {
  if (INFINITY.test(isoDate)) {
    // Capitalize to Infinity before passing to Number
    return Number(isoDate.replace('i', 'I'))
  }
  var matches = DATE_TIME.exec(isoDate)

  if (!matches) {
    // Force YYYY-MM-DD dates to be parsed as local time
    return getDate(isoDate) || null
  }

  var isBC = !!matches[8]
  var year = parseInt(matches[1], 10)
  if (isBC) {
    year = bcYearToNegativeYear(year)
  }

  var month = parseInt(matches[2], 10) - 1
  var day = matches[3]
  var hour = parseInt(matches[4], 10)
  var minute = parseInt(matches[5], 10)
  var second = parseInt(matches[6], 10)

  var ms = matches[7]
  ms = ms ? 1000 * parseFloat(ms) : 0

  var date
  var offset = timeZoneOffset(isoDate)
  if (offset != null) {
    date = new Date(Date.UTC(year, month, day, hour, minute, second, ms))

    // Account for years from 0 to 99 being interpreted as 1900-1999
    // by Date.UTC / the multi-argument form of the Date constructor
    if (is0To99(year)) {
      date.setUTCFullYear(year)
    }

    if (offset !== 0) {
      date.setTime(date.getTime() - offset)
    }
  } else {
    date = new Date(year, month, day, hour, minute, second, ms)

    if (is0To99(year)) {
      date.setFullYear(year)
    }
  }

  return date
}

function getDate (isoDate) {
  var matches = DATE.exec(isoDate)
  if (!matches) {
    return
  }

  var year = parseInt(matches[1], 10)
  var isBC = !!matches[4]
  if (isBC) {
    year = bcYearToNegativeYear(year)
  }

  var month = parseInt(matches[2], 10) - 1
  var day = matches[3]
  // YYYY-MM-DD will be parsed as local time
  var date = new Date(year, month, day)

  if (is0To99(year)) {
    date.setFullYear(year)
  }

  return date
}

// match timezones:
// Z (UTC)
// -05
// +06:30
function timeZoneOffset (isoDate) {
  if (isoDate.endsWith('+00')) {
    return 0
  }

  var zone = TIME_ZONE.exec(isoDate.split(' ')[1])
  if (!zone) return
  var type = zone[1]

  if (type === 'Z') {
    return 0
  }
  var sign = type === '-' ? -1 : 1
  var offset = parseInt(zone[2], 10) * 3600 +
    parseInt(zone[3] || 0, 10) * 60 +
    parseInt(zone[4] || 0, 10)

  return offset * sign * 1000
}

function bcYearToNegativeYear (year) {
  // Account for numerical difference between representations of BC years
  // See: https://github.com/bendrucker/postgres-date/issues/5
  return -(year - 1)
}

function is0To99 (num) {
  return num >= 0 && num < 100
}


/***/ }),

/***/ 4904:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



var extend = __nccwpck_require__(7736)

module.exports = PostgresInterval

function PostgresInterval (raw) {
  if (!(this instanceof PostgresInterval)) {
    return new PostgresInterval(raw)
  }
  extend(this, parse(raw))
}
var properties = ['seconds', 'minutes', 'hours', 'days', 'months', 'years']
PostgresInterval.prototype.toPostgres = function () {
  var filtered = properties.filter(this.hasOwnProperty, this)

  // In addition to `properties`, we need to account for fractions of seconds.
  if (this.milliseconds && filtered.indexOf('seconds') < 0) {
    filtered.push('seconds')
  }

  if (filtered.length === 0) return '0'
  return filtered
    .map(function (property) {
      var value = this[property] || 0

      // Account for fractional part of seconds,
      // remove trailing zeroes.
      if (property === 'seconds' && this.milliseconds) {
        value = (value + this.milliseconds / 1000).toFixed(6).replace(/\.?0+$/, '')
      }

      return value + ' ' + property
    }, this)
    .join(' ')
}

var propertiesISOEquivalent = {
  years: 'Y',
  months: 'M',
  days: 'D',
  hours: 'H',
  minutes: 'M',
  seconds: 'S'
}
var dateProperties = ['years', 'months', 'days']
var timeProperties = ['hours', 'minutes', 'seconds']
// according to ISO 8601
PostgresInterval.prototype.toISOString = PostgresInterval.prototype.toISO = function () {
  var datePart = dateProperties
    .map(buildProperty, this)
    .join('')

  var timePart = timeProperties
    .map(buildProperty, this)
    .join('')

  return 'P' + datePart + 'T' + timePart

  function buildProperty (property) {
    var value = this[property] || 0

    // Account for fractional part of seconds,
    // remove trailing zeroes.
    if (property === 'seconds' && this.milliseconds) {
      value = (value + this.milliseconds / 1000).toFixed(6).replace(/0+$/, '')
    }

    return value + propertiesISOEquivalent[property]
  }
}

var NUMBER = '([+-]?\\d+)'
var YEAR = NUMBER + '\\s+years?'
var MONTH = NUMBER + '\\s+mons?'
var DAY = NUMBER + '\\s+days?'
var TIME = '([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?'
var INTERVAL = new RegExp([YEAR, MONTH, DAY, TIME].map(function (regexString) {
  return '(' + regexString + ')?'
})
  .join('\\s*'))

// Positions of values in regex match
var positions = {
  years: 2,
  months: 4,
  days: 6,
  hours: 9,
  minutes: 10,
  seconds: 11,
  milliseconds: 12
}
// We can use negative time
var negatives = ['hours', 'minutes', 'seconds', 'milliseconds']

function parseMilliseconds (fraction) {
  // add omitted zeroes
  var microseconds = fraction + '000000'.slice(fraction.length)
  return parseInt(microseconds, 10) / 1000
}

function parse (interval) {
  if (!interval) return {}
  var matches = INTERVAL.exec(interval)
  var isNegative = matches[8] === '-'
  return Object.keys(positions)
    .reduce(function (parsed, property) {
      var position = positions[property]
      var value = matches[position]
      // no empty string
      if (!value) return parsed
      // milliseconds are actually microseconds (up to 6 digits)
      // with omitted trailing zeroes.
      value = property === 'milliseconds'
        ? parseMilliseconds(value)
        : parseInt(value, 10)
      // no zeros
      if (!value) return parsed
      if (isNegative && ~negatives.indexOf(property)) {
        value *= -1
      }
      parsed[property] = value
      return parsed
    }, {})
}


/***/ }),

/***/ 4211:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/*
Copyright (c) 2014-2021, Matteo Collina <hello@matteocollina.com>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/



const { Transform } = __nccwpck_require__(2203)
const { StringDecoder } = __nccwpck_require__(3193)
const kLast = Symbol('last')
const kDecoder = Symbol('decoder')

function transform (chunk, enc, cb) {
  let list
  if (this.overflow) { // Line buffer is full. Skip to start of next line.
    const buf = this[kDecoder].write(chunk)
    list = buf.split(this.matcher)

    if (list.length === 1) return cb() // Line ending not found. Discard entire chunk.

    // Line ending found. Discard trailing fragment of previous line and reset overflow state.
    list.shift()
    this.overflow = false
  } else {
    this[kLast] += this[kDecoder].write(chunk)
    list = this[kLast].split(this.matcher)
  }

  this[kLast] = list.pop()

  for (let i = 0; i < list.length; i++) {
    try {
      push(this, this.mapper(list[i]))
    } catch (error) {
      return cb(error)
    }
  }

  this.overflow = this[kLast].length > this.maxLength
  if (this.overflow && !this.skipOverflow) {
    cb(new Error('maximum buffer reached'))
    return
  }

  cb()
}

function flush (cb) {
  // forward any gibberish left in there
  this[kLast] += this[kDecoder].end()

  if (this[kLast]) {
    try {
      push(this, this.mapper(this[kLast]))
    } catch (error) {
      return cb(error)
    }
  }

  cb()
}

function push (self, val) {
  if (val !== undefined) {
    self.push(val)
  }
}

function noop (incoming) {
  return incoming
}

function split (matcher, mapper, options) {
  // Set defaults for any arguments not supplied.
  matcher = matcher || /\r?\n/
  mapper = mapper || noop
  options = options || {}

  // Test arguments explicitly.
  switch (arguments.length) {
    case 1:
      // If mapper is only argument.
      if (typeof matcher === 'function') {
        mapper = matcher
        matcher = /\r?\n/
      // If options is only argument.
      } else if (typeof matcher === 'object' && !(matcher instanceof RegExp) && !matcher[Symbol.split]) {
        options = matcher
        matcher = /\r?\n/
      }
      break

    case 2:
      // If mapper and options are arguments.
      if (typeof matcher === 'function') {
        options = mapper
        mapper = matcher
        matcher = /\r?\n/
      // If matcher and options are arguments.
      } else if (typeof mapper === 'object') {
        options = mapper
        mapper = noop
      }
  }

  options = Object.assign({}, options)
  options.autoDestroy = true
  options.transform = transform
  options.flush = flush
  options.readableObjectMode = true

  const stream = new Transform(options)

  stream[kLast] = ''
  stream[kDecoder] = new StringDecoder('utf8')
  stream.matcher = matcher
  stream.mapper = mapper
  stream.maxLength = options.maxLength
  stream.skipOverflow = options.skipOverflow || false
  stream.overflow = false
  stream._destroy = function (err, cb) {
    // Weird Node v12 bug that we need to work around
    this._writableState.errorEmitted = false
    cb(err)
  }

  return stream
}

module.exports = split


/***/ }),

/***/ 7736:
/***/ ((module) => {

module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}


/***/ }),

/***/ 9797:
/***/ ((module) => {

module.exports = eval("require")("pg-native");


/***/ }),

/***/ 6982:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("crypto");

/***/ }),

/***/ 2250:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("dns");

/***/ }),

/***/ 4434:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("events");

/***/ }),

/***/ 9896:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("fs");

/***/ }),

/***/ 9278:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("net");

/***/ }),

/***/ 6928:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("path");

/***/ }),

/***/ 2203:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("stream");

/***/ }),

/***/ 3193:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("string_decoder");

/***/ }),

/***/ 4756:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("tls");

/***/ }),

/***/ 9023:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("util");

/***/ }),

/***/ 8253:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("util/types");

/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __nccwpck_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	var threw = true;
/******/ 	try {
/******/ 		__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 		threw = false;
/******/ 	} finally {
/******/ 		if(threw) delete __webpack_module_cache__[moduleId];
/******/ 	}
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/asset-relocator-loader */
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = decodeURIComponent(new URL('.', import.meta.url).pathname).slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__nccwpck_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__nccwpck_require__.o(definition, key) && !__nccwpck_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__nccwpck_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

// EXPORTS
__nccwpck_require__.d(__webpack_exports__, {
  A: () => (/* binding */ actevents)
});

;// CONCATENATED MODULE: external "node:crypto"
const external_node_crypto_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:crypto");
// EXTERNAL MODULE: ./node_modules/pg/lib/index.js
var lib = __nccwpck_require__(5264);
;// CONCATENATED MODULE: ./node_modules/pg/esm/index.mjs
// ESM wrapper for pg


// Re-export all the properties
const Client = lib.Client
const Pool = lib.Pool
const Connection = lib.Connection
const types = lib.types
const Query = lib.Query
const DatabaseError = lib.DatabaseError
const escapeIdentifier = lib.escapeIdentifier
const escapeLiteral = lib.escapeLiteral
const Result = lib.Result
const TypeOverrides = lib.TypeOverrides

// Also export the defaults
const defaults = lib.defaults

// Re-export the default
/* harmony default export */ const esm = ((/* unused pure expression or super */ null && (pg)));

;// CONCATENATED MODULE: ./node_modules/@neon/functions/dist/lib/attach-database-pool.js
//#region src/lib/attach-database-pool.ts
const IDLE_DISCONNECT_CODES = /* @__PURE__ */ new Set([
	"ECONNRESET",
	"EPIPE",
	"ETIMEDOUT",
	"57P01"
]);
const attached = /* @__PURE__ */ new WeakSet();
const UNEXPECTED_POOL_ERROR = "attachDatabasePool: unexpected database pool error";
const REPORTER_THREW = "attachDatabasePool: onUnexpectedError threw";
const ALREADY_ATTACHED = "attachDatabasePool() was already called for this pool; this onUnexpectedError is ignored. Pass it on the first call.";
function isDatabasePool(value) {
	return typeof value === "object" && value !== null && "on" in value && typeof value.on === "function";
}
function isIdleDisconnect(err) {
	const code = "code" in err && typeof err.code === "string" ? err.code : void 0;
	return code !== void 0 && IDLE_DISCONNECT_CODES.has(code) || err.message === "Connection terminated unexpectedly";
}
function describeValue(value) {
	if (value === null) return "null";
	return typeof value;
}
function isPromise(value) {
	return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function";
}
function requireDatabasePool(pool) {
	if (isDatabasePool(pool)) return pool;
	if (typeof pool === "object" && pool !== null) throw new TypeError("attachDatabasePool() requires a node-postgres Pool with an on() method, got an object without one");
	throw new TypeError(`attachDatabasePool() requires a node-postgres Pool, got ${describeValue(pool)}`);
}
function resolveOnUnexpectedError(options) {
	if (options === void 0) return;
	if (typeof options !== "object" || options === null) throw new TypeError(`attachDatabasePool() options must be an object, got ${describeValue(options)}`);
	if (!("onUnexpectedError" in options) || options.onUnexpectedError === void 0) return;
	const handler = options.onUnexpectedError;
	if (typeof handler !== "function") throw new TypeError(`attachDatabasePool() onUnexpectedError must be a function, got ${typeof handler}`);
	return (err) => handler(err);
}
function reportUnexpectedError(err, onUnexpectedError) {
	if (!onUnexpectedError) {
		console.error(UNEXPECTED_POOL_ERROR, err);
		return;
	}
	try {
		const result = onUnexpectedError(err);
		if (isPromise(result)) result.catch((reporterError) => {
			console.error(UNEXPECTED_POOL_ERROR, err);
			console.error(REPORTER_THREW, reporterError);
		});
	} catch (reporterError) {
		console.error(UNEXPECTED_POOL_ERROR, err);
		console.error(REPORTER_THREW, reporterError);
	}
}
function attachDatabasePool(pool, options) {
	const databasePool = requireDatabasePool(pool);
	const onUnexpectedError = resolveOnUnexpectedError(options);
	if (attached.has(databasePool)) {
		if (onUnexpectedError) console.warn(ALREADY_ATTACHED);
		return;
	}
	databasePool.on("error", (err) => {
		if (isIdleDisconnect(err)) return;
		reportUnexpectedError(err, onUnexpectedError);
	});
	attached.add(databasePool);
}
//#endregion


//# sourceMappingURL=attach-database-pool.js.map
;// CONCATENATED MODULE: ./node_modules/@neon/functions/dist/lib/upgrade-websocket.js
//#region src/lib/upgrade-websocket.ts
/**
* `upgradeWebSocket(request)` turns an incoming WebSocket handshake into a live
* connection from inside an ordinary `fetch` handler:
*
* ```ts
* const { socket, response } = upgradeWebSocket(request);
* socket.addEventListener("message", (event) => socket.send(event.data));
* return response;
* ```
*
* Semantics follow `Deno.upgradeWebSocket`. `socket` is a standard `WebSocket`,
* still `CONNECTING` when you get it: the runtime writes the `101` only when the
* handler returns `response`, and the socket opens (firing `open`) at that
* point. Not returning `response` means the upgrade never completes.
*
* Return `response` **unchanged**. A `101` cannot be expressed as a plain
* `Response` — the fetch spec restricts constructed responses to 200-599 — so
* the runtime hands back a response object carrying the pending upgrade.
* Cloning it, or rebuilding it (`new Response(res.body, res)`, which
* response-rewriting middleware does), discards the upgrade; the runtime detects
* that and fails the request loudly rather than leaving the client hanging.
*
* There is no meaningful degraded WebSocket, so unlike `waitUntil` this throws
* off-platform instead of silently doing nothing: a socket that could never open
* is worse than an error that says so.
*/
/** The bridge global the Neon Functions runtime publishes. */
const WS_BRIDGE_KEY = Symbol.for("neon.websocket.bridge");
/**
* Upgrade an incoming request to a WebSocket connection.
*
* @throws {TypeError} off-platform (no Neon Functions runtime), when the request
* is not a WebSocket handshake, when called twice for the same request, or when
* `options.protocol` is not one the client offered.
*/
function upgradeWebSocket(request, options) {
	const bridge = globalThis[WS_BRIDGE_KEY];
	if (!bridge) throw new TypeError("upgradeWebSocket() is only available inside a Neon Functions invocation. Run your function with `neon dev` locally, or deploy it.");
	return bridge.upgrade(request, options);
}
//#endregion


//# sourceMappingURL=upgrade-websocket.js.map
;// CONCATENATED MODULE: ./node_modules/@neon/functions/dist/index.js





;// CONCATENATED MODULE: ./functions/shared/db.mjs



const databaseUrl = process.env.ACT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: databaseUrl, max: 5 });
attachDatabasePool(pool);

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function nextBigintId(client, table) {
  const idColumns = new Map([
    ["agent_events", "event_id"],
    ["interventions", "id"],
    ["audit_events", "id"],
    ["reasoning_steps", "id"],
    ["usage_ledger", "id"],
    ["infra_metrics", "id"],
  ]);
  const idColumn = idColumns.get(table);
  if (!idColumn) throw new Error("unsupported_id_table");
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [`act:id:${table}`]);
  const { rows } = await client.query(`select coalesce(max(${idColumn}), 0)::bigint + 1 as id from ${table}`);
  return rows[0].id;
}

async function nextWorkspaceSequence(client, workspaceId) {
  const { rows } = await client.query(
    `insert into workspace_event_counters(workspace_id, next_sequence)
     values ($1, 2)
     on conflict (workspace_id)
     do update set next_sequence = workspace_event_counters.next_sequence + 1
     returning (next_sequence - 1)::bigint as sequence`,
    [workspaceId],
  );
  return rows[0].sequence;
}

async function appendEvent(client, event) {
  // event_id is global; sequence is workspace-scoped and is assigned atomically
  // by the database trigger. Keeping these two counters independent prevents
  // event_id collisions once more than one workspace emits sequence=1,2,...
  const eventId = await nextBigintId(client, "agent_events");
  const { rows } = await client.query(
    `insert into agent_events(
       event_id, workspace_id, team_id, agent_id, run_id, task_id,
       event_type, severity, sequence, correlation_id, causation_event_id, payload_json
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,null,$9,$10,$11::jsonb)
     returning *`,
    [
      eventId,
      event.workspaceId,
      event.teamId,
      event.agentId ?? null,
      event.runId ?? null,
      event.taskId ?? null,
      event.eventType,
      event.severity ?? "info",
      event.correlationId,
      event.causationEventId ?? null,
      JSON.stringify(event.payload ?? {}),
    ],
  );
  return rows[0];
}

async function appendAudit(client, audit) {
  const id = await nextBigintId(client, "audit_events");
  const { rows } = await client.query(
    `insert into audit_events(
       id, workspace_id, team_id, actor_type, actor_id, agent_id, run_id, task_id,
       action, target_type, target_id, decision, risk_score, result, correlation_id, payload_json
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
     returning *`,
    [
      id, audit.workspaceId, audit.teamId ?? null, audit.actorType, audit.actorId,
      audit.agentId ?? null, audit.runId ?? null, audit.taskId ?? null,
      audit.action, audit.targetType ?? null, audit.targetId ?? null,
      audit.decision ?? null, audit.riskScore ?? null, audit.result,
      audit.correlationId, JSON.stringify(audit.payload ?? {}),
    ],
  );
  return rows[0];
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function errorResponse(error) {
  const message = error instanceof Error ? error.message : "internal_error";
  const status = message.startsWith("not_found") ? 404
    : message.startsWith("conflict") || message.startsWith("invalid_transition") ? 409
    : message.startsWith("unauthorized") ? 401
    : message.startsWith("forbidden") ? 403
    : message.startsWith("bad_request") ? 400
    : 500;
  return json({ error: message }, status);
}

async function readJson(request) {
  try { return await request.json(); }
  catch { throw new Error("bad_request:invalid_json"); }
}

function requireApiKey(request) {
  const expected = process.env.CONTROL_API_KEY;
  if (!expected) throw new Error("CONTROL_API_KEY is required");
  const actual = request.headers.get("x-api-key");
  if (actual !== expected) throw new Error("unauthorized:invalid_api_key");
}

function idempotencyKey(request, body) {
  return request.headers.get("idempotency-key") || body.idempotencyKey || null;
}

function correlationId(request) {
  return request.headers.get("x-correlation-id") || crypto.randomUUID();
}

;// CONCATENATED MODULE: ./functions/actevents/handler.mjs



const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function scope(url) {
  const workspaceId = url.searchParams.get("workspace_id");
  const teamId = url.searchParams.get("team_id");
  if (!workspaceId) throw new Error("bad_request:workspace_id_required");
  return { workspaceId, teamId };
}

function tokenDigest(token) {
  return (0,external_node_crypto_namespaceObject.createHash)("sha256").update(token).digest("hex");
}

async function verifyStreamToken(token, workspaceId, teamId) {
  if (!token) throw new Error("unauthorized:missing_stream_token");
  const digest = tokenDigest(token);
  const { rows } = await pool.query(
    `select payload_json
       from audit_events
      where workspace_id=$1
        and team_id is not distinct from $2
        and action='stream.token.issue'
        and target_type='stream_token'
        and target_id=$3
        and result='issued'
      order by created_at desc, id desc
      limit 1`,
    [workspaceId, teamId ?? null, digest],
  );
  if (!rows.length) throw new Error("unauthorized:invalid_stream_token");
  const payload = rows[0].payload_json ?? {};
  const expiresAt = Number(payload.expires_at);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    throw new Error("unauthorized:expired_stream_token");
  }
  if ((payload.team_id ?? null) !== (teamId ?? null)) throw new Error("forbidden:stream_scope_mismatch");
  return true;
}

async function readEvents(workspaceId, teamId, after, limit = 100) {
  const params = [workspaceId, after, Math.min(Math.max(limit, 1), 250)];
  let where = "workspace_id=$1 and sequence>$2";
  if (teamId) { params.splice(2, 0, teamId); where += " and team_id=$3"; }
  const limitPos = params.length;
  const { rows } = await pool.query(
    `select event_id, workspace_id, team_id, agent_id, run_id, task_id, event_type, severity,
            sequence, correlation_id, causation_event_id, payload_json, occurred_at
       from agent_events
      where ${where}
      order by sequence asc
      limit $${limitPos}`,
    params,
  );
  return rows;
}

function sseHeaders() {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "access-control-allow-origin": "*",
    "x-accel-buffering": "no",
  };
}

/* harmony default export */ const handler = ({
  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS", "access-control-allow-headers": "last-event-id" } });
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      if (url.pathname === "/health" || url.pathname === "/") return json({ ok: true, service: "actevents" }, 200, { "access-control-allow-origin": "*" });

      const { workspaceId, teamId } = scope(url);
      await verifyStreamToken(url.searchParams.get("token"), workspaceId, teamId);
      const queryAfter = Number(url.searchParams.get("after_sequence") || 0);
      const headerAfter = Number(request.headers.get("last-event-id") || 0);
      const after = Math.max(Number.isFinite(queryAfter) ? queryAfter : 0, Number.isFinite(headerAfter) ? headerAfter : 0);

      if (url.pathname === "/events") {
        const rows = await readEvents(workspaceId, teamId, after, Number(url.searchParams.get("limit") || 100));
        return json({ events: rows }, 200, { "access-control-allow-origin": "*" });
      }
      if (url.pathname !== "/stream") return json({ error: "not_found" }, 404, { "access-control-allow-origin": "*" });

      let cursor = after;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let lastHeartbeat = Date.now();
          controller.enqueue(encoder.encode(`retry: 1500\n\n`));
          try {
            while (!request.signal.aborted) {
              const rows = await readEvents(workspaceId, teamId, cursor, 100);
              for (const row of rows) {
                cursor = Number(row.sequence);
                controller.enqueue(encoder.encode(`id: ${row.sequence}\nevent: message\ndata: ${JSON.stringify(row)}\n\n`));
              }
              if (Date.now() - lastHeartbeat >= 10000) {
                controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
                lastHeartbeat = Date.now();
              }
              await sleep(rows.length ? 150 : 750);
            }
          } catch (error) {
            controller.enqueue(encoder.encode(`event: stream_error\ndata: ${JSON.stringify({ error: "stream_interrupted" })}\n\n`));
          } finally {
            try { controller.close(); } catch {}
          }
        },
      });
      return new Response(stream, { headers: sseHeaders() });
    } catch (error) {
      const response = errorResponse(error);
      response.headers.set("access-control-allow-origin", "*");
      return response;
    }
  },
});

;// CONCATENATED MODULE: ./functions/shared/vercel-oidc.mjs


const DEFAULT_OWNER = "alhajans664-2649s-projects";
const DEFAULT_PROJECT = "agent-control-tower";
const DEFAULT_ENVIRONMENTS = ["production", "preview"];
const JWKS_TTL_MS = 5 * 60_000;
const jwksCache = new Map();

function ownerSlug() { return process.env.VERCEL_OWNER_SLUG ?? DEFAULT_OWNER; }
function projectName() { return process.env.VERCEL_PROJECT_NAME ?? DEFAULT_PROJECT; }
function allowedEnvironments() {
  const raw = process.env.VERCEL_ALLOWED_ENVIRONMENTS;
  return new Set((raw ? raw.split(",") : DEFAULT_ENVIRONMENTS).map((v) => v.trim()).filter(Boolean));
}
function allowedIssuers() {
  const owner = ownerSlug();
  return new Set([`https://oidc.vercel.com/${owner}`, "https://oidc.vercel.com"]);
}
function expectedAudience() { return `https://vercel.com/${ownerSlug()}`; }
function decodeJson(segment) { return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")); }
function audienceMatches(aud) {
  const expected = expectedAudience();
  return typeof aud === "string" ? aud === expected : Array.isArray(aud) && aud.includes(expected);
}

function assertVercelClaims(payload) {
  const owner = ownerSlug();
  const project = projectName();
  const subjects = new Set([...allowedEnvironments()].map((env) => `owner:${owner}:project:${project}:environment:${env}`));
  if (!payload?.sub || !subjects.has(payload.sub)) throw new Error("unauthorized:vercel_oidc_subject");
  return payload;
}

async function jwksForIssuer(issuer) {
  const cached = jwksCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const discoveryUrl = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const discoveryResponse = await fetch(discoveryUrl, { headers: { accept: "application/json" } });
  if (!discoveryResponse.ok) throw new Error("unauthorized:vercel_oidc_discovery");
  const discovery = await discoveryResponse.json();
  if (!discovery?.jwks_uri) throw new Error("unauthorized:vercel_oidc_jwks");
  const jwksResponse = await fetch(discovery.jwks_uri, { headers: { accept: "application/json" } });
  if (!jwksResponse.ok) throw new Error("unauthorized:vercel_oidc_jwks");
  const jwks = await jwksResponse.json();
  if (!Array.isArray(jwks?.keys) || !jwks.keys.length) throw new Error("unauthorized:vercel_oidc_jwks");
  jwksCache.set(issuer, { keys: jwks.keys, expiresAt: Date.now() + JWKS_TTL_MS });
  return jwks.keys;
}

function verifyWithJwk(alg, signingInput, signature, jwk) {
  const key = (0,external_node_crypto_namespaceObject.createPublicKey)({ key: jwk, format: "jwk" });
  const data = Buffer.from(signingInput);
  const sig = Buffer.from(signature, "base64url");
  if (alg === "RS256" || alg === "RS384" || alg === "RS512") {
    const hash = `RSA-SHA${alg.slice(2)}`;
    return (0,external_node_crypto_namespaceObject.verify)(hash, data, key, sig);
  }
  if (alg === "PS256" || alg === "PS384" || alg === "PS512") {
    const bits = Number(alg.slice(2));
    return (0,external_node_crypto_namespaceObject.verify)(`RSA-SHA${bits}`, data, {
      key,
      padding: external_node_crypto_namespaceObject.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: bits / 8,
    }, sig);
  }
  if (alg === "ES256" || alg === "ES384" || alg === "ES512") {
    return (0,external_node_crypto_namespaceObject.verify)(`sha${alg.slice(2)}`, data, { key, dsaEncoding: "ieee-p1363" }, sig);
  }
  throw new Error("unauthorized:vercel_oidc_alg");
}

async function verifyVercelOidcToken(token) {
  if (!token) throw new Error("unauthorized:missing_vercel_oidc");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("unauthorized:invalid_vercel_oidc");
  let header, payload;
  try {
    header = decodeJson(parts[0]);
    payload = decodeJson(parts[1]);
  } catch {
    throw new Error("unauthorized:invalid_vercel_oidc");
  }
  const issuer = payload?.iss;
  if (!issuer || !allowedIssuers().has(issuer)) throw new Error("unauthorized:vercel_oidc_issuer");
  if (!audienceMatches(payload.aud)) throw new Error("unauthorized:vercel_oidc_audience");
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= now) throw new Error("unauthorized:vercel_oidc_expired");
  if (payload.nbf != null && (!Number.isFinite(payload.nbf) || payload.nbf > now + 30)) throw new Error("unauthorized:vercel_oidc_not_yet_valid");
  assertVercelClaims(payload);
  if (!header?.kid || !header?.alg || header.alg === "none") throw new Error("unauthorized:invalid_vercel_oidc");
  try {
    const keys = await jwksForIssuer(issuer);
    const jwk = keys.find((key) => key.kid === header.kid && (!key.alg || key.alg === header.alg));
    if (!jwk || !verifyWithJwk(header.alg, `${parts[0]}.${parts[1]}`, parts[2], jwk)) {
      jwksCache.delete(issuer);
      throw new Error("unauthorized:invalid_vercel_oidc");
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("unauthorized:")) throw error;
    throw new Error("unauthorized:invalid_vercel_oidc");
  }
}

async function requireVercelOidc(request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new Error("unauthorized:missing_vercel_oidc");
  return verifyVercelOidcToken(auth.slice(7).trim());
}

async function requireControlAuth(request) {
  const expected = process.env.CONTROL_API_KEY;
  const actual = request.headers.get("x-api-key");
  if (expected && actual === expected) return { auth: "api_key" };
  await requireVercelOidc(request);
  return { auth: "vercel_oidc" };
}

;// CONCATENATED MODULE: ./functions/actevents/index.mjs





const DEMO_WORKSPACE_ID = process.env.DEMO_WORKSPACE_ID ?? "ws_demo";
const DEMO_TEAMS = new Set(["team_operations", "team_revenue"]);
const TOKEN_TTL_SECONDS = 120;

function actevents_scope(url) {
  const workspaceId = url.searchParams.get("workspace_id");
  const teamId = url.searchParams.get("team_id");
  if (!workspaceId) throw new Error("bad_request:workspace_id_required");
  return { workspaceId, teamId };
}

function actevents_tokenDigest(token) {
  return (0,external_node_crypto_namespaceObject.createHash)("sha256").update(token).digest("hex");
}

async function issueStreamToken(request, workspaceId, teamId) {
  const token = (0,external_node_crypto_namespaceObject.randomBytes)(32).toString("base64url");
  const digest = actevents_tokenDigest(token);
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const correlationId = request.headers.get("x-correlation-id") ?? (0,external_node_crypto_namespaceObject.randomUUID)();

  await withTx((client) => appendAudit(client, {
    workspaceId,
    teamId,
    actorType: "system",
    actorId: "vercel_oidc",
    action: "stream.token.issue",
    targetType: "stream_token",
    targetId: digest,
    decision: "allow",
    result: "issued",
    correlationId,
    payload: { team_id: teamId ?? null, expires_at: expiresAt },
  }));

  return { token, expiresAt };
}

/* harmony default export */ const actevents = ({
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (request.method === "GET" && path === "/token") {
        await requireVercelOidc(request);
        const { workspaceId, teamId } = actevents_scope(url);
        if (workspaceId !== DEMO_WORKSPACE_ID || (teamId && !DEMO_TEAMS.has(teamId))) {
          throw new Error("forbidden:demo_scope");
        }
        const { token, expiresAt } = await issueStreamToken(request, workspaceId, teamId);
        return json({ token, expires_at: expiresAt }, 200, { "cache-control": "no-store" });
      }

      return handler.fetch(request);
    } catch (error) {
      const response = errorResponse(error);
      response.headers.set("access-control-allow-origin", "*");
      return response;
    }
  },
});

var __webpack_exports__default = __webpack_exports__.A;
export { __webpack_exports__default as default };
