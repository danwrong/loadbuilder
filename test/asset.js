var builder = require('loadbuilder/builder'),
    asset   = require('loadbuilder/asset'),
    assert  = require('assert');

var myBuilder = builder({
  docroot: __dirname
});

module.exports = {
  testAssetShouldRetrieveSource: function() {

    var a = new asset.Script('fixtures/simple.js');
    a.builder = myBuilder;
    assert.equal("alert('hello world');", a.toSource());
  }
}