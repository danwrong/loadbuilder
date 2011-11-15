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
  }
}