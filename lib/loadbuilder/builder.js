var util   = require('./util'),
    asset  = require('./asset'),
    path   = require('path'),
    fs     = require('fs'),
    uglify = require('uglify-js'),
    mkdirp = require('mkdirp'),
    escodegen = require('escodegen');

var REi18n = /['"]____i18n____(.*?)____\/i18n____['"]/g;

function collect(excluded, assets, includeDependencies) {
  var collected = [], subDeps;

  assets.forEach(function(asset) {
    if (asset instanceof Array && asset.length == 0 ) {
      return;
    }
    if(!asset) {
      this.warn('Undefined asset in assets list');
      this.log(new Error().stack);
      return;
    }
    var deps = [];
    if (excluded.indexOf(asset.id) < 0) {
      if (includeDependencies) {
        deps = asset.dependencies(asset);
      }
      excluded = excluded.concat([asset.id]);
      subDeps = collect(excluded, deps, includeDependencies);
      collected = collected.concat(subDeps).concat(asset);
    }
  }, this);
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
  util.extend(this.options, Builder.defaultOptions);
  util.extend(this.options, options || {});
  this.assets = [];
  this.excludes = [];
  if (this.options.excludes) {
    this.options.excludes.forEach(function(ex) {
      this.exclude(ex);
    }, this);
  }
  this.matchers = [];
  this.preProcessor = options.preProcessor;
}

Builder.defaultOptions = {
  path: '',
  docroot: process.cwd(),
  includeDependencies: true,
  preProcessor: null,
  translationFunctionName: '_'
};

util.extend(Builder.prototype, {
  include: function(ids) {
    this.assets = this.mapAssets(arguments);
    delete this.source;
    return this;
  },
  exclude: function(ex) {
    var excludes;

    if (ex.assets) {
      excludes = ex.collectedAssets().map(function(dep) { return dep.id });
    } else {
      excludes = [].slice.call(arguments);
    }

    this.excludes = this.excludes.concat(excludes);
    delete this.source;

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
    if (!exclude || this.excludes.indexOf(id) < 0) {
      var allMatchers = this.matchers.concat(builder.matchers);
      for (var i=0, matcher; matcher = allMatchers[i]; i++) {
        var regex = matcher[0], factory = matcher[1];
        if (m = id.match(regex)) {
          asset = factory(id);
          asset.builder = this;
          return asset;
        }
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
  toSource: function() {
    if (this.source) {
      return this.source;
    }

    this.source = this.collectedAssets().map(function(a) {
      // this.log('* ' + a.id);
      if (this.translations) {
        a.addTranslationMarkers(this.options.translationFunctionName);
      }
      return a.toSource();
    }, this).join('\n');

    return this.source;
  },
  manifest: function() {
    return this.collectedAssets().map(function(dep) {
      return dep.id;
    });
  },
  collectedAssets: function() {
    return dedupe(collect(this.excludes, this.assets, this.options.includeDependencies));
  },
  translate: function(translations, lang) {
    this.translations = translations;
    this.lang = lang;
    return this;
  },
  write: function(filename, success) {
    var manifest = this.manifest(),
        res = {},
        src = this.toSource(),
        hash = '';

    if (filename instanceof Array) {
      filename = path.join.apply(this, filename);
    }

    mkdirp.sync(path.dirname(filename));

    if (this.translations) {
      src = src.replace(REi18n, function(fullMatch, phrase) {
        if (this.translations.hasOwnProperty(phrase)) {
          phrase = this.translations[phrase];
        }
        // use escodegen to encode the string
        return escodegen.generate({
          "type": "Literal",
          "value": phrase
        });
      }.bind(this));
    }

    if (this.options.postProcess) {
      src = this.options.postProcess(src, this.lang || '');
    }

    if (filename.match('<hash>')) {
      hash = util.hashString(src, this.options.hashSalt);
      filename = filename.replace('<hash>', hash);
    }
    res[filename] = manifest;

    fs.writeFile(
      filename,
      src,
      'utf8', function() {
        if (success) {
          success(res, filename, hash);
        }
      }
    );

    this.log('> ' + filename);

    return this;
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

asset.Module.regexp = /^\.?[a-zA-Z0-9_\/.-]+$/;
builder.matchers.add(asset.Module.regexp, function(id) {
  return new asset.Module(id);
})

asset.Script.regexp = /\.js$/;
builder.matchers.add(asset.Script.regexp, function(id) {
  return new asset.Script(id);
})

module.exports = builder;