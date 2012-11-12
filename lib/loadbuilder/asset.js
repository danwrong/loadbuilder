var util     = require('./util'),
    analyzer = require('./analyzer'),
    path     = require('path'),
    jshint   = require('jshint').JSHINT,
    file     = require('./file');

Error.stackTraceLimit = 100;

var ARRAY_ARG = {
  type: "ArrayExpression",
  elements: null
};
var STRING_ARG = {
  type: "Literal",
  value: null
};

var dependencyCache = {};
var dependencyCacheLastUpdate = {};

function Script(id) {
  this.id = id;
}

util.extend(Script.prototype, {
  dependencies: function() {
    var usings, dependencies = [];

    usings = this.fromFile().usings();
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
    return dependencies;
  },
  lint: function(options) {
    var lintOptions = util.extend({}, this.builder.options.lint || {});
    util.extend(lintOptions, options || {});

    if (!jshint(this.fromFile().source, lintOptions)) {
      this.report(jshint.errors);
      process.exit(1);
    }
  },
  ast: function() {
    return this.fromFile().ast();
  },
  addTranslationMarkers: function(fnName, translations) {
    return this.fromFile().addTranslationMarkers(fnName, translations);
  },
  stripUseStrict: function() {
    return this.fromFile().stripUseStrict();
  },
  toSource: function() {
    return this.deferWrapper(this.fromFile().generate());
  },
  fromFile: function() {
    if (!this.file) {
      this.file = file(this.fullPath(), this.builder.preProcessor, this.builder);
    }
    this.file.load();
    return this.file;
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
    this.stripUseStrict();
    if (this.isCJS()) {
      return this.amdWrappedSource();
    } else if (this.isAMD()) {
      return this.addIdToAMD();
    } else {
      return this.addIdToProvide();
    }
  },
  isCJS: function() {
    return !this.fromFile().provides().length && !this.isAMD();
  },
  isAMD: function() {
    return this.fromFile().defines().length && !this.fromFile().provides().length;
  },
  amdWrappedSource: function() {
    var deps = ['module', 'require', 'exports'].concat(this.dependencies().map(function(d) { return d.id; })),
        preamble = "define(" + JSON.stringify(this.id) + "," +
                   JSON.stringify(deps) + ",function(module, require, exports) {\n",
        postamble = "\n});"

    return preamble + this.fromFile().generate() + postamble;
  },

  dependencies: function(parent) {
    if (this.isCJS()) {
      return this.dependenciesFromRequire(parent);
    } else if (this.isAMD()) {
      return this.dependenciesFromAMD(parent);
    } else {
      return Script.prototype.dependencies.call(this);
    }
  },
  getAsset: function(dep, parent) {
    var asset = this.builder.matchAsset(resolveRelativePath(dep, parent), false);
    return (asset.length==0) ? null : asset;
  },
  dependenciesFromRequire: function(parent) {
    var requires = this.fromFile().requires();
    return requires.map(function(r) {
        return this.getAsset(r.values[0][0].value, parent);
      }, this).filter(function(item){ return item!=null; })
  },
  dependenciesFromAMD: function(parent) {
    var defines = analyzer.analyze(ARRAY_ARG, this.fromFile().defines()[0].values);
    var deps = defines[0].values[0].filter(function(item){
      return ['module', 'exports', 'require'].indexOf(item.value) == -1;
    }).map(function(dep) {
      return this.getAsset(dep.value, parent);
    }, this).filter(function(item){ return item!=null; });
    return deps;
  },
  addIdToProvide: function() {
    var provides = this.fromFile().provides(),
        tree = this.ast();

    if (provides.length > 0) {
      this.addId(provides[0])
    }
    return this.fromFile().generate();
  },
  addIdToAMD: function() {
    var defines = this.fromFile().defines(),
        tree = this.ast();

    if (defines.length > 0) {
      this.addId(defines[0]);
    }
    return this.fromFile().generate();
  },
  addId: function(subTree) {
    // Regenerate the ID if not present
    var args = subTree.parent.expression.arguments;
    if (!args[0] || args[0].type != 'Literal') {
      subTree.parent.expression.arguments.unshift({
        type: "Literal",
        value: this.id
      });
    }
    this.fromFile().taintAst();
  }
});

function resolveRelativePath(id, mod) {
  // replace the './' on the id with the dir taken from the mod id.
  var from = (mod && mod.id) || '';
  var parts = from.split('/'); parts.pop();
  var dir = parts.join('/');
  var filepath = path.join(dir, id);
  return (dir.length && id.match(/^\./)) ? filepath : id;
}

module.exports = {
  Script: Script,
  Module: Module
};