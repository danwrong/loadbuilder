define("amd",
      ['./amd_dep', '../../fixtures/dep1', "module", "require", "exports"],
  function(common, dep1, module, require, exports) {
    var a = require('./common');
    return a;
  }
);