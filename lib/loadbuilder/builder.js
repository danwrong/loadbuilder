var util   = require('./util'),
    asset  = require('./asset'),
    path   = require('path'),
    fs     = require('fs'),
    uglify = require("uglify-js");

function collect(excluded, assets, includeDependencies) {
  var collected = [];

  assets.forEach(function(asset) {
    if(!asset) {
      console.warn('Undefined asset in assets list');
      console.log(new Error().stack);
      return;
    }
    var deps = [];
    if (excluded.indexOf(asset.id) < 0) {
      if (includeDependencies) {
        deps = asset.dependencies();
      }
      excluded = excluded.concat([asset.id]);

      collected = collected.concat(
        collect(excluded, deps, includeDependencies)
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
  this.excludes = this.options.excludes || [];
  this.matchers = [];
  this.preProcessor = options.preProcessor;
}

Builder.default_options = {
  path: '',
  docroot: process.cwd(),
  includeDependencies: true,
  preProcessor: null
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
    return path.join(this.options.docroot, this.options.path, id);
  },
  addMatcher: function(regex, factory) {
    this.matchers.push([regex, factory]);
  },
  matchAsset: function(id, exclude) {
    var m, dep, asset;
    if (typeof exclude === 'undefined') exclude = true;
    var allMatchers = this.matchers.concat(builder.matchers);
    for (var i=0, matcher; matcher = allMatchers[i]; i++) {
      var regex = matcher[0], factory = matcher[1];
      if ((!exclude || this.excludes.indexOf(id) < 0) && (m = id.match(regex))) {
        asset = factory(id);
        asset.builder = this;
        return asset;
      }
    }
    return [];
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
  manifest: function() {
    return this.collectedAssets().map(function(dep) {
      return dep.id;
    });
  },
  write: function(path, success) {
    var manifest = this.manifest(),
        res = {};

    res[path] = manifest;

    fs.writeFile(
      path, this.toSource(),
      'utf8', function() {
        if (success) {
          success(res);
        }
      }
    );

    this.log('> ' + path);

    return this;
  },
  collectedAssets: function() {
    return dedupe(collect(this.excludes, this.assets, this.options.includeDependencies));
  }
});

function builder(options) {
  return new Builder(options);
}

builder.asset = asset;
builder.analyzer = require('./analyzer');
builder.matchers = [];

builder.matchers.add = function(regex, factory) {
  this.unshift([regex, factory]);
}

asset.Module.regexp = /^\.?[a-zA-Z0-9_\-\/]+$/;
builder.matchers.add(asset.Module.regexp, function(id) {
  return new asset.Module(id);
})

asset.Script.regexp = /\.js$/;
builder.matchers.add(asset.Script.regexp, function(id) {
  return new asset.Script(id);
})

module.exports = builder;