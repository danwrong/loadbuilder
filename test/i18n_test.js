var builder = require('../lib/loadbuilder/builder'),
    asset   = require('../lib/loadbuilder/asset'),
    assert  = require('assert'),
    fs      = require('fs'),
    path    = require('path');

var opts = {
  docroot: __dirname,
  path: 'modules',
  hashSalt: '7'
};

module.exports = {
  testTranslate: function() {
    var dir = __dirname;
    var translations = {
      fr: {
        'translate me': "I'm translated"
      }
    };
    var lang = 'fr';
    builder(opts)
      .include('fixtures/i18n.js')
      .minify({ except: ['_', '$'] })
      .translate(translations[lang])
      .write([dir, lang, 'bundle.<hash>.js'], function(manifest, filename) {
        assert.equal(
          "_('I\\'m translated'),_('I\\'m translated',param)",
          fs.readFileSync(filename, 'utf8')
        );
        var expected = {};
        expected[filename] = ["fixtures/i18n.js"];
        assert.deepEqual(expected, manifest);
        fs.unlinkSync(filename);
      });
  },
  testEscapedTranslate: function() {
    var dir = __dirname;
    var translations = {
      fr: {
        'translate me': "\u0022\"\''"
      }
    };
    var lang = 'fr';
    builder(opts)
      .include('fixtures/i18n.js')
      .minify({ except: ['_', '$'] })
      .translate(translations[lang])
      .write([dir, lang, 'bundle.<hash>.js'], function(manifest, filename) {
        assert.equal(
          "_('\"\"\\'\\''),_('\"\"\\'\\'',param)",
          fs.readFileSync(filename, 'utf8')
        );
        var expected = {};
        expected[filename] = ["fixtures/i18n.js"];
        assert.deepEqual(expected, manifest);
        fs.unlinkSync(filename);
      });
  }
};