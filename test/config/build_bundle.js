#!/usr/bin/env node

var loadbuilder = require('loadbuilder');

loadbuilder.config({
  path: '../modules',
  matchers: [],
  nomin: true,
  follow: false
});

loadbuilder.bundle('base.js', {
  include: [
    'moda', 'modb', 'modc', 'javascript/something.js'
  ],
  exclude: [
    'modd'
  ]
});

loadbuilder.bundle('phoenix.js', {
  include: [
    'modx'
  ],
  exclude: [
    'modd'
  ]
});