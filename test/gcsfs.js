'use strict'

const GCSFS = require('../lib/gcsfs')

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert

const keyFile = process.env.KEY_FILE

describe('gcsfs', function () {
    // need longer timeout for remote calls
    this.timeout(10000)
    // GCSFS instance crated in before
    var gcsfs
    // get new unique bucket name
    var bucketName = `gcsfs-test-${new Date().getTime()}`

    before(async function () {
        // create gcsfs instance
        gcsfs = new GCSFS({
            bucketName: bucketName,
            createBucket: true,
            keyFile: keyFile,
        })
    })

    after(async function () {
        // delete all files in bucket
        await gcsfs.bucket.deleteFiles()
        // delete bucket
        await gcsfs.bucket.delete()
    })

    it('should write file', async function () {
        var file = 'test'
        // write file
        await gcsfs.writeFile(file, 'hello world');
        // check if file exists
        var data = await gcsfs.bucket.file(file).exists()
        assert.isTrue(data[0])
    })

    it('should write file in sub directory', async function () {
        var file = 'foo/bar/test'
        // write file
        await gcsfs.writeFile(file, 'hello world');
        // check if file exists
        var data = await gcsfs.bucket.file(file).exists()
        assert.isTrue(data[0])
    })

    it('should read file with encoding', async function () {
        var file = 'test2'
        // write file
        await gcsfs.writeFile(file, 'hello world');
        // read file
        var data = await gcsfs.readFile(file, {encoding: 'utf8'})
        // check contents
        assert.strictEqual(data, 'hello world')
    })

    it('should read file as buffer', async function () {
        var file = 'test3'
        // write file
        await gcsfs.writeFile(file, 'hello world');
        // read file
        var data = await gcsfs.readFile(file)
        // check contents
        assert.strictEqual(data.toString(), 'hello world')
    })

})