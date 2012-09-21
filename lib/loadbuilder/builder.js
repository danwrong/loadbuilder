var util   = require('./util'),
    asset  = require('./asset'),
    path   = require('path'),
    fs     = require('fs'),
    uglify = require('uglify-js'),
    crypto = require('crypto'),
    mkdirp = require('mkdirp'),
    escodegen = require('escodegen');

var REi18n = /['"]____i18n____(.*?)____\/i18n____['"]/g;

function hashString(string, salt) {
  salt = salt || '';
  var md5sum = crypto.createHash('sha1');
  md5sum.update(string + salt);
  return md5sum.digest('hex');
}

function collect(excluded, assets, includeDependencies) {
  var collected = [];

  assets.forEach(function(asset) {
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

      collected = collected.concat(
        collect(excluded, deps, includeDependencies)
      ).concat(asset);
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
  util.extend(this.options, Builder.default_options);
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
      excludes = ex.collectedAssets().map(function(dep) { return dep.id });
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

    return uglify.uglify.split_lines(uglify.uglify.gen_code(ast, opts), 255);
  },
  toSource: function() {
    var source = this.collectedAssets().map(function(a) {
      // this.log('* ' + a.id);
      if (this.i18nFn && !a.i18n) {
        a.addTranslationMarkers(this.i18nFn);
        a.i18n = true;
      }
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

    if (path.match('<hash>')) {
      res[this.writeHashedFile('', path, this.toSource())] = manifest;
      success(res);
    } else {
      res[path] = manifest;

      fs.writeFile(
        path, this.toSource(),
        'utf8', function() {
          if (success) {
            success(res);
          }
        }
      );
    }
    this.log('> ' + path);

    return this;
  },
  collectedAssets: function() {
    return dedupe(collect(this.excludes, this.assets, this.options.includeDependencies));
  },
  publishi18n: function(folder, outputName, translations, cb){
    var bundle = this;
    // Collect the bundle dependencies and build
    this.addI18nMarkers('_').minify({ except: ['_', '$'] }).translate(translations).writei18n(folder, outputName, cb);
  },
  addI18nMarkers: function(underscore) {
    // replace _() strings with something that's easy to regex for
    this.i18nFn = underscore; // name of i18n function
    return this;
  },
  translate: function(translations) {
    this.translations = translations;
    return this;
  },
  writeHashedFile: function(dir, fileName, src) {
    var hash = hashString(src, this.options.hashSalt);
    fileName = fileName.replace('<hash>', hash);
    var fullPath = path.join(dir, fileName);
    mkdirp.sync(path.dirname(fullPath));
    fs.writeFileSync(fullPath, src, 'utf8');
    return fileName;
  },
  writei18n: function(folder, fileName, success) {
    var manifest = this.manifest(),
        versions = {},
        source = this.toSource();

    if (!this.i18nFn || !this.translations) {
      throw new Error('did not translate - check i18n function name and translation table');
    }

    Object.keys(this.translations).forEach(function(langCode) {
      var langSrc = source.replace(REi18n, function(fullMatch, subMatch) {
        if (this.translations[langCode].hasOwnProperty(subMatch)) {
          // use escodegen to encode the string
          return escodegen.generate({
            "type": "Literal",
            "value": this.translations[langCode][subMatch]
          });
        }
        // revert to English if we have no string
        return subMatch;
      }.bind(this));

      var fullPath = fileName.replace('<lang>', langCode);
      versions[langCode] = this.writeHashedFile(path.join(folder, langCode), fullPath, langSrc);
    }, this);

    success(manifest, versions);

    this.log('> ' + fileName);

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