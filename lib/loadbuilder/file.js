var util = require('./util'),
    fs = require('fs'),
    esprima = require('esprima'),
    escodegen= require('escodegen');

function File(fullPath, preProcessor) {
  this.fullPath = fullPath;
  this.preProcessor = preProcessor;
  this.load();
}

util.extend(File.prototype, {
  load: function() {
    var fileInfo = fs.statSync(this.fullPath),
        mtime = fileInfo.mtime.getTime();
    if (!this.source || this.mtime != mtime) {
      this.mtime = mtime;
      this.source = this.preProcess(fs.readFileSync(this.fullPath, 'utf8'));
      this.esprimaAst = null;
    }
  },
  preProcess: function(data) {
    return this.preProcessor ? this.preProcessor(data) : data;
  },
  ast: function() {
    if (!this.esprimaAst) {
      this.esprimaAst = esprima.parse(this.source, {
        range: true,
        tokens: true,
        comment: true
      });
      this.esprimaAst = escodegen.attachComments(this.esprimaAst, this.esprimaAst.comments, this.esprimaAst.tokens);
    }
    return this.esprimaAst
  },
  generate: function(options) {
    options = options || {};
    var tree = this.ast();
    return escodegen.generate(tree, util.extend({ comment: true }, options));
  }
});

function file(fullPath, preProcessor) {
  return new File(fullPath, preProcessor);
}

module.exports = File;