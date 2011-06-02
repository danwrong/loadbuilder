#!/usr/bin/env node

var loadbuilder = require('loadbuilder');

var phoenixBuilder = loadbuilder.builder({
  docRoot: 'test',
  modPath: 'modules',
  distRoot: 'test/dist',
  logLevel: 2
});

var cbundle = phoenixBuilder.bundle('mod2-multiple');

var dbundle = phoenixBuilder.bundle('mod1-simple', {
  exclude: [cbundle]
});

// var ebundle = phoenixBuilder.bundle(['mod1-simple', 'mod2-multiple']);

var fbundle = phoenixBuilder.bundle('mod4-script');

phoenixBuilder.bundle('mod3-tree', {
  exclude: ['mod3_b', cbundle, dbundle]
});

console.log('errors:', phoenixBuilder.getErrors());

console.log('manifest:', phoenixBuilder.getBundleManifest());

