provide(function(exports) {
  using('mod2_a', function(a) {
    using('mod2_b', function(b) {
      exports(b);
    });
  });
  using('mod2_b', function(b) {

  });
});