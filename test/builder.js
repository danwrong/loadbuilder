var builder = require('loadbuilder/builder'),
    asset   = require('loadbuilder/asset'),
    assert  = require('assert');

var opts = {
  docroot: __dirname
};

module.exports = {
  testBuildShouldProvideSourceOfAllAssetsInCollection: function() {
    assert.equal(
      "alert('hello world');\nalert('hello world again');",
      builder(opts).include('fixtures/simple.js', 'fixtures/simple2.js').toSource()
    );
  },
  testShouldDedupeAssetsInACollection: function() {
    assert.equal(
      "alert('hello world');\nalert('hello world again');",
      builder(opts).include('fixtures/simple.js', 'fixtures/simple2.js', 'fixtures/simple.js').toSource()
    );
  },
  testShouldBeAbleToExcludeFiles: function() {
    assert.equal(
      "alert('hello world');",
      builder(opts).include('fixtures/simple.js', 'fixtures/simple2.js').exclude('fixtures/simple2.js').toSource()
    );
  },
  testShouldCollectDependencies: function() {
    assert.equal(
      "alert('hello dep1');\nusing('fixtures/dep1dep.js');\nalert('hello');\nusing('fixtures/dep1.js', 'fixtures/dep2.js');",
      builder(opts).include('fixtures/has_dep.js').toSource()
    );
  },
  testShouldExcludeDependenciesOfExcludedAsset: function() {
    assert.equal(
      "alert('hello');\nusing('fixtures/dep1.js', 'fixtures/dep2.js');",
      builder(opts).include('fixtures/has_dep.js').exclude('fixtures/dep1.js').toSource()
    );
  }
};