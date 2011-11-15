var util     = require('./util'),
    analyzer = require('./analyzer'),
    fs       = require('fs'),
    path     = require('path'),
    jshint   = require('jshint').JSHINT;

var USING_MATCHER     = [ 'call', [ 'name', 'using' ], null ];
var USING_ARG_MATCHER = [ 'string', null ];

function Script(id) {
  this.id = id;
}

util.extend(Script.prototype, {
  dependencies: function() {
    var usings, dependencies = [];

    if (!this._dependencies) {
      usings = analyzer.analyze(USING_MATCHER, this.toSource());

      usings.forEach(function(call) {
        var args = analyzer.analyze(USING_ARG_MATCHER, call.values);

        args.forEach(function(arg) {
           var dep = this.builder.matchAsset(arg.values[0]);
           dependencies = dependencies.concat(dep);
        }, this);
      }, this);

      this._dependencies = dependencies;
    }

    return this._dependencies;
  },
  lint: function(options) {
    var lintOptions = util.extend({}, this.builder.options.lint || {});
    util.extend(lintOptions, options || {});

    if (!jshint(this.toSource(), lintOptions)) {
      this.report(jshint.errors);
      process.exit(1);
    }
  },
  toSource: function() {
    if (!this._source) {
      this._source = fs.readFileSync(this.fullPath(), 'utf8');
    }

    return this._source;
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

module.exports = {
  Script: Script
};