'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const ConcatStream = require('concat-stream')
const GCS = require('@google-cloud/storage')
const MergeArgs = require('merge-args')
const Promise = require('bluebird')
const _ = require('lodash')
const defined = require('if-defined')
const mimeTypes = require('mime-types')

/* exports */
module.exports = GCSFS

/* constants */

// default arguments for new GCSFS()
const defaultArgs = {
    // set to true when bucket exists
    _bucketExists: undefined,
    // name of bucket
    bucketName: '',
    // bucket will be created if it does not exist
    createBucket: false,
    // google cloud key data
    credentials: {},
    // gzip files for transfer
    defaultGzip: false,
    // make files public by default
    defaultPublic: false,
    // path to google cloud key
    keyFile: '',
    // google cloud project id
    projectId: '',
}
// merge args instance
const mergeArgs = new MergeArgs()

/**
 * @function GCSFS
 *
 * instantiate a new Google Cloud Storage virtual fs instance
 *
 * @param {object} args
 *
 * @returns {GCSFS}
 *
 * @throws {Error}
 */
function GCSFS (args) {
    // initialize instance from default args
    _.merge(this, defaultArgs)
    // set args for instance
    mergeArgs(this, args)
    // require bucket
    assert(defined(this.bucketName), 'bucketName required')
    // args for instantiating google cloud storage client
    var gcsArgs = {
        promise: Promise,
    }
    // use key file if set
    if (defined(this.keyFile)) {
        gcsArgs.keyFilename = this.keyFile
    }
    // otherwise use credentials if set
    else if (defined(this.credentials)) {
        gcsArgs.credentials = this.credentials
    }
    else {
        throw new Error('keyFile or credentials required')
    }
    // create new gcs instance
    this.gcs = GCS(gcsArgs)
    // create bucket instance
    this.bucket = this.gcs.bucket(this.bucketName)
}

/* public methods */
GCSFS.prototype = {
    bucketExists: bucketExists,
    createReadStream: createReadStream,
    createWriteStream: createWriteStream,
    readFile: readFile,
    writeFile: writeFile,
}

/**
 * @function bucketExists
 *
 * resolves with true if bucket exists. if bucket does not exist and
 * createBucket option is set then bucket will be created.
 *
 * @returns {Promise}
 */
function bucketExists () {
    // if bucket exists already set then return existing value
    if (defined(this._bucketExists)) {
        // if bucket does not exist then throw error
        if (this._bucketExists === false) {
            throw new Error(`bucket does not exist ${this.bucketName}`)
        }
        // otherwise return value which may be promise or true
        else {
            return Promise.resolve(this._bucketExists)
        }
    }
    // check if bucket exists storing promise so that check will only be done
    // once per instance
    this._bucketExists = this.bucket.exists().then(data => {
        var exists = data[0]
        // bucket exists
        if (exists === true) {
            // replace original promise with boolean
            this._bucketExists = true
            // resolve with true
            return true
        }
        // bucket does not exists and should not be created
        if (!this.createBucket) {
            throw new Error(`bucket does not exist ${this.bucketName}`)
        }
        // create bucket
        return this.bucket.create().then(data => {
            // replace original promise with boolean
            this._bucketExists = true
            // resolve with true
            return true
        })
    })
    // return promise
    return this._bucketExists
}

/**
 * @function createReadStream
 *
 * @param {string} path
 * @param {object} options
 *
 * @returns {Promise}
 */
function createReadStream (path, options) {
    // make sure bucket exists
    return this.bucketExists().then(() => {
        // create file write stream
        return this.bucket.file(path).createReadStream({
        })
    })
}

/**
 * @function createWriteStream
 *
 * @param {string} path
 * @param {object} options
 *
 * @returns {Promise}
 */
function createWriteStream (path, options) {
    // build meta data
    var metadata = {}
    // get content type for file
    var contentType = mimeTypes.lookup(path)
    // set content type if found
    if (contentType) {
        metadata.contentType = contentType
    }
		// tips from https://github.com/novemberborn/thenstream
		
		function streamifyWriteStream (thenable, opts) {
		  const stream = new PassThrough(opts)

		  Promise.resolve(thenable)
		    .then(input => stream.pipe(input))
		    .catch(err => stream.emit('error', err))

		  return stream
		}
    var thenable = this.bucketExists().then(() => {
        // create file write stream
        return this.bucket.file(path).createWriteStream({
            gzip: this.defaultGzip,
            metadata: metadata,
            public: this.defaultPublic,
            resumable: false,
        })
    })
    // make sure bucket exists
    return streamifyWriteStream(thenable);
}

/**
 * @function readFile
 *
 * @param {string} file
 * @param {object} options
 *
 * @returns {Promise}
 */
function readFile (file, options, callback) {
  // options is optional param
  if(typeof(callback) === "undefined"){
    callback = options;
  }
  // return new Promise that will be resolved with data
  var stream = this.createReadStream(file, options);
  var concatStream = ConcatStream(buffer => {
      // resolve with string if encoding set or buffer
      var data = defined(options) && defined(options.encoding)
          ? buffer.toString(options.encoding)
          : buffer
      // resolve with data
      callback(null, data)
  })
  // reject on errors
  stream.on('error', callback)
  // pipe read stream to concat stream which will resolve when done
  stream.pipe(concatStream)
}

/**
 * @function writeFile
 *
 * @param {string} file
 * @param {Buffer|string} data
 * @param {object} options
 *
 * @returns {Promise}
 */
function writeFile (file, data, options, callback) {
  // options is optional param
  if(typeof(callback) === "undefined"){
    callback = options;
  }
  // create write stream
  const stream = this.createWriteStream(file, options);
  // write data to stream and end
  stream.end(data)
  // resolve on finish
  stream.on('finish', function(){
    callback();
  })
  // reject on error
  stream.on('error', callback)
}