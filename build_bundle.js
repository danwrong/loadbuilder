#!/usr/bin/env node

var loadbuilder = require('loadbuilder');

var phoenixBuilder = loadbuilder.builder({
  nomin: true,
  docRoot: 'test',
  modPath: 'modules',
  distRoot: 'test/dist',
  logLevel: 0
});

var cbundle = phoenixBuilder.bundle('mod2-multiple');

var dbundle = phoenixBuilder.bundle('mod1-simple', {
  exclude: [cbundle]
});

phoenixBuilder.bundle('mod3-tree', {
  exclude: ['mod3_b', cbundle, dbundle]
});

console.log('errors:', phoenixBuilder.getErrors());

console.log('manifest:', phoenixBuilder.getBundleManifest());

