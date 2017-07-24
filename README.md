[![herokubtn](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/goodenough/mosaico-backend/tree/stage)

# Mosaico backend

Ready to go backend for [Mosaico](http://mosaico.io) editor.

SCREENCAST

## INSTALL

Pre-requisites:
 - Node.js (>=6)
 - MongoDB (~3.2.7)
 - SMTP server (like [MockSMTP](http://mocksmtpapp.com/) or )

NB: A compiled version of [sharp](http://sharp.dimens.io/en/stable/) — which is used to resize images and declared as a dependency — should be fetched automatically by npm for your system environment. In case of troubles see [sharp installation instructions](http://sharp.dimens.io/en/stable/install/).

```sh
npm run deps
npm run dev
```

Then go to: [http://localhost:3000](http://localhost:3000)

## Quick start

TODO

## Configuration

Mosaico backend has a decent localhost-first [default configuration](https://github.com/goodenough/mosaico-backend/blob/master/server/config.js#L13-L53).

You can override any of these values, in sereval ways (thanks to [rc](https://www.npmjs.com/package/rc)):

1.  command line arguments: `node server/worker.js --host=localhost:4000`
2.  environment `backend_*` variables: `export backend_host="localhost:4000"`
3.  config file (INI or JSON):
    1.  passed from command line: `node server --config /path/to/config.json`
    2.  a `.backendrc` file found somewhere at (in order):
        1.  local: `.` but also `../`, `../../`, `../../../`, …
        2.  home: `$HOME/.backendrc` or `$HOME/.backend/config` or `$HOME/.config/backend` or `$HOME/.config/backend/config`
        3.  etc: `/etc/backendrc` or `/etc/backend/config`

NB: In case of 3., just have a copy of the [`.backendrc-example`](https://github.com/goodenough/mosaico-backend/blob/master/.backendrc-example) file.

### Heroku

Heroku uses 2. environment [config vars](https://devcenter.heroku.com/articles/config-vars#setting-up-config-vars-for-a-deployed-application) that will take precedence over our defaults:
![heroku-config-vars](http://i.imgur.com/7d8sXGM.png)

## Updating the code

It should have a default config for dev already setup.  
If you want to change some, create `.backendrc` at the root of the project then fill with the values you want to overrride as described in the `.backendrc-example`

those are the main developper commands:

### Build the project for *production*

```
npm run build
```

### Start a server configured for *production*

```
npm start
```

server will be running on `localhost:3000`

### Build and start a *production* server

```
npm run prod
```

### Build and start a *development* server

```
npm run dev
```

- server will be running on `localhost:7000`
- server will be restarted on files changes
- build will be updated on files changes also

### Make a release

on your current branch

```
npm run release
```

The release will be pushed in the branch you have chosen (dev/stage)  
Automatic deploy is configured in heroku. So **pushing to any branch will automatically been deployed to heroku**

### Generating templates preview images

see README.md

### Databases scripts

`.backendrc` should be provided with *dbConfigs* infos. See `.backendrc-example` for more informations

#### sync-db

- can copy one DB into another
- can also copy a snapshot saved in `images.tmpDir` (see below) into another

```
npm run sync-db
```

#### backup-db

- will save a snapshot of the specified DB in the folder defined by `images.tmpDir` config

```
npm run backup-db
```

#### local-db

- save a *local db* snapshot
- restore it later

```
npm run local-db
```

### Tests

Run all backoffice's tests:

- all the dev prerequisite
- having the application being build `npm run build`
- run the test with `npm run tape`

Run a specific test:

`./node_modules/.bin/tape tests/functional/authentification.js | ./node_modules/.bin/faucet`

### S3 notes

This is some script to backup a bucket or sync a bucket from a backup.  
This is mostly use for developement purpose.

#### requirements

- [aws cli](http://docs.aws.amazon.com/cli/latest/reference/) – `brew install awscli` on a mac
- `.backendc` filled with s3Configs parameters. See `.backendrc-example`

[more details about why we use the aws cli](http://stackoverflow.com/questions/17832860/backup-strategies-for-aws-s3-bucket#answer-32927276)

#### backing up to a local folder

```
npm run backup-s3
```

#### syncing a bucket from a local folder

```
npm run sync-s3
```
