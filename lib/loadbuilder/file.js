var util = require('./util'),
    fs = require('fs'),
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

var lbAnalyzer; // solution for circular ref

var files = {};

function File(fullPath, preProcessor) {
  this.fullPath = fullPath;
  this.preProcessor = preProcessor;
  this.derived = {};
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
    if (!this.derived.i18nAdded) {
      var UNDERSCORE = {
            type: "CallExpression",
            callee: {
              type: "Identifier",
              name: fnName
            },
            arguments: null
          },
          tree = this.ast(),
          underscores = this.analyzer().analyze(UNDERSCORE, tree);
      // replace the underscore functions
      underscores.forEach(function(underscore) {
        var string = underscore.values[0];
        string[0].value = '____i18n____' + string[0].value + '____/i18n____';
        this.taintAst();
      }, this);
      this.derived.i18nAdded = true;
    }
  },
  generate: function(options) {
    if (!this.derived.generated) {
      options = options || {};
      var tree = this.ast();
      this.source = this.derived.generated = escodegen.generate(tree, util.extend({ comment: true }, options));
    }
    return this.derived.generated;
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
  requires: function() {
    if (!this.derived.requires) {
      this.derived.requires = this.analyzer().analyze(REQUIRE, this.ast());
    }
    return this.derived.requires;
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

function file(fullPath, preProcessor) {
  if (files[fullPath]) return files[fullPath];
  return files[fullPath] = new File(fullPath, preProcessor);
}

file.isFile = function(obj) {
  return obj instanceof File;
}

module.exports = file;