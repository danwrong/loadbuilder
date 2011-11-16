var util   = require('./util'),
    asset  = require('./asset'),
    path   = require('path'),
    fs     = require('fs'),
    uglify = require("uglify-js");

function collect(excluded, assets) {
  var collected = [];

  assets.forEach(function(asset) {
    if (excluded.indexOf(asset.id) < 0) {
      collected = collected.concat(
        collect(excluded, asset.dependencies())
      ).concat(asset);
    }
  });

  return collected;
}

function dedupe(assets) {
  var i, ii, elem, seen = {},
      result = [];

  for (i = 0, ii = assets.length; i < ii; i++) {
    elem = assets[i];
    if (!seen[elem.id]) {
      seen[elem.id] = true;
      result.push(elem);
    }
  }

  return result;
}

function Builder(options) {
  this.options = {};
  util.extend(this.options, Builder.default_options);
  util.extend(this.options, options || {});
  this.assets = [];
  this.excludes = [];
}

Builder.default_options = {
  path: process.cwd(),
  docroot: process.cwd()
};

util.extend(Builder.prototype, {
  include: function(ids) {
    this.assets = this.mapAssets(arguments);

    return this;
  },
  exclude: function(ex) {
    var excludes;

    if (ex.assets) {
      excludes = ex.assets.map(function(dep) { return dep.id });
    } else {
      excludes = [].slice.call(arguments);
    }

    this.excludes = this.excludes.concat(excludes);

    return this;
  },
  log: function(message, level) {
    console.log(message);
  },
  path: function(id) {
    return path.join(this.options.docroot, id);
  },
  modPath: function(id) {
    return path.join(this.options.path, id);
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
  },
  lint: function(options) {
    this.collectedAssets().forEach(function(a) {
      a.lint(options);
    });

    return this;
  },
  minify: function(options) {
    if (options === false) {
      this.minifyOptions = null;
    } else {
      this.minifyOptions = (typeof options == 'object') ? options : {};
    }

    return this;
  },
  minifySource: function(source) {
    this.log('- Minifying bundle');

    var ast, opts = util.extend({}, this.options.minify || {});
    util.extend(opts, this.minifyOptions);

    ast = uglify.parser.parse(source);
    ast = uglify.uglify.ast_mangle(ast, opts);
    ast = uglify.uglify.ast_squeeze(ast, opts);

    return uglify.uglify.gen_code(ast, opts);
  },
  toSource: function() {
    var source = this.collectedAssets().map(function(a) {
      this.log('* ' + a.id);
      return a.toSource();
    }, this).join('\n');

    if (this.minifyOptions) {
      source = this.minifySource(source);
    }

    return source;
  },
  write: function(path, success) {

    fs.writeFile(
      path, this.toSource(),
      'utf8', success || function() {}
    );

    this.log('> ' + path);

    return this;
  },
  collectedAssets: function() {
    return dedupe(collect(this.excludes, this.assets));
  }
});

function builder(options) {
  return new Builder(options);
}

builder.matchers = [];

builder.matchers.add = function(regex, factory) {
  this.unshift([regex, factory]);
}

builder.matchers.add(/^[a-zA-Z0-9_\-\/]+$/, function(id) {
  return new asset.Module(id);
})

builder.matchers.add(/.js$/, function(id) {
  return new asset.Script(id);
})

module.exports = builder;