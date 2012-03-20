var util     = require('./util'),
    analyzer = require('./analyzer'),
    fs       = require('fs'),
    path     = require('path'),
    jshint   = require('jshint').JSHINT,
    uglify   = require("uglify-js");

var USING      = [ 'call', [ 'name', 'using' ], null ];
var ARRAY_ARG = [ 'array', null ];
var STRING_ARG = [ 'string', null ];
var PROVIDE    = [ 'call', [ 'name', 'provide' ], null ];
var REQUIRE    = [ 'call', [ 'name', 'require' ], [ [ 'string', null] ] ];

var dependencyCache = {};
var dependencyCacheLastUpdate = {};

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
          } else if(m = analyzer.match(ARRAY_ARG, arg)) {
            arg[1].forEach(function(arg) {
              //  FIXME: duplicate code; un-nest this stuff
              //  nesty :(
              var dep, m;

              if (m = analyzer.match(STRING_ARG, arg)) {
                 dep = this.builder.matchAsset(m[0]);
                 dependencies = dependencies.concat(dep);
              }
            }, this);
          }
        }, this);
      }, this);

      dependencyCache[this.id] = dependencies;
      dependencyCacheLastUpdate[this.id] = new Date();
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
  preProcess: function(data) {
    return this.builder.preProcessor ? this.builder.preProcessor(data) : data;
  },
  fromFile: function() {
    if (!this._fromFile) {
      this._fromFile = this.preProcess(fs.readFileSync(this.fullPath(), 'utf8'));
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
Module.cjsMemo = {};

util.extend(Module.prototype, {
  fullPath: function() {
    return this.builder.modPath(this.id + '.js');
  },
  toSource: function() {
    if (!this._source) {
      if (this.isCJS()) {
        this._source = this.amdWrappedSource();
      } else {
        this._source = this.addId(this.fromFile());
      }
    } else {
      console.log("Already had source");
    }

    return this._source;
  },
  isCJS: function() {
    if (typeof this._isCJS == 'undefined') {
      //  FIXME: no memoization in Loadbuilder, please.
      var fileInfo = fs.statSync(this.fullPath());
      var cjsMemoKey = fileInfo.mtime + '_' + this.fullPath();
      if(typeof(Module.cjsMemo[cjsMemoKey]) !== 'undefined') {
        this._isCJS = Module.cjsMemo[cjsMemoKey];
      } else {
        this._isCJS = Module.cjsMemo[cjsMemoKey] = !analyzer.analyze(PROVIDE, this.fromFile()).length;
      }
    }

    return this._isCJS;
  },
  amdWrappedSource: function() {
    var deps = ['require', 'exports'].concat(this.dependencies().map(function(d) { return d.id; })),
        preamble = "(function() {\nvar module=define(" + JSON.stringify(this.id) + "," +
                   JSON.stringify(deps) + ",function(require, exports) {\n",
        postamble = "\n});\n})();"

        return preamble + this.fromFile() + postamble;
  },

  dependencies: function() {
    if(!this._deps) {
      if (this.isCJS()) {
        this._deps = this.dependenciesFromRequire();
      } else {
        this._deps = Script.prototype.dependencies.call(this);
      }
    }
    return this._deps;
  },
  dependenciesFromRequire: function() {
    var requires = analyzer.analyze(REQUIRE, this.fromFile());

    return requires.map(function(r) {
      return this.builder.matchAsset(r.values[0]);
    }, this);
  },
  addId: function() {
    var tree = uglify.parser.parse(this.fromFile()),
        provides = analyzer.analyze(PROVIDE, tree),
        provide;

    if (provides.length > 0) {
      provide = provides[0];

       // TODO make this nice - maybe have a transform function?
      if (analyzer.match(STRING_ARG, provide.values[0][0]) == null) {
        provide.parent[provide.index][2].unshift(['string', this.id]);
      }
    }

    return uglify.uglify.gen_code(tree, { beautify: true });
  }
});

module.exports = {
  Script: Script,
  Module: Module
};