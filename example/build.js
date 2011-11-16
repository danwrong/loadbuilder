#!/usr/bin/env node

var builder = require('loadbuilder/builder');

var phxBuilder = builder({
  docroot: 'test/fixtures'
})

phxBuilder
  .include('simple.js')
  .lint()
  .minify()
  .write('example/test.js')
