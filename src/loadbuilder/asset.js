var util = require('./util'),
    fs   = require('fs'),
    path = require('path'),
    jshint = require('jshint').JSHINT,
    uglify = require("uglify-js");

function Script(id) {
  this.id = id;
}

util.extend(Script.prototype, {
  lint: function(options) {
    var lintOptions = util.extend({}, this.builder.options.lint || {});
    util.extend(lintOptions, options || {});

    if (!jshint(this.toSource(), lintOptions)) {
      this.report(jshint.errors);
      process.exit(1);
    }
  },
  toSource: function() {
    return fs.readFileSync(this.fullPath(), 'utf8');
  },
  fullPath: function() {
    return this.builder.path(this.id);
  },
  report: function(errors) {
    console.log('Errors in ' + this.fullPath() + ':\n');

    errors.forEach(function(e) {
      console.log('#' + e.line + ': ' + e.evidence);
      console.log(e.reason + ' line: ' + e.line +
                  ', col: ' + e.character + '\n');
    });
  }
});

function Collection(builder, assets) {
  this.builder = builder;
  this.assets = assets;
}

util.extend(Collection.prototype, {
  lint: function(options) {
    this.dedupedAssets().forEach(function(a) {
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
    var ast, source = this.dedupedAssets().map(function(a) {
      return a.toSource();
    }).join('\n');

    if (this.minifyOptions) {
      ast = uglify.parser.parse(source);
      ast = uglify.uglify.ast_mangle(ast);
      ast = uglify.uglify.ast_squeeze(ast);
      source = uglify.uglify.gen_code(ast);
    }

    return source;
  },

  write: function(path, success) {
    return fs.writeFile(
      path, this.toSource(),
      'utf8', success || function() {}
    );
  },
  dedupedAssets: function() {
    var i, ii, elem, seen = {},
        result = [], assets = this.assets;

    for (i = 0, ii = assets.length; i < ii; i++) {
      elem = assets[i];
      if (!seen[elem.id]) {
        seen[elem.id] = true;
        result.push(elem);
      }
    }
    return result;
  }
});


module.exports = {
  Collection: Collection,
  Script: Script
};