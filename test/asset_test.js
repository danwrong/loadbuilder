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
  testShouldFindDependenciesForScript: function() {
    var a = new asset.Script('fixtures/dep1.js');
    a.builder = builder({
      docroot: __dirname
    });
    assert.equal('fixtures/dep1dep.js', a.dependencies()[0].id);
  },
  testShouldAddNameToAnonModule: function() {
    var a = new asset.Module('anon');
    a.builder = builder({
      docroot: __dirname,
      path: '/modules'
    });

    assert.equal("provide('anon', function (exports) {\n    exports('hi');\n});", a.toSource());
  },
  testShouldNotAddNameToNamedModule: function() {
    var a = new asset.Module('named');
    a.builder = builder({
      docroot: __dirname,
      path: '/modules'
    });

    assert.equal("/*! license */\nprovide('named', function (exports) {\n    exports('hi');\n});", a.toSource());
  },
  testShouldFindDependenciesForModule: function() {
    var a = new asset.Module('has_dep');
    a.builder = builder({
      docroot: __dirname,
      path: '/modules'
    });

    assert.equal('anon', a.dependencies()[0].id);
  },
  testShouldFindDependenciesForModule2: function() {
    var a = new asset.Module('common');
    a.builder = builder({
      docroot: __dirname,
      path: '/modules'
    });

    assert.equal('anon', a.dependencies()[0].id);
  },
  testShouldWrapModule: function() {
    var a = new asset.Module('common');

    a.builder = builder({
      docroot: __dirname,
      path: '/modules'
    });

    assert.equal('define("common",["module","require","exports","anon"],' +
                 'function(module, require, exports) {\nvar a = require(\'anon\');\n});', a.toSource());
  },
  testShouldNotWrapAMDModule: function() {
    var a = new asset.Module('subfolder/amd');

    a.builder = builder({
      docroot: __dirname,
      path: '/modules'
    });

    var expectedResult = "define('amd', [\n    './amd_dep',\n    '../../fixtures/dep1',\n    'module',\n    'require',\n    'exports'\n], " +
      "function (common, dep1, module, require, exports) {\n    var a = require('./common');\n    return a;\n});";

    assert.equal(expectedResult,
      a.toSource());
  },
  testShouldAddNameAMDModule: function() {
    var a = new asset.Module('subfolder/amd_anon');

    a.builder = builder({
      docroot: __dirname,
      path: '/modules'
    });

    var expectedResult = "define('subfolder/amd_anon', ['./common'], function (common) {\n    return common;\n});";
    assert.equal(expectedResult,
      a.toSource());
  },
  testShouldHandleOmittedDependenciesAMDModule: function () {
    var a = new asset.Module('subfolder/amd_nodep');

    a.builder = builder({
      docroot: __dirname,
      path: '/modules'
    });

    var expectedResult = "define('subfolder/amd_nodep', function () {\n    return true;\n});";
    assert.equal(expectedResult, a.toSource());
  }
}