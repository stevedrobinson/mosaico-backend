[![herokubtn](https://www.herokucdn.com/deploy/button.svg)](asd)

* Live demo: https://mosaicobackend-prod.herokuapp.com
* Heroku button page: https://elements.heroku.com/buttons/goodenough/mosaico-backend

[![screencast](https://drive.google.com/uc?export=view&id=0BwQNm5fx5y30SXpSMWI4U1Z3b0E)](https://youtu.be/HqUT2et0FnM)

# Mosaico backend

Ready to go backend for [Mosaico](http://mosaico.io) editor.

Main features are:
- upload templates and images for Mosaico editor
- persist mailings into DB
- manage users/groups
- download ZIP archives of mailings
- sending mailings by email for testing purpose

## INSTALL

Pre-requisites:
 - Node.js >=8.5.0
 - [PostgreSQL](https://www.postgresql.org/) >=9.6 ([postgresapp](http://postgresapp.com/) on a mac)
 - [Redis](https://redis.io/) (`brew install redis` on mac `redis-server` to start)
 - SMTP server (like [mailcatcher](https://mailcatcher.me/): `brew install ruby` – restart terminal – `gem install mailcatcher` then `mailcatcher`)

NB: A compiled version of [sharp](http://sharp.dimens.io/en/stable/) — which is used to resize images and declared as a dependency — should be fetched automatically by npm for your system environment. In case of troubles see [sharp installation instructions](http://sharp.dimens.io/en/stable/install/).

```sh
npm run deps
npm run dev
```

Then go to: [http://localhost:3000](http://localhost:3000)

## Quick start

See the screencast https://youtu.be/sLzZq3cXDi0

## Configuration

Mosaico backend has a decent localhost-first [default configuration](https://github.com/goodenough/mosaico-backend/blob/master/server/config.js#L13-L53).

You can override any of these values, in sereval ways, in order of precedence:

1. command line arguments:
   ```sh
   node server/worker.js --admin__password=shhhhht
   ```
2. environment `backend_*` variables:
   ```sh
   export backend_admin__password="shhhhht"
   node server/worker.js
   ```
3. creating a `.backendrc` JSON file placed at project's root folder:
   ```sh
   cat <<EOF > .backendrc
   {
     "admin": {
       "password": "shhhhht"
     }
   }
   EOF
   ```
   or you could also make a copy of [`.backendrc-example`](https://github.com/goodenough/mosaico-backend/blob/master/.backendrc-example)

NB: Internally, we use [rc](https://www.npmjs.com/package/rc).

### Heroku

Heroku uses 2. environment [config vars](https://devcenter.heroku.com/articles/config-vars#setting-up-config-vars-for-a-deployed-application) that will take precedence over our defaults:
![heroku-config-vars](http://imgur.com/download/DAw55D3)

