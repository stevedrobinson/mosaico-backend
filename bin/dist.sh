#!/usr/bin/env sh -e

branch="release"
lastversion=""
gitversion="$(git --version | grep -o "[0-9]*\.[0-9]*\.[0-9]*")"
if [ $(printf "2.0.0\n%s" "$gitversion" | sort -n | head -n1) = "2.0.0" ]; then
  git fetch --tags 1>/dev/null
  lastversion="$(git tag -l "$branch"-* --sort=v:refname | tail -1)"
fi

#
# Ask for the version
#

if [ -z $lastversion ]; then
  echo "\nChoose version (x.y.z)"
else
  echo "Version (last: $lastversion): x.y.z"
fi
read version
echo "version set to $version"

# Make a copy of the current directory
origdir=`pwd`
copydir=`mktemp -d /tmp/foo.XXX`
echo "\nbegin copy…"
cp -a . $copydir
echo "…copy end!"
cd $copydir

# build and clean directory
npm run build-release -- --pkg=$version

rm .gitignore
mv .gitignore-release .gitignore
rm -rf node_modules
# unfortunatly pushing the modules on Heroku break the build:
# Sharp can't build correctly his dependencies

# npm install --production

# a solution could be to pre-install sharp…
# https://github.com/lovell/sharp/issues/114#issuecomment-61751393

# "dependencies": {
#   ...
#  "npm": "1.x", // Add this
#  "sharp": "0.7.1", // Remove this
#   ...
# }

# "scripts": {
#     "preinstall": "npm install -g sharp",
#     ...
# },

# add, commit and push
git checkout -b "$branch"-"$version"
git rm -rf --cached .
git add .
git commit -m "build v$version"
git push origin "$branch"-"$version":"$branch" --force

# git add --force node_modules/ public/ tmp/md5public.json
# git commit -m "build v$version"
# git push origin "branch"-"$version":"branch" --force

# tags
git tag "$branch"-"$version"
git push --tags

#
# teardown
#

cd $origdir
rm -Rf $copydir

exit 0
