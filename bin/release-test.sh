#!/usr/bin/env sh -e

branch="release-test"
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

# add, commit and push
git checkout -b "$branch"-"$version"
git rm -rf --cached .
git add .
git commit -m "build v$version"
git push origin "$branch"-"$version":"$branch" --force

#
# teardown
#

cd $origdir
rm -Rf $copydir

exit 0
