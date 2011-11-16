var util     = require('./util'),
    analyzer = require('./analyzer'),
    fs       = require('fs'),
    path     = require('path'),
    jshint   = require('jshint').JSHINT,
    uglify   = require("uglify-js");

var USING      = [ 'call', [ 'name', 'using' ], null ];
var STRING_ARG = [ 'string', null ];
var PROVIDE    = [ 'call', [ 'name', 'provide' ], null ];
var REQUIRE    = [ 'call', [ 'name', 'require' ], [ [ 'string', null] ] ];

var dependencyCache = {};

function Script(id) {
  this.id = id;
}

util.extend(Script.prototype, {
  dependencies: function() {

    var usings, dependencies = [];

    if (!dependencyCache[this.id]) {
      usings = analyzer.analyze(USING, this.fromFile());

      usings.forEach(function(call) {
        var args = call.values[0];

        args.forEach(function(arg) {
          var dep, m;

          if (m = analyzer.match(STRING_ARG, arg)) {
             dep = this.builder.matchAsset(m[0]);
             dependencies = dependencies.concat(dep);
          }
        }, this);
      }, this);

      dependencyCache[this.id] = dependencies;
    }

    return dependencyCache[this.id];
  },
  lint: function(options) {
    var lintOptions = util.extend({}, this.builder.options.lint || {});
    util.extend(lintOptions, options || {});

    if (!jshint(this.fromFile(), lintOptions)) {
      this.report(jshint.errors);
      process.exit(1);
    }
  },
  toSource: function() {
    if (!this._source) {
      this._source = this.fromFile();
    }

    return this.deferWrapper(this._source);
  },
  fromFile: function() {
    if (!this._fromFile) {
      this._fromFile = fs.readFileSync(this.fullPath(), 'utf8');
    }

    return this._fromFile;
  },
  fullPath: function() {
    if (this.id.match(/^\$/)) {
      return this.builder.modPath(this.id.replace(/^\$/, ''));
    } else {
      return this.builder.path(this.id);
    }
  },
  report: function(errors) {
    console.log('Errors in ' + this.fullPath() + ':\n');

    errors.forEach(function(e) {
      console.log('#' + e.line + ': ' + e.evidence);
      console.log(e.reason + ' line: ' + e.line +
                  ', col: ' + e.character + '\n');
    });
  },
  deferWrapper: function(source) {
    return this.builder.options.useDeferred === true ? "deferred('" +
           this.id + "', function() {\n" + source + "\n});" : source;
  }
});

function Module(id) {
  this.id = id;
}

Module.prototype = new Script;

util.extend(Module.prototype, {
  fullPath: function() {
    return this.builder.modPath(this.id + '.js');
  },
  toSource: function() {
    if (!this._source) {
      this._source = this.addId(fs.readFileSync(this.fullPath(), 'utf8'));
    }

    return this._source;
  },
  addId: function() {
    var tree = uglify.parser.parse(this.fromFile()),
        provides = analyzer.analyze(PROVIDE, tree),
        provide;

    if (provides.length == 1) {
      provide = provides[0];

       // TODO make this nice - maybe have a transform function?
      if (analyzer.match(STRING_ARG, provide.values[0][0]) == null) {
        provide.parent[provide.index][2].unshift(['string', this.id]);
      }
    }

    return uglify.uglify.gen_code(tree, { beautify: true });
  }
});

function CommonJSModule(id) {
  this.id = id;
}

CommonJSModule.prototype = new Script;

util.extend(CommonJSModule.prototype, {
  fullPath: function() {
    return this.builder.modPath(this.id + '.js');
  },
  toSource: function() {
    if (!this._source) {
      this._source = this.amdWrappedSource();
    }

    return this._source;
  },
  amdWrappedSource: function() {
    var deps = ['require'].concat(this.dependencies().map(function(d) { return d.id; })),
        preamble = "(function() {\nvar module=define(" + JSON.stringify(this.id) + "," +
                   JSON.stringify(deps) + ",function(require) {\n",
        postamble = "\n});\n})();"

        return preamble + this.fromFile() + postamble;
  },
  dependencies: function() {
    var requires;

    if (!dependencyCache[this.id]) {
      requires = analyzer.analyze(REQUIRE, this.fromFile());

      dependencyCache[this.id] = requires.map(function(r) {
        return this.builder.matchAsset(r.values[0]);
      }, this);
    }

    return dependencyCache[this.id];
  }
});

module.exports = {
  Script: Script,
  Module: Module,
  CommonJSModule: CommonJSModule
};