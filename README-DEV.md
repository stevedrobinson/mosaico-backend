
## INSTALL

Pre-requisites:
 - Node.js >=8.2.1
 - [PostgreSQL](https://www.postgresql.org/) >=9.6 ([postgresapp](http://postgresapp.com/) on a mac)
 - [Redis](https://redis.io/) (`brew install redis` on mac `redis-server` to start)
 - SMTP server (like [mailcatcher](https://mailcatcher.me/): `brew install ruby` – restart terminal – `gem install mailcatcher` then `mailcatcher`)

## commands

### Databases scripts

**requirements**: `pg_dump` & `pg_restore` installed and present on PATH

`.badsenderrc` should be provided with *dbConfigs* infos. See `.badsenderrc-example` for more informations

#### backup-db: backing up to a local folder

- will save a snapshot of the specified DB in the folder defined by `images.tmpDir` config

```
npm run backup-db
```


#### sync-db: syncing a DB from a local folder

- can copy one snapshot saved in `images.tmpDir` DB into another

```
npm run sync-db
```


### Tests

Run all backoffice's tests:

- run the test with `npm run tape`

Run a specific test:

`npx tape tests/functional/authentification.js | npx faucet`

### S3 notes

This is some script to backup a bucket or sync a bucket from a backup.  
This is mostly use for developement purpose.

#### requirements

- [aws cli](http://docs.aws.amazon.com/cli/latest/reference/) – `brew install awscli` on a mac
- `.badsenderc` filled with s3Configs parameters. See `.badsenderrc-example`

[more details about why we use the aws cli](http://stackoverflow.com/questions/17832860/backup-strategies-for-aws-s3-bucket#answer-32927276)

#### backing up to a local folder

```
npm run backup-s3
```

#### syncing a bucket from a local folder

```
npm run sync-s3
```
