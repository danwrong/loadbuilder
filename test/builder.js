var builder = require('loadbuilder/builder'),
    asset   = require('loadbuilder/asset'),
    assert  = require('assert');

var myBuilder = builder({
  docroot: __dirname
});

module.exports = {
  testBuildShouldProvideSourceOfAllAssetsInCollection: function() {
    assert.equal(
      "alert('hello world');\nalert('hello world again');",
      myBuilder.build('fixtures/simple.js', 'fixtures/simple2.js').toSource()
    );
  },
  testShouldDedupeAssetsInACollection: function() {
    assert.equal(
      "alert('hello world');\nalert('hello world again');",
      myBuilder.build('fixtures/simple.js', 'fixtures/simple2.js', 'fixtures/simple.js').toSource()
    );
  }
};