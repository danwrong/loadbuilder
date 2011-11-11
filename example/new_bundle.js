#!/usr/bin/env node

var builder = require('loadbuilder/builder');

var phxBuilder = builder({
  docroot: 'test/fixtures'
})

console.log(
  phxBuilder
    .build('../../src/loadbuilder/asset.js')
    .lint()
    .minify()
    .toSource()
);
