#!/usr/bin/env node

var loadbuilder = require('loadbuilder');

var phoenixBuilder = loadbuilder.builder({
  nomin: true,
  follow: true,
  docRoot: 'test',
  modPath: '/modules',
  distRoot: 'test/dist'
});

var cbundle = phoenixBuilder.bundle('modc');

var dbundle = phoenixBuilder.bundle('modd', {
  exclude: [cbundle]
});

phoenixBuilder.bundle('modb', {
  exclude: ['moda', cbundle, dbundle]
});


// ==> output inline script manifest
