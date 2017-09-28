#!/usr/bin/env bash
# bin/compile <build-dir> <cache-dir>

function indent() {
  c='s/^/       /'
  case $(uname) in
    Darwin) sed -l "$c";;
    *)      sed -u "$c";;
  esac
}

arrow() {
  sed -u 's/^/-----> /'
}

BUILD_DIR=/app

echo "Installing libvips" | arrow

cd $BUILD_DIR

output_dir="${BUILD_DIR}/vendor/vips"
# Output library also to temp dir accordingly to pkg-config paths
temp_app_dir="/app/vendor/vips"
mkdir -p $output_dir
mkdir -p $temp_app_dir

echo "Downloading libvips and unpacking" | indent
curl -s https://s3-eu-west-1.amazonaws.com/visup-misc/heroku-buildpack-vips/201503311000.tar.gz | tar xz -C $output_dir

if [ $? != 0 ]; then
  echo "Error downloading vips and unpacking to build dir" | indent
  exit 1
fi

curl -s https://s3-eu-west-1.amazonaws.com/visup-misc/heroku-buildpack-vips/201503311000.tar.gz | tar xz -C $temp_app_dir

if [ $? != 0 ]; then
  echo "Error downloading vips and unpacking to app dir" | indent
  exit 1
fi
mkdir -p $BUILD_DIR/bin/
cp -r $output_dir/bin/* $BUILD_DIR/bin/

echo "libvips installed" | indent

#echo "Creating new env var in $3" | indent

echo "\$PKG_CONFIG_PATH:/app/vendor/vips/lib/pkgconfig" > $3/PKG_CONFIG_PATH

#echo "Installing vips .profile.d files" | indent

mkdir -p $BUILD_DIR/.profile.d
echo "export PATH=\"\$PATH:/app/vendor/vips/bin\"" > /app/.profile.d/vips.sh
echo "export PKG_CONFIG_PATH=\"\$PKG_CONFIG_PATH:/app/vendor/vips/lib/pkgconfig\"" >> /app/.profile.d/vips.sh
echo "export LD_LIBRARY_PATH=\"\$LD_LIBRARY_PATH:/app/vendor/vips/lib\"" >> /app/.profile.d/vips.sh

#echo ".profile.d files installed" | indent
source $BUILD_DIR/.profile.d/vips.sh