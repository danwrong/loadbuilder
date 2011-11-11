var util = require('./util'),
    asset = require('./asset'),
    path = require('path');

function builder(options) {
  return new Builder(options);
}

builder.matchers = [];

builder.matchers.add = function(regex, factory) {
  this.unshift([regex, factory]);
}

function Builder(options) {
  this.options = {};
  util.extend(this.options, Builder.default_options);
  util.extend(this.options, options || {});
}

Builder.default_options = {
  path: process.cwd(),
  docroot: process.cwd()
};

util.extend(Builder.prototype, {
  build: function(ids) {
    var assets = this.mapAssets(arguments);
    return new asset.Collection(this, assets);
  },
  path: function(id) {
    return path.join(this.options.docroot, id);
  },
  matchAsset: function(id) {
    var m, dep, asset;

    for (var i=0, matcher; matcher = builder.matchers[i]; i++) {
      var regex = matcher[0], factory = matcher[1];
      if (m = id.match(regex)) {
        asset = factory(id);
        asset.builder = this;
        return asset;
      }
    }
  },
  mapAssets: function(assets) {
    var mapped = [];

    for (var i=0, asset; asset = assets[i]; i++) {
      if (typeof asset == 'string') {
        asset = this.matchAsset(asset);
      }

      mapped.push(asset);
    }

    return mapped;
  }

});

builder.matchers.add(/./, function(id) {
  return new asset.Script(id);
})

module.exports = builder;