# GCSFS

GCSFS provides an [mz/fs](https://www.npmjs.com/package/mz) comaptible virtual
fs that uses
[@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage) as
a backend.

GCSFS supports only a limited subset of the standard fs methods and only
supports async promise based access.