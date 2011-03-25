provide(function(exports) {

  using('moda', 'modab', 'javascripts/d.js', '$mode.js', 'modb', function(moda, ab, b) {

    using('mode', function(e) {
    });
    using('moda', function(a) {
      exports({
        test: function() {
          return moda.test + ' from mod a';
        }
      });
    });
  });

  using('moda', function(a) {
    exports({
      test: function() {
        return moda.test + ' from mod a';
      }
    });
  });


});