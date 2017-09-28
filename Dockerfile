# Inherit from Heroku's stack (see: https://hub.docker.com/r/heroku/cedar/)
FROM heroku/cedar:14

#
# Node
#

RUN mkdir -p /app/heroku/node

# Which version of node?
ENV NODE_ENGINE 8.5.0
# Locate our binaries
ENV PATH /app/heroku/node/bin/:/app/user/node_modules/.bin:$PATH

# Install node
RUN curl -s https://s3pository.heroku.com/node/v$NODE_ENGINE/node-v$NODE_ENGINE-linux-x64.tar.gz | tar --strip-components=1 -xz -C /app/heroku/node

# Export the node path in .profile.d
RUN mkdir -p /app/.profile.d
RUN echo "export PATH=\"/app/heroku/node/bin:/app/user/node_modules/.bin:\$PATH\"" > /app/.profile.d/nodejs.sh
RUN node --version

#
# Install libvips from heroku-buildpack-vips (see: https://github.com/alex88/heroku-buildpack-vips/blob/master/bin/compile)
#

ADD bin/vips-install.sh /tmp/vips-install.sh
RUN cd /tmp && ./vips-install.sh


### ONBUILD ADD package.json /app/user/
### ONBUILD RUN /app/heroku/node/bin/npm install
### ONBUILD ADD . /app/user/

WORKDIR /app/user

# node_modules (see: http://bitjudo.com/blog/2014/03/13/building-efficient-dockerfiles-node-dot-js/)
ADD package.json /tmp/package.json
RUN cd /tmp && export NODE_ENV=development && source /app/.profile.d/vips && npm install
RUN cp -a /tmp/node_modules /app/user

# bower_components
ADD bower.json /tmp/bower.json
RUN cd /tmp && /app/user/node_modules/bower/bin/bower -V --allow-root install
RUN cp -a /tmp/bower_components /app/user

ADD . /app/user/

RUN npx gulp build

EXPOSE 3000
CMD [ "npm", "start" ]