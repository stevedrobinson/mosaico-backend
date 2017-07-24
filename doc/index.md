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