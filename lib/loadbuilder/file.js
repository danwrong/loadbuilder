var util = require('./util'),
    fs = require('fs'),
    uglify = require('uglify-js'),
    esprima = require('esprima'),
    escodegen= require('escodegen');

var USING = {
  type: "CallExpression",
  callee: {
    type: "Identifier",
    name: "using"
  },
  arguments: null
};
var REQUIRE = {
  type: "CallExpression",
  callee: {
    type: "Identifier",
    name: "require"
  },
  arguments: null
};
var DEFINE = {
  type: "CallExpression",
  callee: {
    type: "Identifier",
    name: "define"
  },
  arguments: null
};
var PROVIDE = {
  type: "CallExpression",
  callee: {
    type: "Identifier",
    name: "provide"
  },
  arguments: null
};
var USE_STRICT = {
  type: "ExpressionStatement",
  expression: {
    type: "Literal",
    value: "use strict",
    range: null
  },
  range: null
};

var lbAnalyzer; // solution for circular ref

var files = {};

Error.stackTraceLimit = 100;

function File(fullPath, preProcessor, builder) {
  this.fullPath = fullPath;
  this.preProcessor = preProcessor;
  this.derived = {};
  this.builder = builder;
  this.load();
}

util.extend(File.prototype, {
  load: function() {
    var fileInfo = fs.statSync(this.fullPath),
        mtime = fileInfo.mtime.getTime();
    if (!this.source || this.mtime != mtime) {
      this.mtime = mtime;
      this.source = this.preProcess(fs.readFileSync(this.fullPath, 'utf8'));
      this.taint();
    }
  },
  taint: function() {
    this.derived = {};
  },
  taintAst: function() {
    delete this.derived.generated;
  },
  preProcess: function(data) {
    return this.preProcessor ? this.preProcessor(data) : data;
  },
  ast: function() {
    if (!this.derived.esprimaAst) {
      var ast = esprima.parse(this.source, {
        range: true,
        tokens: true,
        comment: true
      });
      ast = escodegen.attachComments(ast, ast.comments, ast.tokens);
      this.derived.esprimaAst = ast;
    }
    return this.derived.esprimaAst;
  },
  addTranslationMarkers: function(fnName) {
    if (!this.derived.translationMarkers) {
      var TRANSLATION_FUNCTION = {
            type: "CallExpression",
            callee: {
              type: "Identifier",
              name: fnName
            },
            arguments: null
          },
          translations = this.analyzer().analyze(TRANSLATION_FUNCTION, this.ast());
      // replace the translations
      translations.forEach(function(func) {
        var string = func.values[0];
        string[0].value = '____i18n____' + string[0].value + '____/i18n____';;
      }, this);
      this.taintAst();
      this.derived.translationMarkers = true;
    }
  },
  generate: function(options) {
    if (!this.derived.generated) {
      options = options || {};
      this.source = this.derived.generated = escodegen.generate(this.ast(), util.extend({ comment: true }, options));
      if (this.builder.minifyOptions) {
        this.derived.generated = this.minifySource();
      }
    }
    return this.derived.generated;
  },
  stripUseStrict: function() {
    if (!this.derived.stripped) {
      if (this.ast()) {
        this.derived.esprimaAst.body = this.ast().body.filter(function(item) {
          return !this.analyzer().match(USE_STRICT, item);
        }.bind(this));
      }
      this.taintAst();
      this.derived.stripped = true;
    }
  },
  minifySource: function() {
    var ast, opts = util.extend({}, this.builder.options.minify || {});
    util.extend(opts, this.builder.minifyOptions);

    ast = uglify.parser.parse(this.derived.generated);
    ast = uglify.uglify.ast_mangle(ast, opts);
    ast = uglify.uglify.ast_squeeze(ast, opts);

    return uglify.uglify.gen_code(ast, opts);
  },
  usings: function() {
    if (!this.derived.usings) {
      this.derived.usings = this.analyzer().analyze(USING, this.ast());
    }
    return this.derived.usings;
  },
  requires: function() {
    if (!this.derived.requires) {
      this.derived.requires = this.analyzer().analyze(REQUIRE, this.ast());
    }
    return this.derived.requires;
  },
  defines: function() {
    if (!this.derived.defines) {
      this.derived.defines = this.analyzer().analyze(DEFINE, this.ast());
    }
    return this.derived.defines;
  },
  provides: function() {
    if (!this.derived.provides) {
      this.derived.provides = this.analyzer().analyze(PROVIDE, this.ast());
    }
    return this.derived.provides;
  },
  analyzer: function() {
    if (!lbAnalyzer) lbAnalyzer = require('./analyzer');
    return lbAnalyzer;
  }
});

function file(fullPath, preProcessor, builder) {
  if (files[fullPath]) return files[fullPath];
  return files[fullPath] = new File(fullPath, preProcessor, builder);
}

file.isFile = function(obj) {
  return obj instanceof File;
}

module.exports = file;