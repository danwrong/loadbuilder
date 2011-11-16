var builder = require('loadbuilder/builder'),
    asset   = require('loadbuilder/asset'),
    assert  = require('assert');

module.exports = {
  testAssetShouldRetrieveSource: function() {
    var a = new asset.Script('fixtures/simple.js');
    a.builder = builder({
      docroot: __dirname
    });
    assert.equal("alert('hello world');", a.toSource());
  },
  testAssetCanBeWrappedInDeferred: function() {
    var a = new asset.Script('fixtures/simple.js');
    a.builder = builder({
      docroot: __dirname,
      useDeferred: true
    });
    assert.equal("deferred('fixtures/simple.js', function() {\nalert('hello world');\n});", a.toSource());
  },
  testShouldFindDependenciesForModule: function() {
    var a = new asset.Script('fixtures/dep1.js');
    a.builder = builder({
      docroot: __dirname
    });

    assert.equal('dep1dep', a.dependencies()[0].id);
  },
  testShouldAddNameToAnonModule: function() {
    var a = new asset.Module('anon');
    a.builder = builder({
      docroot: __dirname,
      path: __dirname + '/modules'
    });

    assert.equal('provide("anon", function(exports) {\n    exports("hi");\n});', a.toSource());
  },
  testShouldNotAddNameToNamedModule: function() {
    var a = new asset.Module('named');
    a.builder = builder({
      docroot: __dirname,
      path: __dirname + '/modules'
    });

    assert.equal('provide("shindig", function(exports) {\n    exports("hi");\n});', a.toSource());
  },
  testShouldFindDependenciesForModule: function() {
    var a = new asset.Module('has_dep');
    a.builder = builder({
      docroot: __dirname,
      path: __dirname + '/modules'
    });

    assert.equal('anon', a.dependencies()[0].id);
  },
  testShouldFindDependenciesForCommonJSModule: function() {
    var a = new asset.CommonJSModule('common');
    a.builder = builder({
      docroot: __dirname,
      path: __dirname + '/modules'
    });

    assert.equal('anon', a.dependencies()[0].id);
  },
  testShouldWrapCommonJSModule: function() {
    var a = new asset.CommonJSModule('common');

    a.builder = builder({
      docroot: __dirname,
      path: __dirname + '/modules'
    });

    assert.equal('(function() {\nvar module=define("common",["require","anon"],function(require) {\nvar a = require("anon");\n});\n})();', a.toSource());
  }
}